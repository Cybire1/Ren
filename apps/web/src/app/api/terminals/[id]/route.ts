import { kova } from '@/lib/api'

/** Removes a terminal. Its phone's key stops working at once. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    return Response.json(await kova(`/v1/terminals/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: message }, { status: 502 })
  }
}
