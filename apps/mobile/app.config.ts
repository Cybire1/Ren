import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Ren is one app on two chains, and each chain's build is its own app on a phone: Ren on Tempo
 * (`xyz.kova.pay`, the default) and on Monad (`xyz.kova.pay.monad`). app.json holds everything
 * they share; this picks the identity from EXPO_PUBLIC_KOVA_CHAIN.
 *
 * Each build is associated with its chain's website, whose association file lists the app: its
 * passkeys live there, so one passkey opens the same wallet in the app and on the web, and the
 * site's links (/pay, /s, /to) open the app when it's installed. On Tempo that's Ren's site, the
 * same one src/lib/config.ts points at; on Monad, mykova.app and its Railway twin.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const tempo = process.env.EXPO_PUBLIC_KOVA_CHAIN !== 'monad'
  const bundle = tempo ? 'xyz.kova.pay' : 'xyz.kova.pay.monad'
  const site = new URL(process.env.EXPO_PUBLIC_KOVA_TEMPO_WEB_URL ?? 'https://web-production-acdb.up.railway.app').hostname
  const passkeys = process.env.EXPO_PUBLIC_KOVA_PASSKEY_DOMAIN
  const domains = tempo
    ? [...new Set([site, ...(passkeys ? [passkeys] : [])])]
    : ['mykova.app', 'web-monad.up.railway.app']

  return {
    ...(config as ExpoConfig),
    name: 'Ren',
    ios: {
      ...config.ios,
      bundleIdentifier: bundle,
      associatedDomains: domains.flatMap((d) => [`webcredentials:${d}`, `applinks:${d}`]),
    },
    android: {
      ...config.android,
      package: bundle,
    },
  }
}
