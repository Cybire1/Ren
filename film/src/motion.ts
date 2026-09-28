import { Easing } from 'remotion'

/**
 * The film's whole motion vocabulary. Nothing else moves any other way.
 *   text enter    Hero Reveal: scale 1.16 → 1, blur 18 → 0, 0.9 s, decelerated
 *   object enter  Rise: y 44 → 0, 0.6 s, decelerated
 *   exit          accelerated fade with an 8 px rise, 0.3 s
 *   Kovi          the one bouncy spring in the film
 */
export const FPS = 30
export const decel = Easing.bezier(0.16, 1, 0.3, 1)
export const accel = Easing.bezier(0.7, 0, 0.84, 0)
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1)

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** Progress of t through [a, b], clamped. */
export const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
export const mix = (a: number, b: number, p: number) => a + (b - a) * p

type Presence = { opacity: number; y: number; scale: number; blur: number }

function exit(t: number, outAt: number | undefined, p: Presence): Presence {
  if (outAt === undefined || t <= outAt) return p
  const x = accel(span(t, outAt, outAt + 0.3))
  return { ...p, opacity: p.opacity * (1 - x), y: p.y - 8 * x }
}

/** Objects: rise into place, fade out. */
export function rise(t: number, inAt: number, outAt?: number, distance = 44): Presence {
  const e = decel(span(t, inAt, inAt + 0.6))
  return exit(t, outAt, { opacity: e, y: (1 - e) * distance, scale: 1, blur: 0 })
}

/** Words: sharpen out of a soft blow-up. */
export function hero(t: number, inAt: number, outAt?: number): Presence {
  const e = decel(span(t, inAt, inAt + 0.9))
  return exit(t, outAt, { opacity: e, y: 0, scale: 1.16 - 0.16 * e, blur: 18 * (1 - e) })
}

export const presenceStyle = (p: Presence, extra = ''): React.CSSProperties => ({
  opacity: p.opacity,
  transform: `translateY(${p.y}px) scale(${p.scale}) ${extra}`,
  filter: p.blur > 0.05 ? `blur(${p.blur}px)` : undefined,
})

/** Kovi's hop: a damped bounce that settles in about half a second. */
export function hop(t: number, at: number, height = 60): number {
  if (t < at) return 0
  const s = t - at
  return -height * Math.exp(-6 * s) * Math.abs(Math.sin(s * 9))
}
