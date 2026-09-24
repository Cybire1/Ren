/**
 * Reference rates for showing a dollar price in someone's own money. The same published table
 * as the app (DECISIONS D-012): always labelled approximate, and nothing is ever converted;
 * everything is paid in dollars.
 */
export const RATES = {
  USD: { symbol: '$', perUsd: 1, decimals: 2, name: 'US dollars' },
  EUR: { symbol: '€', perUsd: 0.92, decimals: 2, name: 'Euros' },
  GBP: { symbol: '£', perUsd: 0.79, decimals: 2, name: 'Pounds' },
  NGN: { symbol: '₦', perUsd: 1375, decimals: 0, name: 'Naira' },
} as const

export type Currency = keyof typeof RATES

export function inCurrency(dollars: number | string, currency: Currency) {
  const r = RATES[currency]
  const value = Number(dollars) * r.perUsd
  return `${r.symbol}${value.toLocaleString('en-US', { minimumFractionDigits: r.decimals, maximumFractionDigits: r.decimals })}`
}
