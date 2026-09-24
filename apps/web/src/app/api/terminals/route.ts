import { failure, kovaForRoute, type Terminal } from '@/lib/api'

export async function GET() {
  try {
    return Response.json((await kovaForRoute<{ data: Terminal[] }>('/v1/terminals')).data)
  } catch (error) {
    return failure(error)
  }
}
