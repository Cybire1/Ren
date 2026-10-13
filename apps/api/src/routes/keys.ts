import { DAY, parseAmount, WEEK } from '@kova/tempo'
import { Hono } from 'hono'
import { type Address, getAddress, type Hex, isAddress, isHex } from 'viem'
import { z } from 'zod'
import { KovaError } from '../errors.js'
import { clientIp as ip, limit } from '../limits.js'
import {
  agentFetch,
  agentForToken,
  agentPay,
  agentPayCharge,
  answerApproval,
  chargeIdFrom,
  approvalsFor,
  describeAgent,
  paymentRow,
} from '../services/agents.js'
import {
  authorizationFor,
  claimAllowance,
  confirmKey,
  createAgentKey,
  createAllowance,
  inviteFor,
  keysOf,
  keysReady,
  ownedKey,
  paymentsOf,
  replaceAgentToken,
  revokeKey,
  serializeKey,
  serializePayment,
  setFrozen,
} from '../services/keys.js'
import { requireWallet, signInWallet } from '../services/wallet-auth.js'

/**
 * Keys: everything that can spend a wallet's dollars short of the wallet itself (services/keys.ts).
 *
 * The owner's side signs in once (POST /wallets/:address/keys/sign-in) and then:
 *   GET  /wallets/:address/keys                      keys it gave, allowances it received, and what's waiting
 *   POST /wallets/:address/keys/agents               a new agent key, for the device to put on-chain
 *   POST /wallets/:address/keys/allowances           a new allowance invite (a link)
 *   POST /wallets/:address/keys/:id/confirm          the device put it on-chain: switch it on
 *   POST /wallets/:address/keys/:id/freeze|unfreeze  stop it at once, or start it again
 *   POST /wallets/:address/keys/:id/revoke           for good
 *   POST /wallets/:address/keys/:id/token            a new token for an agent
 *   GET  /wallets/:address/keys/:id/payments         what a key paid, and what it was refused
 *   POST /wallets/:address/approvals/:id             yes or no to a payment an agent asked for
 *
 * The person an allowance is for, from its link:
 *   GET  /allowances/:code                           what it offers
 *   POST /allowances/:code/claim                     accept it with a key their phone made
 *
 * The agent, with its token (Authorization: Bearer ren_agent_…):
 *   GET  /agent                                      who it is and what it can still spend
 *   POST /agent/pay                                  pay a wallet
 *   POST /agent/pay-charge                           pay a Ren charge (a till's QR, a pay link) exactly
 *   POST /agent/fetch                                call a URL that charges over MPP, paying if allowed
 *   GET  /agent/payments, /agent/payments/:id        its payments, and one waiting for its owner
 */

const addr = z.string().refine((v) => isAddress(v), 'Expected an address')
const hex = z.string().refine((v) => isHex(v), 'Expected hex')
const money = z.string().regex(/^\d{1,7}(\.\d{1,6})?$/, 'Expected dollars, like 50 or 12.50')
const period = z.enum(['day', 'week']).transform((p) => (p === 'week' ? WEEK : DAY))
const until = z.string().datetime().transform((v) => new Date(v))

const bodyOf = async <T extends z.ZodTypeAny>(c: { req: { json: () => Promise<unknown> } }, shape: T): Promise<z.infer<T>> => {
  const parsed = shape.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) throw new KovaError('invalid_request', 'Invalid request body', { issues: parsed.error.issues })
  return parsed.data
}

function needKeys() {
  if (!keysReady()) throw new KovaError('conflict', 'Keys aren’t switched on for this server yet.')
}

export const keyRoutes = new Hono()

// ── The owner ───────────────────────────────────────────────────────────────────────────────

keyRoutes.post('/wallets/:address/keys/sign-in', async (c) => {
  needKeys()
  limit(`keys-sign-in:${ip(c)}`, 30, 60_000, 'Too many sign-ins. Wait a minute.')
  const body = await bodyOf(c, z.object({ message: z.string().max(1000), signature: hex }))
  const address = c.req.param('address')
  if (!isAddress(address)) throw new KovaError('invalid_request', 'Not a wallet address.')
  const { token, expiresAt } = await signInWallet({
    address: getAddress(address),
    message: body.message,
    signature: body.signature as Hex,
  })
  return c.json({ object: 'wallet_session', token, expires_at: expiresAt.toISOString() })
})

keyRoutes.get('/wallets/:address/keys', async (c) => {
  needKeys()
  const owner = requireWallet(c, c.req.param('address'))
  const { given, received } = await keysOf(owner)
  const waiting = await approvalsFor(owner)
  return c.json({
    object: 'keys',
    given: await Promise.all(given.map((row) => serializeKey(row))),
    received: await Promise.all(received.map((row) => serializeKey(row))),
    approvals: waiting.map(({ payment, key }) => serializePayment(payment, key)),
  })
})

const agentBody = z.object({
  label: z.string().min(1).max(40),
  limit: money,
  period,
  expires_at: until,
  per_payment: money,
  approve_above: money,
  payees: z.union([z.literal('anyone'), z.array(addr).min(1).max(20)]),
})

keyRoutes.post('/wallets/:address/keys/agents', async (c) => {
  needKeys()
  const owner = requireWallet(c, c.req.param('address'))
  limit(`keys-new:${owner}`, 20, 60 * 60_000, 'That’s a lot of new keys. Try again later.')
  const body = await bodyOf(c, agentBody)
  const row = await createAgentKey(owner, {
    label: body.label,
    limit: parseAmount(body.limit),
    period: body.period,
    expiresAt: body.expires_at,
    perPayment: parseAmount(body.per_payment),
    approveAbove: parseAmount(body.approve_above),
    payees: body.payees === 'anyone' ? 'anyone' : body.payees.map((p) => getAddress(p)),
  })
  return c.json({ key: await serializeKey(row, { chain: false }), authorize: authorizationFor(row) }, 201)
})

keyRoutes.post('/wallets/:address/keys/allowances', async (c) => {
  needKeys()
  const owner = requireWallet(c, c.req.param('address'))
  limit(`keys-new:${owner}`, 20, 60 * 60_000, 'That’s a lot of new keys. Try again later.')
  const body = await bodyOf(c, z.object({ label: z.string().min(1).max(40), limit: money, period, expires_at: until }))
  const { row, code } = await createAllowance(owner, {
    label: body.label,
    limit: parseAmount(body.limit),
    period: body.period,
    expiresAt: body.expires_at,
  })
  return c.json({ key: await serializeKey(row, { chain: false }), code }, 201)
})

keyRoutes.get('/wallets/:address/keys/:id/authorize', async (c) => {
  const owner = requireWallet(c, c.req.param('address'))
  const row = await ownedKey(owner, c.req.param('id'))
  return c.json(authorizationFor(row))
})

keyRoutes.post('/wallets/:address/keys/:id/confirm', async (c) => {
  needKeys()
  const owner = requireWallet(c, c.req.param('address'))
  const body = await bodyOf(c, z.object({ tx_hash: hex.optional() }))
  const row = await ownedKey(owner, c.req.param('id'))
  const { row: confirmed, agentToken } = await confirmKey(owner, row, body.tx_hash as Hex | undefined)
  return c.json({ key: await serializeKey(confirmed), ...(agentToken ? { agent_token: agentToken } : {}) })
})

for (const action of ['freeze', 'unfreeze'] as const)
  keyRoutes.post(`/wallets/:address/keys/:id/${action}`, async (c) => {
    const owner = requireWallet(c, c.req.param('address'))
    const row = await ownedKey(owner, c.req.param('id'))
    const updated = await setFrozen(owner, row, action === 'freeze')
    return c.json({ key: await serializeKey(updated) })
  })

keyRoutes.post('/wallets/:address/keys/:id/revoke', async (c) => {
  const owner = requireWallet(c, c.req.param('address'))
  const body = await bodyOf(c, z.object({ tx_hash: hex.optional() }))
  const row = await ownedKey(owner, c.req.param('id'))
  const updated = await revokeKey(row, body.tx_hash as Hex | undefined)
  return c.json({ key: await serializeKey(updated, { chain: false }) })
})

keyRoutes.post('/wallets/:address/keys/:id/token', async (c) => {
  const owner = requireWallet(c, c.req.param('address'))
  const row = await ownedKey(owner, c.req.param('id'))
  return c.json({ agent_token: await replaceAgentToken(row) })
})

keyRoutes.get('/wallets/:address/keys/:id/payments', async (c) => {
  const owner = requireWallet(c, c.req.param('address'))
  const row = await ownedKey(owner, c.req.param('id'))
  const rows = await paymentsOf([row.id])
  return c.json({ object: 'list', data: rows.map((p) => serializePayment(p, row)) })
})

keyRoutes.post('/wallets/:address/approvals/:id', async (c) => {
  needKeys()
  const owner = requireWallet(c, c.req.param('address'))
  const body = await bodyOf(c, z.object({ decision: z.enum(['approve', 'decline']), signature: hex }))
  const { payment } = await answerApproval({
    owner,
    paymentId: c.req.param('id'),
    decision: body.decision,
    signature: body.signature as Hex,
  })
  return c.json({ payment: serializePayment(payment) })
})

// ── The person an allowance is for ──────────────────────────────────────────────────────────

keyRoutes.get('/allowances/:code', async (c) => {
  needKeys()
  limit(`allowance-look:${ip(c)}`, 60, 60_000, 'Too many looks. Wait a minute.')
  return c.json(await inviteFor(c.req.param('code')))
})

keyRoutes.post('/allowances/:code/claim', async (c) => {
  needKeys()
  limit(`allowance-claim:${ip(c)}`, 20, 60_000, 'Too many tries. Wait a minute.')
  const body = await bodyOf(
    c,
    z.object({
      holder: addr,
      holder_name: z.string().max(40).optional(),
      key_id: addr,
      key_type: z.enum(['secp256k1', 'p256']),
      public_key: hex.optional(),
    }),
  )
  // The holder proves it's their wallet the same way the owner does: a signed-in token.
  const holder = requireWallet(c, body.holder)
  const row = await claimAllowance(c.req.param('code'), {
    holder,
    holderName: body.holder_name,
    keyId: getAddress(body.key_id),
    keyType: body.key_type,
    ...(body.public_key ? { publicKey: body.public_key as Hex } : {}),
  })
  return c.json({ key: await serializeKey(row, { chain: false }) })
})

// ── The agent ───────────────────────────────────────────────────────────────────────────────

const bearer = (c: { req: { header: (name: string) => string | undefined } }) => {
  const header = c.req.header('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : undefined
}

keyRoutes.get('/agent', async (c) => {
  const row = await agentForToken(bearer(c))
  return c.json(await describeAgent(row))
})

keyRoutes.post('/agent/pay', async (c) => {
  const row = await agentForToken(bearer(c))
  limit(`agent-pay:${row.id}`, 60, 60_000, 'Too many payments this minute. Slow down.')
  const body = await bodyOf(c, z.object({ to: addr, amount: money, note: z.string().max(200).optional() }))
  const payment = await agentPay(row, { to: getAddress(body.to) as Address, amount: parseAmount(body.amount), note: body.note })
  const status = payment.status === 'paid' ? 200 : payment.status === 'pending_approval' ? 202 : payment.status === 'denied' ? 403 : 502
  return c.json({ payment: serializePayment(payment, row) }, status)
})

keyRoutes.post('/agent/pay-charge', async (c) => {
  const row = await agentForToken(bearer(c))
  limit(`agent-pay:${row.id}`, 60, 60_000, 'Too many payments this minute. Slow down.')
  const body = await bodyOf(c, z.object({ charge: z.string().min(3).max(500) }))
  const charge = chargeIdFrom(body.charge)
  if (!charge) throw new KovaError('invalid_request', 'That isn’t a Ren charge or pay link (it has a pi_… id).')
  const payment = await agentPayCharge(row, charge)
  const status = payment.status === 'paid' ? 200 : payment.status === 'pending_approval' ? 202 : payment.status === 'denied' ? 403 : 502
  return c.json({ payment: serializePayment(payment, row) }, status)
})

keyRoutes.post('/agent/fetch', async (c) => {
  const row = await agentForToken(bearer(c))
  limit(`agent-fetch:${row.id}`, 60, 60_000, 'Too many paid requests this minute. Slow down.')
  const body = await bodyOf(
    c,
    z.object({
      url: z.string().url().max(2000),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']).default('GET'),
      headers: z.record(z.string(), z.string().max(2000)).optional(),
      body: z.string().max(256 * 1024).optional(),
      max_amount: money.optional(),
    }),
  )
  const result = await agentFetch(row, {
    url: body.url,
    method: body.method,
    headers: body.headers,
    body: body.body,
    maxAmount: body.max_amount ? parseAmount(body.max_amount) : undefined,
  })
  const status = result.status === 'pending_approval' ? 202 : result.status === 'denied' ? 403 : result.status === 'failed' ? 502 : 200
  return c.json(
    {
      status: result.status,
      payment: result.payment ? serializePayment(result.payment, row) : null,
      response: result.response,
      ...(result.reason ? { reason: result.reason } : {}),
    },
    status,
  )
})

keyRoutes.get('/agent/payments', async (c) => {
  const row = await agentForToken(bearer(c))
  const rows = await paymentsOf([row.id], 25)
  return c.json({ object: 'list', data: rows.map((p) => serializePayment(p, row)) })
})

keyRoutes.get('/agent/payments/:id', async (c) => {
  const row = await agentForToken(bearer(c))
  const payment = await paymentRow(c.req.param('id'))
  if (!payment || payment.walletKeyId !== row.id) throw new KovaError('not_found', 'No such payment for this key.')
  return c.json({ payment: serializePayment(payment, row), response: payment.response ?? null })
})
