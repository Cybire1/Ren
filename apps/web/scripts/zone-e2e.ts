/**
 * Private dollars end to end, against a real Tempo Zone: the same functions the web wallet calls
 * (src/lib/wallet/zone.ts), with two fresh wallets.
 *
 *   1. Alice moves $5 into her private balance and reads it back.
 *   2. Alice sends Bob $2 privately: a deposit addressed to him.
 *   3. Bob reads his $2, and can't read Alice's balance.
 *   4. Bob moves his $2 out, and it lands in his Tempo balance.
 *
 * Defaults fit the local stack in docs/zones.md (Anvil in Tempo mode plus `tempo-zone dev`):
 *
 *   pnpm --filter @kova/web exec tsx scripts/zone-e2e.ts
 */
import { type Address, defineChain, http } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Actions, createClient } from 'viem/tempo'
import {
  deposit,
  privateBalance,
  privateMoves,
  unlockZone,
  waitForZone,
  withdraw,
  type ZoneAccess,
} from '../src/lib/wallet/zone'

const env = (name: string, fallback: string) => process.env[name] ?? fallback
const L1_RPC = env('ZONE_L1_RPC', 'http://127.0.0.1:8545')
const access: ZoneAccess = {
  rpc: env('ZONE_RPC', 'http://127.0.0.1:8544'),
  zone: {
    id: Number(env('ZONE_ID', '1')),
    chainId: Number(env('ZONE_CHAIN_ID', '5742371274753')),
    portal: env('ZONE_PORTAL', '0x5ad0000000000000000000000000000000000001') as Address,
    token: env('ZONE_TOKEN', '0x20c0000000000000000000000000000000000001') as Address,
    parent: Number(env('ZONE_PARENT', '1337')),
    operator: 'Ren',
    runtime: env('ZONE_RUNTIME', 'current') === 'sandbox' ? 'sandbox' : 'current',
  },
}
// Anvil's second dev account: funds the test wallets. Not the zone's sequencer, which is the first.
const FUNDER = env(
  'ZONE_FUNDER_KEY',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
) as `0x${string}`
const PATH_USD = '0x20c0000000000000000000000000000000000000' as Address

const parent = defineChain({
  ...tempoModerato,
  id: access.zone.parent,
  rpcUrls: { default: { http: [L1_RPC] } },
})
const onTempo = (key: `0x${string}`) =>
  createClient({
    account: privateKeyToAccount(key),
    chain: parent,
    feeToken: PATH_USD,
    transport: http(L1_RPC),
  })

const usd = (base: bigint) => `$${(Number(base) / 1e6).toFixed(2)}`
const step = (text: string) => console.log(`\n▸ ${text}`)
function check(ok: boolean, text: string) {
  console.log(`  ${ok ? '✓' : '✗'} ${text}`)
  if (!ok) process.exitCode = 1
}
const tempoBalance = (address: Address) =>
  Actions.token
    .getBalance(onTempo(FUNDER) as never, { account: address, token: access.zone.token })
    .then((b) => b.amount)

async function main() {
  const aliceKey = generatePrivateKey()
  const bobKey = generatePrivateKey()
  const alice = privateKeyToAccount(aliceKey)
  const bob = privateKeyToAccount(bobKey)
  console.log(`Zone ${access.zone.id} (chain ${access.zone.chainId}), portal ${access.zone.portal}`)
  console.log(`Alice ${alice.address}\nBob   ${bob.address}`)

  step('Fund Alice on Tempo: $10, plus a dollar of fee token')
  const funder = onTempo(FUNDER)
  await Actions.token.transferSync(funder as never, {
    token: access.zone.token,
    to: alice.address,
    amount: 10_000_000n,
  })
  await Actions.token.transferSync(funder as never, {
    token: PATH_USD,
    to: alice.address,
    amount: 1_000_000n,
  })
  check(
    (await tempoBalance(alice.address)) === 10_000_000n,
    `Alice holds ${usd(await tempoBalance(alice.address))} on Tempo`,
  )

  step('Alice moves $5 into her private balance')
  const moveIn = await deposit(onTempo(aliceKey) as never, access.zone, {
    amount: 5_000_000n,
    to: alice.address,
    sponsored: false,
  })
  console.log(`  deposit on Tempo: ${moveIn.transactionHash} (block ${moveIn.blockNumber})`)
  await unlockZone(access, alice)
  await waitForZone(access, moveIn.blockNumber)
  const alicePrivate = await privateBalance(access, alice.address)
  check(alicePrivate === 5_000_000n, `Alice's private balance: ${usd(alicePrivate)}`)
  check(
    (await tempoBalance(alice.address)) === 5_000_000n,
    `Alice's Tempo balance: ${usd(await tempoBalance(alice.address))}`,
  )

  step('Alice sends Bob $2 privately')
  const toBob = await deposit(onTempo(aliceKey) as never, access.zone, {
    amount: 2_000_000n,
    to: bob.address,
    sponsored: false,
  })
  console.log(`  deposit on Tempo: ${toBob.transactionHash}`)

  step('Bob opens his private balance')
  await unlockZone(access, bob)
  await waitForZone(access, toBob.blockNumber)
  const bobPrivate = await privateBalance(access, bob.address)
  check(bobPrivate === 2_000_000n, `Bob's private balance: ${usd(bobPrivate)}`)
  const peek = await privateBalance(access, alice.address).then(
    (b) => `reads ${usd(b)}`,
    (e: Error) =>
      `refused (${(e as { shortMessage?: string }).shortMessage?.split('\n')[0] ?? e.message.split('\n')[0]})`,
  )
  check(!peek.startsWith('reads $5'), `Bob asking for Alice's private balance: ${peek}`)

  step('Bob moves his $2 out to his Tempo balance')
  const before = await tempoBalance(bob.address)
  const out = await withdraw(access, bob, { amount: 2_000_000n })
  console.log(`  withdrawal in the zone: ${out.transactionHash}`)
  let after = before
  const started = Date.now()
  while (after === before && Date.now() - started < 90_000) {
    await new Promise((r) => setTimeout(r, 1000))
    after = await tempoBalance(bob.address)
  }
  check(
    after - before === 2_000_000n,
    `Bob's Tempo balance went ${usd(before)} → ${usd(after)} in ${((Date.now() - started) / 1000).toFixed(1)} s`,
  )
  check(
    (await privateBalance(access, bob.address)) === 0n,
    'Bob’s private balance is back to $0.00',
  )

  step('Bob’s private history, as the zone shows him')
  const moves = await privateMoves(access, bob.address)
  for (const m of moves) console.log(`  ${m.kind === 'in' ? '+' : '−'}${usd(m.amount)}  ${m.hash}`)
  check(
    moves.some((m) => m.kind === 'in' && m.amount === 2_000_000n) &&
      moves.some((m) => m.kind === 'out'),
    'one arrival, one move out',
  )

  console.log(process.exitCode ? '\nFAILED' : '\nAll good.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
