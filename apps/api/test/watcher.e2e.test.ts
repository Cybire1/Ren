import { schema, uuidv7 } from '@kova/db'
import { encodeMemo, getNetwork, getToken, parseAmount } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Actions, createClient, http, withRelay } from 'viem/tempo'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../src/db.js'
import { catchUp, startWatcher, type WatcherHandle } from '../src/workers/watcher.js'

/**
 * A payment Kova did not submit — a customer scanning a QR code and paying from their own
 * wallet — must still settle. Here the payer uses Tempo's public sponsor, so Kova's relay
 * never sees the transaction and only the watcher can find it.
 */

const network = getNetwork('testnet')
const token = getToken('testnet', 'USDC')
const payer = privateKeyToAccount(generatePrivateKey())
const merchant = privateKeyToAccount(generatePrivateKey())

let watcher: WatcherHandle | undefined
let merchantId: string

beforeAll(async () => {
  merchantId = uuidv7()
  await db.insert(schema.merchants).values({
    id: merchantId,
    name: 'Watcher Merchant',
    slug: `watcher-${merchantId}`,
    settlementAddress: merchant.address,
    network: 'testnet',
    isTest: true,
  })

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

afterAll(async () => {
  await watcher?.stop()
})

describe('chain watcher', () => {
  it('settles a payment Kova never submitted', async () => {
    const intentId = uuidv7()
    const memo = encodeMemo({ kind: 'payment', id: intentId })
    const amount = parseAmount('2.25')
    await db.insert(schema.paymentIntents).values({
      id: intentId,
      merchantId,
      amount,
      currency: 'USDC',
      tokenAddress: token.address,
      network: 'testnet',
      payTo: merchant.address,
      memo,
      expiresAt: new Date(Date.now() + 900_000),
    })

    // An outside wallet pays, sponsored by Tempo's public testnet sponsor, not by Kova.
    const outside = createClient({
      account: payer,
      testnet: true,
      feeToken: token.address,
      transport: withRelay(http(network.rpcUrl), http(network.publicSponsorUrl)),
    })
    const { receipt } = await outside.token.transferSync({
      token: token.address,
      to: merchant.address,
      amount,
      memo,
      feePayer: true,
    })
    expect(receipt.status).toBe('success')

    // Kova has recorded nothing yet: nobody told it.
    const before = await db.query.paymentIntents.findFirst({
      where: eq(schema.paymentIntents.id, intentId),
    })
    expect(before?.status).toBe('requires_payment')

    // Starting the watcher replays recent blocks and finds it.
    watcher = await startWatcher()
    const after = await db.query.paymentIntents.findFirst({
      where: eq(schema.paymentIntents.id, intentId),
    })
    expect(after?.status).toBe('paid')

    const payments = await db.query.payments.findMany({
      where: eq(schema.payments.intentId, intentId),
    })
    expect(payments).toHaveLength(1)
    expect(payments[0]?.payerAddress.toLowerCase()).toBe(payer.address.toLowerCase())

    // Replaying the same range must not double-record it.
    await catchUp(receipt.blockNumber, receipt.blockNumber)
    const again = await db.query.payments.findMany({
      where: eq(schema.payments.intentId, intentId),
    })
    expect(again).toHaveLength(1)
  }, 180_000)
})
