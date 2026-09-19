import { type Address, formatUnits, getAddress, isAddressEqual, parseUnits } from 'viem'
import type { NetworkId } from './networks.js'

/** Every TIP-20 token has 6 decimals (TIP-20 spec). */
export const TIP20_DECIMALS = 6

/**
 * Currencies Kova exposes in its API. `USDC` is the product-level name; on Tempo it settles
 * as a concrete TIP-20 that differs per network (docs/tempo/01 §4, DECISIONS D-002).
 */
export const currencies = ['USDC', 'pathUSD', 'USDT0'] as const
export type Currency = (typeof currencies)[number]

export interface Token {
  currency: Currency
  /** On-chain symbol of the TIP-20 that actually settles. */
  symbol: string
  address: Address
  decimals: typeof TIP20_DECIMALS
}

const token = (currency: Currency, symbol: string, address: string): Token => ({
  currency,
  symbol,
  address: getAddress(address),
  decimals: TIP20_DECIMALS,
})

/**
 * Settlement tokens by network.
 * Mainnet: USDC is Stargate-bridged USDC.e (there is no native USDC on Tempo).
 * Testnet: the faucet does not fund testnet USDC.e, so AlphaUSD stands in for USDC.
 */
export const tokens: Record<NetworkId, Record<Currency, Token>> = {
  mainnet: {
    USDC: token('USDC', 'USDC.e', '0x20C000000000000000000000b9537d11c60E8b50'),
    pathUSD: token('pathUSD', 'pathUSD', '0x20c0000000000000000000000000000000000000'),
    USDT0: token('USDT0', 'USDT0', '0x20c00000000000000000000014f22ca97301eb73'),
  },
  testnet: {
    USDC: token('USDC', 'AlphaUSD', '0x20c0000000000000000000000000000000000001'),
    pathUSD: token('pathUSD', 'pathUSD', '0x20c0000000000000000000000000000000000000'),
    USDT0: token('USDT0', 'BetaUSD', '0x20c0000000000000000000000000000000000002'),
  },
}

export function isCurrency(value: string): value is Currency {
  return (currencies as readonly string[]).includes(value)
}

export function getToken(network: NetworkId, currency: Currency): Token {
  return tokens[network][currency]
}

export function tokenByAddress(network: NetworkId, address: Address): Token | undefined {
  return Object.values(tokens[network]).find((t) => isAddressEqual(t.address, address))
}

const AMOUNT_RE = /^(0|[1-9]\d{0,14})(\.\d{1,6})?$/

/**
 * Parses a decimal amount string ("25.00") into base units. Strict: no exponents, signs,
 * separators, leading zeros, or more than 6 decimals, so API input can never be ambiguous.
 */
export function parseAmount(amount: string): bigint {
  if (!AMOUNT_RE.test(amount)) throw new Error(`Invalid amount: ${JSON.stringify(amount)}`)
  return parseUnits(amount, TIP20_DECIMALS)
}

/** Formats base units as a fixed 2+ decimal string ("25.00", "0.000031"). */
export function formatAmount(units: bigint): string {
  const s = formatUnits(units, TIP20_DECIMALS)
  const [whole, frac = ''] = s.split('.')
  return `${whole}.${frac.padEnd(2, '0')}`
}
