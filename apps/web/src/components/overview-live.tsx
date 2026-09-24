'use client'

import { useEffect, useRef, useState } from 'react'
import { Art, Brand, Icon, Pill } from '@/components/brand'
import { TerminalRow } from '@/components/terminal-row'
import type { PaymentIntent, Summary, Terminal } from '@/lib/api'
import { ago, usd } from '@/lib/format'
import { PairSheet } from './pair-sheet'

const statusText: Record<PaymentIntent['status'], string> = {
  paid: 'Paid',
  requires_payment: 'Waiting',
  processing: 'Confirming',
  held: 'Held by their wallet',
  failed: 'Failed',
  canceled: 'Canceled',
  expired: 'Expired',
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function Dashboard({
  initialSummary,
  initialIntents,
  initialTerminals,
}: {
  initialSummary: Summary
  initialIntents: PaymentIntent[]
  initialTerminals: Terminal[]
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
      setNow(Date.now()) // keeps "2 min ago" honest
    }
    const id = setInterval(tick, 1500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const today = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
  const paidToday = summary.today.count

  return (
    <main className="page">
      <header className="topbar">
        <Brand label="Merchant" />
        <div className="topbar-actions">
          <span className="chip" data-state={connected ? 'live' : 'stale'}>
            <span className="dot" />
            {connected ? 'Live' : 'Reconnecting'}
          </span>
        </div>
      </header>

      <div className="dash">
        <div>
          <div className="shopname">
            <Art name="badge-shop" size={64} />
            <div>
              <h1>{summary.merchant.name}</h1>
              <p>
                {today}
                {summary.merchant.livemode ? '' : ', test mode'}
              </p>
            </div>
          </div>

          <section className="hero" aria-label="Today">
            <p className="hero-label">Taken today</p>
            <p className="hero-amount">
              {usd(summary.today.total)}
              <small>USDC</small>
            </p>
            <div className="hero-stats">
              <span>
                {paidToday} {paidToday === 1 ? 'payment' : 'payments'}
              </span>
              <span>{summary.last_paid_at ? `Last ${ago(summary.last_paid_at)}` : 'None yet today'}</span>
              {summary.open_intents > 0 ? <span>{summary.open_intents} waiting</span> : null}
            </div>
            <Art name="kovi-catch" size={160} className="hero-art" />
          </section>

          <section className="card" aria-label="Payments">
            <div className="card-head">
              <h2>Payments</h2>
              <p>Lands here the moment it settles</p>
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
                  <li key={intent.id} className="row" data-status={intent.status} data-new={landed.has(intent.id) ? 'true' : undefined}>
                    <span className="row-icon">
                      <Icon name={intent.status === 'paid' ? 'check' : intent.status === 'requires_payment' || intent.status === 'processing' ? 'tap' : 'close'} size={18} />
                    </span>
                    <span>
                      <span className="row-title" data-none={intent.reference ? undefined : 'true'}>
                        {intent.reference ?? 'Payment'}
                      </span>
                      <span className="row-sub">
                        {statusText[intent.status]}, {clock(intent.paid_at ?? intent.created_at)}
                      </span>
                    </span>
                    <span className="row-amount">{intent.status === 'paid' ? `+${usd(intent.amount)}` : usd(intent.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="foot">
              <span>All time</span>
              <span>
                {summary.all_time.count} payments, {usd(summary.all_time.total)}
              </span>
            </div>
          </section>
        </div>

        <aside className="dash-side">
          <section className="card" aria-label="Terminals">
            <div className="card-head">
              <h2>Terminals</h2>
              <p>
                {terminals.length} {terminals.length === 1 ? 'phone' : 'phones'}
              </p>
            </div>
            {terminals.length === 0 ? (
              <div className="empty" style={{ paddingTop: '0.5rem' }}>
                <Art name="kovi-wave" size={96} />
                <p>Turn any phone into a till. It pairs with a one-time code; your shop key never leaves this dashboard.</p>
              </div>
            ) : (
              <div>
                {terminals.map((t) => (
                  <TerminalRow key={t.id} terminal={t} onRemoved={(id) => setTerminals((list) => list.filter((x) => x.id !== id))} />
                ))}
              </div>
            )}
            <div className="side-cta">
              <Pill icon="plus" tone="light" onClick={() => setPairing(true)}>
                Add a terminal
              </Pill>
            </div>
          </section>

          <section className="charge-card">
            <h2>Charge from this screen</h2>
            <p>Type a price, show the code, and watch it land on the left.</p>
            <Pill href="/charge" icon="tap">
              New charge
            </Pill>
          </section>
        </aside>
      </div>

      {pairing ? (
        <PairSheet
          known={terminals.map((t) => t.id)}
          onPaired={(list) => setTerminals(list)}
          onClose={() => setPairing(false)}
        />
      ) : null}
    </main>
  )
}
