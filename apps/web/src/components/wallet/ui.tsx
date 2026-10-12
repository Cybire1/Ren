'use client'

import Link from 'next/link'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Art, type ArtName, Icon } from '@/components/brand'
import { Odometer } from '@/components/odometer'
import {
  baseToNumber,
  currencyInfo,
  type DisplayCurrency,
  formatLocal,
  formatUsd,
  type Key,
  type Rates,
} from '@/lib/wallet/money'
import { type Entry, isUnnamed, useWallet } from './provider'

/** FNV-1a over the lowercased address, as the app picks faces: the same person looks the same everywhere. */
function hash(text: string) {
  let h = 0x811c9dc5
  for (const c of text.toLowerCase()) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

const FACES: ArtName[] = [
  'avatar-1',
  'avatar-2',
  'avatar-3',
  'avatar-4',
  'avatar-5',
  'avatar-6',
  'avatar-7',
]

export function Avatar({ name, id, size = 56 }: { name: string; id?: string; size?: number }) {
  return (
    <Art
      name={FACES[hash(id || name || '?') % FACES.length] ?? 'avatar-1'}
      size={size}
      className="w-face"
      alt=""
    />
  )
}

export function EntryBadge({ entry, size = 44 }: { entry: Entry; size?: number }) {
  if (entry.kind === 'paid') return <Art name="badge-shop" size={size} className="w-face" />
  if (entry.kind === 'added') return <Art name="badge-add" size={size} className="w-face" />
  return <Avatar name={entry.name} id={entry.address} size={size} />
}

const verbs = { paid: 'Paid', sent: 'Sent', received: 'Received', added: 'Added' } as const

export function when(at: number): string {
  const d = new Date(at)
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === new Date().toDateString()) return time
  if (d.toDateString() === new Date(Date.now() - 86_400_000).toDateString())
    return `Yesterday, ${time}`
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export const incoming = (entry: Entry) => entry.kind === 'received' || entry.kind === 'added'

export function signed(entry: Entry) {
  const amount = BigInt(entry.amount)
  return incoming(entry) ? formatUsd(amount, { sign: true }) : formatUsd(-amount)
}

/** One line of money: who, what, when, and how much, signed by direction. */
export function EntryRow({ entry, rank }: { entry: Entry; rank?: number }) {
  return (
    <Link
      href={`/wallet/activity/${encodeURIComponent(entry.id)}`}
      className={`w-entry${isFresh(entry) ? ' w-entry-fresh' : ''}`}
      data-rank={rank}
      aria-label={`${verbs[entry.kind]} ${formatUsd(BigInt(entry.amount))}, ${entry.name}`}
    >
      <EntryBadge entry={entry} />
      <span className="w-entry-text">
        <span className="w-entry-name">{entry.name}</span>
        <span className="w-entry-sub">
          {entry.detail}, {when(entry.at)}
        </span>
      </span>
      <span className={`w-entry-amount${incoming(entry) ? ' w-in' : ''}`}>{signed(entry)}</span>
    </Link>
  )
}

/** The tap mark's three waves, drawn large and faint behind money, or pulsing on Pay. */
export function Waves({ className, size = 200 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <path d="M92.6 74.3 A40 40 0 0 1 92.6 125.7" />
      <path d="M115.6 55 A70 70 0 0 1 115.6 145" />
      <path d="M138.6 35.7 A100 100 0 0 1 138.6 164.3" />
    </svg>
  )
}

/** Money that came in a moment ago: it gets a chip on the balance and a glow in Recent. */
export const FRESH_FOR = 120_000
export const isFresh = (entry: Entry) => incoming(entry) && Date.now() - entry.at < FRESH_FOR

/**
 * The balance, first thing on Home: dollars as the headline, rolling into place like a till's
 * wheels, the sign and cents set small and raised like a price tag, and one tap to hide it all.
 * Money that just landed says so on the card. With nothing in the wallet yet, the card is the
 * first step instead: one button to add test dollars, and Kovi waiting to catch them.
 */
export function BalanceCard({ fresh, empty }: { fresh?: Entry | null; empty?: boolean }) {
  const { balance, profile, rates, hideBalance, setHideBalance, network } = useWallet()
  const usd = balance === null ? null : formatUsd(balance)
  const [whole, cents] =
    usd === null ? ['—', ''] : [usd.slice(1, usd.lastIndexOf('.')), usd.slice(usd.lastIndexOf('.'))]
  const currency = profile?.currency ?? 'USD'
  const testnet = network === 'testnet'
  return (
    <section
      className={`w-balance${empty ? ' w-balance-empty' : ''}`}
      aria-label={hideBalance ? 'Balance hidden' : `Available ${usd ?? 'loading'}`}
    >
      <Waves className="w-balance-waves" size={220} />
      {empty ? (
        <span className="w-balance-kovi" aria-hidden="true">
          <Art name="sparkle-8" size={18} className="w-sparkle w-sparkle-a" />
          <Art name="sparkle-4" size={14} className="w-sparkle w-sparkle-b" />
          <Art name="kovi-catch" size={124} className="w-kovi-catch" />
        </span>
      ) : (
        <span className="w-balance-coins" aria-hidden="true">
          <Art name="coin-usd" size={50} className="w-coin w-coin-front" />
          <Art name="coin-eur" size={40} className="w-coin w-coin-back" />
        </span>
      )}
      <div className="w-balance-top">
        <button
          type="button"
          className="w-balance-label"
          onClick={() => setHideBalance(!hideBalance)}
          aria-label={hideBalance ? 'Show balance' : 'Hide balance'}
        >
          Available <Icon name={hideBalance ? 'eyeOff' : 'eye'} size={18} />
        </button>
        {empty ? (
          testnet ? (
            <span className="w-chip">Test dollars</span>
          ) : null
        ) : (
          <Link href="/wallet/add" className="w-balance-add">
            <Icon name="plus" size={16} /> Add
          </Link>
        )}
      </div>
      <p className="w-balance-amount">
        {hideBalance ? (
          <span className="w-balance-hidden">••••••</span>
        ) : (
          <>
            <span className="w-balance-sign">$</span>
            {usd === null ? (
              <span className="w-balance-wait" aria-hidden="true" />
            ) : (
              <Odometer value={whole} className="w-balance-whole" />
            )}
            <span className="w-balance-cents">{cents}</span>
          </>
        )}
      </p>
      {empty ? (
        <>
          <p className="w-balance-ready">Your wallet is ready.</p>
          <Link href="/wallet/add" className="w-balance-cta">
            {testnet ? 'Add $5, free' : 'Add money'}
            <span className="w-balance-cta-cap">
              <Icon name="plus" size={16} />
            </span>
          </Link>
        </>
      ) : (
        <div className="w-balance-chips">
          {fresh && !hideBalance ? (
            <span className="w-chip w-chip-landed" key={fresh.id}>
              <Icon name="down" size={14} />
              <span>
                {formatUsd(BigInt(fresh.amount), { sign: true })}{' '}
                {fresh.kind === 'added'
                  ? testnet
                    ? 'test dollars'
                    : 'added'
                  : `from ${isUnnamed(fresh.name) ? 'someone' : fresh.name.split(' ')[0]}`}
                <span className="w-chip-when">, just now</span>
              </span>
            </span>
          ) : (
            <>
              {testnet ? <span className="w-chip">Test dollars</span> : null}
              {balance !== null && currency !== 'USD' ? (
                <span className="w-chip">
                  {hideBalance
                    ? '≈ ••••'
                    : `≈ ${formatLocal(baseToNumber(balance), currency, rates)}`}
                </span>
              ) : null}
            </>
          )}
        </div>
      )}
    </section>
  )
}

/** Send and Request: an icon in a solid disc, a dotted path, and something travelling along it. */
export function ActionTile({ kind }: { kind: 'send' | 'request' }) {
  const send = kind === 'send'
  return (
    <Link
      href={send ? '/wallet/send' : '/wallet/request'}
      className={`w-tile ${send ? 'w-tile-send' : 'w-tile-request'}`}
      aria-label={send ? 'Send. Lands in seconds' : 'Request. Get paid by link'}
    >
      <svg
        className="w-tile-path"
        viewBox="0 0 140 96"
        preserveAspectRatio="xMaxYMin meet"
        aria-hidden="true"
      >
        <path
          d={send ? 'M40 30 C62 30 74 14 100 12' : 'M112 4 C112 18 90 22 66 30'}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.8"
          strokeDasharray="1 5"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
      {send ? (
        <Art name="plane" size={54} className="w-tile-plane" />
      ) : (
        <Art name="coin-usd" size={30} className="w-tile-coin" />
      )}
      <span className="w-tile-disc">
        <Icon name={send ? 'send' : 'receive'} size={18} />
      </span>
      <span className="w-tile-label">{send ? 'Send' : 'Request'}</span>
    </Link>
  )
}

/** The app's keypad, for touch screens. On a keyboard, digits and Backspace type too. */
export function Keypad({ onKey, decimals = 2 }: { onKey: (key: Key) => void; decimals?: number }) {
  const layout: (Key | '')[] = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    decimals > 0 ? '.' : '',
    '0',
    'del',
  ]
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (/^[0-9]$/.test(event.key)) onKey(event.key as Key)
      else if ((event.key === '.' || event.key === ',') && decimals > 0) onKey('.')
      else if (event.key === 'Backspace') onKey('del')
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [onKey, decimals])
  return (
    <div className="w-keypad">
      {layout.map((key) =>
        key === '' ? (
          <span key="gap" />
        ) : (
          <button
            key={key}
            type="button"
            className="w-key"
            onClick={() => onKey(key)}
            aria-label={key === 'del' ? 'Delete' : key === '.' ? 'Point' : key}
          >
            {key === 'del' ? <Icon name="del" size={24} /> : key}
          </button>
        ),
      )}
    </div>
  )
}

/** A QR code, drawn as SVG in Kova's ink, shown as an image. */
export function QR({ value, size = 220, label }: { value: string; size?: number; label: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let live = true
    void QRCode.toString(value, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b1a1d', light: '#ffffff' },
    }).then((svg) => live && setSrc(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`))
    return () => {
      live = false
    }
  }, [value])
  return (
    <span className="w-qr" style={{ width: size, height: size }}>
      {/* biome-ignore lint/performance/noImgElement: an SVG drawn in the browser, nothing to optimise */}
      {src ? <img src={src} alt={label} width={size} height={size} /> : null}
    </span>
  )
}

/** Copies text, and says so. */
export function CopyButton({
  text,
  label = 'Copy',
  className = 'w-copy',
}: {
  text: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Copied' : label}
    </button>
  )
}

/** Shares with the system sheet where there is one, else copies. */
export function ShareButton({
  text,
  url,
  title,
  label,
}: {
  text: string
  url: string
  title: string
  label: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="pill pill-block"
      data-tone="ink"
      onClick={async () => {
        const share = (navigator as Navigator & { share?: (data: ShareData) => Promise<void> })
          .share
        if (share) {
          await share.call(navigator, { title, text, url }).catch(() => {})
          return
        }
        await navigator.clipboard.writeText(`${text} ${url}`).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}
    >
      <span className="pill-label">{copied ? 'Link copied' : label}</span>
      <span className="pill-cap">
        <Icon name={copied ? 'check' : 'share'} size={18} />
      </span>
    </button>
  )
}

/** "about €184.00", when the person thinks in another currency. */
export function localAbout(usd: number, currency: DisplayCurrency, rates: Rates): string | null {
  return currency === 'USD' ? null : `about ${formatLocal(usd, currency, rates)}`
}

export const currencyLabel = (currency: DisplayCurrency) =>
  `${currencyInfo[currency].symbol} ${currencyInfo[currency].name}`
