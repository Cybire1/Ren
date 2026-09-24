import { serve } from '@hono/node-server'
import { runMigrations } from '@kova/db'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { feePayerAddress, network } from './chain.js'
import { config } from './config.js'
import { errorHandler } from './errors.js'
import { relayHandler, relayPath } from './relay.js'
import { accountRoutes } from './routes/account.js'
import { catalogRoutes } from './routes/catalog.js'
import { checkoutRoutes } from './routes/checkout.js'
import { healthRoutes } from './routes/health.js'
import { insightRoutes } from './routes/insights.js'
import { intentRoutes } from './routes/intents.js'
import { orderRoutes } from './routes/orders.js'
import { reportRoutes } from './routes/reports.js'
import { stallRoutes } from './routes/stalls.js'
import { expireStaleIntents } from './services/intents.js'
import { terminalRoutes } from './routes/terminals.js'
import { travelRoutes } from './routes/travel.js'
import { expireTrips } from './services/travel.js'
import { webhookRoutes } from './routes/webhooks.js'
import { startWatcher } from './workers/watcher.js'
import { startWebhookWorker } from './workers/webhooks.js'

export const app = new Hono()
app.use(logger())
app.onError(errorHandler)
app.notFound((c) => c.json({ error: { code: 'not_found', message: 'No such endpoint' } }, 404))

app.route('/health', healthRoutes)
app.route('/v1/checkout', checkoutRoutes)
app.route('/v1/payment_intents', intentRoutes)
app.route('/v1/terminals', terminalRoutes)
app.route('/v1', accountRoutes)
app.route('/v1', catalogRoutes)
app.route('/v1', stallRoutes)
app.route('/v1', orderRoutes)
app.route('/v1', travelRoutes)
app.route('/v1', insightRoutes)
app.route('/v1', webhookRoutes)
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
  startWebhookWorker()
  // Charges nobody paid close when their code expires, so "waiting" means someone could still pay.
  const expire = () => {
    void expireStaleIntents().catch((error) => console.error('[expiry]', error))
    void expireTrips().catch((error) => console.error('[expiry] trips', error))
  }
  expire()
  setInterval(expire, 30_000)

  serve({ fetch: app.fetch, port: config.PORT }, (info) => {
    console.log(
      `kova api on :${info.port} (${network.id}, chain ${network.chainId})` +
        (feePayerAddress ? ` sponsoring from ${feePayerAddress}` : ' WITHOUT a fee payer'),
    )
  })
}
