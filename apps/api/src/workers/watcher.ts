import { schema } from '@kova/db'
import { decodeMemo } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import type { Address, Hash, Log } from 'viem'
import { Abis } from 'viem/tempo'
import { network, publicClient, settlementToken, tokenFor } from '../chain.js'
import { config } from '../config.js'
import { db } from '../db.js'
import { settleFromReceipt } from '../services/settle.js'

/**
 * Watches Tempo for transfers that pay Kova intents.
 *
 * The relay only sees payments Kova submits. A customer paying a QR code from any other
 * wallet is invisible to it, so this is what makes those payments land. It is also the
 * backstop when a client never calls /confirm: settlement is idempotent, so the watcher
 * re-reporting a payment the relay already recorded is a no-op.
 */

const TRANSFER_WITH_MEMO = Abis.tip20.find(
  (item) => item.type === 'event' && item.name === 'TransferWithMemo',
) as never

/** Tokens Kova accepts. A transfer in anything else is not a Kova payment. */
const watchedTokens: Address[] = [
  settlementToken.address,
  tokenFor('pathUSD').address,
  tokenFor('USDT0').address,
]

/** How far back to look on a cold start, so a fresh deployment is not blind to open intents. */
const COLD_START_LOOKBACK = 2_000n

/** Blocks are ~0.56s, so this is about two blocks behind at worst. */
const POLL_INTERVAL = 1_000

export interface WatcherHandle {
  stop: () => Promise<void>
}

async function loadCursor(): Promise<bigint> {
  const row = await db.query.watcherState.findFirst({
    where: eq(schema.watcherState.network, config.KOVA_NETWORK),
  })
  if (row) return row.lastBlock

  const head = await publicClient.getBlockNumber()
  const from = head > COLD_START_LOOKBACK ? head - COLD_START_LOOKBACK : 0n
  await db
    .insert(schema.watcherState)
    .values({ network: config.KOVA_NETWORK, lastBlock: from })
    .onConflictDoNothing()
  return from
}

async function saveCursor(block: bigint): Promise<void> {
  await db
    .insert(schema.watcherState)
    .values({ network: config.KOVA_NETWORK, lastBlock: block, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.watcherState.network,
      set: { lastBlock: block, updatedAt: new Date() },
    })
}

/** Settles one transfer, if its memo belongs to Kova. */
export async function handleTransferLog(log: Log): Promise<void> {
  const memo = log.topics[3]
  if (!memo || !decodeMemo(memo)) return
  if (!log.transactionHash) return
  await settleTransaction(log.transactionHash)
}

async function settleTransaction(hash: Hash): Promise<void> {
  const existing = await db.query.payments.findFirst({
    where: eq(schema.payments.txHash, hash),
  })
  if (existing) return

  const receipt = await publicClient.getTransactionReceipt({ hash })
  const result = await settleFromReceipt(receipt as never)
  if (result.status !== 'ignored') console.log(`[watcher] ${hash} -> ${result.status}`)
}

/** Replays a block range. Used on startup and to fill gaps after downtime. */
export async function catchUp(fromBlock: bigint, toBlock: bigint): Promise<number> {
  if (toBlock < fromBlock) return 0
  const logs = await publicClient.getLogs({
    address: watchedTokens,
    event: TRANSFER_WITH_MEMO,
    fromBlock,
    toBlock,
  })
  for (const log of logs) await handleTransferLog(log)
  return logs.length
}

export async function startWatcher(): Promise<WatcherHandle> {
  let cursor = await loadCursor()
  let stopped = false

  const head = await publicClient.getBlockNumber()
  const caught = await catchUp(cursor + 1n, head)
  cursor = head
  await saveCursor(cursor)
  console.log(`[watcher] ${network.id}: caught up to block ${head} (${caught} transfers)`)

  // Poll for new logs. viem's watchEvent uses server-side filters, which this RPC drops
  // after a while ("filter not found"); a cursor plus getLogs has no such state.
  let inFlight = false
  const poll = setInterval(() => {
    void (async () => {
      if (stopped || inFlight) return
      inFlight = true
      try {
        const latest = await publicClient.getBlockNumber()
        if (latest > cursor) {
          await catchUp(cursor + 1n, latest)
          cursor = latest
          await saveCursor(cursor)
        }
      } catch (error) {
        console.error('[watcher] poll failed', error)
      } finally {
        inFlight = false
      }
    })()
  }, POLL_INTERVAL)

  return {
    stop: async () => {
      stopped = true
      clearInterval(poll)
      await saveCursor(cursor)
    },
  }
}
