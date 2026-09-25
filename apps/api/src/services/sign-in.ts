import { schema, uuidv7 } from '@kova/db'
import { and, eq, gt, isNull, lt } from 'drizzle-orm'
import { type Address, getAddress, type Hex, verifyMessage } from 'viem'
import {
  createSiweMessage,
  generateSiweNonce,
  parseSiweMessage,
  validateSiweMessage,
} from 'viem/siwe'
import { generateApiKey } from '../auth.js'
import { network } from '../chain.js'
import { config, isProduction } from '../config.js'
import { db } from '../db.js'
import { KovaError } from '../errors.js'

/**
 * Signing in with a wallet (Sign-In with Ethereum, EIP-4361), so a shop's owner signs in the way
 * they opened it: with email or Google through Privy's embedded wallet, or any wallet they hold.
 *
 * Kova writes the message and remembers its nonce; the wallet signs it; Kova checks the
 * signature, the site it names, the chain, the purpose and the time, and uses the nonce up. A
 * signature is good once, on the site it was made for, for ten minutes. Checking it needs no RPC:
 * the wallets that sign here are ordinary accounts, so recovering the signer is enough.
 */

export type SignInPurpose = 'sign_in' | 'open_shop'

/** What the wallet shows its owner. The purpose is in the words, so one can't stand in for the other. */
const statements: Record<SignInPurpose, string> = {
  sign_in: 'Sign in to your shop on Kova.',
  open_shop: 'Open a shop on Kova that you sign in to with this wallet.',
}

const CHALLENGE_TTL_MS = 10 * 60_000
/** As long as the dashboard's session cookie. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000

/** The sites a wallet may sign in from, as a signed message names them (host, and port if any). */
const domains = config.KOVA_SIGN_IN_DOMAINS
  ? config.KOVA_SIGN_IN_DOMAINS.split(',')
      .map((d) => d.trim())
      .filter(Boolean)
  : [
      'mykova.app',
      'www.mykova.app',
      'web-monad.up.railway.app',
      ...(isProduction ? [] : ['localhost:3000', 'localhost:3002']),
    ]

const expired = () =>
  new KovaError('unauthorized', 'That sign-in took too long or was already used. Try again.')

export async function createChallenge(input: {
  address: Address
  domain: string
  uri: string
  purpose: SignInPurpose
}) {
  if (!domains.includes(input.domain))
    throw new KovaError('invalid_request', `Kova doesn’t sign in from ${input.domain}.`)
  const nonce = generateSiweNonce()
  const issuedAt = new Date()
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS)
  const message = createSiweMessage({
    address: input.address,
    chainId: network.chain.id,
    domain: input.domain,
    uri: input.uri,
    nonce,
    version: '1',
    statement: statements[input.purpose],
    issuedAt,
    expirationTime: expiresAt,
  })
  await db
    .insert(schema.signInChallenges)
    .values({ nonce, address: input.address.toLowerCase(), purpose: input.purpose, expiresAt })
  // Spent and stale challenges are only clutter after a day.
  void db
    .delete(schema.signInChallenges)
    .where(lt(schema.signInChallenges.expiresAt, new Date(Date.now() - 86_400_000)))
    .catch(() => {})
  return { message, expiresAt }
}

/**
 * Checks a signed challenge and says which wallet signed it. It doesn't use the challenge up, so
 * a caller can still ask which shop to open; `spendChallenge` does, once the caller acts on it.
 */
export async function verifyChallenge(input: {
  message: string
  signature: Hex
  purpose: SignInPurpose
}) {
  let fields: ReturnType<typeof parseSiweMessage>
  try {
    fields = parseSiweMessage(input.message)
  } catch {
    throw new KovaError('invalid_request', 'That isn’t a Kova sign-in message.')
  }
  const { address, nonce, domain } = fields
  if (!address || !nonce || !domain || fields.statement !== statements[input.purpose])
    throw new KovaError('invalid_request', 'That isn’t a Kova sign-in message.')
  if (!domains.includes(domain) || fields.chainId !== network.chain.id)
    throw new KovaError('invalid_request', 'That sign-in was made for another site.')
  if (!validateSiweMessage({ message: fields, time: new Date() })) throw expired()

  const signed = await verifyMessage({
    address,
    message: input.message,
    signature: input.signature,
  }).catch(() => false)
  if (!signed) throw new KovaError('unauthorized', 'That signature isn’t from this wallet.')

  const challenge = await db.query.signInChallenges.findFirst({
    where: and(
      eq(schema.signInChallenges.nonce, nonce),
      eq(schema.signInChallenges.address, address.toLowerCase()),
      eq(schema.signInChallenges.purpose, input.purpose),
      isNull(schema.signInChallenges.usedAt),
      gt(schema.signInChallenges.expiresAt, new Date()),
    ),
  })
  if (!challenge) throw expired()
  return { address: getAddress(address), nonce }
}

/** Spends a verified challenge. Of two requests racing with one signature, only one gets past this. */
export async function spendChallenge(nonce: string): Promise<void> {
  const [spent] = await db
    .update(schema.signInChallenges)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.signInChallenges.nonce, nonce),
        isNull(schema.signInChallenges.usedAt),
        gt(schema.signInChallenges.expiresAt, new Date()),
      ),
    )
    .returning({ nonce: schema.signInChallenges.nonce })
  if (!spent) throw expired()
}

/**
 * A key for one signed-in browser. It acts as the shop, like a secret key, but lapses with the
 * session, is revoked on sign-out, and isn't listed among the shop's keys.
 */
export async function openSession(merchant: typeof schema.merchants.$inferSelect) {
  const key = generateApiKey(merchant.isTest)
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  const [row] = await db
    .insert(schema.apiKeys)
    .values({
      id: uuidv7(),
      merchantId: merchant.id,
      name: 'Signed-in browser',
      prefix: key.prefix,
      secretHash: key.secretHash,
      scopes: ['payments:read', 'payments:write', 'account:admin'],
      isTest: merchant.isTest,
      expiresAt,
    })
    .returning()
  if (!row) throw new KovaError('internal', 'Could not sign in')
  return { id: row.id, secret: key.secret, expiresAt }
}
