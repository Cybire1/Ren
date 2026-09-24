import { randomBytes } from 'node:crypto'
import { schema, uuidv7 } from '@kova/db'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { getAddress, isAddress } from 'viem'
import { z } from 'zod'
import { generateApiKey, requireApiKey, requireMerchantKey } from '../auth.js'
import { network } from '../chain.js'
import { config } from '../config.js'
import { db } from '../db.js'
import { KovaError, notFound } from '../errors.js'
import { decodeId, encodeId } from '../ids.js'

/**
 * A shop's own account: signing up, its settings, and the keys that act for it.
 *
 * Kova never holds a shop's money. Signing up only records where payments settle (the shop's
 * own Monad address, e.g. its Kova Pay wallet) and issues the key the dashboard signs in with.
 */

type Merchant = typeof schema.merchants.$inferSelect

export function serializeMerchant(m: Merchant) {
  return {
    object: 'merchant',
    id: encodeId('merchant', m.id),
    name: m.name,
    settlement_address: m.settlementAddress,
    network: m.network,
    country: m.country,
    livemode: !m.isTest,
    explorer_url: network.explorerUrl,
    created_at: m.createdAt.toISOString(),
  }
}

function serializeKey(k: typeof schema.apiKeys.$inferSelect, current?: string) {
  return {
    object: 'api_key',
    id: encodeId('apiKey', k.id),
    name: k.name,
    /** The non-secret start of the key, enough to recognise it. */
    prefix: k.prefix,
    last_used_at: k.lastUsedAt?.toISOString() ?? null,
    created_at: k.createdAt.toISOString(),
    /** True for the key making this request. */
    current: k.id === current,
  }
}

const address = z
  .string()
  .trim()
  .refine((v) => isAddress(v), 'Not a Monad address')
  .transform((v) => getAddress(v))

const signupBody = z.object({
  name: z.string().trim().min(2).max(60),
  settlement_address: address,
  country: z.string().trim().length(2).toUpperCase().optional(),
})

const updateBody = z
  .object({ name: z.string().trim().min(2).max(60), settlement_address: address })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')

const keyBody = z.object({ name: z.string().trim().min(1).max(40).default('Secret key') })

/** A few sign-ups per address per hour: a speed bump for scripts, invisible to people. */
const signups = new Map<string, number[]>()
function allowSignup(ip: string) {
  const now = Date.now()
  const recent = (signups.get(ip) ?? []).filter((t) => now - t < 3_600_000)
  if (recent.length >= 5) return false
  signups.set(ip, [...recent, now])
  return true
}

const slugify = (name: string) =>
  `${
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'shop'
  }-${randomBytes(3).toString('hex')}`

async function audit(merchantId: string, keyId: string, action: string, metadata?: Record<string, unknown>) {
  await db
    .insert(schema.auditLogs)
    .values({ id: uuidv7(), actorType: 'api_key', actorId: keyId, action, targetType: 'merchant', targetId: merchantId, metadata: metadata ?? null })
    .catch(() => {})
}

export const accountRoutes = new Hono()
  /** Public: open a shop. Returns its first secret key, shown once. */
  .post('/merchants', async (c) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
    if (!allowSignup(ip)) throw new KovaError('rate_limited', 'Too many new shops from here. Try again in an hour.')
    const parsed = signupBody.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success)
      throw new KovaError('invalid_request', parsed.error.issues[0]?.message ?? 'Invalid request', { issues: parsed.error.issues })

    const isTest = config.KOVA_NETWORK !== 'mainnet'
    const key = generateApiKey(isTest)
    const merchant = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.merchants)
        .values({
          id: uuidv7(),
          name: parsed.data.name,
          slug: slugify(parsed.data.name),
          settlementAddress: parsed.data.settlement_address,
          network: config.KOVA_NETWORK,
          country: parsed.data.country ?? 'US',
          isTest,
        })
        .returning()
      if (!created) throw new KovaError('internal', 'Could not create the shop')
      await tx.insert(schema.apiKeys).values({
        id: uuidv7(),
        merchantId: created.id,
        name: 'Dashboard',
        prefix: key.prefix,
        secretHash: key.secretHash,
        scopes: ['payments:read', 'payments:write', 'account:admin'],
        isTest,
      })
      return created
    })
    return c.json({ ...serializeMerchant(merchant), key: key.secret }, 201)
  })

  .get('/account', requireApiKey, requireMerchantKey, (c) => c.json(serializeMerchant(c.get('merchant'))))

  .patch('/account', requireApiKey, requireMerchantKey, async (c) => {
    const parsed = updateBody.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success) throw new KovaError('invalid_request', parsed.error.issues[0]?.message ?? 'Invalid request')
    const before = c.get('merchant')
    const [merchant] = await db
      .update(schema.merchants)
      .set({
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.settlement_address ? { settlementAddress: parsed.data.settlement_address } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, before.id))
      .returning()
    if (!merchant) throw notFound('merchant', encodeId('merchant', before.id))
    if (parsed.data.settlement_address && parsed.data.settlement_address !== before.settlementAddress)
      // Where money goes is the most sensitive setting a shop has: keep a record of every change.
      await audit(before.id, c.get('apiKey').id, 'merchant.settlement_address.updated', {
        from: before.settlementAddress,
        to: parsed.data.settlement_address,
      })
    return c.json(serializeMerchant(merchant))
  })

  .get('/api_keys', requireApiKey, requireMerchantKey, async (c) => {
    const rows = await db.query.apiKeys.findMany({
      where: and(eq(schema.apiKeys.merchantId, c.get('merchant').id), isNull(schema.apiKeys.terminalId), isNull(schema.apiKeys.revokedAt)),
      orderBy: desc(schema.apiKeys.createdAt),
    })
    return c.json({ object: 'list', data: rows.map((k) => serializeKey(k, c.get('apiKey').id)) })
  })

  .post('/api_keys', requireApiKey, requireMerchantKey, async (c) => {
    const parsed = keyBody.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success) throw new KovaError('invalid_request', 'Expected { name }')
    const merchant = c.get('merchant')
    const key = generateApiKey(merchant.isTest)
    const [row] = await db
      .insert(schema.apiKeys)
      .values({
        id: uuidv7(),
        merchantId: merchant.id,
        name: parsed.data.name,
        prefix: key.prefix,
        secretHash: key.secretHash,
        scopes: ['payments:read', 'payments:write', 'account:admin'],
        isTest: merchant.isTest,
      })
      .returning()
    if (!row) throw new KovaError('internal', 'Could not create the key')
    await audit(merchant.id, c.get('apiKey').id, 'api_key.created', { key: encodeId('apiKey', row.id) })
    return c.json({ ...serializeKey(row), secret: key.secret }, 201)
  })

  .delete('/api_keys/:id', requireApiKey, requireMerchantKey, async (c) => {
    const id = c.req.param('id')
    const uuid = decodeId('apiKey', id)
    // Revoking the key you are signed in with would lock you out mid-click.
    if (uuid === c.get('apiKey').id) throw new KovaError('conflict', 'You are signed in with this key. Sign in with another key to revoke it.')
    const [row] = uuid
      ? await db
          .update(schema.apiKeys)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(schema.apiKeys.id, uuid),
              eq(schema.apiKeys.merchantId, c.get('merchant').id),
              isNull(schema.apiKeys.terminalId),
              isNull(schema.apiKeys.revokedAt),
            ),
          )
          .returning()
      : []
    if (!row) throw notFound('api key', id)
    await audit(c.get('merchant').id, c.get('apiKey').id, 'api_key.revoked', { key: id })
    return c.json({ object: 'api_key', id, revoked: true })
  })
