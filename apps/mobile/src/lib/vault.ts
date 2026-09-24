import { base64urlnopad } from '@scure/base'
import * as SecureStore from 'expo-secure-store'
import { openVault, sealAndUpload, type VaultContents } from './vault-core'

/**
 * The wallet's vault: what Kova Pay knows about its owner (their name, the currency they think
 * in, the names they gave people), sealed on the phone and backed up to Kova, which cannot read it.
 * One passkey, two unrelated keys: the wallet's, and this one (vault-core.ts). On a new phone the
 * passkey brings back the wallet, and the vault brings back who you are. Saving needs no Face ID,
 * because the vault key can't move money, so it waits in the Keychain without a biometric lock.
 */
const SECRET = 'kova.monad.vault.v1'

export { openVault, type VaultContents }

export async function keepVaultSecret(secret: Uint8Array) {
  await SecureStore.setItemAsync(SECRET, base64urlnopad.encode(secret), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
}

export async function forgetVaultSecret() {
  await SecureStore.deleteItemAsync(SECRET)
}

/** Backs up the vault. Quietly does nothing before the passkey has given a vault key. */
export async function saveVault(contents: VaultContents): Promise<void> {
  const stored = await SecureStore.getItemAsync(SECRET)
  if (stored) await sealAndUpload(base64urlnopad.decode(stored), contents)
}
