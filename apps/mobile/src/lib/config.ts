import { getNetwork as monadNetwork, getToken as monadToken } from '@kova/monad'
import { getNetwork as tempoNetwork, getToken as tempoToken } from '@kova/tempo'
import type { Address } from 'viem'
import type { ZoneInfo } from './zone'

/**
 * Ren is one app on two chains. A build runs on one, picked by EXPO_PUBLIC_KOVA_CHAIN: Tempo
 * (the default) or Monad. Everything that differs sits in `chain.ts` and here; screens only ever
 * ask for `chainName`, `settlementToken` and `explorerName` when they need to say it.
 */
export type ChainName = 'tempo' | 'monad'
export const chain: ChainName = process.env.EXPO_PUBLIC_KOVA_CHAIN === 'monad' ? 'monad' : 'tempo'
export const onTempo = chain === 'tempo'

/**
 * Where this build points: Ren's deployment for its chain, unless the variables say otherwise
 * (a local API, say; on a physical phone use your Mac's LAN address, since `localhost` is the
 * phone). Each chain has its own variables, so one untracked `.env` can serve both builds. The
 * Monad build points at Monad mainnet; EXPO_PUBLIC_KOVA_MONAD_API_URL=https://api-monad.up.railway.app
 * with EXPO_PUBLIC_KOVA_NETWORK=testnet runs it on the free testnet. Ren's Tempo site lives on
 * Railway until Ren's own domain points at it; app.config.ts names the same site.
 */
export const apiUrl = onTempo
  ? (process.env.EXPO_PUBLIC_KOVA_TEMPO_API_URL ?? 'https://api-production-a594b.up.railway.app')
  : (process.env.EXPO_PUBLIC_KOVA_MONAD_API_URL ?? 'https://api-monad-mainnet.up.railway.app')
export const webUrl = onTempo
  ? (process.env.EXPO_PUBLIC_KOVA_TEMPO_WEB_URL ?? 'https://web-production-acdb.up.railway.app')
  : (process.env.EXPO_PUBLIC_KOVA_MONAD_WEB_URL ?? 'https://mykova.app')

/**
 * Tempo builds run on testnet (free test dollars) unless EXPO_PUBLIC_KOVA_NETWORK=mainnet; Monad
 * builds run on mainnet unless EXPO_PUBLIC_KOVA_NETWORK=testnet.
 */
export type NetworkId = 'mainnet' | 'testnet'
const networkSetting = process.env.EXPO_PUBLIC_KOVA_NETWORK
export const networkId: NetworkId =
  networkSetting === 'mainnet' || networkSetting === 'testnet'
    ? networkSetting
    : onTempo
      ? 'testnet'
      : 'mainnet'
export const network = onTempo ? tempoNetwork(networkId) : monadNetwork(networkId)
export const isTestnet = networkId === 'testnet'

/**
 * The domain Ren's passkeys belong to: iOS shows it when you make or use one, and a wallet
 * is bound to it for good. It's the chain's own website, whose Apple association file vouches for
 * this app, so one passkey opens the same wallet here and on the web: Ren's site on Tempo,
 * mykova.app on Monad. A shop's wallet signs in for this domain too, so the API must allow it.
 */
export const passkeyDomain =
  process.env.EXPO_PUBLIC_KOVA_PASSKEY_DOMAIN ??
  (onTempo ? webUrl.replace(/^[a-z]+:\/\//i, '').replace(/[:/?#].*$/, '') : 'mykova.app')

/** The chain, as people see it named. */
export const chainName = onTempo ? 'Tempo' : 'Monad'

/** Where people can look a transaction up. */
export const explorerName = onTempo ? 'Tempo Explorer' : 'Monadscan'

/**
 * Deposits from other chains (Aurora Intents, app/from-chain.tsx). Monad only, and off until it
 * can work end to end: it needs mainnet, a working Monad route and AUSD as a destination, which
 * NEAR Intents doesn't offer yet. EXPO_PUBLIC_KOVA_CHAIN_DEPOSITS=1 shows it on a Monad build.
 */
export const chainDeposits = !onTempo && process.env.EXPO_PUBLIC_KOVA_CHAIN_DEPOSITS === '1'

/**
 * The dollar Ren settles in: USDC on Tempo (USDC.e on mainnet, AlphaUSD standing in on testnet,
 * whose faucet doesn't hand out USDC.e), AUSD, Agora's dollar, on Monad.
 */
export const settlementToken = onTempo
  ? tempoToken(networkId, 'USDC')
  : monadToken(networkId, 'AUSD')

/**
 * Private notes travel with a send, sealed against its EIP-3009 authorization (notes-core.ts). A
 * Monad send has one; a Tempo transfer doesn't, so on Tempo a note stays on the sender's phone.
 */
export const notesTravel = !onTempo

/** Local keys that belong to one chain (history, balance, cursor) carry its name. */
export const chainKey = (name: string) => `kova.${chain}.${name}`

/**
 * The private zone (Tempo Zones) the wallet keeps a private balance on (zone.ts): on Tempo testnet,
 * Tempo's persistent Zone A, the one Ren's site uses. EXPO_PUBLIC_KOVA_ZONE_ID and the rest of the
 * EXPO_PUBLIC_KOVA_ZONE_* variables point a build at another; EXPO_PUBLIC_KOVA_ZONE_ID=0 turns it off.
 */
const zoneId = Number(process.env.EXPO_PUBLIC_KOVA_ZONE_ID ?? (onTempo && isTestnet ? 6 : 0))
export const zone: ZoneInfo | null =
  onTempo && zoneId > 0
    ? {
        id: zoneId,
        chainId: Number(process.env.EXPO_PUBLIC_KOVA_ZONE_CHAIN_ID ?? 4_217_000_006),
        portal: (process.env.EXPO_PUBLIC_KOVA_ZONE_PORTAL ??
          '0x7069DeC4E64Fd07334A0933eDe836C17259c9B23') as Address,
        token: settlementToken.address,
        parent: network.chainId,
        operator: process.env.EXPO_PUBLIC_KOVA_ZONE_OPERATOR ?? 'Tempo',
        runtime: process.env.EXPO_PUBLIC_KOVA_ZONE_RUNTIME === 'current' ? 'current' : 'sandbox',
        rpc: process.env.EXPO_PUBLIC_KOVA_ZONE_RPC_URL ?? 'https://rpc-zone-a.testnet.tempo.xyz',
        proxy: process.env.EXPO_PUBLIC_KOVA_ZONE_PROXY_URL ?? `${webUrl}/api/zone`,
      }
    : null
