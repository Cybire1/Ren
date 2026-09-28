import { Handler, Store } from 'tapimo/server'
import { feePayerAccount, publicClient, settlementToken } from '../chain.js'
import { config } from '../config.js'
import { shouldSponsor } from './sponsorship.js'

/**
 * Kova's fee-payer relay on Tempo: the RPC endpoint Kova Pay, the web wallet and terminals point
 * their transport at (viem's `withRelay`).
 *
 * Payers build and sign their own payments; the relay adds the fee payer's signature, so nobody
 * needs a gas token and a $4.60 charge costs the payer exactly $4.60. `validate` is the gate
 * that keeps Kova's wallet from paying for anything but a Kova charge or a send between people.
 *
 * Latency matters here (it sits between Pay and a PAID screen), so the relay makes as few
 * upstream calls as it can.
 */

/** Mount path. The handler matches on it, so it must equal the route in index.ts. */
export const relayPath = '/rpc/relay'

/** Memoizes TIP-20 metadata and fee-token preferences instead of re-reading them per payment. */
const cache = Store.memory()

export const relayHandler = feePayerAccount
  ? Handler.relay({
      path: relayPath,
      cache,
      // Without this the handler falls back to a mainnet client and simulates testnet payments
      // against mainnet, where the token does not exist.
      getClient: () => publicClient as never,
      // Kova pays fees in one token, so there is nothing to discover. The default fetches
      // Tempo's verified-token list over the internet on every fill.
      resolveTokens: () => [settlementToken.address],
      // Balance simulation before signing costs two upstream round trips per payment. The policy
      // already pins the call, amount, token and recipient, and a reverted payment costs the
      // sponsor a fraction of a cent, so the check is not worth the latency.
      feePayer: {
        account: feePayerAccount,
        feeToken: settlementToken.address,
        name: 'Kova',
        url: 'https://mykova.app',
        validate: async (request) => {
          const decision = await shouldSponsor(request as never, {
            maxFee: config.KOVA_MAX_SPONSORED_FEE,
          })
          if (!decision.sponsor) {
            console.warn('[relay] sponsorship declined', { reason: decision.reason })
            return false
          }
          return true
        },
      },
    })
  : undefined
