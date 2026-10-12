import { schema, uuidv7 } from '@kova/db'
import { decodeMemo } from '@kova/tempo'
import { and, eq, isNull } from 'drizzle-orm'
import type { Address, Hash, Hex, TransactionReceipt } from 'viem'
import { kit, publicClient } from '../chain.js'
import { db } from '../db.js'
import { KovaError } from '../errors.js'
import { encodeId } from '../ids.js'
import { findIntentByMemo, type PaymentIntent } from './intents.js'
import { onIntentPaid } from './travel.js'

export interface SettleResult {
  status: 'paid' | 'held' | 'failed' | 'ignored'
  paymentId?: string
  reason?: string
}

/**
 * Records an on-chain transfer against its payment intent.
 *
 * This is the single place a payment becomes real, and it is deliberately idempotent: the
 * same transaction can arrive from the relay (which submitted it), from the chain watcher
 * (which sees every transfer), and from a client calling /confirm, in any order.
 */
export async function settleFromReceipt(
  receipt: TransactionReceipt,
  options: { credentialId?: string | undefined } = {},
): Promise<SettleResult> {
  const existing = await db.query.payments.findFirst({
    where: eq(schema.payments.txHash, receipt.transactionHash),
  })
  if (existing) return { status: existing.status as SettleResult['status'], paymentId: existing.id }

  // Find the intent this transaction claims to pay, from the Kova memo it carries.
  const intent = await findIntentForReceipt(receipt)
  if (!intent) return { status: 'ignored', reason: 'no matching payment intent' }

  const verdict = kit.verifyPayment(receipt, {
    token: intent.tokenAddress as Address,
    payTo: intent.payTo as Address,
    amount: intent.amount,
    memo: intent.memo as `0x${string}`,
  })

  if (verdict.status === 'pending') return { status: 'ignored', reason: 'pending' }
  if (verdict.status === 'unmatched' || verdict.status === 'memo_mismatch')
    return { status: 'ignored', reason: verdict.status }

  // Held: it succeeded on-chain but the shop's own receive policy parked the money (Tempo).
  const status: 'paid' | 'held' | 'failed' =
    verdict.status === 'paid' ? 'paid' : verdict.status === 'held' ? 'held' : 'failed'
  const paymentId = uuidv7()
  const now = new Date()

  try {
    await recordPayment(intent)
  } catch (error) {
    // The relay, the chain watcher and /confirm can all record the same transfer at the same
    // moment, and on Tempo's half-second blocks they often do. The unique index on tx_hash
    // lets exactly one of them win; the others roll back whole and report what it wrote.
    if (!isUniqueViolation(error)) throw error
    const winner = await db.query.payments.findFirst({
      where: eq(schema.payments.txHash, receipt.transactionHash),
    })
    if (!winner) throw error
    return { status: winner.status as SettleResult['status'], paymentId: winner.id }
  }

  // The last share of a Kova Travel trip books it. Outside the transaction: booking calls Duffel.
  if (status === 'paid')
    void onIntentPaid(intent.id).catch((error) => console.error('[travel] after payment', error))

  return { status, paymentId }

  async function recordPayment(intent: PaymentIntent) {
    await db.transaction(async (tx) => {
      await tx.insert(schema.payments).values({
        id: paymentId,
        intentId: intent.id,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        payerAddress: verdict.payer ?? '0x',
        credentialId: options.credentialId ?? null,
        amount: intent.amount,
        tokenAddress: intent.tokenAddress,
        status,
        gasUsed: receipt.gasUsed,
        // Whoever paid the fee: Kova's fee payer (Tempo's sponsored transactions name it), Kova's
        // relayer (Monad), or the payer's own wallet.
        feePayerAddress: (receipt as { feePayer?: Address }).feePayer ?? receipt.from,
        confirmedAt: status === 'paid' ? now : null,
      })

      await tx
        .update(schema.paymentIntents)
        .set({
          status,
          paidAt: status === 'paid' ? now : null,
          updatedAt: now,
        })
        .where(eq(schema.paymentIntents.id, intent.id))

      if (status === 'paid') {
        // Double entry: the payer's funds left an account Kova does not control, and the
        // merchant's settlement address gained them.
        await tx.insert(schema.ledgerEntries).values([
          {
            id: uuidv7(),
            account: 'external',
            direction: 'debit',
            amount: intent.amount,
            currency: intent.currency,
            refType: 'payment',
            refId: paymentId,
          },
          {
            id: uuidv7(),
            account: `merchant:${intent.merchantId}`,
            direction: 'credit',
            amount: intent.amount,
            currency: intent.currency,
            refType: 'payment',
            refId: paymentId,
          },
        ])
        // A till sale changes hands across the counter as it is paid: it is never waiting to be collected.
        await tx
          .update(schema.orders)
          .set({ collectedAt: now })
          .where(
            and(
              eq(schema.orders.intentId, intent.id),
              eq(schema.orders.source, 'till'),
              isNull(schema.orders.collectedAt),
            ),
          )
      }

      await tx.insert(schema.events).values({
        id: uuidv7(),
        merchantId: intent.merchantId,
        type: status === 'paid' ? 'payment_intent.paid' : `payment_intent.${status}`,
        data: {
          payment_intent: encodeId('paymentIntent', intent.id),
          payment: encodeId('payment', paymentId),
          tx_hash: receipt.transactionHash,
          amount: intent.amount.toString(),
          currency: intent.currency,
        },
      })
    })
  }
}

/** Postgres's unique_violation, as postgres.js raises it or as Drizzle wraps it. */
function isUniqueViolation(error: unknown): boolean {
  const code = (e: unknown) =>
    e && typeof e === 'object' && 'code' in e ? (e as { code?: unknown }).code : undefined
  return code(error) === '23505' || code((error as { cause?: unknown } | null)?.cause) === '23505'
}

/**
 * The intent a receipt claims to pay: the Kova payment memo it carries (a `transferWithMemo` on
 * Tempo, an authorization's nonce on Monad).
 */
async function findIntentForReceipt(
  receipt: TransactionReceipt,
): Promise<PaymentIntent | undefined> {
  for (const memo of kit.memos(receipt.logs)) {
    if (decodeMemo(memo as Hex)?.kind !== 'payment') continue
    const intent = await findIntentByMemo(memo)
    if (intent) return intent
  }
  return undefined
}

/** Confirms a transaction hash a client reports, verifying it independently on-chain. */
export async function confirmTransaction(
  txHash: Hash,
  options: { credentialId?: string | undefined } = {},
): Promise<SettleResult> {
  let receipt: TransactionReceipt
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash })
  } catch (error) {
    throw new KovaError('chain_error', `Could not read transaction ${txHash}`, {
      cause: String(error),
    })
  }
  return settleFromReceipt(receipt, options)
}
