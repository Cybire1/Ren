/**
 * The Register's Products screen, live (1440 × 900), from the Kova POS design. Two moments:
 *   snap   Ada snaps her chalkboard menu; Kova reads it and each line flies into the catalogue.
 *   stock  sales count the cinnamon buns down to sold out, online and at the counter at once.
 */
import { AbsoluteFill } from 'remotion'
import { BEAT, bounce, CORAL, Finger, font, hero, IMG, INK, MUTED, mix, PAPER, Pic, span, SUNKEN, SURFACE, tapAt, TEAL } from '../../os/ui/kit'
import { Rail } from '../../os/ui/Rail'

type Row = { key: keyof typeof IMG; name: string; sub: string; shelf: string; price: string; stock: number | null }
const ROWS: Row[] = [
  { key: 'loaf', name: 'Sourdough loaf', sub: 'Slow-proved, crackly crust', shelf: 'Breads', price: '$6.50', stock: 8 },
  { key: 'baguette', name: 'Baguette', sub: 'Baked three times a day', shelf: 'Breads', price: '$3.00', stock: 13 },
  { key: 'croissant', name: 'Croissant', sub: 'All butter, baked this morning', shelf: 'Pastries', price: '$3.25', stock: 11 },
  { key: 'bun', name: 'Cinnamon bun', sub: 'Cardamom sugar on top', shelf: 'Pastries', price: '$3.75', stock: 3 },
  { key: 'cookie', name: 'Chocolate cookie', sub: 'Sea salt and dark chocolate', shelf: 'Pastries', price: '$2.50', stock: 6 },
  { key: 'cake', name: 'Carrot cake', sub: 'Cream cheese frosting', shelf: 'Cakes', price: '$5.00', stock: 5 },
  { key: 'flatwhite', name: 'Flat white', sub: 'Double shot, whole milk', shelf: 'Coffee', price: '$4.50', stock: null },
]
const TABLE = { x: 136, y: 252, w: 1272, head: 44, row: 74 }
const rowY = (i: number) => TABLE.y + TABLE.head + i * TABLE.row
const PHOTO = { x: 900, y: 150, w: 420, h: 560 }

/** When each line of the menu lands in the catalogue (snap). */
const landAt = (i: number) => 3.5 * BEAT + i * 0.5 * BEAT
/** The bun sells down: 3 → 2 → 1 → 0 (stock). */
const SALES = [0.5 * BEAT, 1.5 * BEAT, 2.5 * BEAT]

export function ProductsUI({ t, mode }: { t: number; mode: 'snap' | 'stock' }) {
  const snap = mode === 'snap'
  const snapTap = BEAT
  const photo = snap ? bounce(t, snapTap + 0.1) * (1 - hero(span(t, 7.2 * BEAT, 7.9 * BEAT))) : 0
  const scan = span(t, 1.7 * BEAT, 3.4 * BEAT)
  const landed = snap ? ROWS.filter((_, i) => t >= landAt(i) + 0.3).length : ROWS.length
  const bunSold = snap ? 0 : SALES.filter((a) => t >= a).length
  const bunStock = 3 - bunSold
  const soldOut = !snap && bunStock === 0
  const counters = [
    { k: 'On sale', v: String(Math.max(0, landed - (soldOut ? 1 : 0))), s: 'online and at the counter', bg: SURFACE },
    { k: 'Running low', v: bunStock > 0 && landed > 3 ? '1' : '0', s: bunStock > 0 ? `Cinnamon bun, ${bunStock} left` : 'Nothing', bg: '#EBB3AA' },
    { k: 'Sold out', v: soldOut ? '1' : '0', s: soldOut ? 'Cinnamon bun' : 'Nothing yet', bg: SUNKEN },
    { k: 'Made to order', v: landed >= 7 ? '1' : '0', s: 'no stock to count', bg: TEAL },
  ]
  const toast = snap ? 0 : hero(span(t, 2.6 * BEAT, 3.1 * BEAT))

  return (
    <AbsoluteFill style={{ ...font, background: PAPER }}>
      <Rail active="Products" />
      <div style={{ position: 'absolute', left: 136, top: 26 }}>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>Products</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: MUTED, marginTop: 2 }}>One catalogue for your online shop and every counter. Stock counts down with each sale.</div>
      </div>
      <div style={{ position: 'absolute', right: 32, top: 30, display: 'flex', gap: 12 }}>
        <div style={{ height: 54, padding: '0 22px', borderRadius: 27, border: `2px solid ${INK}`, background: SURFACE, fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10, transform: `scale(${1 - 0.05 * tapAt(t, snap ? snapTap : -9).press})` }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          Snap your menu
        </div>
        <div style={{ height: 54, padding: '0 22px', borderRadius: 27, background: INK, color: '#fff', fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center' }}>+ Add product</div>
      </div>

      {counters.map((c, i) => (
        <div key={c.k} style={{ position: 'absolute', left: 136 + i * 324, top: 112, width: 306, height: 118, boxSizing: 'border-box', padding: '16px 20px', borderRadius: 24, border: `2px solid ${INK}`, background: c.bg }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{c.k}</div>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>{c.v}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{c.s}</div>
        </div>
      ))}

      <div style={{ position: 'absolute', left: TABLE.x, top: TABLE.y, width: TABLE.w, height: 900 - TABLE.y - 20, borderRadius: 26, border: `2px solid ${INK}`, background: SURFACE, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: TABLE.head, background: SUNKEN, padding: '0 22px', fontSize: 14, fontWeight: 700, color: MUTED }}>
          <span style={{ width: 520 }}>Product</span>
          <span style={{ width: 150 }}>Shelf</span>
          <span style={{ width: 120 }}>Sold today</span>
          <span style={{ width: 120, textAlign: 'right' }}>Price</span>
          <span style={{ width: 200, textAlign: 'center' }}>Stock</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Status</span>
        </div>
        {!snap || landed > 0 ? null : (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: MUTED }}>No products yet. Snap your menu, or add one.</div>
        )}
      </div>

      {ROWS.map((r, i) => {
        const at = landAt(i)
        const p = snap ? hero(span(t, at, at + 0.45)) : 1
        if (p <= 0) return null
        const bun = r.key === 'bun'
        const stock = bun ? bunStock : r.stock
        const status = stock === null ? 'On sale' : stock === 0 ? 'Sold out' : bun ? 'Running low' : 'On sale'
        const statusPop = bun && soldOut ? bounce(t, SALES[2]!) : 1
        const sold = bun ? bunSold : 0
        const tick = bun && !snap ? SALES.filter((a) => t >= a).pop() : undefined
        const pulse = tick === undefined ? 0 : Math.sin(span(t, tick, tick + 0.35) * Math.PI)
        // In flight from its line on the photo to its row.
        const fromX = PHOTO.x + 40 - (TABLE.x + 22)
        const fromY = PHOTO.y + 150 + i * 52 - rowY(i)
        return (
          <div
            key={r.key}
            style={{
              position: 'absolute',
              left: TABLE.x + 2,
              top: rowY(i),
              width: TABLE.w - 4,
              height: TABLE.row,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              padding: '0 22px',
              borderBottom: `1px solid ${SUNKEN}`,
              background: bun && !snap ? `rgba(212,101,88,${0.1 + 0.12 * pulse})` : SURFACE,
              transform: `translate(${(1 - p) * fromX}px, ${(1 - p) * fromY}px) scale(${mix(0.6, 1, p)})`,
              transformOrigin: 'left center',
              opacity: Math.min(1, p * 2),
              zIndex: p < 1 ? 3 : 1,
            }}
          >
            <span style={{ width: 520, display: 'flex', alignItems: 'center', gap: 14 }}>
              <Pic src={IMG[r.key]} style={{ width: 52, height: 52, borderRadius: 14, border: `2px solid ${INK}`, objectFit: 'cover' }} />
              <span>
                <span style={{ display: 'block', fontSize: 18, fontWeight: 700 }}>{r.name}</span>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: MUTED }}>{r.sub}</span>
              </span>
            </span>
            <span style={{ width: 150, fontSize: 16, fontWeight: 600 }}>{r.shelf}</span>
            <span style={{ width: 120, fontSize: 16, fontWeight: 700 }}>{sold}</span>
            <span style={{ width: 120, textAlign: 'right', fontSize: 17, fontWeight: 800 }}>{r.price}</span>
            <span style={{ width: 200, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
              {stock === null ? (
                <span style={{ fontSize: 15, fontWeight: 600, color: MUTED }}>Made to order</span>
              ) : (
                <>
                  <span style={{ width: 32, height: 32, borderRadius: 16, border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>−</span>
                  <span style={{ width: 30, textAlign: 'center', fontSize: 20, fontWeight: 800, transform: `scale(${1 + 0.35 * pulse})`, color: bun && !snap ? CORAL : INK }}>{stock}</span>
                  <span style={{ width: 32, height: 32, borderRadius: 16, border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>+</span>
                </>
              )}
            </span>
            <span style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ height: 32, padding: '0 14px', borderRadius: 16, background: status === 'Sold out' ? INK : status === 'Running low' ? '#EBB3AA' : '#D4E6E2', color: status === 'Sold out' ? '#fff' : status === 'Running low' ? '#7A2A22' : '#1F5558', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', transform: `scale(${statusPop})` }}>{status}</span>
            </span>
          </div>
        )
      })}

      {/* The chalkboard menu Ada photographs, with Kova's scan line reading it. */}
      {photo > 0 ? (
        <div style={{ position: 'absolute', left: PHOTO.x, top: PHOTO.y, width: PHOTO.w, height: PHOTO.h, borderRadius: 22, border: `8px solid #8A6A4A`, background: '#22302F', boxShadow: '0 40px 80px -20px rgba(11,26,29,0.55)', transform: `scale(${photo}) rotate(${mix(8, 3, photo)}deg)`, overflow: 'hidden', color: '#EDEBE4', zIndex: 4 }}>
          <div style={{ padding: '30px 34px', fontSize: 30, fontWeight: 800, letterSpacing: 2 }}>TODAY</div>
          {ROWS.map((r, i) => (
            <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0 34px', height: 52, alignItems: 'center', fontSize: 22, fontWeight: 600, fontStyle: 'italic', opacity: snap && t >= landAt(i) ? 0.25 : 0.95 }}>
              <span>{r.name.toLowerCase()}</span>
              <span>{r.price.replace('$', '')}</span>
            </div>
          ))}
          {scan > 0 && scan < 1 ? <div style={{ position: 'absolute', left: 0, right: 0, top: `${scan * 100}%`, height: 6, background: CORAL, boxShadow: `0 0 30px 10px rgba(212,101,88,0.6)` }} /> : null}
          {scan > 0 && scan < 1 ? (
            <div style={{ position: 'absolute', left: 16, bottom: 16, height: 40, padding: '0 16px', borderRadius: 20, background: CORAL, color: '#fff', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center' }}>Reading your menu…</div>
          ) : null}
        </div>
      ) : null}

      {/* Sold out reaches the online shop too. */}
      {toast > 0 ? (
        <div style={{ position: 'absolute', left: 720 - 250, top: 18, width: 500, height: 58, borderRadius: 29, background: INK, color: '#fff', display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', boxSizing: 'border-box', fontSize: 16, fontWeight: 700, opacity: toast, transform: `translateY(${(1 - toast) * -70}px)`, zIndex: 5 }}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: CORAL }} />
          Cinnamon buns sold out, online and in store
        </div>
      ) : null}

      {snap ? <Finger t={t} at={snapTap} x={1440 - 32 - 186 - 12 - 120} y={57} /> : null}
    </AbsoluteFill>
  )
}
