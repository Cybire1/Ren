/**
 * Ada's Bakery's online shop on Noor's phone, live (393 × 852 pt, an iPhone 16 Pro): the shop, a
 * sourdough loaf into the bag, her name and note typed in, Pay, and Kova's Paid screen. Drawn from
 * the real shop-link screens (public/shop/*), in the app's own style.
 */
import { AbsoluteFill } from 'remotion'
import { bounce, CORAL, countUp, Finger, font, hero, IMG, INK, MUTED, mix, PAPER, Pic, span, SUNKEN, SURFACE, tapAt } from '../../os/ui/kit'

export const W = 393
export const H = 852

const ITEMS = [
  { key: 'loaf', name: 'Sourdough loaf', price: '$6.50' },
  { key: 'croissant', name: 'Croissant', price: '$3.25' },
  { key: 'bun', name: 'Cinnamon bun', price: '$3.75' },
  { key: 'flatwhite', name: 'Flat white', price: '$4.50' },
] as const

function StatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 34px 0 46px', boxSizing: 'border-box', fontSize: 17, fontWeight: 700, color: dark ? '#fff' : INK }}>
      <span>9:41</span>
      <svg width="70" height="14" viewBox="0 0 70 14" aria-hidden="true"><rect x="0" y="8" width="3.5" height="6" rx="1" fill="currentColor" /><rect x="5.5" y="5.5" width="3.5" height="8.5" rx="1" fill="currentColor" /><rect x="11" y="3" width="3.5" height="11" rx="1" fill="currentColor" /><rect x="16.5" y="0.5" width="3.5" height="13.5" rx="1" fill="currentColor" /><rect x="40" y="1" width="25" height="12" rx="3.5" fill="none" stroke="currentColor" strokeOpacity="0.4" /><rect x="42" y="3" width="19" height="8" rx="2" fill="currentColor" /></svg>
    </div>
  )
}

/** Characters of `text` typed by time t, one every 55 ms from `at`. */
const typed = (text: string, t: number, at: number) => text.slice(0, Math.max(0, Math.floor((t - at) / 0.055)))

export function PhoneShopUI({ t, taps }: { t: number; taps: { add: number; pay: number; paid: number } }) {
  const scroll = hero(span(t, 0.15, 0.9)) * 300
  const sheet = hero(span(t, taps.add + 0.12, taps.add + 0.6))
  const add = tapAt(t, taps.add)
  const pay = tapAt(t, taps.pay)
  const paid = t >= taps.paid
  const paidIn = hero(span(t, taps.paid, taps.paid + 0.5))
  const name = typed('Noor', t, taps.add + 0.6)
  const note = typed('Sliced, please', t, taps.add + 0.95)
  const caret = Math.floor(t * 3) % 2 === 0
  const bagCount = t >= taps.add + 2 / 30 ? 1 : 0

  return (
    <AbsoluteFill style={{ ...font, background: PAPER, overflow: 'hidden' }}>
      {/* The shop. */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, transform: `translateY(${-scroll}px)` }}>
        <div style={{ height: 54 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 12px' }}>
          <span style={{ width: 36, height: 36, borderRadius: 18, background: '#EBB3AA', border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800 }}>A</span>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 800 }}>Ada’s Bakery</span>
          <span style={{ height: 36, padding: '0 12px', borderRadius: 18, border: `2px solid ${INK}`, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center' }}>$ USD</span>
          <span style={{ position: 'relative', width: 52, height: 36, borderRadius: 18, background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round"><path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" /></svg>
            {bagCount ? <span style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, background: CORAL, border: `2px solid ${INK}`, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${bounce(t, taps.add + 2 / 30)})` }}>1</span> : null}
          </span>
        </div>
        <div style={{ margin: '0 16px', height: 250, borderRadius: 26, border: `2px solid ${INK}`, overflow: 'hidden', background: '#458789', position: 'relative' }}>
          <div style={{ height: 46, background: `repeating-linear-gradient(90deg, ${CORAL} 0 30px, #F7F4EE 30px 60px)`, borderBottom: `2px solid ${INK}` }} />
          <div style={{ height: 16, background: `radial-gradient(circle at 15px 0, ${CORAL} 14px, transparent 15px) 0 0 / 60px 16px repeat-x, radial-gradient(circle at 45px 0, #F7F4EE 14px, transparent 15px) 0 0 / 60px 16px repeat-x` }} />
          <Pic src={IMG.koviCheer} style={{ position: 'absolute', right: 18, top: 72, width: 92, height: 92, transform: `translateY(${-4 * Math.sin(t * 4)}px)` }} />
          <div style={{ position: 'absolute', left: 22, bottom: 22, color: '#fff' }}>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1.4, lineHeight: 1 }}>Ada’s Bakery</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginTop: 6 }}>Baked this morning</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '16px 16px 0' }}>
          <span style={{ height: 32, padding: '0 12px', borderRadius: 16, background: SUNKEN, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 5, background: '#5BB98B' }} />Open now</span>
          <span style={{ height: 32, padding: '0 12px', borderRadius: 16, background: SUNKEN, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center' }}>Ready in 15 min</span>
        </div>
        <div style={{ padding: '22px 16px 0' }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.6 }}>Everything</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: MUTED, marginTop: 4 }}>Order now and pay from your phone. No card fees.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '16px 16px' }}>
          {ITEMS.map((it, i) => {
            const isAdd = i === 0
            return (
              <div key={it.key}>
                <div style={{ position: 'relative', height: 158, borderRadius: 22, border: `2px solid ${INK}`, background: SURFACE, overflow: 'hidden', transform: isAdd ? `scale(${1 - 0.04 * add.press})` : undefined }}>
                  <Pic src={IMG[it.key]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span style={{ position: 'absolute', top: 8, right: 8, width: 36, height: 36, borderRadius: 18, background: isAdd && bagCount ? INK : CORAL, border: `2px solid ${INK}`, color: '#fff', fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isAdd && bagCount ? '✓' : '+'}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8 }}>{it.name}</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{it.price}</div>
              </div>
            )
          })}
        </div>
      </div>
      <StatusBar />

      {/* The bag. */}
      <div style={{ position: 'absolute', inset: 0, background: `rgba(11,26,29,${0.35 * sheet})` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 560, borderRadius: '30px 30px 0 0', background: SURFACE, borderTop: `2px solid ${INK}`, padding: '22px 18px', boxSizing: 'border-box', transform: `translateY(${(1 - sheet) * 104}%)` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.6 }}>Your bag</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>From Ada’s Bakery. 1 thing.</div>
          </div>
          <span style={{ width: 36, height: 36, borderRadius: 18, border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✕</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, paddingBottom: 14, borderBottom: '2px dashed #C4C1BB' }}>
          <Pic src={IMG.loaf} style={{ width: 48, height: 48, borderRadius: 12, border: `2px solid ${INK}`, objectFit: 'cover' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Sourdough loaf</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>$6.50</div>
          </div>
          <span style={{ height: 34, padding: '0 12px', borderRadius: 17, background: INK, color: '#fff', display: 'flex', alignItems: 'center', gap: 14, fontSize: 15, fontWeight: 800 }}><span>−</span>1<span>+</span></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '14px 0' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Total</span>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>$6.50</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>Your name so they know it’s yours</div>
        <div style={{ height: 44, borderRadius: 22, border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 15, fontWeight: 600 }}>{name}{name.length < 4 && t > taps.add + 0.6 && caret ? '|' : ''}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, margin: '10px 0 6px' }}>A note for Ada’s Bakery</div>
        <div style={{ height: 44, borderRadius: 22, border: `2px solid ${CORAL}`, display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 15, fontWeight: 600 }}>{note}{note.length > 0 && note.length < 14 && caret ? '|' : ''}</div>
        <div style={{ marginTop: 16, height: 56, borderRadius: 28, background: CORAL, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 7px 0 22px', fontSize: 18, fontWeight: 800, transform: `scale(${1 - 0.04 * pay.press})` }}>
          Pay $6.50
          <span style={{ width: 42, height: 42, borderRadius: 21, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 40 40" fill="none"><circle cx="11" cy="20" r="3.6" fill={CORAL} /><path d="M18 11a12 12 0 0 1 0 18M24.5 6a19 19 0 0 1 0 28" stroke={CORAL} strokeWidth="3.6" strokeLinecap="round" /></svg>
          </span>
        </div>
      </div>

      {/* Paid. */}
      {paid ? (
        <div style={{ position: 'absolute', inset: 0, background: PAPER, opacity: paidIn, transform: `scale(${mix(1.04, 1, paidIn)})`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <StatusBar />
          <Pic src={IMG.koviCheer} style={{ width: 210, height: 210, marginTop: 120, transform: `scale(${bounce(t, taps.paid + 0.1)})` }} />
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.8, marginTop: 20 }}>Paid!</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>$6.50 to Ada’s Bakery</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            {[
              [`${(0.9 * countUp(t, taps.paid + 0.3, 0.5)).toFixed(1)}s`, 'Took'],
              ['$0.00', 'Fee'],
              ['15 min', 'Ready in'],
            ].map(([v, k]) => (
              <div key={k} style={{ width: 104, height: 66, borderRadius: 18, border: `2px solid ${INK}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 17, fontWeight: 800 }}>{v}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>{k}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 'auto', marginBottom: 46, width: 357, height: 56, borderRadius: 28, background: INK, color: '#fff', display: 'flex', alignItems: 'center', padding: '0 22px', boxSizing: 'border-box', fontSize: 17, fontWeight: 800 }}>Done</div>
        </div>
      ) : null}

      <Finger t={t} at={taps.add} x={16 + 172 - 26} y={54 + 60 + 250 + 48 + 76 + 16 + 26 - 300} size={40} />
      <Finger t={t} at={taps.pay} x={330} y={H - 560 + 22 + 492} size={40} />
    </AbsoluteFill>
  )
}
