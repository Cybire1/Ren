import { kova, type TerminalPairing } from '@/lib/api'

/** A fresh one-time code for pairing a phone. The merchant key stays on this server. */
export async function POST() {
  try {
    return Response.json(await kova<TerminalPairing>('/v1/terminals/pairings', { method: 'POST' }), { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: message }, { status: 502 })
  }
}
