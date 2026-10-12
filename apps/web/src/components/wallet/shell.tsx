'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Art, Brand, Icon, type IconName, LogoMark, Wordmark } from '@/components/brand'
import { chainName } from '@/lib/chain'
import { formatUsd, toBase } from '@/lib/wallet/money'
import { useWallet } from './provider'
import { Avatar } from './ui'
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
      <DockBrand href="/wallet" />
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
      <DockFoot />
    </nav>
  )
}

/** On a desk, the sidebar ends with your shop's day and who you are. */
function DockFoot() {
  const { profile, shop, knownShop, network } = useWallet()
  if (!profile) return null
  const name = shop?.name ?? knownShop
  const today = shop?.today
  const line = shop
    ? today && today.count > 0
      ? `${formatUsd(toBase(today.total))} today`
      : 'No sales yet today'
    : name
      ? 'Your passkey signs you in'
      : 'Take payments into this wallet'
  return (
    <div className="w-dock-foot">
      <Link
        href={shop ? '/dashboard' : name ? '/wallet/shop?go=signin' : '/wallet/shop?go=open'}
        className="w-dock-shop"
      >
        <Art name="badge-shop" size={38} />
        <span>
          <strong>{name ?? 'Open a shop'}</strong>
          <small>{line}</small>
        </span>
        <Icon name="chevron" size={16} />
      </Link>
      <Link href="/wallet/profile" className="w-dock-me">
        <Avatar name={profile.name} id={profile.address} size={34} />
        <span>
          <strong>{profile.name ? profile.name.split(' ')[0] : 'You'}</strong>
          <small>
            {chainName} {network === 'testnet' ? 'testnet' : ''}
          </small>
        </span>
      </Link>
    </div>
  )
}

/** On a desk the dock stands up as a sidebar, and carries the brand at its head. */
export function DockBrand({ href }: { href: string }) {
  return (
    <Link href={href} className="w-dock-brand" aria-label="Ren home">
      <LogoMark size={34} stem="#fff" />
      <Wordmark height={20} ink="#fff" coin="var(--coral)" />
    </Link>
  )
}
