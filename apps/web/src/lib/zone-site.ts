import 'server-only'
import { getNetwork, getToken } from '@kova/tempo'
import { type Address, isAddress } from 'viem'
import { onTempo } from '@/lib/chain'
import type { ZoneConfig } from '@/lib/wallet/zone'

/**
 * The private zone this site offers (Tempo Zones), from its environment. Unset, the wallet has no
 * private balance: that is the switch. The zone's own RPC address and any key its operator gave
 * Ren stay here, on the server; the browser reaches the zone through /api/zone.
 *
 *   KOVA_ZONE_ID, KOVA_ZONE_CHAIN_ID, KOVA_ZONE_PORTAL  the zone, as its operator publishes it
 *   KOVA_ZONE_RPC_URL           its private (redacted) RPC
 *   KOVA_ZONE_RPC_AUTHORIZATION the operator's access key, when the zone asks for one
 *   KOVA_ZONE_OPERATOR          who runs it, as people see it named (default: Ren)
 *   KOVA_ZONE_RUNTIME           sandbox for Tempo's persistent testnet zones A and B
 *   KOVA_ZONE_PARENT_RPC, KOVA_ZONE_PARENT_CHAIN_ID
 *                               a Tempo other than this site's to deposit on (local tests only)
 */
export function zoneSite(): ZoneConfig | null {
  if (!onTempo) return null
  const id = Number(process.env.KOVA_ZONE_ID)
  const chainId = Number(process.env.KOVA_ZONE_CHAIN_ID)
  const portal = process.env.KOVA_ZONE_PORTAL
  if (!id || !chainId || !portal || !isAddress(portal) || !process.env.KOVA_ZONE_RPC_URL)
    return null
  const network = process.env.KOVA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
  return {
    id,
    chainId,
    portal: portal as Address,
    token:
      (process.env.KOVA_ZONE_TOKEN as Address | undefined) ?? getToken(network, 'USDC').address,
    parent: Number(process.env.KOVA_ZONE_PARENT_CHAIN_ID) || getNetwork(network).chainId,
    operator: process.env.KOVA_ZONE_OPERATOR ?? 'Ren',
    runtime: process.env.KOVA_ZONE_RUNTIME === 'sandbox' ? 'sandbox' : 'current',
    parentRpc: process.env.KOVA_ZONE_PARENT_RPC ?? null,
  }
}
