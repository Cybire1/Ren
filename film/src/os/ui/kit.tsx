/**
 * The live Kova Shop OS screens' shared kit: one ease, one spring, one tap. Every screen in the
 * film is drawn from the design canvas (Kova POS) and animated from the frame.
 */
import type React from 'react'
import { Easing, Img, spring, staticFile } from 'remotion'

export const FPS = 30
/** The film runs at 110 BPM: taps, cuts and count-ups land on the beat. */
export const BEAT = 60 / 110
/** iOS's own curve: the hero ease, used for everything that slides or lifts. */
export const hero = Easing.bezier(0.32, 0.72, 0, 1)
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
export const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
export const mix = (a: number, b: number, p: number) => a + (b - a) * p
/** The film's one spring: a single small bounce. */
export const bounce = (t: number, at: number) => (t < at ? 0 : spring({ frame: (t - at) * FPS, fps: FPS, config: { damping: 14, stiffness: 120, mass: 0.8 } }))
/** Count-ups: ease-out cubic. */
export const countUp = (t: number, at: number, dur = 0.55) => 1 - (1 - span(t, at, at + dur)) ** 3

export const INK = '#0B1A1D'
export const PAPER = '#E7E5E0'
export const SURFACE = '#F1EFEA'
export const SUNKEN = '#DEDCD8'
export const TEAL = '#A9C9C9'
export const CORAL = '#D46558'
export const MUTED = '#566568'
export const GREEN = '#2E7268'

export const font: React.CSSProperties = { fontFamily: 'Manrope', color: INK }
export const money = (n: number) => `$${n.toFixed(2)}`

export const IMG = {
  loaf: 'os/img/bakery-loaf.png',
  baguette: 'os/img/bakery-baguette.png',
  croissant: 'os/img/bakery-croissant.png',
  bun: 'os/img/bakery-bun.png',
  cookie: 'os/img/bakery-cookie.png',
  cake: 'os/img/bakery-cake.png',
  flatwhite: 'os/img/bakery-flatwhite.png',
  latte: 'os/img/bakery-latte.png',
  koviCheer: 'art/kovi-cheer.png',
  koviWave: 'art/kovi-wave.png',
  koviRide: 'art/kovi-ride.png',
  koviPeek: 'art/kovi-peek.png',
  coin: 'art/coin-usd.png',
  qr: 'art/qr-ink.png',
} as const

export function Pic({ src, style }: { src: string; style?: React.CSSProperties }) {
  return <Img src={staticFile(src)} style={style} />
}

/**
 * A tap: the press (0..1, back to 0 within ~0.25 s) and the ripple (0..1). The UI answers 2 frames
 * after the touch, never on the same frame.
 */
export function tapAt(t: number, at: number) {
  const d = t - at
  const press = d < 0 ? 0 : d < 0.1 ? d / 0.1 : d < 0.25 ? 1 - (d - 0.1) / 0.15 : 0
  const ripple = span(t, at, at + 0.45)
  return { press, ripple, done: t >= at + 2 / FPS }
}

/** The finger: a soft dot that lands, presses and lifts, with a coral ring spreading from it. */
export function Finger({ t, at, x, y, size = 56 }: { t: number; at: number; x: number; y: number; size?: number }) {
  const { press, ripple } = tapAt(t, at)
  const before = span(t, at - 0.35, at)
  const after = span(t, at + 0.2, at + 0.55)
  const visible = before * (1 - after)
  if (visible <= 0 && (ripple <= 0 || ripple >= 1)) return null
  return (
    <>
      {ripple > 0 && ripple < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: x - size,
            top: y - size,
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            border: `5px solid ${CORAL}`,
            transform: `scale(${mix(0.3, 1.6, hero(ripple))})`,
            opacity: mix(0.6, 0, ripple),
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          background: 'rgba(255,255,255,0.85)',
          border: '3px solid rgba(11,26,29,0.35)',
          boxShadow: '0 8px 20px rgba(11,26,29,0.25)',
          transform: `translateY(${mix(-18, 0, hero(before))}px) scale(${1 - 0.12 * press})`,
          opacity: visible,
        }}
      />
    </>
  )
}
