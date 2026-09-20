import { type Currency, getNetwork, getToken } from '@kova/tempo'
import type { Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createClient, http } from 'viem/tempo'
import { config } from './config.js'

export const network = getNetwork(config.KOVA_NETWORK)
export const rpcUrl = config.TEMPO_RPC_URL ?? network.rpcUrl

/** The token Kova settles in on this network, and the token it pays fees in. */
export const settlementToken = getToken(config.KOVA_NETWORK, 'USDC')

export function tokenFor(currency: Currency) {
  return getToken(config.KOVA_NETWORK, currency)
}

/**
 * Kova's fee payer. It signs only the fee-payer half of a transaction, never a payment, so a
 * compromise costs gas and nothing else. Fee payers must be secp256k1 keys.
 */
export const feePayerAccount = config.KOVA_FEE_PAYER_PRIVATE_KEY
  ? privateKeyToAccount(config.KOVA_FEE_PAYER_PRIVATE_KEY as `0x${string}`)
  : undefined

export const feePayerAddress: Address | undefined = feePayerAccount?.address

/** Read-only client. Writes go through the relay, which is the only thing holding a key. */
export const publicClient = createClient({
  testnet: config.KOVA_NETWORK === 'testnet',
  feeToken: settlementToken.address,
  transport: http(rpcUrl),
})
