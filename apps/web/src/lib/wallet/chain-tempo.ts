import { getNetwork, getToken, type NetworkId, tokenByAddress } from '@kova/tempo'
import { type Address, type Hex, http, type LocalAccount } from 'viem'
import { Actions, createClient, withRelay } from 'viem/tempo'
import type { NoteToSeal } from './chain-monad'

/**
 * Money on Tempo, from the browser, as the app moves it (apps/mobile src/lib/chain-tempo.ts).
 * Balances are read straight from Tempo's public RPC. Everything that moves money is a TIP-20
 * transfer this wallet signs and sends through Kova's fee-payer relay, reached through this site's
 * /api/relay (the API takes no browser calls): Kova adds the fee, so the payer spends exactly the
 * price and nobody needs a gas token.
 */

const readers = new Map<NetworkId, ReturnType<typeof createClient>>()

function reader(network: NetworkId) {
  let made = readers.get(network)
  if (!made) {
    made = createClient({
      testnet: network === 'testnet',
      transport: http(getNetwork(network).rpcUrl, { timeout: 8_000 }),
    })
    readers.set(network, made)
  }
  return made
}

/** A client that signs as `account` and sends through Kova's relay, which pays the fee. */
export function relayedClient(network: NetworkId, account: LocalAccount) {
  const token = getToken(network, 'USDC')
  return createClient({
    account,
    testnet: network === 'testnet',
    feeToken: token.address,
    transport: withRelay(
      http(getNetwork(network).rpcUrl, { timeout: 8_000 }),
      http('/api/relay', { timeout: 12_000 }),
    ),
  })
}

/** The wallet's dollars (USDC), in base units. */
export async function balanceOf(network: NetworkId, address: Address): Promise<bigint> {
  const { amount } = await Actions.token.getBalance(reader(network) as never, {
    account: address,
    token: getToken(network, 'USDC').address,
  })
  return amount
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok)
    throw new Error(json.error ?? `Ren didn’t answer (${response.status}). Nothing moved.`)
  return json as T
}

export interface Moved {
  hash: Hex
  /** How long it took, from signing to settled. */
  ms: number
  explorer: string
}

const explorerTx = (network: NetworkId, hash: Hex) =>
  `${getNetwork(network).explorerUrl}/tx/${hash}`

/** Chain errors in words a person can act on. */
function plain(error: unknown, fallback: string): Error {
  const message = error instanceof Error ? error.message : String(error)
  if (/insufficient|exceeds balance/i.test(message))
    return new Error('Not enough dollars in this wallet. Nothing moved.')
  if (/reject|denied|cancel/i.test(message)) return new Error('Cancelled. Nothing moved.')
  return new Error(fallback)
}

/** Sends dollars to a person through Kova's relay: Kova pays the fee, they get every cent sent. */
export async function sendMoney(
  network: NetworkId,
  account: LocalAccount,
  to: Address,
  amount: bigint,
  // A private note is sealed to an EIP-3009 authorization (Monad). Tempo's send goes straight
  // through the fee-payer relay with nothing for a note to bind to yet, so the wallet doesn't
  // offer one on Tempo (components/wallet/send.tsx).
  _note?: NoteToSeal,
): Promise<Moved> {
  const started = performance.now()
  try {
    const { receipt } = await relayedClient(network, account).token.transferSync({
      token: getToken(network, 'USDC').address,
      to,
      amount,
      feePayer: true,
    })
    if (receipt.status !== 'success') throw new Error('reverted')
    return {
      hash: receipt.transactionHash,
      ms: Math.round(performance.now() - started),
      explorer: explorerTx(network, receipt.transactionHash),
    }
  } catch (error) {
    throw plain(error, 'The money didn’t go. Nothing left your wallet.')
  }
}

/** What a charge asks for: GET /v1/checkout/:id. */
export interface ChargeToPay {
  id: string
  merchant_name: string
  amount: string
  amount_base: string
  status: string
  token: string
  pay_to: string
  memo: string
  reference: string | null
  expires_at: string
  order?: { stall: { name: string } | null } | null
}

/**
 * Pays a Kova charge: a `transferWithMemo` of exactly this charge (amount, recipient, memo) the
 * wallet signs, with Kova's fee payer adding the fee through the relay. Then Kova is told the hash
 * so the shop sees PAID at once (its watcher would find it anyway).
 */
export async function payCharge(
  network: NetworkId,
  account: LocalAccount,
  charge: ChargeToPay,
): Promise<Moved> {
  const token = tokenByAddress(network, charge.token as Address)
  if (!token) throw new Error('This charge asks for a token Ren doesn’t pay with.')
  const started = performance.now()
  let hash: Hex
  try {
    const { receipt } = await relayedClient(network, account).token.transferSync({
      token: token.address,
      to: charge.pay_to as Address,
      amount: BigInt(charge.amount_base),
      memo: charge.memo as Hex,
      feePayer: true,
    })
    if (receipt.status !== 'success') throw new Error('reverted')
    hash = receipt.transactionHash
  } catch (error) {
    throw plain(error, 'The payment didn’t go through. Nothing moved.')
  }
  await post(`/api/checkout/${encodeURIComponent(charge.id)}/confirm`, { tx_hash: hash }).catch(
    () => {},
  )
  return { hash, ms: Math.round(performance.now() - started), explorer: explorerTx(network, hash) }
}

/** Test dollars on testnet: asks Kova, then waits (up to ten seconds) to see them land. */
export async function addTestDollars(network: NetworkId, address: Address): Promise<bigint> {
  if (network !== 'testnet') throw new Error('Test dollars are for the test network only.')
  const before = await balanceOf(network, address)
  await post('/api/faucet', { address })
  for (let i = 0; i < 40; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const now = await balanceOf(network, address).catch(() => before)
    if (now > before) return now
  }
  return balanceOf(network, address)
}

export type { IndexedTransfer, NoteToSeal } from './chain-monad'
export { transfersAfter } from './chain-monad'
