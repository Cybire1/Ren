import { kova, type PaymentIntent } from '@/lib/api'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    return Response.json(await kova<PaymentIntent>(`/v1/payment_intents/${id}`))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: message }, { status: 502 })
  }
}
