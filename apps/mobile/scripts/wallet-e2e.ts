/**
 * Proves the phone's wallet code against testnet and a running Kova API, exactly as the app runs
 * it, on the chain the build is for (EXPO_PUBLIC_KOVA_CHAIN, Tempo by default): the wallet is a
 * Mera-derived account like a passkey's, it takes today's test dollars, pays a real charge, sends
 * to a person, and the person sees it arrive. Neither wallet ever pays a fee: Kova does.
 *   npm run e2e:wallet   (reads KOVA_API_KEY from .env.tempo, written by the API's setup:dev)
 */
import { randomBytes } from 'node:crypto'
import { createCharge, getCheckout, setDeviceKey } from '../src/lib/api'
import { fundFromFaucet, getBalance, incomingSince, payCharge, sendMoney } from '../src/lib/chain'
import { chainName, networkId } from '../src/lib/config'
import { openSigningSession } from '../src/lib/keys'
import { formatUsd } from '../src/lib/money'

async function main() {
  const key = process.env.KOVA_API_KEY
  if (!key)
    throw new Error(
      'set KOVA_API_KEY to a merchant key on the API under test (pnpm setup:dev saves one)',
    )
  setDeviceKey(key)

  // Two wallets exactly as passkeys make them: 32 bytes of PRF output through Mera's derivation.
  const maya = (await openSigningSession(new Uint8Array(randomBytes(32)))).account
  const tunde = (await openSigningSession(new Uint8Array(randomBytes(32)))).account
  console.log(`${chainName} ${networkId}: maya ${maya.address}, tunde ${tunde.address}`)

  let t = Date.now()
  await fundFromFaucet(maya.address)
  const funded = await getBalance(maya.address)
  console.log(`funded maya: ${formatUsd(funded)} (${Date.now() - t}ms)`)

  const charge = await createCharge('1.60', { reference: 'wallet e2e' })
  const checkout = await getCheckout(charge.id)
  console.log(
    `checkout ${checkout.id}: ${checkout.amount} ${checkout.currency} to ${checkout.merchant_name} (${checkout.status})`,
  )
  const paid = await payCharge(maya, checkout)
  const after = await getCheckout(charge.id)
  console.log(`paid the charge in ${paid.ms}ms → ${after.status}`)

  const sent = await sendMoney(maya, tunde.address, 2_000_000n)
  console.log(`sent $2.00 to tunde in ${sent.ms}ms`)

  // Tunde's phone learns about it from Kova's API, a second or so behind the chain.
  t = Date.now()
  let seen: Awaited<ReturnType<typeof incomingSince>>['transfers'] = []
  while (Date.now() - t < 20_000 && seen.length === 0) {
    seen = (await incomingSince(tunde.address, 0n)).transfers
    if (seen.length === 0) await new Promise((r) => setTimeout(r, 500))
  }
  const left = await getBalance(maya.address)
  console.log(
    `tunde sees ${seen.length} incoming after ${Date.now() - t}ms: ${seen.map((x) => formatUsd(x.amount)).join(', ')}`,
  )
  console.log(`maya ${formatUsd(left)}, tunde ${formatUsd(await getBalance(tunde.address))}`)
  // Exactly the price and the send left maya's wallet: Kova paid every fee.
  const exact = left === funded - 1_600_000n - 2_000_000n
  console.log(
    exact
      ? 'maya paid no fees: Ren covered them'
      : `maya's balance is off by ${formatUsd(funded - 3_600_000n - left)}`,
  )
  if (after.status !== 'paid' || seen.length !== 1 || !exact) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
