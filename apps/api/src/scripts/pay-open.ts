/**
 * Pays the charges that are currently waiting, the way a customer would.
 *
 * Useful when you have a charge on screen and want to watch it settle:
 *   pnpm pay:open
 *
 * Testnet only. The payer is a throwaway faucet-funded account.
 */
import { schema } from '@kova/db'
import { getNetwork, getToken } from '@kova/tempo'
import { and, eq } from 'drizzle-orm'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Actions, createClient, http, withRelay } from 'viem/tempo'
import { config } from '../config.js'
import { db } from '../db.js'
import { confirmTransaction } from '../services/settle.js'

async function main() {
  if (config.KOVA_NETWORK !== 'testnet') throw new Error('pay:open is testnet only')

  const open = await db.query.paymentIntents.findMany({
    where: and(
      eq(schema.paymentIntents.status, 'requires_payment'),
      eq(schema.paymentIntents.network, 'testnet'),
    ),
  })
  const payable = open.filter((intent) => intent.expiresAt.getTime() > Date.now())
  if (payable.length === 0) {
    console.log('nothing waiting')
    process.exit(0)
  }

  const network = getNetwork('testnet')
  const token = getToken('testnet', 'USDC')
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

  const client = createClient({
    account: payer,
    testnet: true,
    feeToken: token.address,
    transport: withRelay(http(network.rpcUrl), http(`http://localhost:${config.PORT}/rpc/relay`)),
  })

  for (const intent of payable) {
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
      `${intent.reference ?? intent.id}: ${result.status} in ${Date.now() - started}ms (${receipt.gasUsed} gas)`,
    )
  }
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
