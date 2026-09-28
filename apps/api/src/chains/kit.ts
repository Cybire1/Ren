import type { AbiEvent, Address, Chain, Hash, Hex, Log, TransactionReceipt } from 'viem'

/**
 * What the API needs from a chain, so one codebase serves Kova on Tempo and Kova on Monad.
 *
 * A deployment runs on one chain, picked by KOVA_CHAIN. Everything that differs between the two
 * (tokens, how a transfer carries Kova's memo, how a payment is checked) sits behind this, and
 * the rest of the API (charges, stalls, orders, travel, the ledger) never asks which it is.
 */

export type ChainName = 'tempo' | 'monad'

/** Every dollar Kova settles in on some chain (the database's currency enum). */
export type Currency = 'USDC' | 'pathUSD' | 'USDT0' | 'AUSD'
export type NetworkId = 'mainnet' | 'testnet'

export interface KitNetwork {
  id: NetworkId
  /** What people see: "Tempo testnet", "Monad". */
  name: string
  chain: Chain
  chainId: number
  rpcUrl: string
  explorerUrl: string
}

export interface KitToken {
  currency: Currency
  symbol: string
  address: Address
  decimals: number
  /** EIP-712 signing domain, for chains where payers sign authorizations (Monad). */
  domain?: { name: string; version: string }
}

/**
 * One movement of money for the wallet index, with what it carried: the Kova memo on Tempo, the
 * EIP-3009 nonce on Monad (a Kova memo when it paid a charge, random otherwise).
 */
export interface IndexedTransfer {
  from: Address
  to: Address
  value: bigint
  logIndex: number
  memo: Hex | null
}

export interface ExpectedPayment {
  token: Address
  payTo: Address
  amount: bigint
  memo: Hex
}

export interface PaymentVerdict {
  status: 'paid' | 'pending' | 'failed' | 'held' | 'unmatched' | 'memo_mismatch'
  payer?: Address
}

export interface ChainKit {
  id: ChainName
  /** The chain's name as the product shows it: "Tempo" or "Monad". */
  name: string
  network: KitNetwork
  currencies: readonly [Currency, ...Currency[]]
  defaultCurrency: Currency
  /** Every dollar Kova accepts. A transfer in anything else is not a Kova payment. */
  tokens: KitToken[]
  getToken: (currency?: string) => KitToken
  tokenByAddress: (address: Address) => KitToken | undefined
  /** Blocks per log query the chain's RPCs answer. */
  logRange: bigint
  /** The token events the watcher scans for. */
  watchEvents: readonly AbiEvent[]
  /** Transfers of one token within one transaction's logs, each with its memo. */
  indexTransfers: (logs: readonly Log[], token: Address) => IndexedTransfer[]
  /** The Kova memos a transaction's logs carry: the charges it pays, refunds it makes. */
  memos: (logs: readonly Log[]) => Hex[]
  /** Whether a receipt paid exactly what a charge asked for. */
  verifyPayment: (receipt: TransactionReceipt, expected: ExpectedPayment) => PaymentVerdict
  /** Test dollars a wallet may take from Kova's testnet treasury each day. */
  testDollarsADay: bigint
  /** Senders whose transfers are test dollars rather than a person paying (public faucets). */
  faucets: Address[]
  explorerTxUrl: (hash: Hash) => string
  explorerAddressUrl: (address: string) => string
}
