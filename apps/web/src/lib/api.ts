import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from './session'

/**
 * Server-side Kova API client.
 *
 * Calls act as the signed-in shop, with the key from its sealed session; the browser never
 * sees a key. `kovaPublic` is for the calls that need none: opening a shop, and the
 * customer's view of a charge.
 */
const baseUrl = process.env.KOVA_API_URL ?? 'http://localhost:4000'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Kova's error code, e.g. not_found, and any details it gave. */
    readonly code?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
  }
}

/**
 * Everyone on this site reaches Kova from this server's one address, so Kova's per-address limits
 * would count them all as one. The server passes on who's asking, vouched for with a secret only
 * it and the API share (KOVA_PROXY_SECRET); without the secret the API ignores the claim.
 */
async function visitor(): Promise<Record<string, string>> {
  const secret = process.env.KOVA_PROXY_SECRET
  if (!secret) return {}
  try {
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim()
    return ip ? { 'x-kova-proxy-secret': secret, 'x-kova-client-ip': ip } : {}
  } catch {
    // Outside a request (a build, a script): nobody to vouch for.
    return {}
  }
}

async function call<T>(path: string, init: RequestInit, key?: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      'content-type': 'application/json',
      ...(await visitor()),
      ...init.headers,
    },
    cache: 'no-store',
  })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const error = body.error as { message?: string; code?: string; details?: Record<string, unknown> } | undefined
    throw new ApiError(error?.message ?? `Kova is unreachable (${response.status})`, response.status, error?.code, error?.details)
  }
  return body as T
}

/** As the signed-in shop. With no session (or a revoked key), pages go to sign in. */
export async function kova<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getSession()
  if (!session) redirect('/signin')
  try {
    return await call<T>(path, init, session.key)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/signin?expired=1')
    throw error
  }
}

/** For route handlers: same as `kova`, but reports a missing session instead of redirecting. */
export async function kovaForRoute<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getSession()
  if (!session) throw new ApiError('Signed out', 401)
  return call<T>(path, init, session.key)
}

/** The API's own URL for a path, for the few routes that pass a call straight through (the relay). */
export function kovaUrl(path: string): string {
  return `${baseUrl}${path}`
}

export function kovaPublic<T>(path: string, init: RequestInit = {}, key?: string): Promise<T> {
  return call<T>(path, init, key)
}

/** Route handler reply for a failed call, keeping 4xx statuses (401 lets the page sign out). */
export function failure(error: unknown) {
  const status = error instanceof ApiError ? (error.status >= 500 ? 502 : error.status) : 502
  return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status })
}

// --- Types --------------------------------------------------------------------------------

export interface Merchant {
  id: string
  name: string
  settlement_address: string
  /** The wallet the owner signs in with; null when the shop signs in with its secret key. */
  owner_address: string | null
  network: string
  country: string
  livemode: boolean
  explorer_url: string
  created_at: string
}

export interface Summary {
  merchant: { id: string; name: string; settlement_address: string; network: string; livemode: boolean }
  /** The zone "today" was counted in. */
  timezone: string
  today: { total: string; count: number }
  all_time: { total: string; count: number }
  open_intents: number
  last_paid_at: string | null
  /** Today, one entry per hour 0–23 of the shop's day. */
  hourly: { hour: number; total: string; count: number }[]
  daily: { date: string; total: string; count: number }[]
  /** Today's takings per terminal; `terminal: null` is everything else taken through the API. */
  by_terminal: { terminal: { id: string; name: string } | null; total: string; count: number }[]
  by_stall: { stall: { id: string; name: string; slug: string }; total: string; count: number }[]
}

export type IntentStatus = 'requires_payment' | 'processing' | 'paid' | 'held' | 'failed' | 'canceled' | 'expired'

export interface PaymentIntent {
  id: string
  amount: string
  currency: string
  status: IntentStatus
  pay_to: string
  memo: string
  reference: string | null
  expires_at: string
  created_at: string
  paid_at: string | null
  /** The terminal that took it, when a paired phone did. */
  terminal?: { id: string; name: string } | null
  /** What was bought, when it came from a stall or a till sale. */
  order?: Order | null
}

export interface PaymentDetail extends PaymentIntent {
  network: string
  token: string
  terminal: { id: string; name: string } | null
  payment: {
    id: string
    status: string
    tx_hash: string
    payer: string
    block_number: string | null
    confirmed_at: string | null
    explorer_url: string
  } | null
}

export interface IntentList {
  data: PaymentIntent[]
  has_more: boolean
  next_before: string | null
}

export interface Checkout {
  /** Which chain to pay on: "tempo" (through Kova's relay) or "monad" (a signed authorization). */
  chain?: 'tempo' | 'monad'
  id: string
  merchant_name: string
  amount: string
  /** Base units (6 decimals). */
  amount_base: string
  currency: string
  status: IntentStatus
  network: string
  chain_id: number
  token: string
  token_symbol: string | null
  /** What a wallet signs against: the token's EIP-712 name and version. */
  token_domain: { name: string; version: string } | null
  pay_to: string
  memo: string
  reference: string | null
  expires_at: string
  order: {
    lines: OrderLine[]
    customer_name: string | null
    note: string | null
    pay_for_me: boolean
    stall: { id: string; name: string; slug: string } | null
  } | null
}

export interface Terminal {
  id: string
  name: string
  status: string
  last_seen_at: string | null
  created_at: string
}

export interface TerminalPairing {
  code: string
  link: string
  merchant_name: string
  expires_at: string
}

export interface ApiKey {
  id: string
  name: string
  prefix: string
  last_used_at: string | null
  created_at: string
  current: boolean
}

export interface WebhookEndpoint {
  id: string
  url: string
  events: string[]
  status: string
  created_at: string
}

export interface KovaEvent {
  id: string
  type: string
  data: Record<string, unknown>
  created_at: string
  deliveries: { endpoint: string; status: string; attempts: number; response_status: number | null; last_error: string | null; delivered_at: string | null }[]
}

export interface CatalogItem {
  id: string
  name: string
  description: string | null
  price: string
  image_url: string | null
  image_id: string | null
  barcode: string | null
  sold_out: boolean
  created_at: string
}

export interface Stall {
  id: string
  slug: string
  name: string
  tagline: string | null
  open: boolean
  cover_url: string | null
  cover_image_id: string | null
  item_ids?: string[]
  created_at: string
}

export interface StallDetail extends Stall {
  items: CatalogItem[]
}

export interface PublicStall extends Stall {
  shop_name: string
  livemode: boolean
  items: Omit<CatalogItem, 'barcode' | 'image_id'>[]
}

export interface OrderLine {
  item_id: string
  name: string
  unit_price: string
  quantity: number
}

export interface Order {
  id: string
  source: 'stall' | 'till'
  payment_intent: string
  stall: { id: string; name: string; slug: string } | null
  lines: OrderLine[]
  customer_name: string | null
  note: string | null
  pay_for_me: boolean
  collected_at: string | null
  created_at: string
  amount?: string
  payment_status?: IntentStatus
  paid_at?: string | null
}

export interface MenuImport {
  currency: string
  items: { name: string; description: string | null; price: string; original: { amount: number; currency: string } }[]
}

export interface BarcodeLookup {
  code: string
  item: CatalogItem | null
  suggestion: { name: string; brand: string | null; image_url: string | null; source: string } | null
}

/** Upload image bytes as the signed-in shop (route handlers only). */
export async function kovaUpload(bytes: ArrayBuffer, contentType: string) {
  const session = await getSession()
  if (!session) throw new ApiError('Signed out', 401)
  const response = await fetch(`${baseUrl}/v1/images`, {
    method: 'POST',
    headers: { authorization: `Bearer ${session.key}`, 'content-type': contentType },
    body: bytes,
    cache: 'no-store',
  })
  const body = (await response.json().catch(() => ({}))) as { id?: string; url?: string; error?: { message?: string } }
  if (!response.ok) throw new ApiError(body.error?.message ?? `Upload failed (${response.status})`, response.status)
  return body as { id: string; url: string }
}
