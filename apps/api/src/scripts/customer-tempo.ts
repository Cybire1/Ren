/**
 * A throwaway customer on Tempo for scripts and tests: a fresh key, test dollars from a Kova
 * API's faucet, and payments made exactly the way Kova Pay makes them. It never pays a fee:
 * every payment goes through Kova's fee-payer relay.
 */
import { networkByChainId } from '@kova/tempo'
import { type Address, type Hex, http, type LocalAccount } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Actions, createClient, withRelay } from 'viem/tempo'
import type { Checkout } from './customer.js'

export type { Checkout }

export interface Paid extends Checkout {
  payment: { payer: Address; tx_hash: Hex; explorer_url: string } | null
}

export const newCustomer = (): LocalAccount => privateKeyToAccount(generatePrivateKey())

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  const body = (await response.json().catch(() => ({}))) as { error?: unknown }
  if (!response.ok)
    throw new Error(
      `${init?.method ?? 'GET'} ${url}: ${response.status} ${JSON.stringify(body.error ?? body)}`,
    )
  return body as T
}

export const getCheckout = (api: string, id: string) => call<Checkout>(`${api}/v1/checkout/${id}`)

/** A Tempo client for this customer that sends through Kova's relay, as Kova Pay does. */
export function walletFor(api: string, chainId: number, customer: LocalAccount, feeToken: Address) {
  const network = networkByChainId(chainId)
  return createClient({
    account: customer,
    testnet: network.id === 'testnet',
    feeToken,
    transport: withRelay(http(network.rpcUrl), http(`${api}/rpc/relay`)),
  })
}

/** Asks the API's faucet for test dollars and waits until they land. Returns the balance. */
export async function fund(api: string, address: Address): Promise<bigint> {
  const health = await call<{ chain_id: number; settlement_token: { address: Address } }>(
    `${api}/health`,
  )
  const network = networkByChainId(health.chain_id)
  const client = createClient({
    testnet: network.id === 'testnet',
    transport: http(network.rpcUrl),
  })
  await call(`${api}/v1/faucet`, { method: 'POST', body: JSON.stringify({ address }) })
  for (let i = 0; i < 80; i++) {
    const { amount } = await Actions.token.getBalance(client as never, {
      account: address,
      token: health.settlement_token.address,
    })
    if (amount > 0n) return amount
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`test dollars never reached ${address}`)
}

/**
 * Pays a checkout as Kova Pay does: a `transferWithMemo` of exactly the charge, signed by the
 * customer, with Kova's fee payer adding the fee through the relay; then tells Kova the hash so
 * the shop sees PAID at once (the watcher would find it anyway).
 */
export async function pay(
  api: string,
  checkout: Checkout,
  customer: LocalAccount,
): Promise<Paid & { roundTripMs: number; payMs: number }> {
  const client = walletFor(api, checkout.chain_id, customer, checkout.token)
  const started = Date.now()
  const { receipt } = await client.token.transferSync({
    token: checkout.token,
    to: checkout.pay_to,
    amount: BigInt(checkout.amount_base),
    memo: checkout.memo,
    feePayer: true,
  })
  const payMs = Date.now() - started
  if (receipt.status !== 'success') throw new Error(`payment reverted: ${receipt.transactionHash}`)
  const paid = await call<Paid>(`${api}/v1/checkout/${checkout.id}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ tx_hash: receipt.transactionHash }),
  })
  return { ...paid, roundTripMs: Date.now() - started, payMs }
}

/** Sends dollars to a person through the relay: Kova pays the fee, the recipient gets it all. */
export async function send(
  api: string,
  chainId: number,
  from: LocalAccount,
  to: Address,
  token: Address,
  amount: bigint,
) {
  const client = walletFor(api, chainId, from, token)
  const { receipt } = await client.token.transferSync({ token, to, amount, feePayer: true })
  return receipt
}
