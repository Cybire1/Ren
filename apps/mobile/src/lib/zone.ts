import { gcm } from '@noble/ciphers/aes'
import { secp256k1 } from '@noble/curves/secp256k1'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import {
  type Address,
  bytesToHex,
  type Chain,
  concatBytes,
  encodeFunctionData,
  type Hex,
  hexToBytes,
  isAddressEqual,
  type LocalAccount,
  numberToBytes,
  parseAbi,
  parseAbiItem,
  type TransactionReceipt,
} from 'viem'
import {
  estimateGas,
  getBlock,
  getBlockNumber,
  getGasPrice,
  getLogs,
  sendTransactionSync,
  waitForTransactionReceipt,
} from 'viem/actions'
import { Abis, Actions, Addresses, createClient, Store, Zone, http as zoneHttp } from 'viem/tempo'
import { directOrThroughRen } from './transport'

/**
 * Private dollars on a Tempo Zone, from the phone: the web wallet's zone client
 * (apps/web src/lib/wallet/zone.ts) for React Native. Deposits are sealed here with noble, for both
 * zone runtimes, because viem's own sealing needs WebCrypto, which Hermes doesn't have.
 *
 * - **Move in**: an encrypted deposit from your Tempo balance to your own private balance.
 * - **Send privately**: the same deposit, addressed to someone else. Tempo sees dollars going into
 *   the zone, and how many, not who they're for.
 * - **Move out**: a withdrawal from your private balance back to your Tempo balance.
 *
 * The phone talks to the zone's private RPC directly (no CORS in an app), with a token it signs, so
 * the RPC shows this wallet its own balance and history and nothing else.
 */

export interface ZoneInfo {
  id: number
  chainId: number
  /** Its portal on Tempo, where deposits go. */
  portal: Address
  /** The dollar it holds: the same address on Tempo and in the zone. */
  token: Address
  /** Tempo's chain id, the zone's parent. */
  parent: number
  /** Who runs it, as people see it named. */
  operator: string
  /** `current`, or `sandbox` (Tempo's persistent testnet zones A and B, an earlier portal). */
  runtime: 'current' | 'sandbox'
  /** The zone's private RPC. */
  rpc: string
  /** Ren's web server's pass-through to that RPC, for a network that can't reach it (transport.ts). */
  proxy?: string
}

/** Tokens for the zone's private RPC, in memory only: the app relaunching locks the balance again. */
const tokens = Store.memory()
const unlockedUntil = new Map<string, number>()
const key = (zone: ZoneInfo, address: string) => `${zone.chainId}:${address.toLowerCase()}`

const chains = new Map<number, Chain>()
function zoneChain(zone: ZoneInfo): Chain {
  let chain = chains.get(zone.chainId)
  if (!chain) {
    chain = Zone.from({
      id: zone.chainId,
      name: 'Private zone',
      rpcUrls: { default: { http: [zone.rpc] } },
      sourceId: zone.parent,
    }) as Chain
    chains.set(zone.chainId, chain)
  }
  return chain
}

export function zoneClient(zone: ZoneInfo, account?: LocalAccount) {
  return createClient({
    chain: zoneChain(zone),
    ...(account ? { account } : {}),
    feeToken: zone.token,
    transport: zone.proxy
      ? directOrThroughRen(
          `zone-${zone.chainId}`,
          zoneHttp(zone.rpc, { store: tokens, timeout: 12_000, retryCount: 1 }),
          zoneHttp(zone.proxy, { store: tokens, timeout: 15_000 }),
        )
      : zoneHttp(zone.rpc, { store: tokens, timeout: 12_000 }),
  })
}

export function zoneUnlocked(zone: ZoneInfo, address: Address): boolean {
  return (unlockedUntil.get(key(zone, address)) ?? 0) > Date.now() + 60_000
}

/** One signature proves to the zone that you're you, for twelve hours, in memory only. */
export async function unlockZone(zone: ZoneInfo, account: LocalAccount, hours = 12) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + hours * 3600
  await Actions.zone.signAuthorizationToken(zoneClient(zone, account), {
    account,
    // Pass the id: viem derives it from the chain id with mainnet's numbering otherwise.
    zoneId: zone.id,
    issuedAt,
    expiresAt,
    store: tokens,
  })
  unlockedUntil.set(key(zone, account.address), expiresAt * 1000)
}

export async function lockZone(zone: ZoneInfo, address: Address) {
  unlockedUntil.delete(key(zone, address))
  await tokens.removeItem(`auth:token:${zone.chainId}`)
  await tokens.removeItem(`auth:${address.toLowerCase()}:${zone.chainId}`)
}

export async function privateBalance(zone: ZoneInfo, address: Address): Promise<bigint> {
  const { amount } = await Actions.token.getBalance(zoneClient(zone) as never, {
    account: address,
    token: zone.token,
  })
  return amount
}

/** The earlier portal's encrypted deposit (Tempo's sandbox zones): no refund address. */
const sandboxPortal = parseAbi([
  'function depositEncrypted(address token, uint128 amount, uint256 keyIndex, (bytes32 ephemeralPubkeyX, uint8 ephemeralPubkeyYParity, bytes ciphertext, bytes12 nonce, bytes16 tag) encrypted) returns (bytes32)',
])

/**
 * Seals a deposit's recipient to the zone's sequencer: ECIES on secp256k1, the AES-256-GCM key from
 * HKDF-SHA256 over the shared point's x, salted "ecies-aes-key", with the portal, key index and
 * ephemeral key as info, and on a current-runtime zone the depositor too.
 */
function seal(
  sequencer: { prefix: number; x: Hex },
  to: Address,
  portal: Address,
  keyIndex: bigint,
  sender: Address | null,
) {
  const sequencerKey = concatBytes([Uint8Array.of(sequencer.prefix), hexToBytes(sequencer.x)])
  const ephemeral = secp256k1.utils.randomPrivateKey()
  const ephemeralPublic = secp256k1.getPublicKey(ephemeral, true)
  const shared = secp256k1.getSharedSecret(ephemeral, sequencerKey, true).slice(1)
  const info = concatBytes([
    hexToBytes(portal),
    numberToBytes(keyIndex, { size: 32 }),
    ephemeralPublic.slice(1),
    ...(sender ? [hexToBytes(sender)] : []),
  ])
  const aesKey = hkdf(sha256, shared, new TextEncoder().encode('ecies-aes-key'), info, 32)
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  // Recipient, an empty memo, and padding: 64 bytes of ciphertext and a 16-byte tag.
  const sealed = gcm(aesKey, nonce).encrypt(
    concatBytes([hexToBytes(to), new Uint8Array(32), new Uint8Array(12)]),
  )
  return {
    ephemeralPubkeyX: bytesToHex(ephemeralPublic.slice(1)),
    ephemeralPubkeyYParity: ephemeralPublic[0] as number,
    ciphertext: bytesToHex(sealed.slice(0, 64)),
    nonce: bytesToHex(nonce),
    tag: bytesToHex(sealed.slice(64)),
  }
}

/**
 * Moves dollars from a Tempo balance into the zone, for yourself or someone else: approve the
 * portal and deposit, sealed, in one Tempo transaction that Ren's relay pays the fee for.
 */
export async function deposit(
  client: Parameters<typeof sendTransactionSync>[0],
  zone: ZoneInfo,
  parameters: { amount: bigint; to: Address; from: Address },
): Promise<TransactionReceipt> {
  const { keyIndex, publicKey } = await Actions.zone.getEncryptionKey(client as never, {
    portalAddress: zone.portal,
    zoneId: zone.id,
  })
  const sandbox = zone.runtime === 'sandbox'
  const encrypted = seal(publicKey, parameters.to, zone.portal, keyIndex, sandbox ? null : parameters.from)
  const depositData = sandbox
    ? encodeFunctionData({
        abi: sandboxPortal,
        functionName: 'depositEncrypted',
        args: [zone.token, parameters.amount, keyIndex, encrypted],
      })
    : encodeFunctionData({
        abi: Abis.zonePortal,
        functionName: 'depositEncrypted',
        // A bounce refunds the depositor.
        args: [zone.token, parameters.amount, keyIndex, encrypted as never, parameters.from],
      })
  const receipt = await sendTransactionSync(client as never, {
    calls: [
      {
        to: zone.token,
        data: encodeFunctionData({
          abi: Abis.tip20,
          functionName: 'approve',
          args: [zone.portal, parameters.amount],
        }),
      },
      { to: zone.portal, data: depositData },
    ],
    feePayer: true,
  } as never)
  if (receipt.status !== 'success') throw new Error('The deposit didn’t go through.')
  return receipt as TransactionReceipt
}

/** Waits until the zone has read Tempo up to `block`, so a deposit made there has landed. */
export async function waitForZone(zone: ZoneInfo, block: bigint, timeout = 30_000) {
  await Actions.zone.waitForTempoBlock(zoneClient(zone) as never, {
    tempoBlockNumber: block,
    timeout,
    pollingInterval: 500,
  })
}

/**
 * Moves dollars from your private balance back to a Tempo balance: approve the zone's outbox and
 * request the withdrawal, in one zone transaction. A sandbox zone charges its gas in the zone's
 * dollar, up front for the gas limit, so the limit is the estimate plus a fifth.
 */
export async function withdraw(
  zone: ZoneInfo,
  account: LocalAccount,
  parameters: { amount: bigint; to?: Address },
): Promise<TransactionReceipt> {
  const client = zoneClient(zone, account)
  const request = { token: zone.token, amount: parameters.amount, to: parameters.to ?? account.address }
  const fees =
    zone.runtime === 'current'
      ? { maxFeePerGas: 0n, maxPriorityFeePerGas: 0n }
      : {
          gas:
            ((await estimateGas(client as never, {
              account,
              calls: Actions.zone.requestWithdrawal.calls(request as never),
            } as never)) *
              12n) /
            10n,
        }
  // Not the Sync variant: the private RPC hides the outbox's event from receipts.
  const hash = await Actions.zone.requestWithdrawal(client as never, { ...request, ...fees } as never)
  const receipt = await waitForTransactionReceipt(client, { hash, timeout: 30_000 })
  if (receipt.status !== 'success') throw new Error('The zone didn’t take the withdrawal.')
  return receipt
}

/** What a move out keeps back for the zone's gas, rounded up to a cent: nothing on a current zone. */
export async function moveOutReserve(zone: ZoneInfo): Promise<bigint> {
  if (zone.runtime === 'current') return 0n
  const price = await getGasPrice(zoneClient(zone))
  const cost = (600_000n * price) / 10n ** 12n
  return ((cost + 9_999n) / 10_000n) * 10_000n
}

export interface PrivateMove {
  kind: 'in' | 'out'
  amount: bigint
  hash: Hex
  at: number
}

const transfer = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 amount)')
/** Zones cap a log query at a million blocks: about three days, at a block every 250 ms. */
const HISTORY_BLOCKS = 900_000n

/** Your private history: dollars arriving (a deposit's mint) and leaving (to the outbox). */
export async function privateMoves(zone: ZoneInfo, address: Address): Promise<PrivateMove[]> {
  const client = zoneClient(zone)
  const head = await getBlockNumber(client)
  const fromBlock = head > HISTORY_BLOCKS ? head - HISTORY_BLOCKS : 0n
  const [incoming, outgoing] = await Promise.all([
    getLogs(client, { address: zone.token, event: transfer, args: { to: address }, fromBlock, toBlock: head }),
    getLogs(client, { address: zone.token, event: transfer, args: { from: address }, fromBlock, toBlock: head }),
  ])
  const zero = /^0x0{40}$/i
  const moves = [
    ...incoming.filter((l) => l.args.from && zero.test(l.args.from)).map((l) => ({ kind: 'in' as const, log: l })),
    // The transfer to the outbox is the move out; a sandbox zone's gas goes to its fee manager.
    ...outgoing
      .filter((l) => l.args.to && isAddressEqual(l.args.to, Addresses.zoneOutbox))
      .map((l) => ({ kind: 'out' as const, log: l })),
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
