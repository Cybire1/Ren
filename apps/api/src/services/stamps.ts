import { schema } from '@kova/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import { type Address, isAddressEqual } from 'viem'
import { db } from '../db.js'
import { KovaError } from '../errors.js'
import type { PaymentIntent } from './intents.js'

/**
 * The stamp card: every order a wallet pays at a shop is a stamp, and once a stall's card is full
 * the next order there has its cheapest item free. There is nothing to sign up for: the wallet
 * that pays is the card, and its stamps are read from the shop's own paid orders.
 */

/** Stamps a wallet holds at a shop: paid orders since it last spent a full card. */
export async function stampsAt(merchantId: string, payer: string): Promise<number> {
  const rows = await db
    .select({ reward: schema.orders.reward })
    .from(schema.orders)
    .innerJoin(schema.paymentIntents, eq(schema.paymentIntents.id, schema.orders.intentId))
    .innerJoin(schema.payments, eq(schema.payments.intentId, schema.paymentIntents.id))
    .where(
      and(
        eq(schema.orders.merchantId, merchantId),
        eq(schema.paymentIntents.status, 'paid'),
        eq(schema.payments.status, 'paid'),
        sql`lower(${schema.payments.payerAddress}) = ${payer.toLowerCase()}`,
      ),
    )
    .orderBy(desc(schema.paymentIntents.paidAt))
    .limit(200)
  let stamps = 0
  for (const row of rows) {
    if (row.reward) break
    stamps++
  }
  return stamps
}

/** A stall's card, as the buyer sees it. */
export async function stampCard(
  stall: { merchantId: string; loyaltyEvery: number | null },
  payer: string,
) {
  if (!stall.loyaltyEvery) return null
  const stamps = await stampsAt(stall.merchantId, payer)
  return {
    every: stall.loyaltyEvery,
    stamps: Math.min(stamps, stall.loyaltyEvery),
    ready: stamps >= stall.loyaltyEvery,
  }
}

/**
 * Why `payer` may not pay a charge that spends a stamp card, or null when they may. A reward is
 * the card owner's alone, and a full card pays for one reward: a second tab or a retried order
 * can't spend the same card again. Checked wherever Ren pays the fee (Monad's relayer, Tempo's
 * fee payer), since that is where Ren can refuse.
 */
export async function rewardRefusal(
  intent: Pick<PaymentIntent, 'id' | 'merchantId' | 'metadata'>,
  payer: Address | undefined,
): Promise<KovaError | null> {
  const owner =
    typeof intent.metadata?.payer === 'string' ? (intent.metadata.payer as Address) : null
  if (!owner) return null
  if (!payer || !isAddressEqual(owner, payer))
    return new KovaError('invalid_request', 'This free item is on someone else’s stamp card.')
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.intentId, intent.id) })
  if (!order?.reward) return null
  const stall = order.stallId
    ? await db.query.stalls.findFirst({ where: eq(schema.stalls.id, order.stallId) })
    : undefined
  if ((await stampsAt(intent.merchantId, owner)) < (stall?.loyaltyEvery ?? order.reward.stamps))
    return new KovaError(
      'conflict',
      'This stamp card was already used. Order again for the full price.',
    )
  return null
}
