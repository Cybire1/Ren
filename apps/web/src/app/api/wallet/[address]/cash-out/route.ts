import { failure, kovaPublic } from '@/lib/api'

/** The off-ramp settings for this wallet's cash-out (Ramp Network, AUSD on Monad). */
export async function GET(request: Request, context: { params: Promise<{ address: string }> }) {
  const { address } = await context.params
  const query = new URL(request.url).search
  try {
    return Response.json(
      await kovaPublic(`/v1/wallets/${encodeURIComponent(address)}/cash-out${query}`),
    )
  } catch (error) {
    return failure(error)
  }
}
