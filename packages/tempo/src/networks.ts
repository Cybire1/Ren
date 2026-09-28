import type { Chain, Hash } from 'viem'
import { tempo, tempoModerato } from 'viem/chains'

export type NetworkId = 'mainnet' | 'testnet'

export interface Network {
  id: NetworkId
  /** What people see: "Tempo", or "Tempo testnet". */
  name: string
  chain: Chain
  chainId: number
  rpcUrl: string
  wsUrl: string
  explorerUrl: string
  /** Keyless public fee sponsor. Only Moderato has one; mainnet uses Kova's own fee payer. */
  publicSponsorUrl: string | undefined
}

/** Tempo networks. Values verified live on 2026-09-19 (docs/tempo/01 §1.1). */
export const networks: Record<NetworkId, Network> = {
  mainnet: {
    id: 'mainnet',
    name: 'Tempo',
    chain: tempo,
    chainId: 4217,
    rpcUrl: 'https://rpc.tempo.xyz',
    wsUrl: 'wss://rpc.tempo.xyz',
    explorerUrl: 'https://explore.tempo.xyz',
    publicSponsorUrl: undefined,
  },
  testnet: {
    id: 'testnet',
    name: 'Tempo testnet',
    chain: tempoModerato,
    chainId: 42431,
    rpcUrl: 'https://rpc.moderato.tempo.xyz',
    wsUrl: 'wss://rpc.moderato.tempo.xyz',
    explorerUrl: 'https://explore.testnet.tempo.xyz',
    publicSponsorUrl: 'https://sponsor.moderato.tempo.xyz',
  },
}

/**
 * Blocks per `eth_getLogs` call. Tempo's RPCs refuse ranges over 100,000 blocks; a busy testnet
 * token fills a response long before that, so scans step through smaller windows.
 */
export const LOG_RANGE = 5_000n

export function getNetwork(id: NetworkId): Network {
  return networks[id]
}

export function networkByChainId(chainId: number): Network {
  const network = Object.values(networks).find((n) => n.chainId === chainId)
  if (!network) throw new Error(`Unsupported Tempo chain id: ${chainId}`)
  return network
}

export function explorerTxUrl(network: Network, hash: Hash): string {
  return `${network.explorerUrl}/tx/${hash}`
}

export function explorerAddressUrl(network: Network, address: string): string {
  return `${network.explorerUrl}/address/${address}`
}
