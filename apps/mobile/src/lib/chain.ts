/**
 * Everything the phone does on Tempo, with no React Native in it, so it can be exercised
 * from Node against testnet exactly as the app runs it.
 */
import { FEE_MANAGER } from '@kova/tempo'
import {
  type Address,
  createPublicClient,
  fallback,
  type Hash,
  type Hex,
  http,
  isAddressEqual,
  type LocalAccount,
  parseAbiItem,
} from 'viem'
import { tempo, tempoModerato } from 'viem/chains'
import { Actions, createClient, withRelay } from 'viem/tempo'
import { isTestnet, network, relayUrl, settlementToken } from './config'

/**
 * Chain traffic goes to Kova's RPC endpoint first, with Tempo's public RPC as a fallback.
 * Tempo's public endpoints advertise HTTP/3; iOS remembers that per app and, on networks
 * where HTTP/3 is blocked, every later request from the app fails outright instead of falling
 * back. Kova's endpoint is under our control, so it is the dependable first hop.
 */
const rpc = () => fallback([http(relayUrl), http(network.rpcUrl)])

// The app's own viem chain object: @kova/tempo's copy is the same chain from another install.
export const publicClient = createPublicClient({
  chain: isTestnet ? tempoModerato : tempo,
  transport: rpc(),
})

const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 amount)')

export async function getBalance(address: Address): Promise<bigint> {
  const { amount } = await Actions.token.getBalance(publicClient as never, {
    account: address,
    token: settlementToken.address,
  })
  return amount
}

/** Testnet only: asks Tempo's faucet for test dollars, and waits until they land. */
export async function fundFromFaucet(address: Address): Promise<void> {
  if (!isTestnet) throw new Error('Adding money needs a card or bank on mainnet.')
  await Actions.faucet.fundSync(publicClient as never, { account: address })
}

export interface Sent {
  hash: Hash
  ms: number
}

/**
 * Pays a Kova charge. Kova's relay adds the fee payer's signature, so the payer spends
 * exactly the price and never needs gas. The relay only sponsors a transfer that matches an
 * open charge's amount, recipient, token and memo.
 */
export async function payCharge(
  account: LocalAccount,
  charge: { token: Address; payTo: Address; amount: bigint; memo: Hex },
): Promise<Sent> {
  const started = Date.now()
  const client = createClient({
    account,
    testnet: isTestnet,
    feeToken: settlementToken.address,
    transport: withRelay(rpc(), http(relayUrl)),
  })
  const { receipt } = await client.token.transferSync({
    token: charge.token,
    to: charge.payTo,
    amount: charge.amount,
    memo: charge.memo,
    feePayer: true,
  })
  if (receipt.status !== 'success') throw new Error('The payment was rejected on-chain. No money moved.')
  return { hash: receipt.transactionHash, ms: Date.now() - started }
}

/** Sends dollars to a person. The sender pays Tempo's fee, a fraction of a cent, in the same token. */
export async function sendMoney(account: LocalAccount, to: Address, amount: bigint): Promise<Sent> {
  const started = Date.now()
  const client = createClient({
    account,
    testnet: isTestnet,
    feeToken: settlementToken.address,
    transport: rpc(),
  })
  const { receipt } = await client.token.transferSync({
    token: settlementToken.address,
    to,
    amount,
  })
  if (receipt.status !== 'success') throw new Error('The transfer was rejected on-chain. No money moved.')
  return { hash: receipt.transactionHash, ms: Date.now() - started }
}

export interface Incoming {
  from: Address
  amount: bigint
  hash: Hash
  block: bigint
}

/** Dollars that arrived at `address` in blocks after `fromBlock`, excluding fee refunds. */
export async function incomingSince(
  address: Address,
  fromBlock: bigint,
): Promise<{ transfers: Incoming[]; head: bigint }> {
  const head = await publicClient.getBlockNumber()
  if (head <= fromBlock) return { transfers: [], head }
  // Keep each scan bounded; a phone that slept for a while catches up in a few steps.
  const to = fromBlock + 100_000n < head ? fromBlock + 100_000n : head
  const logs = await publicClient.getLogs({
    address: settlementToken.address,
    event: transferEvent,
    args: { to: address },
    fromBlock: fromBlock + 1n,
    toBlock: to,
  })
  return {
    head: to,
    transfers: logs
      .filter((log) => log.args.from && !isAddressEqual(log.args.from, FEE_MANAGER))
      .map((log) => ({
        from: log.args.from as Address,
        amount: log.args.amount ?? 0n,
        hash: log.transactionHash,
        block: log.blockNumber,
      })),
  }
}

export const explorerTx = (hash: string) => `${network.explorerUrl}/tx/${hash}`
