import { type Checkout, failure, kovaPublic } from '@/lib/api'

/**
 * Tells Kova a transaction paid this charge (Tempo). Public like the charge itself: Kova reads the
 * transaction from the chain and checks it paid exactly this charge before anything changes.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const body = (await request.json()) as { tx_hash?: string }
    return Response.json(
      await kovaPublic<Checkout>(`/v1/checkout/${encodeURIComponent(id)}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ tx_hash: body.tx_hash }),
      }),
    )
  } catch (error) {
    return failure(error)
  }
}
