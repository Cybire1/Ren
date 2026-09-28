import { formatAmount } from '@kova/tempo'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { formatEther } from 'viem'
import {
  balanceOf,
  feePayerAddress,
  kit,
  network,
  onTempo,
  publicClient,
  settlementToken,
} from '../chain.js'
import { db } from '../db.js'
import { indexedThrough } from '../workers/watcher.js'

/**
 * Liveness plus what a payment needs: the database, the chain, and a fee payer with money for
 * fees (on Tempo, dollars; on Monad, MON for gas).
 */
export const healthRoutes = new Hono().get('/', async (c) => {
  const checks: Record<string, unknown> = {
    chain: network.name,
    chain_kind: kit.id,
    network: network.id,
    chain_id: network.chainId,
    settlement_token: { symbol: settlementToken.symbol, address: settlementToken.address },
    relayer: feePayerAddress ?? null,
  }

  const [database, head, indexed] = await Promise.allSettled([
    db.execute(sql`select 1`),
    publicClient.getBlockNumber(),
    indexedThrough(),
  ])
  checks.database = database.status === 'fulfilled' ? 'ok' : 'error'
  checks.block = head.status === 'fulfilled' ? Number(head.value) : null
  // How far the transfer index trails the chain, in blocks.
  checks.index_lag =
    head.status === 'fulfilled' && indexed.status === 'fulfilled' && indexed.value !== null
      ? Number(head.value - indexed.value)
      : null

  if (feePayerAddress && head.status === 'fulfilled') {
    const dollars = await balanceOf(settlementToken.address, feePayerAddress).catch(() => undefined)
    checks.relayer_balance =
      dollars === undefined ? null : `${formatAmount(dollars)} ${settlementToken.symbol}`
    if (onTempo) {
      // Tempo has no gas token: the fee payer pays fees in the dollars above.
      checks.relayer_gas = checks.relayer_balance
    } else {
      const mon = await publicClient.getBalance({ address: feePayerAddress }).catch(() => undefined)
      checks.relayer_gas = mon === undefined ? null : `${formatEther(mon)} MON`
    }
  }

  const healthy = checks.database === 'ok' && head.status === 'fulfilled'
  return c.json({ status: healthy ? 'ok' : 'degraded', ...checks }, healthy ? 200 : 503)
})
