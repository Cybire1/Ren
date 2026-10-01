import { config } from '../config.js'

/**
 * Card and bank top-ups with Ramp Network. Ramp sells AUSD on Monad itself (MONAD_AUSD), so a
 * top-up lands in the wallet as the same dollars every Kova payment moves, with no swap. Kova
 * never touches the money: Ramp's hosted widget takes the card or bank payment and sends AUSD to
 * the wallet's address.
 *
 * Ramp's Monad assets are on mainnet, so on testnet this says so instead of giving a link.
 */
const RAMP = 'https://app.rampnetwork.com/'
/** Currencies Ramp prices AUSD in that Kova shows; others pay in USD. */
const FIAT = new Set(['USD', 'EUR', 'GBP', 'MXN'])

export interface TopUp {
  live: boolean
  provider: 'Ramp Network'
  /** The hosted widget, set up for this wallet; null until Kova is on mainnet with a Ramp key. */
  url: string | null
  /** Ramp's smallest card purchase, in euros. */
  min_eur: number
}

export function topUpFor(
  wallet: string,
  currency: string,
  dollars?: number,
  returnTo?: string,
): TopUp {
  const live = config.KOVA_NETWORK === 'mainnet' && Boolean(config.RAMP_HOST_API_KEY)
  if (!live || !config.RAMP_HOST_API_KEY)
    return { live: false, provider: 'Ramp Network', url: null, min_eur: 6.25 }
  const fiat = FIAT.has(currency) ? currency : 'USD'
  const params = new URLSearchParams({
    hostApiKey: config.RAMP_HOST_API_KEY,
    hostAppName: 'Kova',
    hostLogoUrl: 'https://mykova.app/icon.png',
    defaultFlow: 'ONRAMP',
    enabledFlows: 'ONRAMP',
    enabledCryptoAssets: 'MONAD_AUSD',
    outAsset: 'MONAD_AUSD',
    inAsset: fiat,
    userAddress: wallet,
    ...(dollars && dollars > 0 ? { inAssetValue: String(Math.round(dollars * 100)) } : {}),
    ...(returnTo ? { finalUrl: returnTo } : {}),
  })
  return { live: true, provider: 'Ramp Network', url: `${RAMP}?${params}`, min_eur: 6.25 }
}
