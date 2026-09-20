'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PaymentIntent } from '@/lib/api'

type Stage = 'amount' | 'waiting' | 'paid' | 'problem'

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const

/** Keeps the typed amount valid as you type: at most one dot and two decimals. */
function applyKey(current: string, key: (typeof keys)[number]): string {
  if (key === 'del') return current.slice(0, -1)
  if (key === '.') return current.includes('.') ? current : current === '' ? '0.' : `${current}.`
  const next = current + key
  const [, decimals] = next.split('.')
  if (decimals && decimals.length > 2) return current
  if (next.replace('.', '').length > 9) return current
  return next.startsWith('0') && !next.startsWith('0.') ? next.slice(1) : next
}

export function Charge() {
  const [stage, setStage] = useState<Stage>('amount')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [intent, setIntent] = useState<PaymentIntent | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const value = amount === '' ? '0' : amount
  const canCharge = Number(value) > 0

  const start = useCallback(async () => {
    setError(null)
    try {
      const response = await fetch('/api/charge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: Number(value).toFixed(2),
          reference: reference.trim() || undefined,
        }),
      })
      const body = (await response.json()) as PaymentIntent & { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Could not start the charge')
      setIntent(body)
      setStage('waiting')

      const { toString } = await import('qrcode')
      setQr(
        await toString(`${window.location.origin}/pay/${body.id}`, {
          type: 'svg',
          margin: 0,
          color: { dark: '#0f1512', light: '#fbfcfb' },
        }),
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the charge')
      setStage('problem')
    }
  }, [value, reference])

  // While a charge is open, ask the API what happened to it.
  useEffect(() => {
    if (stage !== 'waiting' || !intent) return
    let cancelled = false
    const id = setInterval(async () => {
      try {
        const response = await fetch(`/api/intent/${intent.id}`)
        if (!response.ok) return
        const latest = (await response.json()) as PaymentIntent
        if (cancelled) return
        setIntent(latest)
        if (latest.status === 'paid') setStage('paid')
        if (['failed', 'expired', 'canceled', 'held'].includes(latest.status)) setStage('problem')
      } catch {
        /* keep waiting: a dropped poll is not a failed payment */
      }
    }, 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [stage, intent])

  if (stage === 'paid' && intent)
    return (
      <main className="shell stage-paid">
        <div className="paid">
          <p className="paid-mark" aria-hidden="true">
            ✓
          </p>
          <p className="paid-amount mono">{intent.amount}</p>
          <p className="paid-label">Paid{intent.reference ? ` · ${intent.reference}` : ''}</p>
          <div className="paid-actions">
            <a className="button" href="/charge">
              Next charge
            </a>
            <a href="/">Back to today</a>
          </div>
        </div>
      </main>
    )

  if (stage === 'waiting' && intent)
    return (
      <main className="shell">
        <header className="masthead">
          <div className="wordmark">
            Kova <span>Charge</span>
          </div>
          <a href="/">Cancel</a>
        </header>
        <section className="await">
          <p className="await-amount mono">{intent.amount}</p>
          <p className="await-label">
            {intent.reference ? `${intent.reference} · ` : ''}Scan to pay
          </p>
          {qr ? (
            // biome-ignore lint/security/noDangerouslySetInnerHtml: locally generated SVG
            <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
          ) : (
            <div className="qr qr-placeholder" />
          )}
          <p className="await-hint">Waiting for payment. This screen updates by itself.</p>
        </section>
      </main>
    )

  if (stage === 'problem')
    return (
      <main className="shell">
        <header className="masthead">
          <div className="wordmark">
            Kova <span>Charge</span>
          </div>
        </header>
        <div className="notice">
          <h2>{error ? 'Could not start the charge' : `Charge ${intent?.status}`}</h2>
          <p>{error ?? 'Start a new charge to try again.'}</p>
        </div>
        <p style={{ marginTop: '1.25rem' }}>
          <a className="button" href="/charge">
            Start again
          </a>
        </p>
      </main>
    )

  return (
    <main className="shell">
      <header className="masthead">
        <div className="wordmark">
          Kova <span>Charge</span>
        </div>
        <a href="/">Cancel</a>
      </header>

      <section className="amount">
        <p className="amount-value mono" data-empty={amount === '' ? 'true' : undefined}>
          {value}
          <span className="amount-unit">USDC</span>
        </p>
        <input
          className="amount-ref"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="What is it for? (optional)"
          maxLength={60}
        />
      </section>

      <div className="keypad">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            className="key"
            onClick={() => setAmount((current) => applyKey(current, key))}
            aria-label={key === 'del' ? 'Delete' : key}
          >
            {key === 'del' ? '⌫' : key}
          </button>
        ))}
      </div>

      <div className="totalbar">
        <div className="totalbar-inner">
          <button
            type="button"
            className="button button-wide"
            disabled={!canCharge}
            onClick={start}
          >
            Charge {canCharge ? Number(value).toFixed(2) : ''}
          </button>
        </div>
      </div>
    </main>
  )
}
