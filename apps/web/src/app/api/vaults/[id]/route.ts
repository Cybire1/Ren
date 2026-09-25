import { failure, kovaPublic } from '@/lib/api'

/**
 * A passkey wallet's encrypted backup (name, currency, people), read and replaced from the web as
 * the Kova app does. Kova holds ciphertext it can't read; only the vault's own key replaces it.
 */
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    return Response.json(await kovaPublic(`/v1/vaults/${encodeURIComponent(id)}`))
  } catch (error) {
    return failure(error)
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    return Response.json(
      await kovaPublic(`/v1/vaults/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(await request.json()),
      }),
    )
  } catch (error) {
    return failure(error)
  }
}
