/**
 * Kova Point: a concept ATM for Kova, in real 3D (three.js through @remotion/three). Cash in, cash
 * out, send anywhere, at the shop on the corner. It wears the Kova Card's look: warm powder-coated
 * paper, ink, the shop's coral-and-white awning, a lit Kova sign, and Kovi on top.
 *
 * Units: 1 = about 60 cm. The machine stands 2.0 tall on a plinth; its front faces +z.
 * Artwork on its faces is rendered by src/atm/Textures.tsx into public/atm (scripts/atm-textures.sh).
 */
import { ContactShadows, Environment, Lightformer, RoundedBox, useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { ThreeCanvas } from '@remotion/three'
import { useMemo } from 'react'
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import * as THREE from 'three'

const INK = '#0f1c1f'
const PAPER = '#efe9de'
const CORAL = '#d9573f'
const TEAL = '#a9c9c9'

export type Screen = 'tap' | 'menu' | 'send' | 'done' | 'cash'

function useSrgb(urls: string[]) {
  const textures = useTexture(urls.map((u) => staticFile(u)))
  return useMemo(() => {
    for (const t of textures) {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
    }
    return textures
  }, [textures])
}

/** Powder-coated steel, the body's finish. */
function Powder({ color }: { color: string }) {
  return <meshPhysicalMaterial color={color} roughness={0.42} metalness={0.05} clearcoat={0.55} clearcoatRoughness={0.3} />
}

/** The awning over the screen: coral and white canvas stripes with a scalloped edge. */
export function Awning({ width, depth, y, z }: { width: number; depth: number; y: number; z: number }) {
  const stripes = 12
  const w = width / stripes
  return (
    <group position={[0, y, z]} rotation={[0.42, 0, 0]}>
      {Array.from({ length: stripes }, (_, i) => (
        <mesh key={i} position={[-width / 2 + w / 2 + i * w, 0, depth / 2]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.012, depth]} />
          <meshStandardMaterial color={i % 2 ? '#fbf8f1' : CORAL} roughness={0.85} />
        </mesh>
      ))}
      {/* The valance hangs straight down from the front edge, scalloped like the card's awning. */}
      <group position={[0, 0, depth]} rotation={[-0.42, 0, 0]}>
        {Array.from({ length: stripes }, (_, i) => {
          const color = i % 2 ? '#fbf8f1' : CORAL
          const x = -width / 2 + w / 2 + i * w
          return (
            <group key={`v${i}`} position={[x, 0, 0]}>
              <mesh position={[0, -0.03, 0]} castShadow>
                <boxGeometry args={[w, 0.06, 0.008]} />
                <meshStandardMaterial color={color} roughness={0.85} />
              </mesh>
              <mesh position={[0, -0.06, 0]} castShadow>
                <circleGeometry args={[w / 2, 32, Math.PI, Math.PI]} />
                <meshStandardMaterial color={color} roughness={0.85} side={THREE.DoubleSide} />
              </mesh>
            </group>
          )
        })}
      </group>
      <mesh position={[0, 0.012, 0.01]} castShadow>
        <boxGeometry args={[width + 0.02, 0.03, 0.03]} />
        <meshStandardMaterial color={INK} roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  )
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'cancel', '0', 'ok']

function Console({ y, z, pulse = 0 }: { y: number; z: number; pulse?: number }) {
  const keyTex = useSrgb(KEYS.map((k) => `atm/key-${k}.png`))
  const [pad] = useSrgb(['atm/tappad.png'])
  return (
    <group position={[0, y, z]} rotation={[0.34, 0, 0]}>
      {/* The sloped ledge. */}
      <RoundedBox args={[0.94, 0.07, 0.34]} radius={0.025} smoothness={4} castShadow receiveShadow>
        <Powder color="#e3dccf" />
      </RoundedBox>
      {/* Tap pad, left: Kova teal, lit from inside. */}
      <group position={[-0.22, 0.045, 0.01]}>
        <RoundedBox args={[0.3, 0.025, 0.24]} radius={0.012} smoothness={4} castShadow>
          <meshPhysicalMaterial color={TEAL} roughness={0.25} clearcoat={1} clearcoatRoughness={0.1} />
        </RoundedBox>
        <mesh position={[0, 0.0131, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.24, 0.24]} />
          <meshStandardMaterial map={pad} roughness={0.3} emissive="#ffffff" emissiveMap={pad} emissiveIntensity={0.04 + 0.5 * Math.sin(Math.min(pulse, 1) * Math.PI)} />
        </mesh>
        {/* The tap: two rings spread out over the pad. */}
        {pulse > 0 && pulse < 1
          ? [0, 0.25].map((d) => {
              const q = Math.min(1, Math.max(0, (pulse - d) / 0.75))
              return (
                <mesh key={d} position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.4 + 1.1 * q}>
                  <ringGeometry args={[0.1, 0.112, 64]} />
                  <meshBasicMaterial color="#ffffff" transparent opacity={(1 - q) * 0.9} toneMapped={false} />
                </mesh>
              )
            })
          : null}
      </group>
      {/* PIN keypad, right: 12 keys. */}
      <group position={[0.2, 0.045, 0.0]}>
        <RoundedBox args={[0.3, 0.016, 0.26]} radius={0.008} smoothness={3} receiveShadow>
          <meshStandardMaterial color={INK} roughness={0.5} metalness={0.4} />
        </RoundedBox>
        {KEYS.map((k, i) => {
          const col = i % 3
          const row = Math.floor(i / 3)
          return (
            <group key={k} position={[(col - 1) * 0.085, 0.016, (row - 1.5) * 0.058]}>
              <RoundedBox args={[0.07, 0.022, 0.045]} radius={0.008} smoothness={3} castShadow>
                <meshPhysicalMaterial color={k === 'cancel' ? CORAL : k === 'ok' ? '#46878b' : '#f6f2ea'} roughness={0.35} clearcoat={0.6} />
              </RoundedBox>
              <mesh position={[0, 0.0112, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.05, 0.034]} />
                <meshStandardMaterial map={keyTex[i]} transparent roughness={0.4} />
              </mesh>
            </group>
          )
        })}
      </group>
    </group>
  )
}

function Notes({ out }: { out: number }) {
  if (out <= 0) return null
  return (
    <group position={[0, 0.685, 0.3 + 0.17 * out]} rotation={[-0.12, 0, 0]}>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[(i - 1) * 0.014, 0.006 * i, -0.008 * i]} rotation={[0, (i - 1) * 0.06, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.005, 0.26]} />
            <meshStandardMaterial color={i === 2 ? '#bcdcc6' : '#d3e8da'} roughness={0.85} />
          </mesh>
          <mesh position={[0.17, 0.0031, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.045, 32]} />
            <meshStandardMaterial color="#46878b" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** The machine. `screen` picks what its display shows; `cash` (0..1) pushes notes out of the drawer. */
export function KovaPoint({ screen = 'tap', cash = 0, glow = 1, pulse = 0 }: { screen?: Screen; cash?: number; glow?: number; pulse?: number }) {
  const [screenTex, sign, decal, kovi] = useSrgb([`atm/screen-${screen}.png`, 'atm/sign.png', 'atm/decal.png', 'art/kovi-peek.png'])
  return (
    <group>
      {/* Plinth. */}
      <RoundedBox args={[1.14, 0.1, 0.76]} radius={0.03} smoothness={4} position={[0, 0.05, 0]} castShadow receiveShadow>
        <Powder color="#d6cebf" />
      </RoundedBox>
      {/* Body. */}
      <RoundedBox args={[1.0, 1.62, 0.62]} radius={0.07} smoothness={6} position={[0, 0.91, 0]} castShadow receiveShadow>
        <Powder color={PAPER} />
      </RoundedBox>
      {/* A coral pinstripe round the body, like the card's edge. */}
      <mesh position={[0, 0.125, 0]}>
        <boxGeometry args={[1.006, 0.02, 0.626]} />
        <meshStandardMaterial color={CORAL} roughness={0.5} />
      </mesh>

      {/* The screen, angled back in its hood. */}
      <group position={[0, 1.31, 0.3]} rotation={[-0.14, 0, 0]}>
        <RoundedBox args={[0.84, 0.66, 0.08]} radius={0.035} smoothness={4} castShadow>
          <meshPhysicalMaterial color={INK} roughness={0.3} metalness={0.35} clearcoat={0.8} />
        </RoundedBox>
        <mesh position={[0, 0, 0.041]}>
          <planeGeometry args={[0.72, 0.54]} />
          <meshBasicMaterial map={screenTex} toneMapped={false} color={new THREE.Color(glow, glow, glow)} />
        </mesh>
        {/* Glass. */}
        <mesh position={[0, 0, 0.043]}>
          <planeGeometry args={[0.76, 0.58]} />
          <meshPhysicalMaterial color="#ffffff" transparent opacity={0.08} roughness={0.02} metalness={0} clearcoat={1} />
        </mesh>
        {/* Privacy hood. */}
        <RoundedBox args={[0.9, 0.035, 0.16]} radius={0.012} smoothness={3} position={[0, 0.345, 0.06]} castShadow>
          <meshStandardMaterial color={INK} roughness={0.45} metalness={0.3} />
        </RoundedBox>
      </group>

      <Awning width={1.12} depth={0.3} y={1.74} z={0.31} />

      {/* The lit sign. */}
      <RoundedBox args={[1.1, 0.28, 0.5]} radius={0.04} smoothness={4} position={[0, 1.93, -0.02]} castShadow>
        <meshPhysicalMaterial color={INK} roughness={0.35} metalness={0.3} clearcoat={0.6} />
      </RoundedBox>
      <mesh position={[0, 1.93, 0.231]}>
        <planeGeometry args={[1.02, 0.255]} />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      {/* Kovi, peeking over the sign. */}
      <mesh position={[0.32, 2.12, 0.05]}>
        <planeGeometry args={[0.36, 0.18]} />
        <meshStandardMaterial map={kovi} transparent alphaTest={0.4} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>

      <Console y={0.9} z={0.43} pulse={pulse} />

      {/* Card slot with its green light, and the receipt slot. */}
      <RoundedBox args={[0.24, 0.04, 0.04]} radius={0.012} smoothness={3} position={[-0.22, 0.78, 0.31]}>
        <meshStandardMaterial color={INK} roughness={0.4} metalness={0.4} />
      </RoundedBox>
      <mesh position={[-0.08, 0.78, 0.333]}>
        <sphereGeometry args={[0.009, 16, 16]} />
        <meshBasicMaterial color="#7fe0a8" toneMapped={false} />
      </mesh>
      <RoundedBox args={[0.22, 0.02, 0.03]} radius={0.008} smoothness={3} position={[0.24, 0.78, 0.31]}>
        <meshStandardMaterial color={INK} roughness={0.4} metalness={0.4} />
      </RoundedBox>

      {/* Cash drawer. */}
      <RoundedBox args={[0.64, 0.09, 0.05]} radius={0.02} smoothness={3} position={[0, 0.685, 0.3]}>
        <meshStandardMaterial color={INK} roughness={0.4} metalness={0.4} />
      </RoundedBox>
      <Notes out={cash} />

      {/* The front decal. */}
      <mesh position={[0, 0.39, 0.311]}>
        <planeGeometry args={[0.72, 0.461]} />
        <meshStandardMaterial map={decal} roughness={0.55} />
      </mesh>
    </group>
  )
}

/** A Kova Card in 3D: 85.6 × 54 mm, shown at the machine's scale. */
export function KovaCard3D({ position, rotation, scale = 1 }: { position: [number, number, number]; rotation: [number, number, number]; scale?: number }) {
  const [front] = useSrgb(['atm/card-main.png'])
  const w = 0.09
  const h = (w * 1012) / 638
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <RoundedBox args={[w, h, 0.0035]} radius={0.0015} smoothness={2} castShadow>
        <meshPhysicalMaterial color="#f4f2ed" roughness={0.4} clearcoat={0.5} />
      </RoundedBox>
      <mesh position={[0, 0, 0.0019]}>
        <planeGeometry args={[w, h]} />
        <meshPhysicalMaterial map={front} transparent alphaTest={0.2} roughness={0.35} clearcoat={0.4} />
      </mesh>
    </group>
  )
}

/** The studio: a warm paper cyclorama, soft key light from the upper left, reflections from softboxes. */
export function Studio({ children, light = 1 }: { children: React.ReactNode; light?: number }) {
  const sky = new THREE.Color('#1b2730').lerp(new THREE.Color('#e6dfd2'), light)
  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, 7, 16]} />
      <ambientLight intensity={0.08 + 0.27 * light} />
      <directionalLight
        position={[-3, 5, 4]}
        intensity={2.2 * light}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={3}
        shadow-camera-bottom={-1}
        shadow-bias={-0.0004}
        shadow-radius={6}
      />
      <directionalLight position={[4, 2.5, 3]} intensity={0.6 * light} color="#ffe9d6" />
      <directionalLight position={[2.5, 3.5, -4]} intensity={0.3 + 1.1 * light} color="#fff4e6" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.4} position={[-4, 4, 3]} scale={[4, 3, 1]} target={[0, 1, 0]} />
        <Lightformer form="rect" intensity={1.2} position={[4, 2, 4]} scale={[3, 2, 1]} target={[0, 1, 0]} color="#ffe2cc" />
        <Lightformer form="ring" intensity={0.8} position={[0, 5, -2]} scale={2} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.6} position={[0, 1, -5]} scale={[10, 3, 1]} color="#e8e2d6" />
      </Environment>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#e6dfd2" roughness={0.95} />
      </mesh>
      <ContactShadows position={[0, 0.002, 0]} opacity={0.15 + 0.4 * light} scale={6} blur={2.4} far={2.5} resolution={1024} color="#3a2f25" frames={1} />
      {children}
    </>
  )
}

/** Turntable and hero shots of Kova Point: the camera orbits slowly, the screen walks the flow. */
export function KovaPointShowcase() {
  const frame = useCurrentFrame()
  const { width, height, fps, durationInFrames } = useVideoConfig()
  const t = frame / fps
  const p = frame / durationInFrames
  const angle = -0.55 + p * 1.0
  const radius = 4.9
  const screens: Screen[] = ['tap', 'menu', 'send', 'done', 'cash']
  const screen = screens[Math.min(screens.length - 1, Math.floor(p * screens.length))] ?? 'tap'
  const cash = screen === 'cash' ? Math.min(1, (p * screens.length - 4) * 3) : 0
  return (
    <AbsoluteFill>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ fov: 28, position: [Math.sin(angle) * radius, 1.5, Math.cos(angle) * radius], near: 0.1, far: 50 }}
        onCreated={({ camera }) => camera.lookAt(0, 1.05, 0)}
      >
        <CameraAim target={[0, 1.1, 0]} position={[Math.sin(angle) * radius, 1.5 + 0.08 * Math.sin(t * 0.5), Math.cos(angle) * radius]} />
        <Studio>
          <KovaPoint screen={screen} cash={cash} />
          <KovaCard3D position={[-0.3, 1.08, 0.66]} rotation={[-0.3, -0.45, 0.18]} scale={1.6} />
        </Studio>
      </ThreeCanvas>
    </AbsoluteFill>
  )
}

/** Points the camera every frame, so the shot is a pure function of the frame. */
export function CameraAim({ target, position }: { target: [number, number, number]; position: [number, number, number] }) {
  const camera = useThree((s) => s.camera)
  camera.position.set(...position)
  camera.lookAt(...target)
  camera.updateProjectionMatrix()
  return null
}
