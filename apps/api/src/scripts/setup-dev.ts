/**
 * Prepares a local development environment:
 *   1. generates a fee-payer key if `.env` has none, and funds it from the testnet faucet
 *   2. creates a demo merchant and prints an API key
 *
 * Testnet only. On mainnet the fee payer is a funded KMS key, not a generated one.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { schema, uuidv7 } from '@kova/db'
import { getNetwork, getToken } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Actions, createClient, http } from 'viem/tempo'
import { generateApiKey } from '../auth.js'
import { config } from '../config.js'
import { db } from '../db.js'

const envPath = join(process.cwd(), '.env')

async function main() {
  if (config.KOVA_NETWORK !== 'testnet')
    throw new Error('setup-dev is testnet only: never generate a mainnet fee payer key')

  const network = getNetwork('testnet')
  const token = getToken('testnet', 'USDC')

  // 1. Fee payer
  let key = config.KOVA_FEE_PAYER_PRIVATE_KEY
  if (!key) {
    key = generatePrivateKey()
    appendFileSync(envPath, `${existsSync(envPath) ? '' : ''}KOVA_FEE_PAYER_PRIVATE_KEY=${key}\n`)
    console.log('generated a fee payer key and wrote it to apps/api/.env')
  }
  const feePayer = privateKeyToAccount(key as `0x${string}`)

  const client = createClient({
    testnet: true,
    feeToken: token.address,
    transport: http(network.rpcUrl),
  })

  const balance = await Actions.token.getBalance(client, {
    account: feePayer.address,
    token: token.address,
  })
  if (balance.amount === 0n) {
    console.log(`funding fee payer ${feePayer.address} from the faucet...`)
    await Actions.faucet.fund(client, { account: feePayer.address })
    for (let i = 0; i < 40; i++) {
      const next = await Actions.token.getBalance(client, {
        account: feePayer.address,
        token: token.address,
      })
      if (next.amount > 0n) break
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  const funded = await Actions.token.getBalance(client, {
    account: feePayer.address,
    token: token.address,
  })
  console.log(`fee payer ${feePayer.address}: ${funded.formatted} ${token.symbol}`)

  // 2. Demo merchant with its own settlement wallet
  const slug = 'demo-merchant'
  let merchant = await db.query.merchants.findFirst({ where: eq(schema.merchants.slug, slug) })
  if (!merchant) {
    const wallet = privateKeyToAccount(generatePrivateKey())
    const [created] = await db
      .insert(schema.merchants)
      .values({
        id: uuidv7(),
        name: 'Demo Merchant',
        slug,
        settlementAddress: wallet.address,
        network: 'testnet',
        country: 'NG',
        isTest: true,
      })
      .returning()
    merchant = created
    console.log(`created merchant ${slug} settling to ${wallet.address}`)
  }
  if (!merchant) throw new Error('failed to create merchant')

  const generated = generateApiKey(true)
  await db.insert(schema.apiKeys).values({
    id: uuidv7(),
    merchantId: merchant.id,
    name: 'dev',
    prefix: generated.prefix,
    secretHash: generated.secretHash,
    scopes: ['payments:read', 'payments:write'],
    isTest: true,
  })

  console.log('\nAPI key (shown once):')
  console.log(`  ${generated.secret}\n`)
  console.log('Try it:')
  console.log(
    `  curl -s localhost:${config.PORT}/v1/payment_intents -H 'authorization: Bearer ${generated.secret}' \\\n    -H 'content-type: application/json' -d '{"amount":"4.50"}' | jq`,
  )
  process.exit(0)
}

void readFileSync
main().catch((error) => {
  console.error(error)
  process.exit(1)
})
