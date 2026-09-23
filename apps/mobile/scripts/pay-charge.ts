/** Pays one Kova charge from a fresh faucet wallet, the way a customer's phone would. */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { confirmCheckout, getCheckout } from '../src/lib/api'
import { fundFromFaucet, payCharge } from '../src/lib/chain'

async function main() {
  const id = process.argv[2]
  if (!id) throw new Error('usage: pay-charge <charge id>')
  const payer = privateKeyToAccount(generatePrivateKey())
  await fundFromFaucet(payer.address)
  const c = await getCheckout(id)
  const r = await payCharge(payer, { token: c.token, payTo: c.pay_to, amount: BigInt(c.amount_base), memo: c.memo })
  await confirmCheckout(c.id, r.hash)
  console.log(`paid ${c.amount} to ${c.merchant_name} in ${r.ms}ms`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
