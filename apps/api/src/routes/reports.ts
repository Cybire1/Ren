import { schema } from '@kova/db'
import { formatAmount } from '@kova/tempo'
import { and, desc, eq, gte, ilike, inArray, lt, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireApiKey } from '../auth.js'
import { db } from '../db.js'
import { KovaError } from '../errors.js'
import { encodeId } from '../ids.js'
import { serializeIntent } from '../services/intents.js'

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z
    .enum(['requires_payment', 'processing', 'paid', 'held', 'failed', 'canceled', 'expired'])
    .optional(),
  /** Cursor: return intents created strictly before this ISO timestamp. */
  before: z.string().datetime().optional(),
  /** Search the shop's own reference. */
  q: z.string().trim().max(100).optional(),
})

/** Merchant-facing reads: the transaction feed and the day's totals. */
export const reportRoutes = new Hono()
  .use(requireApiKey)
  .get('/payment_intents', async (c) => {
    const parsed = listQuery.safeParse(c.req.query())
    if (!parsed.success)
      throw new KovaError('invalid_request', 'Invalid query', { issues: parsed.error.issues })
    const { limit, status, before, q } = parsed.data
    const merchantId = c.get('merchant').id

    const rows = await db.query.paymentIntents.findMany({
      where: and(
        eq(schema.paymentIntents.merchantId, merchantId),
        status ? eq(schema.paymentIntents.status, status) : undefined,
        before ? lt(schema.paymentIntents.createdAt, new Date(before)) : undefined,
        q ? ilike(schema.paymentIntents.reference, `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`) : undefined,
      ),
      orderBy: desc(schema.paymentIntents.createdAt),
      limit: limit + 1,
    })

    const page = rows.slice(0, limit)
    return c.json({
      object: 'list',
      data: page.map(serializeIntent),
      has_more: rows.length > limit,
      next_before: page.at(-1)?.createdAt.toISOString() ?? null,
    })
  })
  /** Everything the dashboard header shows, in one call. */
  .get('/summary', async (c) => {
    const merchantId = c.get('merchant').id
    const since = new Date()
    since.setHours(0, 0, 0, 0)

    const [today] = await db
      .select({
        total: sql<string>`coalesce(sum(${schema.paymentIntents.amount}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.paymentIntents)
      .where(
        and(
          eq(schema.paymentIntents.merchantId, merchantId),
          eq(schema.paymentIntents.status, 'paid'),
          gte(schema.paymentIntents.paidAt, since),
        ),
      )

    const [allTime] = await db
      .select({
        total: sql<string>`coalesce(sum(${schema.paymentIntents.amount}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.paymentIntents)
      .where(
        and(
          eq(schema.paymentIntents.merchantId, merchantId),
          eq(schema.paymentIntents.status, 'paid'),
        ),
      )

    const [open] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.paymentIntents)
      .where(
        and(
          eq(schema.paymentIntents.merchantId, merchantId),
          inArray(schema.paymentIntents.status, ['requires_payment', 'processing']),
        ),
      )

    const last = await db.query.paymentIntents.findFirst({
      where: and(
        eq(schema.paymentIntents.merchantId, merchantId),
        eq(schema.paymentIntents.status, 'paid'),
      ),
      orderBy: desc(schema.paymentIntents.paidAt),
    })

    // The last 14 days, one bucket per UTC day, empty days included, for the dashboard chart.
    const days = await db.execute<{ day: string; total: string; count: number }>(sql`
      select to_char(d.day, 'YYYY-MM-DD') as day,
             coalesce(sum(i.amount), 0)::text as total,
             count(i.id)::int as count
      from generate_series((now() at time zone 'utc')::date - 13, (now() at time zone 'utc')::date, interval '1 day') as d(day)
      left join payment_intents i
        on i.merchant_id = ${merchantId} and i.status = 'paid'
       and (i.paid_at at time zone 'utc')::date = d.day
      group by d.day
      order by d.day
    `)

    const merchant = c.get('merchant')
    return c.json({
      merchant: {
        id: encodeId('merchant', merchant.id),
        name: merchant.name,
        settlement_address: merchant.settlementAddress,
        network: merchant.network,
        livemode: !merchant.isTest,
      },
      today: {
        total: formatAmount(BigInt(today?.total ?? 0)),
        count: today?.count ?? 0,
      },
      all_time: {
        total: formatAmount(BigInt(allTime?.total ?? 0)),
        count: allTime?.count ?? 0,
      },
      open_intents: open?.count ?? 0,
      daily: [...days].map((d) => ({ date: d.day, total: formatAmount(BigInt(d.total)), count: d.count })),
      last_paid_at: last?.paidAt?.toISOString() ?? null,
    })
  })
