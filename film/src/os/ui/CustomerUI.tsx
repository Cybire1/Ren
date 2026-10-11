/**
 * The customer display, live (1024 × 600). Before payment the buyer watches the order build and
 * sees what to pay, with the tap zone pointing at the reader; once paid, the Kova POS design's
 * Paid moment plays: the ring draws, coins burst, the receipt rises and is stamped.
 */
import { AbsoluteFill } from 'remotion'
import { bounce, CORAL, countUp, font, GREEN, hero, IMG, INK, MUTED, mix, money, Pic, span, SUNKEN, SURFACE, TEAL } from './kit'

const LINES = [
  { qty: 2, name: 'Croissant', total: 6.5 },
  { qty: 2, name: 'Flat white', total: 9.0 },
  { qty: 1, name: 'Cinnamon bun', total: 3.75 },
]

/** Before payment: `shown` lines are on the order (0..3), the total follows them. */
export function CustomerTapUI({ t, shown = 3, total = 19.25 }: { t: number; shown?: number; total?: number }) {
  return (
    <AbsoluteFill style={{ ...font, background: TEAL, flexDirection: 'row' }}>
      <div style={{ width: 400, background: SURFACE, borderRight: `2px solid ${INK}`, padding: '30px 30px 26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 44, height: 44, borderRadius: 22, background: '#EBB3AA', border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>A</span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Ada’s Bakery</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>Your order</div>
          </div>
        </div>
        <div style={{ flex: 1, marginTop: 18 }}>
          {LINES.slice(0, shown).map((l, i) => (
            <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${SUNKEN}`, opacity: i < shown ? 1 : 0 }}>
              <span style={{ width: 30, fontSize: 17, fontWeight: 800 }}>{l.qty}×</span>
              <span style={{ flex: 1, fontSize: 18, fontWeight: 700 }}>{l.name}</span>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{money(l.total)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: GREEN }}>
          <span>Card fees</span>
          <span>$0.00</span>
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative', padding: '40px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>To pay</div>
        <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: -7, lineHeight: 0.95, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{money(total)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 34 }}>
          <span style={{ width: 96, height: 96, borderRadius: 48, background: SURFACE, border: `3px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 + 0.06 * Math.sin(t * 5)})` }}>
            <svg width="56" height="56" viewBox="0 0 40 40" fill="none"><circle cx="11" cy="20" r="3.6" fill={INK} /><path d="M18 11a12 12 0 0 1 0 18M24.5 6a19 19 0 0 1 0 28" stroke={INK} strokeWidth="3.6" strokeLinecap="round" /></svg>
          </span>
          <div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>Tap your card or phone</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#1F3438' }}>on the reader to the right →</div>
          </div>
        </div>
        <div style={{ position: 'absolute', right: -2, top: 150, width: 26, height: 210, borderRadius: '13px 0 0 13px', background: CORAL, border: `2px solid ${INK}`, borderRight: 'none' }} />
      </div>
    </AbsoluteFill>
  )
}

/** The burst behind the tick: fixed, so every frame of every render matches. */
const BITS = [
  [-230, -130, 'coin'], [210, -150, 'dot'], [-250, 40, 'spark'], [240, 60, 'coin'], [-150, 180, 'dot'], [170, 190, 'spark'],
  [-60, -230, 'spark'], [70, -235, 'coin'], [-260, -40, 'dot'], [255, -40, 'dot'], [-30, 230, 'coin'], [120, 230, 'dot'],
  [-200, 150, 'coin'], [200, -230, 'spark'],
] as const

/** After payment: `t` counts from the moment it was paid. */
export function CustomerPaidUI({ t }: { t: number }) {
  const ring = hero(span(t, 0, 0.9))
  const tick = hero(span(t, 0.35, 1.1))
  const kovi = bounce(t, 0.9)
  const receipt = hero(span(t, 0.5, 1.5))
  const stamp = bounce(t, 1.3)
  const words = hero(span(t, 0.4, 1.1))
  const countdown = span(t, 1.5, 6.5)
  return (
    <AbsoluteFill style={{ ...font, background: TEAL }}>
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 30% 46%, rgba(255,255,255,0.55), rgba(255,255,255,0) 46%)' }} />
      <div style={{ position: 'absolute', left: 79, top: 53, width: 420, height: 420 }}>
        {BITS.map(([dx, dy, kind], i) => {
          const p = hero(span(t, 0.35 + (i % 5) * 0.05, 1.95 + (i % 5) * 0.05))
          if (p <= 0 || p >= 1) return null
          const size = kind === 'coin' ? 30 : kind === 'spark' ? 18 : 14
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 210 - size / 2,
                top: 210 - size / 2,
                width: size,
                height: size,
                borderRadius: kind === 'spark' ? 4 : size / 2,
                background: kind === 'coin' ? '#E8C15A' : kind === 'spark' ? CORAL : SURFACE,
                border: `3px solid ${INK}`,
                transform: `translate(${dx * p}px, ${dy * p}px) rotate(${p * (i % 2 ? 1 : -1) * (90 + i * 25)}deg) scale(${mix(0.3, 1, p)})`,
                opacity: p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85,
              }}
            />
          )
        })}
        <svg width="420" height="420" viewBox="0 0 420 420" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="210" cy="210" r="150" fill={SURFACE} stroke={INK} strokeWidth="6" />
          <circle cx="210" cy="210" r="108" fill="none" stroke={CORAL} strokeWidth="22" strokeLinecap="round" transform="rotate(-90 210 210)" strokeDasharray="679" strokeDashoffset={679 * (1 - ring)} />
          <path d="M160 214 L196 248 L264 176" fill="none" stroke={INK} strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="120" strokeDashoffset={120 * (1 - tick)} />
        </svg>
        <Pic src={IMG.koviCheer} style={{ position: 'absolute', left: 268, top: -14, width: 190, height: 190, transform: `scale(${kovi})` }} />
      </div>
      <div style={{ position: 'absolute', left: 92, top: 490, width: 380, textAlign: 'center', opacity: words, transform: `translateY(${(1 - words) * 20}px)` }}>
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>Paid!</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>Thank you for shopping at Ada’s</div>
      </div>
      <div style={{ position: 'absolute', right: 60, top: 26, width: 380, background: '#FBFAF7', border: `3px solid ${INK}`, borderBottom: 'none', borderRadius: '20px 20px 0 0', padding: '20px 26px 26px', boxSizing: 'border-box', boxShadow: '0 30px 60px -24px rgba(11,26,29,0.45)', transform: `translateY(${(1 - receipt) * 110}%) rotate(-2deg)` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Ada’s Bakery</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>Sale #0142 · 9:41</div>
          </div>
          <span style={{ width: 40, height: 40, borderRadius: 20, background: '#EBB3AA', border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>A</span>
        </div>
        <div style={{ borderTop: '3px dashed #B4B9B8', margin: '12px 0 8px' }} />
        {LINES.map((l) => (
          <div key={l.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 16, fontWeight: 700 }}>
            <span>
              {l.qty} × {l.name}
            </span>
            <span>{money(l.total)}</span>
          </div>
        ))}
        <div style={{ borderTop: '3px dashed #B4B9B8', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Total</span>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1.2 }}>$19.25</span>
        </div>
        <div style={{ marginTop: 12, borderRadius: 16, background: '#D4E6E2', padding: '10px 12px', fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>
          Card fees $0.00. Settled in about a second.
          <br />
          <span style={{ color: '#1F5558' }}>Ada keeps the $0.86 a card would have taken.</span>
        </div>
        <div style={{ position: 'absolute', right: 74, top: 16, padding: '4px 12px', border: `4px solid ${CORAL}`, borderRadius: 10, color: CORAL, fontSize: 24, fontWeight: 800, letterSpacing: 3, transform: `scale(${mix(2.4, 1, stamp)}) rotate(-12deg)`, opacity: Math.min(1, stamp * 3) }}>PAID</div>
      </div>
      <div style={{ position: 'absolute', right: 60, bottom: 30, width: 380, display: 'flex', flexDirection: 'column', gap: 12, opacity: hero(span(t, 1.3, 1.8)), transform: `translateY(${(1 - hero(span(t, 1.3, 1.8))) * 20}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 18, background: SURFACE, border: `2px solid ${INK}`, padding: '10px 14px' }}>
          <span style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>Coffee card: 4 of 5</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{ width: 24, height: 24, borderRadius: 12, border: `2px solid ${INK}`, background: i < 4 ? CORAL : SURFACE, transform: `scale(${i === 3 ? bounce(t, 1.6) : 1})` }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {['No thanks', 'Print', 'Text', 'Email'].map((label, i) => (
            <div key={label} style={{ height: 70, borderRadius: 18, border: `2px solid ${INK}`, background: i === 3 ? INK : SURFACE, color: i === 3 ? '#fff' : INK, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {label}
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 22, top: 18, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 700, color: '#1F3438', opacity: words }}>
        <svg width="44" height="44" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(11,26,29,0.15)" strokeWidth="4" />
          <circle cx="22" cy="22" r="20" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" transform="rotate(-90 22 22)" strokeDasharray="126" strokeDashoffset={126 * countdown} />
          <text x="22" y="27" textAnchor="middle" fontFamily="Manrope" fontWeight="800" fontSize="14" fill={INK}>
            {Math.max(1, 5 - Math.floor(countdown * 5))}
          </text>
        </svg>
        Next customer in 5 s
      </div>
    </AbsoluteFill>
  )
}

export { countUp }
