import { schema, uuidv7 } from '@kova/db'
import { decodeMemo, verifyPayment } from '@kova/tempo'
import { and, eq, isNull } from 'drizzle-orm'
import type { Address, Hash } from 'viem'
import type { Transaction } from 'viem/tempo'
import { publicClient } from '../chain.js'
import { db } from '../db.js'
import { KovaError } from '../errors.js'
import { encodeId } from '../ids.js'
import { findIntentByMemo, type PaymentIntent } from './intents.js'

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
  receipt: Transaction.TransactionReceipt,
  options: { credentialId?: string | undefined } = {},
): Promise<SettleResult> {
  if (receipt.status === 'pending') return { status: 'ignored', reason: 'receipt not yet included' }

  const existing = await db.query.payments.findFirst({
    where: eq(schema.payments.txHash, receipt.transactionHash),
  })
  if (existing) return { status: existing.status as SettleResult['status'], paymentId: existing.id }

  // Find the intent this transaction claims to pay, from the Kova memo it carries.
  const intent = await findIntentForReceipt(receipt)
  if (!intent) return { status: 'ignored', reason: 'no matching payment intent' }

  const verdict = verifyPayment(receipt, {
    token: intent.tokenAddress as Address,
    merchant: intent.payTo as Address,
    amount: intent.amount,
    memo: intent.memo as `0x${string}`,
  })

  if (verdict.status === 'pending') return { status: 'ignored', reason: 'pending' }
  if (verdict.status === 'unmatched' || verdict.status === 'memo_mismatch')
    return { status: 'ignored', reason: verdict.status }

  const status = verdict.status === 'paid' ? 'paid' : verdict.status === 'held' ? 'held' : 'failed'
  const paymentId = uuidv7()
  const now = new Date()

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
      feePayerAddress: receipt.feePayer ?? null,
      confirmedAt: status === 'paid' ? now : null,
    })

    await tx
      .update(schema.paymentIntents)
      .set({
        status: status === 'paid' ? 'paid' : status === 'held' ? 'held' : 'failed',
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
        .where(and(eq(schema.orders.intentId, intent.id), eq(schema.orders.source, 'till'), isNull(schema.orders.collectedAt)))
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

  return { status, paymentId }
}

async function findIntentForReceipt(
  receipt: Transaction.TransactionReceipt,
): Promise<PaymentIntent | undefined> {
  for (const log of receipt.logs) {
    // TransferWithMemo puts the memo in topic3.
    const memo = log.topics[3]
    if (!memo || !decodeMemo(memo)) continue
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
  let receipt: Transaction.TransactionReceipt
  try {
    receipt = (await publicClient.getTransactionReceipt({
      hash: txHash,
    })) as Transaction.TransactionReceipt
  } catch (error) {
    throw new KovaError('chain_error', `Could not read transaction ${txHash}`, {
      cause: String(error),
    })
  }
  return settleFromReceipt(receipt, options)
}
