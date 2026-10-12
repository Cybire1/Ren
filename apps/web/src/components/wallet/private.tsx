'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Art, Icon, type IconName } from '@/components/brand'
import { chainName } from '@/lib/chain'
import { applyKey, formatUsd, groupTyped, type Key, toBase } from '@/lib/wallet/money'
import { sessionCovers } from '@/lib/wallet/session'
import { ScreenHead } from './activity'
import type { PrivateEntry } from './private-state'
import { useWallet } from './provider'
import { Fact, Fit, SlideToSend, wait } from './sheet'
import { Avatar, Keypad, when } from './ui'

/**
 * Private dollars (components/wallet/private-state.ts): a balance on a Tempo Zone that Tempo's
 * public explorer can't see. Money at rest is green across Ren and paying is watermelon; private
 * is ink, the colour of the outline everything else is drawn in, with Reni holding the key.
 */

const split = (usd: string) => [usd.slice(1, usd.lastIndexOf('.')), usd.slice(usd.lastIndexOf('.'))]

/** Your private balance on Home: a dark card, so it reads as the place out of sight. */
export function PrivateCard() {
  const { privacy } = useWallet()
  if (!privacy.zone) return null
  const { status, balance } = privacy
  const shown = status === 'ready' && balance !== null
  return (
    <Link
      href="/wallet/private"
      className="w-privcard"
      aria-label={shown ? `Private balance ${formatUsd(balance)}` : 'Private balance, hidden'}
    >
      <span className="w-privcard-lock" aria-hidden="true">
        <Icon name="lock" size={20} />
      </span>
      <span className="w-privcard-text">
        <small>Private</small>
        <strong>{shown ? formatUsd(balance) : status === 'opening' ? 'Opening…' : 'Hidden'}</strong>
        <span>
          {shown
            ? balance === 0n
              ? 'Keep dollars out of sight'
              : 'Only you can see this'
            : status === 'unreachable'
              ? 'The private zone isn’t answering'
              : 'Open with your passkey'}
        </span>
      </span>
      <Art name="reni-key" size={64} className="w-privcard-reni" />
      <span className="w-privcard-go" aria-hidden="true">
        <Icon name="arrow" size={18} />
      </span>
    </Link>
  )
}

/** The private balance's own screen: the balance, the three ways to move it, and its history. */
export function PrivateScreen() {
  const { privacy, profile, network } = useWallet()
  const [problem, setProblem] = useState<string | null>(null)
  if (!profile) return null
  if (!privacy.zone) return <NoZone />
  const { status, balance, entries, zone } = privacy
  const ready = status === 'ready' && balance !== null
  const [whole, cents] = ready ? split(formatUsd(balance)) : ['', '']

  const open = async () => {
    setProblem(null)
    try {
      await privacy.open()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t open.'
      if (!/cancel/i.test(message)) setProblem(message)
    }
  }

  return (
    <div className="w-screen w-private-screen">
      <ScreenHead title="Private" />

      <section
        className="w-private"
        aria-label={ready ? `Private balance ${formatUsd(balance)}` : 'Private balance, hidden'}
      >
        <div className="w-private-top">
          <span className="w-private-label">
            <Icon name="lock" size={16} /> Private balance
          </span>
          {network === 'testnet' ? <span className="w-chip w-chip-ink">Test dollars</span> : null}
        </div>
        {ready ? (
          <p className="w-private-amount">
            <span className="w-balance-sign">$</span>
            <span className="w-balance-whole">{whole}</span>
            <span className="w-balance-cents">{cents}</span>
          </p>
        ) : (
          <div className="w-private-locked">
            <p className="w-private-dots" aria-hidden="true">
              ••••••
            </p>
            <button
              type="button"
              className="pill"
              data-tone="light"
              onClick={() => void open()}
              disabled={status === 'opening'}
            >
              <span className="pill-label">
                {status === 'opening' ? 'Opening…' : 'Show with passkey'}
              </span>
              <span className="pill-cap">
                <Icon name="face" size={18} />
              </span>
            </button>
          </div>
        )}
        <p className="w-private-where">
          In {zone.operator === 'Ren' ? 'Ren’s' : `${zone.operator}’s`} private zone on {chainName}
        </p>
        <Art name="reni-key" size={104} className="w-private-reni" />
      </section>
      {problem ? (
        <p className="w-sheet-problem" role="alert">
          <Icon name="info" size={18} />
          {problem}
        </p>
      ) : null}
      {status === 'unreachable' ? (
        <p className="w-sheet-problem" role="alert">
          <Icon name="info" size={18} />
          The private zone isn’t answering right now. Your dollars are safe there; try again soon.
        </p>
      ) : null}

      <div className="w-private-actions">
        <PrivateAction
          href="/wallet/private/in"
          icon="down"
          label="Move in"
          sub="From your balance"
        />
        <PrivateAction
          href="/wallet/private/send"
          icon="send"
          label="Send privately"
          sub="To anyone"
          tone="coral"
        />
        <PrivateAction
          href="/wallet/private/out"
          icon="up"
          label="Move out"
          sub="Back to your balance"
        />
      </div>

      <section className="w-howpriv" aria-label="What stays private">
        <h2 className="w-section">What stays private</h2>
        <ul>
          <li>
            <span className="w-howpriv-icon">
              <Icon name="eyeOff" size={18} />
            </span>
            <span>
              <strong>Hidden on {chainName}</strong>
              <span>
                Your private balance doesn’t show on {chainName}’s explorer. Only you can see it,
                once your passkey says it’s you.
              </span>
            </span>
          </li>
          <li>
            <span className="w-howpriv-icon">
              <Icon name="lock" size={18} />
            </span>
            <span>
              <strong>Who you pay stays between you</strong>
              <span>
                Dollars you send privately land in their private balance. {chainName} sees dollars
                going into the zone, and how many, but not who they’re for.
              </span>
            </span>
          </li>
          <li>
            <span className="w-howpriv-icon">
              <Icon name="shield" size={18} />
            </span>
            <span>
              <strong>Run by {zone.operator}</strong>
              <span>
                Like a bank, whoever runs the zone can see inside it. Moving in and out shows on{' '}
                {chainName} as an amount.
              </span>
            </span>
          </li>
        </ul>
      </section>

      <div className="w-section-row">
        <h2 className="w-section">Private activity</h2>
      </div>
      {ready ? (
        entries.length ? (
          <div className="w-entries">
            {entries.map((entry) => (
              <PrivateRow key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="w-empty w-empty-art">
            <Art name="reni-key" size={120} className="w-bob" />
            <strong>Nothing private yet</strong>
            <span>Move dollars in, or send someone dollars privately. It lands in seconds.</span>
          </div>
        )
      ) : (
        <p className="w-quiet">Show your private balance to see what moved through it.</p>
      )}
    </div>
  )
}

function PrivateAction({
  href,
  icon,
  label,
  sub,
  tone,
}: {
  href: string
  icon: IconName
  label: string
  sub: string
  tone?: 'coral'
}) {
  return (
    <Link href={href} className={`w-privact${tone ? ` w-privact-${tone}` : ''}`}>
      <span className="w-privact-disc">
        <Icon name={icon} size={18} />
      </span>
      <span className="w-privact-label">{label}</span>
      <span className="w-privact-sub">{sub}</span>
    </Link>
  )
}

/** One line of private history. A private send came from your balance, so it isn't signed. */
function PrivateRow({ entry }: { entry: PrivateEntry }) {
  const signed =
    entry.kind === 'sent'
      ? formatUsd(entry.amount)
      : entry.kind === 'out'
        ? formatUsd(-entry.amount)
        : formatUsd(entry.amount, { sign: true })
  return (
    <div className={`w-entry w-privrow${entry.pending ? ' w-privrow-pending' : ''}`}>
      {entry.kind === 'sent' ? (
        <Avatar name={entry.name} id={entry.name} size={44} />
      ) : (
        <span className="w-lockbadge" aria-hidden="true">
          <Icon
            name={entry.kind === 'out' ? 'up' : entry.kind === 'in' ? 'down' : 'lock'}
            size={18}
          />
        </span>
      )}
      <span className="w-entry-text">
        <span className="w-entry-name">{entry.name}</span>
        <span className="w-entry-sub">
          <Icon name="lock" size={12} />
          {entry.detail}, {when(entry.at)}
        </span>
      </span>
      <span
        className={`w-entry-amount${entry.kind === 'in' || entry.kind === 'arrived' ? ' w-in' : ''}${entry.kind === 'sent' ? ' w-privrow-muted' : ''}`}
      >
        {signed}
      </span>
    </div>
  )
}

/** This site has no private zone: the wallet works the same without one. */
function NoZone() {
  return (
    <div className="w-screen">
      <ScreenHead title="Private" />
      <div className="w-empty w-empty-art">
        <Art name="reni-key" size={130} className="w-bob" />
        <strong>Private dollars aren’t on here yet</strong>
        <span>
          Ren keeps private balances on a Tempo Zone, and this site isn’t connected to one. Your
          wallet works exactly the same without it.
        </span>
        <Link href="/wallet" className="pill" data-tone="ink">
          <span className="pill-label">Back to your wallet</span>
          <span className="pill-cap">
            <Icon name="arrow" size={18} />
          </span>
        </Link>
      </div>
    </div>
  )
}

type Step = 'amount' | 'review' | 'done'

/**
 * Moving dollars between your balance and your private balance, in one sheet over the Private
 * screen: how much, a look at what Tempo will see, slide, done. Moving in lands in a second or two;
 * moving out lands back in your balance once the zone settles its next batch on Tempo.
 */
export function MoveSheet({ direction }: { direction: 'in' | 'out' }) {
  const router = useRouter()
  const { privacy } = useWallet()
  const into = direction === 'in'
  const available = into ? privacy.available : privacy.balance
  const locked = !into && privacy.status !== 'ready'
  const [step, setStep] = useState<Step>('amount')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [took, setTook] = useState<number | null>(null)
  const [closing, setClosing] = useState(false)

  const onKey = useCallback((key: Key) => setTyped((v) => applyKey(v, key, 2)), [])
  const amount = useMemo(() => {
    try {
      return typed && Number(typed) > 0 ? toBase(Number(typed).toFixed(2)) : 0n
    } catch {
      return 0n
    }
  }, [typed])
  const over = available !== null && amount > available

  const close = useCallback(() => {
    if (busy) return
    setClosing(true)
    setTimeout(() => router.push('/wallet/private'), 260)
  }, [busy, router])

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

  const go = async () => {
    setBusy(true)
    setProblem(null)
    const started = Date.now()
    try {
      const moved = into ? await privacy.moveIn(amount) : await privacy.moveOut(amount)
      await wait(Math.max(0, 900 - (Date.now() - started)))
      setTook(moved.ms)
      setStep('done')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t move.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(false)
    }
  }

  const title = into ? 'Move in' : 'Move out'
  const from = into ? 'Your balance' : 'Private balance'
  const to = into ? 'Private balance' : 'Your balance'

  return (
    <>
      <div aria-hidden="true" inert>
        <PrivateScreen />
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
        aria-label={title}
        className={`w-sheet${closing ? ' w-sheet-out' : ''}`}
      >
        <button type="button" className="w-sheet-grab" aria-label="Close" onClick={close} />
        <Fit>
          <div key={locked ? 'locked' : step} className="w-sheet-step">
            {locked ? (
              <div className="w-sheet-sent">
                <div className="w-sheet-cheer">
                  <Art name="reni-key" size={140} />
                </div>
                <h2>Show your private balance first</h2>
                <p>
                  Moving out comes from your private balance, so the zone needs to know it’s you.
                </p>
                <button
                  type="button"
                  className="pill pill-block"
                  data-tone="ink"
                  disabled={privacy.status === 'opening'}
                  onClick={() =>
                    void privacy.open().catch((e: Error) => {
                      if (!/cancel/i.test(e.message)) setProblem(e.message)
                    })
                  }
                >
                  <span className="pill-label">
                    {privacy.status === 'opening' ? 'Opening…' : 'Show with your passkey'}
                  </span>
                  <span className="pill-cap">
                    <Icon name="face" size={18} />
                  </span>
                </button>
                {problem ? <p className="form-error">{problem}</p> : null}
              </div>
            ) : null}

            {!locked && step === 'amount' ? (
              <div className="w-sheet-amount">
                <div className="w-sheet-top">
                  <span
                    className={`w-lockbadge${into ? '' : ' w-lockbadge-out'}`}
                    aria-hidden="true"
                  >
                    <Icon name={into ? 'down' : 'up'} size={20} />
                  </span>
                  <span className="w-sheet-who">
                    <strong>{title}</strong>
                    <small>
                      {from} to {to.toLowerCase()}
                    </small>
                  </span>
                </div>
                <p className="w-typed" aria-live="polite">
                  <span className="w-typed-sign">$</span>
                  {groupTyped(typed)}
                </p>
                <div className="w-sheet-pills">
                  {available !== null ? (
                    <span className={`w-sheet-pill${over ? ' w-sheet-pill-over' : ''}`}>
                      {over
                        ? `${into ? 'You have' : 'Private balance:'} ${formatUsd(available)}`
                        : `${formatUsd(available)} ${into ? 'available' : 'private'}`}
                    </span>
                  ) : null}
                  {available !== null && available > 0n ? (
                    <button
                      type="button"
                      className="w-sheet-pill w-sheet-pill-teal"
                      onClick={() => setTyped((Number(available) / 1e6).toFixed(2))}
                    >
                      All of it
                    </button>
                  ) : null}
                </div>
                <Keypad onKey={onKey} />
                <button
                  type="button"
                  className="pill pill-block"
                  data-tone="ink"
                  disabled={amount === 0n || over}
                  onClick={() => setStep('review')}
                >
                  <span className="pill-label">{over ? 'More than you have' : 'Review'}</span>
                  <span className="pill-cap">
                    <Icon name="arrow" size={18} />
                  </span>
                </button>
              </div>
            ) : null}

            {!locked && step === 'review' ? (
              <div>
                <div className="w-sheet-top">
                  <button
                    type="button"
                    className="round"
                    aria-label="Change the amount"
                    disabled={busy}
                    onClick={() => setStep('amount')}
                  >
                    <Icon name="back" size={20} />
                  </button>
                  <strong className="w-sheet-title">
                    {busy ? (into ? 'Moving in' : 'Moving out') : 'Check and move'}
                  </strong>
                </div>
                <div className="w-movearc" aria-hidden="true">
                  <span className={`w-movearc-end${into ? '' : ' w-movearc-ink'}`}>
                    <Icon name={into ? 'eye' : 'lock'} size={22} />
                    <small>{from}</small>
                  </span>
                  <span className={`w-movearc-path${busy ? ' w-movearc-busy' : ''}`}>
                    <Art name="coin-usd" size={34} className="w-movearc-coin" />
                  </span>
                  <span className={`w-movearc-end${into ? ' w-movearc-ink' : ''}`}>
                    <Icon name={into ? 'lock' : 'eye'} size={22} />
                    <small>{to}</small>
                  </span>
                </div>
                <div className="w-sheet-sum">
                  <strong>{formatUsd(amount)}</strong>
                  <span>
                    {into ? 'Out of sight in a second or two' : 'Back in your balance in seconds'}
                  </span>
                </div>
                <dl className="w-facts">
                  <Fact label="Fee" value={into ? '$0.00, Ren covers it' : '$0.00'} />
                  <Fact
                    label={`${chainName} sees`}
                    value={
                      into ? `${formatUsd(amount)} going in` : `${formatUsd(amount)} coming out`
                    }
                    icon="eye"
                    hint={
                      into ? 'Not what you do with it after' : 'Not what you did with it inside'
                    }
                  />
                </dl>
                {problem ? (
                  <p className="w-sheet-problem" role="alert">
                    <Icon name="info" size={18} />
                    {problem}
                  </p>
                ) : null}
                <SlideToSend
                  label={
                    problem
                      ? 'Slide to try again'
                      : `Slide to move ${formatUsd(amount)} ${into ? 'in' : 'out'}`
                  }
                  busy={busy}
                  busyLabel="Moving"
                  disabled={over || amount === 0n}
                  onSend={() => void go()}
                />
                <p className="w-fine w-center">
                  {sessionCovers(amount)
                    ? 'Your wallet is open, so this one needs no passkey.'
                    : 'Your passkey approves it.'}
                </p>
              </div>
            ) : null}

            {!locked && step === 'done' ? (
              <div className="w-sheet-sent">
                <div className="w-sheet-cheer">
                  <Art name={into ? 'reni-key' : 'reni-cheer'} size={150} />
                  <Art name="sparkle-4" size={26} className="w-spark w-spark-1" />
                  <Art name="sparkle-8" size={30} className="w-spark w-spark-2" />
                </div>
                <h2>{into ? 'Out of sight' : 'On its way back'}</h2>
                <p>
                  {into
                    ? `${formatUsd(amount)} is in your private balance. Only you can see it.`
                    : `${formatUsd(amount)} lands in your balance as soon as the zone settles, in seconds.`}
                </p>
                {took !== null ? (
                  <span className="w-sheet-time">
                    <Icon name="bolt" size={16} />
                    {into ? 'Moved' : 'Requested'} in {(took / 1000).toFixed(2)} s
                  </span>
                ) : null}
                <button type="button" className="pill pill-block" data-tone="ink" onClick={close}>
                  <span className="pill-label">Done</span>
                  <span className="pill-cap">
                    <Icon name="check" size={18} />
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        </Fit>
      </div>
    </>
  )
}
