import { createHash, createSign, generateKeyPairSync, sign as nodeSign } from 'node:crypto'
import { PublicKey } from 'ox'
import { SignatureEnvelope } from 'ox/tempo'
import { concatHex, type Hex, keccak256 } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  cardSignatureEnvelope,
  keyIdFromPublicKey,
  normalizeCardSignature,
  P256_N,
  parseDerSignature,
  toLowS,
} from '../src/card.js'

/**
 * A stand-in for the Kova Card: a P-256 key that signs with SHA-256 then ECDSA and returns
 * DER with a random `s`, which is what JavaCard `ALG_ECDSA_SHA_256` does.
 */
function makeCard() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const raw = publicKey.export({ format: 'jwk' })
  const x = Buffer.from(raw.x as string, 'base64url')
  const y = Buffer.from(raw.y as string, 'base64url')
  return {
    publicKey: `0x04${x.toString('hex')}${y.toString('hex')}` as Hex,
    sign: (digest: Hex): Hex => {
      const der = nodeSign('sha256', Buffer.from(digest.slice(2), 'hex'), privateKey)
      return `0x${der.toString('hex')}`
    },
  }
}

describe('parseDerSignature', () => {
  it('parses real card signatures', () => {
    const card = makeCard()
    for (let i = 0; i < 25; i++) {
      const digest = keccak256(`0x${i.toString(16).padStart(64, '0')}` as Hex)
      const { r, s } = parseDerSignature(card.sign(digest))
      expect(r).toBeGreaterThan(0n)
      expect(r).toBeLessThan(P256_N)
      expect(s).toBeGreaterThan(0n)
      expect(s).toBeLessThan(P256_N)
    }
  })

  it('parses a signature whose scalars have a high bit (0x00-padded)', () => {
    // A high bit in r forces DER to prepend a 0x00 pad byte (33-byte INTEGER).
    const r = (1n << 255n) + 1n
    const der = `0x3026022100${r.toString(16).padStart(64, '0')}020101`
    expect(parseDerSignature(der as Hex)).toEqual({ r, s: 1n })
  })

  it.each([
    ['empty', '0x'],
    ['not a sequence', '0x3106020101020101'],
    ['bad length', '0x3005020101020101'],
    ['trailing bytes', '0x30060201010201010000'],
    ['non-minimal integer', '0x300702020001020101'],
    ['zero scalar', '0x3006020100020101'],
  ])('rejects %s', (_label, der) => {
    expect(() => parseDerSignature(der as Hex)).toThrow()
  })
})

describe('toLowS', () => {
  it('flips high-s and leaves low-s alone', () => {
    const half = P256_N / 2n
    expect(toLowS({ r: 1n, s: half + 1n })).toEqual({ r: 1n, s: P256_N - (half + 1n) })
    expect(toLowS({ r: 1n, s: half - 1n })).toEqual({ r: 1n, s: half - 1n })
  })

  it('normalizes every card signature to low-s, and stays verifiable', () => {
    const card = makeCard()
    let sawHigh = false
    for (let i = 0; i < 50; i++) {
      const digest = keccak256(`0x${i.toString(16).padStart(64, '0')}` as Hex)
      const der = card.sign(digest)
      const raw = parseDerSignature(der)
      if (raw.s > P256_N / 2n) sawHigh = true
      const { r, s } = normalizeCardSignature(der)
      expect(s).toBeLessThanOrEqual(P256_N / 2n)
      // The normalized pair must still verify against sha256(digest), which is what Tempo
      // checks when prehash = 1.
      const ok = verifyP256(card.publicKey, digest, r, s)
      expect(ok).toBe(true)
    }
    // With 50 samples, seeing no high-s at all would mean the test is not exercising the flip.
    expect(sawHigh).toBe(true)
  })
})

/** Verifies (r,s) over sha256(digest) the way Tempo's verifier does for prehash = 1. */
function verifyP256(publicKey: Hex, digest: Hex, r: bigint, s: bigint): boolean {
  const { createVerify, createPublicKey } = require('node:crypto') as typeof import('node:crypto')
  void createVerify
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: Buffer.from(publicKey.slice(4, 68), 'hex').toString('base64url'),
    y: Buffer.from(publicKey.slice(68), 'hex').toString('base64url'),
  }
  const key = createPublicKey({ key: jwk, format: 'jwk' })
  const raw = Buffer.concat([
    Buffer.from(r.toString(16).padStart(64, '0'), 'hex'),
    Buffer.from(s.toString(16).padStart(64, '0'), 'hex'),
  ])
  const { verify } = require('node:crypto') as typeof import('node:crypto')
  return verify(
    'sha256',
    Buffer.from(digest.slice(2), 'hex'),
    { key, dsaEncoding: 'ieee-p1363' },
    raw,
  )
}

describe('keyIdFromPublicKey', () => {
  it('matches last20(keccak256(X || Y))', () => {
    const card = makeCard()
    const expected = `0x${keccak256(`0x${card.publicKey.slice(4)}` as Hex).slice(-40)}`
    expect(keyIdFromPublicKey(card.publicKey).toLowerCase()).toBe(expected.toLowerCase())
  })
})

describe('cardSignatureEnvelope', () => {
  const user = '0x1111111111111111111111111111111111111111' as const

  it('serializes to keychain v2: 0x04 || user(20) || 0x01 || r || s || X || Y || prehash', () => {
    const card = makeCard()
    const digest = keccak256('0xdeadbeef')
    const signature = normalizeCardSignature(card.sign(digest))
    const envelope = cardSignatureEnvelope({
      signature,
      publicKey: card.publicKey,
      userAccount: user,
    })

    const bytes = envelope.slice(2)
    expect(bytes.length / 2).toBe(151)
    expect(bytes.slice(0, 2)).toBe('04')
    expect(`0x${bytes.slice(2, 42)}`).toBe(user)
    expect(bytes.slice(42, 44)).toBe('01')
    expect(bytes.slice(-2)).toBe('01') // prehash = 1
    expect(bytes.slice(172, 300)).toBe(card.publicKey.slice(4).toLowerCase())
  })

  it('round-trips through ox and keeps the signature verifiable', () => {
    const card = makeCard()
    const digest = keccak256('0xc0ffee')
    const signature = normalizeCardSignature(card.sign(digest))
    const envelope = cardSignatureEnvelope({
      signature,
      publicKey: card.publicKey,
      userAccount: user,
    })

    const parsed = SignatureEnvelope.deserialize(envelope)
    expect(parsed.type).toBe('keychain')
    const inner = (
      parsed as { inner: { type: string; prehash: boolean; signature: typeof signature } }
    ).inner
    expect(inner.type).toBe('p256')
    expect(inner.prehash).toBe(true)
    expect(inner.signature).toEqual(signature)
    expect(verifyP256(card.publicKey, digest, signature.r, signature.s)).toBe(true)
  })

  it('binds the signature to the keychain v2 digest, not the raw hash', () => {
    // The POS must sign keccak256(0x04 || sigHash || user); viem/ox derive it the same way.
    const sigHash = keccak256('0xabcd')
    const expected = keccak256(concatHex(['0x04', sigHash, user]))
    expect(expected).toMatch(/^0x[0-9a-f]{64}$/)
    const card = makeCard()
    const signature = normalizeCardSignature(card.sign(expected))
    expect(verifyP256(card.publicKey, expected, signature.r, signature.s)).toBe(true)
    // A signature over the raw sigHash must NOT verify against the v2 digest.
    const wrong = normalizeCardSignature(card.sign(sigHash))
    expect(verifyP256(card.publicKey, expected, wrong.r, wrong.s)).toBe(false)
  })
})

describe('ox interop', () => {
  it('PublicKey.fromHex accepts the card public key format', () => {
    const card = makeCard()
    const pk = PublicKey.fromHex(card.publicKey)
    expect(pk.prefix).toBe(4)
    void createHash
    void createSign
  })
})
