import { describe, expect, it } from 'vitest'
import { cleanEmail, e164 } from '../src/services/contact-format.js'

/** Phones as the card provider wants them (E.164), from what people actually type. */
describe('e164', () => {
  it('drops spaces, punctuation and the 0 people keep after the country code', () => {
    expect(e164('+234 0803 123 4567')).toBe('+2348031234567')
    expect(e164('+44 (0)20 7946 0958')).toBe('+442079460958')
    expect(e164('+1 415-555-2671')).toBe('+14155552671')
    expect(e164('+254 712 345 678')).toBe('+254712345678')
    expect(e164('+7 912 345-67-89')).toBe('+79123456789')
  })

  it('keeps Italy’s 0, which is part of the number', () => {
    expect(e164('+39 06 6982 1234')).toBe('+390669821234')
  })

  it('refuses what can’t be a number: no country code, too short, too long, letters', () => {
    for (const bad of [
      '08031234567',
      '+2341',
      '+0 803 123 4567',
      '+2348031234567890123',
      '+234abc',
    ])
      expect(e164(bad)).toBeNull()
  })

  it('tidies an email', () => {
    expect(cleanEmail(' Mia@Example.com ')).toBe('mia@example.com')
  })
})
