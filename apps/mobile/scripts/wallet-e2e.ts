/**
 * Proves the phone's wallet code against Tempo testnet and a running Kova API:
 * fund → pay a real charge through the relay → send to a person → see it arrive.
 *   npm run e2e:wallet
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { confirmCheckout, createCharge, getCheckout } from '../src/lib/api'
import { fundFromFaucet, getBalance, incomingSince, payCharge, publicClient, sendMoney } from '../src/lib/chain'
import { formatUsd } from '../src/lib/money'

async function main() {
  const maya = privateKeyToAccount(generatePrivateKey())
  const tunde = privateKeyToAccount(generatePrivateKey())
  const start = await publicClient.getBlockNumber()

  let t = Date.now()
  await fundFromFaucet(maya.address)
  console.log(`funded ${maya.address}: ${formatUsd(await getBalance(maya.address))} (${Date.now() - t}ms)`)

  const charge = await createCharge('4.60', { reference: 'wallet e2e' })
  const checkout = await getCheckout(charge.id)
  console.log(`checkout ${checkout.id}: ${checkout.amount} to ${checkout.merchant_name} (${checkout.status})`)
  const paid = await payCharge(maya, {
    token: checkout.token,
    payTo: checkout.pay_to,
    amount: BigInt(checkout.amount_base),
    memo: checkout.memo,
  })
  const confirmed = await confirmCheckout(checkout.id, paid.hash)
  console.log(`paid charge in ${paid.ms}ms → ${confirmed.status}`)

  t = Date.now()
  const sent = await sendMoney(maya, tunde.address, 25_000_000n)
  console.log(`sent $25 to tunde in ${sent.ms}ms`)

  const { transfers } = await incomingSince(tunde.address, start)
  console.log(`tunde sees ${transfers.length} incoming: ${transfers.map((x) => formatUsd(x.amount)).join(', ')}`)
  console.log(`maya balance ${formatUsd(await getBalance(maya.address))}, tunde ${formatUsd(await getBalance(tunde.address))}`)
  if (confirmed.status !== 'paid' || transfers.length !== 1) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
