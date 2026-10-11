/**
 * The cold open: Ada's Bakery before seven, drawn in Kova's sticker style. On the beat the door
 * sign flips from CLOSED to OPEN, Kovi pops up over it, the window lights come on and the street
 * goes from blue hour to morning; then the camera pushes into the sign.
 */
import { AbsoluteFill } from 'remotion'
import { bounce, CORAL, font, hero, IMG, INK, mix, Pic, span, SURFACE } from '../os/ui/kit'

const mixColor = (a: string, b: string, p: number) => {
  const pa = [1, 3, 5].map((i) => Number.parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => Number.parseInt(b.slice(i, i + 2), 16))
  return `rgb(${pa.map((v, i) => Math.round(mix(v, pb[i]!, p))).join(',')})`
}

export function StoreOpen({ t, flip, end }: { t: number; flip: number; end: number }) {
  const turn = hero(span(t, flip, flip + 0.45))
  const on = hero(span(t, flip + 0.1, flip + 0.9))
  const kovi = bounce(t, flip + 0.35)
  // Camera: a slow push toward the door, then a dive into the sign.
  const drift = span(t, 0, end - 0.7)
  const dive = span(t, end - 0.7, end) ** 2.4
  const zoom = mix(1, 1.18, hero(drift)) * mix(1, 4.2, dive)
  const focus = { x: mix(960, 1100, hero(drift)), y: mix(560, 560, drift) }
  const signFace = turn < 0.5 ? 'closed' : 'open'
  const signScaleX = Math.abs(Math.cos(turn * Math.PI))

  return (
    <AbsoluteFill style={{ ...font, background: mixColor('#16252B', '#A9C9C9', on), overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: `${focus.x}px ${focus.y}px`, transform: `scale(${zoom})` }}>
        {/* Sun and a few clouds as the morning comes. */}
        <div style={{ position: 'absolute', left: 1500, top: mix(260, 110, on), width: 150, height: 150, borderRadius: 75, background: '#E8C15A', border: `6px solid ${INK}`, opacity: on }} />
        {[{ x: 210, y: 150, w: 220 }, { x: 1300, y: 260, w: 170 }].map((c, i) => (
          <div key={i} style={{ position: 'absolute', left: c.x + on * 30 * (i ? -1 : 1), top: c.y, width: c.w, height: c.w * 0.32, borderRadius: c.w, background: SURFACE, border: `5px solid ${INK}`, opacity: 0.25 + 0.75 * on }} />
        ))}

        {/* The street. */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 980, bottom: 0, background: mixColor('#22343A', '#DCD6CB', on), borderTop: `6px solid ${INK}` }} />

        {/* The bakery. */}
        <div style={{ position: 'absolute', left: 390, top: 180, width: 1140, height: 806, background: mixColor('#33464C', '#F1EFEA', on), border: `6px solid ${INK}`, borderBottom: 'none', borderRadius: '14px 14px 0 0' }} />
        <div style={{ position: 'absolute', left: 660, top: 200, width: 600, height: 92, borderRadius: 18, background: INK, color: mixColor('#6E7F83', '#F1EFEA', on), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 58, fontWeight: 800, letterSpacing: -1.5 }}>Ada’s Bakery</div>
        <div style={{ position: 'absolute', left: 370, top: 318, width: 1180, height: 96, background: `repeating-linear-gradient(90deg, ${mixColor('#5B3B38', CORAL, on)} 0 84px, ${mixColor('#556266', '#F7F4EE', on)} 84px 168px)`, border: `6px solid ${INK}`, borderRadius: 10 }} />
        <div style={{ position: 'absolute', left: 376, top: 414, width: 1168, height: 42, background: `radial-gradient(circle at 42px 0, ${mixColor('#5B3B38', CORAL, on)} 40px, transparent 41px) 0 0 / 168px 42px repeat-x, radial-gradient(circle at 126px 0, ${mixColor('#556266', '#F7F4EE', on)} 40px, transparent 41px) 0 0 / 168px 42px repeat-x` }} />

        {/* The window, lit from inside once open. */}
        <div style={{ position: 'absolute', left: 470, top: 500, width: 560, height: 400, borderRadius: 16, border: `6px solid ${INK}`, background: mixColor('#1D2C31', '#F6DFA6', on), overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 236, height: 10, background: INK }} />
          <Pic src={IMG.loaf} style={{ position: 'absolute', left: 30, top: 120, width: 150, height: 120, objectFit: 'cover', borderRadius: 18, border: `4px solid ${INK}`, opacity: 0.25 + 0.75 * on }} />
          <Pic src={IMG.croissant} style={{ position: 'absolute', left: 200, top: 130, width: 150, height: 110, objectFit: 'cover', borderRadius: 18, border: `4px solid ${INK}`, opacity: 0.25 + 0.75 * on }} />
          <Pic src={IMG.bun} style={{ position: 'absolute', left: 370, top: 130, width: 150, height: 110, objectFit: 'cover', borderRadius: 18, border: `4px solid ${INK}`, opacity: 0.25 + 0.75 * on }} />
          <Pic src={IMG.cake} style={{ position: 'absolute', left: 90, top: 260, width: 160, height: 120, objectFit: 'cover', borderRadius: 18, border: `4px solid ${INK}`, opacity: 0.25 + 0.75 * on }} />
          <Pic src={IMG.baguette} style={{ position: 'absolute', left: 300, top: 270, width: 200, height: 110, objectFit: 'cover', borderRadius: 18, border: `4px solid ${INK}`, opacity: 0.25 + 0.75 * on }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.35) 42%, rgba(255,255,255,0) 54%)' }} />
        </div>

        {/* The door, and its sign. */}
        <div style={{ position: 'absolute', left: 1110, top: 500, width: 330, height: 486, border: `6px solid ${INK}`, borderBottom: 'none', borderRadius: '16px 16px 0 0', background: mixColor('#2B4A4D', '#458789', on) }}>
          <div style={{ position: 'absolute', left: 34, right: 34, top: 34, height: 250, borderRadius: 10, border: `5px solid ${INK}`, background: mixColor('#1D2C31', '#F6DFA6', on) }} />
          <div style={{ position: 'absolute', right: 30, top: 300, width: 20, height: 20, borderRadius: 10, background: '#E8C15A', border: `4px solid ${INK}` }} />
        </div>
        <svg aria-hidden="true" width="330" height="120" viewBox="0 0 330 120" style={{ position: 'absolute', left: 1110, top: 520 }}>
          <path d="M165 18 L70 96 M165 18 L260 96" stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />
          <circle cx="165" cy="18" r="10" fill="#E8C15A" stroke={INK} strokeWidth="5" />
        </svg>
        <Pic src="store/kovi-peek.png" style={{ position: 'absolute', left: 1180, top: mix(640, 491, kovi), width: 190, height: 133 }} />
        <div style={{ position: 'absolute', left: 1150, top: 612, width: 250, height: 128, borderRadius: 18, border: `6px solid ${INK}`, background: signFace === 'open' ? SURFACE : INK, color: signFace === 'open' ? CORAL : SURFACE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 66, fontWeight: 800, letterSpacing: -2, transform: `scaleX(${Math.max(0.02, signScaleX)})`, boxShadow: `8px 8px 0 ${INK}` }}>
          {signFace === 'open' ? 'OPEN' : <span style={{ fontSize: 50 }}>CLOSED</span>}
        </div>
      </div>

      <div style={{ position: 'absolute', left: 90, top: 80, height: 64, padding: '0 26px', borderRadius: 32, background: INK, color: SURFACE, display: 'flex', alignItems: 'center', gap: 12, fontSize: 30, fontWeight: 800, opacity: 1 - span(t, end - 0.9, end - 0.6) }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={SURFACE} strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        {t < flip ? '6:59' : '7:00'}
      </div>
    </AbsoluteFill>
  )
}
