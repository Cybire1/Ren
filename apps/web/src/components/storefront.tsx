'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { PublicStall } from '@/lib/api'
import { usd } from '@/lib/format'
import { type Currency, inCurrency, RATES } from '@/lib/rates'
import { Awning } from './awning'
import { Art, Icon, LogoMark, Pill } from './brand'
import { ItemFace } from './catalogue-manager'

type Placed = { id: string; checkout: { id: string; amount: string; expires_at: string } }

/**
 * A stall, as a buyer sees it: the sign, what's for sale in their own currency, a basket, and
 * two ways to pay: now, or by sending the link to someone who will.
 */
export function Storefront({ stall, preview }: { stall: PublicStall; preview: boolean }) {
  const router = useRouter()
  const [basket, setBasket] = useState<Record<string, number>>({})
  const [currency, setCurrency] = useState<Currency>('USD')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'pay' | 'ask' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [asked, setAsked] = useState<Placed | null>(null)

  const lines = useMemo(
    () => stall.items.flatMap((item) => (basket[item.id] ? [{ item, quantity: basket[item.id] as number }] : [])),
    [stall.items, basket],
  )
  const count = lines.reduce((n, l) => n + l.quantity, 0)
  const total = lines.reduce((sum, l) => sum + Number(l.item.price) * l.quantity, 0)
  const ordering = stall.open && !preview

  const set = (id: string, quantity: number) => setBasket((b) => ({ ...b, [id]: Math.max(0, Math.min(99, quantity)) }))

  const place = async (payForMe: boolean) => {
    setBusy(payForMe ? 'ask' : 'pay')
    setError(null)
    try {
      const response = await fetch(`/api/stalls/${stall.slug}/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((l) => ({ id: l.item.id, quantity: l.quantity })),
          customer_name: name.trim() || undefined,
          note: note.trim() || undefined,
          pay_for_me: payForMe,
        }),
      })
      const body = (await response.json()) as Placed & { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Could not place the order')
      if (payForMe) setAsked(body)
      else router.push(`/pay/${body.checkout.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place the order')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="shop">
      <Awning height={78} stripe={32} className="shop-awning" tone={stall.open ? 'coral' : 'teal'} />
      <header className="shop-head">
        <h1>{stall.name}</h1>
        {stall.tagline ? <p className="shop-line">{stall.tagline}</p> : null}
        <div className="shop-meta">
          <span className="chip" data-state={stall.open ? 'live' : 'stale'}>
            <span className="dot" />
            {stall.open ? 'Open now' : 'Closed right now'}
          </span>
          {stall.livemode ? null : <span className="chip">Test dollars</span>}
        </div>
      </header>

      {preview ? <p className="shop-preview">Preview. Ordering is switched off here.</p> : null}

      <div className="shop-currency" role="group" aria-label="Show prices in">
        <span>Prices in</span>
        {(Object.keys(RATES) as Currency[]).map((c) => (
          <button key={c} type="button" aria-pressed={currency === c} onClick={() => setCurrency(c)}>
            {RATES[c].symbol.trim()}
          </button>
        ))}
      </div>

      {stall.items.length === 0 ? (
        <div className="shop-empty">
          <Art name="kovi-sleep" size={140} />
          <p>Nothing on the menu yet. Check back soon.</p>
        </div>
      ) : (
        <ul className="shop-items">
          {stall.items.map((item) => {
            const qty = basket[item.id] ?? 0
            return (
              <li key={item.id} className="shop-item" data-soldout={item.sold_out ? 'true' : undefined} data-in={qty ? 'true' : undefined}>
                <ItemFace item={item} size={68} />
                <div className="shop-item-text">
                  <strong>{item.name}</strong>
                  {item.description ? <span className="shop-item-desc">{item.description}</span> : null}
                  <span className="shop-item-price">
                    {usd(item.price)}
                    {currency !== 'USD' ? <em>about {inCurrency(item.price, currency)}</em> : null}
                  </span>
                </div>
                {item.sold_out ? (
                  <span className="chip">Sold out</span>
                ) : qty === 0 ? (
                  <button type="button" className="shop-add" aria-label={`Add ${item.name}`} disabled={!ordering} onClick={() => set(item.id, 1)}>
                    <Icon name="plus" size={20} />
                  </button>
                ) : (
                  <span className="stepper">
                    <button type="button" aria-label={`One less ${item.name}`} onClick={() => set(item.id, qty - 1)}>
                      −
                    </button>
                    <span aria-live="polite">{qty}</span>
                    <button type="button" aria-label={`One more ${item.name}`} onClick={() => set(item.id, qty + 1)}>
                      +
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <footer className="shop-foot">
        <LogoMark size={22} />
        <span>Pay in dollars with Kova or any Monad wallet. No card fees.</span>
      </footer>

      {count > 0 && !open ? (
        <button type="button" className="shop-bar" onClick={() => setOpen(true)}>
          <span className="shop-bar-count">{count}</span>
          <span>View basket</span>
          <strong>{usd(total)}</strong>
        </button>
      ) : null}

      {open ? (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && setOpen(false)}>
          <div className="sheet shop-sheet" role="dialog" aria-modal="true" aria-labelledby="basket-title">
            <button type="button" className="round sheet-close" aria-label="Close" onClick={() => setOpen(false)}>
              <Icon name="close" size={18} />
            </button>
            {asked ? (
              <AskedToPay stall={stall} placed={asked} />
            ) : (
              <>
                <h2 id="basket-title">Your order</h2>
                <ul className="basket">
                  {lines.map((l) => (
                    <li key={l.item.id}>
                      <span className="stepper stepper-sm">
                        <button type="button" aria-label={`One less ${l.item.name}`} onClick={() => set(l.item.id, l.quantity - 1)}>
                          −
                        </button>
                        <span>{l.quantity}</span>
                        <button type="button" aria-label={`One more ${l.item.name}`} onClick={() => set(l.item.id, l.quantity + 1)}>
                          +
                        </button>
                      </span>
                      <span className="basket-name">{l.item.name}</span>
                      <span>{usd(Number(l.item.price) * l.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <p className="basket-total">
                  <span>Total</span>
                  <strong>{usd(total)}</strong>
                </p>
                {currency !== 'USD' ? <p className="field-help basket-approx">About {inCurrency(total, currency)}. You pay in dollars.</p> : null}
                <div className="stack-form">
                  <label className="field-label" htmlFor="buyer-name">
                    Your name <span className="optional">so they know it’s yours</span>
                  </label>
                  <input id="buyer-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Tunde" autoComplete="given-name" />
                  <label className="field-label" htmlFor="buyer-note">
                    A note <span className="optional">optional</span>
                  </label>
                  <input id="buyer-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="No sugar, please" />
                </div>
                {error ? <p className="form-error">{error}</p> : null}
                <div className="basket-pay">
                  <Pill icon="tap" tone="coral" onClick={() => place(false)} disabled={!ordering || busy !== null} wide>
                    {busy === 'pay' ? 'Opening payment' : `Pay ${usd(total)}`}
                  </Pill>
                  <Pill icon="send" tone="light" onClick={() => place(true)} disabled={!ordering || busy !== null} wide>
                    {busy === 'ask' ? 'Making the link' : 'Ask someone else to pay'}
                  </Pill>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** The pay-for-me handoff: a link to send, and the moment it's paid. */
function AskedToPay({ stall, placed }: { stall: PublicStall; placed: Placed }) {
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    setLink(`${window.location.origin}/pay/${placed.checkout.id}`)
    const id = setInterval(async () => {
      const r = await fetch(`/api/checkout/${placed.checkout.id}`).catch(() => null)
      if (!r?.ok) return
      const { status } = (await r.json()) as { status: string }
      if (status === 'paid') {
        setPaid(true)
        clearInterval(id)
      }
    }, 2500)
    return () => clearInterval(id)
  }, [placed.checkout.id])

  if (paid)
    return (
      <div className="asked">
        <Art name="kovi-cheer" size={140} />
        <h2>It’s paid</h2>
        <p className="sheet-lead">Someone paid {usd(placed.checkout.amount)} for your order. {stall.name} has it.</p>
      </div>
    )

  const message = `Can you pay for my order at ${stall.name}? It’s ${usd(placed.checkout.amount)}, paid in dollars with Kova: ${link}`
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator
  return (
    <div className="asked">
      <Art name="kovi-ride" size={130} />
      <h2>Send it to whoever’s paying</h2>
      <p className="sheet-lead">They can pay from anywhere, with Kova Pay or any Monad wallet. The link stays open for 24 hours, and this page updates when it’s paid.</p>
      <div className="field-value">
        <code>{link}</code>
        <button
          type="button"
          className="round"
          aria-label="Copy the payment link"
          onClick={async () => {
            await navigator.clipboard.writeText(link)
            setCopied(true)
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={16} />
        </button>
      </div>
      <div className="basket-pay">
        <Pill href={`https://wa.me/?text=${encodeURIComponent(message)}`} icon="whatsapp" tone="coral" wide>
          Send on WhatsApp
        </Pill>
        {canShare ? (
          <Pill icon="share" tone="light" onClick={() => void navigator.share({ title: stall.name, text: message })} wide>
            Share another way
          </Pill>
        ) : null}
      </div>
      <p className="asked-wait">
        <span className="dot" /> Waiting for their payment
      </p>
    </div>
  )
}
