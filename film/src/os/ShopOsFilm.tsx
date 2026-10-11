/**
 * "Kova Shop OS": a 46-second film of Kova's shop OS, cut at 110 BPM. The screens are live: every
 * tap, count-up and card move is drawn from the frame (src/os/ui), from the Kova POS design. On the
 * 3D devices the same screens play as frame sequences (public/os/live, scripts/reels-os.sh). The
 * numbers on Today are from a real run at Ada's Bakery on Monad testnet: six orders, $24.25.
 *
 * Shots, each on a bar line (src/os/os-cues.json):
 *   problem  ink. "Running a shop is a lot." The day's chores pop in on the beat, then collapse.
 *   title    the Register (3D) under a light streak, "Kova Shop OS"; the camera dives into its screen
 *   sell     match cut: the Sell screen flat, taps on the beat, punch in on Charge
 *   explode  the same screen pulled apart into its layers in 3D: "One tap to charge." No voice.
 *   pay      round the back (3D): the customer display, a Kova Card lands on the reader, Paid
 *   orders   the Orders board: cards travel between columns
 *   hand     the Terminal (3D) on teal, a sale on the floor, a card on its reader
 *   today    Today: $24.25 made, $2.50 kept; the camera travels between the two
 *   end      both devices, "Kova Shop OS", mykova.app
 */
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { ThreeCanvas } from '@remotion/three'
import type React from 'react'
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import * as THREE from 'three'
import vo from '../../public/os/audio/vo.json'
import { CameraAim, KovaCard3D } from '../atm/KovaPoint3D'
import { Mark } from '../atm/Textures'
import { decel, easeInOut, mix, span } from '../motion'
import { Captions, type Line } from '../parts'
import { BOUNCY, sp, Words } from '../ShopLink'
import { KovaTerminal, READER_Y } from '../terminal/KovaTerminal3D'
import { Finish } from '../terminal/TerminalShowcase'
import { C } from '../theme'
import { KovaRegister } from './KovaRegister3D'
import cues from './os-cues.json'
import { BEAT, bounce, CORAL, FPS, hero, INK, PAPER, SURFACE, TEAL } from './ui/kit'
import { OrdersUI } from './ui/OrdersUI'
import { CHARGE, SellUI } from './ui/SellUI'
import { TodayUI } from './ui/TodayUI'

export const OS_DURATION = cues.duration
const LINES = vo.lines as Line[]
const S = cues.shots
type V3 = [number, number, number]

export const ease = (t: number, a: number, b: number) => easeInOut(span(t, a, b))
export const lerp3 = (a: V3, b: V3, p: number): V3 => [mix(a[0], b[0], p), mix(a[1], b[1], p), mix(a[2], b[2], p)]

const REELS = { RegisterReel: 150, CustomerReel: 200, TerminalReel: 170 }
/** One frame of a device reel, `rel` seconds in. */
export const reel = (name: keyof typeof REELS, rel: number) =>
  `os/live/${name}/element-${String(Math.min(REELS[name] - 1, Math.max(0, Math.round(rel * FPS)))).padStart(3, '0')}.jpeg`

// ——— 3D ———————————————————————————————————————————————————————————————————————————

export interface Shot3 {
  ground: string
  pos: V3
  look: V3
  screen: string
  customer: string
  streak?: number
  card?: { at: V3; rot: V3 } | null
  pulse?: number
  receipt?: number
  register: boolean
  terminal?: { at: V3; turn: number; scale: number; tilt: number; screen: string; shadow?: boolean; card?: { at: V3; rot: V3 } | null } | null
}

function shot3(t: number): Shot3 {
  const base = { screen: reel('RegisterReel', 0), customer: reel('CustomerReel', 0), ground: '#e9e3d8', register: true }
  if (t < S.sell) {
    // Pull back from the screen's edge under a light streak, then dive into the screen.
    const out = ease(t, S.title, S.title + 3.4)
    const dive = span(t, S.title + 3.4, S.sell) ** 2.2
    const pos = lerp3(lerp3([1.7, 1.55, 3.1], [2.3, 1.85, 5.3], out), [0, 2.04, 2.34], dive)
    const look = lerp3(lerp3([-0.45, 1.25, 0], [-0.5, 1.0, 0], out), [0, 1.42, 0.02], dive)
    return { ...base, pos, look, streak: mix(-4, 4, span(t, S.title, S.title + 3.0)) }
  }
  if (t < S.orders) {
    const rel = t - S.pay
    const fly = ease(t, cues.card[0], cues.card[1])
    const away = ease(t, cues.paid + 0.3, cues.paid + 1.2)
    const dip = t >= cues.card[1] ? Math.exp(-(t - cues.card[1]) * 7) * 0.04 : 0
    const close = t >= S.pay + 6 * BEAT
    const p = ease(t, close ? S.pay + 6 * BEAT : S.pay, close ? S.orders : S.pay + 6 * BEAT)
    return {
      ...base,
      customer: reel('CustomerReel', rel),
      // Wide on the reader for the tap; then a cut in close on the customer's Paid.
      pos: close ? lerp3([-0.45, 1.05, -1.7], [-0.3, 1.1, -1.5], p) : lerp3([-1.9, 1.5, -3.2], [-1.6, 1.4, -2.9], p),
      look: close ? [0, 1.25, -0.06] : [-0.25, 0.9, -0.2],
      card: { at: [mix(-1.5, -0.42, fly) - 1.2 * away, mix(1.2, 0.5 - dip, fly) + 0.5 * away, mix(-1.3, -0.36, fly) - 0.4 * away], rot: [mix(0.2, 0.75, fly), Math.PI + mix(0.7, 0.15, fly), mix(-0.3, -0.05, fly)] },
      pulse: span(t, cues.card[1], cues.card[1] + 0.9),
      receipt: ease(t, cues.print[0], cues.print[1]),
    }
  }
  if (t < S.today) {
    // The Terminal alone on teal, turning slowly; a card comes to its reader.
    const rel = t - S.hand
    const p = ease(t, S.hand, S.today)
    const fly = ease(t, cues.handCard[0], cues.handCard[1])
    const away = ease(t, cues.handPaid + 0.1, cues.handPaid + 0.7)
    return {
      ...base,
      register: false,
      ground: TEAL,
      pos: lerp3([0.1, 1.2, 4.3], [-0.25, 1.1, 3.8], p),
      look: [-0.55, 0.95, 0],
      terminal: {
        at: [0, 0.02, 0],
        turn: mix(-0.42, 0.12, p),
        scale: 1,
        tilt: 0,
        screen: reel('TerminalReel', rel),
        card: rel > 5 * BEAT && away < 1 ? { at: [mix(0.9, 0, fly) + 1.2 * away, mix(2.3, READER_Y + 0.12, fly) + 0.8 * away, mix(0.9, 0.22, fly) + 0.6 * away], rot: [mix(-0.5, 0, fly), mix(-0.6, 0, fly), mix(0.4, 0.05, fly)] } : null,
      },
    }
  }
  const p = ease(t, S.end, cues.duration)
  return {
    ...base,
    screen: reel('RegisterReel', 99),
    customer: reel('CustomerReel', 99),
    // The Register and, standing clear of its base to the right, the Terminal; the title takes the left.
    pos: lerp3([-2.9, 1.9, 7.0], [-2.4, 1.8, 6.5], p),
    look: [-0.55, 0.85, 0.2],
    terminal: { at: [1.3, 0, 0.75], turn: -0.5, scale: 0.62, tilt: 0, screen: reel('TerminalReel', 99) },
  }
}

function Scene({ t }: { t: number }) {
  return <Stage3D s={shot3(t)} />
}

/** One frame of the 3D devices, as a shot describes it. */
export function Stage3D({ s }: { s: Shot3 }) {
  const ground = new THREE.Color(s.ground)
  return (
    <>
      <CameraAim position={s.pos} target={s.look} />
      <color attach="background" args={[ground]} />
      <fog attach="fog" args={[ground, 10, 24]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[-1.2, 9, 2.2]} intensity={2.3} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-2} shadow-bias={-0.0003} shadow-radius={8} />
      <directionalLight position={[3, 3, -4]} intensity={1.6} color="#fff1e2" />
      <Environment resolution={256} frames={s.streak === undefined ? 1 : Infinity}>
        <Lightformer form="rect" intensity={3} position={[-3, 2.5, 2.5]} scale={[1.2, 5, 1]} target={[0, 1, 0]} />
        <Lightformer form="rect" intensity={2} position={[3, 2, 2]} scale={[1, 4, 1]} target={[0, 1, 0]} color="#ffe6d2" />
        <Lightformer form="rect" intensity={2.5} position={[0, 5, 0.5]} scale={[4, 0.6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} position={[0, 1.5, -4]} scale={[6, 3, 1]} target={[0, 1, 0]} />
        {s.streak !== undefined ? <Lightformer form="rect" intensity={8} position={[s.streak, 2.5, 2]} scale={[0.35, 6, 1]} target={[0, 0.8, 0]} /> : null}
      </Environment>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={ground} roughness={0.92} />
      </mesh>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.62} scale={8} blur={2.6} far={2.5} resolution={1024} color="#2a2119" frames={1} />
      {s.register ? <KovaRegister screen={s.screen} customer={s.customer} pulse={s.pulse ?? 0} receipt={s.receipt ?? 0} /> : null}
      {s.card ? <KovaCard3D position={s.card.at} rotation={s.card.rot} scale={3.4} /> : null}
      {s.terminal ? (
        <group position={s.terminal.at} rotation={[0, s.terminal.turn, 0]}>
          <group scale={s.terminal.scale} position={[0, 0.025 * s.terminal.scale, 0]} rotation={[s.terminal.tilt, 0, 0]}>
            <KovaTerminal finish="ink" screen={s.terminal.screen} shadow={s.terminal.shadow ?? true} />
            {s.terminal.card ? <KovaCard3D position={s.terminal.card.at} rotation={s.terminal.card.rot} scale={3.6} /> : null}
          </group>
        </group>
      ) : null}
    </>
  )
}

// ——— Flat screens ——————————————————————————————————————————————————————————————————

/**
 * A screen laid flat in the frame, shot by a 2D camera: `focus` is the point of the screen (in its
 * own pixels) at the frame's centre, `zoom` how big it is.
 */
export function Flat({ w = 1440, h = 900, focus, zoom, tilt = 0, children }: { w?: number; h?: number; focus: [number, number]; zoom: number; tilt?: number; children: React.ReactNode }) {
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 40%, #f2efe9, #ddd8cf)', perspective: 2400 }}>
      <div
        style={{
          position: 'absolute',
          left: 960 - focus[0],
          top: 540 - focus[1],
          width: w,
          height: h,
          transformOrigin: `${focus[0]}px ${focus[1]}px`,
          transform: `scale(${zoom}) rotateY(${tilt}deg)`,
          borderRadius: 30,
          overflow: 'hidden',
          border: `3px solid ${INK}`,
          boxShadow: '0 60px 120px -40px rgba(11,26,29,0.45), 0 20px 40px -20px rgba(11,26,29,0.3)',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  )
}
export const lerp2 = (a: [number, number], b: [number, number], p: number): [number, number] => [mix(a[0], b[0], p), mix(a[1], b[1], p)]

export function SellShot({ t, start = S.sell }: { t: number; start?: number }) {
  const rel = t - start
  // Lands from the dive (the screen filling the frame), settles, then punches in on Charge.
  const settle = hero(span(rel, 0, 0.9))
  const punch = hero(span(rel, 5.2 * BEAT, 6.6 * BEAT))
  const charge: [number, number] = [CHARGE.x + CHARGE.w / 2 - 60, CHARGE.y - 60]
  const focus = lerp2(lerp2([720, 450], [760, 450], settle), charge, punch)
  const zoom = mix(mix(1.36, 1.1, settle), 1.75, punch)
  return (
    <Flat focus={focus} zoom={zoom}>
      <SellUI t={rel} />
    </Flat>
  )
}

/** Sell, pulled apart: the rail, the shelf, the cart and the total float up as layers. */
function ExplodeShot({ t }: { t: number }) {
  const rel = t - S.explode
  const turn = hero(span(rel, 0, 1.0))
  const apart = hero(span(rel, 0.35, 1.5)) * (1 - hero(span(rel, 3.55, 4.3)))
  const ui = <SellUI t={5} />
  const layers: { clip: string; z: number; key: string }[] = [
    { key: 'rail', clip: 'inset(0 1336px 0 0 round 30px 0 0 30px)', z: 70 },
    { key: 'shelf', clip: 'inset(0 440px 0 104px)', z: 150 },
    { key: 'cart', clip: 'inset(0 0 262px 1000px)', z: 230 },
    { key: 'total', clip: 'inset(638px 0 0 1000px round 0 0 30px 0)', z: 360 },
  ]
  const glow = 0.5 + 0.5 * Math.sin(((rel / BEAT) % 1) * Math.PI * 2)
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 80% at 60% 45%, #24363a, ${INK})`, perspective: 2600 }}>
      <div style={{ position: 'absolute', left: 960 - 720 + 260, top: 90, width: 1440, height: 900, transformStyle: 'preserve-3d', transform: `scale(${mix(1.0, 0.82, turn)}) rotateX(${mix(0, 52, turn)}deg) rotateZ(${mix(0, -32, turn)}deg)` }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 30, background: PAPER, border: `3px solid ${SURFACE}` }} />
        {layers.map((l) => (
          <div key={l.key} style={{ position: 'absolute', inset: 0, clipPath: l.clip, transform: `translateZ(${l.z * apart}px)`, filter: l.key === 'total' ? `drop-shadow(0 0 ${30 * glow * apart}px ${CORAL})` : 'none' }}>
            {ui}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 110, top: 150 }}>
        <Words t={t} at={S.explode + 0.5} out={S.pay - 0.35} text={'One tap\nto charge.'} style={{ ...display, color: SURFACE, fontSize: 120 }} />
        <Words t={t} at={S.explode + 1.6} out={S.pay - 0.35} text="Card, phone or QR. No card fees." style={{ ...body, color: '#A7B8B9', fontSize: 34, marginTop: 22 }} stagger={0.05} />
      </div>
    </AbsoluteFill>
  )
}

function OrdersShot({ t }: { t: number }) {
  const rel = t - S.orders
  const p = ease(t, S.orders, S.hand)
  const land = hero(span(rel, 0, 0.8))
  return (
    <Flat focus={lerp2([720, 470], [700, 400], p)} zoom={mix(mix(0.95, 1.08, land), 1.22, p)} tilt={mix(-8, 0, land)}>
      <OrdersUI t={rel} />
    </Flat>
  )
}

function TodayShot({ t }: { t: number }) {
  const rel = t - S.today
  const across = hero(span(rel, 4 * BEAT, 5.5 * BEAT))
  const back = hero(span(rel, 6 * BEAT, 7.8 * BEAT))
  const focus = lerp2(lerp2([500, 240], [1160, 250], across), [760, 470], back)
  return (
    <Flat focus={focus} zoom={mix(1.85, 1.08, back)}>
      <TodayUI t={rel} />
    </Flat>
  )
}

/** The day's chores, popping in on the beat around "Running a shop is a lot." */
const CHORES: { text: string; x: number; y: number; tone: string; ink?: boolean }[] = [
  { text: '3 new orders', x: 250, y: 230, tone: CORAL },
  { text: 'Cinnamon bun · 2 left', x: 1290, y: 190, tone: '#E8C15A', ink: true },
  { text: 'Card fee  −$0.86', x: 170, y: 760, tone: SURFACE, ink: true },
  { text: 'Online order from Noor', x: 1240, y: 820, tone: TEAL, ink: true },
  { text: 'Where’s table 4’s receipt?', x: 700, y: 900, tone: SURFACE, ink: true },
  { text: 'Close the day', x: 820, y: 120, tone: CORAL },
]
function ProblemShot({ t }: { t: number }) {
  const gather = span(t, 6.5 * BEAT, S.title) ** 2
  return (
    <AbsoluteFill style={{ background: INK }}>
      {CHORES.map((c, i) => {
        const at = (i + 2) * BEAT
        const pop = bounce(t, at)
        if (pop <= 0) return null
        const drift = (t - at) * 14
        const x = mix(c.x + (i % 2 ? drift : -drift), 960, gather)
        const y = mix(c.y, 540, gather)
        return (
          <div key={c.text} style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${pop * (1 - gather)}) rotate(${(i % 2 ? 1 : -1) * (3 + i)}deg)`, height: 74, padding: '0 30px', borderRadius: 37, background: c.tone, color: c.ink ? INK : '#fff', fontFamily: 'Manrope', fontWeight: 800, fontSize: 32, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', border: `3px solid ${SURFACE}` }}>
            {c.text}
          </div>
        )
      })}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `scale(${1 - gather})` }}>
        <Words t={t} at={cues.vo.problem} text={'Running a shop\nis a lot.'} style={{ ...display, color: SURFACE, fontSize: 132, textAlign: 'center' }} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const display: React.CSSProperties = { fontFamily: 'Manrope', fontWeight: 800, letterSpacing: -4, lineHeight: 0.98 }
const body: React.CSSProperties = { fontFamily: 'Manrope', fontWeight: 600 }

export function ShopOsFilm({ voice = true }: { voice?: boolean }) {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const t = frame / FPS
  const in3d = (t >= S.title && t < S.sell) || (t >= S.pay && t < S.orders) || (t >= S.hand && t < S.today) || t >= S.end
  return (
    <AbsoluteFill style={{ background: '#e9e3d8' }}>
      {in3d ? (
        <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.05 }} camera={{ fov: 26, near: 0.02, far: 60 }}>
          <Scene t={t} />
        </ThreeCanvas>
      ) : null}
      {t < S.title ? <ProblemShot t={t} /> : null}
      {t >= S.sell && t < S.explode ? <SellShot t={t} /> : null}
      {t >= S.explode && t < S.pay ? <ExplodeShot t={t} /> : null}
      {t >= S.orders && t < S.hand ? <OrdersShot t={t} /> : null}
      {t >= S.today && t < S.end ? <TodayShot t={t} /> : null}

      {t >= S.title && t < S.sell ? (
        <div style={{ position: 'absolute', left: 110, top: 150, opacity: 1 - span(t, S.sell - 1.0, S.sell - 0.6) }}>
          <div style={{ opacity: sp(t, S.title + 0.3), transform: `translateY(${(1 - sp(t, S.title + 0.3)) * 24}px)` }}>
            <Mark h={80} />
          </div>
          <Words t={t} at={S.title + 0.4} text={'Kova\nShop OS'} style={{ ...display, color: C.ink, fontSize: 130, marginTop: 18 }} />
        </div>
      ) : null}
      {t >= S.hand && t < S.today ? (
        <div style={{ position: 'absolute', left: 110, top: 170 }}>
          <Words t={t} at={S.hand + 0.3} out={S.today - 0.3} text={'Same shop,\nin your hand.'} style={{ ...display, color: C.ink, fontSize: 104 }} />
        </div>
      ) : null}
      {t >= S.end ? (
        <div style={{ position: 'absolute', left: 110, top: 230 }}>
          <div style={{ opacity: sp(t, S.end + 0.2), transform: `translateY(${(1 - sp(t, S.end + 0.2)) * 30}px)` }}>
            <Mark h={96} />
          </div>
          <Words t={t} at={cues.vo.end} text={'Kova\nShop OS'} style={{ ...display, color: C.ink, fontSize: 132, marginTop: 24 }} />
          <div style={{ ...body, color: C.ink, fontSize: 30, marginTop: 18, opacity: sp(t, cues.vo.end + 1.2) }}>Register · Terminal · your online shop</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 34, opacity: sp(t, cues.url), transform: `scale(${sp(t, cues.url, BOUNCY)})`, transformOrigin: 'left center' }}>
            <span style={{ ...body, fontWeight: 800, color: C.ink, fontSize: 40, padding: '14px 30px', borderRadius: 999, border: `5px solid ${C.ink}`, background: '#f4f2ed' }}>mykova.app</span>
            <span style={{ ...body, fontWeight: 700, color: C.ink, fontSize: 28, padding: '18px 24px', borderRadius: 999, border: `4px solid ${C.ink}`, alignSelf: 'center' }}>Concept</span>
          </div>
        </div>
      ) : null}

      <Captions t={t} starts={cues.vo} lines={LINES} />
      <Finish frame={frame} />
      <AbsoluteFill style={{ background: '#000', opacity: 1 - decel(span(t, 0, 0.6)), pointerEvents: 'none' }} />

      {voice ? <Html5Audio src={staticFile('os/audio/score.wav')} volume={0.5} /> : null}
      {voice
        ? vo.lines.map((l) => (
            <Sequence key={l.id} from={Math.round(cues.vo[l.id as keyof typeof cues.vo] * FPS)} layout="none">
              <Html5Audio src={staticFile(l.file)} volume={1.6} />
            </Sequence>
          ))
        : null}
    </AbsoluteFill>
  )
}
