import { schema } from '@kova/db'
import { formatAmount } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { Mppx, Store, tempo } from 'mppx/server'
import { type Address, getAddress, type Hex, type TransactionReceipt } from 'viem'
import { feePayerAccount, network, onTempo, publicClient, settlementToken } from '../chain.js'
import { db } from '../db.js'
import { KovaError, notFound } from '../errors.js'
import { decodeId } from '../ids.js'
import { keysSubkey } from '../secrets.js'
import { settleVerified } from '../services/settle.js'

/**
 * Any AI agent can pay a Ren shop over MPP (the Machine Payments Protocol): not only agents with a
 * Ren key, but any MPP client, such as Tempo's wallet CLI (`tempo request`) or AgentCash.
 *
 *   GET or POST /v1/mpp/charges/:id
 *
 * The first call answers 402 with a challenge for exactly the charge's amount to the shop's
 * address; the agent pays and calls again with its credential; Ren (which pays the fee, so the agent
 * needs only dollars) checks it, settles the charge, and the till turns to paid. MPP binds the
 * payment to its challenge rather than to the charge's memo, so Ren settles the charge itself, once.
 */

function makeServer() {
  return Mppx.create({
    methods: [
      tempo.charge({
        currency: settlementToken.address,
        testnet: network.id === 'testnet',
        // Ren pays the network fee, so an agent spends exactly the charge.
        feePayer: feePayerAccount,
        store: Store.memory(),
      }),
    ],
    realm: 'Ren',
    secretKey: keysSubkey('mpp-challenge').toString('hex'),
  })
}

let server: ReturnType<typeof makeServer> | null = null

/** One server for the process, so its replay store sees every credential. */
function mpp() {
  if (!onTempo || !feePayerAccount) throw new KovaError('conflict', 'MPP isn’t switched on for this server.')
  server ??= makeServer()
  return server
}

function receiptReference(response: Response): Hex | null {
  const header = response.headers.get('payment-receipt')
  if (!header) return null
  try {
    return ((JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { reference?: string }).reference ?? null) as Hex | null
  } catch {
    return null
  }
}

export const mppRoutes = new Hono()

mppRoutes.on(['GET', 'POST'], '/mpp/charges/:id', async (c) => {
  const id = c.req.param('id')
  const uuid = decodeId('paymentIntent', id)
  const intent = uuid ? await db.query.paymentIntents.findFirst({ where: eq(schema.paymentIntents.id, uuid) }) : undefined
  if (!intent) throw notFound('payment intent', id)
  if (intent.status === 'paid') return c.json({ status: 'paid', charge: id })
  if (intent.status !== 'requires_payment' || intent.expiresAt < new Date())
    throw new KovaError('conflict', 'This charge isn’t open any more.')
  const merchant = await db.query.merchants.findFirst({ where: eq(schema.merchants.id, intent.merchantId) })

  const result = await mpp().charge({
    amount: formatAmount(intent.amount),
    recipient: getAddress(intent.payTo),
    description: `${merchant?.name ?? 'A Ren shop'}${intent.reference ? `: ${intent.reference}` : ''}`.slice(0, 120),
    meta: { charge: id },
    scope: `charge:${id}`,
  } as never)(c.req.raw)
  if (result.status === 402) return result.challenge as Response

  const response = result.withReceipt(Response.json({ status: 'paid', charge: id })) as Response
  const hash = receiptReference(response)
  if (hash) {
    const receipt = (await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 })) as TransactionReceipt
    await settleVerified(intent, receipt, receipt.from as Address)
  }
  return response
})
