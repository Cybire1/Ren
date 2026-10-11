import { schema } from '@kova/db'
import { formatAmount } from '@kova/monad'
import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireApiKey } from '../auth.js'
import { db } from '../db.js'
import { KovaError, notFound } from '../errors.js'
import { decodeId } from '../ids.js'
import { serializeIntent } from '../services/intents.js'
import { ORDER_STATUSES, placeOrder, serializeOrder } from '../services/orders.js'

/**
 * Orders: what was bought, from a stall or at the till. Any of the shop's keys can read them,
 * ring up a till sale and mark an order collected, so a paired phone behind the counter can
 * do the whole job.
 */

const listQuery = z.object({
  /** open: paid and not yet handed over. */
  status: z.enum(['all', 'open', 'collected', 'unpaid']).default('all'),
  stall_id: z.string().optional(),
  source: z.enum(['stall', 'till']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const tillBody = z.object({
  items: z
    .array(z.object({ id: z.string(), quantity: z.number().int().min(1).max(999) }))
    .min(1)
    .max(100),
  note: z.string().trim().max(200).optional(),
})

export const orderRoutes = new Hono()
  .get('/orders', requireApiKey, async (c) => {
    const parsed = listQuery.safeParse(c.req.query())
    if (!parsed.success) throw new KovaError('invalid_request', 'Invalid query')
    const { status, stall_id, source, limit } = parsed.data
    const merchantId = c.get('merchant').id
    const stallId = stall_id ? decodeId('stall', stall_id) : undefined
    if (stall_id && !stallId) throw notFound('stall', stall_id)

    const rows = await db
      .select({ order: schema.orders, intent: schema.paymentIntents })
      .from(schema.orders)
      .innerJoin(schema.paymentIntents, eq(schema.paymentIntents.id, schema.orders.intentId))
      .where(
        and(
          eq(schema.orders.merchantId, merchantId),
          stallId ? eq(schema.orders.stallId, stallId) : undefined,
          source ? eq(schema.orders.source, source) : undefined,
          status === 'open'
            ? and(eq(schema.paymentIntents.status, 'paid'), isNull(schema.orders.collectedAt))
            : undefined,
          status === 'collected' ? isNotNull(schema.orders.collectedAt) : undefined,
          status === 'unpaid'
            ? inArray(schema.paymentIntents.status, ['requires_payment', 'processing'])
            : undefined,
        ),
      )
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit)

    const stallIds = [...new Set(rows.flatMap((r) => (r.order.stallId ? [r.order.stallId] : [])))]
    const stalls = stallIds.length
      ? await db.query.stalls.findMany({ where: inArray(schema.stalls.id, stallIds) })
      : []
    const byId = new Map(stalls.map((s) => [s.id, s]))
    return c.json({
      object: 'list',
      data: rows.map((r) => ({
        ...serializeOrder(r.order, {
          stall: r.order.stallId ? (byId.get(r.order.stallId) ?? null) : null,
        }),
        amount: formatAmount(r.intent.amount),
        payment_status: r.intent.status,
        paid_at: r.intent.paidAt?.toISOString() ?? null,
      })),
    })
  })

  /** A till sale: items scanned or picked at the counter. Charges like any other payment. */
  .post('/orders', requireApiKey, async (c) => {
    const parsed = tillBody.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success)
      throw new KovaError('invalid_request', parsed.error.issues[0]?.message ?? 'Invalid sale')
    const { order, intent } = await placeOrder({
      merchant: c.get('merchant'),
      source: 'till',
      items: parsed.data.items,
      note: parsed.data.note,
      terminalId: c.get('apiKey').terminalId ?? undefined,
    })
    return c.json({ ...serializeOrder(order), payment_intent: serializeIntent(intent) }, 201)
  })

  /** Handed over (or not, to undo a mistap). */
  .post('/orders/:id/collect', requireApiKey, async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { collected?: boolean }
    const id = c.req.param('id')
    const uuid = decodeId('order', id)
    const [row] = uuid
      ? await db
          .update(schema.orders)
          .set(
            body.collected === false
              ? { collectedAt: null, status: 'ready' }
              : { collectedAt: new Date(), status: 'collected' },
          )
          .where(
            and(eq(schema.orders.id, uuid), eq(schema.orders.merchantId, c.get('merchant').id)),
          )
          .returning()
      : []
    if (!row) throw notFound('order', id)
    return c.json(serializeOrder(row))
  })
  /** Moves an order along the counter: new, preparing, ready, collected, or cancelled. */
  .post('/orders/:id/status', requireApiKey, async (c) => {
    const parsed = z
      .object({ status: z.enum(ORDER_STATUSES) })
      .safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success)
      throw new KovaError('invalid_request', `Status is one of ${ORDER_STATUSES.join(', ')}.`)
    const id = c.req.param('id')
    const uuid = decodeId('order', id)
    const status = parsed.data.status
    const [row] = uuid
      ? await db
          .update(schema.orders)
          .set({ status, collectedAt: status === 'collected' ? new Date() : null })
          .where(
            and(eq(schema.orders.id, uuid), eq(schema.orders.merchantId, c.get('merchant').id)),
          )
          .returning()
      : []
    if (!row) throw notFound('order', id)
    return c.json(serializeOrder(row))
  })
