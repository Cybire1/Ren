/**
 * The demo's agent scene, end to end (services/agents.ts agentPayCharge, over Ren's MCP server):
 * an agent key pays a shop's charge from its pay link; a pricier one waits for the owner, who
 * approves it; frozen, it's refused.
 *
 *   API_URL=https://… pnpm --filter @kova/api agent-charge:e2e
 */
import { randomBytes } from 'node:crypto'
import { approvalMessage, keyLimits, keyScopes, type KeyTerms, walletSignInMessage } from '@kova/tempo'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { type Address, getAddress } from 'viem'
import { Actions } from 'viem/tempo'
import { fund, newCustomer, walletFor } from './customer-tempo.js'

const api = process.env.API_URL ?? 'http://localhost:4400'
const step = (text: string) => console.log(`\n▸ ${text}`)
const ok = (text: string) => console.log(`  ✓ ${text}`)
async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<{ status: number; body: T }> {
  const response = await fetch(`${api}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.token ? { authorization: `Bearer ${init.token}` } : {}), ...init.headers },
  })
  return { status: response.status, body: (await response.json().catch(() => ({}))) as T }
}
function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`✗ ${message}`)
}
const said = (r: unknown) => (r as { content: { text: string }[] }).content[0]?.text ?? ''

const health = (await call<{ chain_id: number; settlement_token: { address: Address } }>('/health')).body
const token = getAddress(health.settlement_token.address)

step('Ada, with $5, makes a shopping agent: $20 a day, $5 a payment, asks above $1')
const ada = newCustomer()
await fund(api, ada.address)
const message = walletSignInMessage({ address: ada.address, issuedAt: new Date().toISOString(), nonce: randomBytes(16).toString('hex') })
const session = (await call<{ token: string }>(`/v1/wallets/${ada.address}/keys/sign-in`, { method: 'POST', body: JSON.stringify({ message, signature: await ada.signMessage({ message }) }) })).body.token
const made = (await call<{ key: { id: string }; authorize: { key_id: Address; limit_units: string; period: number; expiry: number } }>(`/v1/wallets/${ada.address}/keys/agents`, {
  method: 'POST',
  token: session,
  body: JSON.stringify({ label: 'Shopping agent', limit: '20', period: 'day', expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(), per_payment: '5', approve_above: '1', payees: 'anyone' }),
})).body
const terms: KeyTerms = { token, limit: BigInt(made.authorize.limit_units), period: made.authorize.period, expiry: made.authorize.expiry, payees: 'anyone' }
const wallet = walletFor(api, health.chain_id, ada, token)
const { receipt } = await Actions.accessKey.authorizeSync(wallet as never, { accessKey: { address: made.authorize.key_id, type: 'secp256k1' }, expiry: terms.expiry, limits: keyLimits(terms), scopes: keyScopes(terms), feePayer: true } as never)
const confirmed = (await call<{ agent_token: string }>(`/v1/wallets/${ada.address}/keys/${made.key.id}/confirm`, { method: 'POST', token: session, body: JSON.stringify({ tx_hash: receipt.transactionHash }) })).body
expect(confirmed.agent_token, 'no token')
ok('the key is on Tempo; Claude gets its token')

const shop = await call<{ secret_key?: string; key?: string }>('/v1/merchants', { method: 'POST', body: JSON.stringify({ name: 'Demo Café', settlement_address: newCustomer().address, country: 'NG' }) })
const shopKey = shop.body.secret_key ?? shop.body.key
const charge = async (amount: string, reference: string) =>
  (await call<{ id: string }>('/v1/payment_intents', { method: 'POST', token: shopKey, body: JSON.stringify({ amount, currency: 'USDC', reference }) })).body.id

const mcp = new Client({ name: 'demo', version: '1.0.0' })
await mcp.connect(new StreamableHTTPClientTransport(new URL(`${api}/mcp`), { requestInit: { headers: { authorization: `Bearer ${confirmed.agent_token}` } } }))

step('Claude pays a $0.80 croissant from its pay link')
const small = await charge('0.80', 'Croissant')
const paidSmall = said(await mcp.callTool({ name: 'ren_pay_charge', arguments: { charge: `https://web-production-acdb.up.railway.app/pay/${small}` } }))
ok(paidSmall)
expect((await call<{ status: string }>(`/v1/checkout/${small}`)).body.status === 'paid', 'the croissant charge should be paid')
ok('the till shows PAID')

step('A $2.00 charge waits for Ada, who approves it')
const big = await charge('2.00', 'Flat white')
const asked = said(await mcp.callTool({ name: 'ren_pay_charge', arguments: { charge: big } }))
ok(asked.split('.')[0] ?? asked)
const waiting = (await call<{ approvals: { id: string; amount: string; to: string; origin: string | null }[] }>(`/v1/wallets/${ada.address}/keys`, { token: session })).body.approvals[0]
expect(waiting, 'Ada should see it waiting')
const answer = approvalMessage({ address: ada.address, paymentId: waiting.id, decision: 'approve', amount: waiting.amount, to: waiting.origin ?? getAddress(waiting.to) })
const approved = (await call<{ payment: { status: string; reason?: string } }>(`/v1/wallets/${ada.address}/approvals/${waiting.id}`, { method: 'POST', token: session, body: JSON.stringify({ decision: 'approve', signature: await ada.signMessage({ message: answer }) }) })).body
expect(approved.payment.status === 'paid', `approve: ${JSON.stringify(approved)}`)
expect((await call<{ status: string }>(`/v1/checkout/${big}`)).body.status === 'paid', 'the flat white charge should be paid')
ok('approved, paid, and the till shows PAID')

step('Frozen, Claude is refused')
await call(`/v1/wallets/${ada.address}/keys/${made.key.id}/freeze`, { method: 'POST', token: session, body: '{}' })
const frozen = said(await mcp.callTool({ name: 'ren_pay_charge', arguments: { charge: await charge('0.50', 'Water') } }))
expect(/frozen/i.test(frozen), `frozen: ${frozen}`)
ok(frozen)
await mcp.close()
console.log('\nThe demo’s agent scene works.')
process.exit(0)
