/**
 * Kovi, drawn in code: a gold coin with a milled rim, rubber-hose limbs, white cartoon gloves
 * and coral shoes. Every pose shares one body, so he is the same character everywhere, and he
 * stays crisp at any size.
 *
 * Coordinates live on a 180×180 canvas centred on 0,0. His body is centred at (0, -6).
 */
import type { ReactNode } from 'react'
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg'
import { colors, fonts } from '@/lib/theme'

const ink = colors.ink
const gold = '#EBB3AA'
const goldLight = '#F4CCC5'
const glove = '#F4F2ED'
const shoe = colors.coral
const LINE = 3.2

export type KoviPose = 'wave' | 'cheer' | 'catch' | 'key' | 'sleep' | 'ride' | 'oops'

/** A cartoon glove: palm, thumb and cuff, rotated to point along the arm. */
function Glove({ x, y, rot = 0, open }: { x: number; y: number; rot?: number; open?: boolean }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rot})`}>
      <Path d="M-6 7 L-7 11 L7 11 L6 7" fill={glove} stroke={ink} strokeWidth={2.4} strokeLinejoin="round" />
      <Circle cx={0} cy={0} r={9} fill={glove} stroke={ink} strokeWidth={2.6} />
      <Circle cx={open ? -9 : -7} cy={open ? -3 : 2} r={4} fill={glove} stroke={ink} strokeWidth={2.4} />
      {open ? null : <Path d="M-2 -5 Q2 -6 5 -3" fill="none" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />}
    </G>
  )
}

function Shoe({ x, y, flip, rot = 0 }: { x: number; y: number; flip?: boolean; rot?: number }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rot}) scale(${flip ? -1 : 1} 1)`}>
      <Path d="M-8 -6 Q-9 -10 -3 -10 Q8 -10 12 -2 Q14 4 6 5 L-8 5 Q-12 5 -11 0 Z" fill={shoe} stroke={ink} strokeWidth={2.6} strokeLinejoin="round" />
      <Path d="M-8 1 L8 1" stroke={colors.white} strokeWidth={1.8} strokeLinecap="round" opacity={0.8} />
    </G>
  )
}

function Limb({ d }: { d: string }) {
  return <Path d={d} fill="none" stroke={ink} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
}

/** The coin itself: milled rim, two-tone face and a shine. */
function Body() {
  const ticks = Array.from({ length: 44 }, (_, i) => {
    const a = (i / 44) * Math.PI * 2
    const r1 = 36.5
    const r2 = 39.5
    return `M${(Math.cos(a) * r1).toFixed(1)} ${(Math.sin(a) * r1 - 6).toFixed(1)}L${(Math.cos(a) * r2).toFixed(1)} ${(Math.sin(a) * r2 - 6).toFixed(1)}`
  }).join('')
  return (
    <G>
      <Circle cx={0} cy={-6} r={41} fill={gold} stroke={ink} strokeWidth={LINE} />
      <Path d={ticks} stroke={ink} strokeWidth={1.1} opacity={0.35} />
      <Circle cx={0} cy={-6} r={33} fill={goldLight} stroke={ink} strokeWidth={1.4} strokeOpacity={0.45} />
      <Path d="M-24 -30 A30 30 0 0 1 -8 -38" fill="none" stroke={colors.white} strokeWidth={4.5} strokeLinecap="round" opacity={0.85} />
      <Circle cx={-27} cy={-22} r={2.2} fill={colors.white} opacity={0.85} />
    </G>
  )
}

function Face({ mood }: { mood: 'happy' | 'joy' | 'calm' | 'asleep' | 'worried' }) {
  const eyes =
    mood === 'asleep' ? (
      <Path d="M-16 -8 Q-11 -3 -6 -8 M6 -8 Q11 -3 16 -8" fill="none" stroke={ink} strokeWidth={2.6} strokeLinecap="round" />
    ) : mood === 'joy' ? (
      <Path d="M-16 -6 Q-11 -13 -6 -6 M6 -6 Q11 -13 16 -6" fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" />
    ) : (
      <G>
        <Ellipse cx={-11} cy={-8} rx={4.8} ry={6.4} fill={ink} />
        <Ellipse cx={11} cy={-8} rx={4.8} ry={6.4} fill={ink} />
        <Circle cx={-9.4} cy={-10.6} r={2} fill={colors.white} />
        <Circle cx={12.6} cy={-10.6} r={2} fill={colors.white} />
        <Circle cx={-12.4} cy={-5.4} r={0.9} fill={colors.white} />
        <Circle cx={9.6} cy={-5.4} r={0.9} fill={colors.white} />
      </G>
    )
  const brows =
    mood === 'worried' ? (
      <Path d="M-18 -16 Q-12 -20 -6 -22 M18 -16 Q12 -20 6 -22" fill="none" stroke={ink} strokeWidth={2.4} strokeLinecap="round" />
    ) : null
  const mouth =
    mood === 'asleep' ? (
      <Ellipse cx={0} cy={6} rx={3} ry={2.4} fill={ink} />
    ) : mood === 'worried' ? (
      <Path d="M-7 8 Q-3.5 5 0 8 Q3.5 11 7 8" fill="none" stroke={ink} strokeWidth={2.4} strokeLinecap="round" />
    ) : mood === 'calm' ? (
      <Path d="M-7 4 Q0 10 7 4" fill="none" stroke={ink} strokeWidth={2.6} strokeLinecap="round" />
    ) : (
      <G>
        <Path d="M-9 2 Q0 17 9 2 Z" fill={ink} stroke={ink} strokeWidth={1.6} strokeLinejoin="round" />
        <Path d="M-4.5 9.5 Q0 6.5 4.5 9.5 Q0 12.5 -4.5 9.5 Z" fill={colors.coral} />
      </G>
    )
  return (
    <G>
      {brows}
      {eyes}
      <Ellipse cx={-22} cy={3} rx={6.2} ry={3.8} fill={colors.coral} opacity={0.45} />
      <Ellipse cx={22} cy={3} rx={6.2} ry={3.8} fill={colors.coral} opacity={0.45} />
      {mouth}
    </G>
  )
}

function Pose({ pose }: { pose: KoviPose }) {
  const standLegs = (
    <>
      <Limb d="M-13 33 L-15 52" />
      <Limb d="M13 33 L15 52" />
      <Shoe x={-18} y={57} flip />
      <Shoe x={18} y={57} />
    </>
  )
  let arms: ReactNode = null
  let legs: ReactNode = standLegs
  let front: ReactNode = null
  let mood: 'happy' | 'joy' | 'calm' | 'asleep' | 'worried' = 'happy'

  switch (pose) {
    case 'wave':
      arms = (
        <>
          <Limb d="M-38 4 C-50 12 -52 24 -46 32" />
          <Limb d="M38 2 C52 -4 56 -22 52 -38" />
        </>
      )
      front = (
        <>
          <Glove x={-45} y={36} rot={200} />
          <Glove x={52} y={-44} rot={10} open />
          <Path d="M66 -58 q5 5 3 12 M72 -48 q4 4 2 9" fill="none" stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
        </>
      )
      break
    case 'cheer':
      mood = 'joy'
      arms = (
        <>
          <Limb d="M-37 -2 C-50 -14 -52 -36 -46 -52" />
          <Limb d="M37 -2 C50 -14 52 -36 46 -52" />
        </>
      )
      front = (
        <>
          <Glove x={-45} y={-58} rot={-15} open />
          <Glove x={45} y={-58} rot={15} open />
        </>
      )
      break
    case 'catch':
      mood = 'joy'
      arms = (
        <>
          <Limb d="M-38 2 C-54 0 -64 -8 -66 -20" />
          <Limb d="M38 2 C54 0 64 -8 66 -20" />
        </>
      )
      front = (
        <>
          <Glove x={-66} y={-26} rot={-30} open />
          <Glove x={66} y={-26} rot={30} open />
        </>
      )
      break
    case 'key':
      mood = 'calm'
      arms = (
        <>
          <Limb d="M-38 4 C-50 12 -52 24 -46 32" />
          <Limb d="M38 4 C52 4 58 -4 60 -14" />
        </>
      )
      front = (
        <>
          <G transform="translate(70 -38) rotate(-30)">
            <Circle cx={0} cy={0} r={11} fill={gold} stroke={ink} strokeWidth={2.8} />
            <Circle cx={0} cy={0} r={4} fill={colors.teal} stroke={ink} strokeWidth={2} />
            <Path d="M0 11 L0 36 M0 26 L7 26 M0 32 L6 32" fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
          </G>
          <Glove x={-45} y={36} rot={200} />
          <Glove x={61} y={-20} rot={-20} />
        </>
      )
      break
    case 'oops':
      mood = 'worried'
      arms = (
        <>
          <Limb d="M36 -6 C48 -22 42 -42 28 -46" />
          <Limb d="M-38 6 C-52 10 -60 4 -62 -6" />
        </>
      )
      front = (
        <>
          <Glove x={24} y={-48} rot={-80} />
          <Glove x={-62} y={-12} rot={-40} open />
          <Path d="M50 -30 q-5 8 0 11 q5 -3 0 -11 Z" fill={colors.tealSoft} stroke={ink} strokeWidth={1.8} strokeLinejoin="round" />
        </>
      )
      break
    case 'sleep':
      mood = 'asleep'
      legs = (
        <>
          <Limb d="M-12 32 L-26 42" />
          <Limb d="M12 32 L26 42" />
          <Shoe x={-31} y={46} flip rot={-10} />
          <Shoe x={31} y={46} rot={10} />
        </>
      )
      arms = (
        <>
          <Limb d="M-38 10 C-42 26 -32 34 -20 34" />
          <Limb d="M38 10 C42 26 32 34 20 34" />
        </>
      )
      front = (
        <>
          <Glove x={-15} y={34} rot={100} />
          <Glove x={15} y={34} rot={-100} />
          <SvgText x={40} y={-50} fontFamily={fonts.bold} fontSize={16} fill={ink}>
            z
          </SvgText>
          <SvgText x={52} y={-66} fontFamily={fonts.bold} fontSize={22} fill={ink}>
            z
          </SvgText>
        </>
      )
      break
    case 'ride':
      mood = 'joy'
      legs = (
        <>
          <Limb d="M-8 32 Q0 44 12 44" />
          <Limb d="M10 30 Q20 38 30 38" />
          <Shoe x={18} y={44} />
          <Shoe x={36} y={37} />
        </>
      )
      arms = (
        <>
          <Limb d="M-37 0 C-48 -10 -50 -22 -46 -34" />
          <Limb d="M38 4 C52 6 60 0 66 -6" />
        </>
      )
      front = (
        <>
          <Glove x={-45} y={-40} rot={-10} open />
          <Glove x={70} y={-9} rot={70} />
        </>
      )
      break
  }

  return (
    <G>
      {legs}
      {arms}
      <Body />
      <Face mood={mood} />
      {front}
    </G>
  )
}

/** Kovi in a square box of `size` points. */
export function Kovi({ pose = 'wave', size = 120 }: { pose?: KoviPose; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="-90 -90 180 180">
      <Pose pose={pose} />
    </Svg>
  )
}

/** Where Kovi's soles sit, as a fraction of his box from the top: used to stand him on things. */
export const koviFeet = (62 + 90) / 180

/**
 * Kovi peeking over an edge: the top of his coin and his gloves gripping the line. The box is
 * `width` wide and half as tall; the edge he grips is its bottom.
 */
export function KoviPeek({ width = 130 }: { width?: number }) {
  return (
    <Svg width={width} height={width / 2} viewBox="-64 -64 128 64">
      <Defs>
        <ClipPath id="above">
          <Rect x={-64} y={-64} width={128} height={62} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#above)">
        <G transform="translate(0 -4) scale(0.9)">
          <Body />
          <Face mood="happy" />
        </G>
      </G>
      <Glove x={-24} y={-4} rot={180} />
      <Glove x={24} y={-4} rot={180} />
    </Svg>
  )
}

/** A minimal paper-cut floor: a disc with a thin edge and a soft shadow where Kovi stands. */
export function Floor({ width = 180, top = colors.surface, side = colors.sunken }: { width?: number; top?: string; side?: string }) {
  const h = width * 0.2
  const rx = width / 2 - 3
  const ry = h / 2 - 5
  return (
    <Svg width={width} height={h} viewBox={`${-width / 2} ${-h / 2} ${width} ${h}`}>
      <Path
        d={`M${-rx} -2 A${rx} ${ry} 0 0 0 ${rx} -2 L${rx} 4 A${rx} ${ry} 0 0 1 ${-rx} 4 Z`}
        fill={side}
        stroke={ink}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <Ellipse cx={0} cy={-2} rx={rx} ry={ry} fill={top} stroke={ink} strokeWidth={2.4} />
      <Ellipse cx={0} cy={-3} rx={rx * 0.34} ry={ry * 0.42} fill={ink} opacity={0.12} />
    </Svg>
  )
}
