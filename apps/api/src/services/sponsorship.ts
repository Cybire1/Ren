import { schema } from '@kova/db'
import { decodeMemo, TRANSFER_WITH_MEMO_SELECTOR } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { type Address, decodeFunctionData, isAddressEqual } from 'viem'
import { Abis } from 'viem/tempo'
import { db } from '../db.js'
import { findIntentByMemo } from './intents.js'

/** A transaction as the relay hands it to `validate`: calls plus the sender. */
interface FillRequest {
  from?: Address | undefined
  calls?: readonly { to?: Address | undefined; data?: `0x${string}` | undefined }[] | undefined
  to?: Address | undefined
  data?: `0x${string}` | undefined
  maxFeePerGas?: bigint | undefined
  gas?: bigint | undefined
}

export type SponsorDecision = { sponsor: true } | { sponsor: false; reason: string }

/**
 * Decides whether Kova pays the gas for a transaction.
 *
 * Kova's fee payer is a live wallet: anyone who can reach the relay can ask it to spend.
 * So the rule is narrow — one call, a TIP-20 `transferWithMemo`, carrying the memo of an
 * open Kova intent, for exactly that intent's amount, token and recipient. Everything else
 * is refused, including transactions that would otherwise be perfectly valid.
 */
export async function shouldSponsor(
  request: FillRequest,
  options: { maxFee: bigint },
): Promise<SponsorDecision> {
  const calls = request.calls ?? (request.to ? [{ to: request.to, data: request.data }] : [])
  if (calls.length !== 1) return { sponsor: false, reason: 'expected exactly one call' }

  const call = calls[0]
  if (!call?.to || !call.data) return { sponsor: false, reason: 'call missing to/data' }
  if (!call.data.startsWith(TRANSFER_WITH_MEMO_SELECTOR))
    return { sponsor: false, reason: 'only transferWithMemo is sponsored' }

  // A sponsor pays for reverted transactions too, so cap the fee we can ever be charged.
  if (request.gas && request.maxFeePerGas) {
    const worstCase = request.gas * request.maxFeePerGas
    if (worstCase > options.maxFee * 10n ** 12n)
      return { sponsor: false, reason: 'tx_fee_limit_exceeded' }
  }

  let args: readonly unknown[]
  try {
    ;({ args } = decodeFunctionData({ abi: Abis.tip20, data: call.data }))
  } catch {
    return { sponsor: false, reason: 'undecodable call' }
  }

  const [to, amount, memo] = args as [Address, bigint, `0x${string}`]
  if (!decodeMemo(memo)) return { sponsor: false, reason: 'not a Kova memo' }

  const intent = await findIntentByMemo(memo)
  if (!intent) return { sponsor: false, reason: 'no matching payment intent' }
  if (intent.status !== 'requires_payment')
    return { sponsor: false, reason: `intent is ${intent.status}` }
  if (intent.expiresAt.getTime() < Date.now()) return { sponsor: false, reason: 'intent expired' }
  if (amount !== intent.amount) return { sponsor: false, reason: 'amount does not match intent' }
  if (!isAddressEqual(to, intent.payTo as Address))
    return { sponsor: false, reason: 'recipient does not match intent' }
  if (!isAddressEqual(call.to, intent.tokenAddress as Address))
    return { sponsor: false, reason: 'token does not match intent' }

  // A frozen or revoked credential must not be able to spend, even though the chain would
  // also stop it: refusing here means Kova never pays gas for a doomed transaction.
  if (request.from) {
    const credential = await db.query.credentials.findFirst({
      where: eq(schema.credentials.keyId, request.from),
    })
    if (credential && credential.status !== 'active')
      return { sponsor: false, reason: `credential is ${credential.status}` }
  }

  return { sponsor: true }
}
