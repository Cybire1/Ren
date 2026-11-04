import { schema } from '@kova/db'
import {
  decodeMemo,
  decodeSwapIn,
  otherDollars,
  TRANSFER_SELECTOR,
  TRANSFER_WITH_MEMO_SELECTOR,
} from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { type Address, decodeFunctionData, type Hex, isAddressEqual } from 'viem'
import { Abis, Addresses, Selectors } from 'viem/tempo'
import { acceptedTokens, network, settlementToken } from '../chain.js'
import { config } from '../config.js'
import { db } from '../db.js'
import { takeSponsorship } from '../kv.js'
import { findIntentByMemo } from '../services/intents.js'
import { cashOutSponsorProblem } from '../services/naira.js'
import { rewardRefusal } from '../services/stamps.js'
import { zoneDepositProblem } from './zone-deposit.js'

/** A transaction as the relay hands it to `validate`: its calls plus the sender. */
export interface FillRequest {
  from?: Address | undefined
  /** A key authorization riding on the transaction: the sender putting an access key on-chain. */
  keyAuthorization?: unknown
  calls?: readonly { to?: Address | undefined; data?: Hex | undefined }[] | undefined
  to?: Address | undefined
  data?: Hex | undefined
  maxFeePerGas?: bigint | undefined
  gas?: bigint | undefined
}

export type SponsorDecision =
  | { sponsor: true; kind: 'charge' | 'send' | 'private' | 'key' | 'cashout' | 'swap' }
  | { sponsor: false; reason: string }

/** The portal of the private zone Ren pays deposits into, when one is configured. */
const zonePortal = config.KOVA_ZONE_PORTAL ? (config.KOVA_ZONE_PORTAL as Address) : null

/** Sends between people Ren pays for, per wallet per day; recorded in Postgres (kv.ts). */
const takeSend = (from: Address) => takeSponsorship(from, 'send', config.KOVA_SPONSORED_SENDS_A_DAY)

/** Key changes per wallet per day: putting keys on-chain, freezing, changing limits, removing. */
const KEY_CHANGES_A_DAY = 40
const takeKeyChange = (from: Address) => takeSponsorship(from, 'key', KEY_CHANGES_A_DAY)

/** Turning other dollars into Ren's, per wallet per day. */
const SWAPS_A_DAY = 10
/** The most dollars one transaction may turn into Ren's: one call each. */
const MAX_SWAPS = 8

/**
 * Other dollars into Ren's (packages/tempo swap.ts): every call a `swapExactAmountIn` on Tempo's
 * stablecoin exchange, each from a different dollar Ren knows into exactly Ren's own, for something,
 * with a floor. Undefined when the transaction isn't swaps at all.
 */
function swapProblem(
  calls: readonly { to?: Address | undefined; data?: Hex | undefined }[],
): string | null | undefined {
  const swaps = calls.map(decodeSwapIn)
  if (swaps.length === 0 || swaps.some((s) => s === null)) return undefined
  if (swaps.length > MAX_SWAPS) return 'too many dollars in one swap'
  const known = [
    ...otherDollars[network.id].map((d) => d.address),
    ...acceptedTokens.map((t) => t.address),
  ]
  const seen = new Set<string>()
  for (const swap of swaps) {
    if (!swap) return 'not a swap'
    if (!isAddressEqual(swap.tokenOut, settlementToken.address))
      return 'swaps go into Ren’s dollar only'
    if (isAddressEqual(swap.tokenIn, settlementToken.address)) return 'that’s already Ren’s dollar'
    if (!known.some((a) => isAddressEqual(a, swap.tokenIn))) return 'not a dollar Ren knows'
    if (swap.amountIn <= 0n || swap.minAmountOut <= 0n) return 'nothing to swap'
    if (seen.has(swap.tokenIn.toLowerCase())) return 'one call per dollar'
    seen.add(swap.tokenIn.toLowerCase())
  }
  return null
}

const ZERO = '0x0000000000000000000000000000000000000000'
const KEYCHAIN_CHANGES = [
  Selectors.accountKeychain.updateSpendingLimit,
  Selectors.accountKeychain.revokeKey,
]

/**
 * A wallet looking after its own keys (services/keys.ts): putting an access key on-chain (a key
 * authorization on an empty call, which is how viem sends it), or, on the AccountKeychain, changing
 * a key's spending limit (freezing and unfreezing) or revoking it. Only the account's root key can
 * do the last two, and the chain checks that; Ren just pays the fee, a few a day per wallet.
 */
function keyChangeProblem(
  request: FillRequest,
  calls: readonly { to?: Address | undefined; data?: Hex | undefined }[],
): string | null | undefined {
  const [call] = calls
  if (request.keyAuthorization) {
    if (
      calls.length !== 1 ||
      !call ||
      (call.to && !isAddressEqual(call.to, ZERO)) ||
      (call.data && call.data !== '0x')
    )
      return 'a key authorization is sponsored on its own'
    return null
  }
  if (
    calls.length === 1 &&
    call?.to &&
    call.data &&
    isAddressEqual(call.to, Addresses.accountKeychain)
  ) {
    if (!KEYCHAIN_CHANGES.some((selector) => call.data?.startsWith(selector)))
      return 'only limit changes and revokes on the keychain are sponsored'
    return null
  }
  return undefined
}

/**
 * Decides whether Kova pays the fee for a transaction on Tempo.
 *
 * Kova's fee payer is a live wallet: anyone who can reach the relay can ask it to spend, so the
 * rule is narrow. One call, a TIP-20 `transfer` or `transferWithMemo` of a dollar Kova accepts,
 * and then either:
 *
 * - **a charge**: the memo is an open Kova charge's, and the amount, token and recipient are
 *   exactly that charge's. A charge a stamp card made free is paid for $0, so it still has its
 *   receipt on-chain: the only transfer of nothing Kova pays for, and only from the card's owner;
 *   or
 * - **a send between people**: no Kova memo at all (a charge can only be paid through its own
 *   check above), within a daily number of sponsored sends per wallet.
 *
 * Or, when a private zone is configured, a move into it: approve and deposit exactly one amount of
 * an accepted dollar into that zone's portal (zone-deposit.ts), counted with sends.
 *
 * Everything else is refused, including transactions that would otherwise be perfectly valid.
 */
export async function shouldSponsor(
  request: FillRequest,
  options: { maxFee: bigint },
): Promise<SponsorDecision> {
  const calls = request.calls ?? (request.to ? [{ to: request.to, data: request.data }] : [])

  // A sponsor pays for reverted transactions too, so cap the fee Kova can ever be charged.
  if (request.gas && request.maxFeePerGas) {
    const worstCase = request.gas * request.maxFeePerGas
    if (worstCase > options.maxFee * 10n ** 12n)
      return { sponsor: false, reason: 'tx_fee_limit_exceeded' }
  }

  const keyChange = keyChangeProblem(request, calls)
  if (keyChange !== undefined) {
    if (keyChange) return { sponsor: false, reason: keyChange }
    if (!request.from) return { sponsor: false, reason: 'no sender' }
    if (!(await takeKeyChange(request.from)))
      return { sponsor: false, reason: 'daily key changes used up' }
    return { sponsor: true, kind: 'key' }
  }

  const swap = swapProblem(calls)
  if (swap !== undefined) {
    if (swap) return { sponsor: false, reason: swap }
    if (!request.from) return { sponsor: false, reason: 'no sender' }
    if (!(await takeSponsorship(request.from, 'swap', SWAPS_A_DAY)))
      return { sponsor: false, reason: 'daily swaps used up' }
    return { sponsor: true, kind: 'swap' }
  }

  if (calls.length === 2 && zonePortal) {
    const problem = zoneDepositProblem(
      calls,
      request.from,
      zonePortal,
      acceptedTokens.map((t) => t.address),
    )
    if (problem) return { sponsor: false, reason: problem }
    if (!(await takeSend(request.from as Address)))
      return { sponsor: false, reason: 'daily sponsored sends used up' }
    return { sponsor: true, kind: 'private' }
  }
  if (calls.length !== 1) return { sponsor: false, reason: 'expected exactly one call' }

  const call = calls[0]
  if (!call?.to || !call.data) return { sponsor: false, reason: 'call missing to/data' }
  const token = acceptedTokens.find((t) => isAddressEqual(t.address, call.to as Address))
  if (!token) return { sponsor: false, reason: 'not a dollar Ren accepts' }
  const withMemo = call.data.startsWith(TRANSFER_WITH_MEMO_SELECTOR)
  if (!withMemo && !call.data.startsWith(TRANSFER_SELECTOR))
    return { sponsor: false, reason: 'only transfers are sponsored' }

  let args: readonly unknown[]
  try {
    ;({ args } = decodeFunctionData({ abi: Abis.tip20, data: call.data }))
  } catch {
    return { sponsor: false, reason: 'undecodable call' }
  }
  const [to, amount, memo] = args as [Address, bigint, Hex | undefined]

  const kova = memo ? decodeMemo(memo) : null
  if (!kova) {
    if (amount <= 0n) return { sponsor: false, reason: 'nothing to send' }
    if (!request.from) return { sponsor: false, reason: 'no sender' }
    if (!(await takeSend(request.from)))
      return { sponsor: false, reason: 'daily sponsored sends used up' }
    return { sponsor: true, kind: 'send' }
  }
  // A cash-out: exactly its dollars, to Ren's treasury, from the wallet that asked (services/naira.ts).
  if (kova.kind === 'cashout') {
    const problem = await cashOutSponsorProblem({
      id: kova.id,
      to,
      amount,
      token: call.to,
      from: request.from,
    })
    if (problem) return { sponsor: false, reason: problem }
    return { sponsor: true, kind: 'cashout' }
  }
  if (kova.kind !== 'payment') return { sponsor: false, reason: `a ${kova.kind} is Ren's to send` }

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
  // A stamp-card reward is the card owner's alone, and a card pays for one reward.
  const refusal = await rewardRefusal(intent, request.from)
  if (refusal) return { sponsor: false, reason: refusal.message }

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
