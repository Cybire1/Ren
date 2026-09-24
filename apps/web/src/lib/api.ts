import 'server-only'
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
  ) {
    super(message)
  }
}

async function call<T>(path: string, init: RequestInit, key?: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      'content-type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const error = body.error as { message?: string } | undefined
    throw new ApiError(error?.message ?? `Kova is unreachable (${response.status})`, response.status)
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
  /** Today's takings per terminal; `terminal: null` is everything taken through the API. */
  by_terminal: { terminal: { id: string; name: string } | null; total: string; count: number }[]
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
  id: string
  merchant_name: string
  amount: string
  currency: string
  status: IntentStatus
  pay_to: string
  memo: string
  reference: string | null
  expires_at: string
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
