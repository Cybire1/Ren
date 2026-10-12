import { createCipheriv, createDecipheriv, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { Hex } from 'viem'
import { config } from './config.js'

/**
 * Secrets Kova keeps for USSD pockets: each pocket's private key, sealed under a master key, and
 * PINs and phone codes, hashed so a copy of the database reveals neither.
 */

const b64 = (bytes: Buffer) => bytes.toString('base64url')
const unb64 = (text: string) => Buffer.from(text, 'base64url')

function masterKey(): Buffer {
  if (!config.KOVA_POCKET_MASTER_KEY) throw new Error('KOVA_POCKET_MASTER_KEY is not set')
  return Buffer.from(config.KOVA_POCKET_MASTER_KEY, 'hex')
}

/** AES-256-GCM, bound to the pocket's id so a sealed key can't be moved to another pocket. */
export function sealKey(privateKey: Hex, pocketId: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv)
  cipher.setAAD(Buffer.from(`kova.pocket.v1:${pocketId}`))
  const sealed = Buffer.concat([cipher.update(privateKey.slice(2), 'hex'), cipher.final()])
  return [b64(iv), b64(cipher.getAuthTag()), b64(sealed)].join('.')
}

export function openKey(sealedKey: string, pocketId: string): Hex {
  const [iv, tag, body] = sealedKey.split('.')
  if (!iv || !tag || !body) throw new Error('Malformed sealed key')
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), unb64(iv))
  decipher.setAAD(Buffer.from(`kova.pocket.v1:${pocketId}`))
  decipher.setAuthTag(unb64(tag))
  return `0x${Buffer.concat([decipher.update(unb64(body)), decipher.final()]).toString('hex')}` as Hex
}

function derive(secret: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(secret, salt, 32, { N: 16_384, r: 8, p: 1 }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  )
}

/** scrypt, salted: "salt.hash". For PINs and phone codes, which are short and must not leak. */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16)
  return `${b64(salt)}.${b64(await derive(secret, salt))}`
}

export async function secretMatches(secret: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split('.')
  if (!salt || !hash) return false
  const expected = unb64(hash)
  const actual = await derive(secret, unb64(salt))
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
