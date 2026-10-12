/**
 * "The Queue": a 46-second film in one toy café, seen from above like a game. Everyone waits in a
 * line under WAIT HERE, holding a buzzer, stepping forward in lockstep. Kovi walks in, is asked to
 * join the queue (both answers are YES), sits at table 3 instead, pays from the table in 0.76 s and
 * is told his order is ready. Days pass, the stamps add up, the sixth croissant is free. Then the
 * queue breaks: one by one they sit down, every table lights up, the sign turns to SIT ANYWHERE.
 *
 * The numbers and the phone screens are from a real run at Ada's Bakery on Monad testnet
 * (public/spot/run.json, apps/api/src/scripts/table-run.ts). Cues: src/queue/queue-cues.json.
 */
import { Billboard, ContactShadows, useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { ThreeCanvas } from '@remotion/three'
import type React from 'react'
import { AbsoluteFill, Html5Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import * as THREE from 'three'
import run from '../../public/spot/run.json'
import { Mark } from '../atm/Textures'
import { IPhone } from '../iphone'
import { easeInOut, mix, span } from '../motion'
import { bounce, CORAL, FPS, hero, IMG, INK, MUTED, SURFACE, TEAL } from '../os/ui/kit'
import { Grain } from '../parts'
import cues from './queue-cues.json'

export const QUEUE_DURATION = cues.duration
type V3 = [number, number, number]
type V2 = [number, number]
const ease = (t: number, a: number, b: number) => easeInOut(span(t, a, b))
const rise = (t: number, at: number, d = 0.4) => hero(span(t, at, at + d))
const lerp2 = (a: V2, b: V2, p: number): V2 => [mix(a[0], b[0], p), mix(a[1], b[1], p)]
const ui: React.CSSProperties = { fontFamily: 'Manrope', color: INK }

// ——— The room ————————————————————————————————————————————————————————————————————————

const FLOOR = '#ebe5da'
const WALL = '#cfe0de'
const GOLD = '#edc354'
/** Grey suits for the people in the queue: the system's colours. */
const SUITS = ['#7f8a93', '#6d7780', '#8e969c', '#5f6a73', '#97a0a6', '#76818a']
const SKIN = ['#e9c2a0', '#c99773', '#8d5e44', '#f0cfb2', '#a8754f', '#6b4632']

/** The tables, numbered as their cards say. Table 3 is Kovi's. */
const TABLES: V2[] = [
  [1.9, -2.3],
  [4.1, -2.3],
  [1.9, 0.1],
  [4.1, 0.1],
  [1.9, 2.5],
  [4.1, 2.5],
]
const T3 = TABLES[2] as V2

/** The queue, from the counter out towards the door: a snake between rope posts. */
const ROWS = [-2.5, -1.1, 0.3, 1.7, 3.1]
const PATH: V2[] = [
  [-2.6, -2.5],
  [0.2, -2.5],
  [0.2, -1.1],
  [-3.7, -1.1],
  [-3.7, 0.3],
  [0.2, 0.3],
  [0.2, 1.7],
  [-3.7, 1.7],
  [-3.7, 3.1],
  [0.2, 3.1],
  [0.2, 6.5],
]
const GAP = 0.92
const PEOPLE = 19

function along(s: number): { at: V2; dir: number } {
  let left = Math.max(0, s)
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i] as V2
    const b = PATH[i + 1] as V2
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (left <= len || i === PATH.length - 2) {
      const p = Math.min(1, left / len)
      // Facing back along the line, towards the counter.
      return { at: lerp2(a, b, p), dir: Math.atan2(a[0] - b[0], a[1] - b[1]) }
    }
    left -= len
  }
  return { at: PATH[0] as V2, dir: 0 }
}

/** How far the whole line has shuffled forward: one place at each step, all at once. */
function shuffled(t: number) {
  return cues.steps.reduce((n, at) => n + easeInOut(span(t, at, at + 0.7)), 0)
}

/** Where everyone sits once the queue breaks: around the five free tables. */
const SEATS: V2[] = [0, 1, 3, 4, 5].flatMap((k) => {
  const [x, z] = TABLES[k] as V2
  return [
    [x - 0.62, z + 0.05],
    [x + 0.62, z - 0.05],
    [x, z + 0.66],
  ] as V2[]
})

// ——— Camera ———————————————————————————————————————————————————————————————————————————

interface Cam {
  look: V3
  zoom: number
}
const ISO = new THREE.Vector3(1, 1.05, 1.15).normalize()

function camAt(t: number): Cam {
  const wide: Cam = { look: [0.3, 0, 0.2], zoom: 92 }
  const t3: Cam = { look: [T3[0] - 0.2, 0.7, T3[1]], zoom: 230 }
  const counter: Cam = { look: [-1.6, 0.8, -2.2], zoom: 150 }
  const blend = (a: Cam, b: Cam, p: number): Cam => ({ look: [mix(a.look[0], b.look[0], p), mix(a.look[1], b.look[1], p), mix(a.look[2], b.look[2], p)], zoom: mix(a.zoom, b.zoom, p) })
  // Open close on a buzzer in the line, and pull up to the whole room.
  const buzzer: Cam = { look: [-0.4, 1.0, -1.3], zoom: 420 }
  if (t < cues.koviIn[0]) return blend(buzzer, wide, ease(t, 0.3, 4.4))
  if (t < cues.toTable[1]) return blend(wide, { look: [1.6, 0.4, 0.8], zoom: 120 }, ease(t, cues.ask[0] - 0.5, cues.toTable[1]))
  if (t < cues.ticket) return blend({ look: [1.6, 0.4, 0.8], zoom: 120 }, t3, ease(t, cues.toTable[1], cues.phone[0] + 0.5))
  if (t < cues.ready) return blend(blend(t3, counter, ease(t, cues.ticket - 0.4, cues.brew[0] + 0.4)), t3, ease(t, cues.carry[0] + 0.6, cues.carry[1] + 0.2))
  if (t < cues.look) return t3
  if (t < cues.title) return blend(t3, wide, ease(t, cues.look, cues.cascade + 1.2))
  return blend(wide, { look: [0.9, 0, 0.6], zoom: 84 }, ease(t, cues.title, cues.duration))
}

function OrthoAim({ cam }: { cam: Cam }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera
  const p = new THREE.Vector3(...cam.look).addScaledVector(ISO, 30)
  camera.position.copy(p)
  camera.zoom = cam.zoom
  camera.near = 0.1
  camera.far = 100
  camera.lookAt(...cam.look)
  camera.updateProjectionMatrix()
  return null
}

/** Where a point of the room lands on screen, for the words that float over it. */
function project(cam: Cam, p: V3, w = 1920, h = 1080): V2 {
  const c = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 100)
  c.position.copy(new THREE.Vector3(...cam.look).addScaledVector(ISO, 30))
  c.zoom = cam.zoom
  c.lookAt(...cam.look)
  c.updateProjectionMatrix()
  c.updateMatrixWorld()
  const v = new THREE.Vector3(...p).project(c)
  return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h]
}

// ——— People ————————————————————————————————————————————————————————————————————————————

/** A toy person: block body, ball head. `walk` swings the legs and arms; `buzz` lights the pager. */
function Person({ at, dir, walk, suit, skin, head = 0, buzzer = 0, apron = false, cup = false, glow = 0 }: { at: V2; dir: number; walk: number; suit: string; skin: string; head?: number; buzzer?: number; apron?: boolean; cup?: boolean; glow?: number }) {
  const swing = Math.sin(walk) * 0.5
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, dir, 0]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0.1 * side, 0.42, 0]} rotation={[swing * side, 0, 0]} castShadow>
          <boxGeometry args={[0.15, 0.84, 0.17]} />
          <meshStandardMaterial color="#3b4248" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 1.13, 0]} castShadow>
        <boxGeometry args={[0.48, 0.62, 0.28]} />
        <meshStandardMaterial color={suit} roughness={0.85} />
      </mesh>
      {apron ? (
        <mesh position={[0, 1.02, 0.145]}>
          <boxGeometry args={[0.4, 0.66, 0.02]} />
          <meshStandardMaterial color={CORAL} roughness={0.7} />
        </mesh>
      ) : null}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0.3 * side, 1.12, 0]} rotation={[cup && side === 1 ? -1.2 : -swing * side, 0, 0.06 * side]} castShadow>
          <boxGeometry args={[0.12, 0.58, 0.14]} />
          <meshStandardMaterial color={suit} roughness={0.85} />
        </mesh>
      ))}
      <group position={[0, 1.62, 0]} rotation={[0, head, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.19, 24, 18]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[0.07 * side, 0.02, 0.17]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        ))}
      </group>
      {/* The buzzer: a black puck with a light that stays dark until they're called. */}
      {!apron ? (
        <group position={[-0.31, 0.86, 0.12]}>
          <mesh>
            <boxGeometry args={[0.14, 0.04, 0.2]} />
            <meshStandardMaterial color={INK} />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <sphereGeometry args={[0.03, 10, 10]} />
            <meshBasicMaterial color={buzzer > 0 ? CORAL : '#3a2a28'} />
          </mesh>
        </group>
      ) : null}
      {cup ? (
        <mesh position={[0.32, 1.32, 0.3]}>
          <cylinderGeometry args={[0.07, 0.055, 0.12, 20]} />
          <meshStandardMaterial color="#f7f5f0" />
        </mesh>
      ) : null}
      {glow > 0 ? (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.32, 0.42, 40]} />
          <meshBasicMaterial color={TEAL} transparent opacity={glow * 0.9} />
        </mesh>
      ) : null}
    </group>
  )
}

/** Each person in the line: where they stand, whether they walk, and later, the seat they take. */
function crowd(t: number) {
  const moved = shuffled(t)
  return Array.from({ length: PEOPLE }, (_, i) => {
    const slot = i - moved + 1
    const { at, dir } = along(slot * GAP)
    const stepping = cues.steps.some((s) => t > s && t < s + 0.7)
    // The front of the line is served and leaves behind the counter's end.
    const served = slot < 0.5 ? span(slot, 0.5, -0.5) : 0
    let pos: V2 = served > 0 ? lerp2(at, [-5.4, -2.5], served) : at
    let facing = served > 0 ? -Math.PI / 2 : dir
    let walking = stepping || served > 0
    // The queue breaks: the one third in line first, then everyone.
    const order = i === 3 ? 0 : i < 3 ? 1 + i : i
    const leaveAt = order === 0 ? cues.leave : cues.cascade + order * 0.2
    const seatIndex = order % SEATS.length
    const seat = SEATS[seatIndex] as V2
    const table = TABLES[[0, 1, 3, 4, 5][Math.floor(seatIndex / 3)] as number] as V2
    const go = ease(t, leaveAt, leaveAt + 1.6)
    if (go > 0) {
      pos = lerp2(pos, seat, go)
      facing = go < 1 ? Math.atan2(seat[0] - at[0], seat[1] - at[1]) : Math.atan2(table[0] - seat[0], table[1] - seat[1])
      walking = go > 0 && go < 1
    }
    // Heads turn to Kovi when he pays from his table.
    const toKovi = Math.atan2(T3[0] - pos[0], T3[1] - pos[1]) - facing
    const head = go > 0 ? 0 : mix(0, Math.max(-1.3, Math.min(1.3, toKovi)), ease(t, cues.heads + i * 0.05, cues.heads + 0.5 + i * 0.05) * (1 - ease(t, cues.ticket + 0.8, cues.ticket + 1.6)) + (i === 3 ? ease(t, cues.look - 0.2, cues.look + 0.3) : 0))
    return { pos, facing, walking, head, gone: served >= 1, seated: go >= 1, i }
  })
}

// ——— Things ——————————————————————————————————————————————————————————————————————————

function Art({ src, w, h, position, rotation }: { src: string; w: number; h: number; position: V3; rotation?: V3 }) {
  const tex = useTexture(staticFile(src))
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={tex} roughness={0.7} />
    </mesh>
  )
}

function Table({ n, at, lit }: { n: number; at: V2; lit: number }) {
  return (
    <group position={[at[0], 0, at[1]]}>
      {lit > 0 ? (
        <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.95, 48]} />
          <meshBasicMaterial color={n === 3 ? GOLD : TEAL} transparent opacity={0.55 * lit} />
        </mesh>
      ) : null}
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.46, 0.46, 0.05, 48]} />
        <meshStandardMaterial color={SURFACE} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.715, 0]}>
        <cylinderGeometry args={[0.465, 0.465, 0.012, 48]} />
        <meshStandardMaterial color={INK} />
      </mesh>
      <mesh position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.72, 12]} />
        <meshStandardMaterial color={INK} />
      </mesh>
      <mesh position={[0, 0.015, 0]}>
        <cylinderGeometry args={[0.24, 0.26, 0.03, 32]} />
        <meshStandardMaterial color={INK} />
      </mesh>
      {/* The table's card, leaning back, facing the room. */}
      <Art src={`queue/tent-${n}.png`} w={0.3} h={0.225} position={[0.12, 0.88, 0.16]} rotation={[-0.3, Math.PI / 4, 0]} />
    </group>
  )
}

function Room({ t }: { t: number }) {
  const lit = (k: number) => (k === 2 ? ease(t, cues.paid, cues.paid + 0.6) : ease(t, cues.cascade + 0.4 + k * 0.35, cues.cascade + 1.0 + k * 0.35))
  const flip = ease(t, cues.flip, cues.flip + 0.8)
  const tick = Math.floor(t * 2) / 2
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color={FLOOR} roughness={0.95} />
      </mesh>
      {/* Floor tiles: a quiet chequer, so the room reads as a game board. */}
      {Array.from({ length: 13 }, (_, x) =>
        Array.from({ length: 10 }, (_, z) =>
          (x + z) % 2 ? (
            <mesh key={`${x}-${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[-6 + x + 0.5, 0.002, -4.6 + z + 0.5]}>
              <planeGeometry args={[1, 1]} />
              <meshStandardMaterial color="#e2dbcf" roughness={0.95} />
            </mesh>
          ) : null,
        ),
      )}
      <mesh position={[0.5, 1.6, -4.7]} receiveShadow>
        <boxGeometry args={[13, 3.2, 0.2]} />
        <meshStandardMaterial color={WALL} roughness={0.9} />
      </mesh>
      <mesh position={[-6.1, 1.6, 0.4]} receiveShadow>
        <boxGeometry args={[0.2, 3.2, 10.4]} />
        <meshStandardMaterial color="#bcd3d1" roughness={0.9} />
      </mesh>
      {/* Windows on the back wall. */}
      {[1.6, 4.0].map((x) => (
        <mesh key={x} position={[x, 1.8, -4.58]}>
          <planeGeometry args={[1.6, 1.4]} />
          <meshStandardMaterial color="#f6fbfb" emissive="#ffffff" emissiveIntensity={0.25} />
        </mesh>
      ))}
      {/* The clock: its hand keeps going round. */}
      <group position={[-1.2, 2.45, -4.58]}>
        <mesh>
          <circleGeometry args={[0.32, 40]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
        <mesh position={[0, 0, 0.01]} rotation={[0, 0, -tick * 0.9]}>
          <planeGeometry args={[0.03, 0.26]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      </group>
      {/* The counter, with the till at its end and the banner on its front. */}
      <mesh position={[-3.5, 0.52, -3.75]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 1.04, 0.9]} />
        <meshStandardMaterial color={INK} roughness={0.6} />
      </mesh>
      <mesh position={[-3.5, 1.06, -3.75]}>
        <boxGeometry args={[4.7, 0.05, 1.0]} />
        <meshStandardMaterial color="#f1efea" roughness={0.5} />
      </mesh>
      <Art src="queue/banner.png" w={3.6} h={0.42} position={[-3.5, 0.62, -3.29]} />
      <mesh position={[-4.6, 1.38, -3.9]} castShadow>
        <boxGeometry args={[0.7, 0.6, 0.55]} />
        <meshStandardMaterial color="#c9ccce" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[-1.7, 1.25, -3.7]} rotation={[-0.6, 0, 0]}>
        <boxGeometry args={[0.5, 0.36, 0.03]} />
        <meshStandardMaterial color={INK} />
      </mesh>
      <mesh position={[-1.7, 1.255, -3.685]} rotation={[-0.6, 0, 0]}>
        <planeGeometry args={[0.44, 0.3]} />
        <meshBasicMaterial color={t > cues.ticket ? CORAL : '#2a3a3d'} />
      </mesh>
      {/* Rope posts between the rows of the snake. */}
      {ROWS.slice(0, -1).flatMap((z, r) =>
        [-3.1, -2.1, -1.1, -0.1].map((x) => (
          <group key={`${r}-${x}`} position={[r % 2 ? x - 0.5 : x + 0.5, 0, z + 0.7]}>
            <mesh position={[0, 0.45, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.9, 10]} />
              <meshStandardMaterial color="#b9a46a" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.16, 0.18, 0.04, 20]} />
              <meshStandardMaterial color="#b9a46a" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[0.5, 0.82, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, 1.0, 8]} />
              <meshStandardMaterial color={CORAL} roughness={0.6} />
            </mesh>
          </group>
        )),
      )}
      {/* WAIT HERE, and later SIT ANYWHERE on its back as it turns round. */}
      <group position={[1.0, 0, -3.0]} rotation={[0, Math.PI / 4 + flip * Math.PI, 0]}>
        <mesh position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 1.3, 10]} />
          <meshStandardMaterial color={INK} />
        </mesh>
        <Art src="queue/wait.png" w={0.9} h={0.9} position={[0, 1.6, 0.02]} />
        <Art src="queue/sit.png" w={0.9} h={0.9} position={[0, 1.6, -0.02]} rotation={[0, Math.PI, 0]} />
      </group>
      {TABLES.map((at, k) => (
        <Table key={k} n={k + 1} at={at} lit={lit(k)} />
      ))}
    </>
  )
}

// ——— Kovi and Ada ——————————————————————————————————————————————————————————————————————

const KOVI_SEAT: V2 = [T3[0] + 0.62, T3[1] + 0.32]

function koviAt(t: number): { at: V2; walking: boolean; pose: 'wave' | 'cheer' | 'peek' } {
  const door: V2 = [7.2, 3.6]
  const end = along((PEOPLE - shuffled(t) + 1.2) * GAP).at
  const lineEnd: V2 = [end[0] + 0.6, end[1] + 0.9]
  if (t < cues.koviIn[0]) return { at: door, walking: false, pose: 'wave' }
  if (t < cues.toTable[0]) return { at: lerp2(door, lineEnd, ease(t, cues.koviIn[0], cues.koviIn[1])), walking: t < cues.koviIn[1], pose: 'wave' }
  const sat = lerp2(lineEnd, KOVI_SEAT, ease(t, cues.toTable[0], cues.toTable[1]))
  const happy = (t > cues.ready && t < cues.readyOut) || (t > cues.free && t < cues.freeOut) || t > cues.cascade + 2
  return { at: sat, walking: t < cues.toTable[1], pose: happy ? 'cheer' : 'wave' }
}

function Kovi({ t }: { t: number }) {
  const k = koviAt(t)
  const wave = useTexture(staticFile(IMG.koviWave))
  const cheer = useTexture(staticFile(IMG.koviCheer))
  for (const tex of [wave, cheer]) tex.colorSpace = THREE.SRGBColorSpace
  const hop = k.walking ? Math.abs(Math.sin(t * 9)) * 0.12 : k.pose === 'cheer' ? Math.abs(Math.sin(t * 6)) * 0.18 : 0
  return (
    <group position={[k.at[0], 0, k.at[1]]}>
      <Billboard position={[0, 0.62 + hop, 0]}>
        <mesh>
          <planeGeometry args={[1.15, 1.15]} />
          <meshBasicMaterial map={k.pose === 'cheer' ? cheer : wave} transparent alphaTest={0.05} toneMapped={false} />
        </mesh>
      </Billboard>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <circleGeometry args={[0.3, 32]} />
        <meshBasicMaterial color="#000" transparent opacity={0.12} />
      </mesh>
    </group>
  )
}

function adaAt(t: number): { at: V2; dir: number; walking: boolean; cup: boolean } {
  const bar: V2 = [-2.2, -4.35]
  const gap: V2 = [-0.75, -3.3]
  const table: V2 = [T3[0] - 0.55, T3[1] - 0.45]
  if (t < cues.carry[0]) return { at: bar, dir: 0, walking: false, cup: t > cues.brew[1] - 0.3 }
  const p = span(t, cues.carry[0], cues.carry[1])
  const back = span(t, cues.ready + 0.6, cues.ready + 2.4)
  if (back > 0) return { at: back < 0.5 ? lerp2(table, gap, easeInOut(back * 2)) : lerp2(gap, bar, easeInOut(back * 2 - 1)), dir: Math.PI * 0.8, walking: back < 1, cup: false }
  const at = p < 0.4 ? lerp2(bar, gap, easeInOut(p / 0.4)) : lerp2(gap, table, easeInOut((p - 0.4) / 0.6))
  return { at, dir: p < 0.4 ? Math.PI / 2 : Math.atan2(table[0] - gap[0], table[1] - gap[1]), walking: p < 1, cup: p < 1 }
}

/** The coin that pays: from table 3 to the till, over everyone's heads. */
function PayCoin({ t }: { t: number }) {
  const p = span(t, cues.coin[0], cues.coin[1])
  if (p <= 0 || p >= 1) return null
  const e = easeInOut(p)
  const from: V3 = [T3[0], 1.1, T3[1]]
  const to: V3 = [-1.7, 1.3, -3.6]
  return (
    <mesh position={[mix(from[0], to[0], e), mix(from[1], to[1], e) + Math.sin(Math.PI * e) * 1.6, mix(from[2], to[2], e)]} rotation={[Math.PI / 2, t * 12, 0]}>
      <cylinderGeometry args={[0.16, 0.16, 0.04, 32]} />
      <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.25} emissive={GOLD} emissiveIntensity={0.3} />
    </mesh>
  )
}

/** Stamps, one a day, floating over table 3 like coins in a game. */
function Stamps({ t }: { t: number }) {
  const got = cues.days.filter((d) => t >= d).length + (t >= cues.paid ? 1 : 0)
  if (t < cues.days[0]! - 0.3 || t > cues.look + 0.6) return null
  const fade = 1 - span(t, cues.look, cues.look + 0.6)
  return (
    <group position={[T3[0] + 0.1, 1.85, T3[1] + 0.1]}>
      {Array.from({ length: run.every }, (_, i) => {
        const at = i === 0 ? cues.paid : (cues.days[i - 1] ?? 99)
        const pop = i < got ? bounce(t, Math.max(at, cues.days[0]! - 0.3)) : 0
        const used = span(t, cues.free, cues.free + 0.5)
        return (
          <mesh key={i} position={[(i - (run.every - 1) / 2) * 0.58, used * (0.4 + i * 0.05), 0]} rotation={[Math.PI / 2, 0, 0.6 + Math.sin(t * 2 + i) * 0.4]} scale={(i < got ? 0.4 + 0.6 * pop : 0.6) * fade * (1 - used)}>
            <cylinderGeometry args={[0.24, 0.24, 0.05, 32]} />
            <meshStandardMaterial color={i < got ? GOLD : '#d8d2c6'} metalness={i < got ? 0.6 : 0} roughness={0.3} transparent opacity={i < got ? 1 : 0.6} />
          </mesh>
        )
      })}
    </group>
  )
}

function Scene({ t, cam }: { t: number; cam: Cam }) {
  const people = crowd(t)
  const ada = adaAt(t)
  return (
    <>
      <OrthoAim cam={cam} />
      <color attach="background" args={[FLOOR]} />
      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#ffffff', '#d9cfbf', 0.8]} />
      <directionalLight position={[-4, 10, 6]} intensity={1.4} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-bias={-0.0004} shadow-radius={10} />
      <Room t={t} />
      {people.map((p) =>
        p.gone ? null : (
          <Person key={p.i} at={p.pos} dir={p.facing} walk={p.walking ? t * 11 + p.i : 0} suit={SUITS[p.i % SUITS.length] as string} skin={SKIN[(p.i * 5) % SKIN.length] as string} head={p.head} glow={p.seated ? 1 : 0} />
        ),
      )}
      <Person at={ada.at} dir={ada.dir} walk={ada.walking ? t * 10 : 0} suit="#f1efea" skin="#c99773" apron cup={ada.cup} />
      <Kovi t={t} />
      <PayCoin t={t} />
      <Stamps t={t} />
      <ContactShadows position={[0, 0.003, 0]} opacity={0.35} scale={20} blur={2} far={2} resolution={1024} color="#4a3f33" frames={1} />
    </>
  )
}

// ——— Words on screen ————————————————————————————————————————————————————————————————————

/** A game's dialogue box: who speaks, what they say, and the choices. */
function Dialog({ t, at, out, who, text, choices }: { t: number; at: number; out: number; who: string; text: string; choices?: string[] }) {
  const show = rise(t, at, 0.3) * (1 - span(t, out - 0.25, out))
  if (show <= 0) return null
  const typed = Math.floor(span(t, at + 0.1, at + 0.1 + text.length * 0.03) * text.length)
  return (
    <div style={{ ...ui, position: 'absolute', left: 960 - 470, bottom: 80, width: 940, padding: '26px 34px', borderRadius: 26, border: `4px solid ${INK}`, background: SURFACE, opacity: show, transform: `translateY(${(1 - show) * 30}px)`, boxShadow: '0 20px 50px #0b1a1d30' }}>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 2, color: CORAL }}>{who}</div>
      <div style={{ fontSize: 40, fontWeight: 700, marginTop: 8, letterSpacing: -0.6 }}>{text.slice(0, typed)}</div>
      {choices ? (
        <div style={{ display: 'flex', gap: 22, marginTop: 20, opacity: rise(t, at + 0.9, 0.3) }}>
          {choices.map((c, i) => (
            <span key={i} style={{ fontSize: 30, fontWeight: 800, padding: '10px 26px', borderRadius: 999, background: i === 0 ? INK : 'transparent', color: i === 0 ? '#fff' : INK, border: `3px solid ${INK}` }}>
              ▶ {c}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Hud({ t }: { t: number }) {
  const show = rise(t, cues.hud, 0.5) * (1 - span(t, cues.title - 0.4, cues.title))
  if (show <= 0) return null
  const queue = Math.max(0, PEOPLE - Math.round(shuffled(t)) - (t > cues.leave ? 1 : 0) - Math.max(0, Math.floor((t - cues.cascade) / 0.2)))
  const day = t < cues.days[0]! ? 1 : 2 + cues.days.filter((d) => t >= d).length - 1 + (t >= cues.free ? 1 : 0)
  return (
    <div style={{ ...ui, position: 'absolute', left: 56, top: 48, opacity: show, display: 'flex', gap: 14 }}>
      {[
        ["ADA'S BAKERY", `DAY ${day}`],
        ['IN THE QUEUE', String(queue)],
      ].map(([k, v]) => (
        <div key={k} style={{ padding: '12px 20px', borderRadius: 16, background: 'rgba(241,239,234,0.92)', border: `3px solid ${INK}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 2, color: MUTED }}>{k}</div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
        </div>
      ))}
    </div>
  )
}

/** A floating word over a point in the room, like a game's pick-up. */
function Pickup({ t, cam, at, from, to, text, tone = INK }: { t: number; cam: Cam; at: V3; from: number; to: number; text: string; tone?: string }) {
  const show = rise(t, from, 0.3) * (1 - span(t, to - 0.3, to))
  if (show <= 0) return null
  const [x, y] = project(cam, at)
  const lift = span(t, from, to) * 30
  return (
    <div style={{ ...ui, position: 'absolute', left: x, top: y - lift, transform: `translate(-50%, -100%) scale(${0.7 + 0.3 * bounce(t, from)})`, opacity: show, whiteSpace: 'nowrap', fontSize: 30, fontWeight: 800, padding: '10px 22px', borderRadius: 999, background: tone, color: tone === INK || tone === CORAL ? '#fff' : INK, border: `3px solid ${INK}` }}>
      {text}
    </div>
  )
}

export function QueueFilm({ sound = true }: { sound?: boolean }) {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const t = frame / FPS
  const cam = camAt(t)
  const phone = rise(t, cues.phone[0], 0.6) * (1 - span(t, cues.phone[1] - 0.5, cues.phone[1]))
  const ready = rise(t, cues.ready, 0.5) * (1 - span(t, cues.readyOut - 0.4, cues.readyOut))
  const free = rise(t, cues.free, 0.5) * (1 - span(t, cues.freeOut - 0.4, cues.freeOut))
  const title = rise(t, cues.title, 0.8)
  const tap = span(t, cues.tap, cues.tap + 0.3)
  return (
    <AbsoluteFill style={{ background: FLOOR }}>
      <ThreeCanvas orthographic width={width} height={height} shadows gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping }} camera={{ zoom: 100, position: [20, 20, 20], near: 0.1, far: 100 }}>
        <Scene t={t} cam={cam} />
      </ThreeCanvas>

      {/* A miniature: sharp across the middle, soft at the top and bottom, like a toy model shot close. */}
      {[
        ['top', 'linear-gradient(180deg, #000 0%, transparent 34%)'],
        ['bottom', 'linear-gradient(0deg, #000 0%, transparent 30%)'],
      ].map(([k, mask]) => (
        <AbsoluteFill key={k} style={{ backdropFilter: 'blur(7px)', WebkitMaskImage: mask, maskImage: mask, pointerEvents: 'none' }} />
      ))}
      <Hud t={t} />
      <Dialog t={t} at={cues.rule[0]} out={cues.rule[1]} who="ADA'S BAKERY" text="Please wait in line. Pay at the counter only." />
      <Dialog t={t} at={cues.ask[0]} out={cues.ask[1]} who="ADA'S BAKERY" text="Would you like to join the queue?" choices={['YES', 'YES']} />
      <Pickup t={t} cam={cam} at={[T3[0], 1.5, T3[1]]} from={cues.paid} to={cues.paid + 1.8} text={`Paid · ${run.seconds} s on Monad`} tone={GOLD} />
      <Pickup t={t} cam={cam} at={[-1.7, 1.7, -3.6]} from={cues.ticket} to={cues.ticket + 1.6} text={`New order · table ${run.table}`} tone={CORAL} />
      {cues.days.map((d, i) => (
        <Pickup key={d} t={t} cam={cam} at={[T3[0] + 0.9, 2.4, T3[1]]} from={d} to={d + 0.9} text={`Day ${i + 2} · stamp ${i + 2}`} tone={SURFACE} />
      ))}
      <Pickup t={t} cam={cam} at={[T3[0] - 0.1, 2.5, T3[1]]} from={cues.free} to={cues.freeOut} text="+1 free croissant · paid $0.00" tone={GOLD} />

      {phone > 0 ? (
        <IPhone src="spot/stall-table.png" h={700} x={mix(2300, 1460, phone)} y={540} rotate={mix(8, -2, phone)} ry={-10}>
          {tap > 0 && tap < 1 ? <div style={{ position: 'absolute', left: 590 - 300 * tap, top: 2300 - 300 * tap, width: 600 * tap, height: 600 * tap, borderRadius: '50%', border: `16px solid ${CORAL}`, opacity: 1 - tap }} /> : null}
        </IPhone>
      ) : null}
      {ready > 0 ? <IPhone src="spot/ready.png" h={700} x={mix(2300, 1460, ready)} y={540} rotate={mix(8, -2, ready)} ry={-10} /> : null}
      {free > 0 ? <IPhone src="spot/free.png" h={700} x={mix(2300, 1460, free)} y={540} rotate={mix(8, -2, free)} ry={-10} /> : null}

      {title > 0 ? (
        <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(235,229,218,${0.95 * title}) 0%, rgba(235,229,218,${0.6 * title}) 36%, rgba(235,229,218,0) 60%)`, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 110 }}>
          <div style={{ ...ui, fontSize: 104, fontWeight: 800, letterSpacing: -4, opacity: title, transform: `translateY(${(1 - title) * 30}px)` }}>Every table is a counter.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 30, opacity: rise(t, cues.logo, 0.5) }}>
            <Mark h={70} />
            <span style={{ ...ui, fontSize: 36, fontWeight: 800, padding: '10px 28px', borderRadius: 999, border: `4px solid ${INK}`, background: SURFACE }}>mykova.app</span>
          </div>
        </AbsoluteFill>
      ) : null}

      <Grain frame={frame} />
      <AbsoluteFill style={{ background: '#000', opacity: 1 - span(t, 0, 0.5) + span(t, cues.duration - 0.6, cues.duration), pointerEvents: 'none' }} />
      {sound ? <Html5Audio src={staticFile('queue/sound.wav')} /> : null}
    </AbsoluteFill>
  )
}
