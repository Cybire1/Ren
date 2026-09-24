import { failure, type IntentList, kovaForRoute } from '@/lib/api'

/** Pages through payments for the Payments screen: status filter, search, cursor. */
export async function GET(request: Request) {
  const incoming = new URL(request.url).searchParams
  const query = new URLSearchParams({ limit: '25' })
  for (const key of ['status', 'q', 'before']) {
    const value = incoming.get(key)
    if (value) query.set(key, value)
  }
  try {
    return Response.json(await kovaForRoute<IntentList>(`/v1/payment_intents?${query}`))
  } catch (error) {
    return failure(error)
  }
}
