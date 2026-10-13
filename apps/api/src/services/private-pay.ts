import { createDecipheriv, createECDH, hkdfSync } from 'node:crypto'
import { type Address, decodeFunctionData, type Hex, hexToBytes, isAddressEqual, numberToBytes, parseAbi, type TransactionReceipt } from 'viem'
import { Abis, Actions } from 'viem/tempo'
import { publicClient } from '../chain.js'
import { config } from '../config.js'
import { KovaError } from '../errors.js'
import type { PaymentIntent } from './intents.js'
import { settleVerified } from './settle.js'

/**
 * Paying a Ren charge privately: the customer's dollars go into the shop's private balance on the
 * zone (Tempo Zones), so Tempo shows dollars going into the zone, never which shop took them.
 *
 * The zone credits the shop without the charge's memo, so the till can't tell from the chain which
 * charge it was. The customer's device tells Ren instead, with proof: the one-time key it sealed
 * the deposit with (its "opening"). With it Ren derives the same AES key the sequencer will,
 * decrypts this one deposit and checks it is for this shop, for exactly this amount; then it
 * settles the charge like any other payment. The opening shows Ren this one deposit and nothing
 * else, and only Ren sees it.
 */

const sandboxPortal = parseAbi([
  'function depositEncrypted(address token, uint128 amount, uint256 keyIndex, (bytes32 ephemeralPubkeyX, uint8 ephemeralPubkeyYParity, bytes ciphertext, bytes12 nonce, bytes16 tag) encrypted) returns (bytes32)',
])

interface Sealed {
  ephemeralPubkeyX: Hex
  ephemeralPubkeyYParity: number
  ciphertext: Hex
  nonce: Hex
  tag: Hex
}

interface Deposit {
  token: Address
  amount: bigint
  keyIndex: bigint
  sealed: Sealed
  /** The current portal binds the sender into the key; the sandbox portal (Zone A) doesn't. */
  current: boolean
}

function readDeposit(data: Hex): Deposit | null {
  try {
    const call = decodeFunctionData({ abi: Abis.zonePortal, data })
    if (call.functionName === 'depositEncrypted') {
      const [token, amount, keyIndex, sealed] = call.args as unknown as [Address, bigint, bigint, Sealed]
      return { token, amount, keyIndex, sealed, current: true }
    }
  } catch {}
  try {
    const call = decodeFunctionData({ abi: sandboxPortal, data })
    const [token, amount, keyIndex, sealed] = call.args as unknown as [Address, bigint, bigint, Sealed]
    return { token, amount, keyIndex, sealed, current: false }
  } catch {
    return null
  }
}

const bytes = (hex: Hex) => Buffer.from(hexToBytes(hex))

/** Opens one deposit with its one-time key: the recipient it was sealed for, or null if it doesn't open. */
function recipientOf(input: {
  deposit: Deposit
  opening: Hex
  sequencer: { prefix: number; x: Hex }
  portal: Address
  sender: Address
}): Address | null {
  const ecdh = createECDH('secp256k1')
  ecdh.setPrivateKey(bytes(input.opening))
  const ephemeral = ecdh.getPublicKey(null, 'compressed')
  // The key must be the one this deposit was sealed with, not any key the payer has.
  if (
    ephemeral[0] !== input.deposit.sealed.ephemeralPubkeyYParity ||
    !ephemeral.subarray(1).equals(bytes(input.deposit.sealed.ephemeralPubkeyX))
  )
    return null
  const sequencer = Buffer.concat([Buffer.of(input.sequencer.prefix), bytes(input.sequencer.x)])
  const shared = ecdh.computeSecret(sequencer)
  const info = Buffer.concat([
    bytes(input.portal),
    Buffer.from(numberToBytes(input.deposit.keyIndex, { size: 32 })),
    ephemeral.subarray(1),
    ...(input.deposit.current ? [bytes(input.sender)] : []),
  ])
  const key = Buffer.from(hkdfSync('sha256', shared, Buffer.from('ecies-aes-key'), info, 32))
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, bytes(input.deposit.sealed.nonce))
    decipher.setAuthTag(bytes(input.deposit.sealed.tag))
    const plain = Buffer.concat([decipher.update(bytes(input.deposit.sealed.ciphertext)), decipher.final()])
    return `0x${plain.subarray(0, 20).toString('hex')}` as Address
  } catch {
    return null
  }
}

export const privatePayReady = () => Boolean(config.KOVA_ZONE_PORTAL)

/** Checks a private payment for this charge and settles it. Once per transaction, as any payment. */
export async function settlePrivatePayment(intent: PaymentIntent, input: { txHash: Hex; opening: Hex }) {
  const portal = config.KOVA_ZONE_PORTAL as Address | undefined
  if (!portal) throw new KovaError('conflict', 'Private payments aren’t switched on for this server.')
  if (intent.status === 'paid') return { status: 'paid' as const }
  if (intent.status !== 'requires_payment') throw new KovaError('conflict', 'This charge isn’t open any more.')

  const receipt = (await publicClient.waitForTransactionReceipt({ hash: input.txHash, timeout: 30_000 })) as TransactionReceipt
  if (receipt.status !== 'success') throw new KovaError('invalid_request', 'That transaction didn’t go through.')
  const tx = (await publicClient.getTransaction({ hash: input.txHash })) as unknown as {
    from: Address
    calls?: { to?: Address; data?: Hex }[]
    to?: Address
    input?: Hex
  }
  const calls = tx.calls ?? (tx.to && tx.input ? [{ to: tx.to, data: tx.input }] : [])
  const call = calls.find((c) => c.to && c.data && isAddressEqual(c.to, portal))
  const deposit = call?.data ? readDeposit(call.data) : null
  if (!deposit) throw new KovaError('invalid_request', 'That transaction isn’t a deposit into the private zone.')
  if (!isAddressEqual(deposit.token, intent.tokenAddress as Address) || deposit.amount !== intent.amount)
    throw new KovaError('invalid_request', 'That deposit isn’t this charge’s amount.')

  const { keyIndex, publicKey } = await Actions.zone.getEncryptionKey(publicClient as never, {
    portalAddress: portal,
    zoneId: config.KOVA_ZONE_ID,
  } as never)
  if (keyIndex !== deposit.keyIndex) throw new KovaError('conflict', 'The zone changed its key since. Pay again.')
  const to = recipientOf({ deposit, opening: input.opening, sequencer: publicKey as { prefix: number; x: Hex }, portal, sender: tx.from })
  if (!to) throw new KovaError('invalid_request', 'That opening doesn’t open this deposit.')
  if (!isAddressEqual(to, intent.payTo as Address)) throw new KovaError('invalid_request', 'That deposit is for someone else.')

  const settled = await settleVerified(intent, receipt, tx.from)
  return { status: settled.status }
}
