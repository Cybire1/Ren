import { RpcResponse } from 'ox'
import { Relay } from 'viem/tempo'
import { feePayerAccount, publicClient, settlementToken } from '../chain.js'
import { config } from '../config.js'
import { shouldSponsor } from './sponsorship.js'

/**
 * Ren's fee-payer relay on Tempo: the RPC endpoint the iPhone app, the web wallet and terminals
 * point their transport at (viem's `withRelay`). Built on viem's own `Relay`.
 *
 * Payers build and sign their own payments; the relay adds the fee payer's signature, so nobody
 * needs a gas token and a $4.60 charge costs the payer exactly $4.60. `validate` is the gate
 * that keeps Ren's wallet from paying for anything but a Ren charge or a send between people.
 *
 * Latency matters here (it sits between Pay and a PAID screen), so the relay makes as few
 * upstream calls as it can.
 */

/** Mount path; it must equal the route in index.ts. */
export const relayPath = '/rpc/relay'

/**
 * viem's fee payer falls back to a fill the sender pays for when `validate` says no. Ren's
 * wallets expect every payment through this relay to be sponsored, and a payment by a limited
 * key would otherwise spend part of its limit on the fee, so a fill Ren won't sponsor is refused.
 */
const onlySponsored: Relay.Plugin = {
  async handleRequest(context, next) {
    await next()
    if (context.request.method !== 'eth_fillTransaction') return context.result
    const result = context.result as { capabilities?: { sponsored?: boolean } } | undefined
    if (!result?.capabilities?.sponsored)
      throw new RpcResponse.InvalidRequestError({
        message: 'Ren only pays the fee for Ren payments.',
      })
    return context.result
  },
}

export const relayHandler = feePayerAccount
  ? Relay.create({
      // Without its own client the relay would simulate testnet payments against mainnet.
      client: publicClient as never,
      // Ren pays fees in one token, so there is nothing to discover. The default reads Tempo's
      // verified-token list over the internet on every fill.
      resolveTokens: () => [settlementToken.address],
      plugins: [
        onlySponsored,
        Relay.feePayer({
          account: feePayerAccount,
          feeToken: settlementToken.address,
          name: 'Ren',
          url: config.KOVA_PUBLIC_WEB_URL,
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
        }),
      ],
    })
  : undefined
