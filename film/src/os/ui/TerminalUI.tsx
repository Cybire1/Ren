/**
 * The handheld Kova Terminal's screens, live (412 × 824, the 3D model's screen is 1:2). Sell taps
 * three things into a sale on the shop floor; Paid draws the ring, counts the proof and prints.
 */
import { AbsoluteFill } from 'remotion'
import { BEAT, bounce, CORAL, countUp, Finger, font, GREEN, hero, IMG, INK, MUTED, mix, money, PAPER, Pic, span, SURFACE, tapAt, TEAL } from './kit'

const TILES = [
  { key: 'croissant', name: 'Croissant', price: 3.25 },
  { key: 'flatwhite', name: 'Flat white', price: 4.5 },
  { key: 'bun', name: 'Cinnamon bun', price: 3.75, tag: '2 left' },
  { key: 'cake', name: 'Carrot cake', price: 5 },
  { key: 'loaf', name: 'Sourdough loaf', price: 6.5 },
  { key: 'cookie', name: 'Cookie', price: 2.5, tag: 'Sold out' },
] as const

export const TERMINAL_TAPS: Record<string, number[]> = { croissant: [BEAT, 2 * BEAT], flatwhite: [3 * BEAT, 4 * BEAT], bun: [5 * BEAT] }
export const TERMINAL_CHARGE = 6 * BEAT
const box = (i: number) => ({ x: 20 + (i % 2) * 192, y: 135 + Math.floor(i / 2) * 157, w: 180, h: 145 })
const qtyAt = (t: number, key: string) => (TERMINAL_TAPS[key] ?? []).filter((a) => t >= a + 2 / 30).length
const totalAt = (t: number) => TILES.reduce((s, x) => s + x.price * qtyAt(t, x.key), 0)

export function TerminalSellUI({ t }: { t: number }) {
  const all = Object.values(TERMINAL_TAPS).flat().sort((a, b) => a - b)
  const last = all.filter((a) => t >= a).pop()
  const shown = last === undefined ? 0 : mix(totalAt(last - 0.01), totalAt(t), countUp(t, last + 2 / 30, 0.4))
  const items = TILES.reduce((n, x) => n + qtyAt(t, x.key), 0)
  const names = TILES.filter((x) => qtyAt(t, x.key)).map((x) => x.name)
  const charge = tapAt(t, TERMINAL_CHARGE)
  return (
    <AbsoluteFill style={{ ...font, background: PAPER }}>
      <div style={{ position: 'absolute', left: 20, top: 22, right: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 46, height: 46, borderRadius: 23, background: '#EBB3AA', border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>A</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 21, fontWeight: 800 }}>Sell</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>Ada’s Bakery · Terminal 2</div>
        </div>
        <span style={{ position: 'relative', width: 46, height: 46, borderRadius: 23, border: `2px solid ${INK}` }}>
          <span style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, background: CORAL, border: `2px solid ${INK}`, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
        </span>
      </div>
      <div style={{ position: 'absolute', left: 20, top: 80, display: 'flex', gap: 8 }}>
        {['All', 'Breads', 'Pastries', 'Coffee'].map((s, i) => (
          <span key={s} style={{ height: 40, padding: '0 16px', borderRadius: 20, border: `2px solid ${INK}`, background: i === 0 ? INK : SURFACE, color: i === 0 ? '#fff' : INK, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center' }}>{s}</span>
        ))}
      </div>
      {TILES.map((tile, i) => {
        const b = box(i)
        const taps = TERMINAL_TAPS[tile.key] ?? []
        const qty = qtyAt(t, tile.key)
        const press = Math.max(0, ...taps.map((a) => tapAt(t, a).press))
        const latest = taps.filter((a) => t >= a).pop()
        const pulse = latest === undefined ? 0 : Math.sin(span(t, latest, latest + 0.3) * Math.PI)
        const sold = 'tag' in tile && tile.tag === 'Sold out'
        return (
          <div key={tile.key} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, boxSizing: 'border-box', borderRadius: 20, border: `2px solid ${INK}`, background: SURFACE, overflow: 'hidden', transform: `scale(${1 - 0.05 * press})`, boxShadow: qty ? `0 0 0 3px ${CORAL}` : 'none' }}>
            <Pic src={IMG[tile.key]} style={{ width: '100%', height: 104, objectFit: 'cover', opacity: sold ? 0.45 : 1 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', fontSize: 13, fontWeight: 700 }}>
              <span>{tile.name}</span>
              <span style={{ fontWeight: 800 }}>{money(tile.price)}</span>
            </div>
            {'tag' in tile ? <span style={{ position: 'absolute', top: 8, left: 8, height: 22, padding: '0 9px', borderRadius: 11, background: sold ? INK : CORAL, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center' }}>{tile.tag}</span> : null}
            {qty ? (
              <span style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, background: CORAL, border: `2px solid ${INK}`, color: '#fff', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${bounce(t, taps[0]! + 2 / 30) * (1 + 0.25 * pulse)})` }}>{qty}</span>
            ) : null}
          </div>
        )
      })}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, borderRadius: '30px 30px 0 0', borderTop: `2px solid ${INK}`, background: SURFACE, padding: '12px 20px', boxSizing: 'border-box' }}>
        <div style={{ width: 44, height: 5, borderRadius: 3, background: '#BDBBB6', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {items ? `${items} items` : 'Tap what they’re buying'}
          <span style={{ color: MUTED, fontWeight: 700 }}>{names.length ? ` · ${names.join(', ')}` : ''}</span>
        </div>
        <div style={{ marginTop: 12, height: 66, borderRadius: 33, background: items ? CORAL : '#C9C4BB', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 9px 0 24px', fontSize: 24, fontWeight: 800, transform: `scale(${1 - 0.04 * charge.press})`, fontVariantNumeric: 'tabular-nums' }}>
          Charge {money(shown)}
          <span style={{ width: 50, height: 50, borderRadius: 25, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 40 40" fill="none"><circle cx="11" cy="20" r="3.6" fill={INK} /><path d="M18 11a12 12 0 0 1 0 18M24.5 6a19 19 0 0 1 0 28" stroke={INK} strokeWidth="3.6" strokeLinecap="round" /></svg>
          </span>
        </div>
      </div>
      {Object.entries(TERMINAL_TAPS).flatMap(([key, taps]) =>
        taps.map((a) => {
          const b = box(TILES.findIndex((x) => x.key === key))
          return <Finger key={a} t={t} at={a} x={b.x + b.w * 0.55} y={b.y + 60} size={44} />
        }),
      )}
      <Finger t={t} at={TERMINAL_CHARGE} x={346} y={824 - 50} size={44} />
    </AbsoluteFill>
  )
}

/** `t` counts from the moment it was paid. */
export function TerminalPaidUI({ t }: { t: number }) {
  const ring = hero(span(t, 0, 0.8))
  const tick = hero(span(t, 0.3, 0.9))
  const pop = bounce(t, 0)
  const words = hero(span(t, 0.35, 0.95))
  const stats = hero(span(t, 0.6, 1.2))
  const took = 0.9 * countUp(t, 0.7, 0.6)
  const kept = 0.86 * countUp(t, 0.8, 0.7)
  const print = span(t, 1.2, 3.6)
  const slip = hero(span(t, 1.2, 3.6))
  return (
    <AbsoluteFill style={{ ...font, background: TEAL }}>
      <div style={{ position: 'absolute', left: 92, top: -70 + 70 * slip, width: 228, height: 64, background: '#FBFAF7', border: `2px solid ${INK}`, borderTop: 'none', borderRadius: '0 0 8px 8px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 10, boxSizing: 'border-box', fontSize: 12, fontWeight: 800, letterSpacing: 2.4 }}>
        PAID $19.25
      </div>
      <svg width="250" height="250" viewBox="0 0 250 250" style={{ position: 'absolute', left: 81, top: 124, transform: `scale(${mix(0.6, 1, pop)})` }}>
        <circle cx="125" cy="125" r="120" fill={SURFACE} stroke={INK} strokeWidth="4" />
        <circle cx="125" cy="125" r="86" fill="none" stroke={CORAL} strokeWidth="18" strokeLinecap="round" transform="rotate(-90 125 125)" strokeDasharray="540" strokeDashoffset={540 * (1 - ring)} />
        <path d="M86 128 L112 154 L164 100" fill="none" stroke={INK} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="110" strokeDashoffset={110 * (1 - tick)} />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 418, textAlign: 'center', opacity: words, transform: `translateY(${(1 - words) * 24}px)` }}>
        <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>Paid</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 10 }}>$19.25 from Ada’s Kova Card</div>
      </div>
      <div style={{ position: 'absolute', left: 20, right: 20, top: 548, height: 134, borderRadius: 22, border: `2px solid ${INK}`, background: SURFACE, overflow: 'hidden', opacity: stats, transform: `translateY(${(1 - stats) * 30}px)` }}>
        <div style={{ display: 'flex', height: 74, borderBottom: `2px solid ${INK}` }}>
          {[
            ['Took', `${took.toFixed(1)} s`, INK],
            ['Card fees', '$0.00', GREEN],
            ['Kept vs card', `+${money(kept)}`, GREEN],
          ].map(([k, v, c], i) => (
            <div key={k} style={{ flex: 1, borderLeft: i ? `2px solid ${INK}` : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>{k}</span>
              <span style={{ fontSize: 19, fontWeight: 800, color: c, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round"><path d="M7 9V4h10v5M5 9h14v8h-3v3H8v-3H5z" /></svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{print < 1 ? 'Printing the receipt' : 'Receipt printed'}</div>
            <div style={{ height: 6, borderRadius: 3, background: '#D6D3CD', marginTop: 6 }}>
              <div style={{ width: `${print * 100}%`, height: 6, borderRadius: 3, background: INK }} />
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 20, right: 20, bottom: 24, display: 'flex', gap: 12, opacity: stats }}>
        <div style={{ width: 110, height: 66, borderRadius: 33, border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800 }}>Refund</div>
        <div style={{ flex: 1, height: 66, borderRadius: 33, background: INK, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>Next sale</div>
      </div>
    </AbsoluteFill>
  )
}
