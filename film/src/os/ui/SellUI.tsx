/**
 * The Register's Sell screen, live (1440 × 900): three things tapped into a sale, the cart building
 * line by line, the total counting up, and Charge pressed. Layout and copy match the Kova POS design.
 */
import { AbsoluteFill } from 'remotion'
import { BEAT, bounce, CORAL, countUp, Finger, font, GREEN, hero, IMG, INK, MUTED, mix, money, PAPER, Pic, span, SUNKEN, SURFACE, tapAt, TEAL } from './kit'
import { Rail } from './Rail'

/** When each tap lands, in seconds from the start of the screen. */
export const SELL_TAPS = { croissant: [BEAT, 2 * BEAT], flatwhite: [3 * BEAT, 4 * BEAT], bun: [5 * BEAT], charge: 7 * BEAT }

const TILES = [
  { key: 'loaf', name: 'Sourdough loaf', price: 6.5 },
  { key: 'baguette', name: 'Baguette', price: 3.0 },
  { key: 'croissant', name: 'Croissant', price: 3.25 },
  { key: 'bun', name: 'Cinnamon bun', price: 3.75, tag: '3 left' },
  { key: 'cookie', name: 'Chocolate cookie', price: 2.5, tag: 'Sold out' },
  { key: 'cake', name: 'Carrot cake', price: 5.0 },
  { key: 'flatwhite', name: 'Flat white', price: 4.5 },
] as const

const COL = 200.5
const ROW = 220
const GAP = 14
const GRID = { x: 130, y: 162 }
export const tileBox = (i: number) => ({ x: GRID.x + (i % 4) * (COL + GAP), y: GRID.y + Math.floor(i / 4) * (ROW + GAP), w: COL, h: ROW })
export const CHARGE = { x: 1026, y: 774, w: 388, h: 76 }

function qtyAt(t: number, key: string) {
  const taps = (SELL_TAPS as Record<string, number[] | number>)[key]
  return Array.isArray(taps) ? taps.filter((a) => t >= a + 2 / 30).length : 0
}

export function sellTotal(t: number) {
  return TILES.reduce((sum, tile) => sum + tile.price * qtyAt(t, tile.key), 0)
}

export function SellUI({ t }: { t: number }) {
  const lines = (['croissant', 'flatwhite', 'bun'] as const)
    .map((key) => ({ tile: TILES.find((x) => x.key === key)!, qty: qtyAt(t, key), first: (SELL_TAPS[key] as number[])[0] as number }))
    .filter((l) => l.qty > 0)
  // The total counts from the last total to the new one after each tap.
  const allTaps = [...SELL_TAPS.croissant, ...SELL_TAPS.flatwhite, ...SELL_TAPS.bun].sort((a, b) => a - b)
  const lastTap = allTaps.filter((a) => t >= a).pop()
  const before = lastTap === undefined ? 0 : sellTotal(lastTap - 0.01)
  const now = sellTotal(t)
  const shown = lastTap === undefined ? 0 : mix(before, now, countUp(t, lastTap + 2 / 30, 0.45))
  const count = lines.reduce((n, l) => n + l.qty, 0)
  const charge = tapAt(t, SELL_TAPS.charge)

  return (
    <AbsoluteFill style={{ ...font, background: PAPER, display: 'flex', flexDirection: 'row' }}>
      <Rail active="Sell" />
      <div style={{ position: 'absolute', left: 130, top: 22, right: 466, height: 56, borderRadius: 28, background: SURFACE, border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', padding: '0 22px', gap: 12, fontSize: 17, fontWeight: 600, color: MUTED }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        Search or scan a barcode
      </div>
      <div style={{ position: 'absolute', left: 130, top: 94, display: 'flex', gap: 10 }}>
        {['All', 'Breads', 'Pastries', 'Cakes', 'Coffee'].map((s, i) => (
          <div key={s} style={{ height: 48, padding: '0 22px', borderRadius: 24, border: `2px solid ${INK}`, background: i === 0 ? INK : SURFACE, color: i === 0 ? '#fff' : INK, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
            {s}
          </div>
        ))}
      </div>
      {TILES.map((tile, i) => {
        const b = tileBox(i)
        const taps = (SELL_TAPS as Record<string, number[] | number>)[tile.key]
        const press = Array.isArray(taps) ? Math.max(0, ...taps.map((a) => tapAt(t, a).press)) : 0
        const qty = qtyAt(t, tile.key)
        const firstAt = Array.isArray(taps) ? (taps[0] as number) : 0
        const badge = qty ? bounce(t, firstAt + 2 / 30) : 0
        const latest = Array.isArray(taps) ? taps.filter((a) => t >= a).pop() : undefined
        const pulse = latest === undefined ? 0 : Math.sin(Math.min(1, span(t, latest, latest + 0.3)) * Math.PI)
        const sold = 'tag' in tile && tile.tag === 'Sold out'
        return (
          <div
            key={tile.key}
            style={{
              position: 'absolute',
              left: b.x,
              top: b.y,
              width: b.w,
              height: b.h,
              borderRadius: 26,
              border: `2px solid ${INK}`,
              background: SURFACE,
              overflow: 'hidden',
              transform: `scale(${1 - 0.04 * press})`,
              boxShadow: qty ? `0 0 0 4px ${CORAL}` : 'none',
            }}
          >
            <Pic src={IMG[tile.key]} style={{ width: '100%', height: 140, objectFit: 'cover', opacity: sold ? 0.45 : 1 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '12px 16px', fontSize: 16, fontWeight: 700 }}>
              <span style={{ lineHeight: 1.2 }}>{tile.name}</span>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{money(tile.price)}</span>
            </div>
            {'tag' in tile ? (
              <div style={{ position: 'absolute', top: 12, left: 12, height: 26, padding: '0 12px', borderRadius: 13, background: sold ? INK : CORAL, color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center' }}>{tile.tag}</div>
            ) : null}
            {qty ? (
              <div style={{ position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: 18, background: CORAL, border: `3px solid ${INK}`, color: '#fff', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${badge * (1 + 0.25 * pulse)})` }}>{qty}</div>
            ) : null}
          </div>
        )
      })}
      <div style={{ position: 'absolute', left: tileBox(7).x, top: tileBox(7).y, width: COL, height: ROW, borderRadius: 26, border: `2px dashed ${INK}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 16, fontWeight: 700 }}>
        <div style={{ width: 52, height: 52, borderRadius: 26, background: INK, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>+</div>
        Custom amount
      </div>

      {/* The cart. */}
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 440, background: SURFACE, borderLeft: `2px solid ${INK}` }}>
        <div style={{ padding: '24px 26px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.6 }}>Sale #0142</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: MUTED }}>At the counter · 9:41</div>
          </div>
          <div style={{ height: 44, padding: '0 16px', borderRadius: 22, border: `2px solid ${INK}`, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center' }}>Park sale</div>
        </div>
        <div style={{ margin: '0 26px', height: 56, borderRadius: 18, border: '2px dashed #8C9799', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', fontSize: 16, fontWeight: 700 }}>
          <span style={{ width: 34, height: 34, borderRadius: 17, background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>+</span>Add a customer
        </div>
        <div style={{ padding: '8px 26px' }}>
          {lines.length === 0 ? (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: MUTED }}>Tap what they’re buying</div>
          ) : null}
          {lines.map((l) => {
            const enter = hero(span(t, l.first + 2 / 30, l.first + 0.45))
            return (
              <div key={l.tile.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: `1px solid ${SUNKEN}`, transform: `translateX(${(1 - enter) * 60}px)`, opacity: enter }}>
                <Pic src={IMG[l.tile.key]} style={{ width: 56, height: 56, borderRadius: 16, objectFit: 'cover', border: `2px solid ${INK}` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{l.tile.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: MUTED }}>{l.tile.key === 'flatwhite' ? 'Oat milk' : `${money(l.tile.price)} each`}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', height: 44, borderRadius: 22, border: `2px solid ${INK}`, padding: '0 12px', gap: 14, fontSize: 18, fontWeight: 800 }}>
                  <span>−</span>
                  <span>{l.qty}</span>
                  <span>+</span>
                </div>
                <div style={{ width: 70, textAlign: 'right', fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(l.tile.price * l.qty)}</div>
              </div>
            )
          })}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderTop: `2px solid ${INK}`, padding: '18px 26px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 600, color: MUTED }}>
            <span>Subtotal · {count} items</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(shown)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 600, color: GREEN }}>
            <span>Card fees</span>
            <span>$0.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '4px 0 10px' }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{money(shown)}</span>
          </div>
          <div style={{ height: 76, borderRadius: 38, background: count ? CORAL : '#C9C4BB', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 0 30px', fontSize: 24, fontWeight: 800, transform: `scale(${1 - 0.04 * charge.press})` }}>
            Charge {money(shown)}
            <span style={{ width: 56, height: 56, borderRadius: 28, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 40 40" fill="none"><circle cx="11" cy="20" r="3.6" fill={INK} /><path d="M18 11a12 12 0 0 1 0 18M24.5 6a19 19 0 0 1 0 28" stroke={INK} strokeWidth="3.6" strokeLinecap="round" /></svg>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, fontSize: 14, fontWeight: 700, color: MUTED }}>Kova Card · Phone · QR · Cash</div>
        </div>
      </div>

      {/* Fingers. */}
      {[...SELL_TAPS.croissant.map((a) => ({ a, i: 2 })), ...SELL_TAPS.flatwhite.map((a) => ({ a, i: 6 })), ...SELL_TAPS.bun.map((a) => ({ a, i: 3 }))].map(({ a, i }) => {
        const b = tileBox(i)
        return <Finger key={a} t={t} at={a} x={b.x + b.w * 0.55} y={b.y + 80} />
      })}
      <Finger t={t} at={SELL_TAPS.charge} x={CHARGE.x + CHARGE.w - 40} y={CHARGE.y + 38} />
    </AbsoluteFill>
  )
}
