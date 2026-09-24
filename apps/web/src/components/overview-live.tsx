'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Art, Icon, Pill } from '@/components/brand'
import { TerminalRow } from '@/components/terminal-row'
import type { PaymentIntent, Summary, Terminal } from '@/lib/api'
import { ago, usd } from '@/lib/format'
import { DailyChart } from './daily-chart'
import { PairSheet } from './pair-sheet'
import { PaymentRow } from './payment-row'

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

/** The overview, kept live: new payments slide in and the totals follow within a second or two. */
export function OverviewLive({
  initialSummary,
  initialIntents,
  initialTerminals,
  hasWebhook,
}: {
  initialSummary: Summary
  initialIntents: PaymentIntent[]
  initialTerminals: Terminal[]
  hasWebhook: boolean
}) {
  const [summary, setSummary] = useState(initialSummary)
  const [intents, setIntents] = useState(initialIntents)
  const [terminals, setTerminals] = useState(initialTerminals)
  const [connected, setConnected] = useState(true)
  const [pairing, setPairing] = useState(false)
  const seen = useRef(new Set(initialIntents.map((i) => `${i.id}:${i.status}`)))
  const [landed, setLanded] = useState<Set<string>>(new Set())
  const [, setNow] = useState(0)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const response = await fetch('/api/feed')
        if (response.status === 401) return window.location.assign('/signin?expired=1')
        if (!response.ok) throw new Error(String(response.status))
        const data = (await response.json()) as { summary: Summary; intents: PaymentIntent[]; terminals: Terminal[] }
        if (cancelled) return
        const fresh = data.intents.filter((i) => !seen.current.has(`${i.id}:${i.status}`))
        for (const intent of data.intents) seen.current.add(`${intent.id}:${intent.status}`)
        setSummary(data.summary)
        setIntents(data.intents)
        setTerminals(data.terminals)
        setConnected(true)
        if (fresh.length) setLanded(new Set(fresh.map((i) => i.id)))
      } catch {
        if (!cancelled) setConnected(false)
      }
      setNow(Date.now())
    }
    const id = setInterval(tick, 2000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const steps = [
    { done: true, label: 'Open your shop' },
    { done: terminals.length > 0, label: 'Pair a phone as a terminal', action: () => setPairing(true) },
    { done: summary.all_time.count > 0, label: 'Take your first payment', href: '/charge' },
    { done: hasWebhook, label: 'Get payments in your own systems', href: '/dashboard/developers' },
  ]
  const remaining = steps.filter((s) => !s.done).length
  const today = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <>
      <header className="pagehead">
        <div>
          <h1>{greeting()}</h1>
          <p>{today}</p>
        </div>
        <div className="pagehead-actions">
          <span className="chip" data-state={connected ? 'live' : 'stale'}>
            <span className="dot" />
            {connected ? 'Live' : 'Reconnecting'}
          </span>
        </div>
      </header>

      <div className="dash">
        <div className="stack">
          <section className="hero" aria-label="Today">
            <p className="hero-label">Taken today</p>
            <p className="hero-amount">
              {usd(summary.today.total)}
              <small>USDC</small>
            </p>
            <div className="hero-stats">
              <span>
                {summary.today.count} {summary.today.count === 1 ? 'payment' : 'payments'}
              </span>
              <span>{summary.last_paid_at ? `Last ${ago(summary.last_paid_at)}` : 'None yet today'}</span>
              {summary.open_intents > 0 ? <span>{summary.open_intents} waiting</span> : null}
            </div>
            <Art name="kovi-catch" size={160} className="hero-art" priority />
          </section>

          <DailyChart days={summary.daily} />

          <section className="card" aria-label="Recent payments">
            <div className="card-head">
              <h2>Recent payments</h2>
              <Link href="/dashboard/payments" className="textlink small">
                See all
              </Link>
            </div>
            {intents.length === 0 ? (
              <div className="empty">
                <Art name="kovi-wave" size={120} />
                <h3>No payments yet</h3>
                <p>Take your first one from a paired phone, or start a charge right here.</p>
                <Pill href="/charge" icon="tap" tone="coral">
                  Start a charge
                </Pill>
              </div>
            ) : (
              <ul className="rows">
                {intents.map((intent) => (
                  <PaymentRow key={intent.id} intent={intent} fresh={landed.has(intent.id)} />
                ))}
              </ul>
            )}
            <div className="foot">
              <span>All time</span>
              <span>
                {summary.all_time.count} {summary.all_time.count === 1 ? 'payment' : 'payments'}, {usd(summary.all_time.total)}
              </span>
            </div>
          </section>
        </div>

        <aside className="dash-side">
          {remaining > 0 ? (
            <section className="card checklist" aria-label="Getting started">
              <div className="card-head">
                <h2>Get set up</h2>
                <p>
                  {steps.length - remaining} of {steps.length}
                </p>
              </div>
              <div className="progress" aria-hidden="true">
                <span style={{ width: `${((steps.length - remaining) / steps.length) * 100}%` }} />
              </div>
              <ol className="checks">
                {steps.map((step) => (
                  <li key={step.label} data-done={step.done ? 'true' : undefined}>
                    <span className="check-box">{step.done ? <Icon name="check" size={14} /> : null}</span>
                    {step.done ? (
                      <span>{step.label}</span>
                    ) : step.href ? (
                      <Link href={step.href}>{step.label}</Link>
                    ) : (
                      <button type="button" onClick={step.action}>
                        {step.label}
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="card" aria-label="Terminals">
            <div className="card-head">
              <h2>Terminals</h2>
              <Link href="/dashboard/terminals" className="textlink small">
                {terminals.length} {terminals.length === 1 ? 'phone' : 'phones'}
              </Link>
            </div>
            {terminals.length === 0 ? (
              <div className="empty" style={{ paddingTop: '0.25rem' }}>
                <Art name="kovi-wave" size={88} />
                <p>Turn any phone into a till. It pairs with a one-time code; your shop key never leaves this dashboard.</p>
              </div>
            ) : (
              <div>
                {terminals.slice(0, 4).map((t) => (
                  <TerminalRow key={t.id} terminal={t} onRemoved={(id) => setTerminals((list) => list.filter((x) => x.id !== id))} />
                ))}
              </div>
            )}
            <div className="side-cta">
              <Pill icon="plus" tone="light" onClick={() => setPairing(true)} wide>
                Add a terminal
              </Pill>
            </div>
          </section>

          <section className="charge-card">
            <Art name="scene-paid-terminal" size={92} className="charge-card-art" />
            <h2>Charge from this screen</h2>
            <p>Type a price, show the code, and watch it land here.</p>
            <Pill href="/charge" icon="tap" wide>
              New charge
            </Pill>
          </section>
        </aside>
      </div>

      {pairing ? <PairSheet known={terminals.map((t) => t.id)} onPaired={(list) => setTerminals(list)} onClose={() => setPairing(false)} /> : null}
    </>
  )
}
