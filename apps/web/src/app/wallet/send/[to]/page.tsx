import { Suspense } from 'react'
import { SendFlow } from '@/components/wallet/send'

export default async function SendToPage(props: { params: Promise<{ to: string }> }) {
  const { to } = await props.params
  return (
    <Suspense>
      <SendFlow to={to} />
    </Suspense>
  )
}
