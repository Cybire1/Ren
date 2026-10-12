/**
 * "Every table is a counter": a 35-second motion spot for Kova's table ordering and stamp card.
 * No voice: small words that build inside brackets, one 3D table, the real app on a phone, and a
 * sound design of ticks, whooshes and one chime (scripts/sound-spot.py). The numbers are from a
 * real order at Ada's Bakery on Monad testnet (public/spot/run.json).
 *
 * Shots (src/spot/spot-cues.json):
 *   imagine  a warm blur and a waiting silhouette; "Imagine still queueing to pay", letter by letter
 *   bracket  paper ground, words grow inside four corner dots, with pictures inline
 *   table    a café table in 3D, thermal first, then real; a phone rises to the table's QR code
 *   type     teal ground, a huge kova; the order types itself into a bar; Pay; Paid
 *   ready    the order's steps on a tree line, then the phone says it's ready: no buzzer
 *   stamps   dots gather into a stamp card, five stamps land, receipts fan out; the next one is free
 *   end      a warm wave rises; "{ Tap. Paid. Anywhere. }"; the shop's board on a tilted tile; mykova.app
 */
import { ContactShadows, Environment, Lightformer, useTexture } from '@react-three/drei'
import { noise2D } from '@remotion/noise'
import { ThreeCanvas } from '@remotion/three'
import type React from 'react'
import { AbsoluteFill, Html5Audio, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import * as THREE from 'three'
import run from '../../public/spot/run.json'
import { CameraAim } from '../atm/KovaPoint3D'
import { Mark } from '../atm/Textures'
import { IPhone } from '../iphone'
import { decel, easeInOut, mix, span } from '../motion'
import { Grain } from '../parts'
import { bounce, CORAL, FPS, hero, IMG, INK, MUTED, PAPER, SURFACE, TEAL } from '../os/ui/kit'
import cues from './spot-cues.json'

export const SPOT_DURATION = cues.duration
const S = cues.shots
const ease = (t: number, a: number, b: number) => easeInOut(span(t, a, b))
const rise = (t: number, at: number, d = 0.5) => hero(span(t, at, at + d))
const GROUND = '#e9e8e4'
const YELLOW = '#f2c96b'
const BLUSH = '#ebb3aa'
const TEAL_DEEP = '#46878b'
const ui: React.CSSProperties = { fontFamily: 'Manrope', color: INK }

// ——— Grounds ——————————————————————————————————————————————————————————————————————

/** Soft colour fields that drift: the warm open and close. */
function Blur({ t, palette, style }: { t: number; palette: string[]; style?: React.CSSProperties }) {
  const blobs = palette.map((c, i) => {
    const x = 50 + 34 * noise2D(`x${i}`, t * 0.08, i)
    const y = 50 + 30 * noise2D(`y${i}`, t * 0.07, i * 3)
    return `radial-gradient(circle at ${x}% ${y}%, ${c} 0%, transparent ${46 + i * 6}%)`
  })
  return <AbsoluteFill style={{ background: blobs.join(','), filter: 'blur(40px)', transform: 'scale(1.15)', ...style }} />
}

/** Four small squares at the corners of a box that fits the words: the spot's frame. */
function Corners({ w, h, o = 1, pad = 22 }: { w: number; h: number; o?: number; pad?: number }) {
  const d = 7
  const pts = [
    [-w / 2 - pad, -h / 2 - pad],
    [w / 2 + pad, -h / 2 - pad],
    [-w / 2 - pad, h / 2 + pad],
    [w / 2 + pad, h / 2 + pad],
  ]
  return (
    <>
      {pts.map(([x, y], i) => (
        <div key={i} style={{ position: 'absolute', left: `calc(50% + ${x - d / 2}px)`, top: `calc(50% + ${y - d / 2}px)`, width: d, height: d, background: INK, opacity: o }} />
      ))}
    </>
  )
}

// ——— 1. Imagine ————————————————————————————————————————————————————————————————————

function Imagine({ t }: { t: number }) {
  const text = 'Imagine still queueing to pay'
  const [a, b] = cues.letters
  const n = Math.floor(span(t, a, b) * text.length + 0.0001)
  const out = span(t, cues.scan[0], cues.scan[1])
  return (
    <AbsoluteFill style={{ background: BLUSH, overflow: 'hidden' }}>
      <Blur t={t} palette={[CORAL, YELLOW, '#c79ad6', BLUSH, TEAL]} />
      {/* The one waiting at the counter, out of focus. */}
      <Img src={staticFile(IMG.koviWave)} style={{ position: 'absolute', left: 760 + 30 * t, top: 120, width: 520, filter: 'blur(26px) saturate(1.4)', opacity: 0.75 }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...ui, color: '#fff', fontSize: 34, fontWeight: 500, letterSpacing: -0.3 }}>
          {text.split('').map((ch, i) => {
            const on = i < n
            const fresh = on && i >= n - 4
            return (
              <span key={i} style={{ opacity: on ? 1 : 0, color: fresh ? CORAL : '#fff' }}>
                {ch}
              </span>
            )
          })}
        </div>
      </AbsoluteFill>
      {/* The scan: thin bands slide away and take the picture with them. */}
      {out > 0
        ? Array.from({ length: 18 }, (_, i) => (
            <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * 60, height: 60, background: GROUND, transform: `translateX(${(1 - hero(span(out, i * 0.02, 0.6 + i * 0.02))) * (i % 2 ? 1 : -1) * 1920}px)` }} />
          ))
        : null}
    </AbsoluteFill>
  )
}

// ——— 2. Bracket ————————————————————————————————————————————————————————————————————

type Part = string | { img: string; w: number }

/** Words that join one at a time inside "{ }", with pictures inline, in four corner dots. */
function Bracket({ t, parts, times, out, size = 34 }: { t: number; parts: Part[]; times: number[]; out?: number; size?: number }) {
  const shown = parts.map((_, i) => rise(t, times[i] ?? 0, 0.35))
  const width = parts.reduce<number>((w, p, i) => w + (typeof p === 'string' ? p.length * size * 0.5 + 10 : p.w + 12) * (shown[i] ?? 0), 0)
  const leave = out === undefined ? 0 : hero(span(t, out, out + 0.4))
  const appear = rise(t, (times[0] ?? 0) - 0.25, 0.3)
  if (appear <= 0) return null
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: appear * (1 - leave), transform: `translateX(${-leave * 160}px)` }}>
      <Corners w={width + 40} h={size * 1.6} o={rise(t, (times[0] ?? 0) - 0.2)} pad={60} />
      <div style={{ ...ui, fontSize: size, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
        <span>{'{'}</span>
        {parts.map((p, i) => {
          const s = shown[i] ?? 0
          if (s <= 0) return null
          if (typeof p === 'string')
            return (
              <span key={i} style={{ opacity: s, filter: `blur(${(1 - s) * 6}px)` }}>
                {p}
              </span>
            )
          return (
            <span key={i} style={{ display: 'inline-block', width: p.w * s, height: size * 1.25, borderRadius: 8, overflow: 'hidden', background: SURFACE }}>
              <Img src={staticFile(p.img)} style={{ width: p.w, height: '100%', objectFit: 'cover' }} />
            </span>
          )
        })}
        <span>{'}'}</span>
      </div>
    </AbsoluteFill>
  )
}

function BracketShot({ t }: { t: number }) {
  const w = cues.words
  return (
    <AbsoluteFill style={{ background: GROUND }}>
      {t < (w[4] ?? 0) - 0.05 ? (
        <Bracket t={t} parts={['order', 'from', { img: IMG.flatwhite, w: 70 }, 'your table']} times={[w[0], w[1], w[2], w[3]] as number[]} out={(w[4] ?? 0) - 0.45} />
      ) : (
        <Bracket t={t} parts={['pay', 'in', { img: IMG.coin, w: 52 }, 'a second']} times={[w[4], w[5], w[5], w[6]] as number[]} out={S.table - 0.4} />
      )}
    </AbsoluteFill>
  )
}

// ——— 3. Table (3D) ——————————————————————————————————————————————————————————————————

function Tent() {
  const tex = useTexture(staticFile('spot/tent.png'))
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  // Two faces leaning on each other: the front carries the table's QR code.
  return (
    <group position={[0, 0.74, 0.02]}>
      <mesh position={[0, 0.072, 0.03]} rotation={[-0.32, 0, 0]} castShadow>
        <boxGeometry args={[0.2, 0.15, 0.004]} />
        <meshStandardMaterial attach="material-0" color={SURFACE} />
        <meshStandardMaterial attach="material-1" color={SURFACE} />
        <meshStandardMaterial attach="material-2" color={SURFACE} />
        <meshStandardMaterial attach="material-3" color={SURFACE} />
        <meshStandardMaterial attach="material-4" map={tex} roughness={0.55} />
        <meshStandardMaterial attach="material-5" color={SURFACE} />
      </mesh>
      <mesh position={[0, 0.072, -0.018]} rotation={[0.32, 0, 0]} castShadow>
        <boxGeometry args={[0.2, 0.15, 0.004]} />
        <meshStandardMaterial color={CORAL} roughness={0.6} />
      </mesh>
    </group>
  )
}

function Cup({ at }: { at: [number, number, number] }) {
  return (
    <group position={at}>
      <mesh position={[0, 0.006, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.075, 0.068, 0.012, 48]} />
        <meshStandardMaterial color="#f7f5f0" roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.034, 0.075, 48, 1, true]} />
        <meshStandardMaterial color="#f7f5f0" roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.078, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.042, 48]} />
        <meshStandardMaterial color="#c79a6b" roughness={0.6} />
      </mesh>
      <mesh position={[0.05, 0.05, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <torusGeometry args={[0.017, 0.005, 12, 32, Math.PI]} />
        <meshStandardMaterial color="#f7f5f0" roughness={0.3} />
      </mesh>
    </group>
  )
}

function Cafe({ t }: { t: number }) {
  const p = ease(t, S.table, cues.dive[1])
  const push = span(t, cues.phoneUp[0], cues.dive[1]) ** 2
  const pos: [number, number, number] = [mix(1.25, 0.5, p) * (1 - push) + 0.02 * push, mix(1.55, 1.12, p) * (1 - push) + 0.86 * push, mix(1.7, 0.95, p) * (1 - push) + 0.42 * push]
  const look: [number, number, number] = [mix(0, 0, p), mix(0.68, 0.78, p) * (1 - push) + 0.81 * push, 0]
  const ground = new THREE.Color('#e9e3d8')
  return (
    <>
      <CameraAim position={pos} target={look} />
      <color attach="background" args={[ground]} />
      <fog attach="fog" args={[ground, 4, 12]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[-1.5, 6, 2.5]} intensity={2.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-2} shadow-camera-right={2} shadow-camera-top={2} shadow-camera-bottom={-2} shadow-bias={-0.0003} shadow-radius={6} />
      <directionalLight position={[3, 2, -2]} intensity={1.1} color="#ffe9d6" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} position={[-3, 2.5, 2.5]} scale={[1.2, 5, 1]} target={[0, 1, 0]} />
        <Lightformer form="rect" intensity={2} position={[3, 2, 2]} scale={[1, 4, 1]} target={[0, 1, 0]} color="#ffe6d2" />
        <Lightformer form="rect" intensity={2.5} position={[0, 5, 0.5]} scale={[4, 0.6, 1]} target={[0, 0, 0]} />
      </Environment>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color={ground} roughness={0.95} />
      </mesh>
      {/* The table: a round top on one stem. */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.035, 96]} />
        <meshStandardMaterial color="#f1efea" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.425, 0.425, 0.012, 96]} />
        <meshStandardMaterial color={INK} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.36, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.7, 24]} />
        <meshStandardMaterial color={INK} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.024, 64]} />
        <meshStandardMaterial color={INK} roughness={0.4} metalness={0.3} />
      </mesh>
      <Tent />
      <Cup at={[-0.2, 0.738, 0.12]} />
      <ContactShadows position={[0, 0.001, 0]} opacity={0.5} scale={4} blur={2.4} far={1.2} resolution={512} color="#2a2119" frames={1} />
    </>
  )
}

function TableShot({ t }: { t: number }) {
  const { width, height } = useVideoConfig()
  // Thermal first, as if the room were still being built, then the real thing.
  const real = ease(t, cues.thermal[0], cues.thermal[1])
  const filter = `hue-rotate(${mix(250, 0, real)}deg) saturate(${mix(3.4, 1, real)}) contrast(${mix(1.35, 1, real)})`
  const up = rise(t, cues.phoneUp[0], cues.phoneUp[1] - cues.phoneUp[0])
  const dive = span(t, cues.dive[0], cues.dive[1]) ** 2.4
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter }}>
        <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.05 }} camera={{ fov: 30, near: 0.01, far: 40 }}>
          <Cafe t={t} />
        </ThreeCanvas>
      </AbsoluteFill>
      {up > 0 ? (
        <IPhone src="spot/stall-table.png" h={mix(760, 2600, dive)} x={mix(1340, 960, dive)} y={mix(1500, 540, up) + mix(0, 0, dive)} rotate={mix(8, 0, Math.max(up, dive))} ry={mix(-14, 0, dive)} />
      ) : null}
      <AbsoluteFill style={{ background: TEAL, opacity: span(t, cues.dive[1] - 0.12, cues.dive[1]) }} />
    </AbsoluteFill>
  )
}

// ——— 4. Type ————————————————————————————————————————————————————————————————————————

function TypeShot({ t }: { t: number }) {
  const text = `Flat white, croissant · table ${run.table}`
  const [a, b] = cues.typing
  const n = Math.floor(span(t, a, b) * text.length)
  const caret = Math.floor(t * 2.4) % 2 === 0
  // In close on the words as they type, then out to the whole bar, which becomes Pay.
  const zoom = mix(mix(0.6, 2.6, ease(t, S.type, a + 0.3)), 1, ease(t, b + 0.1, b + 0.6))
  // Keep the caret just right of centre while close in: the bar slides under the camera as it types.
  const caretX = 450 + 38 + n * 19.5
  const follow = Math.min(1, Math.max(0, (zoom - 1) / 1.6))
  const shift = -((1150 - 960) / zoom - (caretX - 960)) * follow
  const paid = span(t, cues.paid, cues.paid + 0.25)
  const tap = span(t, cues.payTap, cues.payTap + 0.18)
  const press = 1 - 0.06 * Math.sin(Math.PI * tap)
  return (
    <AbsoluteFill style={{ background: TEAL, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 20%, #ffffff55, transparent 50%), radial-gradient(circle at 80% 80%, ${TEAL_DEEP}66, transparent 55%)` }} />
      {/* The wordmark, too big for the frame, behind everything. */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `scale(${mix(1.25, 1, ease(t, S.type, S.ready))})` }}>
        <div style={{ ...ui, fontSize: 560, fontWeight: 800, letterSpacing: -40, color: '#ffffff', opacity: 0.55, mixBlendMode: 'soft-light' }}>kova</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `scale(${zoom}) translateX(${-shift / zoom}px)` }}>
        <div style={{ position: 'relative', width: 1020, height: 104, borderRadius: 52, background: paid > 0 ? CORAL : SURFACE, border: `3px solid ${INK}`, display: 'flex', alignItems: 'center', padding: '0 14px 0 38px', transform: `scale(${press})`, boxShadow: '0 30px 60px #0b1a1d22' }}>
          {t < cues.payTap ? (
            <>
              <span style={{ ...ui, fontSize: 36, fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {text.slice(0, n)}
                <span style={{ opacity: caret || n < text.length ? 1 : 0, color: CORAL }}>|</span>
              </span>
              <span style={{ ...ui, fontSize: 30, fontWeight: 800, color: '#fff', background: INK, borderRadius: 40, padding: '18px 30px', opacity: rise(t, b + 0.2) }}>Pay {run.total}</span>
            </>
          ) : (
            <span style={{ ...ui, flex: 1, textAlign: 'center', fontSize: 40, fontWeight: 800, color: paid > 0 ? '#fff' : INK }}>
              {paid > 0 ? `Paid · ${run.seconds} s on Monad` : `Pay ${run.total}`}
            </span>
          )}
        </div>
      </AbsoluteFill>
      {/* Face ID's ring at the tap. */}
      {tap > 0 && tap < 1 ? <div style={{ position: 'absolute', left: 960 - 160 * tap, top: 540 - 160 * tap, width: 320 * tap, height: 320 * tap, borderRadius: '50%', border: `4px solid ${INK}`, opacity: 1 - tap }} /> : null}
    </AbsoluteFill>
  )
}

// ——— 5. Ready ————————————————————————————————————————————————————————————————————————

const STEPS = [
  { title: 'Ordered', detail: `Table ${run.table} · Flat white, croissant`, dot: TEAL },
  { title: 'Paid', detail: `${run.seconds} s on Monad · $0.00 in fees`, dot: TEAL_DEEP },
  { title: 'Preparing', detail: "Ada's Bakery", dot: YELLOW },
  { title: 'Ready', detail: `Bringing it to table ${run.table}`, dot: CORAL },
]

function ReadyShot({ t }: { t: number }) {
  const intro = rise(t, S.ready + 0.05, 0.4)
  const phone = rise(t, cues.readyPhone, 0.6)
  const buzz = t > cues.buzz && t < cues.buzz + 0.5 ? Math.sin((t - cues.buzz) * 90) * 6 * (1 - (t - cues.buzz) / 0.5) : 0
  const listX = mix(0, -330, phone)
  return (
    <AbsoluteFill style={{ background: GROUND }}>
      <div style={{ position: 'absolute', left: 700 + listX, top: 300, ...ui }}>
        <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.4, opacity: intro, backgroundImage: `linear-gradient(90deg, ${CORAL}, ${INK} ${intro * 100}%)`, WebkitBackgroundClip: 'text', color: 'transparent' }}>Your order</div>
        <div style={{ position: 'relative', marginTop: 26, paddingLeft: 34 }}>
          <div style={{ position: 'absolute', left: 8, top: 4, width: 2, height: 360 * rise(t, S.ready + 0.2, 1.8), background: '#c9c6bf' }} />
          {STEPS.map((s, i) => {
            const on = rise(t, cues.steps[i] ?? 0, 0.35)
            const last = i === STEPS.length - 1
            return (
              <div key={s.title} style={{ display: 'flex', alignItems: 'baseline', gap: 16, height: 86, marginLeft: -34, opacity: on, transform: `translateY(${(1 - on) * 14}px)` }}>
                <div style={{ width: 18, height: 18, marginRight: 0, flexShrink: 0, alignSelf: 'center', marginTop: -30, borderRadius: 6, background: s.dot, transform: `scale(${last ? 1 + 0.25 * bounce(t, cues.steps[i] ?? 0) : 1})` }} />
                <span style={{ fontSize: 30, fontWeight: 700, color: last ? CORAL : INK }}>{s.title}</span>
                <span style={{ fontSize: 24, fontWeight: 500, color: MUTED }}>{s.detail}</span>
              </div>
            )
          })}
          <div style={{ fontSize: 18, fontWeight: 500, color: MUTED, opacity: intro * (1 - span(t, cues.steps[3] ?? 0, (cues.steps[3] ?? 0) + 0.3)) }}>Working</div>
        </div>
      </div>
      {phone > 0 ? <IPhone src="spot/ready.png" h={760} x={mix(2200, 1390, phone) + buzz} y={540} rotate={mix(10, -3, phone)} ry={-8} /> : null}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 90, height: 60 }}>
        <Bracket t={t} parts={['no', 'buzzer']} times={[cues.buzz + 0.2, cues.buzz + 0.45]} size={28} />
      </div>
    </AbsoluteFill>
  )
}

// ——— 6. Stamps ————————————————————————————————————————————————————————————————————————

const EVERY = run.every

/** The stamp card, drawn like the app's: five circles, Kovi waiting in the last. */
function StampCard({ t, filled, scale = 1 }: { t: number; filled: number; scale?: number }) {
  return (
    <div style={{ ...ui, width: 760, padding: '34px 40px', borderRadius: 40, border: `3px solid ${INK}`, background: SURFACE, transform: `scale(${scale})` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.8 }}>Your stamp card</span>
        <span style={{ fontSize: 24, fontWeight: 600, color: MUTED }}>
          {Math.min(filled, EVERY)} of {EVERY}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 22, marginTop: 28 }}>
        {Array.from({ length: EVERY }, (_, i) => {
          const hit = cues.stampHits[i] ?? 99
          const land = i < filled ? bounce(t, hit) : 0
          return (
            <div key={i} style={{ width: 112, height: 112, borderRadius: 56, border: `3px ${i < filled ? 'solid' : 'dashed'} ${INK}`, background: i < filled ? CORAL : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${i < filled ? 0.6 + 0.4 * land : 1})` }}>
              {i < filled ? <Img src={staticFile(IMG.coin)} style={{ width: 70, opacity: land }} /> : null}
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: MUTED, marginTop: 24 }}>{filled >= EVERY ? 'Full. Your next croissant is on us.' : 'No sign-up. Your wallet is the card.'}</div>
    </div>
  )
}

function StampsShot({ t }: { t: number }) {
  const [d0, d1] = cues.dots
  const gather = hero(span(t, d0, d1))
  const card = span(t, d1 - 0.15, d1 + 0.25)
  const filled = cues.stampHits.filter((h) => t >= h).length
  const fan = hero(span(t, cues.fan[0], cues.fan[1]))
  const free = rise(t, cues.free, 0.5)
  const dots = Array.from({ length: 140 }, (_, i) => {
    const col = i % 14
    const row = Math.floor(i / 14)
    const home = [960 - 340 + col * 52, 540 - 120 + row * 26]
    const wild = [960 + 760 * noise2D('dx', i, 0.3), 540 + 420 * noise2D('dy', i, 0.7)]
    return { x: mix(wild[0] ?? 0, home[0] ?? 0, gather), y: mix(wild[1] ?? 0, home[1] ?? 0, gather), c: [CORAL, YELLOW, TEAL, BLUSH, TEAL_DEEP][i % 5] }
  })
  const receipts = ['Flat white', 'Croissant', 'Latte', 'Cinnamon bun', 'Flat white']
  return (
    <AbsoluteFill style={{ background: GROUND, overflow: 'hidden' }}>
      {card < 1
        ? dots.map((d, i) => <div key={i} style={{ position: 'absolute', left: d.x - 9, top: d.y - 9, width: 18, height: 18, borderRadius: 9, background: d.c, opacity: 1 - card }} />)
        : null}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: card * (1 - span(fan, 0, 0.35)), transform: `scale(${mix(0.94, 1, card) * mix(1, 0.8, fan)})` }}>
        <StampCard t={t} filled={filled} />
      </AbsoluteFill>
      {/* Five paid visits fan out, and the words take their places around them. */}
      {fan > 0 ? (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          {receipts.map((r, i) => {
            const k = i - 2
            return (
              <div key={i} style={{ ...ui, position: 'absolute', width: 230, height: 300, borderRadius: 22, border: `3px solid ${INK}`, background: i % 2 ? SURFACE : '#fff', padding: 22, transform: `translateX(${k * 120 * fan - 120 * free}px) rotate(${k * 7 * fan}deg) translateY(${Math.abs(k) * 14 * fan}px) scale(${1 - 0.25 * free})`, opacity: 1 - 0.4 * free, boxShadow: '0 20px 40px #0b1a1d1c' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: MUTED }}>ADA'S BAKERY</div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 16 }}>{r}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: MUTED, marginTop: 6 }}>Paid on Monad</div>
                <div style={{ position: 'absolute', bottom: 22, left: 22, width: 54, height: 54, borderRadius: 27, background: CORAL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Img src={staticFile(IMG.coin)} style={{ width: 34 }} />
                </div>
              </div>
            )
          })}
          {[
            ['every', -520, -10],
            ['visit', -40, -230],
            ['counts', 470, 150],
          ].map(([w, x, y], i) => (
            <div key={w as string} style={{ ...ui, position: 'absolute', fontSize: 36, fontWeight: 500, transform: `translate(${x as number}px, ${y as number}px)`, opacity: rise(t, cues.fan[0] + 0.25 + i * 0.3, 0.35) * (1 - free) }}>
              {w}
            </div>
          ))}
          {free > 0 ? (
            <div style={{ ...ui, position: 'absolute', width: 380, height: 470, borderRadius: 30, border: `3px solid ${INK}`, background: '#fff', padding: 34, transform: `translateX(${mix(500, 340, free)}px) rotate(${mix(8, -3, free)}deg)`, opacity: free, boxShadow: '0 30px 60px #0b1a1d26' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: MUTED }}>ADA'S BAKERY · VISIT {EVERY + 1}</div>
              <div style={{ fontSize: 40, fontWeight: 800, marginTop: 22, letterSpacing: -1 }}>Croissant</div>
              <div style={{ fontSize: 64, fontWeight: 800, color: CORAL, marginTop: 8, letterSpacing: -2 }}>Free</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: MUTED, marginTop: 26, lineHeight: 1.35 }}>
                Paid $0.00 with the stamp card.
                <br />
                Still a receipt on Monad.
                <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 16, marginTop: 14, color: INK }}>
                  {`${run.free.tx.slice(0, 10)}…${run.free.tx.slice(-6)}`}
                </div>
              </div>
              <Img src={staticFile(IMG.koviCheer)} style={{ position: 'absolute', right: 20, bottom: 18, width: 120 }} />
            </div>
          ) : null}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  )
}

// ——— 7. End ————————————————————————————————————————————————————————————————————————————

function EndShot({ t }: { t: number }) {
  const wave = hero(span(t, S.end, S.end + 1.2))
  const w = cues.endWords
  const tile = rise(t, cues.tile, 0.7)
  return (
    <AbsoluteFill style={{ background: GROUND, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -200, right: -200, bottom: mix(-900, -260, wave), height: 900, borderRadius: '50% 50% 0 0', overflow: 'hidden' }}>
        <Blur t={t} palette={[CORAL, YELLOW, BLUSH, '#c79ad6', CORAL]} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 380, height: 80, transform: `translateY(${-tile * 160}px)` }}>
        <Bracket t={t} parts={['Tap.', 'Paid.', 'Anywhere.']} times={[w[0], w[1], w[2]] as number[]} />
      </div>
      {tile > 0 ? (
        <div style={{ position: 'absolute', left: 960 - 330, top: 560, width: 660, height: 380, borderRadius: 26, overflow: 'hidden', border: `3px solid ${INK}`, background: SURFACE, transform: `perspective(1400px) rotateX(${mix(40, 12, tile)}deg) rotateZ(${mix(-6, -2, tile)}deg) translateY(${mix(300, 0, tile)}px)`, boxShadow: '0 40px 80px #0b1a1d33' }}>
          <Img src={staticFile('spot/orders.png')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%' }} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 70, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, opacity: rise(t, cues.url, 0.5) }}>
        <Mark h={56} />
        <span style={{ ...ui, fontSize: 34, fontWeight: 800, padding: '10px 26px', borderRadius: 999, border: `4px solid ${INK}`, background: SURFACE }}>mykova.app</span>
      </div>
    </AbsoluteFill>
  )
}

export function TableSpot({ sound = true }: { sound?: boolean }) {
  const frame = useCurrentFrame()
  const t = frame / FPS
  return (
    <AbsoluteFill style={{ background: GROUND }}>
      {t < S.bracket ? <Imagine t={t} /> : null}
      {t >= S.bracket && t < S.table ? <BracketShot t={t} /> : null}
      {t >= S.table && t < S.type ? <TableShot t={t} /> : null}
      {t >= S.type && t < S.ready ? <TypeShot t={t} /> : null}
      {t >= S.ready && t < S.stamps ? <ReadyShot t={t} /> : null}
      {t >= S.stamps && t < S.end ? <StampsShot t={t} /> : null}
      {t >= S.end ? <EndShot t={t} /> : null}
      <Grain frame={frame} />
      <AbsoluteFill style={{ background: '#000', opacity: 1 - decel(span(t, 0, 0.4)) + span(t, cues.duration - 0.5, cues.duration), pointerEvents: 'none' }} />
      {sound ? <Html5Audio src={staticFile('spot/sound.wav')} /> : null}
    </AbsoluteFill>
  )
}
