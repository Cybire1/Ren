/**
 * Puts realistic traffic through a local Kova: creates charges for the demo merchant and
 * pays most of them through Kova's own relay, leaving one waiting.
 *
 * Usage: pnpm demo:payments [count]
 * Testnet only. The payer is a throwaway faucet-funded account.
 */
import { schema } from '@kova/db'
import { getNetwork, getToken } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Actions, createClient, http, withRelay } from 'viem/tempo'
import { config } from '../config.js'
import { db } from '../db.js'
import { createIntent } from '../services/intents.js'
import { confirmTransaction } from '../services/settle.js'

const basket = [
  ['Jollof + drink', '4.50'],
  ['Suya plate', '7.25'],
  ['Zobo, 2', '2.00'],
  ['Puff-puff', '1.25'],
  ['Fried rice + chicken', '9.00'],
  ['Bottled water', '0.75'],
] as const

async function main() {
  if (config.KOVA_NETWORK !== 'testnet') throw new Error('demo:payments is testnet only')

  const network = getNetwork('testnet')
  const token = getToken('testnet', 'USDC')
  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.slug, 'demo-merchant'),
  })
  if (!merchant) throw new Error('run `pnpm setup:dev` first')

  const payer = privateKeyToAccount(generatePrivateKey())
  const funder = createClient({ testnet: true, transport: http(network.rpcUrl) })
  await Actions.faucet.fund(funder, { account: payer.address })
  for (let i = 0; i < 40; i++) {
    const balance = await Actions.token.getBalance(funder, {
      account: payer.address,
      token: token.address,
    })
    if (balance.amount > 0n) break
    await new Promise((r) => setTimeout(r, 500))
  }

  // The payer holds only stablecoins and no gas token: Kova's relay sponsors the fee.
  const client = createClient({
    account: payer,
    testnet: true,
    feeToken: token.address,
    transport: withRelay(http(network.rpcUrl), http(`http://localhost:${config.PORT}/rpc/relay`)),
  })

  const count = Math.min(Number(process.argv[2] ?? 4), basket.length)
  for (let i = 0; i < count; i++) {
    const [reference, amount] = basket[i] as [string, string]
    const intent = await createIntent({ merchant, amount, currency: 'USDC', reference })

    // Leave the last one unpaid, so the dashboard shows a charge still waiting.
    if (i === count - 1) {
      console.log(`${reference.padEnd(24)} ${amount.padStart(6)}  waiting`)
      break
    }

    const started = Date.now()
    const { receipt } = await client.token.transferSync({
      token: intent.tokenAddress as `0x${string}`,
      to: intent.payTo as `0x${string}`,
      amount: intent.amount,
      memo: intent.memo as `0x${string}`,
      feePayer: true,
    })
    const result = await confirmTransaction(receipt.transactionHash)
    console.log(
      `${reference.padEnd(24)} ${amount.padStart(6)}  ${result.status} in ${Date.now() - started}ms  ${receipt.gasUsed} gas`,
    )
    await new Promise((r) => setTimeout(r, 600))
  }
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
