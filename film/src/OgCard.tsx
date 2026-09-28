/**
 * The link preview for mykova.app (1200 x 630, what Discord, X and WhatsApp show under a link).
 * Editorial left: the tagline from Kova's X profile. Right: Kovi on his paper plane over the coral
 * arc, leaving a little shop, with the proof from a real receipt on a chip beside him.
 */
import { AbsoluteFill } from 'remotion'
import { Art, bezier, type Curve, Kovi, Logo } from './parts'
import { C } from './theme'

const ARC: Curve = [
  { x: 640, y: 505 },
  { x: 710, y: 260 },
  { x: 985, y: 150 },
  { x: 1160, y: 170 },
]

export function OgCard() {
  const dots = Array.from({ length: 26 }, (_, i) => bezier(ARC, i / 25)).filter((_, i) => i < 16)
  const kovi = bezier(ARC, 0.66)
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 78, top: 118, fontFamily: 'Manrope', fontWeight: 800, fontSize: 112, lineHeight: 0.98, letterSpacing: -4.5, color: C.ink }}>
        Tap. Paid.
        <br />
        Anywhere.
      </div>
      <div style={{ position: 'absolute', left: 80, top: 410, fontFamily: 'Manrope', fontWeight: 600, fontSize: 30, letterSpacing: -0.3, color: C.ink, opacity: 0.66 }}>
        Your dollars, anywhere, in seconds.
      </div>
      <div style={{ position: 'absolute', left: 80, bottom: 62 }}>
        <Logo h={56} />
      </div>

      {dots.map((d, i) => (
        <div key={i} style={{ position: 'absolute', left: d.x - 6, top: d.y - 6, width: 12, height: 12, borderRadius: 6, background: C.coral }} />
      ))}
      <Art name="badge-shop" w={132} x={615} y={528} ratio={1} />
      <Kovi pose="ride" size={330} x={kovi.x + 10} y={kovi.y - 40} rotate={-8} />
      <Art name="coin-usd" w={92} x={1120} y={400} ratio={1} style={{ transform: 'rotate(-12deg)' }} />
      <Art name="coin-eur" w={68} x={1060} y={452} ratio={1} style={{ transform: 'rotate(10deg)' }} />
      <Art name="sparkle-1" w={46} x={700} y={120} ratio={1} />
      <Art name="sparkle-4" w={34} x={1150} y={300} ratio={1} />
      <Art name="sparkle-8" w={28} x={760} y={390} ratio={1} />
      <Art name="sparkle-11" w={30} x={1000} y={600} ratio={1} />

      {/* The proof, from a real receipt: a coffee paid on Monad testnet. */}
      <div
        style={{
          position: 'absolute',
          left: 735,
          top: 528,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 22px 12px 14px',
          borderRadius: 999,
          background: C.surface,
          border: `3px solid ${C.ink}`,
          fontFamily: 'Manrope',
          transform: 'rotate(-3deg)',
        }}
      >
        <svg width={32} height={32} viewBox="0 0 32 32">
          <circle cx={16} cy={16} r={16} fill={C.coral} />
          <path d="M9.5 16.5 L14 21 L22.5 11.5" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <span style={{ fontWeight: 700, fontSize: 26, color: C.ink, letterSpacing: -0.3 }}>paid in 1.6 s</span>
        <span style={{ fontWeight: 600, fontSize: 22, color: C.ink, opacity: 0.6 }}>$0.00 fee</span>
      </div>
    </AbsoluteFill>
  )
}
