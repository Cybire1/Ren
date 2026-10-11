import type { Metadata } from 'next'
import { Notice } from '@/components/notice'
import { Storefront } from '@/components/storefront'
import { kovaPublic, type PublicStall } from '@/lib/api'

export const dynamic = 'force-dynamic'

async function load(slug: string) {
  try {
    return await kovaPublic<PublicStall>(`/v1/public/stalls/${encodeURIComponent(slug)}`)
  } catch {
    return null
  }
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const stall = await load((await props.params).slug)
  return stall
    ? { title: { absolute: `${stall.name} · order and pay with Ren` }, description: stall.tagline ?? `Order from ${stall.name} and pay in dollars with Ren.` }
    : { title: 'Stall' }
}

export default async function StallPage(props: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }) {
  const [{ slug }, { preview }] = await Promise.all([props.params, props.searchParams])
  const [stall, published] = await Promise.all([
    load(slug),
    kovaPublic<{ rates: Record<string, { per_usd: number }> }>('/v1/rates').catch(() => null),
  ])
  if (!stall)
    return (
      <Notice title="This stall isn’t here">
        <p>The link may be mistyped, or the stall has closed for good.</p>
      </Notice>
    )
  const rates = published ? Object.fromEntries(Object.entries(published.rates).map(([code, r]) => [code, r.per_usd])) : undefined
  return <Storefront stall={stall} preview={preview === '1'} rates={rates} />
}
