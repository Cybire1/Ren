import { Suspense } from 'react'
import { SendSheet } from '@/components/wallet/send'

/** Send to someone already known (a person, or a Kova link): the same sheet, starting at the amount. */
export default async function SendToPage(props: { params: Promise<{ to: string }> }) {
  const { to } = await props.params
  return (
    <Suspense>
      <SendSheet to={to} />
    </Suspense>
  )
}
