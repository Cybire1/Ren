import { Suspense } from 'react'
import { SendSheet } from '@/components/wallet/send'

/** Send privately to someone already known: the same sheet, starting at the amount. */
export default async function SendPrivatelyToPage(props: { params: Promise<{ to: string }> }) {
  const { to } = await props.params
  return (
    <Suspense>
      <SendSheet to={to} privately />
    </Suspense>
  )
}
