import { describe, expect, it } from 'vitest'
import { slugify } from '../src/services/catalog.js'

/** A shop's link comes from its name, in any language. */
describe('stall links', () => {
  it('keeps accented names readable', () => {
    expect(slugify('Tomás’ Weaves')).toBe('tomas-weaves')
    expect(slugify('Café São Paulo')).toBe('cafe-sao-paulo')
    expect(slugify('Müller & Söhne')).toBe('muller-sohne')
  })

  it('falls back when nothing readable is left', () => {
    expect(slugify('東京の店')).toBe('stall')
  })
})
