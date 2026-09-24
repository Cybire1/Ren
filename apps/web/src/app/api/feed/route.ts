import { failure, type IntentList, kovaForRoute, type Summary, type Terminal } from '@/lib/api'
import { tzQuery, validZone } from '@/lib/tz'

/** One call for everything the live overview shows, so the browser polls a single endpoint. */
export async function GET(request: Request) {
  const tz = validZone(new URL(request.url).searchParams.get('tz'))
  try {
    const [summary, intents, terminals] = await Promise.all([
      kovaForRoute<Summary>(`/v1/summary${tzQuery(tz)}`),
      kovaForRoute<IntentList>('/v1/payment_intents?limit=16'),
      kovaForRoute<{ data: Terminal[] }>('/v1/terminals'),
    ])
    return Response.json({ summary, intents: intents.data, terminals: terminals.data })
  } catch (error) {
    return failure(error)
  }
}
