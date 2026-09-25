import { failure, kovaPublic } from '@/lib/api'

/** Sends money a wallet signed over (EIP-3009). Kova's relayer submits it and pays the gas. */
export async function POST(request: Request) {
  try {
    return Response.json(
      await kovaPublic('/v1/transfers', {
        method: 'POST',
        body: JSON.stringify(await request.json()),
      }),
    )
  } catch (error) {
    return failure(error)
  }
}
