import type { Metadata } from 'next'
import { SignUpForm } from '@/components/auth-forms'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Open a shop' }

export default function SignUpPage() {
  // Read at request time, so the Privy app can be set on the server without rebuilding the site.
  return <SignUpForm privyAppId={process.env.PRIVY_APP_ID ?? null} chainId={process.env.KOVA_NETWORK === 'mainnet' ? 143 : 10143} />
}
