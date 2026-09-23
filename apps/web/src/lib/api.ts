/**
 * Server-side Kova API client.
 *
 * The API key lives here and never reaches the browser: pages and route handlers call this,
 * the browser calls them.
 */
const baseUrl = process.env.KOVA_API_URL ?? 'http://localhost:4000'
const apiKey = process.env.KOVA_API_KEY

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export async function kova<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiKey) throw new ApiError('KOVA_API_KEY is not set', 500)
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const error = body.error as { message?: string } | undefined
    throw new ApiError(error?.message ?? `Request failed (${response.status})`, response.status)
  }
  return body as T
}

export interface Summary {
  merchant: {
    id: string
    name: string
    settlement_address: string
    network: string
    livemode: boolean
  }
  today: { total: string; count: number }
  all_time: { total: string; count: number }
  open_intents: number
  last_paid_at: string | null
}

export interface PaymentIntent {
  id: string
  amount: string
  currency: string
  status: 'requires_payment' | 'processing' | 'paid' | 'held' | 'failed' | 'canceled' | 'expired'
  pay_to: string
  memo: string
  reference: string | null
  created_at: string
  paid_at: string | null
}

export interface IntentList {
  data: PaymentIntent[]
  has_more: boolean
  next_before: string | null
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
