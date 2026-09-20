'use client'

import { useEffect, useRef, useState } from 'react'
import type { PaymentIntent, Summary } from '@/lib/api'

const statusText: Record<PaymentIntent['status'], string> = {
  paid: 'Settled',
  requires_payment: 'Waiting for payment',
  processing: 'Confirming',
  held: 'Held by the receiving wallet',
  failed: 'Failed',
  canceled: 'Canceled',
  expired: 'Expired',
}

function timeOf(intent: PaymentIntent): string {
  const date = new Date(intent.paid_at ?? intent.created_at)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function agoFrom(iso: string | null): string {
  if (!iso) return 'nothing yet today'
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `last payment ${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `last payment ${minutes} min ago`
  return `last payment ${Math.round(minutes / 60)}h ago`
}

export function Dashboard({
  initialSummary,
  initialIntents,
}: {
  initialSummary: Summary
  initialIntents: PaymentIntent[]
}) {
  const [summary, setSummary] = useState(initialSummary)
  const [intents, setIntents] = useState(initialIntents)
  const [connected, setConnected] = useState(true)
  const seen = useRef(new Set(initialIntents.map((i) => `${i.id}:${i.status}`)))
  const [landed, setLanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const response = await fetch('/api/feed')
        if (!response.ok) throw new Error(String(response.status))
        const data = (await response.json()) as { summary: Summary; intents: PaymentIntent[] }
        if (cancelled) return

        const fresh = data.intents.filter((i) => !seen.current.has(`${i.id}:${i.status}`))
        for (const intent of data.intents) seen.current.add(`${intent.id}:${intent.status}`)
        setSummary(data.summary)
        setIntents(data.intents)
        setConnected(true)
        if (fresh.length) setLanded(new Set(fresh.map((i) => i.id)))
      } catch {
        if (!cancelled) setConnected(false)
      }
    }
    const id = setInterval(tick, 1500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const today = new Date().toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return (
    <>
      <main className="shell">
        <header className="masthead">
          <div className="wordmark">
            Kova <span>Merchant</span>
          </div>
          <span className="live" data-state={connected ? 'live' : 'stale'}>
            {connected ? 'Live' : 'Reconnecting'}
          </span>
        </header>

        <section className="tape" aria-label="Payments">
          <div className="tape-head">
            <h1>{summary.merchant.name}</h1>
            <p className="tape-sub">
              {today}
              {summary.merchant.livemode ? '' : ' · Test mode'}
            </p>
          </div>

          {intents.length === 0 ? (
            <div className="empty">
              <p>
                Nothing here yet. Start a charge and it lands on this tape the moment it settles.
              </p>
              <a className="button" href="/charge">
                Start a charge
              </a>
            </div>
          ) : (
            intents.map((intent) => (
              <article
                key={intent.id}
                className="row"
                data-status={intent.status}
                data-new={landed.has(intent.id) ? 'true' : undefined}
              >
                <span className="row-time mono">{timeOf(intent)}</span>
                <span className={intent.reference ? 'row-ref' : 'row-ref row-ref-none'}>
                  {intent.reference ?? 'No reference'}
                </span>
                <span className="row-amount mono">{intent.amount}</span>
                {intent.status !== 'paid' && (
                  <span className="row-status">{statusText[intent.status]}</span>
                )}
              </article>
            ))
          )}

          <div className="tape-foot">
            <span>{agoFrom(summary.last_paid_at)}</span>
            <span className="mono">
              {summary.all_time.count} all time · {summary.all_time.total}
            </span>
          </div>
        </section>
      </main>

      <div className="totalbar">
        <div className="totalbar-inner">
          <div>
            <p className="totalbar-label">
              Taken today · {summary.today.count}{' '}
              {summary.today.count === 1 ? 'payment' : 'payments'}
            </p>
            <p className="totalbar-amount mono">
              {summary.today.total}
              <span className="totalbar-unit">USDC</span>
            </p>
          </div>
          <a className="button" href="/charge">
            Charge
          </a>
        </div>
      </div>
    </>
  )
}
