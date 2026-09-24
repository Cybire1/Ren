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

/** The chain, as people see it named. */
export const chainName = 'Monad'

/** The dollar Kova settles in on Monad: AUSD, Agora's dollar, on mainnet and testnet alike. */
export const settlementToken = getToken(networkId, 'AUSD')
