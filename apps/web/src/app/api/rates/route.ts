import { failure, kovaPublic } from '@/lib/api'

/** The published exchange rates (Chainlink on Monad, two checked sources on Tempo, or Kova's table), for showing money in your currency. */
export async function GET() {
  try {
    return Response.json(await kovaPublic('/v1/rates'))
  } catch (error) {
    return failure(error)
  }
}
