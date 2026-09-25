'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Brand, Icon, type IconName } from '@/components/brand'
import { useWallet } from './provider'
import { Welcome } from './welcome'

/**
 * Kova on the web is one app: your wallet and your shop, the way the Kova app has Pay and the
 * Terminal. The top bar switches between them; the dock is the app's, with Pay in the middle.
 */
export function WalletShell({ children }: { children: React.ReactNode }) {
  const { status, shop } = useWallet()
  const path = usePathname()

  return (
    <div className="w-app">
      <header className="w-top">
        <Brand />
        <nav className="w-switch" aria-label="Wallet or shop">
          <Link href="/wallet" className="w-switch-on" aria-current="page">
            <Icon name="card" size={16} /> <span className="w-switch-label">Wallet</span>
          </Link>
          <Link href={shop ? '/dashboard' : '/wallet/shop'} title={shop?.name}>
            <Icon name="stall" size={16} />{' '}
            <span className="w-switch-label">{shop ? shop.name : 'Shop'}</span>
          </Link>
        </nav>
      </header>

      <main className="w-main">
        {status === 'loading' ? (
          <div className="w-loading" aria-busy="true" />
        ) : status === 'none' ? (
          <Welcome />
        ) : (
          children
        )}
      </main>

      {status === 'ready' ? <Dock path={path} shop={Boolean(shop)} /> : null}
    </div>
  )
}

const tabs: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: '/wallet', label: 'Home', icon: 'home', exact: true },
  { href: '/wallet/activity', label: 'Activity', icon: 'list' },
]
const tabsAfter: { href: string; label: string; icon: IconName }[] = [
  { href: '/wallet/shop', label: 'Shop', icon: 'stall' },
  { href: '/wallet/profile', label: 'Me', icon: 'user' },
]

function Dock({ path, shop }: { path: string; shop: boolean }) {
  const on = (href: string, exact?: boolean) => (exact ? path === href : path.startsWith(href))
  const tab = (t: { href: string; label: string; icon: IconName; exact?: boolean }) => {
    const href = t.href === '/wallet/shop' && shop ? '/dashboard' : t.href
    return (
      <Link
        key={t.label}
        href={href}
        className={`w-dock-tab${on(t.href, t.exact) ? ' w-dock-on' : ''}`}
        aria-current={on(t.href, t.exact) ? 'page' : undefined}
      >
        <Icon name={t.icon} size={22} />
        <span>{t.label}</span>
      </Link>
    )
  }
  return (
    <nav className="w-dock" aria-label="Wallet">
      {tabs.map(tab)}
      <Link
        href="/wallet/pay"
        className={`w-dock-pay${on('/wallet/pay') ? ' w-dock-on' : ''}`}
        aria-label="Pay. Scan a code or paste a link"
      >
        <Icon name="scan" size={22} />
        <span>Pay</span>
      </Link>
      {tabsAfter.map(tab)}
    </nav>
  )
}
