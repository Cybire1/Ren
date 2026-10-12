import { Suspense } from 'react'
import { SendSheet } from '@/components/wallet/send'

/** Send, as a sheet over Home. */
export default function SendPage() {
  return (
    <Suspense>
      <SendSheet />
    </Suspense>
  )
}
