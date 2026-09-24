'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError, type ApiKey, type BarcodeLookup, type CatalogItem, kova, kovaPublic, type Merchant, type Stall, type WebhookEndpoint } from '@/lib/api'
import { endSession, startSession } from '@/lib/session'

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

export async function signInDemo() {
  const key = process.env.DEMO_API_KEY
  if (!key) redirect('/signin?demo=off')
  await startSession({ key, demo: true })
  redirect('/dashboard')
}

export async function signOut() {
  await endSession()
  redirect('/')
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get('name') ?? '').trim()
  const address = String(form.get('address') ?? '').trim()
  if (name.length < 2) return { error: 'Give your shop a name.' }
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return { error: 'That isn’t a Monad address. It starts with 0x and has 40 more characters.' }
  try {
    const shop = await kovaPublic<Merchant & { key: string }>('/v1/merchants', {
      method: 'POST',
      body: JSON.stringify({ name, settlement_address: address, country: String(form.get('country') ?? '') || undefined }),
    })
    await startSession({ key: shop.key, demo: false })
    return { ok: true, secret: shop.key, name: shop.name }
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
