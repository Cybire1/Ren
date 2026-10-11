/**
 * "Pick a card": 17.5 s of the Kova card styles, for X. The cards are the design canvas's own
 * markup (src/cards/markup.json, from scripts/import-cards.py), so every detail matches the designs.
 *
 * Claim: Kova has a card worth carrying, and the first 20 are handed out at OPEN, Singapore, Oct 6.
 *
 * Motion (src/motion.ts): Hero Reveal for words, Rise for objects, one fade exit. Cards move in
 * real 3D (perspective, rotateY), always eased; a light sheen sweeps each card as it arrives.
 * Kovi is the one bouncy spring. Signature: the fan of six cards, dealt like a hand.
 *
 * Layout ledger:
 *   0.0  hero      Split (words left, the spinning card right)
 *   2.7  styles    Z-axis cascade (a coverflow: focused card forward, the rest angled back)
 *   9.1  fan       Centred hero (six cards dealt as a hand)
 *   11.3 the pick  Extreme scale contrast (one card, big, the rest falling away)
 *   14.6 end       Baseline anchor (the mark on a low line, Kovi flying over)
 */
import { useMemo } from 'react'
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion'
import markup from './cards/markup.json'
import cues from './cards-cues.json'
import { accel, clamp01, decel, easeInOut, FPS, hero, hop, mix, presenceStyle, rise, span } from './motion'
import { KOVI, KoviRig } from './KoviRig'
import { bezier, type Curve, Grain, Kovi, Logo } from './parts'
import { C } from './theme'

export const CARDS_DURATION = cues.duration

type CardId = keyof typeof markup
const ORDER: CardId[] = ['main', 'coral', 'metal', 'drop', 'night', 'open']
const NAMES: Record<string, string> = {
  main: 'The shop around the chip',
  coral: 'Hot Coral',
  metal: 'Ink metal',
  drop: 'Kovi’s Day, collectible',
  night: 'Chalkboard',
  open: 'OPEN Singapore edition',
}
const BASE = 0.72

/**
 * Each card's finish, as a card printer would make it. Silk matte and soft-touch scatter light (a broad,
 * dim glow); gloss lamination throws a sharp band; brushed metal streaks it across the grain.
 */
type Finish = 'silk' | 'soft' | 'gloss' | 'metal'
const FINISH: Record<string, Finish> = { main: 'silk', back: 'silk', coral: 'soft', metal: 'metal', drop: 'gloss', night: 'gloss', open: 'gloss' }
const GRAIN: Record<Finish, number> = { silk: 0.07, soft: 0.1, gloss: 0.035, metal: 0.05 }
const SEED: Record<string, number> = { main: 3, back: 5, coral: 7, metal: 11, drop: 13, night: 17, open: 19 }

function CardFace({ id, sheen = 0, sheenStrength = 0.5, ry = 0, rz = 0 }: { id: CardId; sheen?: number; sheenStrength?: number; ry?: number; rz?: number }) {
  const m = markup[id]
  const html = useMemo(() => m.html.replace(/\{\{art\}\}([\w.-]+)/g, (_, f: string) => staticFile(`art/${f}`)), [m.html])
  const finish = FINISH[id]
  const c = -30 + 160 * sheen
  // The reflection slides across the card as it turns, the way a real one does under a light.
  const turn = ((((ry % 360) + 540) % 360) - 180) // -180..180
  const p = Math.max(-40, Math.min(140, 38 - turn * 1.3))
  const angle = 112 + rz * 0.8
  const reflection =
    finish === 'gloss'
      ? `linear-gradient(${angle}deg, rgba(255,255,255,0) ${p - 16}%, rgba(255,255,255,0.26) ${p}%, rgba(255,255,255,0) ${p + 16}%), linear-gradient(${angle}deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 45%)`
      : finish === 'metal'
        ? `linear-gradient(90deg, rgba(255,255,255,0) ${p - 30}%, rgba(210,225,228,0.16) ${p}%, rgba(255,255,255,0) ${p + 30}%)`
        : `radial-gradient(ellipse 70% 55% at ${p}% 18%, rgba(255,255,255,${finish === 'soft' ? 0.1 : 0.15}), rgba(255,255,255,0) 70%)`
  return (
    <div style={{ position: 'relative', width: m.w, height: m.h, borderRadius: 40, overflow: 'hidden' }}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the card designs are our own markup, imported at build time */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {/* Print grain: printed ink on PVC is never perfectly flat. */}
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0, opacity: GRAIN[finish], mixBlendMode: 'multiply' }} aria-hidden="true">
        <filter id={`grain-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency={finish === 'metal' ? '0.02 1.4' : '0.95'} numOctaves={2} seed={SEED[id]} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${id})`} />
      </svg>
      {/* Light: the reflection for this finish, a soft falloff to the edges, and the bevel. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 40,
          background: reflection,
          boxShadow: `inset 0 0 90px rgba(0,0,0,${finish === 'gloss' ? 0.05 : 0.08}), inset 0 0 0 2px rgba(255,255,255,${finish === 'metal' ? 0.18 : 0.3}), inset 0 0 0 4px rgba(0,0,0,0.05)`,
        }}
      />
      {sheen > 0 && sheen < 1 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(105deg, rgba(255,255,255,0) ${c - 24}%, rgba(255,255,255,${finish === 'gloss' || finish === 'metal' ? sheenStrength : sheenStrength * 0.6}) ${c}%, rgba(255,255,255,0) ${c + 24}%)`,
          }}
        />
      ) : null}
    </div>
  )
}

/** The colour of each card's cut edge, seen when it turns. */
const EDGE: Record<string, string> = { main: '#d6d2c9', coral: '#a8463b', metal: '#070f10', drop: '#7fa2a2', night: '#050d0e', open: '#a8463b', back: '#d6d2c9' }

type Pose = { x: number; y: number; s: number; rx?: number; ry?: number; rz?: number; o?: number; z?: number }

function Card({ id, pose, sheen, sheenStrength, back }: { id: CardId; pose: Pose; sheen?: number; sheenStrength?: number; back?: CardId }) {
  const m = markup[id]
  if ((pose.o ?? 1) <= 0.001) return null
  return (
    <div style={{ position: 'absolute', left: pose.x, top: pose.y, width: 0, height: 0, perspective: 2600, zIndex: pose.z ?? 0 }}>
      <div
        style={{
          position: 'absolute',
          left: -m.w / 2,
          top: -m.h / 2,
          width: m.w,
          height: m.h,
          opacity: pose.o ?? 1,
          transformStyle: 'preserve-3d',
          transform: `scale(${pose.s}) rotateX(${pose.rx ?? 0}deg) rotateY(${pose.ry ?? 0}deg) rotateZ(${pose.rz ?? 0}deg)`,
        }}
      >
        {/* The card has thickness: a contact shadow, then its cut edge in layers. */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 40, transform: 'translateZ(-5px)', boxShadow: '0 2px 3px rgba(11,26,29,0.25), 0 18px 30px -12px rgba(11,26,29,0.3), 0 50px 90px -30px rgba(11,26,29,0.45)' }} />
        {[-4, -2, 0, 2, 4].map((z) => (
          <div key={z} style={{ position: 'absolute', inset: 0, borderRadius: 40, background: EDGE[id], transform: `translateZ(${z}px)` }} />
        ))}
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'translateZ(5px)' }}>
          <CardFace id={id} sheen={sheen} sheenStrength={sheenStrength} ry={pose.ry ?? 0} rz={pose.rz ?? 0} />
        </div>
        <div style={{ position: 'absolute', left: back ? (m.w - markup[back].w) / 2 : 0, top: back ? (m.h - markup[back].h) / 2 : 0, width: back ? undefined : m.w, height: back ? undefined : m.h, borderRadius: 40, background: back ? undefined : EDGE[id], backfaceVisibility: 'hidden', transform: 'rotateY(180deg) translateZ(5px)' }}>
          {back ? <CardFace id={back} ry={(pose.ry ?? 0) + 180} rz={pose.rz ?? 0} /> : null}
        </div>
      </div>
    </div>
  )
}

const display: React.CSSProperties = { fontFamily: 'Manrope', fontWeight: 800, color: C.ink, letterSpacing: -4, lineHeight: 0.95 }

/** Where each card sits in the coverflow when the focus is at `focus` (fractional while moving). */
function flowPose(i: number, focus: number, enter: number): Pose {
  const d = i - focus
  const a = Math.abs(d)
  const x = 960 + Math.sign(d) * (a <= 1 ? a * 520 : 520 + (a - 1) * 300) + (i > 0 ? (1 - enter) * 1100 : 0)
  return {
    x,
    y: 510,
    s: BASE * (1 - Math.min(a, 2) * 0.16),
    ry: Math.max(-48, Math.min(48, -d * 40)),
    z: 100 - Math.round(a * 10),
    o: a > 2.6 ? 0 : 1,
  }
}

/** The hand: six cards on an arc around a pivot below the frame. */
function fanPose(i: number): Pose {
  const angle = (i - 2.5) * 14
  const r = 820
  const rad = (angle * Math.PI) / 180
  return { x: 960 + Math.sin(rad) * r, y: 1420 - Math.cos(rad) * r, s: 0.5, rz: angle, ry: 0, z: 10 + i }
}

const lerpPose = (a: Pose, b: Pose, p: number): Pose => ({
  x: mix(a.x, b.x, p),
  y: mix(a.y, b.y, p),
  s: mix(a.s, b.s, p),
  rx: mix(a.rx ?? 0, b.rx ?? 0, p),
  ry: mix(a.ry ?? 0, b.ry ?? 0, p),
  rz: mix(a.rz ?? 0, b.rz ?? 0, p),
  o: mix(a.o ?? 1, b.o ?? 1, p),
  z: p < 0.5 ? a.z : b.z,
})

export function KovaCards() {
  const frame = useCurrentFrame()
  const t = frame / FPS
  const [flow0] = cues.flow

  // Focus moves one card per two beats of the score.
  const focus = cues.flow.slice(1).reduce((f, at) => f + easeInOut(span(t, at, at + 0.55)), 0)
  const enter = decel(span(t, flow0 - 0.25, flow0 + 0.45))

  // The hero: the first card spins in from the depth and lands.
  const spin = decel(span(t, cues.spin[0], cues.spin[1]))
  const land = hop(t, cues.spin[1], 26)
  const heroPose: Pose = {
    x: mix(mix(1500, 1270, spin), 960, easeInOut(span(t, 2.2, flow0))),
    y: 520 + land,
    s: mix(0.5, 0.8, spin) * (1 + 0.04 * Math.exp(-6 * Math.max(0, t - cues.spin[1])) * Math.sin(Math.max(0, t - cues.spin[1]) * 14)) - 0.08 * easeInOut(span(t, 2.2, flow0)),
    ry: 540 * (1 - spin),
    rz: mix(-18, -4, spin) * (1 - easeInOut(span(t, 2.2, flow0))),
    z: 100,
  }

  const fanning = t >= cues.fan[0]
  const pulling = t >= cues.pull[0]
  const pull = easeInOut(span(t, cues.pull[0], cues.pull[1]))
  const flip = easeInOut(span(t, cues.flip[0], cues.flip[1]))
  const ending = t >= cues.end - 0.25
  const endOut = rise(t, -1, cues.end - 0.3)

  const poses = ORDER.map((id, i): Pose => {
    if (t < flow0 && i === 0) return heroPose
    const flowAt = flowPose(i, focus, enter)
    if (!fanning) return t < flow0 - 0.25 && i > 0 ? { ...flowAt, o: 0 } : flowAt
    const p = easeInOut(span(t, cues.fan[0] + i * 0.07, cues.fan[1] + i * 0.07))
    const fanned = lerpPose(flowPose(i, 5, 1), fanPose(i), p)
    if (!pulling) return fanned
    if (id === 'open') return lerpPose(fanned, { x: 960, y: 540, s: 0.84, rz: 0, ry: 180 * flip, z: 200 }, pull)
    const fall = accel(span(t, cues.pull[0] + i * 0.04, cues.pull[0] + 0.6 + i * 0.04))
    return { ...fanned, y: fanned.y + 800 * fall, o: 1 - fall }
  })

  // The sheen crosses each card just after it arrives in front.
  const sheenFor = (i: number) => {
    if (i === 0 && t < flow0) return span(t, cues.sheen1, cues.sheen1 + 1.1)
    if (fanning) return 0
    const at = cues.flow[i]
    return i === 0 ? 0 : span(t, at + 0.35, at + 1.35)
  }
  const focused = Math.round(focus)
  const bob = Math.sin(t * 3.2) * 6

  return (
    <AbsoluteFill style={{ background: C.paper, overflow: 'hidden' }}>
      {/* The metal card's brushed finish, from its artboard's own stylesheet. */}
      <style>{'.brushed{background-color:#101f22;background-image:repeating-linear-gradient(90deg,rgba(255,255,255,0.025) 0 1px,transparent 1px 3px)}'}</style>
      {/* 0.0 The hero's words. */}
      <div style={{ position: 'absolute', left: 150, top: 330, ...presenceStyle(rise(t, -1, 2.1)) }}>
        <div style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 44, color: C.ink, opacity: 0.7, letterSpacing: -0.5, marginBottom: 16 }}>Meet the</div>
        <div style={{ ...display, fontSize: 170 }}>Kova</div>
        <div style={{ ...display, fontSize: 170 }}>card.</div>
      </div>

      {!ending ? (
        <AbsoluteFill style={{ opacity: endOut.opacity, transform: `translateY(${endOut.y}px)` }}>
          {ORDER.map((id, i) => (
            <Card key={id} id={id} pose={poses[i]} sheen={sheenFor(i)} sheenStrength={id === 'metal' ? 0.24 : 0.16} back={id === 'open' ? 'back' : undefined} />
          ))}
        </AbsoluteFill>
      ) : null}

      {/* 2.7 The name of the card in front. */}
      {t >= flow0 && !fanning
        ? ORDER.map((id, i) =>
            focused === i ? (
              <div key={id} style={{ position: 'absolute', left: 0, right: 0, top: 930, textAlign: 'center', ...presenceStyle(hero(t, i === 0 ? flow0 : cues.flow[i] + 0.2, i < 5 ? cues.flow[i + 1] - 0.05 : cues.fan[0] - 0.2)) }}>
                <span style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 30, color: C.coral, letterSpacing: 2, marginRight: 18 }}>0{i + 1}</span>
                <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 44, color: C.ink, letterSpacing: -1 }}>{NAMES[id]}</span>
              </div>
            ) : null,
          )
        : null}

      {/* 9.1 The hand. */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center', ...presenceStyle(hero(t, cues.fanLine, cues.pull[0] - 0.1)) }}>
        <div style={{ ...display, fontSize: 104 }}>Which one would you carry?</div>
      </div>

      {/* 11.3 The pick. */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 70, textAlign: 'center', ...presenceStyle(hero(t, cues.openLine, cues.end - 0.3)) }}>
        <div style={{ ...display, fontSize: 88, letterSpacing: -3 }}>First 20 people who find me get one.</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 900, textAlign: 'center', ...presenceStyle(rise(t, cues.whereLine, cues.end - 0.3)) }}>
        <span style={{ display: 'inline-block', padding: '14px 30px', borderRadius: 999, background: C.ink, color: C.surface, fontFamily: 'Manrope', fontWeight: 800, fontSize: 34, letterSpacing: 3 }}>
          OPEN · SINGAPORE · OCT 6
        </span>
      </div>

      {/* 14.6 The mark, and Kovi flying over it. */}
      {ending ? <End t={t} bob={bob} /> : null}

      <Grain frame={frame} />
    </AbsoluteFill>
  )
}

const LINE = 900
/** Keyframes: [time, value] pairs, eased between, held outside. */
function kf(t: number, keys: [number, number][], ease = easeInOut): number {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]
    const [t0, v0] = keys[i - 1]
    if (t <= t1) return mix(v0, v1, ease(span(t, t0, t1)))
  }
  return keys[keys.length - 1][1]
}
/** A damped spring settling to 0 after `at`: overshoot for squash, stretch and follow-through. */
const settle = (t: number, at: number, amp: number, freq = 18, damp = 8) => (t < at ? 0 : amp * Math.exp(-damp * (t - at)) * Math.cos((t - at) * freq))
/** A quick blink centred on `at`. */
const blinkAt = (t: number, at: number) => Math.max(0, 1 - Math.abs(t - at) / 0.07)

const RIG = 230
const K = RIG / 1024

/**
 * The button after the name, animated with the principles that make characters feel alive:
 * anticipation before each jump, stretch going up, squash landing, arms that lag and overshoot
 * (overlapping action and follow-through), eyes that lead the body, blinks, and a secondary sway.
 */
function KoviOnTheLine({ t }: { t: number }) {
  const [look0, look1] = cues.look
  const [antic, takeOff, landAt] = cues.jump
  const [wave0, wave1] = cues.wave
  const [exitAntic, exitOff, gone] = cues.exit
  if (t < cues.peek) return null

  const blinks = blinkAt(t, 15.95) + blinkAt(t, 16.5) + blinkAt(t, 18.95)
  const peeking = t < takeOff

  // Where his feet are (below the line while he peeks), and how he is squashed.
  let ground = LINE + 1
  let sx = 1
  let sy = 1
  let lean = 0
  let x = 960
  let armL = -34
  let armR = 155
  let bendL = 0
  let bendR = 0
  let mouth: 'smile' | 'grin' | 'o' | 'ooh' = 'smile'
  let look = { x: 0, y: 0 }
  let happy = 0
  let waveLines = 0
  let crouch = 0

  if (peeking) {
    // Rise from behind the line with a stretch, stop with a squash.
    const rise = kf(t, [[cues.peek, 200], [cues.peek + 0.32, 56]], decel)
    ground = LINE + rise + settle(t, cues.peek + 0.32, -10, 16, 9)
    sy = 1 + (t < cues.peek + 0.32 ? 0.1 : settle(t, cues.peek + 0.32, -0.1, 18, 8))
    sx = 2 - sy
    // Eyes lead, the body follows: look left, then right, then back.
    const lx = kf(t, [[look0, 0], [look0 + 0.18, -1], [look0 + 0.5, -1], [look0 + 0.66, 1], [look1 - 0.12, 1], [look1, 0]])
    const bx = kf(t, [[look0 + 0.08, 0], [look0 + 0.3, -16], [look0 + 0.56, -16], [look0 + 0.8, 16], [look1 - 0.04, 16], [look1 + 0.1, 0]])
    look = { x: lx, y: 0.15 }
    x = 960 + bx
    lean = bx * -0.35
    mouth = t > look0 ? 'grin' : 'smile'
    armL = 175
    armR = 175
    // Anticipation: sink, squash, look up at where he is going.
    if (t >= antic) {
      const a = span(t, antic, takeOff)
      ground += 26 * a
      sy = 1 - 0.16 * a
      sx = 1 + 0.12 * a
      look = { x: 0, y: -1 }
      mouth = 'ooh'
    }
  } else if (t < landAt) {
    // The jump: a parabola from behind the line to standing on it; stretched, arms trailing up.
    const q = span(t, takeOff, landAt)
    ground = LINE + 1 + (1 - q) * 80 - 115 * Math.sin(q * Math.PI)
    sy = 1.14 - 0.1 * Math.sin(q * Math.PI)
    sx = 2 - sy
    armL = -20 - 40 * (1 - q)
    armR = 25 + 40 * (1 - q)
    bendL = 0.8
    bendR = -0.8
    mouth = 'o'
    look = { x: 0, y: -0.6 + q }
  } else {
    // Landed: squash with a springy recovery, arms follow through past rest and settle.
    const land = settle(t, landAt, 1, 17, 7)
    sy = 1 - 0.2 * land
    sx = 1 + 0.16 * land
    crouch = Math.max(0, 0.7 * land)
    armL = -34 + 40 * settle(t, landAt, 1, 12, 5)
    armR = 155 - 30 * settle(t, landAt, 1, 12, 5)
    mouth = t < landAt + 0.18 ? 'o' : 'smile'

    // The wave: the hand swings in an arc, the elbow drags behind it, the body sways against it.
    if (t >= wave0 && t < wave1 + 0.3) {
      const w = span(t, wave0, wave1)
      const phase = w * Math.PI * 6
      const env = Math.min(1, w * 6) * (1 - span(t, wave1 - 0.1, wave1 + 0.3))
      armL = mix(-34, -30 + Math.sin(phase) * 38, env)
      bendL = -Math.cos(phase) * 0.8 * env
      waveLines = env * (0.6 + 0.4 * Math.abs(Math.sin(phase)))
      lean = -Math.sin(phase - 0.6) * 4 * env
      armR = 155 + Math.sin(phase - 1.2) * 8 * env
      happy = t > wave0 + 0.45 && t < wave1 - 0.25 ? 1 : 0
      mouth = 'smile'
    }
    // Leaving: crouch, hop, drop behind the line with his arms up.
    if (t >= exitAntic) {
      const a = span(t, exitAntic, exitOff)
      const q = span(t, exitOff, gone)
      crouch = 0.6 * a * (1 - q)
      sy = t < exitOff ? 1 - 0.16 * a : 1.12
      sx = 2 - sy
      ground = LINE + 1 - (t < exitOff ? 0 : 70 * Math.sin(Math.min(q, 0.45) * Math.PI) - (q > 0.45 ? (q - 0.45) * 2.2 * 330 : 0))
      armL = t < exitOff ? -60 : -15
      armR = t < exitOff ? 120 : 20
      mouth = t < exitOff ? 'ooh' : 'o'
      look = { x: 0, y: t < exitOff ? -0.8 : 0.6 }
      happy = 0
      waveLines = 0
    }
  }

  const sparkle = (dx: number, dy: number, at: number, size: number, name: 'sparkle-4' | 'sparkle-1') => {
    const k = span(t, at, at + 0.3)
    const out = 1 - span(t, at + 0.7, at + 1.0)
    if (k <= 0 || out <= 0) return null
    return <Img key={`${dx}${dy}`} src={staticFile(`art/${name}.png`)} style={{ position: 'absolute', left: 960 + dx - size / 2, top: LINE - 110 + dy - size / 2, width: size, height: size, opacity: out, transform: `scale(${decel(k) * (1 + 0.25 * Math.sin(k * Math.PI))}) rotate(${k * 60}deg)` }} />
  }

  return (
    <>
      {sparkle(-150, -60, landAt, 34, 'sparkle-4')}
      {sparkle(150, -90, landAt + 0.08, 28, 'sparkle-1')}
      {sparkle(-130, -150, wave0 + 0.4, 30, 'sparkle-1')}
      {sparkle(140, -20, wave0 + 0.55, 26, 'sparkle-4')}
      {/* Whatever is below the line is behind it. */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: LINE + 2, overflow: 'hidden' }}>
        <KoviRig
          x={x}
          y={ground}
          size={RIG}
          pose={{ blink: Math.min(1, blinks), happy, look, mouth, armL, armR, bendL, bendR, crouch, sx, sy, lean, waveLines, blush: happy, noLegs: peeking, noArms: peeking }}
        />
      </div>
      {/* While he peeks, his hands hold the edge. */}
      {peeking && t > cues.peek + 0.2 ? (
        <>
          {[-70, 70].map((dx) => (
            <div
              key={dx}
              style={{
                position: 'absolute',
                left: x + dx * (1 + (sx - 1)) - 11,
                top: LINE - 12,
                width: 22,
                height: 22,
                borderRadius: 11,
                background: KOVI.face,
                border: `${14 * K}px solid ${KOVI.ink}`,
                boxSizing: 'border-box',
                transform: `scale(${decel(span(t, cues.peek + 0.2, cues.peek + 0.35))})`,
              }}
            />
          ))}
        </>
      ) : null}
    </>
  )
}

function End({ t, bob }: { t: number; bob: number }) {
  const flight: Curve = [
    { x: -200, y: 420 },
    { x: 600, y: 180 },
    { x: 1300, y: 200 },
    { x: 2150, y: 380 },
  ]
  const p = easeInOut(span(t, cues.kovi[0], cues.kovi[1]))
  const at = bezier(flight, p)
  const ahead = bezier(flight, Math.min(1, p + 0.02))
  const trail = Array.from({ length: 40 }, (_, i) => i / 39).filter((q) => q < p - 0.02).map((q) => bezier(flight, q))
  return (
    <AbsoluteFill>
      {trail.map((d, i) => (
        <div key={i} style={{ position: 'absolute', left: d.x - 5, top: d.y - 5, width: 10, height: 10, borderRadius: 5, background: C.coral, opacity: 0.85 * (1 - span(t, cues.kovi[1], cues.kovi[1] + 0.6)) }} />
      ))}
      {p > 0 && p < 1 ? (
        <Kovi pose="ride" size={220} x={at.x} y={at.y + bob} rotate={(Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180) / Math.PI * 0.35} />
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 330, display: 'flex', justifyContent: 'center', ...presenceStyle(hero(t, cues.end)) }}>
        <Logo h={180} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 570, textAlign: 'center', ...presenceStyle(rise(t, cues.url)) }}>
        <div style={{ ...display, fontSize: 72, letterSpacing: -2 }}>mykova.app</div>
      </div>
      <div style={{ position: 'absolute', left: 150, right: 150, top: LINE, height: 4, borderRadius: 2, background: C.ink, transformOrigin: 'center', transform: `scaleX(${decel(span(t, cues.end, cues.end + 0.7))})` }} />
      <KoviOnTheLine t={t} />
    </AbsoluteFill>
  )
}
