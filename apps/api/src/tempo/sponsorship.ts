import { schema } from '@kova/db'
import { decodeMemo, TRANSFER_SELECTOR, TRANSFER_WITH_MEMO_SELECTOR } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { type Address, decodeFunctionData, type Hex, isAddressEqual } from 'viem'
import { Abis, Addresses, Selectors } from 'viem/tempo'
import { acceptedTokens } from '../chain.js'
import { config } from '../config.js'
import { db } from '../db.js'
import { findIntentByMemo } from '../services/intents.js'
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
  | { sponsor: true; kind: 'charge' | 'send' | 'private' | 'key' }
  | { sponsor: false; reason: string }

/** The portal of the private zone Ren pays deposits into, when one is configured. */
const zonePortal = config.KOVA_ZONE_PORTAL ? (config.KOVA_ZONE_PORTAL as Address) : null

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

/** Key changes per wallet in the last day: putting keys on-chain, freezing, removing. */
const keyChanges = new Map<string, number[]>()
const KEY_CHANGES_A_DAY = 40

function takeKeyChange(from: Address): boolean {
  const key = from.toLowerCase()
  const now = Date.now()
  const recent = (keyChanges.get(key) ?? []).filter((t) => now - t < DAY_MS)
  if (recent.length >= KEY_CHANGES_A_DAY) return false
  keyChanges.set(key, [...recent, now])
  return true
}

const ZERO = '0x0000000000000000000000000000000000000000'
const KEYCHAIN_CHANGES = [Selectors.accountKeychain.updateSpendingLimit, Selectors.accountKeychain.revokeKey]

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
    if (calls.length !== 1 || !call || (call.to && !isAddressEqual(call.to, ZERO)) || (call.data && call.data !== '0x'))
      return 'a key authorization is sponsored on its own'
    return null
  }
  if (calls.length === 1 && call?.to && call.data && isAddressEqual(call.to, Addresses.accountKeychain)) {
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
    if (!takeKeyChange(request.from)) return { sponsor: false, reason: 'daily key changes used up' }
    return { sponsor: true, kind: 'key' }
  }

  if (calls.length === 2 && zonePortal) {
    const problem = zoneDepositProblem(
      calls,
      request.from,
      zonePortal,
      acceptedTokens.map((t) => t.address),
    )
    if (problem) return { sponsor: false, reason: problem }
    if (!takeSend(request.from as Address))
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
    if (!takeSend(request.from)) return { sponsor: false, reason: 'daily sponsored sends used up' }
    return { sponsor: true, kind: 'send' }
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
