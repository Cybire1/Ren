import type React from 'react'
import { Img, staticFile } from 'remotion'
import vo from '../public/audio/vo.json'
import { clamp01, decel, span } from './motion'
import { C } from './theme'

/** The captured screens are iPhone 16 screenshots. */
export const SCREEN = { w: 1179, h: 2556 }

/**
 * A phone: the real screen in a thick ink bezel, the sticker outline every Kova surface wears.
 * `children` are drawn in screenshot pixels, over the screen, so overlays line up with the capture.
 */
export function Phone({
  src,
  to,
  swap = 0,
  h,
  x,
  y,
  rotate = 0,
  style,
  children,
}: {
  src: string
  /** A second screen that fades in over the first, as the app moves on. */
  to?: string
  swap?: number
  h: number
  x: number
  y: number
  rotate?: number
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  const w = (h * SCREEN.w) / SCREEN.h
  const bezel = h * 0.022
  const k = h / SCREEN.h
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2 - bezel,
        top: y - h / 2 - bezel,
        width: w + bezel * 2,
        height: h + bezel * 2,
        borderRadius: w * 0.19,
        background: C.ink,
        padding: bezel,
        transform: `rotate(${rotate}deg)`,
        boxShadow: '0 40px 80px -30px rgba(11, 26, 29, 0.28)',
        ...style,
      }}
    >
      <div style={{ position: 'relative', width: w, height: h, borderRadius: w * 0.165, overflow: 'hidden', background: C.paper }}>
        <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        {to ? (
          <Img src={staticFile(to)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: swap }} />
        ) : null}
        <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN.w, height: SCREEN.h, transform: `scale(${k})`, transformOrigin: 'top left' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

/** Where a point on a phone's screen lands in the film (for flights that end on a screen). */
export function onScreen(phone: { h: number; x: number; y: number }, sx: number, sy: number, rotate = 0) {
  const k = phone.h / SCREEN.h
  const dx = (sx - SCREEN.w / 2) * k
  const dy = (sy - SCREEN.h / 2) * k
  const a = (rotate * Math.PI) / 180
  return { x: phone.x + dx * Math.cos(a) - dy * Math.sin(a), y: phone.y + dx * Math.sin(a) + dy * Math.cos(a) }
}

export type Pose = 'wave' | 'peek' | 'ride' | 'catch' | 'cheer' | 'key' | 'oops' | 'sleep'

/** Kovi, the one character. Painted art, never redrawn. */
export function Kovi({ pose, size, x, y, rotate = 0, flip = false, style }: { pose: Pose; size: number; x: number; y: number; rotate?: number; flip?: boolean; style?: React.CSSProperties }) {
  const ratio = pose === 'peek' ? 0.5 : 1
  return (
    <Img
      src={staticFile(`art/kovi-${pose}.png`)}
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - (size * ratio) / 2,
        width: size,
        height: size * ratio,
        transform: `rotate(${rotate}deg) scaleX(${flip ? -1 : 1})`,
        ...style,
      }}
    />
  )
}

export function Art({ name, w, x, y, ratio, style }: { name: string; w: number; x: number; y: number; ratio: number; style?: React.CSSProperties }) {
  return <Img src={staticFile(`art/${name}.png`)} style={{ position: 'absolute', left: x - w / 2, top: y - (w * ratio) / 2, width: w, height: w * ratio, ...style }} />
}

export type Pt = { x: number; y: number }
export type Curve = [Pt, Pt, Pt, Pt]

export function bezier([a, b, c, d]: Curve, t: number): Pt {
  const u = 1 - t
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  }
}

/**
 * Kovi on his paper plane along a curve, leaving the dotted trail the app's art draws between
 * places. Progress eases in and out; the trail is dots at fixed spacing, so it never shimmers.
 */
export function Flight({ curve, p, size, trail = true, color = C.ink, fade = 1 }: { curve: Curve; p: number; size: number; trail?: boolean; color?: string; fade?: number }) {
  const at = bezier(curve, p)
  const ahead = bezier(curve, Math.min(1, p + 0.02))
  const angle = (Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180) / Math.PI
  const dots: Pt[] = []
  if (trail) for (let i = 0; i <= 60; i++) if (i / 60 < p - 0.03) dots.push(bezier(curve, i / 60))
  return (
    <>
      {dots.map((d, i) => (
        <div
          key={i}
          style={{ position: 'absolute', left: d.x - 4, top: d.y - 4, width: 8, height: 8, borderRadius: 4, background: color, opacity: 0.8 * fade }}
        />
      ))}
      {p > 0 && p < 1 ? <Kovi pose="ride" size={size} x={at.x} y={at.y} rotate={angle * 0.35} flip={ahead.x < at.x} /> : null}
    </>
  )
}

/** A coral stroke drawn under the proof, left to right. In screenshot pixels. */
export function Underline({ t, at, x, y, w }: { t: number; at: number; x: number; y: number; w: number }) {
  const p = decel(span(t, at, at + 0.5))
  return <div style={{ position: 'absolute', left: x, top: y, width: w * p, height: 10, borderRadius: 5, background: C.coral }} />
}

/** A tap, where a thumb would be: one ring that opens and fades. In screenshot pixels. */
export function Tap({ t, at, x, y }: { t: number; at: number; x: number; y: number }) {
  const p = span(t, at, at + 0.55)
  if (p <= 0 || p >= 1) return null
  const r = 40 + 170 * decel(p)
  return (
    <div
      style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, border: `10px solid ${C.coral}`, opacity: 1 - p }}
    />
  )
}

type Line = { id: string; words: { text: string; start: number; end: number }[] }

/** The voiceover, word for word, in a low band. Words land as they are said. */
export function Captions({ t, starts }: { t: number; starts: Record<string, number> }) {
  const line = (vo.lines as Line[]).find((l) => {
    const s = starts[l.id]
    const last = l.words[l.words.length - 1]
    return s !== undefined && t >= s - 0.1 && t <= s + last.end + 0.45
  })
  if (!line) return null
  const s = starts[line.id]
  const last = line.words[line.words.length - 1]
  const opacity = clamp01((t - (s - 0.1)) / 0.2) * (1 - clamp01((t - (s + last.end + 0.15)) / 0.3))
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 58, display: 'flex', justifyContent: 'center', opacity }}>
      <div style={{ maxWidth: 1400, padding: '14px 30px', borderRadius: 999, background: 'rgba(241, 239, 234, 0.92)', fontFamily: 'Manrope', fontWeight: 600, fontSize: 38, letterSpacing: -0.4, color: C.ink, textAlign: 'center' }}>
        {line.words.map((w, i) => {
          const said = t >= s + w.start - 0.05
          return (
            <span key={i} style={{ opacity: said ? 1 : 0.28 }}>
              {w.text}
              {i < line.words.length - 1 ? ' ' : ''}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** Film grain, the one texture: seeded by frame, so every render draws the same grain. */
export function Grain({ frame }: { frame: number }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.05, mixBlendMode: 'multiply', pointerEvents: 'none' }}>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 997} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  )
}

/** Kova's mark and wordmark, from the app's own geometry (apps/web/src/components/brand.tsx). */
export function Logo({ h }: { h: number }) {
  const line = { stroke: C.ink, strokeWidth: 15.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: h * 0.18 }}>
      <svg width={h} height={h} viewBox="0 0 200 200">
        <path d="M62 46 V154" stroke={C.ink} strokeWidth={19} strokeLinecap="round" />
        {['M92.6 74.3 A40 40 0 0 1 92.6 125.7', 'M115.6 55 A70 70 0 0 1 115.6 145', 'M138.6 35.7 A100 100 0 0 1 138.6 164.3'].map((d) => (
          <path key={d} d={d} stroke={C.coral} strokeWidth={17} strokeLinecap="round" fill="none" />
        ))}
      </svg>
      <svg width={(h * 0.6 * 252) / 100} height={h * 0.6} viewBox="0 0 252 100">
        <path d="M8 8 V92" {...line} />
        <path d="M12 70 L40 38" {...line} />
        <path d="M26 56 L44 92" {...line} />
        <circle cx={86} cy={65} r={27} fill={C.coralSoft} stroke={C.ink} strokeWidth={15.5} />
        <path d="M130 40 L150 92 L170 40" {...line} />
        <circle cx={212} cy={66} r={26} {...line} />
        <path d="M238 40 V92" {...line} />
      </svg>
    </div>
  )
}
