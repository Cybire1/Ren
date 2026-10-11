/**
 * Ada's wallet, live (393 × 852 pt): she sends her flour mill in Italy $10.00 and it arrives as
 * euros in about a second, with Kova covering the network fee. The layout follows the real Send
 * screen (public/screens/04-send-review.png, 05-receipt-send.png).
 */
import { AbsoluteFill } from 'remotion'
import { bounce, CORAL, Finger, font, GREEN, hero, IMG, INK, MUTED, mix, Pic, span, SURFACE, tapAt, TEAL } from '../../os/ui/kit'

export function PhoneSendUI({ t, tap, sent }: { t: number; tap: number; sent: number }) {
  // The amount is typed in on the beat: 1, 10, 10.00.
  const keys = ['1', '10', '10.00']
  const typedAt = [0.55, 1.09, 1.64]
  const amount = keys[typedAt.filter((a) => t >= a).length - 1] ?? '0'
  const eur = amount === '10.00' ? '9.20' : amount === '10' ? '9.20' : amount === '1' ? '0.92' : '0.00'
  const press = tapAt(t, tap).press
  const done = hero(span(t, sent, sent + 0.5))
  const fly = hero(span(t, tap + 0.05, sent + 0.2))
  // Kovi rides the plane along the arc from Ada's town to the mill.
  const arc = (p: number) => ({ x: mix(40, 300, p), y: 150 - Math.sin(p * Math.PI) * 70 })
  const k = arc(fly)

  return (
    <AbsoluteFill style={{ ...font, background: TEAL, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 34px 0 46px', boxSizing: 'border-box', fontSize: 17, fontWeight: 700 }}>
        <span>9:41</span>
        <span style={{ width: 25, height: 12, borderRadius: 4, border: `1.5px solid rgba(11,26,29,0.5)` }} />
      </div>
      <div style={{ position: 'absolute', left: 20, top: 66, width: 40, height: 40, borderRadius: 20, background: SURFACE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>‹</div>
      <div style={{ position: 'absolute', left: 20, top: 120 }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>Send to Giulia</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1F3438' }}>Mulino Rossi · flour, Italy</div>
      </div>

      <div style={{ position: 'absolute', left: 0, top: 190, width: 393, height: 190 }}>
        <svg width="393" height="190" viewBox="0 0 393 190" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
          <path d="M40 150 Q 170 10 300 150" fill="none" stroke={INK} strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
          <rect x="18" y="128" width="16" height="30" rx="2" fill="#E8C15A" stroke={INK} strokeWidth="2.5" />
          <rect x="36" y="116" width="20" height="42" rx="2" fill={CORAL} stroke={INK} strokeWidth="2.5" />
          <rect x="58" y="134" width="14" height="24" rx="2" fill={SURFACE} stroke={INK} strokeWidth="2.5" />
          <rect x="286" y="120" width="22" height="38" rx="2" fill={SURFACE} stroke={INK} strokeWidth="2.5" />
          <path d="M310 158 V128 l14 -12 l14 12 V158 Z" fill="#E8C15A" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="352" cy="132" r="9" fill="none" stroke={INK} strokeWidth="2.5" />
          <path d="M352 132 l0 -9 M352 132 l8 4 M352 132 l-8 4" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <Pic src={IMG.koviRide} style={{ position: 'absolute', left: k.x - 42, top: k.y - 50, width: 90, height: 63, transform: `rotate(${mix(-14, 14, fly)}deg)`, opacity: fly > 0 && fly < 1 ? 1 : t < tap ? 1 : 0 }} />
      </div>

      <div style={{ position: 'absolute', left: 16, right: 16, top: 392, height: 86, borderRadius: 24, border: `2px solid ${INK}`, background: SURFACE, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', boxSizing: 'border-box' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>You send</div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1.2 }}>${amount}</div>
        </div>
        <span style={{ height: 34, padding: '0 14px', borderRadius: 17, background: '#DDE8E6', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center' }}>USD</span>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 488, display: 'flex', justifyContent: 'center' }}>
        <span style={{ height: 28, padding: '0 14px', borderRadius: 14, background: CORAL, color: '#fff', border: `2px solid ${INK}`, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center' }}>1 USD ≈ 0.92 EUR, reference rate</span>
      </div>
      <div style={{ position: 'absolute', left: 16, right: 16, top: 528, height: 86, borderRadius: 24, background: INK, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', boxSizing: 'border-box' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#A7B8B9' }}>Giulia gets</div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1.2 }}>€{eur}</div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#A7B8B9' }}>in euros</span>
      </div>
      <div style={{ position: 'absolute', left: 20, right: 20, top: 632, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700 }}>
        <span>Fee</span>
        <span>$0.00, Kova covers it</span>
      </div>
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 46, height: 60, borderRadius: 30, background: INK, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 0 22px', fontSize: 18, fontWeight: 800, transform: `scale(${1 - 0.04 * press})` }}>
        Send ${amount}
        <span style={{ width: 44, height: 44, borderRadius: 22, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </span>
      </div>

      {/* Sent. */}
      {t >= sent ? (
        <div style={{ position: 'absolute', inset: 0, background: SURFACE, opacity: done, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginTop: 150, width: 150, height: 150, borderRadius: 75, background: TEAL, border: `3px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${bounce(t, sent)})` }}>
            <svg width="76" height="76" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: MUTED, marginTop: 26 }}>Sent to Giulia, Italy</div>
          <div style={{ fontSize: 50, fontWeight: 800, letterSpacing: -2 }}>€9.20</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {[
              ['1.0 s', 'Took'],
              ['$0.00', 'Fee'],
              ['$10.00', 'You sent'],
            ].map(([v, k]) => (
              <div key={k} style={{ width: 104, height: 66, borderRadius: 18, border: `2px solid ${INK}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: k === 'Fee' ? GREEN : INK }}>{v}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>{k}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <Finger t={t} at={tap} x={349} y={852 - 76} size={40} />
    </AbsoluteFill>
  )
}
