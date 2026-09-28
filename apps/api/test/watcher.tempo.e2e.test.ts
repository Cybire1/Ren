import { schema, uuidv7 } from '@kova/db'
import { encodeMemo, parseAmount } from '@kova/tempo'
import { and, eq } from 'drizzle-orm'
import { http } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createClient } from 'viem/tempo'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { feePayerAccount, network, publicClient, settlementToken } from '../src/chain.js'
import { db } from '../src/db.js'
import { giveTestDollars } from '../src/services/faucet.js'
import { catchUp, startWatcher, type WatcherHandle } from '../src/workers/watcher.js'

/**
 * A payment Kova's API never saw must still settle: here the customer pays a charge's memo
 * straight on Tempo from their own wallet, paying their own fee, as any Tempo wallet scanning
 * the QR would. Only the watcher can find it. The same scan puts it in the index wallets read.
 */

const payer = privateKeyToAccount(generatePrivateKey())
const merchant = privateKeyToAccount(generatePrivateKey())

let watcher: WatcherHandle | undefined
let merchantId: string

beforeAll(async () => {
  if (!feePayerAccount) throw new Error('no fee payer configured: run `pnpm setup:dev` first')
  merchantId = uuidv7()
  await db.insert(schema.merchants).values({
    id: merchantId,
    name: 'Watcher Merchant',
    slug: `watcher-${merchantId}`,
    settlementAddress: merchant.address,
    network: 'testnet',
    isTest: true,
  })
  // Today's test dollars from Kova's treasury, as any wallet gets them.
  await giveTestDollars(payer.address)
}, 120_000)

afterAll(async () => {
  await watcher?.stop()
})

describe('chain watcher on Tempo', () => {
  it('settles a payment Kova never relayed, and indexes it with its memo', async () => {
    const intentId = uuidv7()
    const memo = encodeMemo({ kind: 'payment', id: intentId })
    const amount = parseAmount('2.25')
    await db.insert(schema.paymentIntents).values({
      id: intentId,
      merchantId,
      amount,
      currency: 'USDC',
      tokenAddress: settlementToken.address,
      network: 'testnet',
      payTo: merchant.address,
      memo,
      expiresAt: new Date(Date.now() + 900_000),
    })

    // Straight to the chain from the customer's own wallet, fee and all: Kova hears nothing.
    const own = createClient({
      account: payer,
      testnet: true,
      feeToken: settlementToken.address,
      transport: http(network.rpcUrl),
    })
    const { receipt } = await own.token.transferSync({
      token: settlementToken.address,
      to: merchant.address,
      amount,
      memo,
    })
    expect(receipt.status).toBe('success')

    const before = await db.query.paymentIntents.findFirst({
      where: eq(schema.paymentIntents.id, intentId),
    })
    expect(before?.status).toBe('requires_payment')

    // Wait for finality (Tempo's is deterministic and sub-second), then start the watcher: it
    // replays recent blocks from its cursor and finds the payment within a few polls.
    for (let i = 0; i < 40; i++) {
      const finalized = await publicClient.getBlock({ blockTag: 'finalized' })
      if (finalized.number >= receipt.blockNumber) break
      await new Promise((r) => setTimeout(r, 250))
    }
    watcher = await startWatcher()
    let after = await db.query.paymentIntents.findFirst({
      where: eq(schema.paymentIntents.id, intentId),
    })
    for (let i = 0; i < 90 && after?.status !== 'paid'; i++) {
      await new Promise((r) => setTimeout(r, 500))
      after = await db.query.paymentIntents.findFirst({
        where: eq(schema.paymentIntents.id, intentId),
      })
    }
    expect(after?.status).toBe('paid')

    const payments = await db.query.payments.findMany({
      where: eq(schema.payments.intentId, intentId),
    })
    expect(payments).toHaveLength(1)
    expect(payments[0]?.payerAddress.toLowerCase()).toBe(payer.address.toLowerCase())

    // Indexed once, with its memo; the fee the customer paid is not a transfer anyone made.
    const indexed = await db.query.transfers.findMany({
      where: and(
        eq(schema.transfers.txHash, receipt.transactionHash),
        eq(schema.transfers.toAddress, merchant.address.toLowerCase()),
      ),
    })
    expect(indexed).toHaveLength(1)
    expect(indexed[0]?.nonce).toBe(memo)
    expect(indexed[0]?.amount).toBe(amount)
    expect(
      await db.query.transfers.findMany({
        where: eq(schema.transfers.txHash, receipt.transactionHash),
      }),
    ).toHaveLength(1)

    // Replaying the same range must not double-record anything.
    await catchUp(receipt.blockNumber, receipt.blockNumber)
    expect(
      await db.query.payments.findMany({ where: eq(schema.payments.intentId, intentId) }),
    ).toHaveLength(1)
    expect(
      await db.query.transfers.findMany({
        where: eq(schema.transfers.txHash, receipt.transactionHash),
      }),
    ).toHaveLength(1)
  }, 180_000)
})
