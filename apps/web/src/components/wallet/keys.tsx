'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { type Address, getAddress, isAddress } from 'viem'
import { Art, Icon, type IconName } from '@/components/brand'
import { chainName, explorerAddressUrl } from '@/lib/chain'
import { sessionCovers } from '@/lib/wallet/session'
import { ScreenHead } from './activity'
import type { KeyPaymentView, KeyView } from './keys-state'
import { short, useWallet } from './provider'
import { Fact, Fit, SlideToSend, wait } from './sheet'
import { CopyButton, ShareButton } from './ui'

/**
 * Keys (components/wallet/keys-state.ts): everything that can spend this wallet's dollars short of
 * the wallet itself. An AI agent's key, a person's allowance, a card: each has a limit Tempo
 * enforces, renews daily or weekly, ends on a date, and freezes in one tap. Ren's colours: agents
 * are ink like the private balance, people are green like money at rest, and anything waiting on
 * you is watermelon.
 */

const dollars = (value: string | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`
const shortDate = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const ended = (key: KeyView) => key.status === 'expired' || Date.parse(key.expires_at) < Date.now()

const KIND: Record<KeyView['kind'], { icon: IconName; noun: string }> = {
  agent: { icon: 'code', noun: 'Agent' },
  allowance: { icon: 'user', noun: 'Allowance' },
  card: { icon: 'card', noun: 'Card' },
}

function meter(key: KeyView): number {
  if (key.remaining === null) return 0
  const limit = Number(key.limit)
  return limit > 0 ? Math.max(0, Math.min(1, Number(key.remaining) / limit)) : 0
}

/** One line about where a key stands, for its row. */
function standing(key: KeyView): string {
  if (key.status === 'revoked') return 'Removed'
  if (ended(key)) return `Ended ${shortDate(key.expires_at)}`
  if (key.status === 'frozen') return 'Frozen: it can’t spend'
  if (key.status === 'pending')
    return key.kind === 'allowance'
      ? key.holder
        ? `${key.holder_name ?? 'They'} accepted. Switch it on`
        : 'Waiting for them to open your link'
      : 'Not on Tempo yet'
  const left = key.remaining === null ? '' : `${dollars(key.remaining)} left ${key.period === 'week' ? 'this week' : 'today'} · `
  return `${left}until ${shortDate(key.expires_at)}`
}

// ── Home ────────────────────────────────────────────────────────────────────────────────────

/** Keys on Home: a payment an agent is waiting on comes first; otherwise who can spend. */
export function KeysCard() {
  const { keys } = useWallet()
  const waiting = keys.approvals[0]
  if (waiting)
    return (
      <Link href="/wallet/keys" className="w-keyscard w-keyscard-ask">
        <span className="w-keyscard-icon">
          <Icon name="bell" size={20} />
        </span>
        <span className="w-keyscard-text">
          <small>{waiting.key.label ?? 'An agent'} asks</small>
          <strong>Pay {dollars(waiting.amount)}?</strong>
          <span>{waiting.origin ? new URL(waiting.origin).host : (waiting.description ?? short(waiting.to))}</span>
        </span>
        <span className="w-keyscard-go">
          {keys.approvals.length > 1 ? `${keys.approvals.length} waiting` : 'Answer'}
        </span>
      </Link>
    )
  const live = keys.given.filter((k) => k.status === 'active' && !ended(k))
  const agents = live.filter((k) => k.kind === 'agent').length
  const people = live.filter((k) => k.kind === 'allowance').length
  const summary =
    keys.status !== 'ready'
      ? 'For agents and people'
      : agents + people === 0
        ? 'None yet: only your passkey can spend'
        : [agents ? `${agents} agent${agents === 1 ? '' : 's'}` : '', people ? `${people} allowance${people === 1 ? '' : 's'}` : '']
            .filter(Boolean)
            .join(' · ')
  return (
    <Link href="/wallet/keys" className="w-keyscard">
      <span className="w-keyscard-icon w-keyscard-icon-key">
        <Icon name="key" size={20} />
      </span>
      <span className="w-keyscard-text">
        <small>Keys</small>
        <strong>Who can spend</strong>
        <span>{summary}</span>
      </span>
      <span className="w-privcard-go w-keyscard-arrow" aria-hidden="true">
        <Icon name="arrow" size={18} />
      </span>
    </Link>
  )
}

// ── The list ────────────────────────────────────────────────────────────────────────────────

export function KeysScreen() {
  const { keys, profile } = useWallet()
  const [problem, setProblem] = useState<string | null>(null)
  if (!profile) return null

  const signIn = async () => {
    setProblem(null)
    try {
      await keys.signIn()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t open.'
      if (!/cancel/i.test(message)) setProblem(message)
    }
  }

  const live = keys.given.filter((k) => k.status !== 'revoked')
  const removed = keys.given.filter((k) => k.status === 'revoked')

  return (
    <div className="w-screen w-keys-screen">
      <ScreenHead title="Keys" />

      <section className="w-keys-hero">
        <span className="w-private-label">
          <Icon name="key" size={16} /> Who can spend
        </span>
        <h2>Your dollars, your rules</h2>
        <p>
          Give an AI agent or a person a key with its own limit. {chainName} enforces every limit, and
          any key freezes in one tap.
        </p>
        <Art name="reni-key" size={100} className="w-keys-hero-reni" />
      </section>

      {keys.status === 'unavailable' ? (
        <p className="w-sheet-problem" role="alert">
          <Icon name="info" size={18} />
          Keys aren’t switched on for this site yet.
        </p>
      ) : keys.status !== 'ready' ? (
        <div className="w-keys-locked">
          <button
            type="button"
            className="pill pill-block"
            data-tone="ink"
            disabled={keys.status === 'signing-in'}
            onClick={() => void signIn()}
          >
            <span className="pill-label">{keys.status === 'signing-in' ? 'Opening…' : 'Show your keys'}</span>
            <span className="pill-cap">
              <Icon name="face" size={18} />
            </span>
          </button>
          <p className="w-fine w-center">Your passkey signs you in. It moves no money.</p>
          {problem ? <p className="form-error">{problem}</p> : null}
        </div>
      ) : (
        <>
          {keys.approvals.length ? (
            <>
              <h2 className="w-section">Waiting for you</h2>
              <div className="w-asks">
                {keys.approvals.map((payment) => (
                  <Ask key={payment.id} payment={payment} />
                ))}
              </div>
            </>
          ) : null}

          <div className="w-keys-new">
            <NewTile href="/wallet/keys/agent" icon="code" label="New agent key" sub="For Claude or any AI agent" />
            <NewTile href="/wallet/keys/allowance" icon="user" label="Give an allowance" sub="A weekly limit for someone" tone="teal" />
          </div>

          <h2 className="w-section">Your keys</h2>
          <div className="w-entries">
            <div className="w-entry w-keyrow">
              <span className="w-keybadge w-keybadge-you" aria-hidden="true">
                <Icon name="face" size={18} />
              </span>
              <span className="w-entry-text">
                <span className="w-entry-name">Your passkey</span>
                <span className="w-entry-sub">Full access. Only you hold it.</span>
              </span>
              <span className="w-chip w-chip-ink">You</span>
            </div>
            {live.map((key) => (
              <KeyRow key={key.id} keyView={key} />
            ))}
          </div>
          {live.length === 0 ? (
            <p className="w-quiet">Only your passkey can spend this wallet’s dollars right now.</p>
          ) : null}

          {keys.received.length ? (
            <>
              <h2 className="w-section">Given to you</h2>
              <div className="w-entries">
                {keys.received.map((key) => (
                  <KeyRow key={key.id} keyView={key} received />
                ))}
              </div>
            </>
          ) : null}

          {removed.length ? (
            <details className="w-keys-removed">
              <summary>Removed ({removed.length})</summary>
              <div className="w-entries">
                {removed.map((key) => (
                  <KeyRow key={key.id} keyView={key} />
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}

      <section className="w-howpriv" aria-label="How keys work">
        <h2 className="w-section">How keys work</h2>
        <ul>
          <li>
            <span className="w-howpriv-icon">
              <Icon name="shield" size={18} />
            </span>
            <span>
              <strong>{chainName} enforces the limit</strong>
              <span>
                Each key is an access key on your wallet. It can only pay in dollars, up to its limit each
                day or week, until its end date. Not even Ren can raise it.
              </span>
            </span>
          </li>
          <li>
            <span className="w-howpriv-icon">
              <Icon name="bell" size={18} />
            </span>
            <span>
              <strong>Agents ask before big payments</strong>
              <span>
                Ren checks an agent’s rules before it signs: the most a payment can be, and above what it
                waits for your yes.
              </span>
            </span>
          </li>
          <li>
            <span className="w-howpriv-icon">
              <Icon name="lock" size={18} />
            </span>
            <span>
              <strong>Freeze in one tap</strong>
              <span>
                Freezing stops a key at once and sets its limit on {chainName} to zero. Removing it is for
                good.
              </span>
            </span>
          </li>
        </ul>
      </section>
    </div>
  )
}

function NewTile({
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
  tone?: 'teal'
}) {
  return (
    <Link href={href} className={`w-privact w-keynew${tone ? ` w-keynew-${tone}` : ''}`}>
      <span className="w-privact-disc">
        <Icon name={icon} size={18} />
      </span>
      <span className="w-privact-label">{label}</span>
      <span className="w-privact-sub">{sub}</span>
      <span className="w-keynew-plus" aria-hidden="true">
        <Icon name="plus" size={16} />
      </span>
    </Link>
  )
}

function KeyRow({ keyView: key, received }: { keyView: KeyView; received?: boolean }) {
  const kind = KIND[key.kind]
  const off = key.status !== 'active' || ended(key)
  return (
    <Link href={`/wallet/keys/${key.id}`} className={`w-entry w-keyrow${off ? ' w-keyrow-off' : ''}`}>
      <span className={`w-keybadge w-keybadge-${key.kind}`} aria-hidden="true">
        <Icon name={key.status === 'frozen' ? 'lock' : kind.icon} size={18} />
      </span>
      <span className="w-entry-text">
        <span className="w-entry-name">
          {received ? `From ${short(key.owner)}` : key.label}
        </span>
        <span className="w-entry-sub">{standing(key)}</span>
        {key.status === 'active' && !ended(key) && key.remaining !== null ? (
          <span className="w-keymeter" aria-hidden="true">
            <span style={{ width: `${Math.round(meter(key) * 100)}%` }} />
          </span>
        ) : null}
      </span>
      <span className="w-keyrow-end">
        {key.status === 'pending' && key.kind === 'allowance' && key.holder && !received ? (
          <span className="w-chip w-chip-coral">Switch on</span>
        ) : key.status === 'frozen' ? (
          <span className="w-chip w-chip-ink">Frozen</span>
        ) : (
          <span className="w-keyrow-limit">
            {dollars(key.limit)}
            <small>a {key.period}</small>
          </span>
        )}
      </span>
    </Link>
  )
}

/** A payment an agent asked for, over its ask-first line: yes pays it now, within its limits. */
function Ask({ payment }: { payment: KeyPaymentView }) {
  const { keys } = useWallet()
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const answer = async (decision: 'approve' | 'decline') => {
    setBusy(decision)
    setProblem(null)
    try {
      const answered = await keys.answer(payment, decision)
      if (answered.status === 'failed') setProblem(answered.reason ?? 'It didn’t go through.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t go through.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(null)
    }
  }
  const where = payment.origin ? new URL(payment.origin).host : (payment.description ?? short(payment.to))
  return (
    <div className="w-ask">
      <div className="w-ask-top">
        <span className="w-keybadge w-keybadge-agent" aria-hidden="true">
          <Icon name="code" size={18} />
        </span>
        <span className="w-ask-who">
          <strong>{payment.key.label ?? 'Your agent'}</strong>
          <small>wants to pay {where}</small>
        </span>
        <span className="w-ask-amount">{dollars(payment.amount)}</span>
      </div>
      {payment.description && payment.origin ? <p className="w-ask-what">“{payment.description}”</p> : null}
      <div className="w-ask-buttons">
        <button type="button" className="pill" data-tone="light" disabled={busy !== null} onClick={() => void answer('decline')}>
          <span className="pill-label">{busy === 'decline' ? 'Declining…' : 'Decline'}</span>
        </button>
        <button type="button" className="pill" data-tone="ink" disabled={busy !== null} onClick={() => void answer('approve')}>
          <span className="pill-label">{busy === 'approve' ? 'Paying…' : 'Approve'}</span>
          <span className="pill-cap">
            <Icon name="face" size={16} />
          </span>
        </button>
      </div>
      {problem ? <p className="form-error">{problem}</p> : null}
    </div>
  )
}

// ── One key ─────────────────────────────────────────────────────────────────────────────────

export function KeyScreen({ id }: { id: string }) {
  const { keys, profile, network } = useWallet()
  const router = useRouter()
  const key = keys.given.find((k) => k.id === id) ?? keys.received.find((k) => k.id === id)
  const mine = Boolean(key && profile && key.owner.toLowerCase() === profile.address.toLowerCase())
  const [payments, setPayments] = useState<KeyPaymentView[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    if (keys.status === 'signed-out') void keys.signIn().catch(() => {})
  }, [keys])

  useEffect(() => {
    if (!key || !mine) return
    let live = true
    const load = () => void keys.payments(key).then((rows) => live && setPayments(rows)).catch(() => {})
    load()
    const timer = setInterval(load, 8000)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [key, keys, mine])

  if (!profile) return null
  if (!key)
    return (
      <div className="w-screen">
        <ScreenHead title="Key" back="/wallet/keys" />
        <div className="w-empty w-empty-art">
          <Art name="reni-peek" size={120} className="w-bob" />
          <strong>{keys.status === 'ready' ? 'No such key' : 'Opening your keys…'}</strong>
        </div>
      </div>
    )

  const act = async (what: string, run: () => Promise<unknown>) => {
    setBusy(what)
    setProblem(null)
    try {
      await run()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t go through.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(null)
    }
  }

  const kind = KIND[key.kind]
  const live = key.status === 'active' && !ended(key)
  const [whole, cents] = dollars(live ? key.remaining : key.status === 'frozen' ? '0' : key.limit).slice(1).split('.')
  const command = keys.connect
    ? `claude mcp add --transport http ren ${keys.connect.mcp_url} --header "Authorization: Bearer ${token ?? 'YOUR_TOKEN'}"`
    : null

  return (
    <div className="w-screen w-key-screen">
      <ScreenHead title={key.label} back="/wallet/keys" />

      <section className={`w-keyhero w-keyhero-${key.kind}`} aria-label={`${key.label}, ${standing(key)}`}>
        <div className="w-private-top">
          <span className="w-private-label">
            <Icon name={kind.icon} size={16} /> {mine ? kind.noun : `From ${short(key.owner)}`}
          </span>
          <span className={`w-chip ${live ? 'w-chip-teal' : 'w-chip-ink'}`}>
            {key.status === 'revoked' ? 'Removed' : ended(key) ? 'Ended' : key.status === 'frozen' ? 'Frozen' : key.status === 'pending' ? 'Not on yet' : 'Active'}
          </span>
        </div>
        <p className="w-private-amount">
          <span className="w-balance-sign">$</span>
          <span className="w-balance-whole">{whole}</span>
          <span className="w-balance-cents">.{cents}</span>
        </p>
        <p className="w-keyhero-sub">
          {live
            ? `left of ${dollars(key.limit)} ${key.period === 'week' ? 'this week' : 'today'}${key.period_ends_at ? `, renews ${new Date(key.period_ends_at).toDateString() === new Date().toDateString() ? clock(key.period_ends_at) : shortDate(key.period_ends_at)}` : ''}`
            : key.status === 'pending'
              ? `${dollars(key.limit)} a ${key.period}, once it’s on`
              : standing(key)}
        </p>
        {live ? (
          <span className="w-keymeter w-keymeter-hero" aria-hidden="true">
            <span style={{ width: `${Math.round(meter(key) * 100)}%` }} />
          </span>
        ) : null}
        <Art name={key.kind === 'agent' ? 'reni-key' : 'reni-wave'} size={92} className="w-private-reni" />
      </section>

      {problem ? (
        <p className="w-sheet-problem" role="alert">
          <Icon name="info" size={18} />
          {problem}
        </p>
      ) : null}

      {mine && key.kind === 'allowance' && key.status === 'pending' ? (
        key.holder ? (
          <div className="w-keycall">
            <strong>{key.holder_name ?? short(key.holder)} accepted</strong>
            <span>Switch it on and they can spend up to {dollars(key.limit)} a {key.period} from your dollars.</span>
            <button
              type="button"
              className="pill pill-block"
              data-tone="ink"
              disabled={busy !== null}
              onClick={() => void act('on', () => keys.switchOn(key))}
            >
              <span className="pill-label">{busy === 'on' ? 'Switching on…' : 'Switch it on'}</span>
              <span className="pill-cap">
                <Icon name="face" size={18} />
              </span>
            </button>
          </div>
        ) : (
          <div className="w-keycall">
            <strong>Waiting for them</strong>
            <span>
              Once they open your link in Ren, you switch it on here. Lost the link? Remove this one and make
              a new one.
            </span>
          </div>
        )
      ) : null}

      <dl className="w-facts w-keyfacts">
        <Fact label="Limit" value={`${dollars(key.limit)} a ${key.period}`} icon="lock" hint={`${chainName} enforces it`} />
        {key.rules ? (
          <>
            <Fact label="Most per payment" value={dollars(key.rules.per_payment)} />
            <Fact
              label="Asks you above"
              value={Number(key.rules.approve_above) >= Number(key.rules.per_payment) ? 'Never asks' : dollars(key.rules.approve_above)}
            />
            <Fact
              label="May pay"
              value={key.rules.payees === 'anyone' ? 'Anyone' : `${key.rules.payees.length} wallet${key.rules.payees.length === 1 ? '' : 's'} you listed`}
            />
          </>
        ) : null}
        {key.kind === 'allowance' && key.holder ? (
          <Fact label="Held by" value={key.holder_name ? `${key.holder_name} (${short(key.holder)})` : short(key.holder)} />
        ) : null}
        <Fact label="Ends" value={new Date(key.expires_at).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })} />
        {key.key_id ? <Fact label={`Key on ${chainName}`} value={short(key.key_id)} /> : null}
      </dl>
      {key.key_id && key.status !== 'pending' ? (
        <a className="w-keylink" href={explorerAddressUrl(network, key.owner)} target="_blank" rel="noreferrer">
          See the wallet on {chainName}’s explorer <Icon name="external" size={14} />
        </a>
      ) : null}

      {mine && key.kind === 'agent' && key.status !== 'revoked' && key.status !== 'pending' ? (
        <section className="w-connect" aria-label="Connect your agent">
          <h2 className="w-section">Connect your agent</h2>
          <p className="w-quiet">
            Your agent pays through Ren’s MCP server with this key’s token. Ren keeps the key itself; the
            token only lets the agent ask.
          </p>
          {command ? (
            <div className="w-snippet">
              <code>{command}</code>
              {token ? <CopyButton text={command} label="Copy" /> : null}
            </div>
          ) : null}
          {token ? (
            <p className="w-fine">This token is shown once. The old one stopped working.</p>
          ) : (
            <button
              type="button"
              className="pill"
              data-tone="light"
              disabled={busy !== null}
              onClick={() => void act('token', async () => setToken(await keys.newToken(key)))}
            >
              <span className="pill-label">{busy === 'token' ? 'Making…' : 'Make a new token'}</span>
              <span className="pill-cap">
                <Icon name="refresh" size={16} />
              </span>
            </button>
          )}
        </section>
      ) : null}

      {mine && key.status !== 'revoked' && key.status !== 'pending' ? (
        <div className="w-keyactions">
          {key.status === 'frozen' ? (
            <button
              type="button"
              className="pill pill-block"
              data-tone="ink"
              disabled={busy !== null}
              onClick={() => void act('unfreeze', () => keys.unfreeze(key))}
            >
              <span className="pill-label">{busy === 'unfreeze' ? 'Unfreezing…' : 'Unfreeze'}</span>
              <span className="pill-cap">
                <Icon name="bolt" size={18} />
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="pill pill-block"
              data-tone="ink"
              disabled={busy !== null}
              onClick={() => void act('freeze', () => keys.freeze(key))}
            >
              <span className="pill-label">{busy === 'freeze' ? 'Freezing…' : 'Freeze this key'}</span>
              <span className="pill-cap">
                <Icon name="lock" size={18} />
              </span>
            </button>
          )}
          <p className="w-fine w-center">
            {sessionCovers(0n) ? 'Your wallet is open, so this needs no passkey.' : 'Your passkey approves it.'}
          </p>
        </div>
      ) : null}

      {mine && key.status !== 'revoked' ? (
        confirmRemove ? (
          <div className="w-keycall w-keycall-danger">
            <strong>Remove {key.label} for good?</strong>
            <span>It stops at once and {chainName} revokes it. A removed key can’t come back.</span>
            <div className="w-ask-buttons">
              <button type="button" className="pill" data-tone="light" onClick={() => setConfirmRemove(false)}>
                <span className="pill-label">Keep it</span>
              </button>
              <button
                type="button"
                className="pill"
                data-tone="coral"
                disabled={busy !== null}
                onClick={() =>
                  void act('remove', async () => {
                    await keys.remove(key)
                    router.push('/wallet/keys')
                  })
                }
              >
                <span className="pill-label">{busy === 'remove' ? 'Removing…' : 'Remove'}</span>
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="w-textbutton w-textbutton-danger" onClick={() => setConfirmRemove(true)}>
            <Icon name="trash" size={16} /> Remove this key
          </button>
        )
      ) : null}

      {mine && key.kind === 'agent' ? (
        <>
          <h2 className="w-section">What it paid</h2>
          {payments === null ? (
            <p className="w-quiet">Loading…</p>
          ) : payments.length === 0 ? (
            <div className="w-empty w-empty-art">
              <Art name="reni-sleep" size={110} className="w-bob" />
              <strong>Nothing yet</strong>
              <span>Every payment it makes, or asks for, or is refused, shows up here.</span>
            </div>
          ) : (
            <div className="w-entries">
              {payments.map((payment) => (
                <PaymentRow key={payment.id} payment={payment} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

const PAYMENT_STATUS: Record<KeyPaymentView['status'], { label: string; tone: string }> = {
  paid: { label: 'Paid', tone: 'teal' },
  paying: { label: 'Paying', tone: 'ink' },
  approved: { label: 'Approved', tone: 'teal' },
  pending_approval: { label: 'Asks you', tone: 'coral' },
  denied: { label: 'Refused', tone: 'ink' },
  declined: { label: 'Declined', tone: 'ink' },
  failed: { label: 'Didn’t go', tone: 'ink' },
  expired: { label: 'Lapsed', tone: 'ink' },
}

function PaymentRow({ payment }: { payment: KeyPaymentView }) {
  const status = PAYMENT_STATUS[payment.status]
  const where =
    payment.kind === 'mpp' && payment.origin
      ? new URL(payment.origin).host
      : payment.kind === 'charge'
        ? (payment.description ?? 'A Ren shop')
        : short(payment.to)
  const what = payment.kind === 'mpp' ? 'Paid request' : payment.kind === 'charge' ? 'Shop charge' : 'Payment'
  return (
    <div className={`w-entry w-keypay${payment.status === 'paid' ? '' : ' w-keypay-quiet'}`}>
      <span className={`w-keybadge w-keybadge-${payment.kind === 'mpp' ? 'agent' : 'allowance'}`} aria-hidden="true">
        <Icon name={payment.kind === 'mpp' ? 'globe' : payment.kind === 'charge' ? 'stall' : 'send'} size={17} />
      </span>
      <span className="w-entry-text">
        <span className="w-entry-name">{where}</span>
        <span className="w-entry-sub">
          {payment.reason && payment.status !== 'paid' ? payment.reason : `${what}, ${new Date(payment.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
        </span>
      </span>
      <span className="w-keyrow-end">
        <span className="w-entry-amount">{dollars(payment.amount)}</span>
        <span className={`w-chip w-chip-${status.tone}`}>{status.label}</span>
      </span>
    </div>
  )
}

// ── Making keys ─────────────────────────────────────────────────────────────────────────────

/** The sheet both "new" flows open in, over the Keys list. */
function KeySheet({ label, busy, children }: { label: string; busy: boolean; children: ReactNode }) {
  const router = useRouter()
  const [closing, setClosing] = useState(false)
  const close = useCallback(() => {
    if (busy) return
    setClosing(true)
    setTimeout(() => router.push('/wallet/keys'), 260)
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
  return (
    <>
      <div aria-hidden="true" inert>
        <KeysScreen />
      </div>
      <button type="button" tabIndex={-1} aria-label="Close" className={`w-sheet-scrim${closing ? ' w-sheet-out' : ''}`} onClick={close} />
      <div role="dialog" aria-modal="true" aria-label={label} className={`w-sheet${closing ? ' w-sheet-out' : ''}`}>
        <button type="button" className="w-sheet-grab" aria-label="Close" onClick={close} />
        <Fit>{children}</Fit>
      </div>
    </>
  )
}

function Choice<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="w-choice" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={`w-choice-item${option.value === value ? ' w-choice-on' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Money({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return (
    <label className="w-moneyin">
      <span>$</span>
      <input
        inputMode="decimal"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, '').replace(/^(\d*\.\d{0,2}).*$/, '$1'))}
      />
    </label>
  )
}

const amountOk = (value: string) => /^\d{1,5}(\.\d{1,2})?$/.test(value) && Number(value) > 0

type Step = 'setup' | 'review' | 'done'

export function AgentSheet() {
  const { keys } = useWallet()
  const router = useRouter()
  const [step, setStep] = useState<Step>('setup')
  const [label, setLabel] = useState('')
  const [limit, setLimit] = useState('20')
  const [period, setPeriod] = useState<'day' | 'week'>('day')
  const [perPayment, setPerPayment] = useState('5')
  const [approveAbove, setApproveAbove] = useState('1')
  const [days, setDays] = useState(30)
  const [onlyListed, setOnlyListed] = useState(false)
  const [listed, setListed] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [made, setMade] = useState<{ id: string; token: string; ms: number } | null>(null)

  useEffect(() => {
    if (keys.status === 'signed-out') void keys.signIn().catch(() => {})
  }, [keys])

  const payees = useMemo(() => {
    const found = listed.split(/[\s,]+/).filter((a) => isAddress(a)).map((a) => getAddress(a) as Address)
    return [...new Set(found)]
  }, [listed])
  const askNever = Number(approveAbove) >= Number(perPayment)
  const setupProblem = !label.trim()
    ? 'Give it a name'
    : !amountOk(limit) || !amountOk(perPayment)
      ? 'Set its limits'
      : Number(perPayment) > Number(limit)
        ? 'A payment can’t be more than its limit'
        : !(Number(approveAbove) >= 0)
          ? 'Set when it asks you'
          : onlyListed && payees.length === 0
            ? 'Add a wallet it may pay'
            : null

  const go = async () => {
    setBusy(true)
    setProblem(null)
    const started = Date.now()
    try {
      const result = await keys.createAgent({
        label: label.trim(),
        limit,
        period,
        days,
        perPayment,
        approveAbove: askNever ? perPayment : approveAbove,
        payees: onlyListed ? payees : 'anyone',
      })
      await wait(Math.max(0, 900 - (Date.now() - started)))
      setMade({ id: result.key.id, token: result.token, ms: result.ms })
      setStep('done')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t go through.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(false)
    }
  }

  const ends = new Date(Date.now() + days * 86_400_000).toLocaleDateString([], { day: 'numeric', month: 'long' })
  const command =
    made && keys.connect
      ? `claude mcp add --transport http ren ${keys.connect.mcp_url} --header "Authorization: Bearer ${made.token}"`
      : null

  return (
    <KeySheet label="New agent key" busy={busy}>
      <div key={step} className="w-sheet-step">
        {step === 'setup' ? (
          <div className="w-keyform">
            <div className="w-sheet-top">
              <span className="w-keybadge w-keybadge-agent" aria-hidden="true">
                <Icon name="code" size={18} />
              </span>
              <span className="w-sheet-who">
                <strong>New agent key</strong>
                <small>For Claude, or any AI agent that pays</small>
              </span>
            </div>
            <label className="w-field">
              <span>Name</span>
              <input value={label} maxLength={40} placeholder="Research agent" onChange={(e) => setLabel(e.target.value)} />
            </label>
            <div className="w-field">
              <span>It can spend</span>
              <div className="w-field-row">
                <Money value={limit} onChange={setLimit} label="Limit" />
                <Choice
                  label="Renews"
                  value={period}
                  onChange={setPeriod}
                  options={[
                    { value: 'day', label: 'a day' },
                    { value: 'week', label: 'a week' },
                  ]}
                />
              </div>
            </div>
            <div className="w-field">
              <span>Most one payment can be</span>
              <Money value={perPayment} onChange={setPerPayment} label="Most per payment" />
            </div>
            <div className="w-field">
              <span>Ask me first above</span>
              <div className="w-field-row">
                <Money value={askNever ? perPayment : approveAbove} onChange={setApproveAbove} label="Ask above" />
                <Choice
                  label="Asking"
                  value={askNever ? 'never' : 'ask'}
                  onChange={(v) => setApproveAbove(v === 'never' ? perPayment : String(Math.min(1, Number(perPayment))))}
                  options={[
                    { value: 'ask', label: 'Ask' },
                    { value: 'never', label: 'Never ask' },
                  ]}
                />
              </div>
            </div>
            <div className="w-field">
              <span>It lasts</span>
              <Choice
                label="Lasts"
                value={days}
                onChange={setDays}
                options={[
                  { value: 1, label: '1 day' },
                  { value: 7, label: '7 days' },
                  { value: 30, label: '30 days' },
                  { value: 90, label: '90 days' },
                ]}
              />
            </div>
            <div className="w-field">
              <span>It may pay</span>
              <Choice
                label="Payees"
                value={onlyListed ? 'listed' : 'anyone'}
                onChange={(v) => setOnlyListed(v === 'listed')}
                options={[
                  { value: 'anyone', label: 'Anyone' },
                  { value: 'listed', label: 'Only wallets I list' },
                ]}
              />
              {onlyListed ? (
                <textarea
                  className="w-field-area"
                  rows={3}
                  placeholder="0x… one wallet a line"
                  value={listed}
                  onChange={(e) => setListed(e.target.value)}
                />
              ) : null}
            </div>
            <button type="button" className="pill pill-block" data-tone="ink" disabled={Boolean(setupProblem)} onClick={() => setStep('review')}>
              <span className="pill-label">{setupProblem ?? 'Review'}</span>
              <span className="pill-cap">
                <Icon name="arrow" size={18} />
              </span>
            </button>
          </div>
        ) : null}

        {step === 'review' ? (
          <div>
            <div className="w-sheet-top">
              <button type="button" className="round" aria-label="Change it" disabled={busy} onClick={() => setStep('setup')}>
                <Icon name="back" size={20} />
              </button>
              <strong className="w-sheet-title">{busy ? 'Making the key' : 'Check and create'}</strong>
            </div>
            <div className="w-sheet-sum">
              <strong>{label.trim()}</strong>
              <span>
                Up to {dollars(limit)} a {period}, until {ends}
              </span>
            </div>
            <dl className="w-facts">
              <Fact label={`${chainName} enforces`} value={`${dollars(limit)} a ${period}, dollars only`} icon="lock" hint={`Ends ${ends}. Not even Ren can raise it.`} />
              <Fact label="Ren checks" value={`${dollars(perPayment)} a payment at most`} hint={askNever ? 'Never asks you first' : `Asks you above ${dollars(approveAbove)}`} />
              <Fact label="May pay" value={onlyListed ? `${payees.length} wallet${payees.length === 1 ? '' : 's'}` : 'Anyone'} />
              <Fact label="Fee" value="$0.00, Ren covers it" />
            </dl>
            {problem ? (
              <p className="w-sheet-problem" role="alert">
                <Icon name="info" size={18} />
                {problem}
              </p>
            ) : null}
            <SlideToSend label={problem ? 'Slide to try again' : 'Slide to create the key'} busy={busy} busyLabel="Creating" onSend={() => void go()} />
            <p className="w-fine w-center">
              {sessionCovers(0n) ? 'Your wallet is open, so this one needs no passkey.' : 'Your passkey approves it.'}
            </p>
          </div>
        ) : null}

        {step === 'done' && made ? (
          <div className="w-sheet-sent w-keydone">
            <div className="w-sheet-cheer">
              <Art name="reni-key" size={130} />
              <Art name="sparkle-4" size={26} className="w-spark w-spark-1" />
              <Art name="sparkle-8" size={30} className="w-spark w-spark-2" />
            </div>
            <h2>{label.trim()} is ready</h2>
            <p>Its key is on {chainName}. Give your agent this token: it’s shown once, so copy it now.</p>
            <div className="w-snippet w-snippet-token">
              <code>{made.token}</code>
              <CopyButton text={made.token} label="Copy" />
            </div>
            {command ? (
              <>
                <p className="w-fine">Connect Claude Code in one line:</p>
                <div className="w-snippet">
                  <code>{command}</code>
                  <CopyButton text={command} label="Copy" />
                </div>
              </>
            ) : null}
            <span className="w-sheet-time">
              <Icon name="bolt" size={16} />
              On {chainName} in {(made.ms / 1000).toFixed(2)} s
            </span>
            <button type="button" className="pill pill-block" data-tone="ink" onClick={() => router.push(`/wallet/keys/${made.id}`)}>
              <span className="pill-label">Done</span>
              <span className="pill-cap">
                <Icon name="check" size={18} />
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </KeySheet>
  )
}

export function AllowanceSheet() {
  const { keys, profile } = useWallet()
  const router = useRouter()
  const [step, setStep] = useState<Step>('setup')
  const [label, setLabel] = useState('')
  const [limit, setLimit] = useState('30')
  const [period, setPeriod] = useState<'day' | 'week'>('week')
  const [days, setDays] = useState(30)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [made, setMade] = useState<{ id: string; link: string } | null>(null)

  useEffect(() => {
    if (keys.status === 'signed-out') void keys.signIn().catch(() => {})
  }, [keys])

  const setupProblem = !label.trim() ? 'Say who it’s for' : !amountOk(limit) ? 'Set how much' : null
  const go = async () => {
    setBusy(true)
    setProblem(null)
    try {
      const result = await keys.createAllowance({ label: label.trim(), limit, period, days })
      setMade({ id: result.key.id, link: result.link })
      setStep('done')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t go through.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(false)
    }
  }
  const ends = new Date(Date.now() + days * 86_400_000).toLocaleDateString([], { day: 'numeric', month: 'long' })
  const from = profile?.name && !profile.name.startsWith('0x') ? profile.name : 'Someone'

  return (
    <KeySheet label="Give an allowance" busy={busy}>
      <div key={step} className="w-sheet-step">
        {step === 'setup' ? (
          <div className="w-keyform">
            <div className="w-sheet-top">
              <span className="w-keybadge w-keybadge-allowance" aria-hidden="true">
                <Icon name="user" size={18} />
              </span>
              <span className="w-sheet-who">
                <strong>Give an allowance</strong>
                <small>They spend from your dollars, up to a limit</small>
              </span>
            </div>
            <label className="w-field">
              <span>Who it’s for</span>
              <input value={label} maxLength={40} placeholder="Mum" onChange={(e) => setLabel(e.target.value)} />
            </label>
            <div className="w-field">
              <span>They can spend</span>
              <div className="w-field-row">
                <Money value={limit} onChange={setLimit} label="Limit" />
                <Choice
                  label="Renews"
                  value={period}
                  onChange={setPeriod}
                  options={[
                    { value: 'week', label: 'a week' },
                    { value: 'day', label: 'a day' },
                  ]}
                />
              </div>
            </div>
            <div className="w-field">
              <span>For</span>
              <Choice
                label="Lasts"
                value={days}
                onChange={setDays}
                options={[
                  { value: 7, label: '7 days' },
                  { value: 30, label: '30 days' },
                  { value: 90, label: '90 days' },
                ]}
              />
            </div>
            <button type="button" className="pill pill-block" data-tone="ink" disabled={Boolean(setupProblem)} onClick={() => setStep('review')}>
              <span className="pill-label">{setupProblem ?? 'Review'}</span>
              <span className="pill-cap">
                <Icon name="arrow" size={18} />
              </span>
            </button>
          </div>
        ) : null}

        {step === 'review' ? (
          <div>
            <div className="w-sheet-top">
              <button type="button" className="round" aria-label="Change it" disabled={busy} onClick={() => setStep('setup')}>
                <Icon name="back" size={20} />
              </button>
              <strong className="w-sheet-title">Check and make the link</strong>
            </div>
            <div className="w-sheet-sum">
              <strong>
                {dollars(limit)} a {period}
              </strong>
              <span>
                For {label.trim()}, until {ends}
              </span>
            </div>
            <dl className="w-facts">
              <Fact label="How" value="A link you send them" hint="They open it in Ren and accept on their phone" />
              <Fact label="Then" value="You switch it on" hint="With your passkey, once they’ve accepted" />
              <Fact label={`${chainName} enforces`} value={`${dollars(limit)} a ${period}, dollars only`} icon="lock" />
            </dl>
            {problem ? (
              <p className="w-sheet-problem" role="alert">
                <Icon name="info" size={18} />
                {problem}
              </p>
            ) : null}
            <SlideToSend label="Slide to make the link" busy={busy} busyLabel="Making" onSend={() => void go()} />
          </div>
        ) : null}

        {step === 'done' && made ? (
          <div className="w-sheet-sent">
            <div className="w-sheet-cheer">
              <Art name="reni-wave" size={130} />
            </div>
            <h2>Send it to {label.trim()}</h2>
            <p>
              When they open it in Ren and accept, you’ll switch it on here. The link works once, for seven
              days.
            </p>
            <ShareButton
              title="An allowance on Ren"
              text={`${from} gave you an allowance on Ren: ${dollars(limit)} a ${period}. Open this to accept it:`}
              url={made.link}
              label="Send the link"
            />
            <div className="w-snippet">
              <code>{made.link}</code>
              <CopyButton text={made.link} label="Copy" />
            </div>
            <button type="button" className="w-textbutton" onClick={() => router.push(`/wallet/keys/${made.id}`)}>
              Done
            </button>
          </div>
        ) : null}
      </div>
    </KeySheet>
  )
}
