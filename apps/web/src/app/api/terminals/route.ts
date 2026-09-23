import { kova, type Terminal } from '@/lib/api'

/** The phones paired to this shop. */
export async function GET() {
  try {
    const list = await kova<{ data: Terminal[] }>('/v1/terminals')
    return Response.json(list.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: message }, { status: 502 })
  }
}
