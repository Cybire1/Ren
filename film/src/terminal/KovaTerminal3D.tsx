/**
 * Kova Terminal: a concept handheld point-of-sale for Kova, in real 3D. The silhouette is the
 * classic printer handheld: a slim slab with a rounded thermal-printer hump at the top. It is
 * modelled from its side profile, extruded across its width with a soft bevel, so every edge is
 * rounded the way moulded polycarbonate is.
 *
 * Units: 1 = 10 cm. It stands 1.75 tall (17.5 cm), 0.78 wide; the slab is 1.7 cm thick, the hump
 * 5.5 cm. The front faces +z, the top is +y. Its screen shows the real Kova till (public/screens).
 */
import { RoundedBox, useTexture } from '@react-three/drei'
import { useMemo } from 'react'
import { staticFile } from 'remotion'
import * as THREE from 'three'

export type Finish = 'paper' | 'ink' | 'coral'

const SHELL: Record<Finish, { body: string; accent: string; key: string; trigger: string; glass: string; mark: 'ink' | 'paper' }> = {
  paper: { body: '#ece7dc', accent: '#d46558', key: '#d9d3c7', trigger: '#2a3437', glass: '#0b1416', mark: 'ink' },
  ink: { body: '#1a2629', accent: '#d46558', key: '#3a474a', trigger: '#0e1517', glass: '#070c0d', mark: 'paper' },
  coral: { body: '#d9705f', accent: '#0b1a1d', key: '#c96253', trigger: '#2a3437', glass: '#0b1416', mark: 'paper' },
}

/** A side key: a dark recessed channel with an anodised key standing slightly proud of it. */
function SideKey({ side, y, length, color, rocker = false, ridges = false }: { side: 1 | -1; y: number; length: number; color: string; rocker?: boolean; ridges?: boolean }) {
  const x = side * SIZE.width / 2
  const z = -0.085
  return (
    <group position={[x, y, z]}>
      <RoundedBox args={[0.02, length + 0.03, 0.07]} radius={0.009} smoothness={4}>
        <meshStandardMaterial color="#0b1416" roughness={0.8} />
      </RoundedBox>
      <RoundedBox args={[0.024, length, 0.05]} radius={0.011} smoothness={5} position={[side * 0.014, 0, 0]} castShadow>
        <meshPhysicalMaterial color={color} metalness={0.7} roughness={ridges ? 0.55 : 0.3} clearcoat={0.5} clearcoatRoughness={0.25} />
      </RoundedBox>
      {rocker ? (
        <mesh position={[side * 0.0265, 0, 0]} rotation={[0, side * Math.PI / 2, 0]}>
          <planeGeometry args={[0.034, 0.004]} />
          <meshStandardMaterial color="#0b1416" />
        </mesh>
      ) : null}
      {ridges
        ? Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} position={[side * 0.0265, (i - 3) * (length / 8), 0]} rotation={[0, side * Math.PI / 2, 0]}>
              <planeGeometry args={[0.04, 0.0035]} />
              <meshStandardMaterial color="#05090a" roughness={0.9} />
            </mesh>
          ))
        : null}
    </group>
  )
}

export const SIZE = { width: 0.78, height: 1.75, slab: 0.17, hump: 0.55 }
const BEVEL = 0.025

/** The side profile: x is depth (0 at the front face, negative toward the back), y is height. */
function profile(): THREE.Shape {
  const { height: h, slab: t, hump: d } = SIZE
  const s = new THREE.Shape()
  s.moveTo(0, 0.05)
  s.lineTo(0, h - 0.06)
  // Over the top of the printer lid, rolling back.
  s.bezierCurveTo(0, h - 0.01, -0.04, h, -0.1, h)
  s.bezierCurveTo(-0.3, h, -d + 0.02, h - 0.02, -d, h - 0.16)
  // Down the back of the hump, easing into the slab.
  s.bezierCurveTo(-d - 0.02, h - 0.3, -d + 0.06, h - 0.44, -t - 0.12, h - 0.58)
  s.bezierCurveTo(-t - 0.02, h - 0.66, -t, h - 0.7, -t, h - 0.78)
  s.lineTo(-t, 0.06)
  s.bezierCurveTo(-t, 0.01, -t + 0.03, 0, -t + 0.06, 0)
  s.lineTo(-0.05, 0)
  s.bezierCurveTo(-0.01, 0, 0, 0.01, 0, 0.05)
  return s
}

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo(-w / 2 + r, -h / 2)
  s.lineTo(w / 2 - r, -h / 2)
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  s.lineTo(w / 2, h / 2 - r)
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  s.lineTo(-w / 2 + r, h / 2)
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  s.lineTo(-w / 2, -h / 2 + r)
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
  return s
}

/** UVs for a flat shape spanning its own bounding box, so a texture fills it. */
function boxUvs(geometry: THREE.BufferGeometry, w: number, h: number) {
  const pos = geometry.attributes.position as THREE.BufferAttribute
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / w + 0.5
    uv[i * 2 + 1] = pos.getY(i) / h + 0.5
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geometry
}

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

/** The display: the iPhone capture of the Kova till, cropped below its status bar to 1:2. */
function useScreen(url: string) {
  const [tex] = useSrgb([url])
  return useMemo(() => {
    const t = tex.clone()
    t.needsUpdate = true
    // A phone capture: keep the bottom 93% (drop its status bar), which is close to 1:2.
    if (url.startsWith('screens/')) t.repeat.set(1, 0.93)
    return t
  }, [tex, url])
}

// Slim bezels: the glass runs nearly to the body's edges, and the display nearly fills it.
const SCREEN = { w: 0.67, h: 1.34, y: 0.875 }
const GLASS = { w: 0.72, h: 1.4, y: 0.875, r: 0.055 }
/** Midway between the glass's top edge and where the front face starts to roll back over the lid. */
export const READER_Y = (GLASS.y + GLASS.h / 2 + (SIZE.height - 0.06)) / 2

/** A receipt curling out of the printer: a strip bent along a soft arc. */
function Receipt({ out, map }: { out: number; map: THREE.Texture }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.56, 1, 1, 40)
    return g
  }, [])
  const bent = useMemo(() => {
    const g = geometry.clone()
    const pos = g.attributes.position as THREE.BufferAttribute
    const length = 1.4 * out
    for (let i = 0; i < pos.count; i++) {
      const v = pos.getY(i) + 0.5 // 0 at the slot, 1 at the far end
      const s = v * length
      // Up out of the slot, then curling back over the lid.
      const angle = Math.min(1.2, s * 1.1)
      const y = Math.sin(angle) * Math.min(s, 0.9) * 0.9 + Math.max(0, s - 0.9) * 0.2
      const z = -s * 0.55 - Math.max(0, s - 0.6) * 0.6
      pos.setXYZ(i, pos.getX(i), y, z)
    }
    g.computeVertexNormals()
    // Show only the printed length: the texture's top is the start of the receipt.
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (1 - uv.getY(i)) * Math.max(out, 0.001))
    return g
  }, [geometry, out])
  if (out <= 0) return null
  return (
    <mesh geometry={bent} castShadow receiveShadow>
      <meshStandardMaterial map={map} side={THREE.DoubleSide} roughness={0.9} />
    </mesh>
  )
}

export function KovaTerminal({
  finish = 'paper',
  screen = 'terminal/screen-charge.png',
  receipt = 0,
  glow = 1,
  shadow = true,
}: {
  /** Cast a hard shadow from the key light (off where only the soft contact shadow should ground it). */
  shadow?: boolean
  finish?: Finish
  screen?: string
  /** How much receipt has printed, 0..1. */
  receipt?: number
  glow?: number
}) {
  const shell = SHELL[finish]
  const display = useScreen(screen)
  const [paper, contactless, wordmark] = useSrgb(['terminal/receipt.png', `terminal/contactless-${shell.mark}.png`, `terminal/wordmark-${shell.mark}.png`])

  const body = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(profile(), {
      depth: SIZE.width - 2 * BEVEL,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL * 0.8,
      bevelSegments: 10,
      curveSegments: 64,
    })
    g.translate(0, 0, -(SIZE.width - 2 * BEVEL) / 2)
    g.computeVertexNormals()
    return g
  }, [])
  const glass = useMemo(() => new THREE.ShapeGeometry(roundedRect(GLASS.w, GLASS.h, GLASS.r), 24), [])
  const screenGeometry = useMemo(() => boxUvs(new THREE.ShapeGeometry(roundedRect(SCREEN.w, SCREEN.h, 0.045), 16), SCREEN.w, SCREEN.h), [])

  const front = BEVEL * 0.8 // where the front face sits after the bevel grows the outline
  return (
    <group>
      <mesh geometry={body} rotation={[0, -Math.PI / 2, 0]} castShadow={shadow} receiveShadow>
        <meshPhysicalMaterial color={shell.body} roughness={finish === 'ink' ? 0.4 : 0.6} ior={1.58} clearcoat={finish === 'ink' ? 0.6 : 0.06} clearcoatRoughness={finish === 'ink' ? 0.12 : 0.6} sheen={0.25} sheenRoughness={0.8} sheenColor="#ffffff" specularIntensity={0.5} />
      </mesh>

      {/* Front glass, edge to edge of the screen area. */}
      <mesh geometry={glass} position={[0, GLASS.y, front + 0.002]}>
        <meshPhysicalMaterial color={shell.glass} roughness={0.08} metalness={0.1} clearcoat={1} clearcoatRoughness={0.03} />
      </mesh>
      <mesh geometry={screenGeometry} position={[0, SCREEN.y, front + 0.004]}>
        <meshBasicMaterial map={display} toneMapped={false} color={new THREE.Color(glow, glow, glow)} />
      </mesh>
      {/* The home key under the screen: one anodised pill in a recess, with a status light. */}
      <RoundedBox args={[0.2, 0.056, 0.012]} radius={0.026} smoothness={6} position={[0, 0.095, front - 0.003]}>
        <meshStandardMaterial color="#0b1416" roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[0.175, 0.038, 0.018]} radius={0.018} smoothness={6} position={[0, 0.095, front + 0.002]} castShadow>
        <meshPhysicalMaterial color={shell.accent} metalness={0.75} roughness={0.28} clearcoat={0.6} clearcoatRoughness={0.2} />
      </RoundedBox>
      <mesh position={[0.16, 0.095, front + 0.001]}>
        <circleGeometry args={[0.008, 24]} />
        <meshBasicMaterial color="#7fe0a8" toneMapped={false} />
      </mesh>
      {/* The reader sits in the flat strip above the glass: a small mark, printed like an engraving. */}
      <mesh position={[0, READER_Y, front + 0.001]}>
        <planeGeometry args={[0.075, 0.075]} />
        <meshStandardMaterial map={contactless} transparent alphaTest={0.3} opacity={0.85} roughness={0.7} />
      </mesh>
      {/* Kova's wordmark on the back. */}
      <mesh position={[0, 0.72, -SIZE.slab - BEVEL * 0.8 - 0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.42, 0.42]} />
        <meshStandardMaterial map={wordmark} transparent alphaTest={0.3} roughness={0.6} />
      </mesh>
      {/* The printer's paper slot, across the lid. */}
      <mesh position={[0, SIZE.height + BEVEL * 0.8 - 0.004, -0.07]}>
        <boxGeometry args={[0.6, 0.012, 0.016]} />
        <meshStandardMaterial color="#0b1416" roughness={0.6} />
      </mesh>
      <group position={[0, SIZE.height + BEVEL * 0.8, -0.07]}>
        <Receipt out={receipt} map={paper} />
      </group>
      {/* Side keys, each in a recessed channel: power and a volume rocker on the right, a ridged scan
          trigger on both sides. Anodised aluminium, like the home key. */}
      <SideKey side={1} y={1.12} length={0.12} color={shell.accent} />
      <SideKey side={1} y={0.86} length={0.22} color={shell.key} rocker />
      <SideKey side={1} y={0.52} length={0.2} color={shell.trigger} ridges />
      <SideKey side={-1} y={0.52} length={0.2} color={shell.trigger} ridges />
    </group>
  )
}
