import { kovaUrl } from '@/lib/api'

/**
 * Kova's fee-payer relay, reached from the browser (Tempo). The web wallet and email/Google
 * wallets send their signed Tempo transactions through it and Kova adds the fee. It passes the
 * JSON-RPC call through unchanged: the API's own policy decides what Kova pays for.
 */
export async function POST(request: Request) {
  const body = await request.text()
  if (body.length > 64_000)
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Too large' } },
      { status: 413 },
    )
  const response = await fetch(kovaUrl('/rpc/relay'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
  return new Response(await response.text(), {
    status: response.status,
    headers: { 'content-type': 'application/json' },
  })
}
