'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Brand, Icon, type IconName } from '@/components/brand'
import { useWallet } from './provider'
import { Welcome } from './welcome'

/**
 * The Kova app on the web: your wallet, with your shop as one of its features. The Shop card on
 * Home opens shop mode, and shop mode's "Wallet" brings you back. The dock is the app's, Pay in
 * the middle.
 */
export function WalletShell({ children }: { children: React.ReactNode }) {
  const { status } = useWallet()
  const path = usePathname()

  return (
    <div className="w-app">
      <header className="w-top">
        <Brand href="/wallet" />
      </header>

      <main className="w-main">
        {status === 'loading' ? (
          <div className="w-loading" aria-busy="true" />
        ) : status === 'none' ? (
          <Welcome forShop={path.startsWith('/wallet/shop')} />
        ) : (
          children
        )}
      </main>

      {status === 'ready' ? <Dock path={path} /> : null}
    </div>
  )
}

type Tab = { href: string; label: string; icon: IconName; exact?: boolean }

const before: Tab[] = [
  { href: '/wallet', label: 'Home', icon: 'home', exact: true },
  { href: '/wallet/activity', label: 'Activity', icon: 'list' },
]
const after: Tab[] = [
  { href: '/wallet/send', label: 'People', icon: 'user' },
  { href: '/wallet/profile', label: 'Me', icon: 'face' },
]

function Dock({ path }: { path: string }) {
  const on = (t: Tab) => (t.exact ? path === t.href : path.startsWith(t.href))
  const tab = (t: Tab) => (
    <Link
      key={t.href}
      href={t.href}
      className={`w-dock-tab${on(t) ? ' w-dock-on' : ''}`}
      aria-current={on(t) ? 'page' : undefined}
    >
      <Icon name={t.icon} size={22} />
      <span>{t.label}</span>
    </Link>
  )
  return (
    <nav className="w-dock" aria-label="Ren">
      {before.map(tab)}
      <Link
        href="/wallet/pay"
        className={`w-dock-pay${path.startsWith('/wallet/pay') ? ' w-dock-on' : ''}`}
        aria-label="Pay. Scan a code or paste a link"
      >
        <Icon name="scan" size={22} />
        <span>Pay</span>
      </Link>
      {after.map(tab)}
    </nav>
  )
}
