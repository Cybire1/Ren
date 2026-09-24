/**
 * Pays one checkout the way a customer's wallet would, against any Kova API:
 *   pnpm pay:checkout pi_06gd2a8qmns8desag4t5149j2r [https://api.example.com]
 *
 * It reads the public checkout (amount, address, memo), funds a throwaway testnet account from
 * the faucet, and pays through that API's fee-payer relay, so the payer needs no gas. Useful for
 * watching a stall order, a till sale or a web charge land. Testnet only.
 */
import { getNetwork, getToken } from '@kova/tempo'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Actions, createClient, http, withRelay } from 'viem/tempo'

interface Checkout {
  id: string
  status: string
  amount: string
  amount_base: string
  network: string
  token: string
  pay_to: string
  memo: string
  merchant_name: string
}

async function main() {
  const [id, api = process.env.KOVA_API_URL ?? 'http://localhost:4000'] = process.argv.slice(2)
  if (!id) throw new Error('usage: pay:checkout <checkout id> [api url]')

  const response = await fetch(`${api}/v1/checkout/${id}`)
  const checkout = (await response.json()) as Checkout
  if (!response.ok) throw new Error(`checkout ${id}: ${JSON.stringify(checkout)}`)
  if (checkout.status !== 'requires_payment') throw new Error(`checkout ${id} is ${checkout.status}`)
  if (checkout.network !== 'testnet') throw new Error('pay:checkout is testnet only')

  const network = getNetwork('testnet')
  const token = getToken('testnet', 'USDC')
  const payer = privateKeyToAccount(generatePrivateKey())
  const funder = createClient({ testnet: true, transport: http(network.rpcUrl) })
  await Actions.faucet.fund(funder, { account: payer.address })
  for (let i = 0; i < 40; i++) {
    const balance = await Actions.token.getBalance(funder, { account: payer.address, token: token.address })
    if (balance.amount > 0n) break
    await new Promise((r) => setTimeout(r, 500))
  }

  const client = createClient({
    account: payer,
    testnet: true,
    feeToken: token.address,
    transport: withRelay(http(network.rpcUrl), http(`${api}/rpc/relay`)),
  })
  const started = Date.now()
  const { receipt } = await client.token.transferSync({
    token: checkout.token as `0x${string}`,
    to: checkout.pay_to as `0x${string}`,
    amount: BigInt(checkout.amount_base),
    memo: checkout.memo as `0x${string}`,
    feePayer: true,
  })
  console.log(`paid ${checkout.amount} to ${checkout.merchant_name} in ${Date.now() - started}ms: ${receipt.transactionHash}`)

  // The API's watcher settles it; ask until it says paid.
  for (let i = 0; i < 30; i++) {
    const latest = (await (await fetch(`${api}/v1/checkout/${id}`)).json()) as Checkout
    if (latest.status === 'paid') {
      console.log(`settled: ${id} is paid`)
      process.exit(0)
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  console.log('paid on chain; the API has not marked it paid yet')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
