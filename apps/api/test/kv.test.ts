import { randomUUID } from 'node:crypto'
import { runMigrations } from '@kova/db'
import { beforeAll, describe, expect, it } from 'vitest'
import { config } from '../src/config.js'
import { claimOnce, mppStore, takeSponsorship } from '../src/kv.js'

/**
 * What the API remembers in Postgres instead of in a process: replay claims, MPP's store and the
 * daily caps on fees Ren pays. Each test uses fresh keys, so it runs on any test database.
 */
beforeAll(async () => {
  await runMigrations(config.DATABASE_URL)
})

describe('claimOnce', () => {
  it('lets a key be claimed once while it lives, and again after it expires', async () => {
    const key = `test:${randomUUID()}`
    expect(await claimOnce(key, Date.now() + 60_000)).toBe(true)
    expect(await claimOnce(key, Date.now() + 60_000)).toBe(false)

    const short = `test:${randomUUID()}`
    expect(await claimOnce(short, Date.now() + 50)).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(await claimOnce(short, Date.now() + 60_000)).toBe(true)
  })

  it('refuses an expiry already in the past', async () => {
    expect(await claimOnce(`test:${randomUUID()}`, Date.now() - 1)).toBe(false)
  })

  it('gives exactly one of many claims racing for the same key', async () => {
    const key = `test:${randomUUID()}`
    const results = await Promise.all(
      Array.from({ length: 8 }, () => claimOnce(key, Date.now() + 60_000)),
    )
    expect(results.filter(Boolean)).toHaveLength(1)
  })
})

describe('takeSponsorship', () => {
  it('counts a wallet’s sponsored fees of one kind up to the cap', async () => {
    const wallet = `0x${randomUUID().replace(/-/g, '').padEnd(40, '0')}`
    expect(await takeSponsorship(wallet, 'send', 2)).toBe(true)
    expect(await takeSponsorship(wallet, 'send', 2)).toBe(true)
    expect(await takeSponsorship(wallet, 'send', 2)).toBe(false)
    // Key changes are counted apart from sends.
    expect(await takeSponsorship(wallet, 'key', 2)).toBe(true)
  })

  it('holds the cap when requests race', async () => {
    const wallet = `0x${randomUUID().replace(/-/g, '').padEnd(40, '0')}`
    const results = await Promise.all(Array.from({ length: 6 }, () => takeSponsorship(wallet, 'send', 3)))
    expect(results.filter(Boolean)).toHaveLength(3)
  })
})

describe('mppStore', () => {
  it('reads, writes and deletes values', async () => {
    const store = mppStore(`test:${randomUUID()}:`)
    expect(await store.get('a')).toBeNull()
    await store.put('a', { n: 1 })
    expect(await store.get('a')).toEqual({ n: 1 })
    await store.delete('a')
    expect(await store.get('a')).toBeNull()
  })

  it('updates a value atomically, one writer at a time', async () => {
    const store = mppStore(`test:${randomUUID()}:`)
    await Promise.all(
      Array.from({ length: 10 }, () =>
        store.update('count', (current) => {
          const next = ((current as number | null) ?? 0) + 1
          return { op: 'set', value: next, result: next }
        }),
      ),
    )
    expect(await store.get('count')).toBe(10)
  })
})
