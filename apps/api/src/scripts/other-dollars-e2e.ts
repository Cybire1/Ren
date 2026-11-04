/**
 * Other dollars end to end, on Tempo testnet against a running Ren API: a wallet is sent AlphaUSD
 * and BetaUSD (the testnet's stand-ins for USDC and USDT), quotes them on Tempo's stablecoin
 * exchange, and turns both into OUSD in one transaction through Ren's relay, which pays the fee.
 * Then a swap into anything but Ren's dollar is refused sponsorship.
 *
 *   pnpm --filter @kova/api other-dollars:e2e        (API_URL, default http://localhost:4400)
 */
import { formatAmount, otherDollars, type SwapIn, swapIntoCalls, swapMinOut } from '@kova/tempo'
import type { Address } from 'viem'
import { Actions } from 'viem/tempo'
import { publicClient, sendFromTreasury, settlementToken } from '../chain.js'
import { newCustomer, walletFor } from './customer-tempo.js'

const api = process.env.API_URL ?? 'http://localhost:4400'
const step = (text: string) => console.log(`\n▸ ${text}`)
const ok = (text: string) => console.log(`  ✓ ${text}`)
function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`✗ ${message}`)
}

const [alpha, beta] = otherDollars.testnet as [
  (typeof otherDollars.testnet)[0],
  (typeof otherDollars.testnet)[0],
]
const balance = async (account: Address, token: Address) =>
  (await Actions.token.getBalance(publicClient as never, { account, token })).amount

const health = (await (await fetch(`${api}/health`)).json()) as {
  chain_id: number
  network: string
  relayer: Address
}
expect(health.network === 'testnet', 'this check runs on testnet only')

step('A wallet is sent $5.00 of AlphaUSD and $2.50 of BetaUSD')
const wallet = newCustomer()
await sendFromTreasury({ token: alpha.address, to: wallet.address, amount: 5_000_000n })
await sendFromTreasury({ token: beta.address, to: wallet.address, amount: 2_500_000n })
expect((await balance(wallet.address, alpha.address)) === 5_000_000n, 'AlphaUSD arrived')
expect((await balance(wallet.address, beta.address)) === 2_500_000n, 'BetaUSD arrived')
expect((await balance(wallet.address, settlementToken.address)) === 0n, 'no OUSD yet')
ok(`${wallet.address} holds them, and no ${settlementToken.symbol}`)

step('Tempo’s exchange quotes each in OUSD')
const swaps: SwapIn[] = []
for (const [dollar, amount] of [
  [alpha, 5_000_000n],
  [beta, 2_500_000n],
] as const) {
  const quoted = await Actions.dex.getSellQuote(publicClient as never, {
    tokenIn: dollar.address,
    tokenOut: settlementToken.address,
    amountIn: amount,
  })
  expect(quoted > 0n, `${dollar.symbol} has a price`)
  swaps.push({ token: dollar.address, amount, quoted })
  ok(`${formatAmount(amount)} ${dollar.symbol} → ${formatAmount(quoted)} ${settlementToken.symbol}`)
}

step('One transaction turns both into OUSD; Ren pays the fee')
const client = walletFor(api, health.chain_id, wallet, settlementToken.address)
const started = Date.now()
const receipt = await client.sendTransactionSync({
  calls: swapIntoCalls(swaps, settlementToken.address),
  feePayer: true,
} as never)
expect(receipt.status === 'success', 'the swaps went through')
const fee = (receipt as unknown as { feePayer?: string }).feePayer
expect(fee?.toLowerCase() === health.relayer.toLowerCase(), 'Ren’s relayer paid the fee')
const got = await balance(wallet.address, settlementToken.address)
const floor = swaps.reduce((sum, s) => sum + swapMinOut(s.quoted), 0n)
expect(got >= floor, `got at least the floor (${formatAmount(floor)})`)
expect((await balance(wallet.address, alpha.address)) === 0n, 'no AlphaUSD left')
expect((await balance(wallet.address, beta.address)) === 0n, 'no BetaUSD left')
ok(
  `${formatAmount(got)} ${settlementToken.symbol} in ${Date.now() - started} ms, fee paid by Ren: ${receipt.transactionHash}`,
)

step('A swap into anything but OUSD isn’t Ren’s to pay for')
await sendFromTreasury({ token: beta.address, to: wallet.address, amount: 1_000_000n })
const refused = await client
  .sendTransactionSync({
    calls: swapIntoCalls(
      [{ token: beta.address, amount: 1_000_000n, quoted: 990_000n }],
      alpha.address,
    ),
    feePayer: true,
  } as never)
  .then(() => null)
  .catch((error: Error) => error.message.split('\n')[0])
expect(refused, 'Ren refused to pay for it')
ok(`refused: ${refused}`)

console.log('\nAll other-dollars checks passed.')
process.exit(0)
