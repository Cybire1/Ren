'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ApiError, type ApiKey, type BarcodeLookup, type CatalogItem, kova, kovaPublic, type Merchant, type Stall, type WebhookEndpoint } from '@/lib/api'
import { endSession, getSession, startSession } from '@/lib/session'

/** What a form shows after it runs: an error to fix, or a secret to copy once. */
export interface FormState {
  error?: string
  ok?: boolean
  secret?: string
  name?: string
}

const message = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong. Try again.')

// --- Signing in -------------------------------------------------------------------------

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const key = String(form.get('key') ?? '').trim()
  if (!/^kova_(test|live)_sk_/.test(key)) return { error: 'That isn’t a Kova secret key. It starts with kova_test_sk_ or kova_live_sk_.' }
  try {
    await kovaPublic<Merchant>('/v1/account', {}, key)
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403))
      return { error: error.status === 403 ? 'That’s a terminal’s key. Sign in with your shop’s secret key.' : 'Kova doesn’t recognise that key, or it was revoked.' }
    return { error: message(error) }
  }
  await startSession({ key, demo: false })
  redirect('/dashboard')
}

/**
 * This site as a wallet sees it. A sign-in message names it, and Kova only accepts messages that
 * name one of its own sites, so a signature collected anywhere else is useless here. The Host
 * header, because the host only routes Kova's own domains here; a forwarded header is only a claim.
 */
async function thisSite() {
  const h = await headers()
  const host = (h.get('host') ?? h.get('x-forwarded-host') ?? 'localhost:3000').split(',')[0]?.trim() || 'localhost:3000'
  const proto = (h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')).split(',')[0]?.trim()
  return { domain: host, uri: `${proto}://${host}` }
}

/** The message a wallet signs to sign in to its shop, or to open one. Good once, for ten minutes. */
export async function walletChallenge(address: string, purpose: 'sign_in' | 'open_shop'): Promise<{ message?: string; error?: string }> {
  try {
    const challenge = await kovaPublic<{ message: string }>('/v1/sign_in/challenge', { method: 'POST', body: JSON.stringify({ address, purpose, ...(await thisSite()) }) })
    return { message: challenge.message }
  } catch (error) {
    return { error: message(error) }
  }
}

export interface ShopChoice {
  id: string
  name: string
  created_at: string
}

export interface WalletSignIn {
  ok?: boolean
  error?: string
  /** No shop signs in with this wallet yet. */
  noShop?: boolean
  /** The wallet signs in to several shops, and should pick one. */
  shops?: ShopChoice[]
}

/** Signs in with a signed challenge: the shop's owner, the way they opened it, with email or Google. */
export async function signInWithWallet(proof: { message: string; signature: string; merchant?: string }): Promise<WalletSignIn> {
  try {
    const session = await kovaPublic<{ key: string }>('/v1/sign_in', { method: 'POST', body: JSON.stringify(proof) })
    await startSession({ key: session.key, demo: false })
    return { ok: true }
  } catch (error) {
    if (error instanceof ApiError && error.details?.reason === 'no_shop') return { noShop: true }
    if (error instanceof ApiError && error.details?.reason === 'choose_shop') return { shops: error.details.shops as ShopChoice[] }
    return { error: message(error) }
  }
}

/**
 * Opens a shop owned by a wallet that signed Kova's "open a shop" message: the Kova wallet on the
 * web, with its passkey. Payments land in that wallet, and it signs in to the shop from then on.
 */
export async function openShopWithWallet(input: { name: string; address: string; message: string; signature: string }): Promise<{ ok?: boolean; error?: string }> {
  const name = input.name.trim()
  if (name.length < 2) return { error: 'Give your shop a name.' }
  try {
    const shop = await kovaPublic<Merchant & { key: string }>('/v1/merchants', {
      method: 'POST',
      body: JSON.stringify({ name, settlement_address: input.address, owner: { message: input.message, signature: input.signature } }),
    })
    await startSession({ key: shop.key, demo: false })
    return { ok: true }
  } catch (error) {
    return { error: message(error) }
  }
}

export async function signInDemo() {
  const key = process.env.DEMO_API_KEY
  if (!key) redirect('/signin?demo=off')
  await startSession({ key, demo: true })
  redirect('/dashboard')
}

export async function signOut() {
  const session = await getSession()
  // This browser's key stops working. The shared demo key and a shop's secret keys carry on.
  if (session && !session.demo) await kovaPublic('/v1/sign_out', { method: 'POST' }, session.key).catch(() => {})
  await endSession()
  redirect('/')
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get('name') ?? '').trim()
  const address = String(form.get('address') ?? '').trim()
  if (name.length < 2) return { error: 'Give your shop a name.' }
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return { error: 'That isn’t a Monad address. It starts with 0x and has 40 more characters.' }
  // A shop whose wallet was made with email or Google proves it with a signature, and its owner
  // signs in with that wallet from then on.
  // A form sends line breaks as \r\n, and the wallet signed the message with \n, as EIP-4361 writes it.
  const ownerMessage = String(form.get('owner_message') ?? '').replace(/\r\n/g, '\n')
  const ownerSignature = String(form.get('owner_signature') ?? '')
  const owner = ownerMessage && ownerSignature ? { message: ownerMessage, signature: ownerSignature } : undefined
  try {
    const shop = await kovaPublic<Merchant & { key: string }>('/v1/merchants', {
      method: 'POST',
      body: JSON.stringify({ name, settlement_address: address, country: String(form.get('country') ?? '') || undefined, owner }),
    })
    await startSession({ key: shop.key, demo: false })
    // Only a shop without an owner's wallet has a secret key to keep: it's how that shop signs in.
    return shop.owner_address ? { ok: true, name: shop.name } : { ok: true, secret: shop.key, name: shop.name }
  } catch (error) {
    return { error: message(error) }
  }
}

// --- Settings ---------------------------------------------------------------------------

export async function updateAccount(_: FormState, form: FormData): Promise<FormState> {
  const patch: Record<string, string> = {}
  const name = form.get('name')
  const address = form.get('address')
  if (typeof name === 'string') patch.name = name.trim()
  if (typeof address === 'string') patch.settlement_address = address.trim()
  try {
    await kova<Merchant>('/v1/account', { method: 'PATCH', body: JSON.stringify(patch) })
  } catch (error) {
    return { error: message(error) }
  }
  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}

// --- Keys -------------------------------------------------------------------------------

export async function createKey(_: FormState, form: FormData): Promise<FormState> {
  try {
    const key = await kova<ApiKey & { secret: string }>('/v1/api_keys', {
      method: 'POST',
      body: JSON.stringify({ name: String(form.get('name') ?? '').trim() || 'Secret key' }),
    })
    revalidatePath('/dashboard/developers')
    return { ok: true, secret: key.secret, name: key.name }
  } catch (error) {
    return { error: message(error) }
  }
}

export async function revokeKey(id: string): Promise<FormState> {
  try {
    await kova(`/v1/api_keys/${encodeURIComponent(id)}`, { method: 'DELETE' })
    revalidatePath('/dashboard/developers')
    return { ok: true }
  } catch (error) {
    return { error: message(error) }
  }
}

// --- Webhooks ---------------------------------------------------------------------------

export async function createWebhook(_: FormState, form: FormData): Promise<FormState> {
  const url = String(form.get('url') ?? '').trim()
  const events = form.getAll('events').map(String)
  try {
    const endpoint = await kova<WebhookEndpoint & { secret: string }>('/v1/webhook_endpoints', {
      method: 'POST',
      body: JSON.stringify({ url, events: events.length ? events : ['*'] }),
    })
    revalidatePath('/dashboard/developers')
    return { ok: true, secret: endpoint.secret, name: endpoint.url }
  } catch (error) {
    return { error: message(error) }
  }
}

export async function deleteWebhook(id: string): Promise<FormState> {
  try {
    await kova(`/v1/webhook_endpoints/${encodeURIComponent(id)}`, { method: 'DELETE' })
    revalidatePath('/dashboard/developers')
    return { ok: true }
  } catch (error) {
    return { error: message(error) }
  }
}

export async function testWebhook(id: string): Promise<FormState> {
  try {
    await kova(`/v1/webhook_endpoints/${encodeURIComponent(id)}/test`, { method: 'POST' })
    return { ok: true }
  } catch (error) {
    return { error: message(error) }
  }
}

// --- Charges ----------------------------------------------------------------------------

export async function cancelCharge(id: string): Promise<FormState> {
  try {
    await kova(`/v1/payment_intents/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
    revalidatePath(`/dashboard/payments/${id}`)
    return { ok: true }
  } catch (error) {
    return { error: message(error) }
  }
}

// --- Stalls, catalogue, orders ----------------------------------------------------------

export async function createStall(_: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get('name') ?? '').trim()
  const tagline = String(form.get('tagline') ?? '').trim()
  if (name.length < 2) return { error: 'Give your stall a name.' }
  let id: string
  try {
    const stall = await kova<Stall>('/v1/stalls', { method: 'POST', body: JSON.stringify({ name, tagline: tagline || undefined }) })
    id = stall.id
  } catch (error) {
    return { error: message(error) }
  }
  revalidatePath('/dashboard/stalls')
  redirect(`/dashboard/stalls/${id}`)
}

export async function updateStall(id: string, patch: { name?: string; tagline?: string | null; open?: boolean; cover_image_id?: string | null; item_ids?: string[] }): Promise<FormState & { stall?: Stall }> {
  try {
    const stall = await kova<Stall>(`/v1/stalls/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
    revalidatePath('/dashboard/stalls')
    return { ok: true, stall }
  } catch (error) {
    return { error: message(error) }
  }
}

export async function closeStallForGood(id: string) {
  await kova(`/v1/stalls/${encodeURIComponent(id)}`, { method: 'DELETE' })
  revalidatePath('/dashboard/stalls')
  redirect('/dashboard/stalls')
}

export async function saveItem(
  id: string | null,
  input: { name?: string; price?: string; description?: string | null; barcode?: string | null; image_id?: string | null; sold_out?: boolean; stall_ids?: string[] },
): Promise<FormState & { item?: CatalogItem }> {
  try {
    const item = id
      ? await kova<CatalogItem>(`/v1/catalog/items/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ ...input, stall_ids: undefined }) })
      : await kova<CatalogItem>('/v1/catalog/items', { method: 'POST', body: JSON.stringify(input) })
    revalidatePath('/dashboard/catalogue')
    revalidatePath('/dashboard/stalls')
    return { ok: true, item }
  } catch (error) {
    return { error: message(error) }
  }
}

export async function removeItem(id: string): Promise<FormState> {
  try {
    await kova(`/v1/catalog/items/${encodeURIComponent(id)}`, { method: 'DELETE' })
    revalidatePath('/dashboard/catalogue')
    return { ok: true }
  } catch (error) {
    return { error: message(error) }
  }
}

export async function lookupBarcode(code: string): Promise<FormState & { lookup?: BarcodeLookup }> {
  try {
    return { ok: true, lookup: await kova<BarcodeLookup>(`/v1/catalog/barcodes/${encodeURIComponent(code)}`) }
  } catch (error) {
    return { error: message(error) }
  }
}

export async function markCollected(id: string, collected: boolean): Promise<FormState> {
  try {
    await kova(`/v1/orders/${encodeURIComponent(id)}/collect`, { method: 'POST', body: JSON.stringify({ collected }) })
    return { ok: true }
  } catch (error) {
    return { error: message(error) }
  }
}
