import { PayCharge } from '@/components/wallet/pay'

export default async function PayChargePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  return <PayCharge id={id} />
}
