'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/actions'
import { Art, Icon, type IconName, LogoMark, Wordmark } from './brand'

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/dashboard', label: 'Overview', icon: 'home' },
  { href: '/dashboard/payments', label: 'Payments', icon: 'list' },
  { href: '/dashboard/terminals', label: 'Terminals', icon: 'terminal' },
  { href: '/dashboard/developers', label: 'Developers', icon: 'code' },
  { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
]

const active = (path: string, href: string) => (href === '/dashboard' ? path === href : path.startsWith(href))

/**
 * The dashboard frame. On a desk: an ink sidebar, with the charge button where the app's dock
 * keeps Pay. On a phone: a slim top bar and the same ink dock at the bottom.
 */
export function Shell({ shop, demo, livemode, children }: { shop: string; demo: boolean; livemode: boolean; children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div className="app">
      <aside className="side" aria-label="Dashboard">
        <Link href="/dashboard" className="side-brand" aria-label="Kova overview">
          <LogoMark size={32} stem="#f1efea" />
          <Wordmark height={19} ink="#f1efea" coin="var(--coral-soft)" />
        </Link>

        <div className="side-shop">
          <Art name="badge-shop" size={40} />
          <div>
            <p className="side-shop-name">{shop}</p>
            <p className="side-shop-mode">
              <span className="dot" data-tone={livemode ? 'live' : 'test'} />
              {livemode ? 'Live' : 'Test mode'}
              {demo ? ', demo shop' : ''}
            </p>
          </div>
        </div>

        <Link href="/charge" className="side-charge">
          <span>New charge</span>
          <span className="side-charge-cap">
            <Icon name="tap" size={18} />
          </span>
        </Link>

        <nav className="side-nav">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="side-link" aria-current={active(path, item.href) ? 'page' : undefined}>
              <Icon name={item.icon} size={19} />
              {item.label}
            </Link>
          ))}
        </nav>

        <form action={signOut} className="side-foot">
          <button type="submit" className="side-link">
            <Icon name="out" size={19} />
            Sign out
          </button>
        </form>
      </aside>

      <header className="topnav">
        <Link href="/dashboard" className="brand" aria-label="Kova overview">
          <LogoMark size={30} />
          <Wordmark height={18} />
        </Link>
        <Link href="/dashboard/settings" className="topnav-shop">
          <span>{shop}</span>
          <Art name="badge-shop" size={32} />
        </Link>
      </header>

      {demo ? (
        <div className="demo-bar" role="note">
          You’re exploring a shared demo shop on Tempo’s test network.{' '}
          <Link href="/signup">Open your own shop</Link>
        </div>
      ) : null}

      <main className="main">{children}</main>

      <nav className="dock" aria-label="Dashboard">
        {NAV.slice(0, 2).map((item) => (
          <DockLink key={item.href} {...item} current={active(path, item.href)} />
        ))}
        <Link href="/charge" className="dock-charge" aria-label="New charge">
          <Icon name="tap" size={22} />
        </Link>
        {NAV.slice(2, 4).map((item) => (
          <DockLink key={item.href} {...item} current={active(path, item.href)} />
        ))}
      </nav>
    </div>
  )
}

function DockLink({ href, label, icon, current }: { href: string; label: string; icon: IconName; current: boolean }) {
  return (
    <Link href={href} className="dock-link" aria-label={label} aria-current={current ? 'page' : undefined}>
      <Icon name={icon} size={21} />
    </Link>
  )
}

/** Title, a line of context, and the page's own actions. */
export function PageHead({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="pagehead">
      <div>
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {children ? <div className="pagehead-actions">{children}</div> : null}
    </header>
  )
}
