/**
 * Proves the web's Tempo payment paths against a running Kova API and this site (both local):
 *   1. an email/Google wallet: `rawSigningAccount` over a provider that answers `secp256k1_sign`
 *      as Privy's does, paying a charge through this site's /api/relay, with Kova paying the fee;
 *   2. the pay page then shows the charge as paid.
 *   KOVA_API=http://localhost:4400 SITE=http://localhost:3005 KOVA_API_KEY=… npx tsx scripts/tempo-pay-check.ts
 */
import { getNetwork, getToken } from '@kova/tempo'
import { http } from 'viem'
import { generatePrivateKey, privateKeyToAccount, sign } from 'viem/accounts'
import { Actions, createClient, withRelay } from 'viem/tempo'
import { rawSigningAccount } from '../src/lib/wallet/pay-any'

const api = process.env.KOVA_API ?? 'http://localhost:4400'
const site = process.env.SITE ?? 'http://localhost:3005'
const key = process.env.KOVA_API_KEY
if (!key) throw new Error('set KOVA_API_KEY to a merchant key on the API')

const assert = (ok: unknown, what: string) => {
  if (!ok) throw new Error(`FAILED: ${what}`)
  console.log(`ok  ${what}`)
}

// A stand-in for Privy's embedded wallet: only raw hash signing, like Privy's `secp256k1_sign`.
const secret = generatePrivateKey()
const owner = privateKeyToAccount(secret)
const provider = {
  async request({ method, params }: { method: string; params?: unknown }) {
    if (method !== 'secp256k1_sign')
      throw Object.assign(new Error(`unsupported ${method}`), { code: 4200 })
    return sign({ hash: (params as [`0x${string}`])[0], privateKey: secret, to: 'hex' })
  },
}
const account = rawSigningAccount(owner.address, provider)

const network = getNetwork('testnet')
const token = getToken('testnet', 'USDC')
const reader = createClient({ testnet: true, transport: http(network.rpcUrl) })
const balance = async () =>
  (
    await Actions.token.getBalance(reader as never, {
      account: owner.address,
      token: token.address,
    })
  ).amount

const post = async (url: string, body: unknown, headers: Record<string, string> = {}) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

const funded = await post(`${site}/api/faucet`, { address: owner.address })
assert(funded.status === 200, `test dollars through ${site}/api/faucet`)
for (let i = 0; i < 40 && (await balance()) === 0n; i++)
  await new Promise((r) => setTimeout(r, 250))
const start = await balance()
assert(start === 5_000_000n, 'the wallet has its $5')

const intent = await post(
  `${api}/v1/payment_intents`,
  { amount: '3.10', reference: 'web e2e' },
  { authorization: `Bearer ${key}` },
)
const id = intent.body.id as string
const checkout = (await (await fetch(`${site}/api/checkout/${id}`)).json()) as Record<
  string,
  string
>
assert(
  checkout.chain === 'tempo' && checkout.status === 'requires_payment',
  `a Tempo charge ${id} for $${checkout.amount}`,
)

const client = createClient({
  account,
  testnet: true,
  feeToken: token.address,
  transport: withRelay(http(network.rpcUrl), http(`${site}/api/relay`)),
})
const started = Date.now()
const { receipt } = await client.token.transferSync({
  token: token.address,
  to: checkout.pay_to as `0x${string}`,
  amount: BigInt(checkout.amount_base),
  memo: checkout.memo as `0x${string}`,
  feePayer: true,
})
assert(receipt.status === 'success', `paid through ${site}/api/relay in ${Date.now() - started}ms`)
assert(
  (receipt as { feePayer?: string }).feePayer !== undefined,
  `Ren's fee payer ${(receipt as { feePayer?: string }).feePayer} paid the fee`,
)

const confirmed = await post(`${site}/api/checkout/${id}/confirm`, {
  tx_hash: receipt.transactionHash,
})
assert(confirmed.body.status === 'paid', 'the site confirms it paid')
assert((await balance()) === start - 3_100_000n, 'the wallet spent exactly $3.10: no fee')

const page = await (await fetch(`${site}/pay/${id}`)).text()
assert(/paid/i.test(page), 'the pay page shows it paid')
console.log(`${network.explorerUrl}/tx/${receipt.transactionHash}`)
