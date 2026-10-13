import * as SecureStore from 'expo-secure-store'
import type { Address, Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Account } from 'viem/tempo'
import { chainKey } from './config'
import { load, save } from './storage'

/**
 * Keys this phone holds for allowances other wallets gave it. Each private key lives in the iOS
 * Keychain, only on this device, and never leaves it: not even Ren sees it. What it's for (whose
 * dollars, which dollar, the limit as offered) sits beside it in plain storage, so Home can show
 * it without a prompt. Each spends from the giver's wallet, within the limit Tempo enforces.
 */

export interface HeldKey {
  /** The allowance's id at Ren. */
  id: string
  owner: Address
  holder: Address
  keyId: Address
  token: Address
  /** Base units, as offered. */
  limit: string
  period: 'day' | 'week'
  expiresAt: string
}

const LIST = chainKey('held-keys')
const secretKey = (id: string) => `kova.held.${id.replace(/[^A-Za-z0-9]/g, '')}`

/** A fresh key for an allowance, before Ren knows which allowance it's for. */
export function makeKey(): { privateKey: Hex; keyId: Address } {
  const privateKey = generatePrivateKey()
  return { privateKey, keyId: privateKeyToAccount(privateKey).address }
}

export async function keepKey(key: HeldKey, privateKey: Hex): Promise<void> {
  await SecureStore.setItemAsync(secretKey(key.id), privateKey, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
  const list = await heldKeys()
  await save(LIST, [key, ...list.filter((k) => k.id !== key.id)])
}

export const heldKeys = () => load<HeldKey[]>(LIST, [])

/** The account that spends an allowance: the giver's wallet, signed for by this phone's key. */
export async function spendingAccount(key: HeldKey) {
  const privateKey = (await SecureStore.getItemAsync(secretKey(key.id))) as Hex | null
  if (!privateKey) throw new Error('This phone doesn’t hold the key for that allowance any more.')
  return Account.fromSecp256k1(privateKey, { access: key.owner })
}
