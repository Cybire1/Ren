import {
  type Address,
  type Chain,
  type Hex,
  type LocalAccount,
  parseAbiItem,
  type TransactionReceipt,
} from 'viem'
import { getBlock, getLogs, waitForTransactionReceipt } from 'viem/actions'
import { Actions, createClient, Store, Zone, http as zoneHttp } from 'viem/tempo'

/**
 * Private dollars, on a Tempo Zone: a private chain anchored to Tempo, run by an operator, where
 * balances and payments don't show on Tempo's public explorer. Only the account itself (through
 * the zone's private RPC, with a token it signs) and the operator can see inside.
 *
 * What the zone allows today, and so what Ren offers:
 *
 * - **Move in**: an encrypted deposit from your Tempo balance to your own private balance.
 * - **Send privately**: the same deposit, addressed to someone else. Tempo sees dollars going into
 *   the zone, and how many, but who they're for is encrypted to the zone's sequencer.
 * - **Move out**: a withdrawal from your private balance back to your Tempo balance.
 *
 * Transfers inside a zone are off during Tempo's permissioned zone phase, so a private payment is a
 * deposit to the other person, not a transfer between private balances.
 */

/** The zone a site uses, as the server hands it to the browser. Nothing in it is secret. */
export interface ZoneInfo {
  /** The zone's id on Tempo. */
  id: number
  /** Its chain id. */
  chainId: number
  /** Its portal on Tempo, where deposits go. */
  portal: Address
  /** The dollar it holds: the same address on Tempo and in the zone. */
  token: Address
  /** Tempo's chain id, the zone's parent. */
  parent: number
  /** Who runs it, as people see it named. */
  operator: string
}

/** The zone as a site configures it (lib/zone-site.ts). */
export interface ZoneConfig extends ZoneInfo {
  /** Set only when the zone hangs off a Tempo other than the site's own (a local test chain). */
  parentRpc: string | null
}

/** Where a private balance is read and moved: the zone's private RPC, as this code reaches it. */
export interface ZoneAccess {
  zone: ZoneInfo
  /** The zone's private RPC: this site's /api/zone in the browser, the RPC itself in tests. */
  rpc: string
}

/**
 * Tokens for the zone's private RPC, in memory only: a reload locks the private balance again,
 * and opening it takes the passkey, the way private notes do.
 */
const tokens = Store.memory()
const unlockedUntil = new Map<string, number>()
const key = (zone: ZoneInfo, address: string) => `${zone.chainId}:${address.toLowerCase()}`

const chains = new Map<string, Chain>()
function zoneChain({ zone, rpc }: ZoneAccess): Chain {
  const id = `${zone.chainId}:${rpc}`
  let chain = chains.get(id)
  if (!chain) {
    chain = Zone.from({
      id: zone.chainId,
      name: 'Private zone',
      rpcUrls: { default: { http: [rpc] } },
      sourceId: zone.parent,
    }) as Chain
    chains.set(id, chain)
  }
  return chain
}

/** A client for the zone's private RPC: it sends this wallet's token with every request. */
export function zoneClient(access: ZoneAccess, account?: LocalAccount) {
  return createClient({
    chain: zoneChain(access),
    ...(account ? { account } : {}),
    feeToken: access.zone.token,
    transport: zoneHttp(access.rpc, { store: tokens, timeout: 12_000 }),
  })
}

/** Whether this wallet has proved itself to the zone in this tab, and that proof still holds. */
export function zoneUnlocked(zone: ZoneInfo, address: Address): boolean {
  return (unlockedUntil.get(key(zone, address)) ?? 0) > Date.now() + 60_000
}

/**
 * Proves to the zone that you are you, with one signature: from then on its private RPC shows this
 * wallet its own balance and history, and nothing else. Good for twelve hours, in this tab only.
 */
export async function unlockZone(access: ZoneAccess, account: LocalAccount, hours = 12) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + hours * 3600
  await Actions.zone.signAuthorizationToken(zoneClient(access, account), {
    account,
    // Pass the id: viem derives it from the chain id with mainnet's numbering otherwise.
    zoneId: access.zone.id,
    issuedAt,
    expiresAt,
    store: tokens,
  })
  unlockedUntil.set(key(access.zone, account.address), expiresAt * 1000)
}

/** Forgets this wallet's zone token, as signing out does. */
export async function lockZone(zone: ZoneInfo, address: Address) {
  unlockedUntil.delete(key(zone, address))
  await tokens.removeItem(`auth:token:${zone.chainId}`)
  await tokens.removeItem(`auth:${address.toLowerCase()}:${zone.chainId}`)
}

/** Your private balance, in base units. Needs the zone unlocked. */
export async function privateBalance(access: ZoneAccess, address: Address): Promise<bigint> {
  const { amount } = await Actions.token.getBalance(zoneClient(access) as never, {
    account: address,
    token: access.zone.token,
  })
  return amount
}

/**
 * Moves dollars from a Tempo balance into the zone, for yourself or for someone else: one Tempo
 * transaction that approves the portal and makes an encrypted deposit. `client` signs as the
 * sender on Tempo; with `sponsored`, Ren's fee payer adds the fee, as it does for sends.
 */
export async function deposit(
  client: Parameters<typeof Actions.zone.encryptedDepositSync>[0],
  zone: ZoneInfo,
  parameters: { amount: bigint; to: Address; sponsored: boolean },
): Promise<TransactionReceipt> {
  const { receipt } = await Actions.zone.encryptedDepositSync(client, {
    token: zone.token,
    amount: parameters.amount,
    portalAddress: zone.portal,
    zoneId: zone.id,
    recipient: parameters.to,
    ...(parameters.sponsored ? { feePayer: true } : {}),
  } as never)
  if (receipt.status !== 'success') throw new Error('The deposit didn’t go through.')
  return receipt as TransactionReceipt
}

/** Waits until the zone has read Tempo up to `block`, so a deposit made there has landed. */
export async function waitForZone(access: ZoneAccess, block: bigint, timeout = 30_000) {
  await Actions.zone.waitForTempoBlock(zoneClient(access) as never, {
    tempoBlockNumber: block,
    timeout,
    pollingInterval: 500,
  })
}

/**
 * Moves dollars from your private balance back to a Tempo balance (yours, unless `to` says
 * otherwise): approve the zone's outbox, then request the withdrawal, in one zone transaction.
 * Gas in a zone costs nothing. The sequencer settles it on Tempo in its next batch.
 */
export async function withdraw(
  access: ZoneAccess,
  account: LocalAccount,
  parameters: { amount: bigint; to?: Address },
): Promise<TransactionReceipt> {
  const client = zoneClient(access, account)
  // Not the Sync variant: the private RPC hides the outbox's own event from receipts, which the
  // Sync variant looks for. A receipt of our own transaction is enough.
  const hash = await Actions.zone.requestWithdrawal(
    client as never,
    {
      token: access.zone.token,
      amount: parameters.amount,
      to: parameters.to ?? account.address,
      maxFeePerGas: 0n,
      maxPriorityFeePerGas: 0n,
    } as never,
  )
  const receipt = await waitForTransactionReceipt(client, { hash, timeout: 30_000 })
  if (receipt.status !== 'success') throw new Error('The zone didn’t take the withdrawal.')
  return receipt
}

/** What moved in or out of a private balance, as the zone's private RPC shows its owner. */
export interface PrivateMove {
  kind: 'in' | 'out'
  amount: bigint
  /** The zone transaction: a deposit's mint, or a withdrawal. */
  hash: Hex
  at: number
}

const transfer = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 amount)',
)

/**
 * Your private history: dollars arriving (a deposit's mint, from nobody) and leaving (to the
 * outbox). The private RPC returns only events that name you, so this is all it can show, and
 * it never shows who a deposit came from.
 */
export async function privateMoves(access: ZoneAccess, address: Address): Promise<PrivateMove[]> {
  const client = zoneClient(access)
  const [incoming, outgoing] = await Promise.all([
    getLogs(client, {
      address: access.zone.token,
      event: transfer,
      args: { to: address },
      fromBlock: 0n,
    }),
    getLogs(client, {
      address: access.zone.token,
      event: transfer,
      args: { from: address },
      fromBlock: 0n,
    }),
  ])
  const zero = /^0x0{40}$/i
  const moves = [
    ...incoming
      .filter((l) => l.args.from && zero.test(l.args.from))
      .map((l) => ({ kind: 'in' as const, log: l })),
    ...outgoing.map((l) => ({ kind: 'out' as const, log: l })),
  ]
  const blocks = new Map<bigint, number>()
  for (const { log } of moves) {
    if (log.blockNumber === null || blocks.has(log.blockNumber)) continue
    const block = await getBlock(client, { blockNumber: log.blockNumber }).catch(() => null)
    blocks.set(log.blockNumber, block ? Number(block.timestamp) * 1000 : Date.now())
  }
  return moves
    .map(({ kind, log }) => ({
      kind,
      amount: log.args.amount ?? 0n,
      hash: log.transactionHash as Hex,
      at: (log.blockNumber !== null ? blocks.get(log.blockNumber) : undefined) ?? Date.now(),
    }))
    .sort((a, b) => b.at - a.at)
}
