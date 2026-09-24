import type { Metadata } from 'next'
import { CatalogueManager } from '@/components/catalogue-manager'
import { type CatalogItem, kova } from '@/lib/api'

export const metadata: Metadata = { title: 'Catalogue' }

export default async function CataloguePage() {
  const items = await kova<{ data: CatalogItem[] }>('/v1/catalog/items')
  return <CatalogueManager initial={items.data} />
}
