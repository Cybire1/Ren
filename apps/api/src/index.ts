import { serve } from '@hono/node-server'
import { runMigrations } from '@kova/db'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { feePayerAddress, network } from './chain.js'
import { config } from './config.js'
import { errorHandler } from './errors.js'
import { relayHandler, relayPath } from './relay.js'
import { checkoutRoutes } from './routes/checkout.js'
import { healthRoutes } from './routes/health.js'
import { intentRoutes } from './routes/intents.js'
import { reportRoutes } from './routes/reports.js'
import { terminalRoutes } from './routes/terminals.js'
import { startWatcher } from './workers/watcher.js'

export const app = new Hono()
app.use(logger())
app.onError(errorHandler)
app.notFound((c) => c.json({ error: { code: 'not_found', message: 'No such endpoint' } }, 404))

app.route('/health', healthRoutes)
app.route('/v1/checkout', checkoutRoutes)
app.route('/v1/payment_intents', intentRoutes)
app.route('/v1/terminals', terminalRoutes)
app.route('/v1', reportRoutes)

// Tempo RPC with Kova sponsorship. Apps and terminals point their wallet transport here.
const relay = relayHandler
if (relay)
  app.all(relayPath, async (c) => {
    const started = performance.now()
    const raw = c.req.raw.clone()
    const response = await relay.fetch(c.req.raw)
    if (process.env.KOVA_TRACE_RELAY) {
      const body = (await raw.json().catch(() => ({}))) as { method?: string }
      console.log(`[relay] ${body.method} ${(performance.now() - started).toFixed(0)}ms`)
    }
    return response
  })

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  await runMigrations(config.DATABASE_URL)

  // The watcher catches payments Kova did not submit, such as QR payments from any wallet.
  void startWatcher().catch((error) => console.error('[watcher] failed to start', error))

  serve({ fetch: app.fetch, port: config.PORT }, (info) => {
    console.log(
      `kova api on :${info.port} (${network.id}, chain ${network.chainId})` +
        (feePayerAddress ? ` sponsoring from ${feePayerAddress}` : ' WITHOUT a fee payer'),
    )
  })
}
