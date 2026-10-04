import { schema } from '@kova/db'
import { formatAmount } from '@kova/monad'
import { encodeId } from '../ids.js'
import { imageUrl } from './images.js'

type Item = typeof schema.catalogItems.$inferSelect
type Stall = typeof schema.stalls.$inferSelect

export function serializeItem(item: Item, origin: string) {
  return {
    object: 'catalog_item',
    id: encodeId('catalogItem', item.id),
    name: item.name,
    description: item.description,
    price: formatAmount(item.price),
    image_url: imageUrl(origin, item.imageId),
    image_id: item.imageId ? encodeId('image', item.imageId) : null,
    barcode: item.barcode,
    sold_out: item.soldOut,
    created_at: item.createdAt.toISOString(),
  }
}

export function serializeStall(stall: Stall, origin: string, extra: { item_ids?: string[]; shop_name?: string } = {}) {
  return {
    object: 'stall',
    id: encodeId('stall', stall.id),
    slug: stall.slug,
    name: stall.name,
    tagline: stall.tagline,
    open: stall.open,
    cover_url: imageUrl(origin, stall.coverImageId),
    cover_image_id: stall.coverImageId ? encodeId('image', stall.coverImageId) : null,
    ...(extra.item_ids ? { item_ids: extra.item_ids } : {}),
    ...(extra.shop_name ? { shop_name: extra.shop_name } : {}),
    created_at: stall.createdAt.toISOString(),
  }
}

/** "Ada's Bakery" → "adas-bakery". */
export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      // NFKD splits "á" into "a" and an accent mark: drop the marks, so Tomás is tomas, not toma-s.
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'stall'
  )
}
