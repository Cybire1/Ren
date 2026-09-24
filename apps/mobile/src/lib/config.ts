import { getNetwork, getToken, type NetworkId } from '@kova/monad'

/**
 * Where the app points. On a physical phone `localhost` is the phone itself, so set these to
 * your Mac's LAN address in `.env.local`.
 */
export const apiUrl = process.env.EXPO_PUBLIC_KOVA_API_URL ?? 'http://localhost:4000'
export const webUrl = process.env.EXPO_PUBLIC_KOVA_WEB_URL ?? 'http://localhost:3000'

export const networkId: NetworkId =
  process.env.EXPO_PUBLIC_KOVA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
export const network = getNetwork(networkId)
export const isTestnet = networkId === 'testnet'

/**
 * The domain Kova Pay's passkeys belong to. A wallet is bound to it for good, so it only
 * changes before real users: web-monad serves the Apple association file today, and
 * monad.mykova.app takes over once its DNS points there.
 */
export const passkeyDomain = process.env.EXPO_PUBLIC_KOVA_PASSKEY_DOMAIN ?? 'web-monad.up.railway.app'

/** The chain, as people see it named. */
export const chainName = 'Monad'

/** The dollar Kova settles in on Monad: AUSD, Agora's dollar, on mainnet and testnet alike. */
export const settlementToken = getToken(networkId, 'AUSD')
