import { Handler, Store } from 'tapimo/server'
import { feePayerAccount, publicClient, settlementToken } from './chain.js'
import { config } from './config.js'
import { shouldSponsor } from './services/sponsorship.js'

/**
 * Kova's fee-payer relay: the Tempo RPC endpoint the apps and terminals talk to.
 *
 * Clients build and sign their own payments; the relay adds the fee-payer signature so the
 * user never needs a gas token. `validate` is the gate that keeps Kova's wallet from paying
 * for anything other than a real Kova payment.
 *
 * Latency matters here — this sits between a tap and a PAID screen — so the relay is
 * configured to make as few upstream RPC calls as possible.
 */

/** Mount path. The handler matches on it, so it must equal the route in index.ts. */
export const relayPath = '/rpc/relay'

/** Memoizes TIP-20 metadata and fee-token preferences instead of re-reading them per payment. */
const cache = Store.memory()

export const relayHandler = feePayerAccount
  ? Handler.relay({
      path: relayPath,
      cache,
      // Without this the handler falls back to a mainnet client and simulates our testnet
      // payments against mainnet, where the token does not exist.
      getClient: () => publicClient as never,
      // Kova settles in one token, so there is nothing to discover. The default implementation
      // fetches Tempo's verified-token list over the internet on every fill.
      resolveTokens: () => [settlementToken.address],
      // `features: 'all'` adds balance simulation before signing, which costs two upstream
      // round trips per payment. Kova's own validate already pins the call, amount, token and
      // recipient to an open intent, and a reverted payment costs the sponsor about $0.00004,
      // so the check is not worth the latency in the tap path.
      feePayer: {
        account: feePayerAccount,
        feeToken: settlementToken.address,
        name: 'Kova',
        url: 'https://kova.xyz',
        validate: async (request) => {
          const decision = await shouldSponsor(request as never, {
            maxFee: config.KOVA_MAX_SPONSORED_FEE,
          })
          if (!decision.sponsor) {
            console.warn('sponsorship declined', { reason: decision.reason })
            return false
          }
          return true
        },
      },
    })
  : undefined
