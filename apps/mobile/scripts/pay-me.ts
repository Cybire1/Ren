/** Sends test dollars to an address from a fresh faucet wallet, like a friend abroad would. */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { fundFromFaucet, sendMoney } from '../src/lib/chain'

const [to, dollars = '25'] = process.argv.slice(2)
async function main() {
  const friend = privateKeyToAccount(generatePrivateKey())
  await fundFromFaucet(friend.address)
  const { hash, ms } = await sendMoney(friend, to as `0x${string}`, BigInt(Math.round(Number(dollars) * 1e6)))
  console.log(`sent $${dollars} from ${friend.address} in ${ms}ms: ${hash}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
