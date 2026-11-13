import { CashOut } from '@/components/wallet/cash-out'
import { CashOutWorld } from '@/components/wallet/cash-out-world'
import { onTempo } from '@/lib/chain'

/**
 * Cashing out. On Tempo it's one screen for every country: your saved accounts or a new one, with
 * Nigeria going to the naira cash-out (/wallet/cash-out/naira). On Monad, to a bank or card (Ramp).
 */
export default function CashOutPage() {
  return onTempo ? <CashOutWorld /> : <CashOut />
}
