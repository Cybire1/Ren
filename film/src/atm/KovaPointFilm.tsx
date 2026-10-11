/**
 * "Kova comes to your shop": a concept film for Kova Point, a Kova ATM at the shop on the corner.
 * Real 3D (three.js). Every number shown is from Kova's real runs: Lena's payment in Berlin settled
 * in about a second (0.9–1.0 s across the film's runs), fees $0.00, and €44.27 is $50 at the
 * rate her real $22.00 payment used (€19.48). Kova Point itself is a concept, and says so.
 *
 * Shots (one continuous camera, no cuts):
 *   0–6    dawn: close on the dark sign, it lights, the camera pulls back to the shop
 *   6–11   the reveal: "Kova comes to your shop."
 *   11–17  tap: a Kova Card flies in and taps, the screen says hello
 *   17–25  send: $50 to Lena in Berlin, sent, a coin leaves for Berlin
 *   25–31  cash: notes slide out of the drawer
 *   31–39  home: money from abroad flies in and lands
 *   39–47  end: Kova Point, coming to the shop on your corner
 */
import { Billboard, useTexture } from '@react-three/drei'
import { ThreeCanvas } from '@remotion/three'
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import * as THREE from 'three'
import vo from '../../public/point/audio/vo.json'
import { decel, easeInOut, FPS, mix, span } from '../motion'
import { Captions, Grain, type Line } from '../parts'
import { BOUNCY, sp, Words } from '../ShopLink'
import { C } from '../theme'
import { Awning, CameraAim, KovaCard3D, KovaPoint, type Screen, Studio } from './KovaPoint3D'
import cues from './point-cues.json'
import { Mark } from './Textures'

export const POINT_DURATION = cues.duration
const LINES = vo.lines as Line[]

type V3 = [number, number, number]
type Key = { t: number; pos: V3; at: V3 }

/** The camera's path: key positions, eased from one to the next, never still. */
const KEYS: Key[] = [
  { t: 0, pos: [0.05, 2.0, 1.7], at: [0, 1.95, 0] },
  { t: 5.6, pos: [0.5, 1.85, 3.6], at: [0, 1.55, 0] },
  { t: 8.0, pos: [-2.6, 1.55, 4.7], at: [-0.35, 1.05, 0] },
  { t: 11.0, pos: [-2.2, 1.5, 4.4], at: [-0.3, 1.05, 0] },
  { t: 12.9, pos: [-0.75, 1.5, 1.85], at: [-0.08, 1.02, 0.42] },
  { t: 16.6, pos: [-0.55, 1.45, 1.75], at: [-0.05, 1.02, 0.42] },
  { t: 18.2, pos: [0.12, 1.42, 1.65], at: [0, 1.27, 0.3] },
  { t: 24.4, pos: [0.04, 1.38, 1.5], at: [0, 1.27, 0.3] },
  { t: 26.0, pos: [0.7, 0.95, 1.55], at: [0, 0.68, 0.4] },
  { t: 30.6, pos: [0.55, 1.0, 1.45], at: [0, 0.68, 0.4] },
  { t: 32.2, pos: [2.5, 1.55, 4.1], at: [0.2, 1.15, 0] },
  { t: 38.4, pos: [2.0, 1.5, 4.3], at: [0.2, 1.15, 0] },
  { t: 40.2, pos: [-1.9, 1.45, 4.8], at: [-1.0, 1.1, 0] },
  { t: 47, pos: [-1.3, 1.5, 5.0], at: [-1.0, 1.1, 0] },
]

function camera(t: number): { pos: V3; at: V3 } {
  const i = Math.max(0, KEYS.findIndex((k, j) => t >= k.t && t < (KEYS[j + 1]?.t ?? Infinity)))
  const a = KEYS[i] as Key
  const b = KEYS[i + 1] ?? a
  const p = easeInOut(span(t, a.t, b.t))
  const lerp = (x: V3, y: V3): V3 => [mix(x[0], y[0], p), mix(x[1], y[1], p), mix(x[2], y[2], p)]
  return { pos: lerp(a.pos, b.pos), at: lerp(a.at, b.at) }
}

function screenAt(t: number): Screen {
  if (t >= cues.cash) return t >= cues.home[0] ? 'menu' : 'cash'
  if (t >= cues.done) return 'done'
  if (t >= cues.send) return 'send'
  if (t >= cues.menu) return 'menu'
  return 'tap'
}

/** The street behind: the shop's wall, its window and door, and its own big awning. */
function ShopFront({ light }: { light: number }) {
  const wall = new THREE.Color('#2a3238').lerp(new THREE.Color('#ece5d8'), light)
  return (
    <group position={[0, 0, -1.0]}>
      <mesh position={[0, 1.7, 0]} receiveShadow>
        <planeGeometry args={[9, 3.4]} />
        <meshStandardMaterial color={wall} roughness={0.95} />
      </mesh>
      {/* The window, with shelves of stock behind it. */}
      <mesh position={[2.35, 1.45, 0.01]}>
        <planeGeometry args={[1.6, 1.3]} />
        <meshStandardMaterial color="#20302f" roughness={0.2} metalness={0.3} emissive="#ffcf8a" emissiveIntensity={0.25 * (1 - light) + 0.05} />
      </mesh>
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3, 4].map((c) => (
          <mesh key={`${r}${c}`} position={[1.75 + c * 0.3, 1.05 + r * 0.38, 0.05]} castShadow>
            <boxGeometry args={[0.18, 0.22, 0.08]} />
            <meshStandardMaterial color={['#d9573f', '#a9c9c9', '#e8b84a', '#f4f2ed', '#46878b'][(r + c) % 5]} roughness={0.7} />
          </mesh>
        )),
      )}
      <mesh position={[2.35, 2.12, 0.02]}>
        <boxGeometry args={[1.7, 0.06, 0.06]} />
        <meshStandardMaterial color="#0f1c1f" />
      </mesh>
      {/* The door. */}
      <mesh position={[-4.9, 1.05, 0.01]}>
        <planeGeometry args={[0.9, 2.1]} />
        <meshStandardMaterial color="#d9573f" roughness={0.6} />
      </mesh>
      <mesh position={[-4.62, 1.05, 0.03]}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshStandardMaterial color="#e8b84a" metalness={0.8} roughness={0.3} />
      </mesh>
      <Awning width={6.6} depth={0.7} y={2.75} z={0.02} />
    </group>
  )
}

/** A coin on a flight, always facing the camera. */
function Coin({ from, to, p, size = 0.16 }: { from: V3; to: V3; p: number; size?: number }) {
  const [tex] = useTexture([staticFile('art/coin-usd.png')])
  tex.colorSpace = THREE.SRGBColorSpace
  if (p <= 0 || p >= 1) return null
  const e = easeInOut(p)
  const lift = Math.sin(e * Math.PI) * 0.9
  const pos: V3 = [mix(from[0], to[0], e), mix(from[1], to[1], e) + lift, mix(from[2], to[2], e)]
  return (
    <Billboard position={pos}>
      <mesh rotation={[0, 0, e * Math.PI * 4]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial map={tex} transparent alphaTest={0.3} toneMapped={false} />
      </mesh>
    </Billboard>
  )
}

function Scene({ t }: { t: number }) {
  const light = decel(span(t, cues.dawn[0], cues.dawn[1]))
  const cam = camera(t)
  // The card flies in from the right and taps the pad.
  const fly = easeInOut(span(t, cues.card[0], cues.card[1]))
  const away = easeInOut(span(t, cues.menu + 1.6, cues.menu + 2.6))
  const dip = Math.exp(-Math.max(0, t - cues.card[1]) * 6) * (t >= cues.card[1] ? 1 : 0)
  const card: V3 = [mix(1.4, -0.27, fly) + 1.6 * away, mix(1.7, 1.06, fly) - 0.035 * dip + 0.5 * away, mix(1.6, 0.64, fly) + 0.8 * away]
  const pulse = span(t, cues.card[1], cues.card[1] + 0.9)
  const cash = easeInOut(span(t, cues.notes[0], cues.notes[1])) * (1 - span(t, cues.home[0] - 1.2, cues.home[0] - 0.6))
  return (
    <>
      <CameraAim position={cam.pos} target={cam.at} />
      <Studio light={light}>
        <ShopFront light={light} />
        <KovaPoint screen={screenAt(t)} cash={cash} pulse={pulse} glow={mix(0.75, 1, light)} />
        {t > cues.card[0] - 0.1 && t < cues.menu + 2.8 ? (
          <KovaCard3D position={card} rotation={[mix(0.4, -0.3, fly), mix(-1.2, -0.45, fly), mix(-0.4, 0.18, fly)]} scale={1.6} />
        ) : null}
        {/* Off to Berlin. */}
        <Coin from={[0, 1.35, 0.4]} to={[3.4, 2.4, -2]} p={span(t, cues.launch[0], cues.launch[1])} />
        {/* Money home, from three directions. */}
        {cues.home.map((at, i) => (
          <Coin key={at} from={[[-3.5, 2.6, 1][i] as number, 2.2, [-2, 1.5, -3][i] as number]} to={[0, 1.3, 0.32]} p={span(t, at, at + 1.2)} size={0.2} />
        ))}
      </Studio>
    </>
  )
}

const display: React.CSSProperties = { fontFamily: 'Manrope', fontWeight: 800, color: C.ink, letterSpacing: -4, lineHeight: 0.98 }
const body: React.CSSProperties = { fontFamily: 'Manrope', fontWeight: 600, color: C.ink }

function Chip({ t, at, out, x, y, children }: { t: number; at: number; out: number; x: number; y: number; children: React.ReactNode }) {
  const s = sp(t, at, BOUNCY)
  const o = 1 - span(t, out, out + 0.3)
  if (s <= 0 || o <= 0) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `scale(${s})`,
        transformOrigin: 'left center',
        opacity: o,
        background: '#f4f2ed',
        border: `5px solid ${C.ink}`,
        borderRadius: 28,
        padding: '18px 26px',
        boxShadow: '0 24px 50px -20px rgba(11,26,29,0.4)',
        display: 'flex',
        gap: 18,
        alignItems: 'center',
        ...body,
        fontSize: 32,
      }}
    >
      {children}
    </div>
  )
}

export function KovaPointFilm({ voice = true }: { voice?: boolean }) {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const t = frame / FPS
  const dark = 1 - decel(span(t, cues.dawn[0], cues.dawn[1]))
  return (
    <AbsoluteFill style={{ background: '#e6dfd2' }}>
      <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true, preserveDrawingBuffer: true }} camera={{ fov: 30, near: 0.05, far: 60 }}>
        <Scene t={t} />
      </ThreeCanvas>

      {/* The reveal. */}
      <div style={{ position: 'absolute', left: 120, top: 150 }}>
        <Words t={t} at={cues.title[0]} out={cues.title[1]} text={'Kova comes\nto your shop.'} style={{ ...display, fontSize: 120 }} />
      </div>

      {/* Lena, in Berlin, gets hers. */}
      <Chip t={t} at={cues.lena} out={cues.cash - 0.6} x={1250} y={180}>
        <span style={{ width: 64, height: 64, borderRadius: 32, background: C.coralSoft, border: `4px solid ${C.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>L</span>
        <span>
          <b style={{ fontWeight: 800 }}>Lena, Berlin</b>
          <br />
          got €44.27 · 0.9 s · $0.00 fee
        </span>
      </Chip>

      {/* Money home. */}
      {['From London', 'From Dubai', 'From Toronto'].map((label, i) => (
        <Chip key={label} t={t} at={(cues.home[i] as number) + 1.1} out={cues.endIn - 0.5} x={[120, 120, 120][i] as number} y={180 + i * 120}>
          <span style={{ fontWeight: 800 }}>+ $100</span>
          <span>{label}</span>
        </Chip>
      ))}

      {/* The end. */}
      <div style={{ position: 'absolute', left: 120, top: 220 }}>
        <div style={{ opacity: sp(t, cues.endIn + 0.5), transform: `translateY(${(1 - sp(t, cues.endIn + 0.5)) * 30}px)` }}>
          <Mark h={110} />
        </div>
        <Words t={t} at={cues.vo.end + 0.3} text="Kova Point" style={{ ...display, fontSize: 150, marginTop: 30 }} />
        <Words t={t} at={cues.line} text={'Coming to the shop\non your corner.'} style={{ ...display, fontSize: 64, letterSpacing: -2, color: C.coral, marginTop: 18 }} stagger={0.05} />
        <div style={{ display: 'flex', gap: 16, marginTop: 40, opacity: sp(t, cues.url), transform: `scale(${sp(t, cues.url, BOUNCY)})`, transformOrigin: 'left center' }}>
          <span style={{ ...body, fontWeight: 800, fontSize: 40, padding: '14px 30px', borderRadius: 999, border: `5px solid ${C.ink}`, background: '#f4f2ed' }}>mykova.app</span>
          <span style={{ ...body, fontWeight: 700, fontSize: 28, padding: '18px 24px', borderRadius: 999, border: `4px solid ${C.ink}`, alignSelf: 'center' }}>Concept</span>
        </div>
      </div>

      <Captions t={t} starts={cues.vo} lines={LINES} />
      <Grain frame={frame} />
      {/* Night at the start: a little vignette, gone by morning. */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0) 40%, rgba(5,12,16,0.55))', opacity: dark, pointerEvents: 'none' }} />

      {voice ? <Html5Audio src={staticFile('point/audio/score.wav')} volume={0.5} /> : null}
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
