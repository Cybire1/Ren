import { schema } from '@kova/db'
import { decodeMemo, TRANSFER_SELECTOR, TRANSFER_WITH_MEMO_SELECTOR } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { type Address, decodeFunctionData, type Hex, isAddressEqual } from 'viem'
import { Abis } from 'viem/tempo'
import { acceptedTokens } from '../chain.js'
import { config } from '../config.js'
import { db } from '../db.js'
import { findIntentByMemo } from '../services/intents.js'

/** A transaction as the relay hands it to `validate`: its calls plus the sender. */
export interface FillRequest {
  from?: Address | undefined
  calls?: readonly { to?: Address | undefined; data?: Hex | undefined }[] | undefined
  to?: Address | undefined
  data?: Hex | undefined
  maxFeePerGas?: bigint | undefined
  gas?: bigint | undefined
}

export type SponsorDecision =
  | { sponsor: true; kind: 'charge' | 'send' }
  | { sponsor: false; reason: string }

/** Sponsored sends per wallet in the last day. In memory: a restart forgets, and that only costs Kova fees. */
const sends = new Map<string, number[]>()
const DAY_MS = 86_400_000

function takeSend(from: Address): boolean {
  const key = from.toLowerCase()
  const now = Date.now()
  const recent = (sends.get(key) ?? []).filter((t) => now - t < DAY_MS)
  if (recent.length >= config.KOVA_SPONSORED_SENDS_A_DAY) return false
  sends.set(key, [...recent, now])
  return true
}

/**
 * Decides whether Kova pays the fee for a transaction on Tempo.
 *
 * Kova's fee payer is a live wallet: anyone who can reach the relay can ask it to spend, so the
 * rule is narrow. One call, a TIP-20 `transfer` or `transferWithMemo` of a dollar Kova accepts,
 * and then either:
 *
 * - **a charge**: the memo is an open Kova charge's, and the amount, token and recipient are
 *   exactly that charge's; or
 * - **a send between people**: no Kova memo at all (a charge can only be paid through its own
 *   check above), within a daily number of sponsored sends per wallet.
 *
 * Everything else is refused, including transactions that would otherwise be perfectly valid.
 */
export async function shouldSponsor(
  request: FillRequest,
  options: { maxFee: bigint },
): Promise<SponsorDecision> {
  const calls = request.calls ?? (request.to ? [{ to: request.to, data: request.data }] : [])
  if (calls.length !== 1) return { sponsor: false, reason: 'expected exactly one call' }

  const call = calls[0]
  if (!call?.to || !call.data) return { sponsor: false, reason: 'call missing to/data' }
  const token = acceptedTokens.find((t) => isAddressEqual(t.address, call.to as Address))
  if (!token) return { sponsor: false, reason: 'not a dollar Kova accepts' }
  const withMemo = call.data.startsWith(TRANSFER_WITH_MEMO_SELECTOR)
  if (!withMemo && !call.data.startsWith(TRANSFER_SELECTOR))
    return { sponsor: false, reason: 'only transfers are sponsored' }

  // A sponsor pays for reverted transactions too, so cap the fee Kova can ever be charged.
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
  const [to, amount, memo] = args as [Address, bigint, Hex | undefined]
  if (amount <= 0n) return { sponsor: false, reason: 'nothing to send' }

  const kova = memo ? decodeMemo(memo) : null
  if (!kova) {
    if (!request.from) return { sponsor: false, reason: 'no sender' }
    if (!takeSend(request.from)) return { sponsor: false, reason: 'daily sponsored sends used up' }
    return { sponsor: true, kind: 'send' }
  }
  if (kova.kind !== 'payment') return { sponsor: false, reason: `a ${kova.kind} is Kova's to send` }

  const intent = await findIntentByMemo(memo as Hex)
  if (!intent) return { sponsor: false, reason: 'no matching charge' }
  if (intent.status !== 'requires_payment')
    return { sponsor: false, reason: `charge is ${intent.status}` }
  if (intent.expiresAt.getTime() < Date.now()) return { sponsor: false, reason: 'charge expired' }
  if (amount !== intent.amount)
    return { sponsor: false, reason: 'amount does not match the charge' }
  if (!isAddressEqual(to, intent.payTo as Address))
    return { sponsor: false, reason: 'recipient does not match the charge' }
  if (!isAddressEqual(call.to, intent.tokenAddress as Address))
    return { sponsor: false, reason: 'token does not match the charge' }

  // A frozen or revoked credential (a Kova Card, a session key) must not spend, even though the
  // chain would also stop it: refusing here means Kova never pays for a doomed transaction.
  if (request.from) {
    const credential = await db.query.credentials.findFirst({
      where: eq(schema.credentials.keyId, request.from),
    })
    if (credential && credential.status !== 'active')
      return { sponsor: false, reason: `credential is ${credential.status}` }
  }
  return { sponsor: true, kind: 'charge' }
}
