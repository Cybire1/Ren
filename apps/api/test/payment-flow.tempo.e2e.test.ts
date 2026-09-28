import { serve } from '@hono/node-server'
import { schema, uuidv7 } from '@kova/db'
import { encodeMemo } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generateApiKey } from '../src/auth.js'
import { balanceOf, feePayerAddress, network, publicClient, settlementToken } from '../src/chain.js'
import { db } from '../src/db.js'
import { app } from '../src/index.js'
import {
  type Checkout,
  fund,
  getCheckout,
  pay,
  send,
  walletFor,
} from '../src/scripts/customer-tempo.js'

/**
 * The full Kova payment path on Tempo testnet, through the real API and the real fee-payer
 * relay: create a charge, pay it as Kova Pay does (a `transferWithMemo` the customer signs,
 * Kova's fee payer adds the fee), and check that the relay sponsors nothing but exactly that
 * charge, or a plain send between people.
 *
 * Requires: a local Postgres with migrations applied, and a funded fee payer (`pnpm setup:dev`).
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
  if (!feePayerAddress) throw new Error('no fee payer configured: run `pnpm setup:dev` first')

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

  // Today's five test dollars from Kova's treasury, as any wallet gets them.
  expect(await fund(baseUrl, payer.address)).toBe(5_000_000n)
}, 120_000)

afterAll(() => {
  server?.close()
})

describe('payment flow on Tempo', () => {
  it('pays a charge through Kova’s relay: the customer pays the price, Kova pays the fee', async () => {
    const checkout = await newCharge('4.50')
    expect(checkout.status).toBe('requires_payment')
    expect(checkout.currency).toBe('USDC')
    expect(checkout.chain_id).toBe(network.chainId)
    expect(checkout.pay_to.toLowerCase()).toBe(merchantAddress.toLowerCase())

    const paid = await pay(baseUrl, checkout, payer)
    expect(paid.status).toBe('paid')
    console.log(
      `${checkout.id} paid on-chain in ${paid.payMs}ms (${paid.roundTripMs}ms with confirm) · ${paid.payment?.explorer_url}`,
    )

    // Kova's fee payer paid the fee; the customer spent exactly the price and not a cent more.
    const receipt = (await publicClient.getTransactionReceipt({
      hash: paid.payment?.tx_hash as `0x${string}`,
    })) as { feePayer?: string }
    expect(receipt.feePayer?.toLowerCase()).toBe(feePayerAddress?.toLowerCase())
    expect(await balanceOf(settlementToken.address, payer.address)).toBe(500_000n)
    expect(await balanceOf(settlementToken.address, merchantAddress)).toBe(4_500_000n)

    // Reporting it again changes nothing: one payment, one balanced pair of ledger rows.
    const again = await fetch(`${baseUrl}/v1/checkout/${checkout.id}/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tx_hash: paid.payment?.tx_hash }),
    })
    expect(again.status).toBe(200)
    const payments = await db.query.payments.findMany({
      where: eq(schema.payments.txHash, paid.payment?.tx_hash as string),
    })
    expect(payments).toHaveLength(1)
    expect(payments[0]?.feePayerAddress?.toLowerCase()).toBe(feePayerAddress?.toLowerCase())
    const entries = await db.query.ledgerEntries.findMany({
      where: eq(schema.ledgerEntries.refId, payments[0]?.id as string),
    })
    expect(entries).toHaveLength(2)
    expect(entries.find((e) => e.direction === 'debit')?.amount).toBe(
      entries.find((e) => e.direction === 'credit')?.amount,
    )
  }, 120_000)

  it('will not pay the fee for anything that is not exactly the charge', async () => {
    const checkout = await newCharge('0.20')
    const wallet = walletFor(baseUrl, checkout.chain_id, payer, checkout.token)
    const attempt = (overrides: { to?: `0x${string}`; amount?: bigint; memo?: `0x${string}` }) =>
      wallet.token.transferSync({
        token: checkout.token,
        to: overrides.to ?? checkout.pay_to,
        amount: overrides.amount ?? BigInt(checkout.amount_base),
        memo: overrides.memo ?? checkout.memo,
        feePayer: true,
      })
    const balance = await balanceOf(settlementToken.address, payer.address)
    // The charge's memo, but the wrong amount, or to someone else.
    await expect(attempt({ amount: 100_000n })).rejects.toThrow()
    await expect(attempt({ to: payer.address })).rejects.toThrow()
    // A refund memo is Kova's to send, never a customer's.
    await expect(attempt({ memo: encodeMemo({ kind: 'refund', id: uuidv7() }) })).rejects.toThrow()
    expect(await balanceOf(settlementToken.address, payer.address)).toBe(balance)
    expect((await getCheckout(baseUrl, checkout.id)).status).toBe('requires_payment')
  }, 60_000)

  it('pays the fee for a send between people, and the recipient gets every cent', async () => {
    const friend = privateKeyToAccount(generatePrivateKey())
    const receipt = await send(
      baseUrl,
      network.chainId,
      payer,
      friend.address,
      settlementToken.address,
      250_000n,
    )
    expect(receipt.status).toBe('success')
    expect((receipt as { feePayer?: string }).feePayer?.toLowerCase()).toBe(
      feePayerAddress?.toLowerCase(),
    )
    expect(await balanceOf(settlementToken.address, friend.address)).toBe(250_000n)
    expect(await balanceOf(settlementToken.address, payer.address)).toBe(250_000n)
  }, 60_000)

  it('shows a wallet its own history, read from Tempo: the shop it paid, the friend it sent to', async () => {
    const start = (await publicClient.getBlock({ blockTag: 'finalized' })).number - 3_000n
    type Row = {
      kind: string | null
      shop: { name: string } | null
      amount: string
      faucet: boolean
      to: string
    }
    let rows: Row[] = []
    for (let i = 0; i < 20; i++) {
      const response = await fetch(
        `${baseUrl}/v1/wallets/${payer.address}/transfers?direction=all&after_block=${start}`,
      )
      expect(response.status).toBe(200)
      rows = ((await response.json()) as { data: Row[] }).data
      if (rows.length >= 3) break
      await new Promise((r) => setTimeout(r, 500))
    }
    // Test dollars in, the $4.50 charge out to the shop, and the $0.25 send to a friend.
    expect(rows.find((r) => r.faucet)?.amount).toBe('5.00')
    expect(rows.find((r) => r.kind === 'payment')?.shop?.name).toBe('Test Merchant')
    expect(rows.find((r) => r.amount === '0.25')?.kind).toBeNull()
  }, 60_000)

  it('keeps Monad’s signed-authorization door shut on Tempo', async () => {
    const checkout = await newCharge('1.00')
    const response = await fetch(`${baseUrl}/v1/checkout/${checkout.id}/authorize`, {
      method: 'POST',
      body: '{}',
    })
    expect(response.status).toBe(404)
  })

  it('rejects an unauthenticated request', async () => {
    const response = await fetch(`${baseUrl}/v1/payment_intents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: '1.00' }),
    })
    expect(response.status).toBe(401)
  })

  it('reports health with the chain and the fee payer', async () => {
    const response = await fetch(`${baseUrl}/health`)
    const body = (await response.json()) as {
      status: string
      relayer: string | null
      chain_id: number
      chain_kind: string
    }
    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.chain_kind).toBe('tempo')
    expect(body.chain_id).toBe(42431)
    expect(body.relayer?.toLowerCase()).toBe(feePayerAddress?.toLowerCase())
  })
})
