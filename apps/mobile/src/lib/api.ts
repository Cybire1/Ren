/**
 * Talks to the Kova API.
 *
 * The API key here is a development shortcut: a shipped terminal will register once and hold
 * a device token instead, so a merchant key never lives on a device.
 */
const baseUrl = process.env.EXPO_PUBLIC_KOVA_API_URL ?? 'http://localhost:4000'
const apiKey = process.env.EXPO_PUBLIC_KOVA_API_KEY

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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      ...init.headers,
    },
  })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { message?: string }
  }
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`)
  return body as T
}

export function createCharge(amount: string, reference?: string) {
  return request<PaymentIntent>('/v1/payment_intents', {
    method: 'POST',
    body: JSON.stringify({ amount, ...(reference ? { reference } : {}) }),
  })
}

export function getIntent(id: string) {
  return request<PaymentIntent>(`/v1/payment_intents/${id}`)
}

export const payLinkFor = (intent: PaymentIntent) =>
  `${process.env.EXPO_PUBLIC_KOVA_WEB_URL ?? 'http://localhost:3000'}/pay/${intent.id}`
