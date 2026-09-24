import { apiUrl, webUrl } from './config'

/**
 * The Kova API, from both sides of a payment.
 *
 * The payer side (checkout, a stall's page) needs no key: holding a charge's id or a stall's
 * link is enough to see what to pay.
 *
 * The shop side uses one of two keys. Every terminal, this phone included, takes payments with
 * the device key it received when it was paired. Only a shop opened on this phone also keeps
 * its owner key here, in the Keychain, to edit what the shop sells. A phone paired to someone
 * else's shop never holds more than its device key.
 */

type Auth = 'device' | 'owner'

const keys: Record<Auth, string | null> = { device: null, owner: null }

/** The paired terminal's device key, set once pairing is loaded. */
export function setDeviceKey(key: string | null) {
  keys.device = key
}

/** The shop owner's key, set when this phone opened the shop. */
export function setOwnerKey(key: string | null) {
  keys.owner = key
}

/** Called when a key is refused from then on: the shop removed this terminal, or revoked the owner key. */
const revoked: Record<Auth, (() => void) | null> = { device: null, owner: null }
export function onDeviceKeyRevoked(handler: (() => void) | null) {
  revoked.device = handler
}
export function onOwnerKeyRevoked(handler: (() => void) | null) {
  revoked.owner = handler
}

async function request<T>(path: string, init: RequestInit & { auth?: Auth } = {}): Promise<T> {
  const { auth, ...rest } = init
  const key = auth ? keys[auth] : null
  const response = await fetch(`${apiUrl}${path}`, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...rest.headers,
    },
  })
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
  if (auth && key && response.status === 401) revoked[auth]?.()
  if (!response.ok) throw new Error(body.error?.message ?? `Kova is unreachable (${response.status})`)
  return body as T
}

// --- payer ---------------------------------------------------------------------------------

export interface OrderLine {
  item_id: string
  name: string
  unit_price: string
  quantity: number
}

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
  /** What was ordered, when this charge came from a stall or a till sale. */
  order?: {
    lines: OrderLine[]
    customer_name: string | null
    note: string | null
    pay_for_me: boolean
    stall: { id: string; name: string; slug: string } | null
  } | null
}

export const getCheckout = (id: string) => request<Checkout>(`/v1/checkout/${id}`)

export const confirmCheckout = (id: string, txHash: string) =>
  request<Checkout>(`/v1/checkout/${id}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ tx_hash: txHash }),
  })

// --- stalls, as a buyer sees them ----------------------------------------------------------

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

export interface PlacedOrder {
  id: string
  checkout: { id: string; amount: string; status: Checkout['status']; expires_at: string; link: string }
}

export const getPublicStall = (slug: string) => request<PublicStall>(`/v1/public/stalls/${encodeURIComponent(slug)}`)

/** Order from a stall. The server prices every line; the result is a charge to pay, or to send on. */
export const orderFromStall = (
  slug: string,
  order: { items: { id: string; quantity: number }[]; customer_name?: string; note?: string; pay_for_me?: boolean },
) => request<PlacedOrder>(`/v1/public/stalls/${encodeURIComponent(slug)}/orders`, { method: 'POST', body: JSON.stringify(order) })

// --- shop: taking payments (device key) ----------------------------------------------------

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
  terminal?: { id: string; name: string } | null
  order?: Order | null
}

export interface Summary {
  merchant: { id: string; name: string; livemode: boolean }
  today?: { total: string; count: number }
  [key: string]: unknown
}

export const createCharge = (amount: string, options: { reference?: string; metadata?: Record<string, unknown> } = {}) =>
  request<PaymentIntent>('/v1/payment_intents', {
    method: 'POST',
    auth: 'device',
    body: JSON.stringify({ amount, ...options }),
  })

export const getCharge = (id: string) => request<PaymentIntent>(`/v1/payment_intents/${id}`, { auth: 'device' })

export const cancelCharge = (id: string) =>
  request<PaymentIntent>(`/v1/payment_intents/${id}/cancel`, { method: 'POST', auth: 'device' })

export const getSummary = () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return request<Summary>(`/v1/summary${tz ? `?tz=${encodeURIComponent(tz)}` : ''}`, { auth: 'device' })
}

export const listCharges = (limit = 25) =>
  request<{ data: PaymentIntent[] }>(`/v1/payment_intents?limit=${limit}`, { auth: 'device' }).then((r) => r.data)

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
  payment_status?: Checkout['status']
  paid_at?: string | null
}

/** Stall orders, newest first. open: paid and not handed over yet; unpaid: still waiting for payment. */
export const listOrders = (status: 'all' | 'open' | 'collected' | 'unpaid' = 'all', limit = 50) =>
  request<{ data: Order[] }>(`/v1/orders?status=${status}&source=stall&limit=${limit}`, { auth: 'device' }).then((r) => r.data)

/** Handed over, or back to waiting to undo a mistap. */
export const collectOrder = (id: string, collected = true) =>
  request<Order>(`/v1/orders/${id}/collect`, { method: 'POST', auth: 'device', body: JSON.stringify({ collected }) })

/** A till sale: what was scanned or picked at the counter, priced by Kova from the catalogue. */
export const ringUp = (items: { id: string; quantity: number }[], note?: string) =>
  request<Order & { payment_intent: PaymentIntent }>('/v1/orders', {
    method: 'POST',
    auth: 'device',
    body: JSON.stringify({ items, note }),
  })

export const getCatalog = () => request<{ data: CatalogItem[] }>('/v1/catalog/items', { auth: 'device' }).then((r) => r.data)

export interface BarcodeLookup {
  code: string
  /** This shop's item with that barcode. */
  item: CatalogItem | null
  /** Otherwise, what open product databases know about it. */
  suggestion: { name: string; brand: string | null; image_url: string | null; source: string } | null
}

export const lookupBarcode = (code: string, auth: Auth = 'device') =>
  request<BarcodeLookup>(`/v1/catalog/barcodes/${encodeURIComponent(code)}`, { auth })

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
export const unpairTerminal = () => request<{ status: string }>('/v1/terminals/self/unpair', { method: 'POST', auth: 'device' })

// --- shop: running it (owner key) ----------------------------------------------------------

export interface OpenedShop {
  id: string
  name: string
  livemode: boolean
  /** The owner key. Shown once; it goes straight into the Keychain. */
  key: string
}

/** Opens a shop whose payments settle in `settlementAddress`: this phone's own wallet. */
export const openShop = (name: string, settlementAddress: string) =>
  request<OpenedShop>('/v1/merchants', { method: 'POST', body: JSON.stringify({ name, settlement_address: settlementAddress }) })

/** A one-time code to pair a terminal; the phone that opened the shop pairs itself with one. */
export const createPairing = () => request<{ code: string; link: string }>('/v1/terminals/pairings', { method: 'POST', auth: 'owner' })

export const listStalls = () => request<{ data: Stall[] }>('/v1/stalls', { auth: 'owner' }).then((r) => r.data)

export const getStall = (id: string) => request<StallDetail>(`/v1/stalls/${id}`, { auth: 'owner' })

export const createStall = (stall: { name: string; tagline?: string | null }) =>
  request<Stall>('/v1/stalls', { method: 'POST', auth: 'owner', body: JSON.stringify(stall) })

export const updateStall = (id: string, patch: Partial<{ name: string; tagline: string | null; open: boolean; item_ids: string[] }>) =>
  request<Stall>(`/v1/stalls/${id}`, { method: 'PATCH', auth: 'owner', body: JSON.stringify(patch) })

export interface ItemInput {
  name: string
  price: string
  description?: string | null
  barcode?: string | null
  image_id?: string | null
  sold_out?: boolean
}

export const createItem = (item: ItemInput & { stall_ids?: string[] }) =>
  request<CatalogItem>('/v1/catalog/items', { method: 'POST', auth: 'owner', body: JSON.stringify(item) })

export const updateItem = (id: string, patch: Partial<ItemInput>) =>
  request<CatalogItem>(`/v1/catalog/items/${id}`, { method: 'PATCH', auth: 'owner', body: JSON.stringify(patch) })

export const removeItem = (id: string) => request<{ deleted: boolean }>(`/v1/catalog/items/${id}`, { method: 'DELETE', auth: 'owner' })

/** Uploads a photo already on the phone (a file URI). Returns its id for an item. */
export async function uploadImage(uri: string, contentType = 'image/jpeg') {
  const bytes = await (await fetch(uri)).blob()
  const response = await fetch(`${apiUrl}/v1/images`, {
    method: 'POST',
    headers: { 'content-type': contentType, ...(keys.owner ? { authorization: `Bearer ${keys.owner}` } : {}) },
    body: bytes,
  })
  const body = (await response.json().catch(() => ({}))) as { id?: string; url?: string; error?: { message?: string } }
  if (!response.ok || !body.id) throw new Error(body.error?.message ?? `The photo didn’t upload (${response.status})`)
  return { id: body.id, url: body.url ?? null }
}

export interface MenuImport {
  currency: string
  items: { name: string; description: string | null; price: string; original: { amount: number; currency: string } }[]
}

/** Snap your menu: a photo of a menu board or price list in, suggested items out. Nothing is saved. */
export const readMenuPhoto = (base64: string, mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg') =>
  request<MenuImport>('/v1/catalog/import', { method: 'POST', auth: 'owner', body: JSON.stringify({ image: base64, media_type: mediaType }) })

// --- links ---------------------------------------------------------------------------------

/** What the terminal's QR encodes: the public pay page, which Kova Pay also opens directly. */
export const payLinkFor = (id: string) => `${webUrl}/pay/${id}`

/** A stall's own page. Its QR on a table or a poster opens the stall in Kova Pay or any browser. */
export const stallLinkFor = (slug: string) => `${webUrl}/s/${slug}`

/** The printable table poster, on the web. */
export const posterLinkFor = (slug: string) => `${webUrl}/s/${slug}/poster`
