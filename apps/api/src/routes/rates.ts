import { Hono } from 'hono'
import { rateBook, serializeRates } from '../services/rates.js'

/** Public: the reference rates Kova shows local prices at, and where they come from. */
export const rateRoutes = new Hono().get('/rates', async (c) => {
  c.header('cache-control', 'public, max-age=60')
  return c.json(serializeRates(await rateBook()))
})
