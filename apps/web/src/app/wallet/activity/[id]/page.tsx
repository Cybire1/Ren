import { Receipt } from '@/components/wallet/activity'

export default async function ReceiptPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  return <Receipt id={decodeURIComponent(id)} />
}
