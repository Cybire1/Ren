'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
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
 * The dashboard frame. On a desk: a slim ink rail, the charge button in coral where the app's
 * dock keeps Pay. On a phone: a top bar and the same ink dock at the bottom.
 */
export function Shell({ shop, demo, livemode, children }: { shop: string; demo: boolean; livemode: boolean; children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()

  // Tell the server this browser's time zone, so "today" is the shop's today.
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!tz || document.cookie.split('; ').includes(`kova_tz=${tz}`)) return
    document.cookie = `kova_tz=${tz}; path=/; max-age=31536000; samesite=lax`
    router.refresh()
  }, [router])

  return (
    <div className="app">
      <aside className="rail" aria-label="Dashboard">
        <Link href="/dashboard" className="rail-mark" aria-label="Kova overview">
          <LogoMark size={36} stem="#f1efea" />
        </Link>

        <Link href="/charge" className="rail-charge">
          <span className="rail-charge-dot">
            <Icon name="tap" size={22} />
          </span>
          <span>Charge</span>
        </Link>

        <nav className="rail-nav" aria-label="Pages">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rail-link" aria-current={active(path, item.href) ? 'page' : undefined}>
              <Icon name={item.icon} size={21} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="rail-foot">
          <Link href="/dashboard/settings" className="rail-shop" title={`${shop}${livemode ? '' : ', test mode'}`} aria-label={`${shop} settings`}>
            <Art name="badge-shop" size={42} />
            {livemode ? null : <span className="rail-test" aria-hidden="true" />}
          </Link>
          <form action={signOut}>
            <button type="submit" className="rail-link">
              <Icon name="out" size={20} />
              <span>Sign out</span>
            </button>
          </form>
        </div>
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
          You’re exploring a shared demo shop on Tempo’s test network. <Link href="/signup">Open your own shop</Link>
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
