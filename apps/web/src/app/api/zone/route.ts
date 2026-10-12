/**
 * The private zone's RPC, reached from the browser (lib/wallet/zone.ts). The zone only answers a
 * wallet that sends its own signed token, and only about that wallet, so this passes calls through
 * unchanged: what it adds is the zone's address and the operator's access key, which stay here.
 * The zone's private RPC has no CORS, so the browser couldn't call it directly anyway.
 */
export async function POST(request: Request) {
  const target = process.env.KOVA_ZONE_RPC_URL
  if (!target)
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32601, message: 'No private zone here' } },
      { status: 404 },
    )
  const body = await request.text()
  if (body.length > 64_000)
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Too large' } },
      { status: 413 },
    )
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const token = request.headers.get('x-authorization-token')
  if (token) headers['X-Authorization-Token'] = token
  const operatorKey = process.env.KOVA_ZONE_RPC_AUTHORIZATION
  if (operatorKey) headers.Authorization = operatorKey
  const response = await fetch(target, { method: 'POST', headers, body, cache: 'no-store' })
  return new Response(await response.text(), {
    status: response.status,
    headers: { 'content-type': 'application/json' },
  })
}
