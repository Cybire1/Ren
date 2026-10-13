/**
 * Naira end to end (services/naira.ts), against a running Ren API on Tempo testnet with a
 * Paystack test key: the rates; a wallet cashing $2 out to a test bank account (its dollars to
 * Ren's treasury, Paystack's transfer to the bank); and a shop's charge paid in naira by card,
 * with the shop getting its dollars on Tempo. Paystack's test mode moves no real money; its
 * published test card stands in for a customer's.
 *
 *   pnpm --filter @kova/api naira:e2e        (API_URL, default http://localhost:4400)
 */
import { randomBytes } from 'node:crypto'
import { walletSignInMessage } from '@kova/tempo'
import { type Address, getAddress, type Hex } from 'viem'
import { fund, newCustomer, walletFor } from './customer-tempo.js'

const api = process.env.API_URL ?? 'http://localhost:4400'
const step = (text: string) => console.log(`\n▸ ${text}`)
const ok = (text: string) => console.log(`  ✓ ${text}`)

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<{ status: number; body: T }> {
  const response = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...init.headers,
    },
  })
  return { status: response.status, body: (await response.json().catch(() => ({}))) as T }
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`✗ ${message}`)
}

const health = (await call<{ chain_id: number; settlement_token: { address: Address } }>('/health')).body
const token = getAddress(health.settlement_token.address)

step('Naira is on')
const naira = await call<{ enabled: boolean; test_mode: boolean; market_rate: string; cash_out_rate: string; pay_in_rate: string }>('/v1/naira')
expect(naira.body.enabled, `naira: ${JSON.stringify(naira.body)}`)
ok(`market ₦${naira.body.market_rate}/$; cash out at ₦${naira.body.cash_out_rate}, pay in at ₦${naira.body.pay_in_rate} (test mode: ${naira.body.test_mode})`)

step('Banks, and the name on a test account')
const banks = (await call<{ data: { name: string; code: string }[] }>('/v1/naira/banks')).body.data
const bank = banks.find((b) => b.code === '001') ?? banks.find((b) => b.code === '057') ?? banks[0]
expect(bank, 'no banks')
ok(`${banks.length} banks; using ${bank.name} (${bank.code})`)
const accountNumber = process.env.NAIRA_TEST_ACCOUNT ?? '0000000000'
const named = await call<{ account_name?: string; error?: { message: string } }>('/v1/naira/account', {
  method: 'POST',
  body: JSON.stringify({ account_number: accountNumber, bank_code: bank.code }),
})
ok(`account ${accountNumber}: ${named.status === 200 ? named.body.account_name : `not found (${named.body.error?.message})`}`)

step('A wallet cashes out $2')
try {
const wallet = newCustomer()
await fund(api, wallet.address)
const message = walletSignInMessage({ address: wallet.address, issuedAt: new Date().toISOString(), nonce: randomBytes(16).toString('hex') })
const session = (
  await call<{ token: string }>(`/v1/wallets/${wallet.address}/keys/sign-in`, {
    method: 'POST',
    body: JSON.stringify({ message, signature: await wallet.signMessage({ message }) }),
  })
).body.token
const quote = await call<{ id: string; naira: string; rate: string; fee: string; pay_to: Address; memo: Hex; account_name: string; error?: unknown }>(
  `/v1/wallets/${wallet.address}/cash-outs`,
  { method: 'POST', token: session, body: JSON.stringify({ amount: '2', bank_code: bank.code, account_number: accountNumber }) },
)
expect(quote.status === 201, `quote: ${JSON.stringify(quote.body)}`)
ok(`quoted ${quote.body.naira} to ${quote.body.account_name} at ₦${quote.body.rate}/$ (bank fee ${quote.body.fee})`)

const client = walletFor(api, health.chain_id, wallet, token)
const { receipt } = await client.token.transferSync({
  token,
  to: quote.body.pay_to,
  amount: 2_000_000n,
  memo: quote.body.memo,
  feePayer: true,
} as never)
expect(receipt.status === 'success', 'sending the dollars reverted')
ok(`dollars sent to Ren’s treasury, fee paid by Ren: ${receipt.transactionHash}`)
const sent = await call<{ status: string; failure: string | null }>(`/v1/wallets/${wallet.address}/cash-outs/${quote.body.id}/sent`, {
  method: 'POST',
  token: session,
  body: JSON.stringify({ tx_hash: receipt.transactionHash }),
})
expect(sent.status === 200, `sent: ${JSON.stringify(sent.body)}`)
let status = sent.body.status
for (let i = 0; i < 20 && status === 'paying'; i++) {
  await new Promise((r) => setTimeout(r, 3000))
  status = (await call<{ status: string }>(`/v1/wallets/${wallet.address}/cash-outs/${quote.body.id}`, { token: session })).body.status
}
ok(`cash-out ${status}${sent.body.failure ? ` (${sent.body.failure})` : ''}`)
} catch (error) {
  console.log(`  ✗ ${error instanceof Error ? error.message : error}`)
}

step('A shop’s charge, paid in naira by card')
const shopWallet = newCustomer().address
const opened = await call<{ secret_key?: string; key?: string; error?: unknown }>('/v1/merchants', {
  method: 'POST',
  body: JSON.stringify({ name: 'Naira Test Kitchen', settlement_address: shopWallet, country: 'NG' }),
})
const key = opened.body.secret_key ?? opened.body.key
expect(key, `open shop: ${JSON.stringify(opened.body)}`)
const charge = await call<{ id: string }>('/v1/payment_intents', {
  method: 'POST',
  token: key,
  body: JSON.stringify({ amount: '3.00', currency: 'USDC', reference: 'Jollof x1' }),
})
expect(charge.status === 201, `charge: ${JSON.stringify(charge.body)}`)
const price = await call<{ naira: string; rate: string }>(`/v1/checkout/${charge.body.id}/naira`)
ok(`$3.00 charge ${charge.body.id} costs ${price.body.naira} at ₦${price.body.rate}/$`)
const started = await call<{ url: string; reference: string }>(`/v1/checkout/${charge.body.id}/naira`, {
  method: 'POST',
  body: JSON.stringify({ email: 'customer@example.com', return_url: `http://localhost:3005/pay/${charge.body.id}` }),
})
expect(started.status === 200, `start: ${JSON.stringify(started.body)}`)
ok(`Paystack checkout: ${started.body.url}`)

// Paystack's published test card, charged against the same reference, as its checkout page would.
const paystack = process.env.PAYSTACK_SECRET_KEY as string
const charged = await fetch('https://api.paystack.co/charge', {
  method: 'POST',
  headers: { authorization: `Bearer ${paystack}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    email: 'customer@example.com',
    amount: String(Number(price.body.naira.replace(/[₦,]/g, '')) * 100),
    reference: started.body.reference,
    card: { number: '4084084084084081', cvv: '408', expiry_month: '12', expiry_year: '30' },
  }),
}).then((r) => r.json() as Promise<{ status: boolean; message: string; data?: { status: string } }>)
ok(`test card: ${charged.message} (${charged.data?.status ?? 'no status'})`)

const verified = await call<{ status: string; tx_hash: string | null; failure: string | null }>(`/v1/checkout/${charge.body.id}/naira/verify`, {
  method: 'POST',
  body: JSON.stringify({ reference: started.body.reference }),
})
ok(`after Paystack: ${JSON.stringify(verified.body)}`)
const checkout = (await call<{ status: string; payment: { tx_hash: string } | null }>(`/v1/checkout/${charge.body.id}`)).body
ok(`the charge is ${checkout.status}${checkout.payment ? `, paid on Tempo by ${checkout.payment.tx_hash}` : ''}`)
process.exit(0)
