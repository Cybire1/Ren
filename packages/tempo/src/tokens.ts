import { type Address, formatUnits, getAddress, isAddressEqual, parseUnits } from 'viem'
import type { NetworkId } from './networks.js'

/** Every TIP-20 token has 6 decimals (TIP-20 spec). */
export const TIP20_DECIMALS = 6

/**
 * Currencies Ren exposes in its API. Ren settles in OUSD, Open Standard's dollar (Coinbase,
 * Mastercard, Shopify, Stripe and Visa), the one Tempo recommends; a charge may still ask for
 * another dollar Ren accepts. `USDC` is the product-level name for Tempo's USDC: bridged USDC.e on
 * mainnet, AlphaUSD standing in on testnet (docs/tempo/01 §4, DECISIONS D-002).
 */
export const currencies = ['OUSD', 'USDC', 'pathUSD', 'USDT0'] as const
export type Currency = (typeof currencies)[number]

/** What Ren settles in unless a charge asks for another dollar. */
export const DEFAULT_CURRENCY: Currency = 'OUSD'

/** OUSD: the same address on mainnet and testnet (testnet's is a test token from the faucet). */
export const OUSD_ADDRESS = '0x20c0000000000000000000006a37DA5C996874BE'

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
 * The dollars Ren accepts, by network. OUSD settles everything by default.
 * Mainnet: USDC is Stargate-bridged USDC.e (there is no native USDC on Tempo).
 * Testnet: the faucet does not fund testnet USDC.e, so AlphaUSD stands in for USDC.
 */
export const tokens: Record<NetworkId, Record<Currency, Token>> = {
  mainnet: {
    OUSD: token('OUSD', 'OUSD', OUSD_ADDRESS),
    USDC: token('USDC', 'USDC.e', '0x20C000000000000000000000b9537d11c60E8b50'),
    pathUSD: token('pathUSD', 'pathUSD', '0x20c0000000000000000000000000000000000000'),
    USDT0: token('USDT0', 'USDT0', '0x20c00000000000000000000014f22ca97301eb73'),
  },
  testnet: {
    OUSD: token('OUSD', 'OUSD', OUSD_ADDRESS),
    USDC: token('USDC', 'AlphaUSD', '0x20c0000000000000000000000000000000000001'),
    pathUSD: token('pathUSD', 'pathUSD', '0x20c0000000000000000000000000000000000000'),
    USDT0: token('USDT0', 'BetaUSD', '0x20c0000000000000000000000000000000000002'),
  },
}

/**
 * Test dollars a wallet may take from Kova's testnet treasury each day. Tempo's faucet hands out
 * a million of each test token at once, which makes a demo balance meaningless; the treasury takes
 * one faucet drip and gives it out five dollars at a time.
 */
export const TEST_DOLLARS_A_DAY = 5_000_000n

export function isCurrency(value: string): value is Currency {
  return (currencies as readonly string[]).includes(value)
}

export function getToken(network: NetworkId, currency: Currency = DEFAULT_CURRENCY): Token {
  return tokens[network][currency]
}

/** Every dollar Kova accepts on a network. A transfer in anything else is not a Kova payment. */
export function supportedTokens(network: NetworkId): Token[] {
  return Object.values(tokens[network])
}

export function tokenByAddress(network: NetworkId, address: Address): Token | undefined {
  return Object.values(tokens[network]).find((t) => isAddressEqual(t.address, address))
}

/** A dollar stablecoin on Tempo that isn't Ren's own: shown as "other dollars" and turned into OUSD. */
export interface OtherDollar {
  symbol: string
  /** What people see. */
  name: string
  address: Address
}

const other = (symbol: string, name: string, address: string): OtherDollar => ({
  symbol,
  name,
  address: getAddress(address),
})

/**
 * Dollars a Ren wallet may be sent that Ren turns into OUSD on Tempo's stablecoin exchange: the
 * ones the exchange trades against pathUSD, as Tempo's token list names them.
 */
export const otherDollars: Record<NetworkId, OtherDollar[]> = {
  mainnet: [
    other('USDC.e', 'USDC', '0x20C000000000000000000000b9537d11c60E8b50'),
    other('USDT0', 'USDT', '0x20c00000000000000000000014f22ca97301eb73'),
    other('pathUSD', 'pathUSD', '0x20c0000000000000000000000000000000000000'),
  ],
  testnet: [
    other('AlphaUSD', 'AlphaUSD', '0x20c0000000000000000000000000000000000001'),
    other('BetaUSD', 'BetaUSD', '0x20c0000000000000000000000000000000000002'),
    other('ThetaUSD', 'ThetaUSD', '0x20c0000000000000000000000000000000000003'),
    other('pathUSD', 'pathUSD', '0x20c0000000000000000000000000000000000000'),
  ],
}

export function otherDollarByAddress(
  network: NetworkId,
  address: Address,
): OtherDollar | undefined {
  return otherDollars[network].find((d) => isAddressEqual(d.address, address))
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
