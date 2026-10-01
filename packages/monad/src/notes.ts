import type { Address, Hex } from 'viem'

/**
 * Private payment notes: the formats every side agrees on. The cryptography lives in the app and
 * the web (X25519, HKDF-SHA256, XChaCha20-Poly1305); Kova's server only checks shapes and stores
 * what it can't read.
 *
 * Each wallet publishes a note key, a public X25519 key derived from its passkey's vault secret,
 * and signs it with the wallet itself. A sender checks that signature before sealing, so Kova
 * can't hand out a key of its own. A note is sealed twice under one ephemeral key, once for the
 * receiver and once for the sender, and bound to the exact transfer it travels with.
 */

/** Longest note, in characters. */
export const NOTE_MAX = 60

/** What a wallet signs to publish its note key. */
export function noteKeyMessage(address: Address, publicKey: string): string {
  return `Kova private notes\nWallet ${address.toLowerCase()}\nKey ${publicKey}`
}

/** Associated data for a sealed note: the transfer it belongs to. Moving it to another fails to open. */
export function noteContext(transfer: {
  from: Address
  to: Address
  value: bigint
  nonce: Hex
}): string {
  return `kova.note.v1:${transfer.from.toLowerCase()}:${transfer.to.toLowerCase()}:${transfer.value}:${transfer.nonce.toLowerCase()}`
}

/** A sealed note, as base64url: the ephemeral public key, the nonce, and a box for each side. */
export interface SealedNote {
  v: 1
  /** Ephemeral X25519 public key (32 bytes). */
  e: string
  /** XChaCha20 nonce (24 bytes). */
  n: string
  /** For the receiver; empty when they have no note key yet. */
  to: string
  /** For the sender, so the note survives on their other devices. */
  from: string
}

const B64 = /^[A-Za-z0-9_-]*$/
/** A note of NOTE_MAX characters (4 bytes each at most) plus the 16-byte tag, in base64url. */
const MAX_BOX = Math.ceil(((NOTE_MAX * 4 + 16) * 4) / 3)

/** A sealed note from untrusted input, or null when it isn't one. */
export function parseSealedNote(input: unknown): SealedNote | null {
  if (!input || typeof input !== 'object') return null
  const s = input as Record<string, unknown>
  const field = (v: unknown, min: number, max: number) =>
    typeof v === 'string' && B64.test(v) && v.length >= min && v.length <= max
  if (
    s.v !== 1 ||
    !field(s.e, 43, 43) ||
    !field(s.n, 32, 32) ||
    !field(s.to, 0, MAX_BOX) ||
    !field(s.from, 22, MAX_BOX)
  )
    return null
  return { v: 1, e: s.e as string, n: s.n as string, to: s.to as string, from: s.from as string }
}
