import { type Address, decodeEventLog, encodeFunctionData, type Hex, isAddressEqual } from 'viem'
import { Abis, Addresses, type Transaction } from 'viem/tempo'
import { decodeMemo, type KovaMemo } from './memo.js'

/** TIP-20 `transferWithMemo(address,uint256,bytes32)`. The docs' Go/Python selector is wrong. */
export const TRANSFER_WITH_MEMO_SELECTOR = '0x95777d59' as const
export const TRANSFER_SELECTOR = '0xa9059cbb' as const

/** Payments blocked by a recipient's receive policy are redirected here, and still succeed. */
export const RECEIVE_POLICY_GUARD = Addresses.receivePolicyGuard
/** Every receipt carries a fee Transfer to the FeeManager. Never count it as a payment. */
export const FEE_MANAGER = Addresses.feeManager

export interface TransferCall {
  to: Address
  data: Hex
  value: 0n
}

/** Builds the single call every Kova payment, refund and payout is made of. */
export function transferWithMemoCall(params: {
  token: Address
  to: Address
  amount: bigint
  memo: Hex
}): TransferCall {
  return {
    to: params.token,
    data: encodeFunctionData({
      abi: Abis.tip20,
      functionName: 'transferWithMemo',
      args: [params.to, params.amount, params.memo],
    }),
    value: 0n,
  }
}

export interface TransferEvent {
  from: Address
  to: Address
  amount: bigint
  logIndex: number
}

export interface MemoEvent extends TransferEvent {
  memo: Hex
}

/** The fields of a log this module reads, so receipts and `eth_getLogs` results both fit. */
export interface LogLike {
  address: Address
  data: Hex
  topics: readonly Hex[] | [Hex, ...Hex[]] | []
  logIndex: number | null
}

export interface DecodedTransfers {
  transfers: TransferEvent[]
  memos: MemoEvent[]
}

/** Decodes the TIP-20 transfer logs of one token from a receipt, ignoring everything else. */
export function decodeTransfers(
  receipt: Transaction.TransactionReceipt,
  token: Address,
): DecodedTransfers {
  return decodeTransferLogs(receipt.logs, token)
}

/** The same, for logs from anywhere: a receipt, or an `eth_getLogs` scan. */
export function decodeTransferLogs(logs: readonly LogLike[], token: Address): DecodedTransfers {
  const transfers: TransferEvent[] = []
  const memos: MemoEvent[] = []
  for (const log of logs) {
    if (!isAddressEqual(log.address, token)) continue
    let event: ReturnType<typeof decodeEventLog>
    try {
      event = decodeEventLog({ abi: Abis.tip20, data: log.data, topics: log.topics as never })
    } catch {
      continue
    }
    const args = event.args as Record<string, unknown>
    if (event.eventName === 'Transfer') {
      transfers.push({
        from: args.from as Address,
        to: args.to as Address,
        amount: args.amount as bigint,
        logIndex: log.logIndex ?? -1,
      })
    } else if (event.eventName === 'TransferWithMemo') {
      memos.push({
        from: args.from as Address,
        to: args.to as Address,
        amount: args.amount as bigint,
        memo: args.memo as Hex,
        logIndex: log.logIndex ?? -1,
      })
    }
  }
  return { transfers, memos }
}

export type PaymentStatus =
  | 'paid'
  /** Submitted but not yet included: `eth_sendRawTransactionSync` timed out. Keep watching. */
  | 'pending'
  /** Included but reverted: an access-key scope/limit violation, a paused token, a policy block. */
  | 'failed'
  /** Succeeded on-chain, but the recipient's receive policy sent the funds to the guard. */
  | 'held'
  /** Succeeded, but no transfer in it matches what we expected. */
  | 'unmatched'
  /** The transfer matched, but the memo did not. */
  | 'memo_mismatch'

export interface ExpectedPayment {
  token: Address
  /** Where the money must end up: the merchant's settlement address. */
  merchant: Address
  /** Where the payer sends: `merchant`, or a virtual address that forwards to it. */
  payTo?: Address
  amount: bigint
  memo?: Hex
}

export interface PaymentVerdict {
  status: PaymentStatus
  payer?: Address
  memo?: KovaMemo | null
}

/**
 * Decides whether a receipt actually paid a merchant (docs/tempo/03 §3).
 *
 * A successful receipt is not enough: since T6 a blocked transfer still succeeds, with the
 * funds redirected to the ReceivePolicyGuard. Virtual-address payments land in two hops.
 * Callers must also check the receipt's block is finalized, and that memo, amount and token
 * match a payment intent they opened.
 */
export function verifyPayment(
  receipt: Transaction.TransactionReceipt,
  expected: ExpectedPayment,
): PaymentVerdict {
  if (receipt.status === 'pending') return { status: 'pending' }
  if (receipt.status !== 'success') return { status: 'failed' }

  const payTo = expected.payTo ?? expected.merchant
  const { transfers, memos } = decodeTransfers(receipt, expected.token)

  if (
    transfers.some(
      (t) => isAddressEqual(t.to, RECEIVE_POLICY_GUARD) && t.amount === expected.amount,
    )
  )
    return { status: 'held' }

  const inbound = transfers.find(
    (t) =>
      isAddressEqual(t.to, payTo) &&
      t.amount === expected.amount &&
      !isAddressEqual(t.from, FEE_MANAGER),
  )
  if (!inbound) return { status: 'unmatched' }

  // Virtual address: the precompile forwards to the master in the same transaction.
  if (!isAddressEqual(payTo, expected.merchant)) {
    const forwarded = transfers.some(
      (t) =>
        isAddressEqual(t.from, payTo) &&
        isAddressEqual(t.to, expected.merchant) &&
        t.amount === expected.amount,
    )
    if (!forwarded) return { status: 'unmatched' }
  }

  if (expected.memo) {
    const match = memos.find(
      (m) => m.memo.toLowerCase() === expected.memo?.toLowerCase() && m.amount === expected.amount,
    )
    if (!match) return { status: 'memo_mismatch', payer: inbound.from }
  }

  return {
    status: 'paid',
    payer: inbound.from,
    memo: expected.memo ? decodeMemo(expected.memo) : undefined,
  }
}

/** One movement of money for an index: who paid whom, and the Kova memo it carried, if any. */
export interface IndexedTransfer {
  from: Address
  to: Address
  value: bigint
  logIndex: number
  memo: Hex | null
}

/**
 * Every transfer of one token in one transaction's logs, each paired with its memo.
 *
 * `transferWithMemo` emits a `Transfer` and a `TransferWithMemo` for the same movement; the
 * memo is attached to the transfer with the same sender, recipient and amount. Fee movements to
 * and from the FeeManager are not anyone's payment, so they are left out.
 */
export function decodeIndexedTransfers(
  logs: readonly LogLike[],
  token: Address,
): IndexedTransfer[] {
  const { transfers, memos } = decodeTransferLogs(logs, token)
  const unclaimed = [...memos]
  const out: IndexedTransfer[] = []
  for (const t of transfers) {
    if (isAddressEqual(t.from, FEE_MANAGER) || isAddressEqual(t.to, FEE_MANAGER)) continue
    const index = unclaimed.findIndex(
      (m) => isAddressEqual(m.from, t.from) && isAddressEqual(m.to, t.to) && m.amount === t.amount,
    )
    const memo = index >= 0 ? (unclaimed.splice(index, 1)[0]?.memo ?? null) : null
    out.push({ from: t.from, to: t.to, value: t.amount, logIndex: t.logIndex, memo })
  }
  return out
}

/** The Kova memos carried by a transaction's logs, in any accepted token. */
export function memosIn(logs: readonly LogLike[]): Hex[] {
  const found: Hex[] = []
  for (const log of logs) {
    try {
      const event = decodeEventLog({ abi: Abis.tip20, data: log.data, topics: log.topics as never })
      if (event.eventName !== 'TransferWithMemo') continue
      const memo = (event.args as { memo: Hex }).memo
      if (decodeMemo(memo)) found.push(memo)
    } catch {}
  }
  return found
}
