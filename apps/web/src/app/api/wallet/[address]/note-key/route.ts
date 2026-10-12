import { failure, kovaPublic } from '@/lib/api'

type Context = { params: Promise<{ address: string }> }

/** A wallet's note key, which private notes to it are sealed with. */
export async function GET(_request: Request, context: Context) {
  const { address } = await context.params
  try {
    return Response.json(await kovaPublic(`/v1/wallets/${encodeURIComponent(address)}/note-key`))
  } catch (error) {
    return failure(error)
  }
}

/** Publishes this wallet's note key, signed by the wallet (the API checks the signature). */
export async function PUT(request: Request, context: Context) {
  const { address } = await context.params
  try {
    return Response.json(
      await kovaPublic(`/v1/wallets/${encodeURIComponent(address)}/note-key`, {
        method: 'PUT',
        body: JSON.stringify(await request.json()),
      }),
    )
  } catch (error) {
    return failure(error)
  }
}
