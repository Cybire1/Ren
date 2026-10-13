import { CashOut } from '@/components/wallet/cash-out'
import { NairaCashOut } from '@/components/wallet/naira'
import { onTempo } from '@/lib/chain'

/** Cashing out: on Tempo to naira in a Nigerian bank (Paystack); on Monad to a bank or card (Ramp). */
export default function CashOutPage() {
  return onTempo ? <NairaCashOut /> : <CashOut />
}
