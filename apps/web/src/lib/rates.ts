/**
 * Reference rates for showing a dollar price in someone's own money (DECISIONS D-012): always
 * labelled approximate, and nothing is ever converted; everything is paid in dollars. Pages pass
 * the live rates Kova's API reads from Chainlink (KovaRates on Monad); this table is the fallback.
 */
export const RATES = {
  USD: { symbol: '$', perUsd: 1, decimals: 2, name: 'US dollars' },
  EUR: { symbol: '€', perUsd: 0.92, decimals: 2, name: 'Euros' },
  GBP: { symbol: '£', perUsd: 0.79, decimals: 2, name: 'Pounds' },
  NGN: { symbol: '₦', perUsd: 1375, decimals: 0, name: 'Naira' },
} as const

export type Currency = keyof typeof RATES

/** Live rates by currency code, as the API publishes them. */
export type LiveRates = Partial<Record<Currency, number>>

export function inCurrency(dollars: number | string, currency: Currency, live?: LiveRates) {
  const r = RATES[currency]
  const value = Number(dollars) * (live?.[currency] ?? r.perUsd)
  return `${r.symbol}${value.toLocaleString('en-US', { minimumFractionDigits: r.decimals, maximumFractionDigits: r.decimals })}`
}
