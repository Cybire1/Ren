import type { Chain, Hash } from 'viem'
import { monad, monadTestnet } from 'viem/chains'

export type NetworkId = 'mainnet' | 'testnet'

export interface Network {
  id: NetworkId
  name: string
  chain: Chain
  chainId: number
  rpcUrl: string
  explorerUrl: string
}

/**
 * Monad networks. Checked live on 2026-09-24: testnet answers chain id 10143, with a block
 * every ~0.31s and eth_getLogs capped at 100 blocks a call. Explorer links go to Monadscan on
 * both networks (viem's default testnet explorer turns scripted visitors away).
 */
export const networks: Record<NetworkId, Network> = {
  mainnet: {
    id: 'mainnet',
    name: 'Monad',
    chain: monad,
    chainId: 143,
    rpcUrl: 'https://rpc.monad.xyz',
    explorerUrl: 'https://monadscan.com',
  },
  testnet: {
    id: 'testnet',
    name: 'Monad testnet',
    chain: monadTestnet,
    chainId: 10143,
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    explorerUrl: 'https://testnet.monadscan.com',
  },
}

export function getNetwork(id: NetworkId): Network {
  return networks[id]
}

export function networkByChainId(chainId: number): Network {
  const found = Object.values(networks).find((n) => n.chainId === chainId)
  if (!found) throw new Error(`Unknown Monad chain id: ${chainId}`)
  return found
}

/** eth_getLogs spans at most this many blocks on Monad's public RPCs. */
export const LOG_RANGE = 100n

export function explorerTxUrl(network: Network, hash: Hash): string {
  return `${network.explorerUrl}/tx/${hash}`
}

export function explorerAddressUrl(network: Network, address: string): string {
  return `${network.explorerUrl}/address/${address}`
}
