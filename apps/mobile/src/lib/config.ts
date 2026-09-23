import { getNetwork, getToken, type NetworkId } from '@kova/tempo'

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

/** The token Kova settles in: USDC.e on mainnet, AlphaUSD standing in for it on testnet. */
export const settlementToken = getToken(networkId, 'USDC')

/** Kova's fee-payer relay. Merchant payments go through it so the payer never needs gas. */
export const relayUrl = `${apiUrl}/rpc/relay`
