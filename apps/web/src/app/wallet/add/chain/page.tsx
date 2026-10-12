import { redirect } from 'next/navigation'
import { FromChain } from '@/components/wallet/from-chain'
import { onTempo } from '@/lib/chain'

export default function FromChainPage() {
  // Deposits from other chains (Aurora Intents) land as AUSD on Monad: Tempo adds money its own way.
  if (onTempo) redirect('/wallet/add')
  return <FromChain />
}
