'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Icon } from '@/components/brand'
import { personLink } from '@/lib/wallet/links'
import {
  currencyInfo,
  type DisplayCurrency,
  displayCurrencies,
  formatUsd,
  rateLabel,
} from '@/lib/wallet/money'
import { SESSION_LIMIT, TAP_LIMIT, useSessionState } from '@/lib/wallet/session'
import { ScreenHead } from './activity'
import { short, useWallet } from './provider'
import { CopyButton, QR } from './ui'
import { chainName, onTempo } from '@/lib/chain'

/** "$50", for limits that are always whole dollars. */
const whole = (base: bigint) => formatUsd(base).replace(/\.00$/, '')

/** You, as the app's Profile shows you: your pass, your money's currency, your keys, your shop. */
export function Profile() {
  const { profile, activity, contacts, network, rates, liveRates, setCurrency, lock, signOut } =
    useWallet()
  const session = useSessionState()
  const router = useRouter()
  const [origin, setOrigin] = useState('https://mykova.app')
  const [forgetting, setForgetting] = useState(false)
  useEffect(() => setOrigin(window.location.origin), [])
  if (!profile) return null

  const payments = activity.filter((e) => e.kind === 'paid' || e.kind === 'sent').length
  const moved = activity.reduce((sum, e) => sum + BigInt(e.amount), 0n)
  const mins = Math.floor(session.msLeft / 60_000)
  const secs = Math.floor((session.msLeft % 60_000) / 1000)
    .toString()
    .padStart(2, '0')

  return (
    <div className="w-screen">
      <ScreenHead title="You" />

      <section className="w-pass">
        <div className="w-pass-text">
          <strong>{profile.name || 'Your wallet'}</strong>
          <span>
            Member since{' '}
            {new Date(profile.createdAt).toLocaleDateString([], {
              month: 'short',
              year: 'numeric',
            })}
          </span>
          <small className="w-pass-label">
            Your address on {chainName} <em>{network === 'testnet' ? 'Testnet' : 'Mainnet'}</em>
          </small>
          <code>{short(profile.address)}</code>
          <CopyButton text={profile.address} className="w-copy w-copy-ink" />
        </div>
        <Link href="/wallet/receive" className="w-pass-qr" aria-label="Show my code">
          <QR
            value={personLink(origin, {
              address: profile.address,
              name: profile.name,
              currency: profile.currency,
            })}
            size={104}
            label="Your Ren code"
          />
        </Link>
      </section>

      <div className="w-stats">
        <span>
          <strong>{payments}</strong> Payments
        </span>
        <span>
          <strong>{contacts.length}</strong> People
        </span>
        <span>
          <strong>{formatUsd(moved)}</strong> Moved
        </span>
      </div>

      {/* On Tempo, naira to any Nigerian bank through Paystack (components/wallet/naira.tsx). */}
      {onTempo ? (
        <Link href="/wallet/cash-out" className="w-add-chain">
          <span>
            <strong>Cash out to naira</strong>
            <small>To any Nigerian bank account, through Paystack</small>
          </span>
          <Icon name="out" size={18} />
        </Link>
      ) : null}

      {/* Mainnet only: on testnet there's nothing real to cash out. Ramp pays out AUSD on Monad. */}
      {network === 'mainnet' && !onTempo ? (
        <Link href="/wallet/cash-out" className="w-add-chain">
          <span>
            <strong>Cash out</strong>
            <small>To your bank or card, with Ramp Network</small>
          </span>
          <Icon name="out" size={18} />
        </Link>
      ) : null}

      <section className="w-money">
        <div>
          <small>Your money shows in</small>
          <strong>
            {currencyInfo[profile.currency].symbol} {currencyInfo[profile.currency].name}
          </strong>
          <span>
            {profile.currency === 'USD'
              ? 'Dollars, just as they are.'
              : `$1 = ${currencyInfo[profile.currency].symbol}${rates[profile.currency].toLocaleString('en-US', { maximumFractionDigits: 3 })}, ${rateLabel(liveRates)}`}
          </span>
        </div>
        <label className="w-money-change">
          <span className="sr-only">Show my money in</span>
          <select
            value={profile.currency}
            onChange={(e) => setCurrency(e.target.value as DisplayCurrency)}
          >
            {displayCurrencies.map((code) => (
              <option key={code} value={code}>
                {currencyInfo[code].symbol} {currencyInfo[code].name}
              </option>
            ))}
          </select>
          Change
        </label>
      </section>

      <section className="w-keys">
        <div className="w-keys-head">
          <span className="w-keys-icon">
            <Icon name="face" size={20} />
          </span>
          <span>
            <strong>Your passkey</strong>
            <small>The same one as the Ren app. It opens this wallet on any device.</small>
          </span>
        </div>
        <div className={`w-session${session.open ? ' w-session-open' : ''}`}>
          <span>
            <strong>{session.open ? `Open for ${mins}:${secs}` : 'Locked'}</strong>
            <small>
              {session.open
                ? `Pays up to ${formatUsd(session.canApprove)} without your passkey`
                : 'Your next payment asks for your passkey'}
            </small>
          </span>
          {session.open ? (
            <button type="button" className="mini mini-ink" onClick={lock}>
              <Icon name="lock" size={14} /> Lock
            </button>
          ) : null}
        </div>
        <div className="w-rules">
          <span>{whole(TAP_LIMIT)} a tap</span>
          <span>{whole(SESSION_LIMIT)} a session</span>
          <span>3 quiet minutes</span>
        </div>
        <p className="w-fine">
          Your name and the people you pay are sealed with your passkey. Ren stores them and can’t
          read them.
        </p>
      </section>

      {forgetting ? (
        <div className="w-forget">
          <p>
            This browser forgets your wallet. Your money stays on {chainName}, and your passkey opens it
            again here or in the Ren app: choose <em>Open my Ren wallet</em>.
          </p>
          <div className="w-forget-actions">
            <button type="button" className="mini" onClick={() => setForgetting(false)}>
              Keep it
            </button>
            <button
              type="button"
              className="mini mini-ink"
              onClick={() => {
                signOut()
                router.replace('/wallet')
              }}
            >
              Forget this wallet here
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="textlink w-forget-link"
          onClick={() => setForgetting(true)}
        >
          Forget this wallet on this browser
        </button>
      )}
    </div>
  )
}
