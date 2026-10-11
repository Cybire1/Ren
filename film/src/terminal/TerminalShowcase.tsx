/**
 * Hero shots of Kova Terminal: a product-studio set (paper sweep, softbox reflections, soft
 * contact shadow), ambient occlusion and a touch of bloom on the screen.
 */
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { ThreeCanvas } from '@remotion/three'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import * as THREE from 'three'
import { CameraAim } from '../atm/KovaPoint3D'
import { Grain } from '../parts'
import { type Finish, KovaTerminal } from './KovaTerminal3D'

export function ProductStudio({ children, ground = '#e9e3d8' }: { children: React.ReactNode; ground?: string }) {
  return (
    <>
      <color attach="background" args={[ground]} />
      <fog attach="fog" args={[ground, 9, 20]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[-2.5, 6, 3.5]}
        intensity={2.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={3}
        shadow-camera-bottom={-1}
        shadow-bias={-0.0003}
        shadow-radius={8}
      />
      <directionalLight position={[3, 3, -3]} intensity={1.6} color="#fff1e2" />
      <Environment resolution={512} frames={1}>
        {/* Two tall softboxes and a top strip: the long highlights a product shoot is known by. */}
        <Lightformer form="rect" intensity={3} position={[-3, 2.5, 2.5]} scale={[1.2, 5, 1]} target={[0, 1, 0]} />
        <Lightformer form="rect" intensity={2} position={[3, 2, 2]} scale={[1, 4, 1]} target={[0, 1, 0]} color="#ffe6d2" />
        <Lightformer form="rect" intensity={2.5} position={[0, 5, 0.5]} scale={[4, 0.6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} position={[0, 1.5, -4]} scale={[6, 3, 1]} target={[0, 1, 0]} />
        <Lightformer form="rect" intensity={0.5} position={[0, -1, 3]} scale={[6, 1, 1]} target={[0, 1, 0]} color="#e9e3d8" />
      </Environment>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={ground} roughness={0.92} />
      </mesh>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.6} scale={5} blur={2.6} far={2.2} resolution={1024} color="#3a2f25" frames={1} />
      {children}
    </>
  )
}

export function Post() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={0.25} luminanceThreshold={1} mipmapBlur />
      <Vignette offset={0.3} darkness={0.45} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  )
}

/** The grade that would be post-processing: a soft vignette and seeded film grain, over the render. */
export function Finish({ frame }: { frame: number }) {
  return (
    <>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 75% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(30,24,18,0.28))', pointerEvents: 'none' }} />
      <Grain frame={frame} />
    </>
  )
}

/** A slow turntable of the three finishes, for review. */
const POST = false

export function TerminalShowcase() {
  const frame = useCurrentFrame()
  const { width, height, fps, durationInFrames } = useVideoConfig()
  const p = frame / durationInFrames
  const angle = -0.5 + p * 0.9
  const r = 6.6
  const finishes: Finish[] = ['ink', 'paper', 'coral']
  return (
    <AbsoluteFill>
      <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.05 }} camera={{ fov: 26, near: 0.05, far: 60 }}>
        <CameraAim position={[Math.sin(angle) * r, 2.0, Math.cos(angle) * r]} target={[0, 0.9, 0]} />
        <ProductStudio>
          {finishes.map((f, i) => (
            <group key={f} position={[(i - 1) * 1.05, 0.02, i === 1 ? 0.25 : -0.1]} rotation={[0, (i - 1) * -0.18, 0]}>
              <group rotation={[-0.22, 0, 0]} position={[0, 0.17, 0]}>
                <KovaTerminal finish={f} screen={i === 1 ? 'screens/09-till-paid.png' : 'screens/08-till-code.png'} receipt={i === 1 ? 0.7 + 0.3 * Math.sin(frame / fps) * 0 : 0} />
              </group>
            </group>
          ))}
        </ProductStudio>
        {POST ? <Post /> : null}
      </ThreeCanvas>
      <Finish frame={frame} />
    </AbsoluteFill>
  )
}
