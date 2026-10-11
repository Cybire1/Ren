import { schema } from '@kova/db'
import { currencies, explorerTxUrl } from '@kova/monad'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireApiKey } from '../auth.js'
import { network, settlementCurrency } from '../chain.js'
import { config } from '../config.js'
import { db } from '../db.js'
import { KovaError, notFound } from '../errors.js'
import { idempotent } from '../idempotency.js'
import { decodeId, encodeId } from '../ids.js'
import { cancelIntent, createIntent, getIntent, serializeIntent } from '../services/intents.js'
import { tillCodeFor } from '../services/pockets.js'
import { confirmTransaction } from '../services/settle.js'

const createBody = z.object({
  amount: z.string(),
  currency: z.enum(currencies).default(settlementCurrency),
  reference: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  terminal_id: z.string().optional(),
  expires_in: z.number().int().min(30).max(86_400).optional(),
})

const confirmBody = z.object({
  tx_hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
})

function intentUuid(id: string): string {
  const uuid = decodeId('paymentIntent', id)
  if (!uuid) throw notFound('payment intent', id)
  return uuid
}

export const intentRoutes = new Hono()
  .use(requireApiKey)
  .post('/', idempotent, async (c) => {
    const parsed = createBody.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success)
      throw new KovaError('invalid_request', 'Invalid request body', {
        issues: parsed.error.issues,
      })

    // A paired phone's charges are its own: its key knows which terminal it is.
    const terminalId = parsed.data.terminal_id
      ? (decodeId('terminal', parsed.data.terminal_id) ?? undefined)
      : (c.get('apiKey').terminalId ?? undefined)

    const intent = await createIntent({
      merchant: c.get('merchant'),
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      reference: parsed.data.reference,
      metadata: parsed.data.metadata,
      terminalId,
      expiresInSeconds: parsed.data.expires_in,
    })
    return c.json(serializeIntent(intent), 201)
  })
  /** One charge, with the transaction that paid it and the terminal that took it. */
  .get('/:id', async (c) => {
    const intent = await getIntent(c.get('merchant').id, intentUuid(c.req.param('id')))
    const [payment, terminal, ussdCode] = await Promise.all([
      db.query.payments.findFirst({ where: eq(schema.payments.intentId, intent.id) }),
      intent.terminalId
        ? db.query.terminals.findFirst({ where: eq(schema.terminals.id, intent.terminalId) })
        : undefined,
      tillCodeFor(intent).catch(() => null),
    ])
    return c.json({
      ...serializeIntent(intent),
      terminal: terminal ? { id: encodeId('terminal', terminal.id), name: terminal.name } : null,
      // For a phone with no data: dial Kova's USSD code and enter this.
      ussd: ussdCode ? { code: ussdCode, dial: config.KOVA_USSD_CODE } : null,
      payment: payment
        ? {
            id: encodeId('payment', payment.id),
            status: payment.status,
            tx_hash: payment.txHash,
            payer: payment.payerAddress,
            block_number: payment.blockNumber?.toString() ?? null,
            fee_payer: payment.feePayerAddress,
            confirmed_at: payment.confirmedAt?.toISOString() ?? null,
            explorer_url: explorerTxUrl(network, payment.txHash as `0x${string}`),
          }
        : null,
    })
  })
  .post('/:id/cancel', async (c) => {
    const intent = await cancelIntent(c.get('merchant').id, intentUuid(c.req.param('id')))
    return c.json(serializeIntent(intent))
  })
  /**
   * Reports the transaction that paid this intent. Kova verifies it against the chain
   * itself: the client's claim is only a hint that makes the UI fast.
   */
  .post('/:id/confirm', async (c) => {
    const merchantId = c.get('merchant').id
    const id = intentUuid(c.req.param('id'))
    const parsed = confirmBody.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success)
      throw new KovaError('invalid_request', 'Expected { tx_hash }', {
        issues: parsed.error.issues,
      })

    const result = await confirmTransaction(parsed.data.tx_hash as `0x${string}`)
    const intent = await getIntent(merchantId, id)
    return c.json({ ...serializeIntent(intent), settlement: result })
  })
