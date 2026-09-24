import { type Address, decodeEventLog, type Hex, isAddressEqual, type Log, type TransactionReceipt } from 'viem'
import { eip3009Abi } from './authorization.js'

export interface AuthorizedTransfer {
  authorizer: Address
  nonce: Hex
  to: Address
  value: bigint
  /** The AuthorizationUsed log. */
  logIndex: number
  /** The Transfer log it authorized. */
  transferLogIndex: number
}

/**
 * Pairs each AuthorizationUsed in a receipt with the Transfer it authorized: same token, same
 * sender, and the closest such Transfer in log order, each Transfer used once. The token emits
 * the two side by side, so a batch of several authorizations from one payer still pairs up
 * exactly. Anything else in the receipt is ignored.
 */
export function decodeAuthorizedTransfers(logs: readonly Log[], token: Address): AuthorizedTransfer[] {
  const used: { authorizer: Address; nonce: Hex; logIndex: number }[] = []
  const transfers: { from: Address; to: Address; value: bigint; logIndex: number }[] = []
  logs.forEach((log, position) => {
    if (!isAddressEqual(log.address, token)) return
    const logIndex = log.logIndex ?? position
    try {
      const event = decodeEventLog({ abi: eip3009Abi, data: log.data, topics: log.topics })
      if (event.eventName === 'AuthorizationUsed') used.push({ ...event.args, logIndex })
      else if (event.eventName === 'Transfer') transfers.push({ ...event.args, logIndex })
    } catch {
      // Not an event this token's ABI knows.
    }
  })
  const taken = new Set<number>()
  return used.flatMap((u) => {
    let best: (typeof transfers)[number] | undefined
    for (const t of transfers) {
      if (taken.has(t.logIndex) || !isAddressEqual(t.from, u.authorizer)) continue
      if (!best || Math.abs(t.logIndex - u.logIndex) < Math.abs(best.logIndex - u.logIndex)) best = t
    }
    if (!best) return []
    taken.add(best.logIndex)
    return [{ authorizer: u.authorizer, nonce: u.nonce, to: best.to, value: best.value, logIndex: u.logIndex, transferLogIndex: best.logIndex }]
  })
}

export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'unmatched' | 'memo_mismatch'

export interface ExpectedPayment {
  token: Address
  /** The merchant's settlement address. */
  payTo: Address
  amount: bigint
  /** The charge's Kova memo, which the authorization's nonce must equal. */
  memo: Hex
}

export interface PaymentVerdict {
  status: PaymentStatus
  payer?: Address
}

/**
 * Decides whether a receipt paid a charge: an authorization whose nonce is the charge's memo,
 * moving exactly the amount, in the right token, to the merchant. A transfer that matches on
 * everything but the memo is reported, never counted.
 */
export function verifyPayment(receipt: Pick<TransactionReceipt, 'status' | 'logs'>, expected: ExpectedPayment): PaymentVerdict {
  if (receipt.status !== 'success') return { status: 'failed' }
  const moves = decodeAuthorizedTransfers(receipt.logs, expected.token)
  const exact = moves.find((m) => m.nonce.toLowerCase() === expected.memo.toLowerCase())
  if (exact) {
    if (!isAddressEqual(exact.to, expected.payTo) || exact.value !== expected.amount) return { status: 'unmatched' }
    return { status: 'paid', payer: exact.authorizer }
  }
  const lookalike = moves.find((m) => isAddressEqual(m.to, expected.payTo) && m.value === expected.amount)
  return lookalike ? { status: 'memo_mismatch', payer: lookalike.authorizer } : { status: 'unmatched' }
}
