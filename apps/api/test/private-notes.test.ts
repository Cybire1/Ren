import { runMigrations, schema } from '@kova/db'
import { noteKeyMessage } from '@kova/monad'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { config } from '../src/config.js'
import { db } from '../src/db.js'
import { app } from '../src/index.js'

// Notes travel with sends Ren relays as signed authorizations, which is Monad's way to send (on
// Tempo a send goes through the fee-payer relay, and notes aren't attached yet).
// vi.hoisted runs before the imports above.
vi.hoisted(() => {
  process.env.KOVA_CHAIN = 'monad'
})

/**
 * Private notes: a wallet publishes its note key, signed by itself, and notes travel sealed with
 * transfers. Kova stores what it can't read and hands it back with the wallet's history.
 *
 * Requires a local Postgres (DATABASE_URL); migrations are applied here.
 */

type Body = Record<string, unknown> & { error?: { code: string } }

async function call(path: string, init: { method?: string; body?: unknown } = {}) {
  const response = await app.request(path, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  return { status: response.status, body: (await response.json()) as Body }
}

const publicKey = (fill: string) => fill.repeat(43).slice(0, 43)
const sealed = {
  v: 1 as const,
  e: 'E'.repeat(43),
  n: 'N'.repeat(32),
  to: 'T'.repeat(40),
  from: 'F'.repeat(40),
}

beforeAll(async () => {
  await runMigrations(config.DATABASE_URL)
})

describe('note keys', () => {
  it('publishes a key the wallet signed, and hands it back with the signature', async () => {
    const wallet = privateKeyToAccount(generatePrivateKey())
    const key = publicKey('a')
    const signature = await wallet.signMessage({ message: noteKeyMessage(wallet.address, key) })
    const put = await call(`/v1/wallets/${wallet.address}/note-key`, {
      method: 'PUT',
      body: { public_key: key, signature },
    })
    expect(put.status).toBe(200)
    const got = await call(`/v1/wallets/${wallet.address}/note-key`)
    expect(got.body).toMatchObject({ public_key: key, signature })
  })

  it('refuses a key signed by anyone else', async () => {
    const wallet = privateKeyToAccount(generatePrivateKey())
    const other = privateKeyToAccount(generatePrivateKey())
    const key = publicKey('b')
    const signature = await other.signMessage({ message: noteKeyMessage(wallet.address, key) })
    const put = await call(`/v1/wallets/${wallet.address}/note-key`, {
      method: 'PUT',
      body: { public_key: key, signature },
    })
    expect(put.status).toBe(403)
    expect((await call(`/v1/wallets/${wallet.address}/note-key`)).status).toBe(404)
  })
})

describe('sealed notes on transfers', () => {
  it('refuses a send whose note isn’t sealed, before anything moves', async () => {
    const from = privateKeyToAccount(generatePrivateKey()).address
    const to = privateKeyToAccount(generatePrivateKey()).address
    const response = await call('/v1/transfers', {
      method: 'POST',
      body: {
        token: '0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC',
        from,
        to,
        value: '1000000',
        validAfter: '0',
        validBefore: String(Math.floor(Date.now() / 1000) + 600),
        nonce: `0x${'11'.repeat(32)}`,
        signature: `0x${'22'.repeat(65)}`,
        note: { v: 1, text: 'for dinner' },
      },
    })
    expect(response.status).toBe(400)
  })

  it('returns a stored note with the history of both sides, sealed as it came', async () => {
    const from = privateKeyToAccount(generatePrivateKey()).address.toLowerCase()
    const to = privateKeyToAccount(generatePrivateKey()).address.toLowerCase()
    const txHash = `0x${crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')}`
    const nonce = `0x${'33'.repeat(32)}`
    await db.insert(schema.transfers).values({
      id: crypto.randomUUID(),
      network: config.KOVA_NETWORK,
      tokenAddress: '0xa9012a055bd4e0edff8ce09f960291c09d5322dc',
      fromAddress: from,
      toAddress: to,
      amount: 2_500_000n,
      txHash,
      logIndex: 0,
      blockNumber: 1n,
      nonce,
    })
    await db
      .insert(schema.paymentNotes)
      .values({ txHash, fromAddress: from, toAddress: to, authNonce: nonce, sealed })
    for (const [who, direction] of [
      [to, 'in'],
      [from, 'out'],
    ]) {
      const list = await call(`/v1/wallets/${who}/transfers?direction=${direction}&after_block=0`)
      const row = (list.body.data as { tx_hash: string; note: unknown }[]).find(
        (t) => t.tx_hash === txHash,
      )
      expect(row?.note).toEqual({ sealed, auth_nonce: nonce })
    }
  })
})
