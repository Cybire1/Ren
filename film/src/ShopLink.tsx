/**
 * "Your shop is a link": a 60-second film about a weaver in the mountains selling to the world with
 * Kova. Every screen is the real app, and every number is a real run on Monad testnet (4 Oct 2026):
 * Tomás' Weaves at mykova.app/s/tomas-weaves, and three buyers in the Kova iOS app, each paid in
 * about a second with no fee: Yuki $48.00 (0.9 s), Lena $22.00 (1.0 s), Sam $25.00 (1.2 s).
 *
 * Claim: a shop anywhere can sell to the world from one link, and be paid in dollars in seconds.
 *
 * Craft rules (from Apple Pay, Monzo, Mercury and Linear launch films):
 *   - The camera never stops: a slow push in every shot, a hand-held drift (noise, 2-3 px).
 *   - Scenes transform into each other instead of cutting: the mountains pan into the road, the
 *     declined card flips into Tomás' phone, the weavings fly into his stall, the camera pushes
 *     into his link, the link splits into three trails that become the buyers' phones, their
 *     dollars land on his Today card, and that phone turns round to his link.
 *   - Words rise through a mask, word by word. Objects arrive on springs converted from iOS
 *     (response 0.55, damping 0.825 → stiffness 130, damping 19). Kovi is the bouncy one.
 *   - Phones are real-looking iPhones in 3D (src/iphone.tsx), never flat-on for long.
 *   - Motion blur only on fast flights.
 *
 * Layout ledger (no archetype twice in a row, none more than twice):
 *   0.0  village   Full-bleed (paper mountains, the blanket on the loom)
 *   7.0  road      Baseline anchor (village and bank on one horizon)
 *   15.6 shop      Split (the name left, the phone right)
 *   23.4 link      Centred hero (the link, lifted out of the phone)
 *   30.2 buyers    Grid of three (three phones, three cities)
 *   46.6 today     Extreme scale contrast (a huge $95 against the phone)
 *   51.4 end       Split, unequal (the line and the mark left, the phone right)
 */
import { CameraMotionBlur } from '@remotion/motion-blur'
import { noise2D } from '@remotion/noise'
import type React from 'react'
import { AbsoluteFill, Html5Audio, Img, Sequence, spring, staticFile, useCurrentFrame } from 'remotion'
import vo from '../public/shop/audio/vo.json'
import cues from './shop-cues.json'
import { IPhone } from './iphone'
import world from './world-dots.json'
import { accel, clamp01, decel, easeInOut, FPS, hop, mix, span } from './motion'
import { Art, bezier, Captions, type Curve, Flight, Grain, Kovi, type Line, Logo, SCREEN } from './parts'
import { C } from './theme'

export const SHOP_DURATION = cues.duration
const VO = cues.vo
const LINES = vo.lines as Line[]

const display: React.CSSProperties = { fontFamily: 'Manrope', fontWeight: 800, color: C.ink, letterSpacing: -4, lineHeight: 0.98 }
const body: React.CSSProperties = { fontFamily: 'Manrope', fontWeight: 600, color: C.ink, letterSpacing: -0.5 }
const TEAL = '#46878b'
const TEAL_SOFT = '#a9c9c9'
const TEAL_MID = '#8fb9bb'
const PAPER_APP = 'rgb(231, 229, 224)'

/* ── Motion ──────────────────────────────────────────────────────────────────────────────────── */

/** iOS's default spring (response 0.55 s, damping 0.825), a heavier one for phones, a bouncy one. */
export const IOS = { mass: 1, stiffness: 130, damping: 19 }
export const HEAVY = { mass: 2, stiffness: 80, damping: 15 }
export const BOUNCY = { mass: 1, stiffness: 158, damping: 12 }
export const sp = (t: number, at: number, config = IOS) => (t < at ? 0 : spring({ frame: (t - at) * FPS, fps: FPS, config }))

/** Words rise through a mask, one after another, and leave the same way, upward. '\n' breaks lines. */
export function Words({ t, at, out, text, style, stagger = 0.07 }: { t: number; at: number; out?: number; text: string; style: React.CSSProperties; stagger?: number }) {
  let i = 0
  return (
    <div style={style}>
      {text.split('\n').map((line, l) => {
        const words = line.split(' ')
        return (
          <div key={l} style={{ whiteSpace: 'nowrap' }}>
            {words.map((word, w) => {
              const k = i++
              const e = decel(span(t, at + k * stagger, at + k * stagger + 0.7))
              const x = out === undefined ? 0 : accel(span(t, out + k * 0.03, out + k * 0.03 + 0.35))
              return (
                <span key={w} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: '0.1em', marginBottom: '-0.1em' }}>
                  <span style={{ display: 'inline-block', transform: `translateY(${(1 - e) * 110 - x * 110}%) rotate(${(1 - e) * 4}deg)`, transformOrigin: 'left bottom' }}>
                    {word}
                    {w < words.length - 1 ? ' ' : ''}
                  </span>
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/** The camera: a slow push per shot, plus a hand-held drift. */
function Camera({ t, push, children }: { t: number; push: number; children: React.ReactNode }) {
  const dx = noise2D('cam-x', t * 0.35, 0) * 3
  const dy = noise2D('cam-y', 0, t * 0.35) * 2.4
  const r = noise2D('cam-r', t * 0.2, 1) * 0.12
  return <AbsoluteFill style={{
transform: `translate(${dx}px, ${dy}px) rotate(${r}deg) scale(${push})`,
translate: "0.5px 1.4px"
}}>{children}</AbsoluteFill>
}

/* ── The film ────────────────────────────────────────────────────────────────────────────────── */

/** `voice` plays Lily's lines in the Studio; the final render is silent and mixed with the score after. */
export function ShopLink({ voice = true }: { voice?: boolean }) {
  const frame = useCurrentFrame()
  const t = frame / FPS
  // One slow push per shot; the next shot starts where the last one ended, so the camera never stops.
  const shots = [0, cues.road[0] - 0.6, cues.shopIn, cues.shareSwap, cues.buyers[0] - 0.6, cues.todayIn, cues.endIn, cues.duration]
  const shot = Math.max(0, shots.findIndex((s, i) => t >= s && t < (shots[i + 1] ?? Infinity)))
  const push = 1 + 0.035 * easeInOut(span(t, shots[shot], shots[shot + 1] ?? cues.duration))
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: 'hidden' }}>
      <Camera t={t} push={push}>
        <Village t={t} />
        <Road t={t} />
        <Shop t={t} />
        <LinkOut />
        <Buyers t={t} />
        <Today t={t} />
        <Coins />
        <End t={t} />
      </Camera>
      <Captions t={t} starts={VO} lines={LINES} />
      {voice ? <Html5Audio src={staticFile('shop/audio/score.wav')} volume={0.5} /> : null}
      {voice
        ? vo.lines.map((l) => (
            <Sequence key={l.id} from={Math.round(VO[l.id as keyof typeof VO] * FPS)} layout="none">
              <Html5Audio src={staticFile(l.file)} volume={1.6} />
            </Sequence>
          ))
        : null}
      <Grain frame={frame} />
      {/* The product, in frame from the first frame. */}
      <div style={{ position: 'absolute', left: 64, top: 52, opacity: 1 - span(t, cues.endIn - 0.6, cues.endIn) }}>
        <Logo h={46} />
      </div>
    </AbsoluteFill>
  )
}

/* ── 0–7.6: high in the mountains, a blanket on the loom ─────────────────────────────────────── */

/** The village and the road are one wide strip; the camera pans along it. */
const pan = (t: number) => easeInOut(span(t, cues.road[0] - 0.9, cues.road[0] + 0.5))

function Mountains({ t, drift }: { t: number; drift: number }) {
  const layer = (d: string, fill: string, k: number) => (
    <path d={d} fill={fill} stroke={C.ink} strokeWidth={6} strokeLinejoin="round" transform={`translate(${-drift * k} 0)`} />
  )
  const sunUp = decel(span(t, 0, 3))
  return (
    <svg width={1920} height={1080} viewBox="0 -150 1920 1080" style={{ position: 'absolute', inset: 0 }}>
      <circle cx={1000 - drift * 0.05} cy={180 - 70 * sunUp} r={92} fill={C.coralSoft} stroke={C.ink} strokeWidth={6} />
      {layer('M-400 620 L120 330 L340 520 L620 250 L900 560 L1180 300 L1460 540 L1760 280 L2320 600 L2320 1080 L-400 1080 Z', TEAL_SOFT, 0.15)}
      {layer('M-400 760 L260 470 L520 690 L820 420 L1120 700 L1420 450 L1760 720 L2320 520 L2320 1080 L-400 1080 Z', TEAL_MID, 0.35)}
      {layer('M-400 880 L380 690 L700 830 L1040 640 L1400 860 L1780 700 L2320 820 L2320 1080 L-400 1080 Z', TEAL, 0.6)}
      <g transform={`translate(${-drift * 0.6} 0)`}>
        {[
          [980, 668],
          [1060, 690],
          [1130, 676],
        ].map(([x, y], i) => (
          <g key={i}>
            <rect x={x - 26} y={y - 30} width={52} height={40} fill={C.surface} stroke={C.ink} strokeWidth={5} />
            <path d={`M${x - 34} ${y - 28} L${x} ${y - 58} L${x + 34} ${y - 28} Z`} fill={C.coral} stroke={C.ink} strokeWidth={5} strokeLinejoin="round" />
            <rect x={x - 8} y={y - 12} width={16} height={18} fill={i === 1 ? C.coralSoft : C.ink} />
          </g>
        ))}
        {/* Smoke from Tomás' chimney. */}
        {[0, 1, 2].map((k) => {
          const u = (t * 0.35 + k / 3) % 1
          return <circle key={k} cx={1062 + u * 40 + Math.sin(u * 6 + k) * 8} cy={624 - u * 130} r={6 + u * 14} fill={C.surface} stroke={C.ink} strokeWidth={4} opacity={1 - u} />
        })}
      </g>
    </svg>
  )
}

/** The blanket appears row by row on the loom, the way it's woven, with the shuttle along its edge. */
function Weaving({ t, x, y, w }: { t: number; x: number; y: number; w: number }) {
  const rows = 18
  const p = span(t, cues.weave[0], cues.weave[1])
  const done = Math.floor(p * rows) / rows
  const edge = (p * rows) % 1
  // The blanket fills 24%–91% of the art's height.
  const top = 0.24
  const bottom = 0.91
  const shown = bottom - (bottom - top) * done
  const shuttleY = y - w / 2 + w * shown
  const forward = Math.floor(p * rows) % 2 === 0
  const shuttleX = x - w * 0.33 + w * 0.66 * (forward ? edge : 1 - edge)
  const settle = sp(t, cues.weave[1], BOUNCY)
  const beamY = y - w * 0.36 + 11
  const kovi = 300
  const peek = sp(t, 3.4, BOUNCY)
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + 0.04 * Math.sin(Math.min(settle, 1) * Math.PI)})`, transformOrigin: `${x}px ${y}px` }}>
      {[-1, 1].map((s) => (
        <div key={s} style={{ position: 'absolute', left: x + s * w * 0.4 - 11, top: y - w * 0.36, width: 22, height: w * 0.9, borderRadius: 11, background: '#c99a6c', border: `5px solid ${C.ink}` }} />
      ))}
      {/* Kovi peeks over the loom's beam to watch: the ledge in his drawing is the beam. */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: beamY, overflow: 'hidden' }}>
        <Kovi pose="peek" size={kovi} x={x - 60} y={beamY - 0.137 * kovi + mix(170, 0, peek) + hop(t, cues.weave[1], 26)} />
      </div>
      <div style={{ position: 'absolute', left: x - w * 0.44, top: y - w * 0.36, width: w * 0.88, height: 22, borderRadius: 11, background: '#b98a5e', border: `5px solid ${C.ink}` }} />
      {/* Warp threads still waiting to be woven. */}
      {p < 1
        ? Array.from({ length: 13 }, (_, i) => (
            <div key={i} style={{ position: 'absolute', left: x - w * 0.3 + (w * 0.6 * i) / 12, top: y - w * 0.32, width: 3, height: Math.max(0, w * shown - w * 0.18), background: C.ink, opacity: 0.35 }} />
          ))
        : null}
      <div style={{ position: 'absolute', left: x - w / 2, top: y - w / 2, width: w, height: w, clipPath: `inset(${shown * 100}% 0 0 0)` }}>
        <Img src={staticFile('shop/art/blanket-cut.png')} style={{ width: w, height: w }} />
      </div>
      {p > 0 && p < 1 ? (
        <div style={{ position: 'absolute', left: shuttleX - 30, top: shuttleY - 12, width: 60, height: 24, borderRadius: 12, background: C.coral, border: `5px solid ${C.ink}`, transform: `rotate(${forward ? 4 : -4}deg)` }} />
      ) : null}
    </div>
  )
}

function Village({ t }: { t: number }) {
  if (t > cues.road[0] + 0.6) return null
  const drift = 70 * easeInOut(span(t, 0, 7))
  return (
    <AbsoluteFill style={{ transform: `translateX(${-1920 * pan(t)}px)` }}>
      <Mountains t={t} drift={drift} />
      <div style={{ position: 'absolute', left: 140, top: 110 }}>
        <Words t={t} at={0.8} text="Tomás" style={{ ...display, fontSize: 150 }} />
        <Words t={t} at={2.0} text="weaves in the mountains" style={{ ...body, fontSize: 42, opacity: 0.8, marginTop: 14 }} stagger={0.05} />
      </div>
      <div style={{ position: 'absolute', inset: 0, opacity: span(t, 0.1, 0.5) }}>
        <Weaving t={t} x={1420} y={560} w={500} />
      </div>
    </AbsoluteFill>
  )
}

/* ── 7.6–15.6: the nearest bank is two days away, and no card will have him ──────────────────── */

function Bank({ x, y }: { x: number; y: number }) {
  return (
    <svg width={220} height={200} viewBox="0 0 220 200" style={{ position: 'absolute', left: x - 110, top: y - 180 }}>
      <path d="M20 70 L110 20 L200 70 Z" fill={C.surface} stroke={C.ink} strokeWidth={7} strokeLinejoin="round" />
      {[45, 85, 125, 165].map((cx) => (
        <rect key={cx} x={cx - 10} y={78} width={20} height={80} fill={C.surface} stroke={C.ink} strokeWidth={6} />
      ))}
      <rect x={14} y={158} width={192} height={22} rx={4} fill={C.surface} stroke={C.ink} strokeWidth={7} />
    </svg>
  )
}

/** Where the declined card sits, and the phone it flips into. */
const CARD = { x: 960, y: 370, w: 400, h: 252 }
const SHOP_PHONE = { x: 1400, y: 520, h: 760 }
const FLIP = [cues.shopIn - 0.7, cues.shopIn + 0.5] as const

function Road({ t }: { t: number }) {
  if (t < cues.road[0] - 1.0 || t > cues.shopIn + 0.6) return null
  const leave = easeInOut(span(t, cues.shopIn - 0.7, cues.shopIn + 0.3))
  const p = easeInOut(span(t, cues.road[0], cues.road[1]))
  const from = { x: 330, y: 760 }
  const to = { x: 1610, y: 760 }
  const dots = Array.from({ length: 64 }, (_, i) => i / 63).filter((u) => u <= p)
  // Two days: the sun crosses the sky twice, with a night between.
  const day = span(t, cues.road[0], cues.road[1]) * 2
  const arc = day % 1
  const night = Math.max(0, 1 - Math.abs(day - 1) * 6)
  const walk = mix(from.x + 120, to.x - 210, p)
  const step = t > cues.road[0] && t < cues.road[1] ? Math.abs(Math.sin(t * Math.PI * 3.2)) * 22 : 0
  const declined = t >= cues.declined
  const kY = to.y - 120 - step + hop(t, cues.declined + 0.1, 34)
  const bank = sp(t, cues.road[1] - 0.3)
  return (
    <AbsoluteFill style={{ transform: `translateX(${1920 * (1 - pan(t))}px)` }}>
      <AbsoluteFill style={{ background: C.ink, opacity: night * 0.1 }} />
      {day < 2 ? (
        <div
          style={{
            position: 'absolute',
            left: mix(220, 1700, arc) - 46,
            top: 560 - Math.sin(arc * Math.PI) * 360 - 46,
            width: 92,
            height: 92,
            borderRadius: 46,
            background: C.coralSoft,
            border: `6px solid ${C.ink}`,
            opacity: 1 - leave,
          }}
        />
      ) : null}
      <div style={{ opacity: 1 - leave, transform: `translateY(${leave * 140}px)` }}>
        <div style={{ position: 'absolute', left: 80, top: 760, width: 1760, height: 5, borderRadius: 3, background: C.ink }} />
        {dots.map((u, i) => (
          <div key={i} style={{ position: 'absolute', left: mix(from.x, to.x, u) - 5, top: from.y - 45, width: 10, height: 10, borderRadius: 5, background: C.ink, opacity: 0.75 }} />
        ))}
        <svg width={360} height={180} viewBox="0 0 240 120" style={{ position: 'absolute', left: 120, top: 584 }}>
          {[40, 120, 200].map((hx) => (
            <g key={hx}>
              <rect x={hx - 26} y={60} width={52} height={58} fill={C.surface} stroke={C.ink} strokeWidth={5} />
              <path d={`M${hx - 34} 62 L${hx} 30 L${hx + 34} 62 Z`} fill={C.coral} stroke={C.ink} strokeWidth={5} strokeLinejoin="round" />
            </g>
          ))}
        </svg>
        <div style={{ opacity: bank, transform: `translateY(${(1 - bank) * 40}px)` }}>
          <Bank x={to.x} y={to.y} />
          <div style={{ position: 'absolute', left: to.x - 170, top: 790, width: 340, textAlign: 'center', ...body, fontSize: 30 }}>The nearest bank</div>
        </div>
        <Words t={t} at={cues.road[1] - 0.1} text="2 days away" style={{ position: 'absolute', left: 660, top: 640, width: 600, textAlign: 'center', ...display, fontSize: 66, letterSpacing: -2 }} />
        {!declined ? (
          <Img src={staticFile('shop/art/blanket-cut.png')} style={{ position: 'absolute', left: walk - 75, top: kY - 180, width: 150, transform: `rotate(${Math.sin(t * 6) * 5}deg)` }} />
        ) : null}
        <Kovi pose={declined ? 'oops' : 'catch'} size={180} x={walk} y={kY} />
      </div>
      <DeclinedCard t={t} />
    </AbsoluteFill>
  )
}

/** A card company's answer, which then flips over into Tomás' own phone. */
function DeclinedCard({ t }: { t: number }) {
  const flip = easeInOut(span(t, FLIP[0], FLIP[1]))
  if (flip >= 0.5 || t < cues.declined - 0.7) return null
  const inn = sp(t, cues.declined - 0.7, HEAVY)
  const stamp = sp(t, cues.declined, { mass: 1, stiffness: 300, damping: 18 })
  const shake = t > cues.declined ? Math.sin((t - cues.declined) * 55) * 12 * Math.exp(-(t - cues.declined) * 6) : 0
  const f = flip * 2
  return (
    <div
      style={{
        position: 'absolute',
        left: mix(CARD.x, SHOP_PHONE.x, f * 0.5) - CARD.w / 2 + shake,
        top: mix(-300, CARD.y, inn) - CARD.h / 2,
        width: CARD.w,
        height: CARD.h,
        perspective: 1600,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 26,
          background: C.surface,
          border: `6px solid ${C.ink}`,
          transform: `rotateZ(${mix(-8, 0, inn)}deg) rotateY(${f * 90}deg)`,
          boxShadow: '0 30px 60px -20px rgba(28,33,34,0.35)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', left: 0, right: 0, top: 46, height: 44, background: C.ink }} />
        <div style={{ position: 'absolute', left: 34, top: 126, width: 70, height: 50, borderRadius: 10, background: C.coralSoft, border: `5px solid ${C.ink}` }} />
        <div style={{ position: 'absolute', left: 34, top: 196, width: 180, height: 12, borderRadius: 6, background: C.ink, opacity: 0.25 }} />
        <div
          style={{
            position: 'absolute',
            left: 128,
            top: 112,
            padding: '6px 18px',
            border: `7px solid ${C.coral}`,
            borderRadius: 12,
            color: C.coral,
            fontFamily: 'Manrope',
            fontWeight: 800,
            fontSize: 46,
            letterSpacing: 2,
            transform: `rotate(-12deg) scale(${mix(2.6, 1, stamp)})`,
            opacity: clamp01(stamp * 3),
          }}
        >
          DECLINED
        </div>
      </div>
    </div>
  )
}

/* ── 15.6–25: his shop, photo by photo, then his link ────────────────────────────────────────── */

/** Rows of Tomás' items on his stall screen, in screenshot pixels. */
const STALL_ROWS = [1555, 1785, 2015, 2245]
const ITEMS = ['blanket', 'scarf', 'runner', 'pouch']
/** The link chip on his share screen, in screenshot pixels. */
const LINK_CHIP = { x: 590, y: 1860 }
/** Where the camera pushes in to, and where the link then lifts out. */
const LINK_AT = { x: 960, y: 470 }

function Shop({ t }: { t: number }) {
  if (t < FLIP[0] || t > cues.linkOut + 1) return null
  const flip = easeInOut(span(t, FLIP[0], FLIP[1]))
  const f = clamp01(flip * 2 - 1)
  if (f <= 0) return null
  // The phone turns in from edge-on where the card turned away, and settles at its place.
  const settle = sp(t, FLIP[0] + (FLIP[1] - FLIP[0]) / 2, HEAVY)
  const x = mix(mix(CARD.x, SHOP_PHONE.x, 0.5), SHOP_PHONE.x, settle)
  const y = mix(CARD.y, SHOP_PHONE.y, settle)
  const drift = span(t, cues.shopIn, cues.linkOut)
  const swap = span(t, cues.shareSwap, cues.shareSwap + 0.35)
  // At the link, the camera pushes into the screen, toward the link chip.
  const zoom = easeInOut(span(t, cues.linkOut - 1.0, cues.linkOut + 0.1))
  const leave = accel(span(t, cues.linkOut + 0.1, cues.linkOut + 0.6))
  const k = SHOP_PHONE.h / SCREEN.h
  const chip = { x: SHOP_PHONE.x + (LINK_CHIP.x - SCREEN.w / 2) * k, y: SHOP_PHONE.y + (LINK_CHIP.y - SCREEN.h / 2) * k }
  const Z = 1 + 1.4 * zoom
  return (
    <AbsoluteFill
  style={{
    transform: `translate(${(LINK_AT.x - chip.x) * zoom}px, ${(LINK_AT.y - chip.y) * zoom}px) scale(${Z})`,
    transformOrigin: `${chip.x}px ${chip.y}px`,
    opacity: 1 - leave,
  }}
  from={-1}>
      <div style={{ position: 'absolute', left: 150, top: 330, opacity: 1 - zoom }}>
        <Words t={t} at={cues.shopIn + 0.3} out={cues.shareSwap - 0.4} text={'Tomás’\nWeaves'} style={{ ...display, fontSize: 128 }} />
        <Words t={t} at={cues.shopIn + 1.0} out={cues.shareSwap - 0.4} text="open in a minute" style={{ ...body, fontSize: 42, opacity: 0.8, marginTop: 26 }} stagger={0.05} />
      </div>
      <IPhone
        src="shop/tomas-run2/stall.png"
        to="shop/tomas-run2/share.png"
        swap={swap}
        h={SHOP_PHONE.h}
        x={x}
        y={y}
        scale={mix(0.6, 1, settle)}
        ry={mix(mix(-90, -16, f) + 8 * drift, 0, zoom)}
        rx={mix(6 - 3 * drift, 0, zoom)}
        shadow={1 - zoom}
      >
        {/* Each row glows as its weaving lands in it. */}
        {swap < 0.5
          ? STALL_ROWS.map((ry, i) => {
              const g = span(t, (cues.items[i] as number) + 0.5, (cues.items[i] as number) + 1.1)
              return <div key={ry} style={{ position: 'absolute', left: 40, top: ry - 105, width: 1100, height: 210, borderRadius: 40, background: C.coralSoft, opacity: 0.4 * Math.sin(g * Math.PI) }} />
            })
          : null}
      </IPhone>
      {/* Photo by photo: each weaving pops up beside the phone and flies into its row. */}
      {swap < 0.5
        ? ITEMS.map((name, i) => {
            const at = cues.items[i] as number
            const pop = sp(t, at - 0.5, BOUNCY)
            const fly = easeInOut(span(t, at, at + 0.55))
            if (pop <= 0 || fly >= 1) return null
            const rowY = SHOP_PHONE.y + (STALL_ROWS[i] - SCREEN.h / 2) * k
            const rowX = SHOP_PHONE.x + (165 - SCREEN.w / 2) * k
            const start = { x: 900, y: 700 }
            const c: Curve = [start, { x: start.x + 120, y: start.y - 240 }, { x: rowX - 120, y: rowY - 180 }, { x: rowX, y: rowY }]
            const p = bezier(c, fly)
            return (
              <Img
                key={name}
                src={staticFile(`shop/art/${name}-cut.png`)}
                style={{
                  position: 'absolute',
                  left: p.x - 150,
                  top: p.y - 150,
                  width: 300,
                  height: 300,
                  transform: `scale(${mix(1, 0.3, fly) * pop}) rotate(${(i % 2 ? 8 : -8) * (1 - fly)}deg)`,
                }}
              />
            )
          })
        : null}
    </AbsoluteFill>
  )
}

/* ── 25–30.2: his whole shop, one link, out into the world ───────────────────────────────────── */

/** The buyers' phones. The link's three trails end where they stand. */
const BUYERS = [
  { id: 'yuki', city: 'Tokyo', x: 1500, took: '0.9 s', ry: -14 },
  { id: 'lena', city: 'Berlin', x: 960, took: '1.0 s', ry: 0 },
  { id: 'sam', city: 'New York', x: 420, took: '1.2 s', ry: 14 },
]
const BUYER_Y = 535
const BUYER_H = 640

function LinkPill({ x, y, s, r, o, lift }: { x: number; y: number; s: number; r: number; o: number; lift: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 390,
        top: y - 52,
        width: 780,
        whiteSpace: 'nowrap',
        height: 104,
        borderRadius: 52,
        background: C.surface,
        border: `6px solid ${C.ink}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        ...body,
        fontWeight: 700,
        fontSize: 46,
        transform: `scale(${s}) rotate(${r}deg)`,
        boxShadow: `0 ${30 * lift}px ${60 * lift}px -20px rgba(28,33,34,0.35)`,
        opacity: o,
      }}
    >
      <span style={{ width: 22, height: 22, borderRadius: 11, background: C.coral, border: `4px solid ${C.ink}` }} />
      mykova.app/s/tomas-weaves
    </div>
  )
}

/** A small round link, the copy each far city receives. */
function LinkToken({ x, y, s, o }: { x: number; y: number; s: number; o: number }) {
  return (
    <div style={{ position: 'absolute', left: x - 46, top: y - 46, width: 92, height: 92, borderRadius: 46, background: C.surface, border: `6px solid ${C.ink}`, transform: `scale(${s})`, opacity: o, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth={2.6} strokeLinecap="round">
        <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
      </svg>
    </div>
  )
}

/* The world, as dots: land from Natural Earth 110m, every 2°, equirectangular from 170°W. */
const MAP = { x: 80, y: 196, w: 1760 }
const toMap = (lon: number, lat: number) => ({ x: MAP.x + ((lon + 170) / 360) * MAP.w, y: MAP.y + ((72 - lat) / 360) * MAP.w })
/** Tomás' village, high in the Andes. */
const VILLAGE = toMap(-72, -13.5)
const CITY = { yuki: toMap(139.7, 35.7), lena: toMap(13.4, 52.5), sam: toMap(-74, 40.7) } as const
const ARC_AT = [0.5, 0.75, 1.0].map((d) => cues.fly[0] + d)
const ARC_LEN = 1.5
/** The flight arc from the village to a city: a bezier lifted in proportion to its length. */
function arcTo(to: { x: number; y: number }): Curve {
  const d = Math.hypot(to.x - VILLAGE.x, to.y - VILLAGE.y)
  const lift = d * 0.38
  return [VILLAGE, { x: mix(VILLAGE.x, to.x, 0.25), y: Math.min(VILLAGE.y, to.y) - lift }, { x: mix(VILLAGE.x, to.x, 0.75), y: Math.min(VILLAGE.y, to.y) - lift }, to]
}

function LinkOut() {
  const frame = useCurrentFrame()
  const t = frame / FPS
  if (t < cues.linkOut - 0.1 || t > cues.fly[1] + 1.4) return null
  const lift = sp(t, cues.linkOut, HEAVY)
  // The camera pulls back: the link shrinks into Tomás' village on a map of the world.
  const back = easeInOut(span(t, cues.fly[0] - 0.3, cues.fly[0] + 0.7))
  const leave = easeInOut(span(t, cues.fly[1] - 0.2, cues.fly[1] + 0.9))
  const Z = mix(3.2, 1, back)
  return (
    <AbsoluteFill>
      {back > 0 ? (
        <AbsoluteFill
          style={{
            transform: `translate(${(960 - VILLAGE.x) * (1 - back)}px, ${(540 - VILLAGE.y) * (1 - back)}px) scale(${Z})`,
            transformOrigin: `${VILLAGE.x}px ${VILLAGE.y}px`,
            opacity: span(back, 0, 0.3) * (1 - leave),
          }}
        >
          <WorldMap t={t} />
        </AbsoluteFill>
      ) : null}
      {back < 1 ? (
        <LinkPill
          x={mix(LINK_AT.x, 960, back)}
          y={mix(LINK_AT.y, 540, back)}
          s={mix(0.5, 1, lift) * mix(1, 0.05, accel(back))}
          r={mix(-6, 0, lift)}
          o={span(t, cues.linkOut - 0.1, cues.linkOut + 0.1) * (1 - span(back, 0.6, 0.9))}
          lift={lift}
        />
      ) : null}
      <Words t={t} at={cues.linkOut + 0.5} out={cues.fly[0] - 0.5} text="His whole shop, one link." style={{ position: 'absolute', left: 0, right: 0, top: 600, textAlign: 'center', ...display, fontSize: 84, letterSpacing: -3 }} />
    </AbsoluteFill>
  )
}

/** The dotted world: dots ripple in outward from the village, then the link flies to three cities. */
function WorldMap({ t }: { t: number }) {
  const reveal = (t - (cues.fly[0] - 0.3)) * 1400
  const buyers = [
    { id: 'yuki', city: 'Tokyo' },
    { id: 'lena', city: 'Berlin' },
    { id: 'sam', city: 'New York' },
  ] as const
  return (
    <>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {(world.dots as [number, number][]).map(([lon, lat], i) => {
          const p = toMap(lon, lat)
          const d = Math.hypot(p.x - VILLAGE.x, p.y - VILLAGE.y)
          const a = clamp01((reveal - d) / 260)
          if (a <= 0) return null
          return <circle key={i} cx={p.x} cy={p.y} r={4.2 * mix(0.3, 1, a)} fill={TEAL_MID} opacity={0.55 + 0.45 * a * 0} />
        })}
        {/* Three arcs, drawn as the link flies them. */}
        {buyers.map((b, i) => {
          const c = arcTo(CITY[b.id])
          const p = easeInOut(span(t, ARC_AT[i], ARC_AT[i] + ARC_LEN))
          const pts = Array.from({ length: 48 }, (_, k) => k / 47).filter((u) => u <= p).map((u) => bezier(c, u))
          return <polyline key={b.id} points={pts.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke={C.ink} strokeWidth={5} strokeLinecap="round" strokeDasharray="0.1 14" />
        })}
      </svg>
      {/* The village pin. */}
      <Pin x={VILLAGE.x} y={VILLAGE.y} t={t} at={cues.fly[0] + 0.2} color={C.coral} label="Tomás" below />
      {buyers.map((b, i) => {
        const c = arcTo(CITY[b.id])
        const p = easeInOut(span(t, ARC_AT[i], ARC_AT[i] + ARC_LEN))
        const head = bezier(c, p)
        const arrive = ARC_AT[i] + ARC_LEN
        return (
          <div key={b.id}>
            {p > 0 && p < 1 ? (
              b.id === 'lena' ? (
                <Flight curve={c} p={p} size={150} trail={false} />
              ) : (
                <LinkToken x={head.x} y={head.y} s={0.7} o={1} />
              )
            ) : null}
            <Pin x={CITY[b.id].x} y={CITY[b.id].y} t={t} at={arrive} color={C.ink} label={b.city} />
          </div>
        )
      })}
    </>
  )
}

/** A city on the map: a dot that lands with a ripple, and its name. */
function Pin({ x, y, t, at, color, label, below = false }: { x: number; y: number; t: number; at: number; color: string; label: string; below?: boolean }) {
  const s = sp(t, at, BOUNCY)
  const ring = span(t, at, at + 0.8)
  if (s <= 0) return null
  return (
    <>
      {ring < 1 ? <div style={{ position: 'absolute', left: x - 60, top: y - 60, width: 120, height: 120, borderRadius: 60, border: `5px solid ${color}`, transform: `scale(${mix(0.2, 1.4, decel(ring))})`, opacity: 1 - ring }} /> : null}
      <div style={{ position: 'absolute', left: x - 17, top: y - 17, width: 34, height: 34, borderRadius: 17, background: color, border: `6px solid ${C.ink}`, transform: `scale(${s})` }} />
      <div
        style={{
          position: 'absolute',
          left: x - 200,
          width: 400,
          top: below ? y + 30 : y - 92,
          textAlign: 'center',
          ...display,
          fontSize: 44,
          letterSpacing: -1.5,
          transform: `translateY(${(1 - s) * 20}px) scale(${s})`,
          opacity: clamp01(s),
        }}
      >
        <span style={{ background: C.paper, padding: '2px 14px', borderRadius: 12 }}>{label}</span>
      </div>
    </>
  )
}

/* ── 30.2–46.6: Tokyo, Berlin, New York, each paid in about a second ─────────────────────────── */

/** The Pay button on the review screen, in screenshot pixels. */
const PAY_BUTTON = { x: 590, y: 2320 }

function Buyers({ t }: { t: number }) {
  if (t < cues.fly[1] - 0.4 || t > cues.todayIn + 0.8) return null
  const leave = easeInOut(span(t, cues.todayIn - 0.8, cues.todayIn + 0.2))
  return (
    <AbsoluteFill style={{ transform: `translateX(${-leave * 500}px) scale(${1 - 0.2 * leave})`, transformOrigin: '0% 50%', opacity: 1 - leave }}>
      {BUYERS.map((b, i) => {
        const inAt = cues.fly[1] + 0.1 + i * 0.15
        const pin = CITY[b.id as keyof typeof CITY]
        const bagAt = cues.bags[i] as number
        const paidAt = cues.paid[i] as number
        const payAt = mix(bagAt, paidAt, 0.5)
        const inn = sp(t, inAt, HEAVY)
        // The storefront, the bag, the review, Paid!: each a quick crossfade.
        const stages = [`shop/app/${b.id}/shop.png`, `shop/app/${b.id}/bag.png`, `shop/app/${b.id}/pay.png`, `shop/app/${b.id}/paid.png`]
        const at = [-Infinity, bagAt, payAt, paidAt]
        const cur = at.reduce((k, s, j) => (t >= s ? j : k), 0)
        const fresh = cur === 0 ? 1 : span(t, at[cur], at[cur] + 0.3)
        const bump = sp(t, paidAt, BOUNCY)
        const drift = span(t, inAt, cues.todayIn)
        return (
          <div key={b.id}>
            <Words t={t} at={(cues.buyers[i] as number) - 0.1} text={b.city} style={{ position: 'absolute', left: b.x - 260, width: 520, top: 56, textAlign: 'center', ...display, fontSize: 60, letterSpacing: -2 }} />
            <IPhone
              src={stages[Math.max(0, cur - 1)]}
              to={stages[cur]}
              swap={fresh}
              h={BUYER_H}
              x={mix(pin.x, b.x, inn)}
              y={mix(pin.y, BUYER_Y, inn) + hop(t, paidAt, 16)}
              ry={mix(b.ry * 2.4, b.ry, inn) - 5 * drift * Math.sign(b.ry)}
              rx={mix(24, 5, inn)}
              scale={mix(0.06, 1, inn) * (1 + 0.05 * Math.sin(Math.min(bump, 1) * Math.PI))}
            >
              <Tap3 t={t} at={paidAt - 0.6} x={PAY_BUTTON.x} y={PAY_BUTTON.y} />
            </IPhone>
            {t >= paidAt + 0.2 ? (
              <div
                style={{
                  position: 'absolute',
                  left: b.x - 160,
                  top: 830,
                  width: 320,
                  height: 72,
                  borderRadius: 36,
                  background: C.ink,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...body,
                  color: '#fff',
                  fontSize: 32,
                  transform: `scale(${sp(t, paidAt + 0.2, BOUNCY)})`,
                }}
              >
                Paid in {b.took}
              </div>
            ) : null}
            <Burst t={t} at={paidAt} x={b.x} y={BUYER_Y - 100} />
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

/** A finger's tap, in screenshot pixels: a soft press and a ring. */
function Tap3({ t, at, x, y }: { t: number; at: number; x: number; y: number }) {
  const p = span(t, at, at + 0.5)
  if (p <= 0 || p >= 1) return null
  return (
    <>
      <div style={{ position: 'absolute', left: x - 90, top: y - 90, width: 180, height: 180, borderRadius: 90, background: 'rgba(255,255,255,0.6)', transform: `scale(${mix(0.6, 1, decel(p))})`, opacity: 1 - p }} />
      <div style={{ position: 'absolute', left: x - 150, top: y - 150, width: 300, height: 300, borderRadius: 150, border: `14px solid ${C.coral}`, transform: `scale(${mix(0.4, 1.3, decel(p))})`, opacity: 1 - p }} />
    </>
  )
}

/** Sparkles bursting out from a point. Deterministic. */
function Burst({ t, at, x, y }: { t: number; at: number; x: number; y: number }) {
  const p = span(t, at, at + 0.9)
  if (p <= 0 || p >= 1) return null
  const arts = ['sparkle-1', 'sparkle-4', 'sparkle-8', 'sparkle-11']
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.4
        const r = mix(40, 230 + (i % 3) * 30, decel(p))
        return (
          <Art
            key={i}
            name={arts[i % 4]}
            w={46 + (i % 3) * 14}
            ratio={1}
            x={x + Math.cos(a) * r}
            y={y + Math.sin(a) * r * 0.8}
            style={{ opacity: 1 - accel(p), transform: `rotate(${p * 180 * (i % 2 ? 1 : -1)}deg) scale(${mix(0.4, 1, decel(span(p, 0, 0.3)))})` }}
          />
        )
      })}
    </>
  )
}

/* ── 44–51.4: the dollars fly home and land on Tomás' Today card ─────────────────────────────── */

const TODAY_PHONE = { x: 1340, y: 520, h: 800 }
/** The "Taken today" number on the Today screen, in screenshot pixels. */
const TODAY_NUMBER = { x: 120, y: 650, w: 600, h: 170 }
/** The fourth row is an earlier, expired order: framed out with the screen's own paper. */
const EXPIRED_ROW = { y: 1530, h: 180 }
const SALES = [48, 70, 95]

function Coins() {
  const frame = useCurrentFrame()
  const t = frame / FPS
  if (t < (cues.count[0] as number) - 1.6 || t > (cues.count[2] as number) + 0.2) return null
  const k = TODAY_PHONE.h / SCREEN.h
  const target = { x: TODAY_PHONE.x + (TODAY_NUMBER.x + 240 - SCREEN.w / 2) * k, y: TODAY_PHONE.y + (TODAY_NUMBER.y + 80 - SCREEN.h / 2) * k }
  return (
    <CameraMotionBlur shutterAngle={180} samples={6}>
      <AbsoluteFill>
        {BUYERS.map((b, i) => {
          const a = cues.count[i] as number
          const p = easeInOut(span(t, a - 1.4, a))
          if (p <= 0 || p >= 1) return null
          const c: Curve = [{ x: b.x - 200, y: 1150 }, { x: b.x, y: 200 }, { x: target.x - 260, y: target.y - 340 }, target]
          const at = bezier(c, p)
          return <Art key={b.id} name="coin-usd" w={mix(120, 70, p)} x={at.x} y={at.y} ratio={1} style={{ transform: `rotate(${p * 720}deg)` }} />
        })}
      </AbsoluteFill>
    </CameraMotionBlur>
  )
}

/* ── 46.6–52: today, Tomás took $95 ──────────────────────────────────────────────────────────── */

function Today({ t }: { t: number }) {
  if (t < cues.todayIn - 1.0) return null
  const inn = sp(t, cues.todayIn - 0.8, HEAVY)
  const count = cues.count as number[]
  const shown = SALES.reduce((v, sale, i) => (t >= count[i] ? sale : v), 0)
  const lastHit = count.reduce((v, c) => (t >= c ? c : v), -10)
  const thump = 1 + 0.06 * Math.exp(-(t - lastHit) * 9) * (t >= lastHit ? 1 : 0)
  // At the end the phone turns round and shows his link.
  const turn = easeInOut(span(t, cues.endIn - 0.3, cues.endIn + 0.6))
  const showShare = turn > 0.5
  const toEnd = easeInOut(span(t, cues.endIn - 0.3, cues.endIn + 0.8))
  const ry = turn <= 0 ? mix(-40, -12, inn) : turn < 0.5 ? mix(-12, -90, turn * 2) : mix(90, 10, turn * 2 - 1)
  const textOut = span(t, cues.endIn - 0.7, cues.endIn - 0.2)
  return (
    <AbsoluteFill>
      <IPhone
        src={showShare ? 'shop/tomas-run2/share.png' : 'shop/tomas-run2/today-clean.png'}
        h={mix(TODAY_PHONE.h, 780, toEnd)}
        x={mix(mix(2400, TODAY_PHONE.x, inn), 1460, toEnd)}
        y={mix(TODAY_PHONE.y, 500, toEnd)}
        ry={ry}
        rx={4}
        rotate={mix(0, 3, toEnd)}
      >
        {!showShare ? (
          <>
            <div style={{ position: 'absolute', left: 0, top: EXPIRED_ROW.y, width: SCREEN.w, height: EXPIRED_ROW.h, background: PAPER_APP }} />
            {/* The real number, counted up through the three real sales. */}
            <div style={{ position: 'absolute', left: TODAY_NUMBER.x, top: TODAY_NUMBER.y, width: TODAY_NUMBER.w, height: TODAY_NUMBER.h, background: C.todayCard }} />
            <div
              style={{
                position: 'absolute',
                left: 126,
                top: 640,
                fontFamily: 'Manrope',
                fontWeight: 700,
                fontSize: 156,
                letterSpacing: -6,
                color: C.ink,
                fontVariantNumeric: 'tabular-nums',
                transform: `scale(${thump})`,
                transformOrigin: 'left center',
              }}
            >
              ${shown}.00
            </div>
          </>
        ) : null}
      </IPhone>
      {t < cues.endIn ? (
        <div style={{ position: 'absolute', left: 150, top: 250, opacity: 1 - textOut }}>
          <Words t={t} at={cues.todayIn + 0.3} text="Today, Tomás took" style={{ ...body, fontSize: 44, opacity: 0.8 }} stagger={0.05} />
          <div style={{ ...display, fontSize: 250, letterSpacing: -10, marginTop: 6, transform: `scale(${thump})`, transformOrigin: 'left center', opacity: span(t, count[0] - 0.2, count[0]) }}>${shown}</div>
          <Words t={t} at={count[2]} text="3 sales · $0.00 in fees" style={{ ...body, fontSize: 40, opacity: 0.8, marginTop: 4 }} stagger={0.05} />
        </div>
      ) : null}
      {t < cues.endIn ? (
        <Kovi pose="cheer" size={210} x={960} y={mix(1250, 860, sp(t, count[0], BOUNCY)) + hop(t, count[2], 50)} style={{ opacity: 1 - textOut }} />
      ) : null}
    </AbsoluteFill>
  )
}

/* ── 51.4–60: your shop is a link ────────────────────────────────────────────────────────────── */

function End({ t }: { t: number }) {
  if (t < cues.endIn - 0.2) return null
  const logo = sp(t, cues.logo)
  const url = sp(t, cues.url, BOUNCY)
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 150, top: 270 }}>
        <Words t={t} at={cues.line - 0.1} text="Your shop" style={{ ...display, fontSize: 138 }} />
        <Words t={t} at={cues.line + 0.35} text="is a link." style={{ ...display, fontSize: 138, color: C.coral }} />
      </div>
      <div style={{ position: 'absolute', left: 150, top: 640, opacity: logo, transform: `translateY(${(1 - logo) * 30}px)` }}>
        <Logo h={96} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 790,
          padding: '16px 34px',
          borderRadius: 999,
          border: `5px solid ${C.ink}`,
          background: C.surface,
          ...body,
          fontWeight: 700,
          fontSize: 46,
          transform: `scale(${url})`,
          transformOrigin: 'left center',
        }}
      >
        mykova.app
      </div>
      <Kovi pose="wave" size={210} x={1110} y={mix(1250, 830, sp(t, cues.logo + 0.2, BOUNCY))} />
    </AbsoluteFill>
  )
}
