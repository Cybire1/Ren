'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { getAddress, isAddress } from 'viem'
import { Art, Icon } from '@/components/brand'
import { parseScanned } from '@/lib/wallet/links'
import {
  applyKey,
  baseToNumber,
  currencyInfo,
  type DisplayCurrency,
  formatLocal,
  formatUsd,
  groupTyped,
  isDisplayCurrency,
  type Key,
  rateLabel,
  toBase,
} from '@/lib/wallet/money'
import { sessionCovers } from '@/lib/wallet/session'
import { ScreenHead } from './activity'
import { type Contact, isUnnamed, short, useWallet } from './provider'
import { Avatar, Keypad } from './ui'
import { chainName } from '@/lib/chain'

const first = (name: string) => (isUnnamed(name) ? short(name) : (name.split(' ')[0] ?? name))

/** When you last paid someone, or they paid you, in a few words. */
function story(activity: ReturnType<typeof useWallet>['activity'], address: string): string {
  const last = activity.find(
    (e) =>
      e.address?.toLowerCase() === address.toLowerCase() &&
      (e.kind === 'sent' || e.kind === 'received'),
  )
  if (!last) return 'No payments yet'
  const days = Math.floor((Date.now() - last.at) / 86_400_000)
  const ago = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`
  return last.kind === 'sent'
    ? `You sent ${formatUsd(BigInt(last.amount))}, ${ago}`
    : `Paid you ${formatUsd(BigInt(last.amount))}, ${ago}`
}

/** Who's it for: a name you know, an address, or someone's Kova link. */
export function SendPicker() {
  const router = useRouter()
  const { contacts, activity } = useWallet()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const scanned = text.trim() ? parseScanned(text) : null
  const query = text.trim().toLowerCase()
  const matches =
    query && !scanned
      ? contacts.filter(
          (c) => c.name.toLowerCase().includes(query) || c.address.toLowerCase().startsWith(query),
        )
      : contacts

  const go = (value: string) => {
    const s = parseScanned(value)
    if (!s) return setError('That isn’t a Ren link or a wallet address.')
    if (s.kind === 'charge') return router.push(`/wallet/pay/${s.id}`)
    if (s.kind === 'stall') return router.push(`/s/${s.slug}`)
    if (s.kind === 'pair')
      return setError('That code pairs a phone with a shop. Open it in the Ren app.')
    const params = new URLSearchParams()
    if (s.name) params.set('name', s.name)
    if (s.currency) params.set('cur', s.currency)
    if (s.amount) params.set('amount', s.amount)
    if (s.note) params.set('note', s.note)
    router.push(`/wallet/send/${getAddress(s.address)}${params.size ? `?${params}` : ''}`)
  }

  return (
    <div className="w-screen">
      <ScreenHead title="Who’s it for?" />
      <form
        className="w-find"
        onSubmit={(e) => {
          e.preventDefault()
          if (matches.length === 1 && !scanned && matches[0]) return go(matches[0].address)
          go(text)
        }}
      >
        <Icon name="search" size={20} />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
          placeholder="Name, address or link"
          aria-label="Name, address or link"
          spellCheck={false}
          autoComplete="off"
        />
        {text ? (
          <button
            type="button"
            className="w-find-btn"
            onClick={() => setText('')}
            aria-label="Clear"
          >
            <Icon name="close" size={18} />
          </button>
        ) : (
          <button
            type="button"
            className="w-find-btn"
            onClick={async () => {
              const pasted = await navigator.clipboard.readText().catch(() => '')
              if (!pasted.trim()) return setError('Nothing to paste. Ask them for their Ren link.')
              setText(pasted.trim())
            }}
          >
            Paste
          </button>
        )}
        <Link href="/wallet/pay" className="w-find-scan" aria-label="Scan their code">
          <Icon name="scan" size={20} />
        </Link>
      </form>
      {error ? <p className="form-error">{error}</p> : null}

      {scanned?.kind === 'person' ? (
        <button type="button" className="w-match" onClick={() => go(text)}>
          <Avatar name={scanned.name ?? scanned.address} id={scanned.address} size={48} />
          <span>
            <strong>Send to {scanned.name ?? short(scanned.address)}</strong>
            <small>
              {scanned.amount
                ? `They asked for $${scanned.amount}${scanned.note ? `, for ${scanned.note}` : ''}`
                : `${chainName} address, ready to pay`}
            </small>
          </span>
          <Icon name="arrow" size={20} />
        </button>
      ) : null}

      {contacts.length === 0 && !scanned ? (
        <div className="w-empty w-empty-art">
          <Art name="scene-send" size={220} />
          <strong>Send your first payment</strong>
          <span>
            Paste a friend’s Ren link or their {chainName} address. It lands in about a second, and Ren
            covers the fee.
          </span>
        </div>
      ) : null}

      {!query && contacts.length > 0 ? (
        <>
          <h2 className="w-section">Recent</h2>
          <div className="w-people">
            {contacts.slice(0, 6).map((c) => (
              <button
                key={c.address}
                type="button"
                className="w-person"
                onClick={() => go(c.address)}
              >
                <Avatar name={c.name} id={c.address} size={56} />
                <span>{isUnnamed(c.name) ? c.address.slice(0, 6) : first(c.name)}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {matches.length > 0 && !scanned ? (
        <>
          <h2 className="w-section">{query ? `Matches (${matches.length})` : 'Everyone'}</h2>
          <div className="w-list">
            {matches.map((c) => (
              <button
                key={c.address}
                type="button"
                className="w-list-row"
                onClick={() =>
                  router.push(
                    `/wallet/send/${c.address}?name=${encodeURIComponent(c.name)}${c.currency ? `&cur=${c.currency}` : ''}`,
                  )
                }
              >
                <Avatar name={c.name} id={c.address} size={44} />
                <span className="w-list-text">
                  <strong>{isUnnamed(c.name) ? short(c.address) : c.name}</strong>
                  <small>{story(activity, c.address)}</small>
                </span>
                <span className="w-list-chip">Send</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

type Stage =
  | { at: 'amount' }
  | { at: 'review' }
  | { at: 'sending' }
  | { at: 'sent'; ms: number; hash: string }
  | { at: 'problem'; message: string }

/** Sending to one person: the app's flow, amount, review, then the moment it lands. */
export function SendFlow({ to }: { to: string }) {
  const params = useSearchParams()
  const { contacts, balance, send, rates, liveRates, profile } = useWallet()
  const valid = isAddress(to)
  const address = valid ? getAddress(to) : null
  const known = contacts.find((c) => c.address.toLowerCase() === to.toLowerCase())
  const asked = params.get('amount')
  const name =
    known && !isUnnamed(known.name)
      ? known.name
      : params.get('name')?.trim() || (address ? short(address) : '')
  const theirs = (isDisplayCurrency(params.get('cur')) ? params.get('cur') : known?.currency) as
    | DisplayCurrency
    | undefined
  const [typed, setTyped] = useState(asked && /^\d+(\.\d{1,2})?$/.test(asked) ? asked : '')
  const [note, setNote] = useState(params.get('note') ?? '')
  const [stage, setStage] = useState<Stage>(asked ? { at: 'review' } : { at: 'amount' })

  const onKey = useCallback((key: Key) => setTyped((v) => applyKey(v, key, 2)), [])
  const amount = useMemo(() => {
    try {
      return typed && Number(typed) > 0 ? toBase(Number(typed).toFixed(2)) : 0n
    } catch {
      return 0n
    }
  }, [typed])
  const short_ = balance !== null && amount > balance
  const theirLocal =
    theirs && theirs !== 'USD' ? formatLocal(baseToNumber(amount), theirs, rates) : null

  if (!address)
    return (
      <div className="w-screen">
        <ScreenHead title="Send" back="/wallet/send" />
        <div className="w-empty">
          <strong>That address doesn’t look right.</strong>
          <span>Ask them for their Ren link, or check the address.</span>
        </div>
      </div>
    )

  const contact: Contact = { address, name, ...(theirs ? { currency: theirs } : {}) }

  const go = async () => {
    setStage({ at: 'sending' })
    const started = Date.now()
    try {
      const moved = await send(contact, amount, note)
      // Long enough to see it go, never longer than it takes.
      const wait = Math.max(0, 900 - (Date.now() - started))
      await new Promise((r) => setTimeout(r, wait))
      setStage({ at: 'sent', ms: moved.ms, hash: moved.hash })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ren couldn’t send it.'
      if (/cancel/i.test(message)) return setStage({ at: 'review' })
      setStage({ at: 'problem', message })
    }
  }

  if (stage.at === 'sending')
    return (
      <div className="w-screen w-moment">
        <Art name="scene-send" size={260} className="w-moment-art w-flying" />
        <h1 className="w-title">Sending to {first(name)}</h1>
        <p className="w-lead">{formatUsd(amount)} is on its way.</p>
      </div>
    )

  if (stage.at === 'sent')
    return (
      <div className="w-screen w-moment">
        <Art name="reni-cheer" size={170} className="w-moment-art" />
        <h1 className="w-hero-title">Sent!</h1>
        <p className="w-moment-big">
          {formatUsd(amount)} landed with {first(name)}
        </p>
        <p className="w-lead">It took {(stage.ms / 1000).toFixed(1)} seconds.</p>
        <div className="w-moment-actions">
          <Link href="/wallet" className="pill pill-block" data-tone="ink">
            <span className="pill-label">Done</span>
            <span className="pill-cap">
              <Icon name="check" size={18} />
            </span>
          </Link>
          <Link href={`/wallet/activity/${stage.hash}`} className="textlink">
            See receipt
          </Link>
        </div>
      </div>
    )

  if (stage.at === 'problem')
    return (
      <div className="w-screen w-moment">
        <Art name="reni-oops" size={160} className="w-moment-art" />
        <h1 className="w-title">It didn’t go through</h1>
        <p className="w-lead">{stage.message} Your money hasn’t moved.</p>
        <div className="w-moment-actions">
          <button
            type="button"
            className="pill pill-block"
            data-tone="ink"
            onClick={() => setStage({ at: 'review' })}
          >
            <span className="pill-label">Try again</span>
            <span className="pill-cap">
              <Icon name="refresh" size={18} />
            </span>
          </button>
        </div>
      </div>
    )

  if (stage.at === 'review') {
    const quick = sessionCovers(amount)
    return (
      <div className="w-screen">
        <ScreenHead title="" back={`/wallet/send/${address}?name=${encodeURIComponent(name)}`}>
          <button type="button" className="textlink" onClick={() => setStage({ at: 'amount' })}>
            Change
          </button>
        </ScreenHead>
        <div className="w-review">
          <Avatar name={name} id={address} size={72} />
          <h1 className="w-title">Send to {first(name)}</h1>
          <p className="w-lead">Reni gets it there in seconds.</p>
          <div className="w-review-card">
            <div className="w-review-row">
              <span>You send</span>
              <strong>{formatUsd(amount)}</strong>
            </div>
            {theirLocal && theirs ? (
              <span className="w-rate">
                1 USD ≈ {rates[theirs].toLocaleString('en-US', { maximumFractionDigits: 2 })}{' '}
                {theirs}, {rateLabel(liveRates)}
              </span>
            ) : null}
            <div className="w-review-row">
              <span>{first(name)} gets</span>
              <strong>
                {formatUsd(amount)}
                {theirLocal ? <small> ≈ {theirLocal}</small> : null}
              </strong>
            </div>
            {note.trim() ? (
              <div className="w-review-row">
                <span>For</span>
                <strong>{note.trim()}</strong>
              </div>
            ) : null}
            <div className="w-review-row">
              <span>Fee</span>
              <strong>$0.00, Ren covers it</strong>
            </div>
          </div>
          {short_ ? (
            <p className="form-error">
              You have {formatUsd(balance ?? 0n)}. Add money first, or send less.
            </p>
          ) : null}
          <button
            type="button"
            className="pill pill-block"
            data-tone="coral"
            disabled={amount === 0n || short_}
            onClick={() => void go()}
          >
            <span className="pill-label">Send {formatUsd(amount)}</span>
            <span className="pill-cap">
              <Icon name={quick ? 'bolt' : 'face'} size={18} />
            </span>
          </button>
          <p className="w-fine w-center">
            {quick
              ? 'Your wallet is open, so this one needs no passkey.'
              : 'Your passkey approves it. Ren never holds your money.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-screen w-amount-screen">
      <ScreenHead title="" back="/wallet/send" />
      <div className="w-to">
        <Avatar name={name} id={address} size={56} />
        <span>
          <strong>To {first(name)}</strong>
          <small>{isUnnamed(name) ? `A ${chainName} address` : short(address)}</small>
        </span>
      </div>
      <p className="w-typed" aria-live="polite">
        <span className="w-typed-sign">$</span>
        {groupTyped(typed)}
      </p>
      <p className="w-typed-sub">
        {amount > 0n && theirLocal
          ? `${first(name)} sees about ${theirLocal}`
          : `You have ${balance === null ? '…' : formatUsd(balance)}`}
        {profile && profile.currency !== 'USD' && amount > 0n && !theirLocal
          ? `, about ${formatLocal(baseToNumber(amount), profile.currency, rates)}`
          : ''}
      </p>
      <input
        className="w-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What’s it for?"
        maxLength={60}
        aria-label="What’s it for?"
      />
      <Keypad onKey={onKey} />
      <button
        type="button"
        className="pill pill-block"
        data-tone="ink"
        disabled={amount === 0n || short_}
        onClick={() => setStage({ at: 'review' })}
      >
        <span className="pill-label">{short_ ? 'More than you have' : 'Review'}</span>
        <span className="pill-cap">
          <Icon name="arrow" size={18} />
        </span>
      </button>
      {theirs && theirs !== 'USD' ? (
        <p className="w-fine w-center">
          They think in {currencyInfo[theirs].name}. They get dollars, worth about that much.
        </p>
      ) : null}
    </div>
  )
}
