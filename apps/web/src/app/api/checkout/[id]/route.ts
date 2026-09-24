import { type Checkout, failure, kovaPublic } from '@/lib/api'

/** The customer's view of a charge. Public: holding the charge's id is enough. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    return Response.json(await kovaPublic<Checkout>(`/v1/checkout/${encodeURIComponent(id)}`))
  } catch (error) {
    return failure(error)
  }
}
