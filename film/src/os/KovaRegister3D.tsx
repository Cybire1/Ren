/**
 * Kova Register: a concept countertop point of sale for Kova Shop OS, in real 3D. A soft paper
 * base holds the printer and the tap reader; a stem raises a 16:10 screen for the shop, tilted
 * back; a smaller screen on the back faces the customer. Both screens show the Kova Shop OS
 * designs (public/os).
 *
 * Units: 1 ≈ 17 cm. The main screen is 2.0 wide (about 15.6"). The shop side faces +z; the
 * customer side faces −z.
 */
import { RoundedBox, useTexture } from '@react-three/drei'
import { useMemo } from 'react'
import { staticFile } from 'remotion'
import * as THREE from 'three'

const PAPER = '#ece7dc'
const PAPER_DEEP = '#ddd6c8'
const INK = '#0f1a1c'
const CORAL = '#d46558'
const TEAL = '#a9c9c9'

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

function Body({ color = PAPER, rough = 0.55 }: { color?: string; rough?: number }) {
  return <meshPhysicalMaterial color={color} roughness={rough} clearcoat={0.15} clearcoatRoughness={0.5} sheen={0.2} sheenRoughness={0.8} />
}

/** A screen in a slim ink frame: glass over the picture, the picture slightly lit. */
function Display({ w, h, map, glow = 1 }: { w: number; h: number; map: THREE.Texture; glow?: number }) {
  return (
    <group>
      <RoundedBox args={[w + 0.08, h + 0.08, 0.07]} radius={0.04} smoothness={5} castShadow>
        <meshPhysicalMaterial color={INK} roughness={0.25} metalness={0.3} clearcoat={0.8} />
      </RoundedBox>
      <mesh position={[0, 0, 0.0365]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={map} toneMapped={false} color={new THREE.Color(glow, glow, glow)} />
      </mesh>
      <mesh position={[0, 0, 0.037]}>
        <planeGeometry args={[w + 0.06, h + 0.06]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.06} roughness={0.02} clearcoat={1} />
      </mesh>
    </group>
  )
}

export function KovaRegister({
  screen = 'os/Main.png',
  customer = 'os/CustomerTap.png',
  pulse = 0,
  receipt = 0,
}: {
  screen?: string
  customer?: string
  /** The tap on the reader, 0..1. */
  pulse?: number
  /** How much receipt has printed, 0..1. */
  receipt?: number
}) {
  const [main, cust, mark] = useSrgb([screen, customer, 'terminal/contactless-ink.png'])
  return (
    <group>
      {/* The base: soft paper, a coral band, the printer at the front right. */}
      <RoundedBox args={[1.5, 0.3, 1.05]} radius={0.13} smoothness={6} position={[0, 0.15, 0]} castShadow receiveShadow>
        <Body />
      </RoundedBox>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[1.505, 0.02, 1.055]} />
        <meshStandardMaterial color={CORAL} roughness={0.5} />
      </mesh>
      {/* Printer slot and receipt, on the shop side. */}
      <mesh position={[0.42, 0.302, 0.3]}>
        <boxGeometry args={[0.42, 0.01, 0.025]} />
        <meshStandardMaterial color={INK} />
      </mesh>
      {receipt > 0 ? (
        <mesh position={[0.42, 0.3 + 0.2 * receipt, 0.3 + 0.04 * receipt]} rotation={[-0.25, 0, 0]} castShadow>
          <planeGeometry args={[0.38, 0.4 * receipt]} />
          <meshStandardMaterial color="#fbf8f2" side={THREE.DoubleSide} roughness={0.9} />
        </mesh>
      ) : null}
      {/* The tap reader on the customer side: a teal pad with its mark, rings on a tap. */}
      <group position={[-0.42, 0.302, -0.28]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <circleGeometry args={[0.2, 64]} />
          <meshPhysicalMaterial color={TEAL} roughness={0.3} clearcoat={0.8} emissive="#ffffff" emissiveIntensity={0.3 * Math.sin(Math.min(pulse, 1) * Math.PI)} />
        </mesh>
        <mesh position={[0, 0, 0.001]} rotation={[0, 0, Math.PI]}>
          <planeGeometry args={[0.16, 0.16]} />
          <meshStandardMaterial map={mark} transparent alphaTest={0.3} />
        </mesh>
        {pulse > 0 && pulse < 1
          ? [0, 0.25].map((d) => {
              const q = Math.min(1, Math.max(0, (pulse - d) / 0.75))
              return (
                <mesh key={d} position={[0, 0, 0.002]} scale={1 + 1.2 * q}>
                  <ringGeometry args={[0.2, 0.215, 64]} />
                  <meshBasicMaterial color={CORAL} transparent opacity={(1 - q) * 0.9} toneMapped={false} />
                </mesh>
              )
            })
          : null}
      </group>
      {/* The stem and its hinge. */}
      <mesh position={[0, 0.55, -0.05]} rotation={[-0.18, 0, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 0.6, 32]} />
        <Body color={PAPER_DEEP} />
      </mesh>
      <mesh position={[0, 0.86, -0.1]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.42, 32]} />
        <meshPhysicalMaterial color={INK} roughness={0.35} metalness={0.5} />
      </mesh>
      {/* The shop's screen, tilted back. */}
      <group position={[0, 1.42, 0.02]} rotation={[-0.26, 0, 0]}>
        <Display w={2.0} h={1.25} map={main} />
        {/* A paper back on the screen, with the customer display mounted on it. */}
        <RoundedBox args={[2.06, 1.31, 0.05]} radius={0.04} smoothness={5} position={[0, 0, -0.05]} castShadow>
          <Body />
        </RoundedBox>
        <group position={[0, -0.12, -0.11]} rotation={[0, Math.PI, 0]}>
          <Display w={1.1} h={0.645} map={cust} />
        </group>
      </group>
    </group>
  )
}
