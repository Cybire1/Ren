import { config } from '../config.js'
import { KovaError } from '../errors.js'

/**
 * Bringing dollars from another chain, with Aurora Intents (powered by NEAR Intents).
 *
 * Each Kova wallet gets a permanent deposit address per kind of chain: one for every EVM chain
 * (Ethereum, Base, Arbitrum, BNB, Polygon, Optimism, Avalanche…), one for Solana, Tron and Bitcoin.
 * Whatever lands there (USDC, USDT, ETH, SOL, BTC) is swapped by NEAR Intents solvers and arrives
 * in the wallet on Monad as dollars. Kova holds nothing: the address belongs to an Intents account
 * whose only destination is the wallet, fixed when the address is made.
 *
 * Intents runs on mainnets only, so on testnet this answers "mainnet only" instead of an address.
 */
const AURORA = 'https://intents-api.aurora.dev/api'

/** Where money can come from: Aurora's chain codes, and what to tell people to send. */
export const SOURCES = {
  evm: {
    name: 'Ethereum & EVM chains',
    chains: ['Ethereum', 'Base', 'Arbitrum', 'BNB Chain', 'Polygon', 'Optimism', 'Avalanche'],
    send: ['USDC', 'USDT', 'ETH'],
  },
  sol: { name: 'Solana', chains: ['Solana'], send: ['USDC', 'USDT', 'SOL'] },
  tron: { name: 'Tron', chains: ['Tron'], send: ['USDT', 'TRX'] },
  btc: { name: 'Bitcoin', chains: ['Bitcoin'], send: ['BTC'] },
} as const

export type Source = keyof typeof SOURCES
export const isSource = (value: unknown): value is Source =>
  typeof value === 'string' && value in SOURCES

export interface DepositAddress {
  source: Source
  address: string
  memo: string | null
}

export interface Deposit {
  /** The transaction on the source chain, or on Monad once it has arrived. */
  tx_hash: string
  /** seen: reached the Intents account and is being swapped; arrived: landed in the wallet on Monad; failed. */
  status: 'seen' | 'arrived' | 'failed'
  chain: string | null
  /** Human amount, in the asset's own units. */
  amount: string
  asset: string | null
  at: string
}

function requireLive(): string {
  if (config.KOVA_NETWORK !== 'mainnet')
    throw new KovaError(
      'conflict',
      'Deposits from other chains run on Monad mainnet, where NEAR Intents has its liquidity.',
      { mainnet_only: true },
    )
  if (!config.AURORA_INTENTS_KEY)
    throw new KovaError(
      'chain_error',
      'Deposits from other chains aren’t switched on for this server yet.',
    )
  return config.AURORA_INTENTS_KEY
}

async function aurora<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${AURORA}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null)
  if (!response)
    throw new KovaError('chain_error', 'Aurora Intents didn’t answer. Try again in a moment.')
  const body = (await response.json().catch(() => ({}))) as T & { message?: string }
  if (response.status === 403)
    throw new KovaError('chain_error', 'Kova isn’t approved for permanent deposit addresses yet.')
  if (response.status === 429)
    throw new KovaError('rate_limited', 'Busy making addresses. Try again in a moment.')
  if (!response.ok) {
    console.error('[deposits]', response.status, path.split('/')[1], body.message)
    throw new KovaError(
      'chain_error',
      'Aurora Intents couldn’t do that just now. Try again in a moment.',
    )
  }
  return body
}

/** The wallet's permanent deposit address for one kind of chain. The same inputs always give the same address. */
export async function depositAddress(wallet: string, source: Source): Promise<DepositAddress> {
  const key = requireLive()
  const made = await aurora<{ depositAddress: string; memo?: string }>(
    `/persistent-deposit-address/${key}`,
    {
      method: 'POST',
      body: JSON.stringify({
        recipient: wallet,
        // One address per wallet: the wallet is both who it's for and where it lands.
        sender: wallet.toLowerCase(),
        depositChain: source,
        destinationChain: 'monad',
        destinationAsset: config.AURORA_DESTINATION_ASSET,
      }),
    },
  )
  return { source, address: made.depositAddress, memo: made.memo ?? null }
}

interface AuroraDeposit {
  tx_hash: string
  fromChain?: string | null
  destinationChain?: string | null
  asset_id: string | null
  decimals: number | null
  amount: string
  created_at: string
}

/** "nep141:base-0x8335…omft.near" → "base"; "nep141:sol-5ce3…omft.near" → "sol". */
const chainOf = (assetId: string | null) => assetId?.match(/^nep\d+:([a-z]+)[-.]/)?.[1] ?? null

/** Base units to a human amount, without floating point. */
export function units(amount: string, decimals: number | null): string {
  if (decimals === null || !/^\d+$/.test(amount)) return amount
  const padded = amount.padStart(decimals + 1, '0')
  const whole = padded.slice(0, padded.length - decimals)
  const fraction = padded
    .slice(padded.length - decimals)
    .slice(0, 6)
    .replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

/** What has come in through a deposit address: seen on the way, arrived on Monad, or failed. */
export async function depositsTo(address: string): Promise<Deposit[]> {
  const key = requireLive()
  const query = (type: string) =>
    `/persistent-deposit-status/${key}?type=${type}&address=${encodeURIComponent(address)}&limit=20`
  const [received, arrived, failed] = await Promise.all(
    ['received', 'success', 'failed'].map((type) =>
      aurora<{ deposits: AuroraDeposit[] }>(query(type)).then((r) => r.deposits),
    ),
  )
  const shape =
    (status: Deposit['status']) =>
    (d: AuroraDeposit): Deposit => ({
      tx_hash: d.tx_hash,
      status,
      chain: d.fromChain ?? d.destinationChain ?? chainOf(d.asset_id),
      amount: units(d.amount, d.decimals),
      asset: d.asset_id,
      at: d.created_at,
    })
  // A deposit is "seen" until as many withdrawals have landed as deposits came in.
  const done = (arrived?.length ?? 0) + (failed?.length ?? 0)
  const pending = (received ?? []).slice(0, Math.max(0, (received?.length ?? 0) - done))
  return [
    ...pending.map(shape('seen')),
    ...(arrived ?? []).map(shape('arrived')),
    ...(failed ?? []).map(shape('failed')),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}
