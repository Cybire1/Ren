/**
 * Everything the phone does on Tempo, with no React Native in it, so it can be exercised from
 * Node against testnet exactly as the app runs it.
 *
 * The phone signs its own payments: a TIP-20 `transferWithMemo` of exactly the charge. It sends
 * them through Kova's fee-payer relay, which adds the fee (Tempo has no gas token, and Kova pays
 * it), so a payer spends exactly the price and a friend receives every cent sent. Balances are
 * read straight from the chain; what arrived comes from Kova's API, which reads it from Tempo.
 */
import { tokenByAddress } from '@kova/tempo'
import { type Address, type Hash, type Hex, http, isAddressEqual, type LocalAccount } from 'viem'
import { Actions, createClient, withRelay } from 'viem/tempo'
import { apiUrl, isTestnet, network, networkId, settlementToken } from './config'

export const publicClient = createClient({
  testnet: isTestnet,
  feeToken: settlementToken.address,
  transport: http(network.rpcUrl, { timeout: 8_000 }),
})

/** Kova's fee-payer relay: payments and sends go through it so the payer never needs a gas token. */
export const relayUrl = `${apiUrl}/rpc/relay`

function walletClient(account: LocalAccount) {
  return createClient({
    account,
    testnet: isTestnet,
    feeToken: settlementToken.address,
    transport: withRelay(
      http(network.rpcUrl, { timeout: 8_000 }),
      http(relayUrl, { timeout: 12_000 }),
    ),
  })
}

async function kova<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `${apiUrl}${path}`,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
  )
  const json = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
  if (!response.ok)
    throw new Error(json.error?.message ?? `Kova is unreachable (${response.status})`)
  return json as T
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getBalance(address: Address): Promise<bigint> {
  const { amount } = await Actions.token.getBalance(publicClient as never, {
    account: address,
    token: settlementToken.address,
  })
  return amount
}

/** Testnet only: asks Kova for today's test dollars ($5 a day), and waits until they land. */
export async function fundFromFaucet(address: Address): Promise<void> {
  if (!isTestnet) throw new Error('Adding money needs a card or bank on mainnet.')
  const before = await getBalance(address).catch(() => 0n)
  await kova('/v1/faucet', { address })
  for (let i = 0; i < 40; i++) {
    if ((await getBalance(address).catch(() => before)) > before) return
    await sleep(250)
  }
}

export interface Sent {
  hash: Hash
  ms: number
}

/** The parts of a Kova charge a payment is made against. */
export interface Charge {
  id: string
  token: Address
  pay_to: Address
  amount_base: string
  memo: Hex
  expires_at: string
}

/** Tempo reports why a sponsored send was refused in words nobody should see. */
function plain(error: unknown, fallback: string): Error {
  const message = error instanceof Error ? error.message : String(error)
  if (/insufficient|exceeds balance/i.test(message))
    return new Error('Not enough dollars in your wallet. Nothing was paid.')
  if (/cancel|abort/i.test(message)) return new Error('Face ID was cancelled')
  return new Error(fallback)
}

/**
 * Pays a Kova charge: a `transferWithMemo` of exactly this charge (its amount, recipient and memo),
 * with Kova's fee payer adding the fee. The token is checked against the app's own list, so a
 * charge can never get the phone to sign away anything but the dollars it shows. Then Kova is
 * told the hash, so the shop's screen turns to PAID at once (its watcher would find it anyway).
 */
export async function payCharge(account: LocalAccount, charge: Charge): Promise<Sent> {
  const started = Date.now()
  const token = tokenByAddress(networkId, charge.token)
  if (!token) throw new Error('This charge asks for a token Kova doesn’t use. Nothing was paid.')
  if (Date.parse(charge.expires_at) < Date.now())
    throw new Error('This charge has expired. Ask for a new code.')
  let hash: Hash
  try {
    const { receipt } = await walletClient(account).token.transferSync({
      token: token.address,
      to: charge.pay_to,
      amount: BigInt(charge.amount_base),
      memo: charge.memo,
      feePayer: true,
    })
    if (receipt.status !== 'success') throw new Error('reverted')
    hash = receipt.transactionHash
  } catch (error) {
    throw plain(error, 'The payment didn’t go through. No money moved.')
  }
  const ms = Date.now() - started
  await kova(`/v1/checkout/${charge.id}/confirm`, { tx_hash: hash }).catch(() => {})
  return { hash, ms }
}

/** Sends dollars to a person through Kova's relay: Kova pays the fee, they get every cent sent. */
export async function sendMoney(account: LocalAccount, to: Address, amount: bigint): Promise<Sent> {
  const started = Date.now()
  try {
    const { receipt } = await walletClient(account).token.transferSync({
      token: settlementToken.address,
      to,
      amount,
      feePayer: true,
    })
    if (receipt.status !== 'success') throw new Error('reverted')
    return { hash: receipt.transactionHash, ms: Date.now() - started }
  } catch (error) {
    throw plain(error, 'The money didn’t go. Nothing left your wallet.')
  }
}

export interface Incoming {
  from: Address
  amount: bigint
  hash: Hash
  block: bigint
  /** What a Kova memo says the money was: a refund, say. */
  kind: 'payment' | 'refund' | 'payout' | null
  /** Test dollars from the testnet faucet, not from a person. */
  faucet: boolean
}

interface ChainTransfer {
  token: Address
  from: Address
  amount_base: string
  tx_hash: Hash
  block: string
  kind: Incoming['kind']
  faucet: boolean
}

/** Dollars that arrived at `address` in blocks after `fromBlock`, read from Tempo by Kova's API. */
export async function incomingSince(
  address: Address,
  fromBlock: bigint,
): Promise<{ transfers: Incoming[]; head: bigint }> {
  const page = await kova<{ data: ChainTransfer[]; indexed_through: string }>(
    `/v1/wallets/${address}/transfers?direction=in&after_block=${fromBlock}`,
  )
  return {
    head: BigInt(page.indexed_through),
    transfers: page.data
      .filter((t) => isAddressEqual(t.token, settlementToken.address))
      .map((t) => ({
        from: t.from,
        amount: BigInt(t.amount_base),
        hash: t.tx_hash,
        block: BigInt(t.block),
        kind: t.kind,
        faucet: t.faucet,
      })),
  }
}

export const explorerTx = (hash: string) => `${network.explorerUrl}/tx/${hash}`
