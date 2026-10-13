'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Icon } from '@/components/brand'
import type { Checkout } from '@/lib/api'

/**
 * Paying a Ren charge in naira, for a customer with no wallet at all (the API's services/naira.ts):
 * card, bank transfer or USSD through Paystack. The shop still gets dollars on Tempo: once Paystack
 * confirms the naira, Ren pays the charge from its treasury with the charge's own memo, and the
 * till turns to paid like any other payment.
 */
export function NairaPay({ checkout }: { checkout: Checkout }) {
  const router = useRouter()
  const [offer, setOffer] = useState<{ naira: string; rate: string; test_mode: boolean } | null>(null)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [returning, setReturning] = useState<string | null>(null)

  useEffect(() => {
    void fetch(`/api/naira/checkout/${checkout.id}/naira`)
      .then((r) => r.json() as Promise<{ enabled: boolean; naira: string; rate: string; test_mode: boolean }>)
      .then((body) => (body.enabled ? setOffer(body) : null))
      .catch(() => {})
  }, [checkout.id])

  // Back from Paystack (its callback carries the reference): check it, and Ren pays the shop.
  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('reference')
    if (!reference?.startsWith('ren_')) return
    setReturning('Checking your payment with Paystack…')
    let tries = 0
    const check = async () => {
      tries++
      const response = await fetch(`/api/naira/checkout/${checkout.id}/naira/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reference }),
      })
      const body = (await response.json().catch(() => ({}))) as { status?: string; failure?: string | null; error?: { message?: string } }
      if (body.status === 'settled') {
        setReturning('Paid. The shop has its dollars.')
        window.history.replaceState(null, '', window.location.pathname)
        router.refresh()
        return
      }
      if (body.status === 'failed') {
        setReturning(null)
        setProblem('Paystack didn’t take the payment. Nothing was charged; try again.')
        return
      }
      if (tries < 20) {
        setReturning(body.status === 'paid' ? 'Paid. Sending the shop its dollars…' : 'Waiting for Paystack to confirm…')
        setTimeout(() => void check(), 2500)
      } else setReturning('Paystack hasn’t confirmed it yet. This page updates when it does.')
    }
    void check()
  }, [checkout.id, router])

  if (!offer && !returning) return null

  const go = async () => {
    setBusy(true)
    setProblem(null)
    try {
      const response = await fetch(`/api/naira/checkout/${checkout.id}/naira`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), return_url: `${window.location.origin}/pay/${checkout.id}` }),
      })
      const body = (await response.json()) as { url?: string; error?: { message?: string } }
      if (!response.ok || !body.url) throw new Error(body.error?.message ?? 'Paystack didn’t open.')
      window.location.assign(body.url)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Paystack didn’t open.')
      setBusy(false)
    }
  }

  return (
    <section className="manual wallet-pay naira-pay" aria-live="polite">
      {returning ? (
        <p className="wallet-status">
          <span className="spinner" aria-hidden="true" /> {returning}
        </p>
      ) : offer ? (
        <ul className="wallet-list">
          <li>
            <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              <span className="wallet-glyph naira-glyph">₦</span>
              <span>
                Pay {offer.naira} in naira
                <small className="wallet-sub">Card, bank transfer or USSD. No wallet needed.</small>
              </span>
              <Icon name={open ? 'chevronDown' : 'arrow'} size={18} />
            </button>
          </li>
        </ul>
      ) : null}
      {open && offer && !returning ? (
        <form
          className="naira-form"
          onSubmit={(e) => {
            e.preventDefault()
            void go()
          }}
        >
          <label>
            <span>Your email, for the receipt</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </label>
          <button type="submit" className="pill pill-block" data-tone="ink" disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim())}>
            <span className="pill-label">{busy ? 'Opening Paystack…' : `Pay ${offer.naira}`}</span>
            <span className="pill-cap">
              <Icon name="arrow" size={18} />
            </span>
          </button>
          <p className="wallet-sub">
            ₦{offer.rate} to the dollar. {checkout.merchant_name} gets {`$${checkout.amount}`} on Tempo.
            {offer.test_mode ? ' Test mode: use Paystack’s test card, nothing real is charged.' : ''}
          </p>
        </form>
      ) : null}
      {problem ? <p className="wallet-problem">{problem}</p> : null}
    </section>
  )
}
