import { failure, kovaPublic } from '@/lib/api'

/** This wallet's permanent deposit address on another chain (Aurora Intents). */
export async function POST(request: Request, context: { params: Promise<{ address: string }> }) {
  const { address } = await context.params
  try {
    return Response.json(
      await kovaPublic(`/v1/wallets/${encodeURIComponent(address)}/deposit-address`, {
        method: 'POST',
        body: JSON.stringify(await request.json()),
      }),
    )
  } catch (error) {
    return failure(error)
  }
}
