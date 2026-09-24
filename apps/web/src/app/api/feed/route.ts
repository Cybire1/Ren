import { failure, type IntentList, kovaForRoute, type Summary, type Terminal } from '@/lib/api'

/** One call for everything the live dashboard shows, so the browser polls a single endpoint. */
export async function GET() {
  try {
    const [summary, intents, terminals] = await Promise.all([
      kovaForRoute<Summary>('/v1/summary'),
      kovaForRoute<IntentList>('/v1/payment_intents?limit=8'),
      kovaForRoute<{ data: Terminal[] }>('/v1/terminals'),
    ])
    return Response.json({ summary, intents: intents.data, terminals: terminals.data })
  } catch (error) {
    return failure(error)
  }
}
