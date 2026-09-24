import type { Metadata } from 'next'
import Link from 'next/link'
import { Art } from '@/components/brand'
import { StallEditor } from '@/components/stall-editor'
import { ApiError, type CatalogItem, kova, type StallDetail } from '@/lib/api'

export const metadata: Metadata = { title: 'Stall' }

export default async function StallPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  try {
    const [stall, catalogue] = await Promise.all([
      kova<StallDetail>(`/v1/stalls/${encodeURIComponent(id)}`),
      kova<{ data: CatalogItem[] }>('/v1/catalog/items'),
    ])
    return <StallEditor stall={stall} catalogue={catalogue.data} />
  } catch (error) {
    if (error instanceof ApiError && error.status === 404)
      return (
        <section className="card empty big-empty">
          <Art name="kovi-oops" size={140} />
          <h3>No such stall</h3>
          <p>It may have been closed for good.</p>
          <Link className="textlink" href="/dashboard/stalls">
            Back to stalls
          </Link>
        </section>
      )
    throw error
  }
}
