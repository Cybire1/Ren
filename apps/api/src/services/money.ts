import { schema, uuidv7 } from '@kova/db'
import { MONEY_SIGNATURE_MAX_AGE, type MoneyFeature, moneyActionMessage } from '@kova/tempo'
import { and, eq } from 'drizzle-orm'
import { type Address, type Hex, isAddressEqual, recoverMessageAddress } from 'viem'
import { config } from '../config.js'
import { db } from '../db.js'
import { KovaError } from '../errors.js'

/**
 * What the dollar card and cash-outs abroad share: the wallet's signature on a request that changes
 * its own account at Ren, and the list of wallets waiting for a feature that isn't switched on yet.
 */

/** Checks that the wallet itself asked for this action, recently, and nothing else. */
export async function requireWalletSignature(
  wallet: Address,
  action: string,
  signedAt: unknown,
  signature: unknown,
  detail = '',
): Promise<void> {
  if (typeof signedAt !== 'number' || !Number.isInteger(signedAt))
    throw new KovaError('invalid_request', 'Expected signed_at, in seconds.')
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature))
    throw new KovaError('invalid_request', 'Expected the wallet’s signature.')
  if (Math.abs(Date.now() / 1000 - signedAt) > MONEY_SIGNATURE_MAX_AGE)
    throw new KovaError('invalid_request', 'That was signed too long ago. Try again.')
  const signer = await recoverMessageAddress({
    message: moneyActionMessage(wallet, action, signedAt, detail),
    signature: signature as Hex,
  }).catch(() => null)
  if (!signer || !isAddressEqual(signer, wallet))
    throw new KovaError('forbidden', 'Only this wallet can do that.')
}

export async function hasRequested(wallet: Address, feature: MoneyFeature): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.moneyAccessRequests.id })
    .from(schema.moneyAccessRequests)
    .where(
      and(
        eq(schema.moneyAccessRequests.wallet, wallet.toLowerCase()),
        eq(schema.moneyAccessRequests.network, config.KOVA_NETWORK),
        eq(schema.moneyAccessRequests.feature, feature),
      ),
    )
    .limit(1)
  return Boolean(row)
}

export async function requestAccess(wallet: Address, feature: MoneyFeature): Promise<void> {
  await db
    .insert(schema.moneyAccessRequests)
    .values({
      id: uuidv7(),
      wallet: wallet.toLowerCase(),
      network: config.KOVA_NETWORK,
      feature,
    })
    .onConflictDoNothing()
}
