/**
 * Kovi as a rig: the painted art (public/art/kovi-wave.png) redrawn in vector, in parts that move on
 * their own, so he can blink, look, talk, swing his arms and crouch, the way Duolingo-style
 * characters are built. Geometry and colours are sampled from the painting (1024 x 1024 space).
 *
 * The origin is his feet: `x`, `y` place the point on the ground between his feet.
 */
import type React from 'react'

export const KOVI = {
  face: '#edc354',
  rim: '#f39a36',
  cheek: '#f3999c',
  tongue: '#f38486',
  ink: '#07060a',
  groundY: 912,
  center: { x: 522, y: 399 },
}

export type Mouth = 'smile' | 'grin' | 'o' | 'ooh' | 'flat'

export type KoviPose = {
  /** 0 open, 1 closed. */
  blink?: number
  /** 0 normal eyes, 1 happy ^ ^ eyes. */
  happy?: number
  /** Where he looks, in -1..1 (x left/right, y up/down). */
  look?: { x: number; y: number }
  mouth?: Mouth
  /** Left arm (his right, on screen left) and right arm: degrees from pointing straight up. */
  armL?: number
  armR?: number
  /** Arm curve, for drag on fast swings: -1..1. */
  bendL?: number
  bendR?: number
  /** 0 standing, 1 deep crouch (the body sinks, the legs fold). */
  crouch?: number
  /** Squash and stretch of the whole character, from the feet. */
  sx?: number
  sy?: number
  /** Lean, degrees, from the feet. */
  lean?: number
  /** Motion lines by the left hand, 0..1. */
  waveLines?: number
  /** 0..1 extra blush. */
  blush?: number
  /** Hide the legs (peeking over a line). */
  noLegs?: boolean
  /** Hide the arms (their hands are drawn holding something instead). */
  noArms?: boolean
}

const shoulderL = { x: 262, y: 440 }
const shoulderR = { x: 790, y: 545 }
const ARM = 165

function arm(from: { x: number; y: number }, deg: number, bend: number) {
  const a = (deg * Math.PI) / 180
  const hand = { x: from.x + Math.sin(a) * ARM, y: from.y - Math.cos(a) * ARM }
  // A soft bow at the elbow, perpendicular to the arm.
  const mid = { x: (from.x + hand.x) / 2 + Math.cos(a) * 34 * bend, y: (from.y + hand.y) / 2 + Math.sin(a) * 34 * bend }
  return { hand, d: `M${from.x} ${from.y} Q${mid.x} ${mid.y} ${hand.x} ${hand.y}` }
}

function Eye({ cx, cy, blink, happy, look }: { cx: number; cy: number; blink: number; happy: number; look: { x: number; y: number } }) {
  const ex = cx + look.x * 9
  const ey = cy + look.y * 8
  if (happy > 0.5) {
    return <path d={`M${ex - 34} ${ey + 10} Q${ex} ${ey - 42} ${ex + 34} ${ey + 10}`} fill="none" stroke={KOVI.ink} strokeWidth={17} strokeLinecap="round" />
  }
  const open = Math.max(0.07, 1 - blink)
  return (
    <g transform={`translate(${ex} ${ey}) scale(1 ${open}) translate(${-ex} ${-ey})`}>
      <ellipse cx={ex} cy={ey} rx={33} ry={58} fill={KOVI.ink} />
      {open > 0.4 ? <circle cx={ex + 6 + look.x * 6} cy={ey - 26 + look.y * 5} r={11} fill="#ffffff" /> : null}
    </g>
  )
}

function MouthShape({ mouth }: { mouth: Mouth }) {
  const cx = 507
  switch (mouth) {
    case 'o':
      return (
        <g>
          <ellipse cx={cx} cy={500} rx={30} ry={38} fill={KOVI.ink} />
          <ellipse cx={cx} cy={520} rx={18} ry={11} fill={KOVI.tongue} />
        </g>
      )
    case 'ooh':
      return <ellipse cx={cx} cy={498} rx={17} ry={20} fill={KOVI.ink} />
    case 'grin':
      return <path d={`M${cx - 52} 474 Q${cx} 522 ${cx + 52} 474`} fill="none" stroke={KOVI.ink} strokeWidth={15} strokeLinecap="round" />
    case 'flat':
      return <path d={`M${cx - 30} 492 H${cx + 30}`} fill="none" stroke={KOVI.ink} strokeWidth={14} strokeLinecap="round" />
    default:
      return (
        <g>
          <path d={`M${cx - 56} 462 Q${cx} 470 ${cx + 56} 462 Q${cx + 50} 540 ${cx} 542 Q${cx - 50} 540 ${cx - 56} 462 Z`} fill={KOVI.ink} />
          <path d={`M${cx - 34} 522 Q${cx} 500 ${cx + 34} 522 Q${cx + 20} 538 ${cx} 538 Q${cx - 20} 538 ${cx - 34} 522 Z`} fill={KOVI.tongue} />
        </g>
      )
  }
}

export function KoviRig({ x, y, size, pose = {}, style }: { x: number; y: number; size: number; pose?: KoviPose; style?: React.CSSProperties }) {
  const {
    blink = 0,
    happy = 0,
    look = { x: 0, y: 0 },
    mouth = 'smile',
    armL = -34,
    armR = 155,
    bendL = 0,
    bendR = 0,
    crouch = 0,
    sx = 1,
    sy = 1,
    lean = 0,
    waveLines = 0,
    blush = 0,
    noLegs = false,
    noArms = false,
  } = pose
  const k = size / 1024
  const sink = crouch * 70
  const L = arm(shoulderL, armL, bendL)
  const R = arm(shoulderR, armR, bendR)
  const legTop = 690 + sink
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      style={{ position: 'absolute', left: x - 512 * k, top: y - KOVI.groundY * k, overflow: 'visible', ...style }}
      aria-hidden="true"
    >
      <g transform={`translate(512 ${KOVI.groundY}) rotate(${lean}) scale(${sx} ${sy}) translate(-512 ${-KOVI.groundY})`}>
        {noLegs ? null : (
          <g>
            <path d={`M462 ${legTop} Q${458 - crouch * 40} ${(legTop + 850) / 2} 452 852`} fill="none" stroke={KOVI.ink} strokeWidth={20} strokeLinecap="round" />
            <path d={`M598 ${legTop} Q${602 + crouch * 40} ${(legTop + 850) / 2} 608 852`} fill="none" stroke={KOVI.ink} strokeWidth={20} strokeLinecap="round" />
            <ellipse cx={412} cy={872} rx={86 * (1 + crouch * 0.08)} ry={40 * (1 - crouch * 0.1)} fill={KOVI.ink} />
            <ellipse cx={660} cy={872} rx={86 * (1 + crouch * 0.08)} ry={40 * (1 - crouch * 0.1)} fill={KOVI.ink} />
          </g>
        )}
        <g transform={`translate(0 ${sink})`}>
          {/* The arm behind the body. */}
          {noArms ? null : <path d={R.d} fill="none" stroke={KOVI.ink} strokeWidth={17} strokeLinecap="round" />}
          {/* The coin: its orange edge, then the face. */}
          <circle cx={574} cy={KOVI.center.y} r={292} fill={KOVI.rim} stroke={KOVI.ink} strokeWidth={14} />
          <circle cx={KOVI.center.x} cy={KOVI.center.y} r={296} fill={KOVI.face} stroke={KOVI.ink} strokeWidth={14} />
          <circle cx={KOVI.center.x} cy={KOVI.center.y} r={250} fill="none" stroke={KOVI.ink} strokeWidth={8} strokeLinecap="round" strokeDasharray="0.1 23" />
          <path d="M338 298 A205 205 0 0 1 446 208" fill="none" stroke="#ffffff" strokeWidth={20} strokeLinecap="round" />
          <circle cx={362} cy={470} r={38} fill={KOVI.cheek} opacity={0.85 + blush * 0.15} transform={`translate(362 470) scale(${1 + blush * 0.15}) translate(-362 -470)`} />
          <circle cx={660} cy={470} r={38} fill={KOVI.cheek} opacity={0.85 + blush * 0.15} transform={`translate(660 470) scale(${1 + blush * 0.15}) translate(-660 -470)`} />
          <Eye cx={422} cy={386} blink={blink} happy={happy} look={look} />
          <Eye cx={596} cy={386} blink={blink} happy={happy} look={look} />
          <g transform={`translate(${look.x * 6} ${look.y * 4})`}>
            <MouthShape mouth={mouth} />
          </g>
          {/* The arm in front, and both hands. */}
          {noArms ? null : (
            <>
              <path d={L.d} fill="none" stroke={KOVI.ink} strokeWidth={17} strokeLinecap="round" />
              <circle cx={L.hand.x} cy={L.hand.y} r={44} fill={KOVI.face} stroke={KOVI.ink} strokeWidth={14} />
              <circle cx={R.hand.x} cy={R.hand.y} r={44} fill={KOVI.face} stroke={KOVI.ink} strokeWidth={14} />
            </>
          )}
          {waveLines > 0 ? (
            <g opacity={waveLines} stroke={KOVI.ink} strokeWidth={14} strokeLinecap="round" fill="none">
              <path d={`M${L.hand.x - 78} ${L.hand.y - 90} q20 -20 46 -10`} />
              <path d={`M${L.hand.x - 12} ${L.hand.y - 120} q18 18 12 44`} />
            </g>
          ) : null}
        </g>
      </g>
    </svg>
  )
}
