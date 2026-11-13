/**
 * Country calling codes that are two digits long. With +1 and +7 (one digit), every other code is
 * three, so this is enough to tell where a number's country code ends.
 */
const TWO_DIGIT_CODES = new Set(
  '20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 55 56 57 58 60 61 62 63 64 65 66 81 82 84 86 90 91 92 93 94 95 98'.split(
    ' ',
  ),
)

/**
 * A phone number as card issuers want it, E.164: "+234 0803 123 4567" → "+2348031234567". People
 * often keep the leading 0 after the country code; Nuvion's API takes that, but the card provider
 * behind it refuses the card. Null when it can't be a real number.
 *
 * This checks the shape (a country code, then 7 to 12 digits, 15 at most in all), not each country's
 * numbering plan: Nuvion's own check comes after it.
 */
export function e164(phone: string): string | null {
  const digits = phone.replace(/[\s().-]/g, '')
  if (!/^\+[1-9]\d+$/.test(digits)) return null
  const all = digits.slice(1)
  const code =
    all[0] === '1' || all[0] === '7'
      ? all.slice(0, 1)
      : TWO_DIGIT_CODES.has(all.slice(0, 2))
        ? all.slice(0, 2)
        : all.slice(0, 3)
  let national = all.slice(code.length)
  // The 0 people dial inside the country isn't part of the number abroad. Italy's is: it stays.
  if (code !== '39') national = national.replace(/^0/, '')
  if (national.length < 7 || code.length + national.length > 15) return null
  return `+${code}${national}`
}

/** An email as it's kept and sent on: no spaces around it, lower case. */
export const cleanEmail = (email: string) => email.trim().toLowerCase()
