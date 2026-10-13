import { getNetwork as monadNetwork, getToken as monadToken } from '@kova/monad'
import { getNetwork as tempoNetwork, getToken as tempoToken } from '@kova/tempo'

/**
 * Kova is one site on two chains. A deployment runs on one, picked at build time by
 * NEXT_PUBLIC_KOVA_CHAIN: Tempo (the default) or Monad. Pages and components that need to say
 * which, or to move money, ask here; everything else is the same on both.
 */
export type ChainName = 'tempo' | 'monad'
export type NetworkId = 'mainnet' | 'testnet'

export const chain: ChainName = process.env.NEXT_PUBLIC_KOVA_CHAIN === 'monad' ? 'monad' : 'tempo'
export const onTempo = chain === 'tempo'

/** The chain, as people see it named. */
export const chainName = onTempo ? 'Tempo' : 'Monad'

/** Where people can look a transaction up. */
export const explorerName = onTempo ? 'Tempo Explorer' : 'Monadscan'

export const networkOf = (id: NetworkId) => (onTempo ? tempoNetwork(id) : monadNetwork(id))

/** The chain id of a network, e.g. for a signed-in message. */
export const chainIdOf = (id: NetworkId) => networkOf(id).chainId

/** Mainnet chain ids, where keys are live keys. */
export const isMainnetChain = (chainId: number) => chainId === 4217 || chainId === 143

/**
 * The dollar Kova settles in: USDC on Tempo (USDC.e on mainnet, AlphaUSD on testnet), AUSD,
 * Agora's dollar, on Monad.
 */
export const settlementTokenOf = (id: NetworkId) =>
  onTempo ? tempoToken(id, 'USDC') : monadToken(id, 'AUSD')

/** What a browser wallet needs to add the chain if it has never seen it. */
export const walletChains: Record<
  number,
  {
    chainName: string
    rpcUrls: string[]
    blockExplorerUrls: string[]
    nativeCurrency: { name: string; symbol: string; decimals: number }
  }
> = {
  // Tempo has no gas token; wallets insist on a native currency, so it is named for the dollars
  // fees are paid in. Its balance is a placeholder the chain returns and never spends.
  42431: {
    chainName: 'Tempo Testnet (Moderato)',
    rpcUrls: ['https://rpc.moderato.tempo.xyz'],
    blockExplorerUrls: ['https://explore.testnet.tempo.xyz'],
    nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
  },
  4217: {
    chainName: 'Tempo',
    rpcUrls: ['https://rpc.tempo.xyz'],
    blockExplorerUrls: ['https://explore.tempo.xyz'],
    nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
  },
  10143: {
    chainName: 'Monad Testnet',
    rpcUrls: ['https://testnet-rpc.monad.xyz'],
    blockExplorerUrls: ['https://testnet.monadscan.com'],
    nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  },
  143: {
    chainName: 'Monad',
    rpcUrls: ['https://rpc.monad.xyz'],
    blockExplorerUrls: ['https://monadscan.com'],
    nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  },
}

/** A wallet's page on the chain's explorer. */
export const explorerAddressUrl = (id: NetworkId, address: string) => `${networkOf(id).explorerUrl}/address/${address}`
