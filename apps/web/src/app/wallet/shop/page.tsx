import { Suspense } from 'react'
import { Shop } from '@/components/wallet/shop'

export default function ShopPage() {
  return (
    <Suspense>
      <Shop />
    </Suspense>
  )
}
