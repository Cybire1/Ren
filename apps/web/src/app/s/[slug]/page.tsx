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
    ? { title: { absolute: `${stall.name} · order and pay with Kova` }, description: stall.tagline ?? `Order from ${stall.name} and pay in dollars with Kova.` }
    : { title: 'Stall' }
}

export default async function StallPage(props: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }) {
  const [{ slug }, { preview }] = await Promise.all([props.params, props.searchParams])
  const stall = await load(slug)
  if (!stall)
    return (
      <Notice title="This stall isn’t here">
        <p>The link may be mistyped, or the stall has closed for good.</p>
      </Notice>
    )
  return <Storefront stall={stall} preview={preview === '1'} />
}
