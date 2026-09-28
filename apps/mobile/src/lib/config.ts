import { getNetwork as monadNetwork, getToken as monadToken } from '@kova/monad'
import { getNetwork as tempoNetwork, getToken as tempoToken } from '@kova/tempo'

/**
 * Kova is one app on two chains. A build runs on one, picked by EXPO_PUBLIC_KOVA_CHAIN: Tempo
 * (the default) or Monad. Everything that differs sits in `chain.ts` and here; screens only ever
 * ask for `chainName`, `settlementToken` and `explorerName` when they need to say it.
 */
export type ChainName = 'tempo' | 'monad'
export const chain: ChainName = process.env.EXPO_PUBLIC_KOVA_CHAIN === 'monad' ? 'monad' : 'tempo'
export const onTempo = chain === 'tempo'

/**
 * Where this build points: Kova's deployment for its chain, unless the variables say otherwise
 * (a local API, say; on a physical phone use your Mac's LAN address, since `localhost` is the
 * phone). Each chain has its own variables, so one untracked `.env` can serve both builds.
 */
export const apiUrl = onTempo
  ? (process.env.EXPO_PUBLIC_KOVA_TEMPO_API_URL ?? 'https://api-tempo.up.railway.app')
  : (process.env.EXPO_PUBLIC_KOVA_MONAD_API_URL ?? 'https://api-monad.up.railway.app')
export const webUrl = onTempo
  ? (process.env.EXPO_PUBLIC_KOVA_TEMPO_WEB_URL ?? 'https://tempo.mykova.app')
  : (process.env.EXPO_PUBLIC_KOVA_MONAD_WEB_URL ?? 'https://mykova.app')

export type NetworkId = 'mainnet' | 'testnet'
export const networkId: NetworkId =
  process.env.EXPO_PUBLIC_KOVA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
export const network = onTempo ? tempoNetwork(networkId) : monadNetwork(networkId)
export const isTestnet = networkId === 'testnet'

/**
 * The domain Kova Pay's passkeys belong to: iOS shows it when you make or use one, and a wallet
 * is bound to it for good. mykova.app serves the Apple association file that vouches for the app.
 * Both builds use it, so one passkey opens the same wallet address on Tempo and on Monad.
 */
export const passkeyDomain = process.env.EXPO_PUBLIC_KOVA_PASSKEY_DOMAIN ?? 'mykova.app'

/** The chain, as people see it named. */
export const chainName = onTempo ? 'Tempo' : 'Monad'

/** Where people can look a transaction up. */
export const explorerName = onTempo ? 'Tempo Explorer' : 'Monadscan'

/**
 * The dollar Kova settles in: USDC on Tempo (USDC.e on mainnet, AlphaUSD standing in on testnet,
 * whose faucet doesn't hand out USDC.e), AUSD, Agora's dollar, on Monad.
 */
export const settlementToken = onTempo
  ? tempoToken(networkId, 'USDC')
  : monadToken(networkId, 'AUSD')

/** Local keys that belong to one chain (history, balance, cursor) carry its name. */
export const chainKey = (name: string) => `kova.${chain}.${name}`
