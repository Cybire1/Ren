/**
 * Prepares a local development environment on testnet, for the chain in KOVA_CHAIN:
 *   1. generates a fee-payer key if there is none (into apps/api/.env.<chain>) and funds it:
 *      - Tempo: from Tempo's faucet, which gives it test dollars for fees, refunds and the daily
 *        test-dollar top-ups (Tempo has no gas token);
 *      - Monad: checks it has MON for gas and gives it test AUSD from Agora's faucet
 *   2. creates a demo merchant and saves an API key for the scripts
 *
 * Testnet only. On mainnet the fee payer is a funded KMS key, not a generated one.
 */
import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { schema, uuidv7 } from '@kova/db'
import { AUSD_TESTNET_FAUCET, eip3009Abi, faucetAbi, getToken } from '@kova/monad'
import { formatAmount } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { formatEther } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Actions } from 'viem/tempo'
import { generateApiKey } from '../auth.js'
import {
  balanceOf,
  kit,
  network,
  onTempo,
  publicClient,
  settlementToken,
  walletClient,
} from '../chain.js'
import { config } from '../config.js'
import { db } from '../db.js'

const envFile = `.env.${kit.id}`
const envPath = join(process.cwd(), envFile)

async function main() {
  if (config.KOVA_NETWORK !== 'testnet')
    throw new Error('setup-dev is testnet only: never generate a mainnet relayer key')

  // 1. Relayer
  const key = config.KOVA_FEE_PAYER_PRIVATE_KEY
  if (!key) {
    const fresh = generatePrivateKey()
    appendFileSync(envPath, `KOVA_FEE_PAYER_PRIVATE_KEY=${fresh}\n`, { mode: 0o600 })
    console.log(
      `generated a fee-payer key for ${privateKeyToAccount(fresh).address} in apps/api/${envFile}`,
    )
    console.log(
      onTempo
        ? 'run setup:dev again to fund it from Tempo’s faucet'
        : 'fund it with testnet MON at https://faucet.monad.xyz, then run setup:dev again',
    )
    process.exit(0)
  }
  const relayer = privateKeyToAccount(key as `0x${string}`)
  if (onTempo) {
    // Tempo has no gas token: the fee payer pays fees in test dollars, and hands out test dollars.
    const before = await balanceOf(settlementToken.address, relayer.address)
    if (before < 1_000_000_000n) {
      await Actions.faucet.fundSync(publicClient as never, { account: relayer.address })
      console.log('  asked Tempo’s faucet for test dollars')
    }
    console.log(
      `fee payer ${relayer.address}: ${formatAmount(await balanceOf(settlementToken.address, relayer.address))} ${settlementToken.symbol} on ${network.name}`,
    )
  } else {
    const mon = await publicClient.getBalance({ address: relayer.address })
    console.log(`relayer ${relayer.address}: ${formatEther(mon)} MON on ${network.name}`)
    if (mon === 0n) console.log('  it needs testnet MON for gas: https://faucet.monad.xyz')

    const ausd = getToken('testnet', 'AUSD')
    const dollars = await publicClient.readContract({
      address: ausd.address,
      abi: eip3009Abi,
      functionName: 'balanceOf',
      args: [relayer.address],
    })
    if (dollars === 0n && mon > 0n && walletClient) {
      try {
        await walletClient.writeContractSync({
          address: AUSD_TESTNET_FAUCET,
          abi: faucetAbi,
          functionName: 'requestFunds',
          args: [relayer.address],
        })
        console.log("  asked Agora's faucet for test AUSD")
      } catch {
        // Agora's faucet runs dry (it reverts with InsufficientFunds). Everything else still works;
        // test dollars and refunds need AUSD sent to the relayer by hand.
        console.log(
          `  Agora's faucet gave nothing (it may be empty): send test AUSD to ${relayer.address} for test dollars`,
        )
      }
    }
    const funded = await publicClient.readContract({
      address: ausd.address,
      abi: eip3009Abi,
      functionName: 'balanceOf',
      args: [relayer.address],
    })
    console.log(`  ${formatAmount(funded)} AUSD for refunds`)
  }

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

  // The key goes where the tools that use it read it, never to the terminal.
  const keyFile = join(process.cwd(), '..', 'mobile', envFile)
  writeFileSync(
    keyFile,
    `KOVA_API_KEY=${generated.secret}\nEXPO_PUBLIC_KOVA_${kit.id.toUpperCase()}_API_URL=http://localhost:${config.PORT}\n`,
    { mode: 0o600 },
  )
  console.log(`\nAPI key ${generated.prefix}… saved to apps/mobile/${envFile} (KOVA_API_KEY)`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
