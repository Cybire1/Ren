import { headers } from 'next/headers'

/**
 * Keys (components/wallet/keys-state.ts), reached from the browser: the wallet's keys, its agents'
 * payments waiting for a yes, and allowance invites. A wallet proves itself to the API with its
 * own signed-in token, which this passes through unchanged; it adds only who's asking, so the API's
 * per-visitor limits see each visitor rather than this server. Anything else is refused here.
 */

const baseUrl = process.env.KOVA_API_URL ?? 'http://localhost:4000'
/** Where agents reach the API themselves (its MCP server), when that differs from this server's route to it. */
const publicApi = process.env.KOVA_PUBLIC_API_URL ?? baseUrl

const ALLOWED = [
  /^wallets\/0x[0-9a-fA-F]{40}\/keys(\/sign-in|\/agents|\/allowances|\/[0-9a-f-]{36}(\/(confirm|freeze|unfreeze|revoke|token|payments|authorize))?)?$/,
  /^wallets\/0x[0-9a-fA-F]{40}\/approvals\/[0-9a-f-]{36}$/,
  /^allowances\/[A-Za-z0-9_-]{16}(\/claim)?$/,
]

async function forward(request: Request, path: string[]) {
  const joined = path.join('/')
  if (joined === 'connect') return Response.json({ api_url: publicApi, mcp_url: `${publicApi}/mcp` })
  if (!ALLOWED.some((pattern) => pattern.test(joined)))
    return Response.json({ error: { code: 'not_found', message: 'No such endpoint' } }, { status: 404 })
  const secret = process.env.KOVA_PROXY_SECRET
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim()
  const authorization = request.headers.get('authorization')
  const response = await fetch(`${baseUrl}/v1/${joined}`, {
    method: request.method,
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {}),
      ...(secret && ip ? { 'x-kova-proxy-secret': secret, 'x-kova-client-ip': ip } : {}),
    },
    ...(request.method === 'POST' ? { body: await request.text() } : {}),
    cache: 'no-store',
  }).catch(() => null)
  if (!response)
    return Response.json({ error: { code: 'internal', message: 'Ren is unreachable right now.' } }, { status: 502 })
  return new Response(await response.text(), {
    status: response.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

type Context = { params: Promise<{ path: string[] }> }

export async function GET(request: Request, context: Context) {
  return forward(request, (await context.params).path)
}

export async function POST(request: Request, context: Context) {
  return forward(request, (await context.params).path)
}
