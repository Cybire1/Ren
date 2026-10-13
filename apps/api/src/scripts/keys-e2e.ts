/**
 * Keys end to end on Tempo testnet, against a running Ren API (services/keys.ts, agents.ts).
 *
 * A wallet signs in to its keys, makes an AI agent's key and puts it on-chain with its terms; then
 * the agent, holding only its token, pays: a wallet, a paid API over MPP (a test merchant this
 * script runs), and over Ren's MCP server. Above its ask-first line a payment waits for the
 * owner's yes; over its cap it's refused; frozen, it stops; removed, its token dies, and the chain
 * itself refuses the key.
 *
 *   pnpm --filter @kova/api keys:e2e        (API_URL, default http://localhost:4400)
 */
import { serve } from '@hono/node-server'
import { approvalMessage, keyLimits, keyScopes, type KeyTerms, walletSignInMessage } from '@kova/tempo'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Hono } from 'hono'
import { Mppx, tempo } from 'mppx/server'
import { randomBytes } from 'node:crypto'
import { type Address, type Hex, getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { Actions } from 'viem/tempo'
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

// ── The owner ──────────────────────────────────────────────────────────────────────────────

step('A wallet with test dollars')
const owner = newCustomer()
const balance = await fund(api, owner.address)
ok(`${owner.address} has ${Number(balance) / 1e6} dollars`)
const wallet = walletFor(api, health.chain_id, owner, token)

step('It signs in to its keys')
const message = walletSignInMessage({
  address: owner.address,
  issuedAt: new Date().toISOString(),
  nonce: randomBytes(16).toString('hex'),
})
const signIn = await call<{ token: string }>(`/v1/wallets/${owner.address}/keys/sign-in`, {
  method: 'POST',
  body: JSON.stringify({ message, signature: await owner.signMessage({ message }) }),
})
expect(signIn.status === 200, `sign-in: ${JSON.stringify(signIn.body)}`)
const session = signIn.body.token
ok('signed in for twelve hours')

step('It makes an agent key: $5 a day, $2 a payment at most, asks above $1')
const made = await call<{ key: { id: string }; authorize: { key_id: Address; limit_units: string; period: number; expiry: number; payees: 'anyone' | Address[] } }>(
  `/v1/wallets/${owner.address}/keys/agents`,
  {
    method: 'POST',
    token: session,
    body: JSON.stringify({
      label: 'Research agent',
      limit: '5',
      period: 'day',
      expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      per_payment: '2',
      approve_above: '1',
      payees: 'anyone',
    }),
  },
)
expect(made.status === 201, `make: ${JSON.stringify(made.body)}`)
const { key, authorize } = made.body
ok(`key ${authorize.key_id}, pending`)

step('Its device puts the key on Tempo (Ren pays the fee)')
const terms: KeyTerms = {
  token,
  limit: BigInt(authorize.limit_units),
  period: authorize.period,
  expiry: authorize.expiry,
  payees: authorize.payees,
}
const started = Date.now()
const { receipt: authReceipt } = await Actions.accessKey.authorizeSync(wallet as never, {
  accessKey: { address: authorize.key_id, type: 'secp256k1' },
  expiry: terms.expiry,
  limits: keyLimits(terms),
  scopes: keyScopes(terms),
  feePayer: true,
} as never)
expect(authReceipt.status === 'success', 'authorize reverted')
ok(`on-chain in ${Date.now() - started} ms: ${authReceipt.transactionHash}`)

const confirmed = await call<{ key: { status: string; remaining: string }; agent_token?: string }>(
  `/v1/wallets/${owner.address}/keys/${key.id}/confirm`,
  { method: 'POST', token: session, body: JSON.stringify({ tx_hash: authReceipt.transactionHash }) },
)
expect(confirmed.status === 200 && confirmed.body.agent_token, `confirm: ${JSON.stringify(confirmed.body)}`)
const agentToken = confirmed.body.agent_token
ok(`active, $${confirmed.body.key.remaining} left today; the agent gets its token once`)

// ── The agent ──────────────────────────────────────────────────────────────────────────────

const friend = privateKeyToAccount(`0x${randomBytes(32).toString('hex')}` as Hex).address

step('The agent pays a wallet $0.50')
const small = await call<{ payment: { status: string; tx_hash: string; reason?: string } }>('/v1/agent/pay', {
  method: 'POST',
  token: agentToken,
  body: JSON.stringify({ to: friend, amount: '0.50', note: 'test' }),
})
expect(small.body.payment?.status === 'paid', `pay: ${JSON.stringify(small.body)}`)
ok(`paid: ${small.body.payment.tx_hash}`)

step('$3 is over its $2-a-payment cap')
const big = await call<{ payment: { status: string; reason: string } }>('/v1/agent/pay', {
  method: 'POST',
  token: agentToken,
  body: JSON.stringify({ to: friend, amount: '3' }),
})
expect(big.status === 403 && big.body.payment.status === 'denied', `cap: ${JSON.stringify(big.body)}`)
ok(`refused: ${big.body.payment.reason}`)

step('$1.50 waits for the owner')
const asked = await call<{ payment: { id: string; status: string; amount: string; to: string } }>('/v1/agent/pay', {
  method: 'POST',
  token: agentToken,
  body: JSON.stringify({ to: friend, amount: '1.50' }),
})
expect(asked.status === 202 && asked.body.payment.status === 'pending_approval', `ask: ${JSON.stringify(asked.body)}`)
const waiting = await call<{ approvals: { id: string }[] }>(`/v1/wallets/${owner.address}/keys`, { token: session })
expect(waiting.body.approvals.some((a) => a.id === asked.body.payment.id), 'the owner should see it waiting')
ok('the owner sees it waiting')
const answer = approvalMessage({
  address: owner.address,
  paymentId: asked.body.payment.id,
  decision: 'approve',
  amount: asked.body.payment.amount,
  to: asked.body.payment.to,
})
const approved = await call<{ payment: { status: string; tx_hash: string; reason?: string } }>(
  `/v1/wallets/${owner.address}/approvals/${asked.body.payment.id}`,
  { method: 'POST', token: session, body: JSON.stringify({ decision: 'approve', signature: await owner.signMessage({ message: answer }) }) },
)
expect(approved.body.payment?.status === 'paid', `approve: ${JSON.stringify(approved.body)}`)
ok(`approved with the wallet's signature, and paid: ${approved.body.payment.tx_hash}`)

step('A paid API over MPP: a test merchant charging $0.25 a request')
const merchant = newCustomer().address
const feePayerKey = process.env.KOVA_FEE_PAYER_PRIVATE_KEY as Hex | undefined
const mppx = Mppx.create({
  methods: [
    tempo.charge({
      currency: token,
      recipient: merchant,
      testnet: true,
      ...(feePayerKey ? { feePayer: privateKeyToAccount(feePayerKey) } : {}),
    }),
  ],
  secretKey: randomBytes(32).toString('hex'),
})
const shop = new Hono()
shop.get('/joke', async (c) => {
  const result = await mppx.charge({ amount: '0.25', description: 'One joke' })(c.req.raw)
  if (result.status === 402) return result.challenge
  return result.withReceipt(c.json({ joke: 'A stablecoin walks into a bar. The bartender says: we have a fixed price.' }))
})
const port = 4800 + Math.floor(Math.random() * 100)
const server = serve({ fetch: shop.fetch, port })
await new Promise((r) => setTimeout(r, 300))
const fetched = await call<{ status: string; response: { status: number; body: string }; payment: { tx_hash: string; amount: string } | null; reason?: string }>(
  '/v1/agent/fetch',
  { method: 'POST', token: agentToken, body: JSON.stringify({ url: `http://localhost:${port}/joke`, max_amount: '0.50' }) },
)
expect(fetched.body.status === 'paid', `mpp: ${JSON.stringify(fetched.body)}`)
ok(`paid $${fetched.body.payment?.amount}, tx ${fetched.body.payment?.tx_hash}; the site said ${fetched.body.response.body}`)

step('The same, through Ren’s MCP server')
const mcp = new Client({ name: 'keys-e2e', version: '1.0.0' })
await mcp.connect(
  new StreamableHTTPClientTransport(new URL(`${api}/mcp`), { requestInit: { headers: { authorization: `Bearer ${agentToken}` } } }),
)
const tools = await mcp.listTools()
ok(`tools: ${tools.tools.map((t) => t.name).join(', ')}`)
const status = await mcp.callTool({ name: 'ren_status', arguments: {} })
ok(`ren_status: ${JSON.stringify(JSON.parse((status.content as { text: string }[])[0]?.text ?? '{}').left)} left`)
const viaMcp = await mcp.callTool({ name: 'ren_fetch', arguments: { url: `http://localhost:${port}/joke`, max_amount: '0.10' } })
ok(`ren_fetch with a $0.10 cap: ${(viaMcp.content as { text: string }[])[0]?.text.split('\n')[0]}`)
const paidMcp = await mcp.callTool({ name: 'ren_pay', arguments: { to: friend, amount: '0.20' } })
ok(`ren_pay: ${(paidMcp.content as { text: string }[])[0]?.text}`)
await mcp.close()
server.close()

// ── The owner stops it ─────────────────────────────────────────────────────────────────────

step('The owner freezes it: Ren stops at once, and its limit on Tempo goes to zero')
await call(`/v1/wallets/${owner.address}/keys/${key.id}/freeze`, { method: 'POST', token: session })
const frozen = await call<{ payment: { status: string; reason: string } }>('/v1/agent/pay', {
  method: 'POST',
  token: agentToken,
  body: JSON.stringify({ to: friend, amount: '0.10' }),
})
expect(frozen.body.payment.status === 'denied', `frozen: ${JSON.stringify(frozen.body)}`)
ok(`refused: ${frozen.body.payment.reason}`)
const { receipt: zero } = await Actions.accessKey.updateLimitSync(wallet as never, {
  accessKey: authorize.key_id,
  token,
  limit: 0n,
  feePayer: true,
} as never)
expect(zero.status === 'success', 'freeze on-chain reverted')
const left = await Actions.accessKey.getRemainingLimit(wallet as never, { account: owner.address, accessKey: authorize.key_id, token })
ok(`limit on Tempo now ${left.remaining}`)

step('The owner removes it: its token stops working, and Tempo revokes the key')
await call(`/v1/wallets/${owner.address}/keys/${key.id}/revoke`, { method: 'POST', token: session, body: '{}' })
const { receipt: revoked } = await Actions.accessKey.revokeSync(wallet as never, { accessKey: authorize.key_id, feePayer: true } as never)
expect(revoked.status === 'success', 'revoke reverted')
const dead = await call('/v1/agent', { token: agentToken })
expect(dead.status === 401, `the token should be dead: ${dead.status}`)
ok(`token refused (${dead.status}); revoked on Tempo: ${revoked.transactionHash}`)

const history = await call<{ given: { id: string; status: string }[] }>(`/v1/wallets/${owner.address}/keys`, { token: session })
ok(`the key shows as ${history.body.given.find((k) => k.id === key.id)?.status}`)
console.log('\nAll keys checks passed.')
process.exit(0)
