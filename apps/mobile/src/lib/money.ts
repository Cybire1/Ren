/**
 * Naira in, dollars settled.
 *
 * Nigerian merchants price in naira, so the terminal takes ₦ and charges the USDC equivalent
 * at a reference rate that is always shown, never hidden (DECISIONS D-012). Kova never
 * converts money itself; the rate only decides how many dollars to ask for.
 */
export type EntryCurrency = 'NGN' | 'USD'

/** Naira per US dollar. Configurable until a live reference rate is wired in. */
export const ngnPerUsd = Number(process.env.EXPO_PUBLIC_NGN_PER_USD ?? 1375)

/** "650000" (kobo-free naira digits) → "₦6,500". */
export function formatNaira(naira: number): string {
  return `₦${Math.round(naira).toLocaleString('en-NG')}`
}

/** Naira → USDC string with two decimals, rounded up so the merchant is never short. */
export function nairaToUsdc(naira: number, rate = ngnPerUsd): string {
  const cents = Math.ceil((naira / rate) * 100)
  return (cents / 100).toFixed(2)
}

export function usdcToNaira(usdc: string | number, rate = ngnPerUsd): number {
  return Math.round(Number(usdc) * rate)
}

/** Groups naira digits as they are typed: "650000" → "650,000". */
export function groupDigits(digits: string): string {
  if (digits === '') return '0'
  return Number(digits).toLocaleString('en-NG')
}
