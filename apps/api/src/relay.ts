import { Handler } from 'tapimo/server'
import { feePayerAccount, network, publicClient, settlementToken } from './chain.js'
import { config } from './config.js'
import { settleFromReceipt } from './services/settle.js'
import { shouldSponsor } from './services/sponsorship.js'

/**
 * Kova's fee-payer relay: the Tempo RPC endpoint the apps and terminals talk to.
 *
 * Clients build and sign their own payments; the relay adds the fee-payer signature so the
 * user never needs a gas token. `validate` is the gate that keeps Kova's wallet from paying
 * for anything other than a real Kova payment.
 */
/** Mount path. The handler matches on it, so it must equal the route in index.ts. */
export const relayPath = '/rpc/relay'

export const relayHandler = feePayerAccount
  ? Handler.relay({
      features: 'all',
      path: relayPath,
      // Without this the handler falls back to a mainnet client and simulates our testnet
      // payments against mainnet, where the token does not exist.
      getClient: () => publicClient as never,
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
