import { schema, uuidv7 } from '@kova/db'
import { formatAmount, parseAmount } from '@kova/tempo'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '../db.js'
import { KovaError } from '../errors.js'
import { decodeId, encodeId } from '../ids.js'
import { createIntent, type PaymentIntent } from './intents.js'
import { askJev } from './jev.js'

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
export async function placeOrder(input: PlaceOrder): Promise<{ order: Order; intent: PaymentIntent }> {
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
  if (rows.length !== wanted.size) throw new KovaError('invalid_request', 'Some items are no longer available')

  if (input.stall) {
    const listed = await db.query.stallItems.findMany({
      where: and(eq(schema.stallItems.stallId, input.stall.id), inArray(schema.stallItems.itemId, [...wanted.keys()])),
    })
    if (listed.length !== wanted.size) throw new KovaError('invalid_request', 'Some items are not on this stall')
    const soldOut = rows.find((r) => r.soldOut)
    if (soldOut) throw new KovaError('conflict', `${soldOut.name} just sold out`)
  }

  let total = 0n
  const lines: OrderLine[] = rows.map((item) => {
    const quantity = wanted.get(item.id) ?? 1
    total += item.price * BigInt(quantity)
    return { item_id: encodeId('catalogItem', item.id), name: item.name, unit_price: formatAmount(item.price), quantity }
  })
  if (total <= 0n) throw new KovaError('invalid_request', 'The order comes to nothing')
  if (total > MAX_ORDER) throw new KovaError('invalid_request', 'Orders over $10,000 are not supported')

  const orderId = uuidv7()
  const intent = await createIntent({
    merchant: input.merchant,
    amount: formatAmount(total),
    currency: 'USDC',
    reference: summarize(lines),
    metadata: { order: encodeId('order', orderId), ...(input.stall ? { stall: encodeId('stall', input.stall.id) } : {}) },
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
        instructions: 'Does `note` mention a food allergy, an intolerance, or a dietary requirement the kitchen must respect (like vegetarian, halal or no pork)?',
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

export function serializeOrder(order: Order, extra: { stall?: { id: string; name: string; slug: string } | null } = {}) {
  return {
    object: 'order',
    id: encodeId('order', order.id),
    source: order.source,
    payment_intent: encodeId('paymentIntent', order.intentId),
    stall: extra.stall ? { id: encodeId('stall', extra.stall.id), name: extra.stall.name, slug: extra.stall.slug } : null,
    lines: order.lines,
    customer_name: order.customerName,
    note: order.note,
    pay_for_me: order.payForMe,
    /** What the counter must notice in the note, like "allergy". */
    flags: order.flags ?? [],
    collected_at: order.collectedAt?.toISOString() ?? null,
    created_at: order.createdAt.toISOString(),
  }
}

/** The orders behind these intents, keyed by intent id, with their stall named. */
export async function ordersForIntents(intentIds: string[]) {
  if (intentIds.length === 0) return new Map<string, ReturnType<typeof serializeOrder>>()
  const rows = await db.query.orders.findMany({ where: inArray(schema.orders.intentId, intentIds) })
  const stallIds = [...new Set(rows.flatMap((o) => (o.stallId ? [o.stallId] : [])))]
  const stalls = stallIds.length ? await db.query.stalls.findMany({ where: inArray(schema.stalls.id, stallIds) }) : []
  const byId = new Map(stalls.map((s) => [s.id, s]))
  return new Map(rows.map((o) => [o.intentId, serializeOrder(o, { stall: o.stallId ? (byId.get(o.stallId) ?? null) : null })]))
}
