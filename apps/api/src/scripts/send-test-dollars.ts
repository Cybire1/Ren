/**
 * Development only: sends test dollars from the testnet treasury to an address, in any dollar
 * Ren knows (`<address> <symbol>:<dollars> …`), to set up a wallet for screens and checks.
 *
 *   pnpm --filter @kova/api send:test-dollars 0x… AlphaUSD:5 BetaUSD:2.5
 */
import { otherDollars, parseAmount, supportedTokens } from '@kova/tempo'
import { type Address, isAddress } from 'viem'
import { network, sendFromTreasury } from '../chain.js'

const [to, ...wants] = process.argv.slice(2)
if (network.id !== 'testnet') throw new Error('Test dollars are testnet only.')
if (!to || !isAddress(to)) throw new Error('Pass an address, then symbol:dollars pairs.')
const known = [...supportedTokens(network.id), ...otherDollars[network.id]]
for (const want of wants) {
  const [symbol, dollars] = want.split(':')
  const token = known.find((t) => t.symbol.toLowerCase() === symbol?.toLowerCase())
  if (!token || !dollars) throw new Error(`Don’t know ${want}`)
  const hash = await sendFromTreasury({
    token: token.address,
    to: to as Address,
    amount: parseAmount(dollars),
  })
  console.log(`sent ${dollars} ${token.symbol}: ${hash}`)
}
process.exit(0)
