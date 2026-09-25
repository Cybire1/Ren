import type { Metadata } from 'next'
import { WalletProvider } from '@/components/wallet/provider'
import { WalletShell } from '@/components/wallet/shell'
import { kovaPublic, type Merchant } from '@/lib/api'
import { getSession } from '@/lib/session'
import type { LiveRates } from '@/lib/wallet/money'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Wallet' }

/** Kova Pay on the web: the wallet the Kova app holds, opened here with the same passkey. */
export default async function WalletLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  // The shared demo shop isn't anyone's own, so it doesn't appear as "your shop".
  const shop =
    session && !session.demo
      ? await kovaPublic<Merchant>('/v1/account', {}, session.key).catch(() => null)
      : null
  const rates = await kovaPublic<LiveRates>('/v1/rates').catch(() => null)
  return (
    <WalletProvider
      network={process.env.KOVA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'}
      shop={shop ? { name: shop.name } : null}
      initialRates={rates}
    >
      <WalletShell>{children}</WalletShell>
    </WalletProvider>
  )
}
