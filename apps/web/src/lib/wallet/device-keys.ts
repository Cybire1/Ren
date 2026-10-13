'use client'

import { PublicKey } from 'ox'
import type { Address, Hex } from 'viem'
import { Account, WebCryptoP256 } from 'viem/tempo'

/**
 * Keys this browser holds for allowances other wallets gave it: P-256 keys made by WebCrypto,
 * never extractable, kept in IndexedDB. The private key can sign on this device and nowhere else;
 * not even Ren ever sees it. Each spends from the giver's wallet, within the limit the giver put
 * on it on Tempo.
 */

const DB = 'ren-keys'
const STORE = 'allowances'

export interface HeldKey {
  /** The allowance's id at Ren. */
  id: string
  owner: Address
  holder: Address
  keyId: Address
  publicKey: Hex
  privateKey: CryptoKey
  /** The dollar it spends, its limit (base units) and how often that renews, as offered. */
  token: Address
  limit: string
  period: 'day' | 'week'
  expiresAt: string
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const request = work(db.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** A fresh key for an allowance, before Ren knows which allowance it's for. */
export async function makeKey(): Promise<{ privateKey: CryptoKey; publicKey: Hex; keyId: Address }> {
  const pair = await WebCryptoP256.createKeyPair()
  const publicKey = PublicKey.toHex(pair.publicKey)
  const keyId = Account.fromWebCryptoP256(pair).address
  return { privateKey: pair.privateKey, publicKey, keyId }
}

export const keepKey = (key: HeldKey) => run('readwrite', (store) => store.put(key))

export async function heldKey(id: string): Promise<HeldKey | null> {
  try {
    return ((await run('readonly', (store) => store.get(id))) as HeldKey | undefined) ?? null
  } catch {
    return null
  }
}

export async function heldKeys(): Promise<HeldKey[]> {
  try {
    return (await run('readonly', (store) => store.getAll())) as HeldKey[]
  } catch {
    return []
  }
}

export const forgetKey = (id: string) => run('readwrite', (store) => store.delete(id))

/** The account that spends an allowance: the giver's wallet, signed for by this browser's key. */
export function spendingAccount(key: HeldKey) {
  return Account.fromWebCryptoP256(
    { privateKey: key.privateKey, publicKey: PublicKey.fromHex(key.publicKey) },
    { access: key.owner },
  )
}
