import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { feePayerAddress, network } from './chain.js'
import { config } from './config.js'
import { errorHandler } from './errors.js'
import { relayHandler, relayPath } from './relay.js'
import { healthRoutes } from './routes/health.js'
import { intentRoutes } from './routes/intents.js'
import { reportRoutes } from './routes/reports.js'
import { startWatcher } from './workers/watcher.js'

export const app = new Hono()
app.use(logger())
app.onError(errorHandler)
app.notFound((c) => c.json({ error: { code: 'not_found', message: 'No such endpoint' } }, 404))

app.route('/health', healthRoutes)
app.route('/v1/payment_intents', intentRoutes)
app.route('/v1', reportRoutes)

// Tempo RPC with Kova sponsorship. Apps and terminals point their wallet transport here.
const relay = relayHandler
if (relay) app.all(relayPath, (c) => relay.fetch(c.req.raw))

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  // The watcher catches payments Kova did not submit, such as QR payments from any wallet.
  void startWatcher().catch((error) => console.error('[watcher] failed to start', error))

  serve({ fetch: app.fetch, port: config.PORT }, (info) => {
    console.log(
      `kova api on :${info.port} (${network.id}, chain ${network.chainId})` +
        (feePayerAddress ? ` sponsoring from ${feePayerAddress}` : ' WITHOUT a fee payer'),
    )
  })
}
