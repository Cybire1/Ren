import { failure, kovaPublic } from '@/lib/api'

/**
 * The dollar card (the API's dollar-card routes), passed through from the browser. Only these
 * paths, so the route can't be used to reach anything else; every change is signed by the wallet
 * itself, and a top-up is paid by the wallet's own transfer on Tempo, reported by its hash.
 */
const GET_PATHS = new Set(['dollar-card'])
const POST_PATHS = new Set([
  'access-requests',
  'dollar-card/check',
  'dollar-card/top-up',
  'dollar-card/withdraw',
  'dollar-card/settings',
  'dollar-card/delete',
  'dollar-card/new',
  'dollar-card/reveal',
])
const TOP_UP_SENT =
  /^dollar-card\/top-up\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/sent$/

type Context = { params: Promise<{ address: string; path: string[] }> }

async function target(context: Context, method: 'GET' | 'POST'): Promise<string | null> {
  const { address, path } = await context.params
  const joined = path.join('/')
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null
  const allowed =
    method === 'GET' ? GET_PATHS.has(joined) : POST_PATHS.has(joined) || TOP_UP_SENT.test(joined)
  return allowed ? `/v1/wallets/${address}/${joined}` : null
}

export async function GET(_request: Request, context: Context) {
  const path = await target(context, 'GET')
  if (!path) return Response.json({ error: 'Not found' }, { status: 404 })
  try {
    return Response.json(await kovaPublic(path), { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: Request, context: Context) {
  const path = await target(context, 'POST')
  if (!path) return Response.json({ error: 'Not found' }, { status: 404 })
  try {
    return Response.json(
      await kovaPublic(path, {
        method: 'POST',
        body: JSON.stringify(await request.json().catch(() => ({}))),
      }),
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    return failure(error)
  }
}
