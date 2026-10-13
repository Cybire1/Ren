import { schema } from '@kova/db'
import { formatAmount, parseAmount } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { type Hex, isHex } from 'viem'
import { z } from 'zod'
import { db } from '../db.js'
import { KovaError, notFound } from '../errors.js'
import { decodeId } from '../ids.js'
import { clientIp as ip, limit } from '../limits.js'
import {
  cashOutRow,
  cashOutSent,
  cashOutsOf,
  cashOutTransferEvent,
  createCashOut,
  formatNaira,
  MAX_CASH_OUT,
  MIN_CASH_OUT,
  nairaReady,
  quoteCashOut,
  quotePayIn,
  serializeCashOut,
  settlePayIn,
  startPayIn,
} from '../services/naira.js'
import { accountName, nigerianBanks, paystackTestMode, webhookIsPaystack } from '../services/paystack.js'
import { requireWallet } from '../services/wallet-auth.js'

/**
 * Naira (services/naira.ts):
 *
 *   GET  /naira                                 whether it's on, the rates, the limits
 *   GET  /naira/banks                           Nigerian banks Paystack can pay
 *   POST /naira/account                         the name on an account number at a bank
 *   POST /wallets/:address/cash-outs            a quote for dollars out to a bank (signed in)
 *   POST /wallets/:address/cash-outs/:id/sent   the wallet sent the dollars: pay the naira
 *   GET  /wallets/:address/cash-outs(/:id)      its cash-outs
 *   POST /checkout/:id/naira                    pay a charge in naira: where to send the payer
 *   POST /checkout/:id/naira/verify             the payer came back from Paystack
 *   POST /paystack/webhook                      Paystack's word, signed
 */

const money = z.string().regex(/^\d{1,7}(\.\d{1,6})?$/, 'Expected dollars, like 50 or 12.50')

const bodyOf = async <T extends z.ZodTypeAny>(c: { req: { json: () => Promise<unknown> } }, shape: T): Promise<z.infer<T>> => {
  const parsed = shape.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) throw new KovaError('invalid_request', 'Invalid request body', { issues: parsed.error.issues })
  return parsed.data
}

function needNaira() {
  if (!nairaReady()) throw new KovaError('conflict', 'Naira isn’t switched on for this server yet.')
}

export const nairaRoutes = new Hono()

nairaRoutes.get('/naira', async (c) => {
  if (!nairaReady()) return c.json({ object: 'naira', enabled: false })
  const [out, inn] = await Promise.all([quoteCashOut(100_000_000n), quotePayIn(100_000_000n)])
  return c.json({
    object: 'naira',
    enabled: true,
    test_mode: paystackTestMode(),
    market_rate: out.market.toFixed(2),
    cash_out_rate: out.rate.toFixed(2),
    pay_in_rate: inn.rate.toFixed(2),
    min_cash_out: formatAmount(MIN_CASH_OUT),
    max_cash_out: formatAmount(MAX_CASH_OUT),
  })
})

nairaRoutes.get('/naira/banks', async (c) => {
  needNaira()
  return c.json({ object: 'list', data: await nigerianBanks() })
})

nairaRoutes.post('/naira/account', async (c) => {
  needNaira()
  limit(`naira-account:${ip(c)}`, 30, 60_000, 'Too many look-ups. Wait a minute.')
  const body = await bodyOf(c, z.object({ account_number: z.string().regex(/^\d{10}$/), bank_code: z.string().min(2).max(10) }))
  return c.json({ account_name: await accountName(body.account_number, body.bank_code) })
})

nairaRoutes.get('/naira/quote', async (c) => {
  needNaira()
  const amount = c.req.query('amount') ?? ''
  if (!/^\d{1,7}(\.\d{1,6})?$/.test(amount)) throw new KovaError('invalid_request', 'Give an amount in dollars.')
  const quote = await quoteCashOut(parseAmount(amount))
  return c.json({ naira: formatNaira(quote.naira), naira_kobo: quote.naira.toString(), rate: quote.rate.toFixed(2), fee: formatNaira(quote.fee) })
})

nairaRoutes.post('/wallets/:address/cash-outs', async (c) => {
  needNaira()
  const wallet = requireWallet(c, c.req.param('address'))
  limit(`cash-out:${wallet}`, 20, 60 * 60_000, 'That’s a lot of cash-outs. Try again later.')
  const body = await bodyOf(c, z.object({ amount: money, bank_code: z.string().min(2).max(10), account_number: z.string().regex(/^\d{10}$/) }))
  const row = await createCashOut(wallet, {
    amount: parseAmount(body.amount),
    bankCode: body.bank_code,
    accountNumber: body.account_number,
  })
  return c.json(serializeCashOut(row), 201)
})

nairaRoutes.post('/wallets/:address/cash-outs/:id/sent', async (c) => {
  needNaira()
  const wallet = requireWallet(c, c.req.param('address'))
  const body = await bodyOf(c, z.object({ tx_hash: z.string().refine((v) => isHex(v) && v.length === 66, 'Expected a transaction hash') }))
  const row = await cashOutRow(c.req.param('id'))
  if (!row) throw notFound('cash out', c.req.param('id'))
  return c.json(serializeCashOut(await cashOutSent(wallet, row, body.tx_hash as Hex)))
})

nairaRoutes.get('/wallets/:address/cash-outs', async (c) => {
  const wallet = requireWallet(c, c.req.param('address'))
  return c.json({ object: 'list', data: (await cashOutsOf(wallet)).map(serializeCashOut) })
})

nairaRoutes.get('/wallets/:address/cash-outs/:id', async (c) => {
  const wallet = requireWallet(c, c.req.param('address'))
  const row = await cashOutRow(c.req.param('id'))
  if (!row || row.walletAddress !== wallet.toLowerCase()) throw notFound('cash out', c.req.param('id'))
  return c.json(serializeCashOut(row))
})

// ── Paying a charge in naira ────────────────────────────────────────────────────────────────

async function openIntent(id: string) {
  const uuid = decodeId('paymentIntent', id)
  const intent = uuid ? await db.query.paymentIntents.findFirst({ where: eq(schema.paymentIntents.id, uuid) }) : undefined
  if (!intent) throw notFound('payment intent', id)
  const merchant = await db.query.merchants.findFirst({ where: eq(schema.merchants.id, intent.merchantId) })
  return { intent, shop: merchant?.name ?? 'A Ren shop' }
}

nairaRoutes.get('/checkout/:id/naira', async (c) => {
  if (!nairaReady()) return c.json({ enabled: false })
  const { intent } = await openIntent(c.req.param('id'))
  const quote = await quotePayIn(intent.amount)
  return c.json({ enabled: true, naira: formatNaira(quote.naira), rate: quote.rate.toFixed(2), test_mode: paystackTestMode() })
})

nairaRoutes.post('/checkout/:id/naira', async (c) => {
  needNaira()
  limit(`naira-pay:${ip(c)}`, 20, 60_000, 'Too many tries. Wait a minute.')
  const body = await bodyOf(c, z.object({ email: z.string().email().max(200), return_url: z.string().url().max(500) }))
  const { intent, shop } = await openIntent(c.req.param('id'))
  const started = await startPayIn(intent, { email: body.email, callbackUrl: body.return_url, shop })
  return c.json({ url: started.url, reference: started.reference, naira: formatNaira(started.naira) })
})

nairaRoutes.post('/checkout/:id/naira/verify', async (c) => {
  needNaira()
  const body = await bodyOf(c, z.object({ reference: z.string().regex(/^ren_[0-9a-f]{32}_[0-9a-f]{8}$/) }))
  const { intent } = await openIntent(c.req.param('id'))
  if (!body.reference.startsWith(`ren_${intent.id.replace(/-/g, '')}_`))
    throw new KovaError('invalid_request', 'That payment isn’t for this charge.')
  const row = await settlePayIn(body.reference)
  return c.json({ status: row.status, tx_hash: row.txHash, failure: row.failure })
})

nairaRoutes.post('/paystack/webhook', async (c) => {
  const raw = await c.req.text()
  if (!webhookIsPaystack(raw, c.req.header('x-paystack-signature'))) return c.json({ ok: false }, 401)
  const event = JSON.parse(raw) as { event?: string; data?: { reference?: string } }
  const reference = event.data?.reference
  if (reference) {
    if (event.event === 'charge.success' && reference.startsWith('ren_')) void settlePayIn(reference).catch(() => {})
    if (event.event?.startsWith('transfer.')) void cashOutTransferEvent(reference, event.event).catch(() => {})
  }
  return c.json({ ok: true })
})

