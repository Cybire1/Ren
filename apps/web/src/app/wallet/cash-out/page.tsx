import { redirect } from 'next/navigation'
import { CashOut } from '@/components/wallet/cash-out'
import { onTempo } from '@/lib/chain'

export default function CashOutPage() {
  // Cash out goes through Ramp, which pays out AUSD on Monad: nothing to show on Tempo yet.
  if (onTempo) redirect('/wallet/profile')
  return <CashOut />
}
