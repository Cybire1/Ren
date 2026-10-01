import { schema, uuidv7 } from '@kova/db'
import {
  eip3009Abi,
  encodeMemo,
  parseAmount,
  transferAuthorizationTypedData,
  transferWithAuthorizationArgs,
} from '@kova/monad'
import { and, eq } from 'drizzle-orm'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { network, publicClient, settlementToken, walletClient } from '../src/chain.js'
import { db } from '../src/db.js'
import { giveTestDollars } from '../src/services/faucet.js'
import { catchUp, startWatcher, type WatcherHandle } from '../src/workers/watcher.js'

/**
 * A payment Kova's API never saw must still settle: here the signed authorization goes
 * on-chain directly, as another relayer or the payer's own wallet would submit it, and only the
 * watcher can find it. The same scan puts the transfer in the index wallets read from.
 */

const payer = privateKeyToAccount(generatePrivateKey())
const merchant = privateKeyToAccount(generatePrivateKey())

let watcher: WatcherHandle | undefined
let merchantId: string

// On-chain: it needs a relayer with testnet MON and AUSD (pnpm setup:dev). Without one, it skips.
const relayer = Boolean(walletClient)

beforeAll(async () => {
  if (!relayer) return
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

describe.skipIf(!relayer)('chain watcher (on Monad testnet; needs a funded relayer)', () => {
  it('settles a payment Kova never submitted, and indexes it for wallets', async () => {
    const intentId = uuidv7()
    const memo = encodeMemo({ kind: 'payment', id: intentId })
    const amount = parseAmount('2.25')
    await db.insert(schema.paymentIntents).values({
      id: intentId,
      merchantId,
      amount,
      currency: 'AUSD',
      tokenAddress: settlementToken.address,
      network: 'testnet',
      payTo: merchant.address,
      memo,
      expiresAt: new Date(Date.now() + 900_000),
    })

    const authorization = {
      from: payer.address,
      to: merchant.address,
      value: amount,
      validAfter: 0n,
      validBefore: BigInt(Math.floor(Date.now() / 1000) + 900),
      nonce: memo,
    }
    const signature = await payer.signTypedData(
      transferAuthorizationTypedData(settlementToken, network.chainId, authorization),
    )
    // Straight to the chain: Kova's checkout never hears about it.
    const receipt = await walletClient!.writeContractSync({
      address: settlementToken.address,
      abi: eip3009Abi,
      functionName: 'transferWithAuthorization',
      args: transferWithAuthorizationArgs(authorization, signature),
    })
    expect(receipt.status).toBe('success')

    const before = await db.query.paymentIntents.findFirst({
      where: eq(schema.paymentIntents.id, intentId),
    })
    expect(before?.status).toBe('requires_payment')

    // Wait for the block to finalize (two blocks, well under a second), then start the watcher:
    // it replays recent blocks from its cursor and finds the payment within a few polls.
    for (let i = 0; i < 40; i++) {
      const finalized = await publicClient.getBlock({ blockTag: 'finalized' })
      if (finalized.number >= receipt.blockNumber) break
      await new Promise((r) => setTimeout(r, 250))
    }
    watcher = await startWatcher()
    let after = await db.query.paymentIntents.findFirst({
      where: eq(schema.paymentIntents.id, intentId),
    })
    for (let i = 0; i < 60 && after?.status !== 'paid'; i++) {
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

    const indexed = await db.query.transfers.findMany({
      where: and(
        eq(schema.transfers.txHash, receipt.transactionHash),
        eq(schema.transfers.toAddress, merchant.address.toLowerCase()),
      ),
    })
    expect(indexed).toHaveLength(1)
    expect(indexed[0]?.nonce).toBe(memo)
    expect(indexed[0]?.amount).toBe(amount)

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
