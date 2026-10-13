'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getAddress, isAddress } from 'viem'
import { Art, Icon } from '@/components/brand'
import { chainName, onTempo } from '@/lib/chain'
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
import { useGiverName } from './allowance'
import { Home } from './home'
import { PrivateScreen } from './private'
import { type Contact, isUnnamed, short, useWallet } from './provider'
import { Fact, Fit, SlideToSend, wait } from './sheet'
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
export function SendSheet({ to, privately = false }: { to?: string; privately?: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const { contacts, balance, send, rates, liveRates, profile, noteReaches, privacy, keys } = useWallet()
  const giver = useGiverName()
  // Private: into their private balance on the site's zone. On from Private; a switch from Send.
  const [secret, setSecret] = useState(privately)
  // From an allowance someone gave this wallet (components/wallet/allowance.tsx), or your balance.
  const [from, setFrom] = useState<string | null>(privately ? null : params.get('from'))
  const allowances = keys.held.filter((h) => h.live && h.remaining > 0n)
  const allowance = from ? allowances.find((h) => h.id === from) : undefined

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
  /** Whether they can read a private note: null while asking Ren for their note key. */
  const [reaches, setReaches] = useState<boolean | null>(null)
  const address = payee?.address
  useEffect(() => {
    // Private notes are sealed to a Monad transfer authorization; Tempo's notes stay plain.
    if (!address || onTempo) return
    let live = true
    setReaches(null)
    void noteReaches(address).then((yes) => live && setReaches(yes))
    return () => {
      live = false
    }
  }, [address, noteReaches])

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
  // Sending privately draws on your balance on the zone's Tempo: this same balance, unless the
  // zone hangs off a test chain.
  const spendable = allowance ? allowance.remaining : secret ? privacy.available : balance
  const over = spendable !== null && amount > spendable
  const theirLocal = local ? formatLocal(dollars, local, rates) : null

  const close = useCallback(() => {
    if (busy) return
    setClosing(true)
    setTimeout(() => router.push(privately ? '/wallet/private' : '/wallet'), 260)
  }, [busy, privately, router])

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
      // Privately: a deposit into the private zone, addressed to them (components/wallet/private-state.ts).
      const moved = allowance
        ? await keys.spend(allowance, getAddress(payee.address), amount)
        : secret
          ? await privacy.sendPrivately({ address: payee.address, name }, amount)
          : await send(contact, amount, note)
      // Let Reni finish the leg it is on: the flight is timed to about what the chain takes.
      await wait(Math.max(0, 1360 - (Date.now() - started)))
      setLeg('landed')
      await wait(620)
      setSent({ ms: moved.ms, hash: moved.hash })
      setBusy(false)
      moveTo('sent')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ren couldn’t send it.'
      setLeg('waiting')
      setBusy(false)
      if (!/cancel|not allowed|abort/i.test(message)) setProblem(message)
    }
  }

  const quick = sessionCovers(amount)

  return (
    <>
      <div aria-hidden="true" inert>
        {privately ? <PrivateScreen /> : <Home />}
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
        aria-label={payee ? `Send ${secret ? 'privately ' : ''}to ${name}` : 'Send'}
        className={`w-sheet${closing ? ' w-sheet-out' : ''}`}
      >
        <button type="button" className="w-sheet-grab" aria-label="Close" onClick={close} />
        <Fit>
          <div key={step} className={`w-sheet-step${back ? ' w-sheet-step-back' : ''}`}>
            {step === 'who' ? <Who onPick={pick} privately={secret} /> : null}

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
                    <small>
                      {isUnnamed(name) ? `A ${chainName} address` : short(payee.address)}
                    </small>
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
                  {spendable !== null ? (
                    <span className={`w-sheet-pill${over ? ' w-sheet-pill-over' : ''}`}>
                      {over
                        ? `You have ${formatUsd(spendable)}`
                        : `${formatUsd(spendable)} available`}
                    </span>
                  ) : null}
                </div>
                {allowances.length && !privately ? (
                  <div className="w-from" role="radiogroup" aria-label="Pay from">
                    <span className="w-from-label">From</span>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!allowance}
                      className={`w-from-item${allowance ? '' : ' w-from-on'}`}
                      onClick={() => setFrom(null)}
                    >
                      Your balance
                    </button>
                    {allowances.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        role="radio"
                        aria-checked={allowance?.id === h.id}
                        className={`w-from-item w-from-allow${allowance?.id === h.id ? ' w-from-on' : ''}`}
                        onClick={() => {
                          setFrom(h.id)
                          setSecret(false)
                        }}
                      >
                        <Icon name="user" size={14} /> {giver(h.owner)}’s allowance · {formatUsd(h.remaining)}
                      </button>
                    ))}
                  </div>
                ) : null}
                {privacy.zone && !allowance ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={secret}
                    className={`w-privswitch${secret ? ' w-privswitch-on' : ''}`}
                    onClick={() => setSecret((on) => !on)}
                  >
                    <span className="w-privswitch-icon">
                      <Icon name="lock" size={16} />
                    </span>
                    <span className="w-privswitch-text">
                      <strong>Send privately</strong>
                      <small>
                        {secret
                          ? `Into their private balance. ${chainName} won’t show who it’s for`
                          : `${chainName} shows it as you paying them`}
                      </small>
                    </span>
                    <span className="w-privswitch-track" aria-hidden="true">
                      <span className="w-privswitch-knob" />
                    </span>
                  </button>
                ) : null}
                {secret ? null : onTempo ? (
                  <input
                    className="w-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What’s it for?"
                    maxLength={60}
                    aria-label="What’s it for?"
                  />
                ) : (
                  <label className="w-note w-note-private">
                    <Icon name="lock" size={15} />
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Private note"
                      maxLength={60}
                      aria-label="Private note, only you and them can read it"
                    />
                  </label>
                )}
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
                    {busy
                      ? `Sending to ${first(name)}`
                      : secret
                        ? 'Check and send privately'
                        : 'Check and send'}
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
                  {secret ? (
                    <>
                      <Fact label="Who knows" value={`You and ${first(name)}`} icon="lock" />
                      <Fact
                        label={`${chainName} sees`}
                        value={`${formatUsd(amount)} going in`}
                        icon="eye"
                        hint="Not who it’s for"
                      />
                    </>
                  ) : null}
                  {allowance ? (
                    <Fact
                      label="From"
                      value={`${giver(allowance.owner)}’s allowance`}
                      icon="user"
                      hint={`${formatUsd(allowance.remaining - amount)} left after this`}
                    />
                  ) : null}
                  <Fact label="Fee" value="$0.00, Ren covers it" />
                  <Fact
                    label="Arrives"
                    value={secret ? 'In their private balance, in seconds' : 'In about a second'}
                    icon="bolt"
                  />
                  {local ? (
                    <Fact
                      label="Rate"
                      value={`1 USD ≈ ${rates[local].toLocaleString('en-US', { maximumFractionDigits: 2 })} ${local}`}
                      hint={rateLabel(liveRates)}
                    />
                  ) : null}
                  {note.trim() && onTempo ? <Fact label="For" value={note.trim()} /> : null}
                  {note.trim() && !onTempo ? (
                    <Fact
                      label="Note"
                      value={note.trim()}
                      icon="lock"
                      hint={
                        reaches === null
                          ? 'Sealing…'
                          : reaches
                            ? `Sealed: only you and ${first(name)} can read it`
                            : `Sealed for you; ${first(name)} can’t get private notes yet`
                      }
                    />
                  ) : null}
                </dl>
                {problem ? (
                  <p className="w-sheet-problem" role="alert">
                    <Icon name="info" size={18} />
                    {problem}
                    {/went through/i.test(problem) ? '' : ' Your money hasn’t moved.'}
                  </p>
                ) : null}
                {over ? (
                  <p className="form-error">
                    {allowance
                      ? `The allowance has ${formatUsd(spendable ?? 0n)} left. Send less.`
                      : `You have ${formatUsd(spendable ?? 0n)}. Add money first, or send less.`}
                  </p>
                ) : null}
                <SlideToSend
                  label={
                    problem
                      ? 'Slide to try again'
                      : `Slide to send ${formatUsd(amount)}${secret ? ' privately' : ''}`
                  }
                  busy={busy}
                  disabled={over || amount === 0n}
                  onSend={() => void go()}
                />
                <p className="w-fine w-center">
                  {quick
                    ? 'Your wallet is open, so this one needs no passkey.'
                    : `Your passkey approves it. Payments on ${chainName} can’t be undone.`}
                </p>
              </div>
            ) : null}

            {step === 'sent' && payee && sent ? (
              <div className="w-sheet-sent">
                <div className="w-sheet-cheer">
                  <Art name={secret ? 'reni-key' : 'reni-cheer'} size={150} />
                  <Art name="sparkle-4" size={26} className="w-spark w-spark-1" />
                  <Art name="sparkle-8" size={30} className="w-spark w-spark-2" />
                  <Art name="sparkle-11" size={20} className="w-spark w-spark-3" />
                </div>
                <h2>{secret ? 'Sent privately' : 'Sent'}</h2>
                <p>
                  {secret
                    ? `${formatUsd(amount)} is in ${first(name)}’s private balance. Only the two of you know.`
                    : `${formatUsd(amount)} landed with ${first(name)}${theirLocal ? `, about ${theirLocal}` : ''}${allowance ? `, from ${giver(allowance.owner)}’s allowance` : ''}`}
                </p>
                <span className="w-sheet-time">
                  <Icon name="bolt" size={16} />
                  {secret ? 'Sent' : 'Arrived'} in {(sent.ms / 1000).toFixed(2)} s on {chainName}
                </span>
                <button type="button" className="pill pill-block" data-tone="ink" onClick={close}>
                  <span className="pill-label">Done</span>
                  <span className="pill-cap">
                    <Icon name="check" size={18} />
                  </span>
                </button>
                <Link
                  href={secret ? '/wallet/private' : `/wallet/activity/${sent.hash}`}
                  className="textlink"
                >
                  {secret ? 'See private activity' : 'See receipt'}
                </Link>
              </div>
            ) : null}

            {step !== 'who' && !payee ? (
              <div className="w-empty">
                <strong>That address doesn’t look right.</strong>
                <span>Ask them for their Ren link, or check the address.</span>
              </div>
            ) : null}
          </div>
        </Fit>
      </div>
    </>
  )
}

/** Who to send to: one field for a name, an address or a link; your people one tap away. */
function Who({
  onPick,
  privately = false,
}: {
  onPick: (p: Payee & { amount?: string; note?: string }) => void
  privately?: boolean
}) {
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
      <h2 className="w-sheet-h">
        {privately ? (
          <>
            <Icon name="lock" size={20} /> Send privately to
          </>
        ) : (
          'Send to'
        )}
      </h2>
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
          <Art name="reni-ride" size={130} className="w-bob" />
          <strong>Send your first payment</strong>
          <span>
            Paste a friend’s Ren link or their {chainName} address. It lands in about a second, and
            Ren covers the fee.
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

const FACE = 60
const RENI = 70
const BASE = 104

/** The curve from your face to theirs, rising over the middle. */
function arc(width: number) {
  const from = { x: FACE / 2 + 4, y: BASE - FACE / 2 - 6 }
  return { from, via: { x: width / 2, y: -10 }, to: { x: width - FACE / 2 - 4, y: from.y } }
}

/**
 * You, Reni's dotted arc, and them. Reni hovers at the top while you check; on send it flies the
 * arc, the dots marching under it, and lands on their face, which gets a tick.
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
  const reni = useRef<HTMLDivElement>(null)
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

  // Places Reni at `u` along the curve, turned the way it flies.
  const place = useCallback(
    (u: number) => {
      const el = reni.current
      if (!el || !width) return
      const { from, via, to } = arc(width)
      const a = 1 - u
      const x = a * a * from.x + 2 * a * u * via.x + u * u * to.x
      const y = a * a * from.y + 2 * a * u * via.y + u * u * to.y
      const dx = 2 * a * (via.x - from.x) + 2 * u * (to.x - via.x)
      const dy = 2 * a * (via.y - from.y) + 2 * u * (to.y - via.y)
      const land = Math.max(0, (u - 0.9) / 0.1)
      el.style.opacity = String(1 - land)
      el.style.transform = `translate(${x - RENI / 2}px, ${y - RENI / 2}px) rotate(${Math.atan2(dy, dx) * 0.8}rad) scale(${1 - land * 0.6})`
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
      <div ref={reni} className="w-arc-reni">
        <Art name="reni-ride" size={RENI} className="w-arc-reni-art" />
      </div>
    </div>
  )
}
