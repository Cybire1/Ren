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
import { Account, Actions, WebCryptoP256 } from 'viem/tempo'
import { PublicKey, Signature } from 'ox'
import { readCardKey, signWithCard, softCard } from '@kova/monad'
import { hexToNumber, slice } from 'viem'
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

// A local test merchant only: Ren's production API calls public https sites, never a laptop.
const local = /localhost|127\.0\.0\.1/.test(api)
const port = 4800 + Math.floor(Math.random() * 100)
let server: { close: () => void } | null = null
if (local) {
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
  server = serve({ fetch: shop.fetch, port })
  await new Promise((r) => setTimeout(r, 300))
  const fetched = await call<{ status: string; response: { status: number; body: string }; payment: { tx_hash: string; amount: string } | null; reason?: string }>(
    '/v1/agent/fetch',
    { method: 'POST', token: agentToken, body: JSON.stringify({ url: `http://localhost:${port}/joke`, max_amount: '0.50' }) },
  )
  expect(fetched.body.status === 'paid', `mpp: ${JSON.stringify(fetched.body)}`)
  ok(`paid $${fetched.body.payment?.amount}, tx ${fetched.body.payment?.tx_hash}; the site said ${fetched.body.response.body}`)


}

step('The same, through Ren’s MCP server')
const mcp = new Client({ name: 'keys-e2e', version: '1.0.0' })
await mcp.connect(
  new StreamableHTTPClientTransport(new URL(`${api}/mcp`), { requestInit: { headers: { authorization: `Bearer ${agentToken}` } } }),
)
const tools = await mcp.listTools()
ok(`tools: ${tools.tools.map((t) => t.name).join(', ')}`)
const status = await mcp.callTool({ name: 'ren_status', arguments: {} })
ok(`ren_status: ${JSON.stringify(JSON.parse((status.content as { text: string }[])[0]?.text ?? '{}').left)} left`)
if (local) {
  const viaMcp = await mcp.callTool({ name: 'ren_fetch', arguments: { url: `http://localhost:${port}/joke`, max_amount: '0.10' } })
  ok(`ren_fetch with a $0.10 cap: ${(viaMcp.content as { text: string }[])[0]?.text.split('\n')[0]}`)
}
const paidMcp = await mcp.callTool({ name: 'ren_pay', arguments: { to: friend, amount: '0.20' } })
ok(`ren_pay: ${(paidMcp.content as { text: string }[])[0]?.text}`)
await mcp.close()
server?.close()

step('A Ren shop takes payment over MPP: the agent pays a till’s charge through /v1/mpp/charges')
const mppShop = await call<{ secret_key?: string; key?: string }>('/v1/merchants', {
  method: 'POST',
  body: JSON.stringify({ name: 'MPP Test Kitchen', settlement_address: newCustomer().address, country: 'NG' }),
})
const mppShopKey = mppShop.body.secret_key ?? mppShop.body.key
const mppCharge = await call<{ id: string }>('/v1/payment_intents', {
  method: 'POST',
  token: mppShopKey,
  body: JSON.stringify({ amount: '0.30', currency: 'USDC', reference: 'Akara' }),
})
expect(mppCharge.status === 201, `mpp charge: ${JSON.stringify(mppCharge.body)}`)
const viaMpp = await call<{ status: string; payment: { tx_hash: string } | null; response: { body: string } | null; reason?: string }>('/v1/agent/fetch', {
  method: 'POST',
  token: agentToken,
  body: JSON.stringify({ url: `${api}/v1/mpp/charges/${mppCharge.body.id}`, method: 'POST', max_amount: '0.50' }),
})
expect(viaMpp.body.status === 'paid', `mpp charge pay: ${JSON.stringify(viaMpp.body)}`)
const mppStatus = (await call<{ status: string }>(`/v1/checkout/${mppCharge.body.id}`)).body.status
expect(mppStatus === 'paid', `the charge should be paid, is ${mppStatus}`)
ok(`paid over MPP (${viaMpp.body.payment?.tx_hash}); the shop’s charge is ${mppStatus}`)

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

// ── An allowance ───────────────────────────────────────────────────────────────────────────

step('The owner gives an allowance: $3 a week, as a link')
const invite = await call<{ key: { id: string }; code: string }>(`/v1/wallets/${owner.address}/keys/allowances`, {
  method: 'POST',
  token: session,
  body: JSON.stringify({ label: 'Mum', limit: '3', period: 'week', expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() }),
})
expect(invite.status === 201, `allowance: ${JSON.stringify(invite.body)}`)
const offer = await call<{ limit: string; period: string; from: string }>(`/v1/allowances/${invite.body.code}`)
ok(`the link offers $${offer.body.limit} a ${offer.body.period} from ${offer.body.from}`)

step('Mum accepts on her own device: a P-256 key made by WebCrypto, never extractable')
const mum = newCustomer()
const mumMessage = walletSignInMessage({ address: mum.address, issuedAt: new Date().toISOString(), nonce: randomBytes(16).toString('hex') })
const mumSession = (
  await call<{ token: string }>(`/v1/wallets/${mum.address}/keys/sign-in`, {
    method: 'POST',
    body: JSON.stringify({ message: mumMessage, signature: await mum.signMessage({ message: mumMessage }) }),
  })
).body.token
const pair = await WebCryptoP256.createKeyPair()
const mumKeyId = Account.fromWebCryptoP256(pair).address
const claimed = await call<{ key: { status: string } }>(`/v1/allowances/${invite.body.code}/claim`, {
  method: 'POST',
  token: mumSession,
  body: JSON.stringify({ holder: mum.address, holder_name: 'Mum', key_id: mumKeyId, key_type: 'p256', public_key: PublicKey.toHex(pair.publicKey) }),
})
expect(claimed.status === 200, `claim: ${JSON.stringify(claimed.body)}`)
const again = await call(`/v1/allowances/${invite.body.code}/claim`, {
  method: 'POST',
  token: mumSession,
  body: JSON.stringify({ holder: mum.address, key_id: mumKeyId, key_type: 'p256' }),
})
expect(again.status === 404 || again.status === 409, 'a second claim must fail')
ok(`claimed, key ${mumKeyId}; the link can’t be claimed twice (${again.status})`)

step('The owner switches it on with its passkey')
const allowAuth = (await call<{ key_id: Address; key_type: 'p256'; limit_units: string; period: number; expiry: number }>(
  `/v1/wallets/${owner.address}/keys/${invite.body.key.id}/authorize`,
  { token: session },
)).body
const allowTerms: KeyTerms = { token, limit: BigInt(allowAuth.limit_units), period: allowAuth.period, expiry: allowAuth.expiry, payees: 'anyone' }
const { receipt: allowReceipt } = await Actions.accessKey.authorizeSync(wallet as never, {
  accessKey: { address: allowAuth.key_id, type: 'p256' },
  expiry: allowTerms.expiry,
  limits: keyLimits(allowTerms),
  scopes: keyScopes(allowTerms),
  feePayer: true,
} as never)
expect(allowReceipt.status === 'success', 'allowance authorize reverted')
const on = await call<{ key: { status: string; remaining: string } }>(`/v1/wallets/${owner.address}/keys/${invite.body.key.id}/confirm`, {
  method: 'POST',
  token: session,
  body: JSON.stringify({ tx_hash: allowReceipt.transactionHash }),
})
expect(on.body.key?.status === 'active', `switch on: ${JSON.stringify(on.body)}`)
ok(`on: $${on.body.key.remaining} left this week`)

step('Mum pays $1 from the allowance: the owner’s dollars, her key’s signature, Ren’s fee')
const mumSpends = walletFor(api, health.chain_id, Account.fromWebCryptoP256(pair, { access: owner.address }) as never, token)
const { receipt: spent } = await mumSpends.token.transferSync({ token, to: friend, amount: 1_000_000n, feePayer: true } as never)
expect(spent.status === 'success', 'allowance spend reverted')
const leftMum = await Actions.accessKey.getRemainingLimit(wallet as never, { account: owner.address, accessKey: mumKeyId, token })
ok(`paid: ${spent.transactionHash}; $${Number(leftMum.remaining) / 1e6} left this week`)

step('$5 is over what it has left: Tempo refuses it')
const over = await mumSpends.token
  .transferSync({ token, to: friend, amount: 5_000_000n, feePayer: true } as never)
  .then(() => 'went through')
  .catch((error: Error) => error.message.split('\n')[0])
expect(over !== 'went through', 'the chain should refuse a spend over the limit')
ok(`refused: ${over}`)

// ── A Ren Card ─────────────────────────────────────────────────────────────────────────────

step('The owner links a Ren Card: its chip’s key, $1.20 a day (a software chip, as the simulator taps)')
const chip = softCard(`0x${randomBytes(32).toString('hex')}` as Hex)
const { address: cardKey, publicKey: cardPublicKey } = await readCardKey(chip)
const linked = await call<{ key: { id: string }; authorize: { key_id: Address; limit_units: string; period: number; expiry: number } }>(
  `/v1/wallets/${owner.address}/keys/cards`,
  { method: 'POST', token: session, body: JSON.stringify({ label: 'Ren Card', key_id: cardKey, limit: '1.20', expires_at: new Date(Date.now() + 90 * 86_400_000).toISOString() }) },
)
expect(linked.status === 201, `link: ${JSON.stringify(linked.body)}`)
const cardTerms: KeyTerms = { token, limit: BigInt(linked.body.authorize.limit_units), period: linked.body.authorize.period, expiry: linked.body.authorize.expiry, payees: 'anyone' }
const { receipt: cardReceipt } = await Actions.accessKey.authorizeSync(wallet as never, {
  accessKey: { address: cardKey, type: 'secp256k1' },
  expiry: cardTerms.expiry,
  limits: keyLimits(cardTerms),
  scopes: keyScopes(cardTerms),
  feePayer: true,
} as never)
expect(cardReceipt.status === 'success', 'card authorize reverted')
await call(`/v1/wallets/${owner.address}/keys/${linked.body.key.id}/confirm`, { method: 'POST', token: session, body: JSON.stringify({ tx_hash: cardReceipt.transactionHash }) })
const tillView = await call<{ holder: string; status: string; left_today: string }>(`/v1/key-cards/${cardKey}`)
expect(tillView.body.status === 'active', `till lookup: ${JSON.stringify(tillView.body)}`)
ok(`card ${cardKey} is on: a till sees it spends ${tillView.body.holder}, $${tillView.body.left_today} left today`)

step('A shop charges $1.00; the card pays it in one tap')
const cardShop = newCustomer().address
const opened = await call<{ secret_key?: string; key?: string }>('/v1/merchants', {
  method: 'POST',
  body: JSON.stringify({ name: 'Card Test Kitchen', settlement_address: cardShop, country: 'NG' }),
})
const shopKey = opened.body.secret_key ?? opened.body.key
expect(shopKey, `open shop: ${JSON.stringify(opened.body)}`)
const charge = await call<{ id: string; amount: string; pay_to: Address; memo: Hex }>('/v1/payment_intents', {
  method: 'POST',
  token: shopKey,
  body: JSON.stringify({ amount: '1.00', currency: 'USDC', reference: 'Suya' }),
})
expect(charge.status === 201, `charge: ${JSON.stringify(charge.body)}`)
const cardAccount = Account.from({
  access: owner.address,
  keyType: 'secp256k1',
  publicKey: PublicKey.fromHex(cardPublicKey),
  async sign({ hash }: { hash: Hex }) {
    const { signature } = await signWithCard(chip, hash)
    return Signature.toHex({ r: BigInt(slice(signature, 0, 32)), s: BigInt(slice(signature, 32, 64)), yParity: hexToNumber(slice(signature, 64, 65)) - 27 })
  },
})
const till = walletFor(api, health.chain_id, cardAccount as never, token)
const tapped = Date.now()
const { receipt: tapReceipt } = await till.token.transferSync({ token, to: charge.body.pay_to, amount: 1_000_000n, memo: charge.body.memo, feePayer: true } as never)
expect(tapReceipt.status === 'success', 'card tap reverted')
let paid = ''
for (let i = 0; i < 20 && paid !== 'paid'; i++) {
  paid = (await call<{ status: string }>(`/v1/checkout/${charge.body.id}`)).body.status
  if (paid !== 'paid') await new Promise((r) => setTimeout(r, 500))
}
expect(paid === 'paid', `the charge should be paid, is ${paid}`)
ok(`paid by tap in ${Date.now() - tapped} ms: ${tapReceipt.transactionHash}; the till shows PAID`)

step('$0.50 more is over what the card has left today ($0.20): Tempo refuses it')
const charge2 = await call<{ pay_to: Address; memo: Hex }>('/v1/payment_intents', {
  method: 'POST',
  token: shopKey,
  body: JSON.stringify({ amount: '0.50', currency: 'USDC', reference: 'Zobo' }),
})
const refusedTap = await till.token
  .transferSync({ token, to: charge2.body.pay_to, amount: 500_000n, memo: charge2.body.memo, feePayer: true } as never)
  .then(() => 'went through')
  .catch((error: Error) => error.message.split('\n')[0])
expect(refusedTap !== 'went through', 'the chain should refuse a tap over the daily limit')
ok(`refused: ${refusedTap}`)
console.log('\nAll keys checks passed.')
process.exit(0)
