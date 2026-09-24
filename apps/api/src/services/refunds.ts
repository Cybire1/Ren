import { schema, uuidv7 } from '@kova/db'
import { encodeMemo } from '@kova/tempo'
import { and, eq, inArray } from 'drizzle-orm'
import type { Address } from 'viem'
import { createClient, http } from 'viem/tempo'
import { feePayerAccount, rpcUrl, settlementToken } from '../chain.js'
import { config } from '../config.js'
import { db } from '../db.js'

/**
 * Gives a trip's money back when it can't be booked: every paid share goes back to the wallet
 * that paid it, from Kova Travel's treasury, with a refund memo so the payer's wallet can tell
 * what it is. Each payment is refunded at most once (the refunds table remembers).
 *
 * On testnet the treasury is the relay's own account, so this runs by itself. On mainnet the
 * treasury key lives elsewhere, and refunds are recorded as pending for the treasury to send.
 */
export async function refundTrip(tripId: string, reason: string) {
  const shares = await db.query.tripShares.findMany({ where: eq(schema.tripShares.tripId, tripId) })
  if (shares.length === 0) return
  const paid = await db.query.payments.findMany({
    where: and(inArray(schema.payments.intentId, shares.map((s) => s.intentId)), eq(schema.payments.status, 'paid')),
  })
  const shop = await db.query.merchants.findFirst({ where: eq(schema.merchants.slug, 'kova-travel') })
  const canSend = Boolean(feePayerAccount && shop && config.KOVA_NETWORK === 'testnet' && shop.settlementAddress.toLowerCase() === feePayerAccount.address.toLowerCase())
  const client = canSend && feePayerAccount ? createClient({ account: feePayerAccount, testnet: true, feeToken: settlementToken.address, transport: http(rpcUrl) }) : null

  for (const payment of paid) {
    const already = await db.query.refunds.findFirst({ where: eq(schema.refunds.paymentId, payment.id) })
    if (already) continue
    const id = uuidv7()
    const memo = encodeMemo({ kind: 'refund', id })
    await db.insert(schema.refunds).values({ id, paymentId: payment.id, amount: payment.amount, memo, reason, status: 'pending' })
    if (!client) {
      console.warn('[refund] recorded for the treasury to send', id)
      continue
    }
    try {
      const { receipt } = await client.token.transferSync({
        token: payment.tokenAddress as Address,
        to: payment.payerAddress as Address,
        amount: payment.amount,
        memo,
      })
      await db
        .update(schema.refunds)
        .set({ status: 'confirmed', txHash: receipt.transactionHash, confirmedAt: new Date() })
        .where(eq(schema.refunds.id, id))
    } catch (error) {
      console.error('[refund] failed', id, error instanceof Error ? error.message : error)
      await db.update(schema.refunds).set({ status: 'failed' }).where(eq(schema.refunds.id, id))
    }
  }
}
