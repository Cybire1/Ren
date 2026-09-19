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

export interface DecodedTransfers {
  transfers: TransferEvent[]
  memos: MemoEvent[]
}

/** Decodes the TIP-20 transfer logs of one token from a receipt, ignoring everything else. */
export function decodeTransfers(
  receipt: Transaction.TransactionReceipt,
  token: Address,
): DecodedTransfers {
  const transfers: TransferEvent[] = []
  const memos: MemoEvent[] = []
  for (const log of receipt.logs) {
    if (!isAddressEqual(log.address, token)) continue
    let event: ReturnType<typeof decodeEventLog>
    try {
      event = decodeEventLog({ abi: Abis.tip20, data: log.data, topics: log.topics })
    } catch {
      continue
    }
    const args = event.args as Record<string, unknown>
    if (event.eventName === 'Transfer') {
      transfers.push({
        from: args.from as Address,
        to: args.to as Address,
        amount: args.amount as bigint,
        logIndex: log.logIndex,
      })
    } else if (event.eventName === 'TransferWithMemo') {
      memos.push({
        from: args.from as Address,
        to: args.to as Address,
        amount: args.amount as bigint,
        memo: args.memo as Hex,
        logIndex: log.logIndex,
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
