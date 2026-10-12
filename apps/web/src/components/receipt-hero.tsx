'use client'

import { useEffect, useState } from 'react'
import { Art, type ArtName, Icon, LogoMark } from './brand'
import { chainName } from '@/lib/chain'

type Currency = 'gbp' | 'eur'

interface Receipt {
  shop: string
  where: string
  at: string
  items: [string, string][]
  total: string
  saw: string
  from: string
  coin: Currency
}

/** Three sales, three cities, three currencies, at the app's reference rates; everything settles in dollars. */
const RECEIPTS: Receipt[] = [
  {
    shop: 'Ada’s Bakery',
    where: 'Singapore',
    at: 'Thursday 3:12 pm',
    items: [
      ['2 × Flat white', '$9.00'],
      ['Almond croissant', '$3.50'],
    ],
    total: '$12.50',
    saw: '£9.88',
    from: 'London',
    coin: 'gbp',
  },
  {
    shop: 'Night Owl Records',
    where: 'Brooklyn',
    at: 'Friday 7:48 pm',
    items: [
      ['Used vinyl, jazz', '$18.00'],
      ['Tote bag', '$6.00'],
    ],
    total: '$24.00',
    saw: '€22.08',
    from: 'Lisbon',
    coin: 'eur',
  },
  {
    shop: 'Luz Taquería',
    where: 'Mexico City',
    at: 'Saturday 1:05 pm',
    items: [
      ['Tacos al pastor × 3', '$6.50'],
      ['Agua de jamaica', '$1.50'],
    ],
    total: '$8.00',
    saw: '£6.32',
    from: 'Manchester',
    coin: 'gbp',
  },
]

type Phase = 'charge' | 'print' | 'stamp' | 'reni' | 'tear'

/** When each phase starts, in ms from the start of a receipt. */
const TIMELINE: [Phase, number][] = [
  ['print', 1100],
  ['stamp', 3200],
  ['reni', 3600],
  ['tear', 7600],
]
const CYCLE = 8200

const COINS: { name: ArtName; currency: Currency | 'usd'; className: string }[] = [
  { name: 'coin-eur', currency: 'eur', className: 'rh-coin rh-coin-eur' },
  { name: 'coin-gbp', currency: 'gbp', className: 'rh-coin rh-coin-gbp' },
  { name: 'coin-usd', currency: 'usd', className: 'rh-coin rh-coin-usd' },
]

/**
 * The hero's live demo: a Kova terminal takes a payment and prints the receipt, line by line.
 * The stamp lands, Reni hops on, the receipt tears off and the next sale begins, somewhere
 * else in the world. It pauses on request, and rests on a finished receipt for anyone who
 * prefers less motion.
 */
export function ReceiptHero() {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('reni')
  const [paused, setPaused] = useState(false)
  const [still, setStill] = useState(true)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setStill(reduce.matches)
    update()
    reduce.addEventListener('change', update)
    return () => reduce.removeEventListener('change', update)
  }, [])

  // One receipt: run its timeline, then move on to the next.
  useEffect(() => {
    if (still || paused) return
    setPhase('charge')
    const timers = TIMELINE.map(([next, at]) =>
      setTimeout(() => {
        setPhase(next)
        if (next === 'stamp') window.dispatchEvent(new Event('kova:stamp'))
      }, at),
    )
    timers.push(setTimeout(() => setIndex((i) => (i + 1) % RECEIPTS.length), CYCLE))
    return () => timers.forEach(clearTimeout)
  }, [index, paused, still])

  const r = RECEIPTS[index] as Receipt
  const paid = phase !== 'charge'

  return (
    <div className="rh" data-phase={phase} data-paused={paused ? 'true' : undefined}>
      <div
        className="rh-art"
        role="img"
        aria-label={`A Ren terminal at ${r.shop} in ${r.where} taking ${r.total}, paid from ${r.from}, and printing the receipt`}
      >
        {COINS.map((c) => (
          <Art
            key={c.name}
            name={c.name}
            size={72}
            className={`${c.className}${c.currency === r.coin && (phase === 'stamp' || phase === 'reni') ? ' is-hopping' : ''}`}
            priority
          />
        ))}

        <div className="rh-feed">
          <div className="rh-paper" key={index}>
            <svg
              className="rh-teeth"
              viewBox="0 0 360 15"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M0 15 L12 3 L24 15 L36 3 L48 15 L60 3 L72 15 L84 3 L96 15 L108 3 L120 15 L132 3 L144 15 L156 3 L168 15 L180 3 L192 15 L204 3 L216 15 L228 3 L240 15 L252 3 L264 15 L276 3 L288 15 L300 3 L312 15 L324 3 L336 15 L348 3 L360 15"
                style={{ fill: 'var(--card)', stroke: 'var(--ink)' }}
                strokeWidth="2"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <Art name="reni-cheer" size={140} className="rh-reni" priority />

            <div className="rh-head">
              <LogoMark size={30} />
              <p className="rh-shop">{r.shop}</p>
              <p className="rh-meta">
                {r.where}, {r.at}
              </p>
            </div>
            <div className="rh-rule" />
            <div className="rh-items">
              {r.items.map(([what, price]) => (
                <p key={what}>
                  <span>{what}</span>
                  <span>{price}</span>
                </p>
              ))}
            </div>
            <div className="rh-rule" />
            <p className="rh-total">
              <span>Total</span>
              <strong>{r.total}</strong>
            </p>
            <dl className="rh-facts">
              <div>
                <dt>Paid with</dt>
                <dd>Ren Pay and Face ID</dd>
              </div>
              <div>
                <dt>Customer saw</dt>
                <dd>
                  {r.saw}, in {r.from}
                </dd>
              </div>
              <div>
                <dt>Settled</dt>
                <dd>On {chainName}, about a second</dd>
              </div>
              <div>
                <dt>Card fees</dt>
                <dd>$0.00</dd>
              </div>
            </dl>
            <p className="rh-memo">memo 0x4b4f5641 0101 … 3796 dcd2 fbd</p>

            <svg className="rh-stamp" viewBox="0 0 128 128" aria-hidden="true">
              <defs>
                <path id="rh-ring" d="M64 64 m-41 0 a41 41 0 1 1 82 0 a41 41 0 1 1 -82 0" />
              </defs>
              <circle cx="64" cy="64" r="61" style={{ fill: 'var(--coral)', stroke: 'var(--ink)' }} strokeWidth="3" />
              <circle
                cx="64"
                cy="64"
                r="51"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                strokeDasharray="4 5"
              />
              <text fontSize="9.5" fontWeight="800" style={{ fill: 'var(--ink)' }} letterSpacing="1.4">
                <textPath href="#rh-ring" textLength="252" lengthAdjust="spacing">
                  {`SETTLED ON ${chainName.toUpperCase()} • SETTLED ON ${chainName.toUpperCase()} •`}
                </textPath>
              </text>
              <text
                x="64"
                y="73"
                textAnchor="middle"
                fontSize="26"
                fontWeight="800"
                fill="#ffffff"
                letterSpacing="1.5"
              >
                PAID
              </text>
            </svg>
          </div>
        </div>

        <div className="rh-terminal">
          <span className="rh-ledge" />
          <div className="rh-screen" data-paid={paid ? 'true' : undefined}>
            <span className="rh-screen-shop">{r.shop}</span>
            <span className="rh-screen-amount">{r.total}</span>
            <span className="rh-screen-status">
              {paid ? (
                <>
                  <Icon name="check" size={16} /> Paid
                </>
              ) : (
                <>
                  <span className="rh-waves" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  Tap or scan to pay
                </>
              )}
            </span>
          </div>
          <div className="rh-keys" aria-hidden="true">
            <span>1</span>
            <span>2</span>
            <span>3</span>
          </div>
        </div>
      </div>

      {still ? null : (
        <button
          type="button"
          className="rh-pause"
          aria-label={paused ? 'Play the demo' : 'Pause the demo'}
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13l10.5-6.5z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6.5" y="5" width="4" height="14" rx="1.2" />
              <rect x="13.5" y="5" width="4" height="14" rx="1.2" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}

/** The coin after "Paid" in the headline. It thumps each time a receipt is stamped. */
export function PaidCoin() {
  const [beat, setBeat] = useState(0)
  useEffect(() => {
    const onStamp = () => setBeat((n) => n + 1)
    window.addEventListener('kova:stamp', onStamp)
    return () => window.removeEventListener('kova:stamp', onStamp)
  }, [])
  return (
    <span
      key={beat}
      className={`lp-coin lp-coin-paid${beat ? ' is-beating' : ''}`}
      aria-hidden="true"
    />
  )
}
