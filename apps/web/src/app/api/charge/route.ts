import { kova, type PaymentIntent } from '@/lib/api'

/** Creates a charge. The merchant's API key stays on the server. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    amount?: string
    reference?: string
  }
  if (!body.amount) return Response.json({ error: 'amount is required' }, { status: 400 })

  try {
    const intent = await kova<PaymentIntent>('/v1/payment_intents', {
      method: 'POST',
      body: JSON.stringify({
        amount: body.amount,
        ...(body.reference ? { reference: body.reference } : {}),
      }),
    })
    return Response.json(intent, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: message }, { status: 502 })
  }
}
