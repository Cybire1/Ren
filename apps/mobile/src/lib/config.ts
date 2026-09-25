import { getNetwork, getToken, type NetworkId } from '@kova/monad'

/**
 * Where the Monad build points: Kova's Monad deployment, unless the MONAD variables say otherwise
 * (a local API, say; on a physical phone use your Mac's LAN address, since `localhost` is the phone).
 * The Tempo build's EXPO_PUBLIC_KOVA_API_URL and _WEB_URL don't apply here: one untracked `.env`
 * serves both branches, and reading them sent this build to Tempo's API.
 */
export const apiUrl = process.env.EXPO_PUBLIC_KOVA_MONAD_API_URL ?? 'https://api-monad.up.railway.app'
export const webUrl = process.env.EXPO_PUBLIC_KOVA_MONAD_WEB_URL ?? 'https://mykova.app'

export const networkId: NetworkId =
  process.env.EXPO_PUBLIC_KOVA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
export const network = getNetwork(networkId)
export const isTestnet = networkId === 'testnet'

/**
 * The domain Kova Pay's passkeys belong to: iOS shows it when you make or use one, and a wallet
 * is bound to it for good. mykova.app serves the Apple association file that vouches for the app.
 */
export const passkeyDomain = process.env.EXPO_PUBLIC_KOVA_PASSKEY_DOMAIN ?? 'mykova.app'

/** The chain, as people see it named. */
export const chainName = 'Monad'

/** The dollar Kova settles in on Monad: AUSD, Agora's dollar, on mainnet and testnet alike. */
export const settlementToken = getToken(networkId, 'AUSD')
