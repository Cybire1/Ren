import { failure, type KovaEvent, kovaForRoute } from '@/lib/api'

export async function GET() {
  try {
    return Response.json((await kovaForRoute<{ data: KovaEvent[] }>('/v1/events?limit=15')).data)
  } catch (error) {
    return failure(error)
  }
}
