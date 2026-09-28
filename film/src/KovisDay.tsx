/**
 * "Kovi's day": a 40-second intro for Kova, built from the real app's own screens and one real
 * day of payments on Monad's test network ($40 in the morning, a $4.50 coffee, $20 to a friend,
 * six bakery sales worth $33.75, $49.25 at night; every number is on a real screen).
 *
 * Claim: Kova moves dollars anywhere in seconds, and the fee is on Kova.
 *
 * Motion (src/motion.ts): Hero Reveal for words, Rise for objects, one fade exit; Kovi is the one
 * bouncy spring. Camera: three moves (the push into the receipt, the globe, the till's takings).
 * Signature: the arc over the globe lights up under Kovi, and his dollar lands as euros. Once.
 *
 * Layout ledger (no archetype twice in a row, none more than twice):
 *   0.0  morning   Split (phone right, the name left)
 *   5.2  coffee    Baseline anchor (phone and till on one horizon)
 *   9.2  proof     Extreme scale contrast (a huge 1.6 against the receipt's rows)
 *   13.7 globe     Full-bleed (the painted globe, edge to edge)
 *   16.9 friend    Split, unequal (Ada's phone small left, Tomás's large right)
 *   20.0 shop      Z-axis cascade (the takings phone over the till, the wallet card over both)
 *   28.6 end       Centred hero (Kovi, the mark, the address)
 *   36.3 button    Baseline anchor (Kovi asleep on the horizon)
 *
 * Audit: enter styles 2 (Hero Reveal, Rise) · runs without a ≥1.5 s hold: 0 · every exit animated ·
 * bouncy springs: Kovi only · camera moves 3, each ≥1.5 s · accent colours: coral only.
 */
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion'
import arcDots from './arc-dots.json'
import cues from './cues.json'
import { clamp01, decel, easeInOut, FPS, hero, hop, mix, presenceStyle, rise, span } from './motion'
import { Art, Captions, type Curve, Flight, Grain, Kovi, Logo, onScreen, Phone, type Pt, Tap, Underline, bezier } from './parts'
import { C } from './theme'

/** Every timing lives in cues.json, which the score (scripts/score.py) reads too. */
export const DURATION = cues.duration
export const VO = cues.vo

const display: React.CSSProperties = { fontFamily: 'Manrope', fontWeight: 800, color: C.ink, letterSpacing: -4, lineHeight: 0.9 }

export function KovisDay() {
  const frame = useCurrentFrame()
  const t = frame / FPS
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: 'hidden' }}>
      <MorningToProof t={t} />
      <Globe t={t} />
      <Friend t={t} />
      <Shop t={t} />
      <End t={t} />
      <Button t={t} />
      <Captions t={t} starts={VO} />
      <Grain frame={frame} />
    </AbsoluteFill>
  )
}

/* ── 0.0–13.8: one phone carries the morning, the coffee and the proof ─────────────────────── */

const PHONE_A = { x: 1250, y: 585, h: 700, rotate: -3 }
const PHONE_B = { x: 540, y: 550, h: 700, rotate: 0 }
const TAP = cues.tap // on the word "tap"
const FLY = { from: cues.fly[0], to: cues.fly[1] }
const TILL = { x: 1440, y: 702, w: 380 }
const ROWS = { took: 1446, fee: 1550 } // receipt rows' baselines, in screen pixels

function MorningToProof({ t }: { t: number }) {
  if (t > 13.9) return null
  const move = decel(span(t, 5.2, 6.0))
  const phone = {
    x: mix(PHONE_A.x, PHONE_B.x, move),
    y: mix(PHONE_A.y, PHONE_B.y, move),
    h: mix(PHONE_A.h, PHONE_B.h, move),
    rotate: mix(PHONE_A.rotate, PHONE_B.rotate, move),
  }
  // The screens follow the story: Home, the coffee's checkout, its receipt.
  const toCheckout = span(t, 5.5, 5.9)
  const toReceipt = span(t, 9.2, 9.45)
  const src = t < 9.2 ? 'screens/01-home-morning.png' : 'screens/02-pay-coffee.png'
  const to = t < 9.2 ? 'screens/02-pay-coffee.png' : 'screens/03-receipt-coffee.png'
  const swap = t < 9.2 ? toCheckout : toReceipt

  // Camera move 1: into the receipt's proof rows, which settle beside the big number.
  const zoom = easeInOut(span(t, cues.zoom[0], cues.zoom[1]))
  const anchor = onScreen(phone, 590, 1500)
  const z = mix(1, 2.15, zoom)
  const dx = (1290 - anchor.x) * zoom
  const dy = (560 - anchor.y) * zoom
  const exitAll = rise(t, -1, 13.5)

  // Kovi: asleep on the phone, awake at his name, into the balance card's coin on "lives in Kova",
  // back out for the coffee, off on his plane at the tap, cheering at the till.
  const topOfPhone = { x: phone.x + 60 * (1 - move) + 30 * move, y: phone.y - phone.h / 2 - 72 }
  const coin = onScreen(phone, 895, 731, phone.rotate)
  const [diveFrom, diveTo, backFrom, backTo] = cues.lives
  const dive = easeInOut(span(t, diveFrom, diveTo))
  const back = easeInOut(span(t, backFrom, backTo))
  const inCoin = t >= diveTo && t < backFrom
  const bob = Math.sin(t * 3.2) * 5
  const flight: Curve = [
    { x: PHONE_B.x + 30, y: PHONE_B.y - PHONE_B.h / 2 - 72 },
    { x: 760, y: -40 },
    { x: 1250, y: -10 },
    { x: TILL.x, y: TILL.y - 250 },
  ]
  const flightP = easeInOut(span(t, FLY.from, FLY.to))
  const landed = t >= FLY.to

  return (
    <AbsoluteFill style={{ opacity: exitAll.opacity, transform: `translateY(${exitAll.y}px)` }}>
      {/* The name, the way a short film introduces its lead. */}
      <div style={{ position: 'absolute', left: 170, top: 330, ...presenceStyle(rise(t, -1, 5.0)) }}>
        <div style={{ ...display, fontSize: 210 }}>Kovi</div>
        <div style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 44, color: C.ink, opacity: 0.72, marginTop: 26, letterSpacing: -0.5, ...presenceStyle(rise(t, VO.morning + 1.0)) }}>
          A dollar who lives in Kova
        </div>
      </div>

      {/* The horizon and the cafe's till, for the coffee. */}
      <div style={{ position: 'absolute', left: 150, top: 900, height: 4, borderRadius: 2, background: C.ink, width: 1620 * decel(span(t, 5.4, 6.1)), opacity: 1 - span(t, 9.2, 9.5) }} />
      <Art name="scene-paid-terminal" w={TILL.w} x={TILL.x} y={TILL.y + hop(t, FLY.to, 18)} ratio={750 / 720} style={{ ...presenceStyle(rise(t, 5.9, 9.2)) }} />
      {landed && t < 9.3
        ? [
            { n: 'sparkle-4', x: TILL.x - 230, y: TILL.y - 250, s: 56 },
            { n: 'sparkle-8', x: TILL.x + 230, y: TILL.y - 190, s: 46 },
            { n: 'sparkle-11', x: TILL.x + 170, y: TILL.y - 330, s: 44 },
          ].map((s) => <Art key={s.n} name={s.n} w={s.s} x={s.x} y={s.y} ratio={1} style={presenceStyle(rise(t, FLY.to + 0.05, 9.0, 20))} />)
        : null}

      {/* The phone, and the camera's one push into it. */}
      <div style={{ position: 'absolute', inset: 0, transformOrigin: `${anchor.x}px ${anchor.y}px`, transform: `translate(${dx}px, ${dy}px) scale(${z})` }}>
        <Phone src={src} to={to} swap={swap} h={phone.h} x={phone.x} y={phone.y + rise(t, -0.4).y} rotate={phone.rotate}>
          <Tap t={t} at={TAP} x={590} y={2322} />
          <Underline t={t} at={cues.underlines[0]} x={70} y={ROWS.took + 18} w={1040} />
          <Underline t={t} at={cues.underlines[1]} x={70} y={ROWS.fee + 18} w={1040} />
        </Phone>
      </div>

      {/* Kovi's morning. */}
      {t < cues.wake ? <Kovi pose="sleep" size={220} x={topOfPhone.x} y={topOfPhone.y + 34} rotate={-3} /> : null}
      {t >= cues.wake && t < diveFrom ? (
        <Kovi pose="wave" size={190} x={topOfPhone.x} y={topOfPhone.y + hop(t, cues.wake, 70) + bob} rotate={-3} />
      ) : null}
      {t >= diveFrom && t < diveTo ? <Hop from={topOfPhone} to={coin} p={dive} sizes={[190, 62]} fadeOut /> : null}
      {inCoin ? <CoinBreath t={t} at={coin} from={diveTo} /> : null}
      {t >= backFrom && t < 5.2 ? <Hop from={coin} to={topOfPhone} p={back} sizes={[62, 190]} /> : null}
      {t >= 5.2 && t < FLY.from ? <Kovi pose="catch" size={190} x={topOfPhone.x} y={topOfPhone.y + bob} /> : null}
      <Flight curve={flight} p={flightP} size={230} trail color={C.ink} fade={1 - span(t, 9.2, 9.5)} />
      {landed && t < 9.3 ? <Kovi pose="cheer" size={220} x={TILL.x} y={TILL.y - 290 + hop(t, FLY.to, 80)} style={presenceStyle(rise(t, FLY.to - 0.3, 9.1, 0))} /> : null}

      {/* The proof: the receipt's own number, as big as the frame allows. */}
      <div style={{ position: 'absolute', left: 140, top: 250, ...presenceStyle(hero(t, cues.proof)) }}>
        <div style={{ ...display, fontSize: 380, letterSpacing: -14 }}>1.6</div>
        <div style={{ ...display, fontSize: 96, letterSpacing: -3, marginTop: 10 }}>seconds</div>
        <div style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 44, color: C.ink, opacity: 0.72, marginTop: 34, letterSpacing: -0.5, ...presenceStyle(rise(t, 10.5)) }}>
          From tap to paid. No fee.
        </div>
      </div>
      {t > 10.2 ? <Kovi pose="cheer" size={230} x={560} y={215 + hop(t, 10.4, 60) + bob} style={presenceStyle(rise(t, 10.2))} /> : null}
    </AbsoluteFill>
  )
}

/** Kovi hopping between two points, growing or shrinking on the way. */
function Hop({ from, to, p, sizes, fadeOut = false }: { from: Pt; to: Pt; p: number; sizes: [number, number]; fadeOut?: boolean }) {
  const lift = Math.min(from.y, to.y) - 90
  const at = bezier([from, { x: from.x, y: lift }, { x: to.x, y: lift }, to], p)
  const size = mix(sizes[0], sizes[1], p)
  const opacity = fadeOut ? 1 - span(p, 0.82, 1) : span(p, 0, 0.18)
  return <Kovi pose="cheer" size={size} x={at.x} y={at.y} style={{ opacity }} />
}

/** While Kovi is inside the coin, it breathes, and a sparkle marks where he went. */
function CoinBreath({ t, at, from }: { t: number; at: Pt; from: number }) {
  const s = t - from
  const pulse = 1 + 0.35 * Math.exp(-s * 5) * Math.abs(Math.sin(s * 8)) + 0.05 * Math.sin(s * 5) * Math.max(0, 1 - s / 1.6)
  return (
    <>
      <div style={{ position: 'absolute', left: at.x - 22, top: at.y - 22, width: 44, height: 44, borderRadius: 22, border: `4px solid ${C.coral}`, opacity: Math.max(0, 1 - s / 0.6), transform: `scale(${1 + s * 1.6})` }} />
      <Art name="sparkle-4" w={30 * pulse} x={at.x + 34} y={at.y - 30} ratio={1} style={{ opacity: Math.max(0, 1 - s / 1.2) }} />
    </>
  )
}

/* ── 13.7–17.2: the signature, over the painted globe ─────────────────────────────────────── */

const GLOBE = { w: 1780, left: 70, top: -60 }
const ART = { w: 1170, h: 960 }
const s = GLOBE.w / ART.w
const art = (x: number, y: number) => ({ x: GLOBE.left + x * s, y: GLOBE.top + y * s })
const ARC: Curve = [art(323, 471 - 62), art(440, 351 - 62), art(722, 351 - 62), art(863.5, 496 - 62)]
const GLIDE = { from: cues.glide[0], to: cues.glide[1] }

function Globe({ t }: { t: number }) {
  if (t < 13.5 || t > 17.4) return null
  const enter = rise(t, 13.7, 16.95)
  const push = mix(1, 1.07, easeInOut(span(t, 13.7, 17.2)))
  const p = easeInOut(span(t, GLIDE.from, GLIDE.to))
  const arrived = t >= GLIDE.to
  const flip = span(t, GLIDE.to, GLIDE.to + 0.45)
  const end = art(863.5, 496)
  return (
    <AbsoluteFill style={{ ...presenceStyle(enter), transformOrigin: '960px 520px', transform: `translateY(${enter.y}px) scale(${push})` }}>
      <Art name="scene-welcome" w={GLOBE.w} x={GLOBE.left + GLOBE.w / 2} y={GLOBE.top + (GLOBE.w * ART.h) / ART.w / 2} ratio={ART.h / ART.w} />
      {/* The painted dots turn coral as Kovi passes over them. */}
      {(arcDots as [number, number][]).map(([x, y], i) => {
        const at = (x - 323) / (863.5 - 323)
        const lit = clamp01((p - at) / 0.06)
        const d = art(x, y)
        return lit > 0 ? (
          <div key={i} style={{ position: 'absolute', left: d.x - 15 * s * 0.62, top: d.y - 15 * s * 0.62, width: 19 * s * 0.62 * 1.6, height: 19 * s * 0.62 * 1.6, borderRadius: 99, background: C.coral, opacity: lit, transform: `scale(${0.7 + 0.3 * lit})` }} />
        ) : null
      })}
      <Flight curve={ARC} p={p} size={250} trail={false} />
      {arrived ? <Kovi pose="cheer" size={210} x={end.x - 10} y={end.y - 175 + hop(t, GLIDE.to, 70)} style={presenceStyle(rise(t, GLIDE.to - 0.15, undefined, 0))} /> : null}
      {/* His dollar lands as the euros Tomás sees. */}
      {arrived ? (
        <>
          <Art name={flip < 0.5 ? 'coin-usd' : 'coin-eur'} w={130} x={end.x + 170} y={end.y - 330} ratio={1} style={{ transform: `scaleX(${Math.abs(Math.cos(flip * Math.PI))})` }} />
          <div style={{ position: 'absolute', left: end.x - 260, top: end.y - 560, width: 520, textAlign: 'center', ...presenceStyle(hero(t, GLIDE.to + 0.3)) }}>
            <div style={{ ...display, fontSize: 132, letterSpacing: -5 }}>€18.40</div>
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  )
}

/* ── 16.9–23.8: both ends of the same $20 ─────────────────────────────────────────────────── */

const ADA = { x: 600, y: 560, h: 640 }
const TOMAS = { x: 1300, y: 545, h: 740 }
const BETWEEN: Curve = [
  { x: ADA.x + 60, y: ADA.y - ADA.h / 2 - 40 },
  { x: 800, y: 60 },
  { x: 1100, y: 40 },
  { x: TOMAS.x - 40, y: TOMAS.y - TOMAS.h / 2 - 60 },
]

function Friend({ t }: { t: number }) {
  if (t < 16.7 || t > 20.6) return null
  const left = rise(t, 16.9, 20.1)
  const right = rise(t, 17.05, 20.1)
  const bob = Math.sin(t * 3.2) * 5
  const fade = 1 - span(t, 20.1, 20.4)
  return (
    <AbsoluteFill>
      <Phone src="screens/04-send-review.png" h={ADA.h} x={ADA.x} y={ADA.y + left.y} rotate={-3} style={{ opacity: left.opacity }}>
        <Underline t={t} at={VO.friend + 3.04} x={60} y={1931 + 16} w={1060} />
      </Phone>
      <Phone src="screens/06-friend-home.png" h={TOMAS.h} x={TOMAS.x} y={TOMAS.y + right.y} rotate={2.5} style={{ opacity: right.opacity }}>
        <Underline t={t} at={17.6} x={70} y={912} w={330} />
      </Phone>
      <Flight curve={BETWEEN} p={easeInOut(span(t, cues.arc[0], cues.arc[1]))} size={1} trail color={C.coral} fade={fade} />
      <Kovi pose="catch" size={180} x={TOMAS.x + 40} y={TOMAS.y - TOMAS.h / 2 - 62 + bob} rotate={2.5} style={presenceStyle(rise(t, 17.3, 20.1))} />
    </AbsoluteFill>
  )
}

/* ── 20.0–28.6: every Kovi flies home to the shop ─────────────────────────────────────────── */

const TODAY = { x: 690, y: 530, h: 800 }
/** The day's six sales, oldest first, as the till recorded them. */
const SALES = [6.5, 4.5, 6.5, 7.5, 5.0, 3.75]
/** On the beat: the score plucks a rising note as each one lands. */
const LANDS = cues.lands
/** The list's rows in the capture, newest at the top: the oldest sale is the bottom row. */
const ROW_TOP = [1010, 1184, 1358, 1532, 1706, 1880]
/** The wallet's shop card in the evening capture spans x 56-1122, y 1553-1880. */
const CARD_K = 700 / 1066

function Shop({ t }: { t: number }) {
  if (t < 19.8 || t > 28.8) return null
  const enter = rise(t, 20.0, 28.3)
  const landed = LANDS.filter((at) => t >= at).length
  const total = SALES.slice(0, landed).reduce((a, b) => a + b, 0)
  // Camera move 3: in toward the day's takings once they're all in.
  const push = mix(1, 1.08, easeInOut(span(t, 24.8, 28.3)))
  const card = onScreen(TODAY, 520, 740)
  const bob = Math.sin(t * 3.2) * 5
  return (
    <AbsoluteFill style={{ opacity: enter.opacity, transform: `translateY(${enter.y}px)` }}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: `${card.x}px ${card.y}px`, transform: `scale(${push})` }}>
        <Phone src="screens/09-till-paid.png" h={620} x={1400} y={440} rotate={5} style={{ filter: 'blur(3px)', opacity: 0.85 }} />
        <Phone src="screens/10-shop-today.png" h={TODAY.h} x={TODAY.x} y={TODAY.y} rotate={-2}>
          {/* The takings count up as each Kovi lands: the same six sales, in the order they came. */}
          <div style={{ position: 'absolute', left: 110, top: 592, width: 650, height: 200, background: C.todayCard }} />
          <div style={{ position: 'absolute', left: 126, top: 575, fontFamily: 'Manrope', fontWeight: 700, fontSize: 156, letterSpacing: -6, color: C.ink, fontVariantNumeric: 'tabular-nums', lineHeight: '214px' }}>
            ${total.toFixed(2)}
          </div>
          <div style={{ position: 'absolute', left: 110, top: 792, width: 690, height: 112, background: C.todayCard }} />
          <div style={{ position: 'absolute', left: 130, top: 800, fontFamily: 'Manrope', fontWeight: 400, fontSize: 45, color: C.onTint, fontVariantNumeric: 'tabular-nums', lineHeight: '96px' }}>
            {landed} {landed === 1 ? 'sale' : 'sales'}, $0.00 in card fees
          </div>
          {ROW_TOP.map((top, i) => {
            const sale = 5 - i // bottom row is the first sale
            const shown = clamp01((t - LANDS[sale]) / 0.25)
            return <div key={top} style={{ position: 'absolute', left: 0, top, width: 1179, height: 174, background: C.paper, opacity: 1 - shown }} />
          })}
        </Phone>
        {/* And the wallet's own card says the same, because the shop lives in the wallet. */}
        <div style={{ position: 'absolute', left: 1080, top: 650, width: 700, height: 327 * CARD_K, borderRadius: 50, overflow: 'hidden', boxShadow: '0 40px 80px -30px rgba(11, 26, 29, 0.3)', ...presenceStyle(rise(t, cues.card, 28.3)) }}>
          <Img src={staticFile('screens/11-home-evening.png')} style={{ position: 'absolute', left: -56 * CARD_K, top: -1553 * CARD_K, width: 1179 * CARD_K, height: 2556 * CARD_K }} />
        </div>
      </div>
      {SALES.map((_, i) => {
        const from = { x: 2050, y: 130 + ((i * 173) % 700) }
        const curve: Curve = [from, { x: 1700, y: from.y - 160 }, { x: card.x + 420, y: card.y - 260 }, { x: card.x + 40, y: card.y - 40 }]
        const p = easeInOut(span(t, LANDS[i] - 1.3, LANDS[i]))
        return <Flight key={i} curve={curve} p={p} size={170} trail={false} />
      })}
      {landed === SALES.length ? <Kovi pose="cheer" size={200} x={card.x + 330} y={card.y - 290 + hop(t, LANDS[5], 60) + bob} /> : null}
    </AbsoluteFill>
  )
}

/* ── 28.6–36.4: the mark and the one address ──────────────────────────────────────────────── */

function End({ t }: { t: number }) {
  if (t < 28.4 || t > 36.7) return null
  const bob = Math.sin(t * 3.2) * 5
  return (
    <AbsoluteFill>
      <Kovi pose="wave" size={270} x={960} y={250 + hop(t, VO.end + 0.3, 60) + bob} style={presenceStyle(rise(t, VO.end - 0.2, 36.3))} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 440, display: 'flex', justifyContent: 'center', ...presenceStyle(hero(t, VO.end, 36.3)) }}>
        <Logo h={170} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 680, textAlign: 'center', ...presenceStyle(hero(t, cues.url, 36.3)) }}>
        <div style={{ ...display, fontSize: 96, letterSpacing: -3 }}>mykova.app</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 800, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 600, fontSize: 42, color: C.ink, opacity: 0.72, letterSpacing: -0.4, ...presenceStyle(rise(t, cues.url + 0.5, 36.3)) }}>
        Try it free: $5 a day, on us.
      </div>
    </AbsoluteFill>
  )
}

/* ── 36.3–40.0: one more ──────────────────────────────────────────────────────────────────── */

function Button({ t }: { t: number }) {
  if (t < 36.2) return null
  const late: Curve = [{ x: -150, y: 560 }, { x: 350, y: 380 }, { x: 700, y: 520 }, { x: 830, y: 770 }]
  const p = easeInOut(span(t, cues.button.plane[0], cues.button.plane[1]))
  const woke = t >= cues.button.wake
  const plane = bezier(late, p)
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 150, top: 860, height: 4, borderRadius: 2, background: C.ink, width: 1620 * decel(span(t, 36.3, 36.9)) }} />
      {woke ? <Kovi pose="oops" size={290} x={1000} y={720} style={{ transform: `translateY(${hop(t, cues.button.wake, 40)}px)` }} /> : <Kovi pose="sleep" size={300} x={1000} y={745} style={presenceStyle(rise(t, cues.button.sleep))} />}
      {p > 0 ? <Art name="plane" w={150} x={plane.x} y={plane.y} ratio={1} style={{ transform: `rotate(${p < 1 ? -10 + 30 * p : 12}deg)` }} /> : null}
      <div style={{ position: 'absolute', left: 1180, top: 560, fontFamily: 'Manrope', fontWeight: 700, fontSize: 58, color: C.ink, letterSpacing: -1, ...presenceStyle(rise(t, cues.button.line)) }}>
        One more?
      </div>
    </AbsoluteFill>
  )
}
