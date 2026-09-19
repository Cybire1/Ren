import { Address as OxAddress, PublicKey } from 'ox'
import { SignatureEnvelope, TxEnvelopeTempo } from 'ox/tempo'
import { type Address, type Hex, hexToBytes } from 'viem'
import { Account } from 'viem/tempo'

/** Order of the P-256 curve. */
export const P256_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n
const P256_N_HALF = P256_N / 2n

export interface Signature {
  r: bigint
  s: bigint
}

/**
 * Parses a DER-encoded ECDSA signature (`30 L 02 Lr R 02 Ls S`) into raw scalars.
 *
 * JavaCard's `ALG_ECDSA_SHA_256` returns DER, while Tempo wants raw 32-byte scalars.
 */
export function parseDerSignature(der: Hex | Uint8Array): Signature {
  const bytes = typeof der === 'string' ? hexToBytes(der) : der
  let i = 0
  const byte = (): number => {
    const value = bytes[i++]
    if (value === undefined) throw new Error('Malformed DER signature: unexpected end')
    return value
  }
  if (byte() !== 0x30) throw new Error('Malformed DER signature: expected SEQUENCE')
  const seqLen = byte()
  if (seqLen & 0x80) throw new Error('Malformed DER signature: long-form length')
  if (seqLen !== bytes.length - 2) throw new Error('Malformed DER signature: bad length')

  const readInt = (): bigint => {
    if (byte() !== 0x02) throw new Error('Malformed DER signature: expected INTEGER')
    const len = byte()
    if (len === 0 || len > 33) throw new Error('Malformed DER signature: bad INTEGER length')
    const slice = bytes.slice(i, i + len)
    if (slice.length !== len) throw new Error('Malformed DER signature: truncated INTEGER')
    i += len
    // DER integers are signed: a leading 0x00 is padding for a high bit.
    if (slice[0] === 0x00 && len > 1 && (slice[1] as number) < 0x80)
      throw new Error('Malformed DER signature: non-minimal INTEGER')
    if (len === 33 && slice[0] !== 0x00)
      throw new Error('Malformed DER signature: INTEGER too large')
    let value = 0n
    for (const b of slice) value = (value << 8n) | BigInt(b)
    return value
  }

  const r = readInt()
  const s = readInt()
  if (i !== bytes.length) throw new Error('Malformed DER signature: trailing bytes')
  if (r <= 0n || r >= P256_N || s <= 0n || s >= P256_N)
    throw new Error('Malformed DER signature: scalar out of range')
  return { r, s }
}

/**
 * Normalizes `s` to the lower half of the curve order.
 *
 * Tempo **rejects** high-s signatures rather than normalizing them, and a JavaCard produces
 * either variant at random, so skipping this fails about half of all taps.
 */
export function toLowS({ r, s }: Signature): Signature {
  return { r, s: s > P256_N_HALF ? P256_N - s : s }
}

/** Parses a card's DER signature and normalizes it: the two fixes every tap needs. */
export function normalizeCardSignature(der: Hex | Uint8Array): Signature {
  return toLowS(parseDerSignature(der))
}

/**
 * The access key id Tempo stores for a card, `last20(keccak256(X ‖ Y))`.
 * Accepts an uncompressed public key (`0x04 ‖ X ‖ Y`).
 */
export function keyIdFromPublicKey(publicKey: Hex): Address {
  return OxAddress.fromPublicKey(PublicKey.fromHex(publicKey)) as Address
}

/**
 * The digest the card must sign: `keccak256(0x04 ‖ sigHash ‖ userAccount)`.
 *
 * Handing the card the raw transaction hash produces a v1 keychain signature, which Tempo has
 * rejected since the T1C upgrade.
 */
export function cardSigningDigest(
  envelope: TxEnvelopeTempo.TxEnvelopeTempo,
  userAccount: Address,
): Hex {
  return TxEnvelopeTempo.getSignPayload(envelope, { from: userAccount })
}

/**
 * Wraps a card signature as a keychain-v2 envelope carrying a P-256 inner signature.
 *
 * `prehash` is true because `ALG_ECDSA_SHA_256` SHA-256-hashes its input before signing, which
 * is exactly what Tempo re-computes when the flag is set.
 */
export function cardSignatureEnvelope(params: {
  signature: Signature
  /** The card's uncompressed public key (`0x04 ‖ X ‖ Y`). */
  publicKey: Hex
  /** The cardholder's root Tempo account. */
  userAccount: Address
}): Hex {
  const inner = SignatureEnvelope.from({
    type: 'p256',
    prehash: true,
    publicKey: PublicKey.fromHex(params.publicKey),
    signature: params.signature,
  })
  return SignatureEnvelope.serialize(
    SignatureEnvelope.from({
      type: 'keychain',
      version: 'v2',
      userAddress: params.userAccount,
      inner,
    }),
  )
}

/** Signs a 32-byte digest on the card over NFC and returns its raw DER response. */
export type CardSigner = (digest: Hex) => Promise<Hex>

/**
 * A viem account backed by a physical Kova Card.
 *
 * viem computes the keychain-v2 digest and wraps the envelope; this only has to hand the
 * digest to the card and normalize what comes back.
 */
export function cardAccount(params: { publicKey: Hex; userAccount: Address; sign: CardSigner }) {
  const publicKey = PublicKey.fromHex(params.publicKey)
  return Account.from({
    access: params.userAccount,
    keyType: 'p256',
    publicKey,
    sign: async ({ hash }: { hash: Hex }) =>
      SignatureEnvelope.serialize({
        type: 'p256',
        prehash: true,
        publicKey,
        signature: normalizeCardSignature(await params.sign(hash)),
      }),
  })
}
