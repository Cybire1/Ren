/**
 * The Register's Today screen, live (1440 × 900): the day's real numbers from Ada's Bakery on
 * Monad testnet (six sales, $24.25, $2.50 kept), counting up as the screen opens.
 */
import { AbsoluteFill } from 'remotion'
import { bounce, CORAL, countUp, font, GREEN, hero, IMG, INK, MUTED, mix, money, PAPER, Pic, span, SUNKEN, SURFACE, TEAL } from './kit'
import { Rail } from './Rail'

const SOLD = [
  { key: 'cake', name: 'Carrot cake', price: 5 },
  { key: 'latte', name: 'Iced latte', price: 4.75 },
  { key: 'flatwhite', name: 'Flat white', price: 4.5 },
  { key: 'bun', name: 'Cinnamon bun', price: 3.75 },
  { key: 'croissant', name: 'Croissant', price: 3.25 },
  { key: 'baguette', name: 'Baguette', price: 3 },
] as const
const HOURS = ['7a', '8a', '9a', '10a', '11a', '12p', '1p', '2p', '3p', '4p', '5p', '6p']

export function TodayUI({ t }: { t: number }) {
  const taken = 24.25 * countUp(t, 0.3, 1.5)
  const kept = 2.5 * countUp(t, 1.0, 1.2)
  const bar = hero(span(t, 0.9, 1.9))
  const coin = bounce(t, 0.7)
  const chips = [0, 1, 2].map((i) => bounce(t, 1.4 + i * 0.12))
  const sales = Math.round(6 * countUp(t, 0.3, 1.5))
  return (
    <AbsoluteFill style={{ ...font, background: PAPER }}>
      <Rail active="Today" />
      <div style={{ position: 'absolute', left: 136, top: 26 }}>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>Today</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: MUTED, marginTop: 2 }}>Saturday 10 October · Ada’s Bakery</div>
      </div>
      <div style={{ position: 'absolute', right: 32, top: 32, display: 'flex', gap: 14 }}>
        <div style={{ height: 54, padding: '0 24px', borderRadius: 27, border: `2px solid ${INK}`, fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center' }}>Export</div>
        <div style={{ height: 54, padding: '0 24px', borderRadius: 27, background: INK, color: '#fff', fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center' }}>Close the day</div>
      </div>

      <div style={{ position: 'absolute', left: 137, top: 112, width: 760, height: 247, borderRadius: 30, border: `2px solid ${INK}`, background: TEAL, boxSizing: 'border-box', padding: '32px 30px' }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>Taken today</div>
        <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: -6, lineHeight: 1, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{money(taken)}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          {[`${sales} sales`, '$4.04 average', '$0.00 card fees'].map((c, i) => (
            <div key={c} style={{ height: 40, padding: '0 16px', borderRadius: 20, border: `2px solid ${INK}`, background: i === 2 ? INK : SURFACE, color: i === 2 ? '#fff' : INK, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', transform: `scale(${chips[i]})` }}>
              {c}
            </div>
          ))}
        </div>
        <Pic src={IMG.koviCheer} style={{ position: 'absolute', right: 30, top: 18, width: 170, height: 170, objectFit: 'contain', transform: `scale(${coin}) rotate(${mix(-30, 0, coin)}deg) translateY(${-6 * Math.sin(t * 3)}px)` }} />
      </div>

      <div style={{ position: 'absolute', left: 917, top: 112, width: 490, height: 247, borderRadius: 30, border: `2px solid ${INK}`, background: SURFACE, boxSizing: 'border-box', padding: '32px 30px' }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>Kept, not paid in card fees</div>
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -3, color: GREEN, lineHeight: 1, marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>{money(kept)}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: MUTED, lineHeight: 1.45, marginTop: 12 }}>
          What 6 sales would have cost at a typical card rate of 2.9% + 30¢. With Kova, every one settled in about a second for nothing.
        </div>
      </div>

      <div style={{ position: 'absolute', left: 137, top: 379, width: 760, height: 497, borderRadius: 30, border: `2px solid ${INK}`, background: SURFACE, boxSizing: 'border-box', padding: '30px 30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 21, fontWeight: 800 }}>By the hour</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: MUTED }}>Busiest: 12–1 PM, 6 sales</span>
        </div>
        <div style={{ position: 'absolute', left: 30, right: 30, bottom: 62, height: 340, display: 'flex', alignItems: 'flex-end', gap: 10, borderBottom: `2px solid ${INK}` }}>
          {HOURS.map((h) => {
            const busy = h === '12p'
            return (
              <div key={h} style={{ flex: 1, position: 'relative', height: busy ? 340 * bar : 7, background: busy ? CORAL : SUNKEN, border: busy ? `2px solid ${INK}` : 'none', borderBottom: 'none', borderRadius: busy ? '8px 8px 0 0' : 4, boxSizing: 'border-box' }}>
                {busy ? <div style={{ position: 'absolute', top: -26, left: 0, right: 0, textAlign: 'center', fontSize: 15, fontWeight: 800, opacity: bar }}>{Math.round(6 * bar)}</div> : null}
              </div>
            )
          })}
        </div>
        <div style={{ position: 'absolute', left: 30, right: 30, bottom: 28, display: 'flex', gap: 10 }}>
          {HOURS.map((h) => (
            <span key={h} style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: MUTED }}>{h}</span>
          ))}
        </div>
      </div>

      <div style={{ position: 'absolute', left: 917, top: 379, width: 490, height: 497, borderRadius: 30, border: `2px solid ${INK}`, background: SURFACE, boxSizing: 'border-box', padding: '30px 30px' }}>
        <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 10 }}>What sold</div>
        {SOLD.map((s, i) => {
          const a = hero(span(t, 0.5 + i * 0.09, 1.0 + i * 0.09))
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 14, height: 63, borderBottom: `1px solid ${SUNKEN}`, opacity: a, transform: `translateX(${(1 - a) * 40}px)` }}>
              <Pic src={IMG[s.key]} style={{ width: 44, height: 44, borderRadius: 12, border: `2px solid ${INK}`, objectFit: 'cover' }} />
              <span style={{ flex: 1, fontSize: 17, fontWeight: 700 }}>{s.name}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: MUTED, marginRight: 24 }}>1 sold</span>
              <span style={{ fontSize: 17, fontWeight: 800 }}>{money(s.price)}</span>
            </div>
          )
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 13, fontWeight: 600, color: MUTED }}>
          <span>Online 6 · Counter 0</span>
          <span>All paid in AUSD on Monad</span>
        </div>
      </div>
    </AbsoluteFill>
  )
}
