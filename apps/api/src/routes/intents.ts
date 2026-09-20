import { Hono } from 'hono'
import { z } from 'zod'
import { requireApiKey } from '../auth.js'
import { KovaError, notFound } from '../errors.js'
import { decodeId } from '../ids.js'
import { cancelIntent, createIntent, getIntent, serializeIntent } from '../services/intents.js'
import { confirmTransaction } from '../services/settle.js'

const createBody = z.object({
  amount: z.string(),
  currency: z.enum(['USDC', 'pathUSD', 'USDT0']).default('USDC'),
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
  .post('/', async (c) => {
    const parsed = createBody.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success)
      throw new KovaError('invalid_request', 'Invalid request body', {
        issues: parsed.error.issues,
      })

    const terminalId = parsed.data.terminal_id
      ? (decodeId('terminal', parsed.data.terminal_id) ?? undefined)
      : undefined

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
  .get('/:id', async (c) => {
    const intent = await getIntent(c.get('merchant').id, intentUuid(c.req.param('id')))
    return c.json(serializeIntent(intent))
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
