import { afterEach, describe, expect, it, vi } from 'vitest'
import { config, nuvionProblem, nuvionReady } from '../src/config.js'
import { NuvionRefused, potCents } from '../src/services/nuvion.js'

/**
 * Ren on a test network moves test dollars; Nuvion's live API moves people's money. These check the
 * switch that keeps the two apart: off mainnet, only Nuvion's sandbox URL with a sandbox key turns
 * the dollar card and cash-outs on, and the client itself won't send a request anywhere else.
 */

const sandbox = {
  KOVA_NETWORK: 'testnet' as const,
  NUVION_API_KEY: 'nv_test_abc',
  NUVION_API_URL: 'https://api.nuvion.dev',
  NUVION_POT_ACCOUNT: 'acc_pot',
}

const saved = { ...config }
afterEach(() => {
  Object.assign(config, saved)
  vi.unstubAllGlobals()
})

describe('Nuvion on a test network', () => {
  it('runs against the sandbox with a sandbox key', () => {
    expect(nuvionProblem(sandbox)).toBeNull()
    expect(nuvionReady(sandbox)).toBe(true)
    // A path or a trailing slash on the sandbox's URL is still the sandbox.
    expect(nuvionProblem({ ...sandbox, NUVION_API_URL: 'https://api.nuvion.dev/' })).toBeNull()
  })

  it('refuses a live key, even pointed at the sandbox', () => {
    const live = { ...sandbox, NUVION_API_KEY: 'nv_live_abc' }
    expect(nuvionProblem(live)).toMatch(/sandbox key/)
    expect(nuvionReady(live)).toBe(false)
  })

  it('refuses the live URL, even with a sandbox key', () => {
    const live = { ...sandbox, NUVION_API_URL: 'https://api.nuvion.co' }
    expect(nuvionProblem(live)).toMatch(/only to Nuvion’s sandbox/)
    expect(nuvionReady(live)).toBe(false)
  })

  it('refuses whatever it doesn’t recognise: another host, a look-alike, a key with no prefix', () => {
    for (const url of [
      'https://api.nuvion.co/v1',
      'https://nuvion.dev.example.com',
      'https://api.nuvion.dev.example.com',
      'http://api.nuvion.dev',
      'https://example.com/?to=https://api.nuvion.dev',
    ])
      expect(nuvionReady({ ...sandbox, NUVION_API_URL: url })).toBe(false)
    for (const key of ['abc', 'nv_live_', 'NV_TEST_abc', 'sk_test_abc'])
      expect(nuvionReady({ ...sandbox, NUVION_API_KEY: key })).toBe(false)
  })

  it('is off without a key or a pot, as before', () => {
    expect(nuvionReady({ ...sandbox, NUVION_API_KEY: undefined })).toBe(false)
    expect(nuvionReady({ ...sandbox, NUVION_POT_ACCOUNT: undefined })).toBe(false)
  })

  it('never sends a request with a live key or to the live URL, whoever calls the client', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    Object.assign(config, sandbox, { NUVION_API_KEY: 'nv_live_abc' })
    await expect(potCents()).rejects.toMatchObject({ code: 'conflict' })
    Object.assign(config, sandbox, { NUVION_API_URL: 'https://api.nuvion.co' })
    await expect(potCents()).rejects.toMatchObject({ code: 'conflict' })
    await expect(potCents()).rejects.not.toBeInstanceOf(NuvionRefused)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('Nuvion on mainnet', () => {
  it('takes the live key and URL, which is what they are for', () => {
    const live = {
      ...sandbox,
      KOVA_NETWORK: 'mainnet' as const,
      NUVION_API_KEY: 'nv_live_abc',
      NUVION_API_URL: 'https://api.nuvion.co',
    }
    expect(nuvionProblem(live)).toBeNull()
    expect(nuvionReady(live)).toBe(true)
  })
})
