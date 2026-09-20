import { serve } from '@hono/node-server'
import { schema, uuidv7 } from '@kova/db'
import { getNetwork, getToken } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { parseUnits } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Actions, createClient, http, withRelay } from 'viem/tempo'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generateApiKey } from '../src/auth.js'
import { feePayerAddress } from '../src/chain.js'
import { db } from '../src/db.js'
import { app } from '../src/index.js'

/**
 * The full Kova payment path, through the real API and the real relay, against Moderato:
 * create an intent, pay it with a sponsored transfer, confirm it, and check that the
 * sponsorship gate refuses anything that is not that exact payment.
 *
 * Requires: a local Postgres with migrations applied, and `pnpm setup:dev` for the fee payer.
 */

const network = getNetwork('testnet')
const token = getToken('testnet', 'USDC')

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

beforeAll(async () => {
  if (!feePayerAddress) throw new Error('no fee payer configured: run `pnpm setup:dev` first')

  const merchantWallet = privateKeyToAccount(generatePrivateKey())
  merchantAddress = merchantWallet.address
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

  // Fund the payer from the faucet.
  const funder = createClient({ testnet: true, transport: http(network.rpcUrl) })
  await Actions.faucet.fund(funder, { account: payer.address })
  for (let i = 0; i < 40; i++) {
    const balance = await Actions.token.getBalance(funder, {
      account: payer.address,
      token: token.address,
    })
    if (balance.amount > 0n) return
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('faucet did not fund the payer')
}, 120_000)

afterAll(() => {
  server?.close()
})

/** A payer wallet that routes through Kova's relay, so the user never needs a gas token. */
function payerClient() {
  return createClient({
    account: payer,
    testnet: true,
    feeToken: token.address,
    transport: withRelay(http(network.rpcUrl), http(`${baseUrl}/rpc/relay`)),
  })
}

describe('payment flow', () => {
  it('creates an intent, pays it sponsored, and confirms it as paid', async () => {
    const created = await api('/v1/payment_intents', {
      method: 'POST',
      body: JSON.stringify({ amount: '4.50', reference: 'order_1' }),
    })
    expect(created.status).toBe(201)
    const intent = created.body as unknown as {
      id: string
      amount: string
      status: string
      pay_to: string
      memo: string
      token: string
    }
    expect(intent.status).toBe('requires_payment')
    expect(intent.pay_to.toLowerCase()).toBe(merchantAddress.toLowerCase())

    const started = Date.now()
    const { receipt } = await payerClient().token.transferSync({
      token: intent.token as `0x${string}`,
      to: intent.pay_to as `0x${string}`,
      amount: parseUnits('4.50', 6),
      memo: intent.memo as `0x${string}`,
      feePayer: true,
    })
    expect(receipt.status).toBe('success')
    // Kova paid, not the payer.
    expect(receipt.feePayer?.toLowerCase()).toBe(feePayerAddress?.toLowerCase())

    const confirmed = await api(`/v1/payment_intents/${intent.id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ tx_hash: receipt.transactionHash }),
    })
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.status).toBe('paid')
    console.log(
      `intent ${intent.id} paid in ${Date.now() - started}ms · ${network.explorerUrl}/tx/${receipt.transactionHash}`,
    )

    // Confirming twice must not create a second payment.
    const again = await api(`/v1/payment_intents/${intent.id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ tx_hash: receipt.transactionHash }),
    })
    expect(again.body.status).toBe('paid')
    const payments = await db.query.payments.findMany({
      where: eq(schema.payments.txHash, receipt.transactionHash),
    })
    expect(payments).toHaveLength(1)

    // The ledger balances: one debit, one credit, same amount.
    const entries = await db.query.ledgerEntries.findMany({
      where: eq(schema.ledgerEntries.refId, payments[0]?.id as string),
    })
    expect(entries).toHaveLength(2)
    expect(entries.filter((e) => e.direction === 'debit')[0]?.amount).toBe(
      entries.filter((e) => e.direction === 'credit')[0]?.amount,
    )
  }, 120_000)

  it('refuses to sponsor a transfer that is not an open Kova payment', async () => {
    const stranger = privateKeyToAccount(generatePrivateKey()).address
    // Right shape, wrong recipient and no matching memo: the relay must not pay for it.
    await expect(
      payerClient().token.transferSync({
        token: token.address,
        to: stranger,
        amount: parseUnits('1.00', 6),
        memo: `0x${'11'.repeat(32)}`,
        feePayer: true,
      }),
    ).rejects.toThrow()
  }, 60_000)

  it('rejects an unauthenticated request', async () => {
    const response = await fetch(`${baseUrl}/v1/payment_intents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: '1.00' }),
    })
    expect(response.status).toBe(401)
  })

  it('reports health with chain and fee-payer state', async () => {
    const response = await fetch(`${baseUrl}/health`)
    const body = (await response.json()) as { status: string; fee_payer: string | null }
    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.fee_payer?.toLowerCase()).toBe(feePayerAddress?.toLowerCase())
  })
})
