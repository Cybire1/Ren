import { formatAmount, parseAmount } from '@kova/monad'

/**
 * Money in Kova is dollars on-chain (USDC on Tempo, AUSD on Monad), shown in the currency a person thinks in: the app's
 * rules (apps/mobile src/lib/money.ts). Kova never converts money; local amounts are shown at a
 * published reference rate and always labelled as approximate.
 */
export const displayCurrencies = ['USD', 'EUR', 'GBP', 'NGN', 'KES', 'MXN'] as const
export type DisplayCurrency = (typeof displayCurrencies)[number]

export const currencyInfo: Record<
  DisplayCurrency,
  { symbol: string; name: string; decimals: number }
> = {
  USD: { symbol: '$', name: 'US dollars', decimals: 2 },
  EUR: { symbol: '€', name: 'Euros', decimals: 2 },
  GBP: { symbol: '£', name: 'British pounds', decimals: 2 },
  NGN: { symbol: '₦', name: 'Naira', decimals: 0 },
  KES: { symbol: 'KSh', name: 'Kenyan shillings', decimals: 0 },
  MXN: { symbol: 'MX$', name: 'Mexican pesos', decimals: 2 },
}

/** How many of each currency a dollar buys. */
export type Rates = Record<DisplayCurrency, number>

/** The reference table, used until the published rates arrive (and if they can't). */
export const referenceRates: Rates = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  NGN: 1375,
  KES: 129,
  MXN: 18.4,
}

/** GET /v1/rates: Chainlink's published rates, or Kova's table when they aren't there. */
export interface LiveRates {
  source: 'chainlink' | 'table'
  rates: Record<string, { per_usd: number; as_of: string }>
}

export function ratesFrom(live: LiveRates | null | undefined): Rates {
  const rates = { ...referenceRates }
  for (const code of displayCurrencies) {
    const per = live?.rates[code]?.per_usd
    if (typeof per === 'number' && per > 0) rates[code] = per
  }
  return rates
}

/** Where a rate comes from, in words: "Chainlink rate from 4 min ago", or "reference rate". */
export function rateLabel(live: LiveRates | null | undefined, now = Date.now()): string {
  if (live?.source !== 'chainlink') return 'reference rate'
  const asOf = Object.values(live.rates)
    .map((r) => Date.parse(r.as_of))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a)[0]
  if (!asOf) return 'Chainlink rate'
  const minutes = Math.max(0, Math.round((now - asOf) / 60_000))
  return minutes < 1
    ? 'Chainlink rate from just now'
    : minutes < 90
      ? `Chainlink rate from ${minutes} min ago`
      : 'Chainlink rate'
}

export const isDisplayCurrency = (value: unknown): value is DisplayCurrency =>
  displayCurrencies.includes(value as DisplayCurrency)

const EURO_REGIONS = new Set([
  'AT',
  'BE',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
])

/** A first guess at the currency someone thinks in, from their browser's region. They can change it. */
export function guessCurrency(): DisplayCurrency {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region?.toUpperCase()
    if (region === 'NG') return 'NGN'
    if (region === 'KE') return 'KES'
    if (region === 'GB') return 'GBP'
    if (region === 'MX') return 'MXN'
    if (region && EURO_REGIONS.has(region)) return 'EUR'
  } catch {
    // No region: dollars.
  }
  return 'USD'
}

const grouped = (value: number, decimals: number) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

/** Base units (6 decimals) → "$1,240.50". */
export function formatUsd(base: bigint, options: { sign?: boolean } = {}): string {
  const negative = base < 0n
  const text = `$${grouped(Number(formatAmount(negative ? -base : base)), 2)}`
  if (!options.sign) return negative ? `−${text}` : text
  return `${negative ? '−' : '+'}${text}`
}

/** Dollars → an amount in a display currency: 200 USD → "€184.00". */
export function formatLocal(usd: number, currency: DisplayCurrency, rates: Rates): string {
  return `${currencyInfo[currency].symbol}${grouped(usd * rates[currency], currencyInfo[currency].decimals)}`
}

export const toBase = (dollars: string): bigint => parseAmount(dollars)
export const baseToNumber = (base: bigint): number => Number(formatAmount(base))

export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'del'

/** Applies a keypad press to a typed amount, keeping it a valid number with `decimals` places. */
export function applyKey(value: string, key: Key, decimals = 2): string {
  if (key === 'del') return value.slice(0, -1)
  if (key === '.') {
    if (decimals === 0 || value.includes('.')) return value
    return value === '' ? '0.' : `${value}.`
  }
  const [whole = '', frac] = value.split('.')
  if (frac !== undefined && frac.length >= decimals) return value
  if (frac === undefined && whole.length >= 9) return value
  if (value === '0') return key
  return value + key
}

/** Typed digits → "1,240.5", for display while typing. */
export function groupTyped(value: string): string {
  if (value === '') return '0'
  const [whole = '0', frac] = value.split('.')
  const w = Number(whole).toLocaleString('en-US')
  return frac === undefined ? w : `${w}.${frac}`
}
