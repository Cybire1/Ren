import { schema, uuidv7 } from '@kova/db'
import { formatAmount, parseAmount } from '@kova/monad'
import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { settlementCurrency } from '../chain.js'
import { db } from '../db.js'
import { KovaError } from '../errors.js'
import { decodeId, encodeId } from '../ids.js'
import { createIntent, type PaymentIntent } from './intents.js'
import { askJev } from './jev.js'
import { stampsAt } from './stamps.js'

type Merchant = typeof schema.merchants.$inferSelect
type Stall = typeof schema.stalls.$inferSelect
type Order = typeof schema.orders.$inferSelect
type OrderLine = schema.OrderLine

/** The most one order can come to. A stall is not a wholesale desk. */
const MAX_ORDER = parseAmount('10000')

export interface PlaceOrder {
  merchant: Merchant
  source: 'stall' | 'till'
  stall?: Stall
  items: { id: string; quantity: number }[]
  customerName?: string | undefined
  note?: string | undefined
  payForMe?: boolean | undefined
  terminalId?: string | undefined
  /** The table the order came from (a stall's table QR code). */
  table?: string | undefined
  /** The wallet that will pay: it earns the stamp, and a full card makes an item free. */
  payer?: string | undefined
}

/** "2 × Flat white, Almond croissant", kept short enough for a receipt line. */
function summarize(lines: OrderLine[]) {
  const parts = lines.map((l) => (l.quantity > 1 ? `${l.quantity} × ${l.name}` : l.name))
  let text = parts[0] ?? 'Order'
  for (let i = 1; i < parts.length; i++) {
    const next = `${text}, ${parts[i]}`
    if (next.length > 120) return `${text} and ${parts.length - i} more`
    text = next
  }
  return text
}

/**
 * Prices an order from the catalogue (never from what a page sent), opens its payment and
 * records the order. A stall order can only include that stall's items that are in stock; a
 * till sale can include anything in the catalogue, since the goods are on the counter.
 */
export async function placeOrder(
  input: PlaceOrder,
): Promise<{ order: Order; intent: PaymentIntent }> {
  if (input.items.length === 0) throw new KovaError('invalid_request', 'The basket is empty')

  const wanted = new Map<string, number>()
  for (const line of input.items) {
    const uuid = decodeId('catalogItem', line.id)
    if (!uuid) throw new KovaError('invalid_request', `No such item: ${line.id}`)
    wanted.set(uuid, (wanted.get(uuid) ?? 0) + line.quantity)
  }

  const rows = await db.query.catalogItems.findMany({
    where: and(
      eq(schema.catalogItems.merchantId, input.merchant.id),
      inArray(schema.catalogItems.id, [...wanted.keys()]),
      isNull(schema.catalogItems.archivedAt),
    ),
  })
  if (rows.length !== wanted.size)
    throw new KovaError('invalid_request', 'Some items are no longer available')

  if (input.stall) {
    const listed = await db.query.stallItems.findMany({
      where: and(
        eq(schema.stallItems.stallId, input.stall.id),
        inArray(schema.stallItems.itemId, [...wanted.keys()]),
      ),
    })
    if (listed.length !== wanted.size)
      throw new KovaError('invalid_request', 'Some items are not on this stall')
    const soldOut = rows.find((r) => r.soldOut)
    if (soldOut) throw new KovaError('conflict', `${soldOut.name} just sold out`)
    // Counted stock: a stall can't sell more than there is. (A till can: the goods are on the counter.)
    const short = rows.find((r) => r.stock !== null && (wanted.get(r.id) ?? 0) > r.stock)
    if (short) throw new KovaError('conflict', `Only ${short.stock} ${short.name} left`)
  }

  let total = 0n
  const lines: OrderLine[] = rows.map((item) => {
    const quantity = wanted.get(item.id) ?? 1
    total += item.price * BigInt(quantity)
    return {
      item_id: encodeId('catalogItem', item.id),
      name: item.name,
      unit_price: formatAmount(item.price),
      quantity,
    }
  })
  if (total <= 0n) throw new KovaError('invalid_request', 'The order comes to nothing')
  if (total > MAX_ORDER)
    throw new KovaError('invalid_request', 'Orders over $10,000 are not supported')

  // A full stamp card at this stall: the cheapest item on the order is free.
  let reward: schema.OrderReward | null = null
  const every = input.stall?.loyaltyEvery
  if (every && input.payer && !input.payForMe) {
    const stamps = await stampsAt(input.merchant.id, input.payer)
    if (stamps >= every) {
      const cheapest = rows.reduce((a, b) => (b.price < a.price ? b : a))
      reward = {
        item_id: encodeId('catalogItem', cheapest.id),
        name: cheapest.name,
        amount: formatAmount(cheapest.price),
        stamps: every,
      }
      total -= cheapest.price
    }
  }

  const orderId = uuidv7()
  const intent = await createIntent({
    merchant: input.merchant,
    amount: formatAmount(total),
    currency: settlementCurrency,
    reference: summarize(lines),
    metadata: {
      order: encodeId('order', orderId),
      ...(input.stall ? { stall: encodeId('stall', input.stall.id) } : {}),
      ...(input.table ? { table: input.table } : {}),
      // A reward is for the card's owner: only this wallet may pay it.
      ...(reward && input.payer ? { payer: input.payer, reward: reward.name } : {}),
    },
    allowZero: Boolean(reward),
    terminalId: input.terminalId,
    // Someone asked to pay later gets a day; a buyer at the stall, half an hour.
    expiresInSeconds: input.payForMe ? 86_400 : input.source === 'stall' ? 1_800 : undefined,
  })

  const [order] = await db
    .insert(schema.orders)
    .values({
      id: orderId,
      merchantId: input.merchant.id,
      intentId: intent.id,
      stallId: input.stall?.id ?? null,
      source: input.source,
      lines,
      customerName: input.customerName?.trim() || null,
      note: input.note?.trim() || null,
      payForMe: Boolean(input.payForMe),
      table: input.table?.trim() || null,
      payerAddress: input.payer?.toLowerCase() ?? null,
      reward,
    })
    .returning()
  if (!order) throw new KovaError('internal', 'Could not record the order')
  // After the fact, so a slow or missing Jev never holds up a checkout.
  if (order.note) void flagNote(order.id, order.note)
  return { order, intent }
}

/**
 * "Flag order notes": Jev reads the buyer's note, and one that mentions an allergy or a diet
 * the kitchen must respect is flagged, so the ticket shows it in coral.
 */
async function flagNote(orderId: string, note: string) {
  const answers = await askJev(
    { note },
    {
      allergy: {
        type: 'noul',
        instructions:
          'Does `note` mention a food allergy, an intolerance, or a dietary requirement the kitchen must respect (like vegetarian, halal or no pork)?',
      },
    },
  )
  if ((answers?.allergy?.probability ?? 0) < 0.6) return
  await db
    .update(schema.orders)
    .set({ flags: ['allergy'] })
    .where(eq(schema.orders.id, orderId))
    .catch(() => {})
}

export function serializeOrder(
  order: Order,
  extra: { stall?: { id: string; name: string; slug: string } | null } = {},
) {
  return {
    object: 'order',
    id: encodeId('order', order.id),
    source: order.source,
    payment_intent: encodeId('paymentIntent', order.intentId),
    stall: extra.stall
      ? { id: encodeId('stall', extra.stall.id), name: extra.stall.name, slug: extra.stall.slug }
      : null,
    lines: order.lines,
    customer_name: order.customerName,
    note: order.note,
    pay_for_me: order.payForMe,
    /** The table to bring it to, from the table's QR code. Null: the counter. */
    table: order.table,
    /** A full stamp card spent on this order: the item that was free. */
    reward: order.reward ?? null,
    /** What the counter must notice in the note, like "allergy". */
    flags: order.flags ?? [],
    /** new, preparing, ready, collected or cancelled. */
    status: order.status,
    collected_at: order.collectedAt?.toISOString() ?? null,
    created_at: order.createdAt.toISOString(),
  }
}

/** The orders behind these intents, keyed by intent id, with their stall named. */
export async function ordersForIntents(intentIds: string[]) {
  if (intentIds.length === 0) return new Map<string, ReturnType<typeof serializeOrder>>()
  const rows = await db.query.orders.findMany({ where: inArray(schema.orders.intentId, intentIds) })
  const stallIds = [...new Set(rows.flatMap((o) => (o.stallId ? [o.stallId] : [])))]
  const stalls = stallIds.length
    ? await db.query.stalls.findMany({ where: inArray(schema.stalls.id, stallIds) })
    : []
  const byId = new Map(stalls.map((s) => [s.id, s]))
  return new Map(
    rows.map((o) => [
      o.intentId,
      serializeOrder(o, { stall: o.stallId ? (byId.get(o.stallId) ?? null) : null }),
    ]),
  )
}

export const ORDER_STATUSES = ['new', 'preparing', 'ready', 'collected', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/**
 * Once an order is paid, its items leave the shelf: counted stock goes down by what it took, and
 * an item that reaches zero is sold out everywhere, online and at the till. It happens once per
 * order, however many times the payment is seen.
 */
export async function takeStock(intentId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .update(schema.orders)
      .set({ stockTakenAt: new Date() })
      .where(and(eq(schema.orders.intentId, intentId), isNull(schema.orders.stockTakenAt)))
      .returning()
    if (!order) return
    for (const line of order.lines) {
      const id = decodeId('catalogItem', line.item_id)
      if (!id) continue
      await tx
        .update(schema.catalogItems)
        .set({
          stock: sql`greatest(${schema.catalogItems.stock} - ${line.quantity}, 0)`,
          soldOut: sql`${schema.catalogItems.stock} - ${line.quantity} <= 0`,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.catalogItems.id, id), isNotNull(schema.catalogItems.stock)))
    }
  })
}
