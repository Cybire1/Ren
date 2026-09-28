import { serve } from '@hono/node-server'
import { schema, uuidv7 } from '@kova/db'
import { randomNonce, toSignedAuthorization, transferAuthorizationTypedData } from '@kova/monad'
import { eq } from 'drizzle-orm'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generateApiKey } from '../src/auth.js'
import { feePayerAddress, network, publicClient, settlementToken } from '../src/chain.js'
import { db } from '../src/db.js'
import { app } from '../src/index.js'
import { type Checkout, fund, getCheckout, pay } from '../src/scripts/customer.js'

/**
 * The full Kova payment path on Monad testnet, through the real API and the real relayer:
 * create a charge, sign an authorization for it as Kova Pay does, let Kova submit it and pay
 * the gas, and check that nothing but that exact payment gets relayed.
 *
 * Requires: a local Postgres with migrations applied, and a relayer with testnet MON
 * (`pnpm setup:dev`).
 */

let server: ReturnType<typeof serve>
let baseUrl: string
let apiKey: string
let merchantAddress: `0x${string}`

const payer = privateKeyToAccount(generatePrivateKey())

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  })
  return { status: response.status, body: (await response.json()) as Record<string, never> }
}

async function newCharge(amount: string): Promise<Checkout> {
  const created = await api('/v1/payment_intents', {
    method: 'POST',
    body: JSON.stringify({ amount, reference: `order_${amount}` }),
  })
  expect(created.status).toBe(201)
  return getCheckout(baseUrl, (created.body as unknown as { id: string }).id)
}

beforeAll(async () => {
  if (!feePayerAddress) throw new Error('no relayer configured: run `pnpm setup:dev` first')

  merchantAddress = privateKeyToAccount(generatePrivateKey()).address
  const merchantId = uuidv7()
  await db.insert(schema.merchants).values({
    id: merchantId,
    name: 'Test Merchant',
    slug: `test-${merchantId}`,
    settlementAddress: merchantAddress,
    network: 'testnet',
    isTest: true,
  })
  const generated = generateApiKey(true)
  apiKey = generated.secret
  await db.insert(schema.apiKeys).values({
    id: uuidv7(),
    merchantId,
    name: 'test',
    prefix: generated.prefix,
    secretHash: generated.secretHash,
    scopes: ['payments:read', 'payments:write'],
    isTest: true,
  })

  server = serve({ fetch: app.fetch, port: 0 })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('server did not bind')
  baseUrl = `http://127.0.0.1:${address.port}`

  await fund(baseUrl, payer.address)
}, 120_000)

afterAll(() => {
  server?.close()
})

describe('payment flow', () => {
  it('pays a charge from a signature alone: Kova submits it and pays the gas', async () => {
    const checkout = await newCharge('4.50')
    expect(checkout.status).toBe('requires_payment')
    expect(checkout.currency).toBe('AUSD')
    expect(checkout.chain_id).toBe(network.chainId)
    expect(checkout.pay_to.toLowerCase()).toBe(merchantAddress.toLowerCase())

    const paid = await pay(baseUrl, checkout, payer)
    expect(paid.status).toBe('paid')
    console.log(
      `${checkout.id} paid in ${paid.roundTripMs}ms (relay ${paid.payment.ms}ms) · ${paid.payment.explorer_url}`,
    )

    // The payer holds no MON: Kova's relayer submitted it and paid.
    const receipt = await publicClient.getTransactionReceipt({ hash: paid.payment.tx_hash })
    expect(receipt.from.toLowerCase()).toBe(feePayerAddress?.toLowerCase())
    expect(await publicClient.getBalance({ address: payer.address })).toBe(0n)

    // Paying again is answered, not repeated: one payment, one balanced pair of ledger rows.
    const again = await pay(baseUrl, checkout, payer)
    expect(again.payment.tx_hash).toBe(paid.payment.tx_hash)
    const payments = await db.query.payments.findMany({
      where: eq(schema.payments.txHash, paid.payment.tx_hash),
    })
    expect(payments).toHaveLength(1)
    const entries = await db.query.ledgerEntries.findMany({
      where: eq(schema.ledgerEntries.refId, payments[0]?.id as string),
    })
    expect(entries).toHaveLength(2)
    expect(entries.find((e) => e.direction === 'debit')?.amount).toBe(
      entries.find((e) => e.direction === 'credit')?.amount,
    )
  }, 120_000)

  it('refuses any approval that is not for exactly this charge, without spending gas', async () => {
    const checkout = await newCharge('3.00')
    const nonceBefore = await publicClient.getTransactionCount({
      address: feePayerAddress as `0x${string}`,
    })
    const base = {
      from: payer.address,
      to: checkout.pay_to,
      value: BigInt(checkout.amount_base),
      validAfter: 0n,
      validBefore: BigInt(Math.floor(Date.parse(checkout.expires_at) / 1000)),
      nonce: checkout.memo,
    }
    const attempt = async (authorization: typeof base, signer = payer) => {
      const signature = await signer.signTypedData(
        transferAuthorizationTypedData(settlementToken as never, network.chainId, authorization),
      )
      return api(`/v1/checkout/${checkout.id}/authorize`, {
        method: 'POST',
        body: JSON.stringify(
          toSignedAuthorization(settlementToken.address, authorization, signature),
        ),
      })
    }
    expect((await attempt({ ...base, value: 1_000_000n })).status).toBe(400)
    expect((await attempt({ ...base, nonce: randomNonce() })).status).toBe(400)
    expect((await attempt({ ...base, to: payer.address })).status).toBe(400)
    // Signed by someone other than the wallet it would take money from.
    const impostor = await attempt(base, privateKeyToAccount(generatePrivateKey()))
    expect(impostor.status).toBe(400)
    expect(
      await publicClient.getTransactionCount({ address: feePayerAddress as `0x${string}` }),
    ).toBe(nonceBefore)
  }, 60_000)

  it('will not relay a charge’s memo through the plain send door', async () => {
    const checkout = await newCharge('1.00')
    const authorization = {
      from: payer.address,
      to: checkout.pay_to,
      value: 1_000_000n,
      validAfter: 0n,
      validBefore: BigInt(Math.floor(Date.now() / 1000) + 600),
      nonce: checkout.memo,
    }
    const signature = await payer.signTypedData(
      transferAuthorizationTypedData(settlementToken as never, network.chainId, authorization),
    )
    const response = await api('/v1/transfers', {
      method: 'POST',
      body: JSON.stringify(
        toSignedAuthorization(settlementToken.address, authorization, signature),
      ),
    })
    expect(response.status).toBe(400)
  })

  it('rejects an unauthenticated request', async () => {
    const response = await fetch(`${baseUrl}/v1/payment_intents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: '1.00' }),
    })
    expect(response.status).toBe(401)
  })

  it('reports health with the chain and the relayer', async () => {
    const response = await fetch(`${baseUrl}/health`)
    const body = (await response.json()) as {
      status: string
      relayer: string | null
      chain_id: number
    }
    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.chain_id).toBe(10143)
    expect(body.relayer?.toLowerCase()).toBe(feePayerAddress?.toLowerCase())
  })
})
