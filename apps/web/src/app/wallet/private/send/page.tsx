import { Suspense } from 'react'
import { SendSheet } from '@/components/wallet/send'

/** Send privately: the send sheet, into their private balance. */
export default function SendPrivatelyPage() {
  return (
    <Suspense>
      <SendSheet privately />
    </Suspense>
  )
}
