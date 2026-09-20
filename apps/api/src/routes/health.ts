import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { feePayerAddress, network, publicClient, settlementToken } from '../chain.js'
import { db } from '../db.js'

/** Liveness plus the three dependencies a payment needs: database, chain, fee payer. */
export const healthRoutes = new Hono().get('/', async (c) => {
  const checks: Record<string, unknown> = {
    network: network.id,
    chain_id: network.chainId,
    settlement_token: { symbol: settlementToken.symbol, address: settlementToken.address },
    fee_payer: feePayerAddress ?? null,
  }

  const [database, chain] = await Promise.allSettled([
    db.execute(sql`select 1`),
    publicClient.getBlockNumber(),
  ])
  checks.database = database.status === 'fulfilled' ? 'ok' : 'error'
  checks.chain =
    chain.status === 'fulfilled' ? { ok: true, block: Number(chain.value) } : { ok: false }

  if (feePayerAddress && chain.status === 'fulfilled') {
    const balance = await publicClient.token
      .getBalance({ account: feePayerAddress, token: settlementToken.address })
      .catch(() => undefined)
    checks.fee_payer_balance = balance?.formatted ?? null
  }

  const healthy = checks.database === 'ok' && (checks.chain as { ok: boolean }).ok
  return c.json({ status: healthy ? 'ok' : 'degraded', ...checks }, healthy ? 200 : 503)
})
