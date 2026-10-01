import { failure, kovaPublic } from '@/lib/api'

/** Deposits from other chains (Aurora Intents): passed through to Kova's API. */
export async function GET(request: Request, context: { params: Promise<{ address: string }> }) {
  const { address } = await context.params
  const query = new URL(request.url).search
  try {
    return Response.json(
      await kovaPublic(`/v1/wallets/${encodeURIComponent(address)}/deposit-sources${query}`),
    )
  } catch (error) {
    return failure(error)
  }
}
