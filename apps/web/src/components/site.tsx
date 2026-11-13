import type { ReactNode } from 'react'
import { Wordmark } from '@/components/brand'

/*
 * The home page's shared pieces: the icon set, the floating nav with its menus and phone sheet, a
 * phone frame for real screens, and the footer. Styles in styles/home.css, under .rn;
 * components/home-motion.tsx wires up the menus and the phone sheet.
 */

/** The page's line icons, drawn once and used by id. */
const SPRITE =
  '<defs>\n  <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>\n  <symbol id="i-left" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></symbol>\n  <symbol id="i-chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>\n  <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>\n  <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></symbol>\n  <symbol id="i-wallet" viewBox="0 0 24 24"><path d="M3.5 8A2.5 2.5 0 0 1 6 5.5h11.5V8"/><rect x="3.5" y="8" width="17" height="11" rx="2.5"/><path d="M16 13.5h.01"/></symbol>\n  <symbol id="i-card" viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/></symbol>\n  <symbol id="i-send" viewBox="0 0 24 24"><path d="M20.5 3.5 10 14"/><path d="m20.5 3.5-6 17-4.5-6.5-6.5-4.5z"/></symbol>\n  <symbol id="i-scan" viewBox="0 0 24 24"><path d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16M7.5 12h9"/></symbol>\n  <symbol id="i-tap" viewBox="0 0 24 24"><path d="M7 8.5a5 5 0 0 1 0 7M11 6a8.5 8.5 0 0 1 0 12M15 3.5a12 12 0 0 1 0 17"/></symbol>\n  <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/></symbol>\n  <symbol id="i-down" viewBox="0 0 24 24"><path d="M12 4.5v11M7 11l5 5 5-5M5 19.5h14"/></symbol>\n  <symbol id="i-eye" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a13 13 0 0 1-2.4 3.6M6.6 6.6C4.5 8 3.1 10.1 2.5 12c1 2.5 4.5 7 9.5 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></symbol>\n  <symbol id="i-key" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.7-8.7M17 6l2.5 2.5M14.5 8.5l2 2"/></symbol>\n  <symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13 2.5 4.5 14H11l-1 7.5L18.5 10H12z"/></symbol>\n  <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.5"/><path d="M3 19.5a6 6 0 0 1 12 0M16 5a3.5 3.5 0 0 1 0 7M18.5 14.5a6 6 0 0 1 2.5 5"/></symbol>\n  <symbol id="i-phone" viewBox="0 0 24 24"><rect x="6.5" y="3" width="11" height="18" rx="3"/><path d="M11 18h2"/></symbol>\n  <symbol id="i-store" viewBox="0 0 24 24"><path d="M4.5 10v9.5h15V10M3.5 4.5h17L19 9.5a2.3 2.3 0 0 1-4.4.4 2.3 2.3 0 0 1-4.2 0A2.3 2.3 0 0 1 6 9.5z"/></symbol>\n  <symbol id="i-list" viewBox="0 0 24 24"><path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/></symbol>\n  <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></symbol>\n  <symbol id="i-code" viewBox="0 0 24 24"><path d="m8 7-5 5 5 5M16 7l5 5-5 5"/></symbol>\n  <symbol id="i-hook" viewBox="0 0 24 24"><path d="M4 12h3l2.5-6 5 12 2.5-6h3"/></symbol>\n  <symbol id="i-x" viewBox="0 0 24 24"><path d="M4.5 4.5l15 15M19.5 4.5l-15 15"/></symbol>\n  <symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5a13 13 0 0 1 0 17M12 3.5a13 13 0 0 0 0 17"/></symbol>\n</defs>'

/** The icon set, once per page; everything else uses its symbols by id. */
export function SiteSprite() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: 'absolute' }}
      aria-hidden="true"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the page's own fixed icon set, no input in it
      dangerouslySetInnerHTML={{ __html: SPRITE }}
    />
  )
}

/** One of the sprite's icons. */
export function I({ id }: { id: string }) {
  return (
    <svg aria-hidden="true" className="i">
      <use href={`#i-${id}`} />
    </svg>
  )
}

/** Ren's wordmark, light on black, with no shadow under the coin. */
function SiteBrand() {
  return (
    <a className="kbrand" href="/" aria-label="Ren home">
      <Wordmark height={30} ink="var(--ink)" shadow="transparent" />
    </a>
  )
}

/** A row in one of the nav's menus. */
function MenuItem({
  href,
  icon,
  title,
  children,
}: {
  href: string
  icon: string
  title: string
  children: ReactNode
}) {
  return (
    <a className="mi" href={href}>
      <span className="ic">
        <I id={icon} />
      </span>
      <span>
        <b>{title}</b>
        <span>{children}</span>
      </span>
    </a>
  )
}

/**
 * A real screen from Ren's web wallet in a plain phone frame: a strip in the screen's own colour
 * where the phone's clock sits, then the capture. `top` is that colour (the wallet is black; the
 * shop's till is pink).
 */
export function Screen({
  src,
  alt,
  top = '#000',
  eager,
}: {
  src: string
  alt: string
  top?: string
  eager?: boolean
}) {
  return (
    <>
      <span className="sb" style={{ background: top }} aria-hidden="true">
        <i />
      </span>
      {/* biome-ignore lint/performance/noImgElement: a pre-sized WebP capture, no optimizer needed */}
      <img
        src={`/site/${src}.webp`}
        alt={alt}
        width={780}
        height={1688}
        loading={eager ? undefined : 'lazy'}
      />
    </>
  )
}

/** The floating nav, its Personal, Shops and Developers menus, and the phone sheet. */
export function SiteNav({ login }: { login: string }) {
  return (
    <>
      <header className="nav" id="nav">
        <div className="nav-in">
          <SiteBrand />
          <nav className="kpill" aria-label="Main">
            <span className="pl-ind" aria-hidden="true" />
            <div>
              <button type="button" className="pl" aria-expanded="false" data-drop="dp">
                Personal{' '}
                <svg aria-hidden="true" className="i chev">
                  <use href="#i-chev" />
                </svg>
              </button>
              <div className="drop d-personal" id="dp">
                <MenuItem href="/#keys" icon="key" title="Keys with limits">
                  A limit on everything that spends
                </MenuItem>
                <MenuItem href="/#pay" icon="scan" title="Pay a shop">
                  Tap or scan, about a second
                </MenuItem>
                <a className="feat" href="/#keys">
                  <small>Ren’s main idea</small>
                  <b>Give out a key, not your wallet</b>
                  <p>Each key has its own limit.</p>
                  {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
                  <img src="/art/card-active.webp" alt="" />
                </a>
                <MenuItem href="/#more" icon="users" title="Allowances">
                  A weekly limit for someone
                </MenuItem>
                <MenuItem href="/#more" icon="bolt" title="AI agents">
                  Pay within your budget
                </MenuItem>
                <MenuItem href="/#more" icon="send" title="Send and request">
                  To a friend, in about a second
                </MenuItem>
                <MenuItem href="/#more" icon="lock" title="Private balance">
                  Strangers can’t look it up
                </MenuItem>
              </div>
            </div>
            <div>
              <button type="button" className="pl" aria-expanded="false" data-drop="db">
                Shops{' '}
                <svg aria-hidden="true" className="i chev">
                  <use href="#i-chev" />
                </svg>
              </button>
              <div className="drop d-business" id="db">
                <MenuItem href="/#business" icon="phone" title="Your phone is the till">
                  Paid in about a second
                </MenuItem>
                <a className="feat dark" href="/wallet/shop?go=open">
                  <small>Free to start</small>
                  <b>Open a shop in a minute</b>
                  <p>No card machine, no card fees.</p>
                  {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
                  <img src="/art/badge-shop.webp" alt="" />
                </a>
                <MenuItem href="/#business" icon="users" title="Staff phones">
                  They can only take payments
                </MenuItem>
                <MenuItem href="/#business" icon="store" title="Your shop online">
                  Menu, table codes, stamp cards
                </MenuItem>
                <MenuItem href="/#business" icon="list" title="Takings">
                  Every sale, as it lands
                </MenuItem>
              </div>
            </div>
            <div>
              <button type="button" className="pl" aria-expanded="false" data-drop="dd">
                Developers{' '}
                <svg aria-hidden="true" className="i chev">
                  <use href="#i-chev" />
                </svg>
              </button>
              <div className="drop d-dev" id="dd">
                <MenuItem href="/#developers" icon="code" title="Payments API">
                  One POST to charge
                </MenuItem>
                <MenuItem href="/#developers" icon="hook" title="Webhooks">
                  Signed, the moment it’s paid
                </MenuItem>
                <MenuItem href="/#developers" icon="bolt" title="AI agents over MCP">
                  Pay within a limit you set
                </MenuItem>
                <MenuItem href="/#developers" icon="globe" title="Machine payments">
                  Any MPP client can pay a Ren shop
                </MenuItem>
              </div>
            </div>
            <div>
              <a className="pl" href="/#faq">
                Help
              </a>
            </div>
          </nav>
          <div className="nav-r">
            <a className="login" href="/wallet">
              {login}
            </a>
            <a className="btn b-coral b-sm" href="/wallet">
              Open Ren{' '}
              <span className="o">
                <I id="arrow" />
              </span>
            </a>
            <button
              type="button"
              className="menu-btn"
              id="menuBtn"
              aria-label="Menu"
              aria-expanded="false"
            >
              <i></i>
              <i></i>
            </button>
          </div>
        </div>
      </header>

      <div className="ksheet" id="sheet">
        <nav>
          {(
            [
              ['/#keys', 'Keys with limits'],
              ['/#pay', 'Pay a shop'],
              ['/#more', 'Everything else'],
              ['/#business', 'Shops'],
              ['/#developers', 'Developers'],
              ['/#faq', 'Help'],
            ] as const
          ).map(([href, label]) => (
            <a className="big" href={href} key={href} data-close>
              {label} <I id="arrow" />
            </a>
          ))}
        </nav>
        <div className="sheet-b">
          <a className="btn b-coral" href="/wallet" data-close>
            Open Ren on the web{' '}
            <span className="o">
              <I id="arrow" />
            </span>
          </a>
          <a className="btn b-soft" href="/wallet/shop?go=open">
            Open a shop
          </a>
        </div>
      </div>
    </>
  )
}

/** The footer. */
export function SiteFooter({ chain, mainnet }: { chain: string; mainnet: boolean }) {
  return (
    <footer className="kfoot">
      <div className="wrap">
        <div className="foot-g">
          <div className="foot-b">
            <SiteBrand />
            <p>
              Your dollars, your rules. A wallet that opens with Face ID, with a limit on every key
              that spends and a shop inside it.
            </p>
          </div>
          <div>
            <h5>Personal</h5>
            <ul>
              <li>
                <a href="/#keys">Keys with limits</a>
              </li>
              <li>
                <a href="/#pay">Pay a shop</a>
              </li>
              <li>
                <a href="/#more">Send and request</a>
              </li>
              <li>
                <a href="/wallet">Open Ren</a>
              </li>
            </ul>
          </div>
          <div>
            <h5>Shops</h5>
            <ul>
              <li>
                <a href="/wallet/shop?go=open">Open a shop</a>
              </li>
              <li>
                <a href="/#business">How the till works</a>
              </li>
              <li>
                <a href="/signin">Shop sign-in</a>
              </li>
            </ul>
          </div>
          <div>
            <h5>Developers</h5>
            <ul>
              <li>
                <a href="/#developers">Payments API</a>
              </li>
              <li>
                <a href="/#developers">AI agents</a>
              </li>
              <li>
                <a href="/wallet/shop?go=open">Get API keys</a>
              </li>
            </ul>
          </div>
          <div>
            <h5>Ren</h5>
            <ul>
              <li>
                <a href="/#security">Security</a>
              </li>
              <li>
                <a href="/#faq">Help</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="foot-bot">
          <span>© 2026 Ren</span>
          <span className="mon">Built on {chain}</span>
        </div>
        {mainnet ? null : (
          <p className="fine">
            Ren runs on {chain}’s test network today. The dollars here are test dollars, free to add
            in the wallet, and not money you can spend elsewhere.
          </p>
        )}
        <p className="fine">
          Ren is a self-custody wallet, not a bank. Balances are held as a dollar stablecoin on the{' '}
          {chain} network, in a wallet only your passkey can open.
        </p>
      </div>
    </footer>
  )
}
