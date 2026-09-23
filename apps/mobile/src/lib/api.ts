import { apiUrl, webUrl } from './config'

/**
 * The Kova API, from both sides of a payment.
 *
 * The payer side (checkout) needs no key: holding a charge's id is enough to see what to pay.
 * The merchant side (terminal) uses the device key this phone received when it was paired.
 * A merchant's master key never lives on a phone.
 */

/** The paired terminal's device key, set once pairing is loaded. */
let deviceKey: string | null = null
export function setDeviceKey(key: string | null) {
  deviceKey = key
}

/** Called when the shop removes this terminal: its key is refused from then on. */
let onRevoked: (() => void) | null = null
export function onDeviceKeyRevoked(handler: (() => void) | null) {
  onRevoked = handler
}

async function request<T>(path: string, init: RequestInit & { merchant?: boolean } = {}): Promise<T> {
  const key = deviceKey
  const { merchant, ...rest } = init
  const response = await fetch(`${apiUrl}${path}`, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      ...(merchant && key ? { authorization: `Bearer ${key}` } : {}),
      ...rest.headers,
    },
  })
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
  if (merchant && deviceKey && response.status === 401) onRevoked?.()
  if (!response.ok) throw new Error(body.error?.message ?? `Kova is unreachable (${response.status})`)
  return body as T
}

// --- payer ---------------------------------------------------------------------------------

export interface Checkout {
  id: string
  merchant_name: string
  amount: string
  amount_base: string
  currency: string
  status: 'requires_payment' | 'processing' | 'paid' | 'held' | 'failed' | 'canceled' | 'expired'
  token: `0x${string}`
  pay_to: `0x${string}`
  memo: `0x${string}`
  reference: string | null
  expires_at: string
}

export const getCheckout = (id: string) => request<Checkout>(`/v1/checkout/${id}`)

export const confirmCheckout = (id: string, txHash: string) =>
  request<Checkout>(`/v1/checkout/${id}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ tx_hash: txHash }),
  })

// --- merchant ------------------------------------------------------------------------------

export interface PaymentIntent {
  id: string
  amount: string
  currency: string
  status: Checkout['status']
  pay_to: string
  memo: string
  reference: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
  expires_at?: string
  paid_at: string | null
  payer?: string | null
}

export interface Summary {
  merchant: { id: string; name: string; livemode: boolean }
  today?: { total: string; count: number }
  [key: string]: unknown
}


export const createCharge = (amount: string, options: { reference?: string; metadata?: Record<string, unknown> } = {}) =>
  request<PaymentIntent>('/v1/payment_intents', {
    method: 'POST',
    merchant: true,
    body: JSON.stringify({ amount, ...options }),
  })

export const getCharge = (id: string) => request<PaymentIntent>(`/v1/payment_intents/${id}`, { merchant: true })

export const cancelCharge = (id: string) =>
  request<PaymentIntent>(`/v1/payment_intents/${id}/cancel`, { method: 'POST', merchant: true })

export const getSummary = () => request<Summary>('/v1/summary', { merchant: true })

export const listCharges = (limit = 25) =>
  request<{ data: PaymentIntent[] }>(`/v1/payment_intents?limit=${limit}`, { merchant: true }).then((r) => r.data)

export interface PairedTerminal {
  id: string
  name: string
  merchant: { id: string; name: string }
  key: string
}

/** Redeems a pairing code from the dashboard for this phone's own terminal key. */
export const pairTerminal = (code: string, name: string, device: Record<string, unknown>) =>
  request<PairedTerminal>('/v1/terminals/pair', { method: 'POST', body: JSON.stringify({ code, name, device }) })

/** Tells Kova this phone is no longer a terminal, so its key stops working everywhere. */
export const unpairTerminal = () => request<{ status: string }>('/v1/terminals/self/unpair', { method: 'POST', merchant: true })

/** What the terminal's QR encodes: the public pay page, which Kova Pay also opens directly. */
export const payLinkFor = (id: string) => `${webUrl}/pay/${id}`
