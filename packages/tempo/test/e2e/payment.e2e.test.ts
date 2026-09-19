import { generateKeyPairSync, sign as nodeSign } from 'node:crypto'
import { PublicKey } from 'ox'
import { type Hex, parseUnits } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Account, Actions, createClient, http, withRelay } from 'viem/tempo'
import { beforeAll, describe, expect, it } from 'vitest'
import { cardAccount, keyIdFromPublicKey, normalizeCardSignature } from '../../src/card.js'
import { encodeMemo } from '../../src/memo.js'
import { getNetwork } from '../../src/networks.js'
import { verifyPayment } from '../../src/payment.js'
import { getToken } from '../../src/tokens.js'

/**
 * Live proof on Moderato testnet. Everything here is free: the faucet funds accounts and
 * Tempo runs a keyless fee sponsor. Run with `pnpm test:e2e`.
 *
 * It proves the whole Kova payment path end to end:
 *   1. a sponsored `transferWithMemo` from a user account, verified with `verifyPayment`
 *   2. the same payment signed by a simulated Kova Card access key, with on-chain limits
 *   3. a reversible freeze (spending limit -> 0) blocking the next tap
 */

const testnet = getNetwork('testnet')
const token = getToken('testnet', 'USDC') // AlphaUSD: the Moderato validators' fee token
const uuid = () => crypto.randomUUID()

/** Stand-in for the card's secure element: SHA-256 + ECDSA P-256, DER out, key never exported. */
function simulatedCard() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const jwk = publicKey.export({ format: 'jwk' })
  const x = Buffer.from(jwk.x as string, 'base64url').toString('hex')
  const y = Buffer.from(jwk.y as string, 'base64url').toString('hex')
  return {
    publicKey: `0x04${x}${y}` as Hex,
    sign: async (digest: Hex): Promise<Hex> =>
      `0x${nodeSign('sha256', Buffer.from(digest.slice(2), 'hex'), privateKey).toString('hex')}`,
  }
}

describe('Moderato payment', () => {
  const user = privateKeyToAccount(generatePrivateKey())
  const merchant = privateKeyToAccount(generatePrivateKey()).address
  const sponsor = privateKeyToAccount(generatePrivateKey())

  // The user signs; Tempo's public testnet sponsor pays the fees.
  const client = createClient({
    account: user,
    testnet: true,
    feeToken: token.address,
    transport: withRelay(http(testnet.rpcUrl), http(testnet.publicSponsorUrl)),
  })

  beforeAll(async () => {
    await Actions.faucet.fund(client, { account: user.address })
    // The faucet mints in its own transactions; wait until the balance lands.
    for (let i = 0; i < 30; i++) {
      const balance = await Actions.token.getBalance(client, {
        account: user.address,
        token: token.address,
      })
      if (balance.amount > 0n) return
      await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error('faucet did not fund the account')
  }, 60_000)

  it('settles a sponsored payment and verifies the receipt', async () => {
    const amount = parseUnits('4.50', 6)
    const memo = encodeMemo({ kind: 'payment', id: uuid() })

    const started = Date.now()
    const { receipt } = await client.token.transferSync({
      token: token.address,
      to: merchant,
      amount,
      memo,
      feePayer: true,
    })
    const elapsed = Date.now() - started

    expect(receipt.status).toBe('success')
    expect(verifyPayment(receipt, { token: token.address, merchant, amount, memo })).toMatchObject({
      status: 'paid',
      payer: user.address,
    })
    // Someone other than the payer paid the gas.
    expect(receipt.feePayer?.toLowerCase()).not.toBe(user.address.toLowerCase())
    console.log(
      `sponsored payment: ${receipt.gasUsed} gas, ${elapsed}ms, ${testnet.explorerUrl}/tx/${receipt.transactionHash}`,
    )
  }, 60_000)

  it('pays with a card access key, then blocks the tap after a freeze', async () => {
    const card = simulatedCard()
    const keyId = keyIdFromPublicKey(card.publicKey)

    // The cardholder authorizes the card's public key: $50/day, transfers of this token only.
    await Actions.accessKey.authorizeSync(client, {
      accessKey: { publicKey: card.publicKey, type: 'p256' },
      expiry: Math.floor(Date.now() / 1000) + 3600,
      limits: [{ token: token.address, limit: parseUnits('50', 6), period: 86_400 }],
      scopes: [
        {
          address: token.address,
          selector: 'transferWithMemo(address,uint256,bytes32)' as const,
        },
      ],
    })

    const key = await Actions.accessKey.getMetadata(client, {
      account: user.address,
      accessKey: keyId,
    })
    expect(key.keyType).toBe('p256') // not webAuthn: the stored type must match the signature
    expect(key.isRevoked).toBe(false)

    // The terminal builds the payment; the card signs; Kova sponsors.
    const posClient = createClient({
      account: cardAccount({
        publicKey: card.publicKey,
        userAccount: user.address,
        sign: card.sign,
      }),
      testnet: true,
      feeToken: token.address,
      transport: withRelay(http(testnet.rpcUrl), http(testnet.publicSponsorUrl)),
    })

    const amount = parseUnits('1.00', 6)
    const memo = encodeMemo({ kind: 'payment', id: uuid() })
    const { receipt } = await posClient.token.transferSync({
      token: token.address,
      to: merchant,
      amount,
      memo,
      feePayer: true,
    })
    expect(verifyPayment(receipt, { token: token.address, merchant, amount, memo }).status).toBe(
      'paid',
    )
    console.log(
      `card tap: ${receipt.gasUsed} gas, ${testnet.explorerUrl}/tx/${receipt.transactionHash}`,
    )

    // Reversible freeze: set the spending limit to zero. Revoking would be permanent.
    await Actions.accessKey.updateLimitSync(client, {
      accessKey: keyId,
      token: token.address,
      limit: 0n,
    })

    await expect(
      posClient.token.transferSync({
        token: token.address,
        to: merchant,
        amount,
        memo: encodeMemo({ kind: 'payment', id: uuid() }),
        feePayer: true,
      }),
    ).rejects.toThrow()

    void sponsor
    void normalizeCardSignature
    void Account
    void PublicKey
  }, 120_000)
})
