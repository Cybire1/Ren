import { schema } from '@kova/db'
import { formatAmount } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db.js'
import { KovaError, notFound } from '../errors.js'
import { decodeId } from '../ids.js'
import { type PaymentIntent, serializeIntent } from '../services/intents.js'
import { confirmTransaction } from '../services/settle.js'

/**
 * The payer's side of a charge. No API key: anyone holding the charge's id (it is in the QR)
 * can read what to pay and report a transaction. Nothing here can move money or change an
 * intent except through a transaction Kova verifies on-chain itself.
 */

async function load(id: string): Promise<{ intent: PaymentIntent; merchantName: string }> {
  const uuid = decodeId('paymentIntent', id)
  if (!uuid) throw notFound('payment intent', id)
  const intent = await db.query.paymentIntents.findFirst({
    where: eq(schema.paymentIntents.id, uuid),
  })
  if (!intent) throw notFound('payment intent', id)
  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, intent.merchantId),
  })
  return { intent, merchantName: merchant?.name ?? 'Merchant' }
}

function serializeCheckout(intent: PaymentIntent, merchantName: string) {
  const expired = intent.status === 'requires_payment' && intent.expiresAt.getTime() < Date.now()
  const { id, status, token, pay_to, memo, reference, network, currency } = serializeIntent(intent)
  return {
    object: 'checkout',
    id,
    merchant_name: merchantName,
    amount: formatAmount(intent.amount),
    /** Base units (6 decimals), as a string so it survives JSON. */
    amount_base: intent.amount.toString(),
    currency,
    status: expired ? 'expired' : status,
    network,
    token,
    pay_to,
    memo,
    reference,
    expires_at: intent.expiresAt.toISOString(),
  }
}

const confirmBody = z.object({ tx_hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) })

export const checkoutRoutes = new Hono()
  .get('/:id', async (c) => {
    const { intent, merchantName } = await load(c.req.param('id'))
    return c.json(serializeCheckout(intent, merchantName))
  })
  .post('/:id/confirm', async (c) => {
    const parsed = confirmBody.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success) throw new KovaError('invalid_request', 'Expected { tx_hash }')
    await confirmTransaction(parsed.data.tx_hash as `0x${string}`)
    const { intent, merchantName } = await load(c.req.param('id'))
    return c.json(serializeCheckout(intent, merchantName))
  })
