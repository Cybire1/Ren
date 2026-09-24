/** Pays one Kova charge from a fresh faucet wallet, the way a customer's phone would. */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { getCheckout } from '../src/lib/api'
import { fundFromFaucet, payCharge } from '../src/lib/chain'

async function main() {
  const id = process.argv[2]
  if (!id) throw new Error('usage: pay-charge <charge id>')
  const payer = privateKeyToAccount(generatePrivateKey())
  await fundFromFaucet(payer.address)
  const c = await getCheckout(id)
  const r = await payCharge(payer, c)
  console.log(`paid ${c.amount} to ${c.merchant_name} in ${r.ms}ms: ${r.hash}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
