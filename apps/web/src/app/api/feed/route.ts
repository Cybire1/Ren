import { type IntentList, kova, type Summary, type Terminal } from '@/lib/api'

/** One call for everything the dashboard shows, so the browser polls a single endpoint. */
export async function GET() {
  try {
    const [summary, intents, terminals] = await Promise.all([
      kova<Summary>('/v1/summary'),
      kova<IntentList>('/v1/payment_intents?limit=25'),
      kova<{ data: Terminal[] }>('/v1/terminals'),
    ])
    return Response.json({ summary, intents: intents.data, terminals: terminals.data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: message }, { status: 502 })
  }
}
