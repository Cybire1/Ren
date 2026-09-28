import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Kova is one app on two chains, and each chain's build is its own app on a phone: Kova on Tempo
 * (`xyz.kova.pay`, the default) and Kova on Monad (`xyz.kova.pay.monad`). app.json holds
 * everything they share; this picks the identity from EXPO_PUBLIC_KOVA_CHAIN.
 *
 * Both are associated with mykova.app, where the passkeys live, so one passkey opens the same
 * wallet address in either app. The association file there lists both bundle ids.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const tempo = process.env.EXPO_PUBLIC_KOVA_CHAIN !== 'monad'
  const bundle = tempo ? 'xyz.kova.pay' : 'xyz.kova.pay.monad'
  // The chain's own web app also vouches for its links (/pay, /s, /to) while it lives on Railway.
  const web = tempo ? process.env.KOVA_TEMPO_WEB_HOST : 'web-monad.up.railway.app'
  const domains = ['mykova.app', ...(web ? [web] : [])]

  return {
    ...(config as ExpoConfig),
    name: 'Kova',
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
