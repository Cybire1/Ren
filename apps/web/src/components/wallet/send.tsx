'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getAddress, isAddress } from 'viem'
import { Art, Icon, type IconName } from '@/components/brand'
import { parseScanned } from '@/lib/wallet/links'
import {
  applyKey,
  baseToNumber,
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
import { Home } from './home'
import { type Contact, isUnnamed, short, useWallet } from './provider'
import { Avatar, Keypad } from './ui'

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

type Step = 'who' | 'amount' | 'review' | 'sent'
const order: Step[] = ['who', 'amount', 'review', 'sent']
type Payee = { address: string; name?: string; currency?: DisplayCurrency }
type Leg = 'waiting' | 'flying' | 'landed'

/**
 * Sending, in one sheet over Home, as in the app: who, how much, a look at the route, slide to
 * send, and the same sheet becomes the receipt. It resizes to each step, so it settles low once
 * the money has landed and your balance shows behind it, counting down.
 */
export function SendSheet({ to }: { to?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const { contacts, balance, send, rates, liveRates, profile } = useWallet()

  const asked = params.get('amount')
  const start: Payee | null =
    to && isAddress(to)
      ? {
          address: getAddress(to),
          name: params.get('name')?.trim() || undefined,
          currency: isDisplayCurrency(params.get('cur'))
            ? (params.get('cur') as DisplayCurrency)
            : undefined,
        }
      : null
  const validAsk = asked && /^\d+(\.\d{1,2})?$/.test(asked) ? asked : ''

  const [step, setStep] = useState<Step>(start ? (validAsk ? 'review' : 'amount') : 'who')
  const [back, setBack] = useState(false)
  const [payee, setPayee] = useState<Payee | null>(start)
  const [typed, setTyped] = useState(validAsk)
  const [note, setNote] = useState(params.get('note') ?? '')
  const [leg, setLeg] = useState<Leg>('waiting')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [sent, setSent] = useState<{ ms: number; hash: string } | null>(null)
  const [closing, setClosing] = useState(false)

  const moveTo = (next: Step) => {
    setBack(order.indexOf(next) < order.indexOf(step))
    setStep(next)
  }

  const known = payee
    ? contacts.find((c) => c.address.toLowerCase() === payee.address.toLowerCase())
    : undefined
  const name = payee
    ? known && !isUnnamed(known.name)
      ? known.name
      : payee.name || short(payee.address)
    : ''
  const theirs = payee?.currency ?? known?.currency
  const local = theirs && theirs !== 'USD' ? theirs : null

  const onKey = useCallback((key: Key) => setTyped((v) => applyKey(v, key, 2)), [])
  const amount = useMemo(() => {
    try {
      return typed && Number(typed) > 0 ? toBase(Number(typed).toFixed(2)) : 0n
    } catch {
      return 0n
    }
  }, [typed])
  const dollars = baseToNumber(amount)
  const over = balance !== null && amount > balance
  const theirLocal = local ? formatLocal(dollars, local, rates) : null

  const close = useCallback(() => {
    if (busy) return
    setClosing(true)
    setTimeout(() => router.push('/wallet'), 260)
  }, [busy, router])

  // A dialog: Escape closes it, the page behind doesn't scroll.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKeyDown)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
    }
  }, [close])

  const pick = (p: Payee & { amount?: string; note?: string }) => {
    setPayee(p)
    if (p.amount) setTyped(p.amount)
    if (p.note) setNote(p.note)
    moveTo(p.amount ? 'review' : 'amount')
  }

  const go = async () => {
    if (!payee) return
    const contact: Contact = {
      address: payee.address,
      name,
      ...(theirs ? { currency: theirs } : {}),
    }
    setBusy(true)
    setProblem(null)
    setLeg('flying')
    const started = Date.now()
    try {
      const moved = await send(contact, amount, note)
      // Let Kovi finish the leg he is on: the flight is timed to about what the chain takes.
      await wait(Math.max(0, 1360 - (Date.now() - started)))
      setLeg('landed')
      await wait(620)
      setSent({ ms: moved.ms, hash: moved.hash })
      setBusy(false)
      moveTo('sent')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Kova couldn’t send it.'
      setLeg('waiting')
      setBusy(false)
      if (!/cancel|not allowed|abort/i.test(message)) setProblem(message)
    }
  }

  const quick = sessionCovers(amount)

  return (
    <>
      <div aria-hidden="true" inert>
        <Home />
      </div>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        className={`w-sheet-scrim${closing ? ' w-sheet-out' : ''}`}
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={payee ? `Send to ${name}` : 'Send'}
        className={`w-sheet${closing ? ' w-sheet-out' : ''}`}
      >
        <button type="button" className="w-sheet-grab" aria-label="Close" onClick={close} />
        <Fit>
          <div key={step} className={`w-step${back ? ' w-step-back' : ''}`}>
            {step === 'who' ? <Who onPick={pick} /> : null}

            {step === 'amount' && payee ? (
              <div className="w-sheet-amount">
                <div className="w-sheet-top">
                  {start ? null : (
                    <button
                      type="button"
                      className="round"
                      aria-label="Back"
                      onClick={() => moveTo('who')}
                    >
                      <Icon name="back" size={20} />
                    </button>
                  )}
                  <Avatar name={name} id={payee.address} size={44} />
                  <span className="w-sheet-who">
                    <strong>To {isUnnamed(name) ? short(payee.address) : name}</strong>
                    <small>{isUnnamed(name) ? 'A Monad address' : short(payee.address)}</small>
                  </span>
                </div>
                <p className="w-typed" aria-live="polite">
                  <span className="w-typed-sign">$</span>
                  {groupTyped(typed)}
                </p>
                <div className="w-sheet-pills">
                  {theirLocal && amount > 0n ? (
                    <span className="w-sheet-pill w-sheet-pill-teal">
                      {first(name)} sees ≈ {theirLocal}
                    </span>
                  ) : null}
                  {balance !== null ? (
                    <span className={`w-sheet-pill${over ? ' w-sheet-pill-over' : ''}`}>
                      {over ? `You have ${formatUsd(balance)}` : `${formatUsd(balance)} available`}
                    </span>
                  ) : null}
                </div>
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
                  disabled={amount === 0n || over}
                  onClick={() => moveTo('review')}
                >
                  <span className="pill-label">{over ? 'More than you have' : 'Review'}</span>
                  <span className="pill-cap">
                    <Icon name="arrow" size={18} />
                  </span>
                </button>
              </div>
            ) : null}

            {step === 'review' && payee && profile ? (
              <div>
                <div className="w-sheet-top">
                  <button
                    type="button"
                    className="round"
                    aria-label="Change the amount"
                    disabled={busy}
                    onClick={() => moveTo('amount')}
                  >
                    <Icon name="back" size={20} />
                  </button>
                  <strong className="w-sheet-title">
                    {busy ? `Sending to ${first(name)}` : 'Check and send'}
                  </strong>
                </div>
                <ArcRoute
                  you={{ name: profile.name || 'You', id: profile.address }}
                  them={{ name, id: payee.address }}
                  leg={leg}
                />
                <div className="w-sheet-sum">
                  <strong>{formatUsd(amount)}</strong>
                  <span>
                    {theirLocal
                      ? `${first(name)} gets ${formatUsd(amount)}, about ${theirLocal}`
                      : isUnnamed(name)
                        ? 'They get all of it'
                        : `${first(name)} gets all of it`}
                  </span>
                </div>
                <dl className="w-facts">
                  <Fact label="Fee" value="$0.00, Kova covers it" />
                  <Fact label="Arrives" value="In about a second" icon="bolt" />
                  {local ? (
                    <Fact
                      label="Rate"
                      value={`1 USD ≈ ${rates[local].toLocaleString('en-US', { maximumFractionDigits: 2 })} ${local}`}
                      hint={rateLabel(liveRates)}
                    />
                  ) : null}
                  {note.trim() ? <Fact label="For" value={note.trim()} /> : null}
                </dl>
                {problem ? (
                  <p className="w-sheet-problem" role="alert">
                    <Icon name="info" size={18} />
                    {problem} Your money hasn’t moved.
                  </p>
                ) : null}
                {over ? (
                  <p className="form-error">
                    You have {formatUsd(balance ?? 0n)}. Add money first, or send less.
                  </p>
                ) : null}
                <SlideToSend
                  label={problem ? 'Slide to try again' : `Slide to send ${formatUsd(amount)}`}
                  busy={busy}
                  disabled={over || amount === 0n}
                  onSend={() => void go()}
                />
                <p className="w-fine w-center">
                  {quick
                    ? 'Your wallet is open, so this one needs no passkey.'
                    : 'Your passkey approves it. Payments on Monad can’t be undone.'}
                </p>
              </div>
            ) : null}

            {step === 'sent' && payee && sent ? (
              <div className="w-sheet-sent">
                <div className="w-sheet-cheer">
                  <Art name="kovi-cheer" size={150} />
                  <Art name="sparkle-4" size={26} className="w-spark w-spark-1" />
                  <Art name="sparkle-8" size={30} className="w-spark w-spark-2" />
                  <Art name="sparkle-11" size={20} className="w-spark w-spark-3" />
                </div>
                <h2>Sent</h2>
                <p>
                  {formatUsd(amount)} landed with {first(name)}
                  {theirLocal ? `, about ${theirLocal}` : ''}
                </p>
                <span className="w-sheet-time">
                  <Icon name="bolt" size={16} />
                  Arrived in {(sent.ms / 1000).toFixed(2)} s on Monad
                </span>
                <button type="button" className="pill pill-block" data-tone="ink" onClick={close}>
                  <span className="pill-label">Done</span>
                  <span className="pill-cap">
                    <Icon name="check" size={18} />
                  </span>
                </button>
                <Link href={`/wallet/activity/${sent.hash}`} className="textlink">
                  See receipt
                </Link>
              </div>
            ) : null}

            {step !== 'who' && !payee ? (
              <div className="w-empty">
                <strong>That address doesn’t look right.</strong>
                <span>Ask them for their Kova link, or check the address.</span>
              </div>
            ) : null}
          </div>
        </Fit>
      </div>
    </>
  )
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Holds the sheet at its content's height and animates between heights as the steps change. */
function Fit({ children }: { children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const measure = () => setHeight(el.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div className="w-sheet-fit" style={height === null ? undefined : { height }}>
      <div ref={inner}>{children}</div>
    </div>
  )
}

/** Who to send to: one field for a name, an address or a link; your people one tap away. */
function Who({ onPick }: { onPick: (p: Payee & { amount?: string; note?: string }) => void }) {
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
    if (!s) return setError('That isn’t a Kova link or a wallet address.')
    if (s.kind === 'charge') return router.push(`/wallet/pay/${s.id}`)
    if (s.kind === 'stall') return router.push(`/s/${s.slug}`)
    if (s.kind === 'pair')
      return setError('That code pairs a phone with a shop. Open it in the Kova app.')
    onPick({
      address: getAddress(s.address),
      name: s.name ?? undefined,
      currency: isDisplayCurrency(s.currency ?? null) ? (s.currency as DisplayCurrency) : undefined,
      amount: s.amount ?? undefined,
      note: s.note ?? undefined,
    })
  }

  return (
    <div>
      <h2 className="w-sheet-h">Send to</h2>
      <form
        className="w-find"
        onSubmit={(e) => {
          e.preventDefault()
          const only = matches.length === 1 && !scanned ? matches[0] : undefined
          if (only)
            return onPick({ address: only.address, name: only.name, currency: only.currency })
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
              if (!pasted.trim()) return setError('Nothing to paste. Ask them for their Kova link.')
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
                : 'Monad address, ready to pay'}
            </small>
          </span>
          <Icon name="arrow" size={20} />
        </button>
      ) : null}

      {contacts.length === 0 && !scanned ? (
        <div className="w-empty w-empty-art">
          <Art name="kovi-ride" size={130} className="w-bob" />
          <strong>Send your first payment</strong>
          <span>
            Paste a friend’s Kova link or their Monad address. It lands in about a second, and Kova
            covers the fee.
          </span>
        </div>
      ) : null}

      {!query && contacts.length > 3 ? (
        <div className="w-people w-sheet-people">
          {contacts.slice(0, 8).map((c) => (
            <button
              key={c.address}
              type="button"
              className="w-person"
              onClick={() => onPick({ address: c.address, name: c.name, currency: c.currency })}
            >
              <Avatar name={c.name} id={c.address} size={56} />
              <span>{isUnnamed(c.name) ? c.address.slice(0, 6) : first(c.name)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {matches.length > 0 && !scanned ? (
        <>
          <h3 className="w-section">{query ? `Matches (${matches.length})` : 'Everyone'}</h3>
          <div className="w-list w-sheet-list">
            {matches.map((c) => (
              <button
                key={c.address}
                type="button"
                className="w-list-row"
                onClick={() => onPick({ address: c.address, name: c.name, currency: c.currency })}
              >
                <Avatar name={c.name} id={c.address} size={44} />
                <span className="w-list-text">
                  <strong>{isUnnamed(c.name) ? short(c.address) : c.name}</strong>
                  <small>{story(activity, c.address)}</small>
                </span>
                <Icon name="arrow" size={18} />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

function Fact({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon?: IconName
}) {
  return (
    <div className="w-fact">
      <dt>{label}</dt>
      <dd>
        <span>
          {icon ? <Icon name={icon} size={15} /> : null}
          {value}
        </span>
        {hint ? <small>{hint}</small> : null}
      </dd>
    </div>
  )
}

const FACE = 60
const KOVI = 70
const BASE = 104

/** The curve from your face to theirs, rising over the middle. */
function arc(width: number) {
  const from = { x: FACE / 2 + 4, y: BASE - FACE / 2 - 6 }
  return { from, via: { x: width / 2, y: -10 }, to: { x: width - FACE / 2 - 4, y: from.y } }
}

/**
 * You, Kovi's dotted arc, and them. Kovi hovers at the top while you check; on send he flies the
 * arc, the dots marching under him, and lands on their face, which gets a tick.
 */
function ArcRoute({
  you,
  them,
  leg,
}: {
  you: { name: string; id: string }
  them: { name: string; id: string }
  leg: Leg
}) {
  const box = useRef<HTMLDivElement>(null)
  const kovi = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const t = useRef(0.5)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  const { from, via, to } = arc(width)

  // Places Kovi at `u` along the curve, turned the way he flies.
  const place = useCallback(
    (u: number) => {
      const el = kovi.current
      if (!el || !width) return
      const { from, via, to } = arc(width)
      const a = 1 - u
      const x = a * a * from.x + 2 * a * u * via.x + u * u * to.x
      const y = a * a * from.y + 2 * a * u * via.y + u * u * to.y
      const dx = 2 * a * (via.x - from.x) + 2 * u * (to.x - via.x)
      const dy = 2 * a * (via.y - from.y) + 2 * u * (to.y - via.y)
      const land = Math.max(0, (u - 0.9) / 0.1)
      el.style.opacity = String(1 - land)
      el.style.transform = `translate(${x - KOVI / 2}px, ${y - KOVI / 2}px) rotate(${Math.atan2(dy, dx) * 0.8}rad) scale(${1 - land * 0.6})`
    },
    [width],
  )

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const legs: [number, number, (p: number) => number][] =
      leg === 'flying'
        ? [
            [0.04, 260, (p) => 1 - (1 - p) ** 2],
            [0.82, 1100, (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2)],
          ]
        : leg === 'landed'
          ? [[1, 260, (p) => 1 - (1 - p) ** 3]]
          : [[0.5, 500, (p) => 1 - (1 - p) ** 3]]
    if (reduced) {
      t.current = legs[legs.length - 1]?.[0] ?? 0.5
      place(t.current)
      return
    }
    let frame = 0
    let i = 0
    let began = performance.now()
    let start = t.current
    const step = (now: number) => {
      const current = legs[i]
      if (!current) return
      const [target, duration, ease] = current
      const p = Math.min(1, (now - began) / duration)
      t.current = start + (target - start) * ease(p)
      place(t.current)
      if (p < 1) frame = requestAnimationFrame(step)
      else if (++i < legs.length) {
        began = now
        start = t.current
        frame = requestAnimationFrame(step)
      }
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [leg, place])

  return (
    <div
      ref={box}
      className={`w-arc w-arc-${leg}`}
      aria-label={`From you to ${them.name}`}
      role="img"
    >
      {width ? (
        <svg width={width} height={BASE} className="w-arc-line" aria-hidden="true">
          <path
            d={`M${from.x} ${from.y} Q${via.x} ${via.y} ${to.x} ${to.y}`}
            fill="none"
            stroke="var(--ink)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="0.1 14"
          />
        </svg>
      ) : null}
      <span className="w-arc-face w-arc-you">
        <Avatar name={you.name} id={you.id} size={FACE} />
        <small>You</small>
      </span>
      <span className="w-arc-face w-arc-them">
        <span className="w-arc-them-face">
          <Avatar name={them.name} id={them.id} size={FACE} />
          <span className="w-arc-tick">
            <Icon name="check" size={14} />
          </span>
        </span>
        <small>{first(them.name)}</small>
      </span>
      <div ref={kovi} className="w-arc-kovi">
        <Art name="kovi-ride" size={KOVI} className="w-arc-kovi-art" />
      </div>
    </div>
  )
}

const KNOB = 56
const PAD = 6

/**
 * Slide to send: the one deliberate gesture between a review and money leaving. The track fills
 * coral behind the knob; letting go short of the end springs it home. With a keyboard, the knob
 * is a button: Enter or Space sends.
 */
function SlideToSend({
  label,
  busy,
  disabled,
  onSend,
}: {
  label: string
  busy: boolean
  disabled?: boolean
  onSend: () => void
}) {
  const track = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [nudge, setNudge] = useState(false)
  const drag = useRef<{ start: number; from: number; moved: boolean } | null>(null)
  const max = () => (track.current ? track.current.clientWidth - KNOB - PAD * 2 : 0)

  useEffect(() => {
    const el = track.current
    setX(busy && el ? el.clientWidth - KNOB - PAD * 2 : 0)
  }, [busy])

  const commit = () => {
    setX(max())
    navigator.vibrate?.(20)
    onSend()
  }

  return (
    <div
      ref={track}
      className={`w-slide${disabled ? ' w-slide-off' : ''}${busy ? ' w-slide-busy' : ''}${dragging ? ' w-slide-drag' : ''}`}
    >
      <span className="w-slide-fill" style={{ width: x + KNOB + PAD }} />
      <span
        className="w-slide-words"
        style={{ opacity: busy ? 0 : Math.max(0, 1 - x / (max() * 0.5 || 1)) }}
      >
        {label}
        <span className="w-slide-chevrons" aria-hidden="true">
          <Icon name="chevron" size={16} />
          <Icon name="chevron" size={16} />
          <Icon name="chevron" size={16} />
        </span>
      </span>
      {busy ? <span className="w-slide-words">Sending</span> : null}
      <button
        type="button"
        className={`w-slide-knob${nudge ? ' w-slide-nudge' : ''}`}
        style={{ transform: `translateX(${x}px)` }}
        disabled={disabled || busy}
        aria-label={`${label}. Press Enter to send.`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            commit()
          }
        }}
        onPointerDown={(e) => {
          if (disabled || busy) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { start: e.clientX, from: x, moved: false }
          setDragging(true)
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const dx = e.clientX - drag.current.start
          if (Math.abs(dx) > 4) drag.current.moved = true
          setX(Math.min(max(), Math.max(0, drag.current.from + dx)))
        }}
        onPointerUp={() => {
          const d = drag.current
          drag.current = null
          setDragging(false)
          if (!d) return
          if (x >= max() * 0.86) return commit()
          setX(0)
          // A click instead of a slide: show which way it goes.
          if (!d.moved) {
            setNudge(true)
            setTimeout(() => setNudge(false), 700)
          }
        }}
        onPointerCancel={() => {
          drag.current = null
          setDragging(false)
          setX(0)
        }}
        onClick={(e) => e.preventDefault()}
      >
        {busy ? <span className="w-slide-spin" /> : <Icon name="arrow" size={24} />}
      </button>
    </div>
  )
}
