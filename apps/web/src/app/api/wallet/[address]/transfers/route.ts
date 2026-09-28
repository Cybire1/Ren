import { failure, kovaPublic } from '@/lib/api'

/** What moved in and out of a wallet, as Kova reads them from the chain. */
export async function GET(request: Request, context: { params: Promise<{ address: string }> }) {
  const { address } = await context.params
  const url = new URL(request.url)
  const query = new URLSearchParams()
  for (const key of ['after_block', 'direction']) {
    const value = url.searchParams.get(key)
    if (value) query.set(key, value)
  }
  try {
    return Response.json(
      await kovaPublic(`/v1/wallets/${encodeURIComponent(address)}/transfers?${query}`),
    )
  } catch (error) {
    return failure(error)
  }
}
