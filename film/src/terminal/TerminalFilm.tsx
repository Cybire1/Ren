/**
 * "Kova Terminal": a 40-second reveal of a concept handheld point-of-sale for Kova, in real 3D.
 * The screen shows the real Kova till (its charge and Paid! screens, from the app). Kova Terminal
 * itself is a concept, and the end frame says so.
 *
 * Shots, with hard cuts on the music between them:
 *   A 0–4.6    cold open: macro along the ink terminal's hump, a light streak crossing it
 *   B 4.6–9.2  hero: the paper terminal on the paper sweep, its screen wakes: "Meet Kova Terminal."
 *   C 9.2–13.2 a slow orbit round the back and the hump: "Your whole shop, in one hand."
 *   D 13.2–20.2 tap: a Kova Card comes in, rings spread, the till turns to Paid!
 *   E 20.2–27  the receipt prints, low and close: "Card fees: zero."
 *   F 27–33.6  finishes, one cut each, the background swapping to suit, then all three
 *   G 33.6–40  end: "Kova Terminal", concept, mykova.app
 */
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { ThreeCanvas } from '@remotion/three'
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import * as THREE from 'three'
import vo from '../../public/terminal/audio/vo.json'
import { CameraAim, KovaCard3D } from '../atm/KovaPoint3D'
import { Mark } from '../atm/Textures'
import { decel, easeInOut, FPS, mix, span } from '../motion'
import { Captions, type Line } from '../parts'
import { BOUNCY, sp, Words } from '../ShopLink'
import { C } from '../theme'
import { type Finish as Shell, KovaTerminal, READER_Y } from './KovaTerminal3D'
import cues from './terminal-cues.json'
import { Finish } from './TerminalShowcase'

export const TERMINAL_DURATION = cues.duration
const LINES = vo.lines as Line[]

type V3 = [number, number, number]

const GROUND: Record<string, string> = { paper: '#e9e3d8', ink: '#131d20', teal: '#a9c9c9', coral: '#e7b2a8' }

interface Shot {
  ground: string
  devices: { finish: Shell; at: V3; turn: number; screen?: string; receipt?: number; glow?: number }[]
  pos: V3
  look: V3
  /** The x of the moving light strip, for the streak across the glass. */
  streak?: number
  card?: { at: V3; rot: V3 } | null
  rings?: number
}

const KEYPAD = 'terminal/screen-keypad.png'
const CODE = 'terminal/screen-charge.png'
const PAID = 'terminal/screen-paid.png'

const ease = (t: number, a: number, b: number) => easeInOut(span(t, a, b))
const lerp3 = (a: V3, b: V3, p: number): V3 => [mix(a[0], b[0], p), mix(a[1], b[1], p), mix(a[2], b[2], p)]

function shot(t: number): Shot {
  const s = cues.shots
  if (t < s.B) {
    // A: macro along the hump of the ink terminal, a light strip sweeping across.
    const p = ease(t, 0, s.B)
    return {
      ground: GROUND.ink as string,
      devices: [{ finish: 'ink', at: [0, 0, 0], turn: -0.5, glow: 0 }],
      pos: lerp3([-0.9, 1.95, 0.75], [0.15, 2.0, 0.95], p),
      look: lerp3([-0.25, 1.62, -0.1], [0.15, 1.6, -0.1], p),
      streak: mix(-4, 4, p),
    }
  }
  if (t < s.C) {
    const p = ease(t, s.B, s.C)
    const wake = decel(span(t, cues.wake, cues.wake + 0.8))
    return {
      ground: GROUND.paper as string,
      devices: [{ finish: 'paper', at: [0, 0, 0], turn: -0.35, screen: t < cues.charge ? KEYPAD : CODE, glow: wake }],
      pos: lerp3([0.6, 1.25, 4.6], [0.2, 1.35, 4.3], p),
      look: [-0.75, 0.92, 0],
    }
  }
  if (t < s.D) {
    // C: round the back, to see the hump and the keys.
    const p = ease(t, s.C, s.D)
    const a = mix(-1.95, -0.75, p)
    return {
      ground: GROUND.paper as string,
      devices: [{ finish: 'paper', at: [0, 0, 0], turn: 0, screen: CODE }],
      pos: [Math.sin(a) * 4.6, 1.7, Math.cos(a) * 4.6],
      look: [0.35, 0.95, 0],
    }
  }
  if (t < s.E) {
    // D: tap. The card comes in from the right and touches the top of the screen.
    const fly = ease(t, cues.card[0], cues.card[1])
    const leave = ease(t, cues.paid - 0.1, cues.paid + 0.7)
    const dip = t >= cues.card[1] ? Math.exp(-(t - cues.card[1]) * 7) * 0.03 : 0
    return {
      ground: GROUND.teal as string,
      devices: [{ finish: 'paper', at: [0, 0, 0], turn: 0, screen: t >= cues.paid ? PAID : CODE }],
      pos: lerp3([0.7, 1.75, 4.2], [0.5, 1.7, 4.0], ease(t, s.D, s.E)),
      look: [-0.3, 1.2, 0],
      card: { at: [mix(1.8, 0.05, fly) + 1.4 * leave, mix(1.95, READER_Y + 0.02, fly) + 0.4 * leave, mix(0.9, 0.12 - dip, fly) + 0.3 * leave], rot: [mix(0.2, 0, fly), mix(-1.1, 0, fly), mix(-0.5, -0.1, fly)] },
      rings: span(t, cues.card[1], cues.card[1] + 1.0),
    }
  }
  if (t < s.F) {
    // E: the receipt, low and close.
    const p = ease(t, s.E, s.F)
    return {
      ground: GROUND.paper as string,
      devices: [{ finish: 'paper', at: [0, 0, 0], turn: 0.2, screen: PAID, receipt: ease(t, cues.print[0], cues.print[1]) }],
      pos: lerp3([1.0, 1.65, 1.5], [0.7, 2.05, 1.7], p),
      look: lerp3([0, 1.75, -0.2], [0, 2.05, -0.3], p),
    }
  }
  if (t < s.G) {
    // F: one finish per cut, then all three.
    const which = t < cues.finish[1] ? 0 : t < cues.finish[2] ? 1 : t < cues.finish[3] ? 2 : 3
    const local = ease(t, [cues.finish[0], cues.finish[1], cues.finish[2], cues.finish[3]][which] as number, ([cues.finish[1], cues.finish[2], cues.finish[3], s.G][which] as number))
    if (which < 3) {
      const finish = (['ink', 'paper', 'coral'] as Shell[])[which] as Shell
      const ground = [GROUND.paper, GROUND.teal, GROUND.ink][which] as string
      return {
        ground,
        devices: [{ finish, at: [0, 0, 0], turn: mix(-0.6, -0.3, local), screen: which === 1 ? PAID : CODE }],
        pos: [0.9, 1.3, 3.2],
        look: [0, 0.9, 0],
      }
    }
    return {
      ground: GROUND.paper as string,
      devices: [
        { finish: 'ink', at: [-1.05, 0, -0.1], turn: 0.18, screen: CODE },
        { finish: 'paper', at: [0, 0, 0.25], turn: 0, screen: PAID },
        { finish: 'coral', at: [1.05, 0, -0.1], turn: -0.18, screen: CODE },
      ],
      pos: lerp3([0.8, 2.0, 6.4], [0.3, 2.0, 6.0], local),
      look: [0, 0.9, 0],
    }
  }
  // G: the end. The paper terminal stands to the right of the title.
  const p = ease(t, s.G, cues.duration)
  return {
    ground: GROUND.paper as string,
    devices: [{ finish: 'paper', at: [0, 0, 0], turn: -0.3, screen: PAID }],
    pos: lerp3([-1.8, 1.3, 4.2], [-1.6, 1.35, 4.0], p),
    look: [-0.95, 0.95, 0],
  }
}

function Rings({ amount }: { amount: number }) {
  if (amount <= 0 || amount >= 1) return null
  return (
    <group position={[0, READER_Y, 0.05]}>
      {[0, 0.2, 0.4].map((d) => {
        const q = Math.min(1, Math.max(0, (amount - d) / 0.6))
        return (
          <mesh key={d} scale={0.2 + 1.3 * q}>
            <ringGeometry args={[0.14, 0.152, 96]} />
            <meshBasicMaterial color="#d46558" transparent opacity={(1 - q) * 0.9} toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

function Scene({ t }: { t: number }) {
  const s = shot(t)
  const ground = new THREE.Color(s.ground)
  return (
    <>
      <CameraAim position={s.pos} target={s.look} />
      <color attach="background" args={[ground]} />
      <fog attach="fog" args={[ground, 9, 22]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[-2.5, 6, 3.5]} intensity={2.3} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-2.5} shadow-camera-right={2.5} shadow-camera-top={3} shadow-camera-bottom={-1} shadow-bias={-0.0003} shadow-radius={8} />
      <directionalLight position={[3, 3, -3]} intensity={1.7} color="#fff1e2" />
      <Environment resolution={256} frames={s.streak === undefined ? 1 : Infinity}>
        <Lightformer form="rect" intensity={3} position={[-3, 2.5, 2.5]} scale={[1.2, 5, 1]} target={[0, 1, 0]} />
        <Lightformer form="rect" intensity={2} position={[3, 2, 2]} scale={[1, 4, 1]} target={[0, 1, 0]} color="#ffe6d2" />
        <Lightformer form="rect" intensity={2.5} position={[0, 5, 0.5]} scale={[4, 0.6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} position={[0, 1.5, -4]} scale={[6, 3, 1]} target={[0, 1, 0]} />
        {s.streak !== undefined ? <Lightformer form="rect" intensity={8} position={[s.streak, 2.5, 2]} scale={[0.35, 6, 1]} target={[0, 1.6, 0]} /> : null}
      </Environment>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={ground} roughness={0.92} />
      </mesh>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.55} scale={6} blur={2.6} far={2.2} resolution={1024} color="#2a2119" frames={1} />
      {s.devices.map((d) => (
        <group key={d.finish} position={d.at} rotation={[0, d.turn, 0]}>
          <group position={[0, 0.12, 0]} rotation={[-0.16, 0, 0]}>
            <KovaTerminal finish={d.finish} screen={d.screen ?? CODE} receipt={d.receipt ?? 0} glow={d.glow ?? 1} />
            {d.finish === 'paper' && s.rings !== undefined ? <Rings amount={s.rings} /> : null}
            {d.finish === 'paper' && s.card ? <KovaCard3D position={s.card.at} rotation={s.card.rot} scale={6} /> : null}
          </group>
        </group>
      ))}
    </>
  )
}

const display: React.CSSProperties = { fontFamily: 'Manrope', fontWeight: 800, letterSpacing: -4, lineHeight: 0.98 }
const body: React.CSSProperties = { fontFamily: 'Manrope', fontWeight: 600 }

export function TerminalFilm({ voice = true }: { voice?: boolean }) {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const t = frame / FPS
  const s = cues.shots
  const onDark = t < s.B || (t >= cues.finish[2] && t < cues.finish[3])
  const ink = onDark ? '#f1efea' : C.ink
  return (
    <AbsoluteFill style={{ background: '#e9e3d8' }}>
      <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.05 }} camera={{ fov: 26, near: 0.02, far: 60 }}>
        <Scene t={t} />
      </ThreeCanvas>

      {t >= s.B && t < s.C ? (
        <div style={{ position: 'absolute', left: 120, top: 170 }}>
          <Words t={t} at={cues.vo.meet} out={s.C - 0.4} text={'Meet\nKova Terminal.'} style={{ ...display, color: C.ink, fontSize: 118 }} />
        </div>
      ) : null}
      {t >= s.C && t < s.D ? (
        <div style={{ position: 'absolute', left: 120, bottom: 190 }}>
          <Words t={t} at={cues.vo.hand} out={s.D - 0.4} text="Your whole shop, in one hand." style={{ ...display, color: C.ink, fontSize: 76, letterSpacing: -2.5 }} />
        </div>
      ) : null}
      {t >= cues.paid + 0.2 && t < s.E ? (
        <div style={{ position: 'absolute', left: 120, top: 200, transform: `scale(${sp(t, cues.paid + 0.2, BOUNCY)})`, transformOrigin: 'left center' }}>
          <div style={{ ...display, color: C.ink, fontSize: 120 }}>Paid.</div>
          <div style={{ ...body, color: C.ink, fontSize: 40, marginTop: 10 }}>in about a second</div>
        </div>
      ) : null}
      {t >= cues.zero && t < s.F ? (
        <div style={{ position: 'absolute', left: 120, bottom: 200, padding: '18px 30px', borderRadius: 999, background: C.ink, color: '#f1efea', ...body, fontWeight: 800, fontSize: 46, transform: `scale(${sp(t, cues.zero, BOUNCY)})`, transformOrigin: 'left center' }}>
          Card fees $0.00
        </div>
      ) : null}
      {t >= cues.finish[0] && t < cues.finish[3] ? (
        <div style={{ position: 'absolute', left: 120, bottom: 170, ...display, color: ink, fontSize: 92, letterSpacing: -3 }}>
          {t < cues.finish[1] ? 'Ink.' : t < cues.finish[2] ? 'Paper.' : 'Coral.'}
        </div>
      ) : null}
      {t >= s.G ? (
        <div style={{ position: 'absolute', left: 120, top: 230 }}>
          <div style={{ opacity: sp(t, s.G + 0.2), transform: `translateY(${(1 - sp(t, s.G + 0.2)) * 30}px)` }}>
            <Mark h={100} />
          </div>
          <Words t={t} at={cues.vo.end} text="Kova Terminal" style={{ ...display, color: C.ink, fontSize: 140, marginTop: 26 }} />
          <div style={{ display: 'flex', gap: 16, marginTop: 40, opacity: sp(t, cues.url), transform: `scale(${sp(t, cues.url, BOUNCY)})`, transformOrigin: 'left center' }}>
            <span style={{ ...body, fontWeight: 800, color: C.ink, fontSize: 40, padding: '14px 30px', borderRadius: 999, border: `5px solid ${C.ink}`, background: '#f4f2ed' }}>mykova.app</span>
            <span style={{ ...body, fontWeight: 700, color: C.ink, fontSize: 28, padding: '18px 24px', borderRadius: 999, border: `4px solid ${C.ink}`, alignSelf: 'center' }}>Concept</span>
          </div>
        </div>
      ) : null}

      <Captions t={t} starts={cues.vo} lines={LINES} />
      <Finish frame={frame} />

      {voice ? <Html5Audio src={staticFile('terminal/audio/score.wav')} volume={0.5} /> : null}
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
