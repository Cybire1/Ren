import type { schema } from '@kova/db'
import { type Address, type Hash, isAddressEqual, type Log } from 'viem'
import { acceptedTokens, kit, publicClient } from '../chain.js'
import { config } from '../config.js'
import { tokenLogs } from './logs.js'

type TransferRow = typeof schema.transfers.$inferSelect

/** Blocks read per request: about 40 minutes of Tempo. A wallet further behind catches up over a few calls. */
const MAX_SPAN = 5_000n
/** A wallet with no cursor yet (a fresh install, a restored passkey) sees the last span, in one call. */
const FIRST_LOOK = MAX_SPAN - 1n

/**
 * One wallet's transfers on Tempo, read from the chain, in the shape of Kova's transfer index
 * (so Kova Pay and the web wallet read Tempo and Monad the same way). It returns transfers in
 * finalized blocks after `afterBlock`, up to a bounded span, and the block it read through.
 */
export async function walletHistory(
  address: Address,
  afterBlock: bigint,
  direction: 'in' | 'out' | 'all',
) {
  const head = (await publicClient.getBlock({ blockTag: 'finalized' })).number
  let from = afterBlock + 1n
  if (afterBlock === 0n || head - afterBlock > 1_000_000n)
    from = head > FIRST_LOOK ? head - FIRST_LOOK : 0n
  if (from > head) return { rows: [] as TransferRow[], through: head, hasMore: false }
  const to = from + MAX_SPAN - 1n < head ? from + MAX_SPAN - 1n : head

  const [incoming, outgoing] = await Promise.all([
    direction === 'out'
      ? Promise.resolve([] as Log[])
      : tokenLogs({ to: [address], fromBlock: from, toBlock: to }),
    direction === 'in'
      ? Promise.resolve([] as Log[])
      : tokenLogs({ from: [address], fromBlock: from, toBlock: to }),
  ])

  const byTx = new Map<Hash, Log[]>()
  for (const log of [...incoming, ...outgoing]) {
    if (!log.transactionHash) continue
    const list = byTx.get(log.transactionHash) ?? []
    if (!list.some((l) => l.logIndex === log.logIndex)) list.push(log)
    byTx.set(log.transactionHash, list)
  }

  const rows: TransferRow[] = []
  const now = new Date()
  for (const [hash, logs] of byTx) {
    for (const token of acceptedTokens) {
      const tokenLogsOf = logs.filter((l) => isAddressEqual(l.address, token.address))
      for (const t of kit.indexTransfers(tokenLogsOf, token.address)) {
        if (!isAddressEqual(t.to, address) && !isAddressEqual(t.from, address)) continue
        const log = tokenLogsOf.find((l) => l.logIndex === t.logIndex)
        rows.push({
          id: `${hash}:${t.logIndex}`,
          network: config.KOVA_NETWORK,
          tokenAddress: token.address.toLowerCase(),
          fromAddress: t.from.toLowerCase(),
          toAddress: t.to.toLowerCase(),
          amount: t.value,
          txHash: hash,
          logIndex: t.logIndex,
          blockNumber: log?.blockNumber ?? to,
          nonce: t.memo,
          createdAt: now,
        } as TransferRow)
      }
    }
  }
  rows.sort((a, b) =>
    a.blockNumber === b.blockNumber
      ? a.logIndex - b.logIndex
      : a.blockNumber < b.blockNumber
        ? -1
        : 1,
  )
  return { rows, through: to, hasMore: to < head }
}
