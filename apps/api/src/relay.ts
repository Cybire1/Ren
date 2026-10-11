import {
  eip3009Abi,
  type Token,
  type TransferAuthorization,
  transferAuthorizationTypedData,
  transferWithAuthorizationArgs,
} from '@kova/monad'
import {
  encodeFunctionData,
  type Hex,
  isAddressEqual,
  keccak256,
  nonceManager,
  recoverTypedDataAddress,
  type TransactionReceipt,
} from 'viem'
import { sendRawTransactionSync } from 'viem/actions'
import { feePayerAccount, network, publicClient, walletClient } from './chain.js'
import { config } from './config.js'
import { KovaError } from './errors.js'

/**
 * Kova's relayer on Monad.
 *
 * Monad has no fee payer and no transfer memo, so Kova uses EIP-3009 for both: the payer signs a
 * transfer authorization on their phone or in their browser, and this relayer submits it and
 * pays the MON gas. Nobody needs MON to pay or to be paid. The authorization's nonce carries the
 * Kova memo of the charge it pays, which the token records on-chain (AuthorizationUsed).
 *
 * Every check that can be made for free is made before any gas is spent: the signature is
 * recovered here, and the call is estimated (which runs the token's own checks) before sending.
 * Latency matters, because this sits between a tap and a PAID screen: the happy path is one
 * estimate and one eth_sendRawTransactionSync.
 */

export interface Relayed {
  receipt: TransactionReceipt
  ms: number
}

export const relayReady = () => Boolean(walletClient && feePayerAccount)

/** Authorizations being submitted right now, so a double tap or a retry submits only once. */
const inFlight = new Map<string, Promise<Relayed>>()

export function relayAuthorization(token: Token, authorization: TransferAuthorization, signature: Hex): Promise<Relayed> {
  const key = `${token.address}:${authorization.from}:${authorization.nonce}`.toLowerCase()
  const running = inFlight.get(key)
  if (running) return running
  const job = submit(token, authorization, signature).finally(() => inFlight.delete(key))
  inFlight.set(key, job)
  return job
}

async function submit(token: Token, authorization: TransferAuthorization, signature: Hex): Promise<Relayed> {
  if (!walletClient || !feePayerAccount) throw new KovaError('chain_error', 'Payments are not switched on for this server yet.')
  const started = performance.now()

  const now = BigInt(Math.floor(Date.now() / 1000))
  if (authorization.value <= 0n) throw new KovaError('invalid_request', 'A payment has to move some money.')
  if (authorization.validAfter > now) throw new KovaError('invalid_request', 'This payment is not valid yet.')
  if (authorization.validBefore <= now + 5n) throw new KovaError('invalid_request', 'This approval ran out. Approve the payment again.')

  // A wrong signature costs nothing to spot here, and gas to learn on-chain.
  const signer = await recoverTypedDataAddress({
    ...transferAuthorizationTypedData(token, network.chainId, authorization),
    signature,
  }).catch(() => null)
  if (!signer || !isAddressEqual(signer, authorization.from))
    throw new KovaError('invalid_request', 'The approval was not signed by the wallet paying.')

  const args = transferWithAuthorizationArgs(authorization, signature)
  const data = encodeFunctionData({ abi: eip3009Abi, functionName: 'transferWithAuthorization', args })

  let gas: bigint
  let fees: Fees
  try {
    // The estimate runs the token's own checks: an authorization that is used, expired, or
    // short of funds fails here, before Kova pays anything.
    ;[gas, fees] = await Promise.all([
      publicClient.estimateGas({ account: feePayerAccount, to: token.address, data }),
      currentFees(),
    ])
  } catch (error) {
    throw await explainRefusal(token, authorization, error)
  }
  if (gas > config.KOVA_MAX_RELAY_GAS) throw new KovaError('policy_declined', 'This payment would cost more gas than Ren relays.')

  // Monad charges for the gas limit, not the gas used, so ask for the estimate plus a sliver.
  const request = await walletClient.prepareTransactionRequest({
    account: feePayerAccount,
    chain: network.chain,
    to: token.address,
    data,
    type: 'eip1559',
    gas: gas + gas / 20n,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  })
  const serializedTransaction = await walletClient.signTransaction(request)
  const hash = keccak256(serializedTransaction)

  let receipt: TransactionReceipt | null
  try {
    receipt = await sendRawTransactionSync(publicClient, { serializedTransaction, timeout: 6_000 })
  } catch (error) {
    // The node may have taken it and only been slow to answer: look for the receipt before giving up.
    receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 8_000 }).catch(() => null)
    if (!receipt) {
      nonceManager.reset({ address: feePayerAccount.address, chainId: network.chainId })
      console.error('[relay] send failed', hash, shortMessage(error))
      throw new KovaError('chain_error', 'Monad did not confirm the payment in time. If it went through, it will show as paid in a moment.', { tx_hash: hash })
    }
  }

  if (receipt.status !== 'success')
    throw new KovaError('chain_error', 'Monad refused the payment. No money moved.', { tx_hash: receipt.transactionHash })
  return { receipt, ms: performance.now() - started }
}

/** Why the token refused an authorization, in words a payer can act on. */
async function explainRefusal(token: Token, authorization: TransferAuthorization, error: unknown): Promise<KovaError> {
  const [used, balance] = await Promise.all([
    publicClient
      .readContract({ address: token.address, abi: eip3009Abi, functionName: 'authorizationState', args: [authorization.from, authorization.nonce] })
      .catch(() => null),
    publicClient
      .readContract({ address: token.address, abi: eip3009Abi, functionName: 'balanceOf', args: [authorization.from] })
      .catch(() => null),
  ])
  if (used) return new KovaError('conflict', 'This payment has already been made.')
  if (balance !== null && balance < authorization.value)
    return new KovaError('policy_declined', 'There isn’t enough money in this wallet to pay.', { balance: balance.toString() })
  console.warn('[relay] refused', shortMessage(error))
  return new KovaError('chain_error', `${token.symbol} refused this payment. No money moved.`, { reason: shortMessage(error) })
}

interface Fees {
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

/** Fee quotes change slowly on Monad; reusing one for a few seconds saves two calls per payment. */
let feeQuote: { fees: Fees; at: number } | undefined

async function currentFees(): Promise<Fees> {
  if (feeQuote && Date.now() - feeQuote.at < 10_000) return feeQuote.fees
  const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas()
  feeQuote = { fees: { maxFeePerGas, maxPriorityFeePerGas }, at: Date.now() }
  return feeQuote.fees
}

function shortMessage(error: unknown): string {
  const e = error as { shortMessage?: string; details?: string; message?: string }
  return [e.shortMessage ?? e.message ?? String(error), e.details].filter(Boolean).join(' | ').slice(0, 300)
}
