import { createHmac, randomBytes } from 'node:crypto'
import { walletSignInMessage } from '@kova/tempo'
import type { Context } from 'hono'
import { type Address, getAddress, type Hex, isAddress, isAddressEqual, recoverMessageAddress } from 'viem'
import { network } from '../chain.js'
import { KovaError } from '../errors.js'
import { keysSubkey, sameSecret } from '../secrets.js'

/**
 * A wallet signing in to Ren's API for a while, so its owner's screens (keys, approvals,
 * allowances) can read and change what's theirs without a signature for every look.
 *
 * The wallet signs one message (walletSignInMessage) naming itself, the purpose and the time; Ren
 * answers with a token bound to that wallet and this network, good for twelve hours. There is no
 * account behind it: the token is the wallet's word, checked by its HMAC, and nothing is stored.
 * Moving money still takes the wallet's own signature on the transaction.
 */

const TOKEN_TTL_MS = 12 * 60 * 60_000
/** A sign-in message is used at once; an older one is refused. */
const MESSAGE_MAX_AGE_MS = 5 * 60_000

/** Nonces seen recently, so one signed message can't sign in twice. */
const usedNonces = new Map<string, number>()

function mac(address: Address, expires: number): string {
  return createHmac('sha256', keysSubkey('wallet-token'))
    .update(`${address.toLowerCase()}:${network.chainId}:${expires}`)
    .digest('base64url')
}

export async function signInWallet(input: {
  address: Address
  message: string
  signature: Hex
}): Promise<{ token: string; expiresAt: Date }> {
  const issued = /^Issued: (.+)$/m.exec(input.message)?.[1]
  const nonce = /^Nonce: ([0-9a-f]{16,64})$/m.exec(input.message)?.[1]
  if (!issued || !nonce) throw new KovaError('invalid_request', 'That sign-in message isn’t Ren’s.')
  const expected = walletSignInMessage({ address: getAddress(input.address), issuedAt: issued, nonce })
  if (input.message !== expected) throw new KovaError('invalid_request', 'That sign-in message isn’t Ren’s.')
  const age = Date.now() - Date.parse(issued)
  if (!(age > -60_000 && age < MESSAGE_MAX_AGE_MS))
    throw new KovaError('invalid_request', 'That sign-in ran out. Try again.')

  const now = Date.now()
  for (const [n, at] of usedNonces) if (now - at > MESSAGE_MAX_AGE_MS * 2) usedNonces.delete(n)
  if (usedNonces.has(nonce)) throw new KovaError('conflict', 'That sign-in was already used.')

  const signer = await recoverMessageAddress({ message: input.message, signature: input.signature }).catch(() => null)
  if (!signer || !isAddressEqual(signer, input.address))
    throw new KovaError('forbidden', 'Only the wallet itself can sign in to its keys.')
  usedNonces.set(nonce, now)

  const expires = now + TOKEN_TTL_MS
  const address = getAddress(input.address)
  return { token: `rw.${address}.${expires}.${mac(address, expires)}`, expiresAt: new Date(expires) }
}

/** The wallet a request's token signs in, which must be `address` when the route names one. */
export function requireWallet(c: Context, address?: string): Address {
  const header = c.req.header('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const [kind, wallet, expiresText, given] = token.split('.')
  if (kind !== 'rw' || !wallet || !expiresText || !given || !isAddress(wallet))
    throw new KovaError('unauthorized', 'Sign in to your keys first.')
  const expires = Number(expiresText)
  if (!Number.isSafeInteger(expires) || expires < Date.now())
    throw new KovaError('unauthorized', 'Your sign-in ran out. Sign in again.')
  if (!sameSecret(given, mac(getAddress(wallet), expires)))
    throw new KovaError('unauthorized', 'Sign in to your keys first.')
  if (address !== undefined && (!isAddress(address) || !isAddressEqual(wallet, address)))
    throw new KovaError('forbidden', 'That’s another wallet’s.')
  return getAddress(wallet)
}

export const newNonce = () => randomBytes(16).toString('hex')
