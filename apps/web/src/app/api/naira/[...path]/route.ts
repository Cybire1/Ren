import { headers } from 'next/headers'

/**
 * Naira (the API's services/naira.ts), reached from the browser: paying a charge in naira through
 * Paystack, and a wallet cashing out to a Nigerian bank (with its own signed-in token, passed
 * through). This adds only who's asking, so the API's limits count each visitor. Anything else is
 * refused here.
 */

const baseUrl = process.env.KOVA_API_URL ?? 'http://localhost:4000'

const ALLOWED = [
  /^naira(\/(banks|account|quote))?$/,
  /^checkout\/pi_[0-9a-z]{26}\/naira(\/verify)?$/,
  /^wallets\/0x[0-9a-fA-F]{40}\/cash-outs(\/[0-9a-f-]{36}(\/sent)?)?$/,
]

async function forward(request: Request, path: string[]) {
  const joined = path.join('/')
  if (!ALLOWED.some((pattern) => pattern.test(joined)))
    return Response.json({ error: { code: 'not_found', message: 'No such endpoint' } }, { status: 404 })
  const secret = process.env.KOVA_PROXY_SECRET
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim()
  const authorization = request.headers.get('authorization')
  const query = new URL(request.url).search
  const response = await fetch(`${baseUrl}/v1/${joined}${query}`, {
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
