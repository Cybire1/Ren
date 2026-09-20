/** Times each phase of a sponsored payment, to find where the seconds go. */
import { getNetwork, getToken } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Actions, createClient, http, withRelay } from 'viem/tempo'
import { config } from '../config.js'
import { db, schema } from '../db.js'
import { createIntent } from '../services/intents.js'

const net = getNetwork('testnet')
const token = getToken('testnet', 'USDC')

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const started = performance.now()
  const result = await fn()
  console.log(`${label.padEnd(34)} ${(performance.now() - started).toFixed(0)}ms`)
  return result
}

const merchant = await db.query.merchants.findFirst({
  where: eq(schema.merchants.slug, 'demo-merchant'),
})
if (!merchant) throw new Error('run setup:dev')

const payer = privateKeyToAccount(generatePrivateKey())
const funder = createClient({ testnet: true, transport: http(net.rpcUrl) })
await Actions.faucet.fund(funder, { account: payer.address })
for (let i = 0; i < 40; i++) {
  const b = await Actions.token.getBalance(funder, { account: payer.address, token: token.address })
  if (b.amount > 0n) break
  await new Promise((r) => setTimeout(r, 500))
}

const relayUrl = `http://localhost:${config.PORT}/rpc/relay`
const client = createClient({
  account: payer,
  testnet: true,
  feeToken: token.address,
  transport: withRelay(http(net.rpcUrl), http(relayUrl)),
})

// Warm the merchant's balance slot so we measure the steady state.
for (let round = 1; round <= 3; round++) {
  const intent = await createIntent({ merchant, amount: '1.00', currency: 'USDC' })
  console.log(`\n--- round ${round}`)
  await time('total transferSync', async () => {
    await client.token.transferSync({
      token: intent.tokenAddress as `0x${string}`,
      to: intent.payTo as `0x${string}`,
      amount: intent.amount,
      memo: intent.memo as `0x${string}`,
      feePayer: true,
    })
  })
}

// For comparison: the same payment with no relay, payer paying its own fee.
const direct = createClient({
  account: payer,
  testnet: true,
  feeToken: token.address,
  transport: http(net.rpcUrl),
})
const intent = await createIntent({ merchant, amount: '1.00', currency: 'USDC' })
console.log('\n--- no relay (payer pays its own fee)')
await time('total transferSync', async () => {
  await direct.token.transferSync({
    token: intent.tokenAddress as `0x${string}`,
    to: intent.payTo as `0x${string}`,
    amount: intent.amount,
    memo: intent.memo as `0x${string}`,
  })
})

// And the raw chain round trip, as a floor.
await time('eth_blockNumber (RPC floor)', async () => {
  await funder.getBlockNumber()
})
process.exit(0)
