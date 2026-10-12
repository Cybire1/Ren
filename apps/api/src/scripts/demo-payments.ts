/**
 * Puts realistic traffic through a local Kova: creates charges for the demo merchant and
 * pays most of them through Kova's relayer, leaving one waiting.
 *
 * Usage: pnpm demo:payments [count]
 * Testnet only. The payer is a throwaway customer funded from the local API's faucet.
 */
import { schema } from '@kova/db'
import { eq } from 'drizzle-orm'
import { settlementCurrency } from '../chain.js'
import { config } from '../config.js'
import { db } from '../db.js'
import { encodeId } from '../ids.js'
import { createIntent } from '../services/intents.js'
import { fund, getCheckout, newCustomer, pay } from './customer-chain.js'

// Each under the faucet's $5 top-up, so one fresh customer can pay for one item.
const basket = [
  ['Jollof + drink', '4.50'],
  ['Suya wrap', '4.75'],
  ['Zobo, 2', '2.00'],
  ['Puff-puff', '1.25'],
  ['Meat pie', '3.50'],
  ['Bottled water', '0.75'],
] as const

async function main() {
  if (config.KOVA_NETWORK !== 'testnet') throw new Error('demo:payments is testnet only')
  const api = `http://localhost:${config.PORT}`

  const merchant = await db.query.merchants.findFirst({ where: eq(schema.merchants.slug, 'demo-merchant') })
  if (!merchant) throw new Error('run `pnpm setup:dev` first')

  const count = Math.min(Number(process.argv[2] ?? 4), basket.length)
  for (let i = 0; i < count; i++) {
    const [reference, amount] = basket[i] as [string, string]
    const intent = await createIntent({ merchant, amount, currency: settlementCurrency, reference })

    // Leave the last one unpaid, so the dashboard shows a charge still waiting.
    if (i === count - 1) {
      console.log(`${reference.padEnd(24)} ${amount.padStart(6)}  waiting`)
      break
    }

    // A customer each, like a real queue at the counter. They hold dollars and no gas token:
    // Ren's relayer pays the fee. The faucet's top-up covers one basket item.
    const customer = newCustomer()
    await fund(api, customer.address)
    const checkout = await getCheckout(api, encodeId('paymentIntent', intent.id))
    const paid = await pay(api, checkout, customer)
    console.log(`${reference.padEnd(24)} ${amount.padStart(6)}  ${paid.status} in ${paid.roundTripMs}ms`)
    await new Promise((r) => setTimeout(r, 600))
  }
  process.exit(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
