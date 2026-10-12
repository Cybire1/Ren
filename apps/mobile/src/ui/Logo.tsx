/**
 * The Ren logo: the R coin, a capital R whose bowl is a coin, and the "Ren" wordmark it begins.
 * The coin sits on a hard ink shadow, like everything you can press in Ren. The tap mark (a stem
 * and three waves) stays as the tap-to-pay symbol on Pay, not as the logo.
 *
 * Geometry matches docs/brand/*.svg: the mark on a 200×200 canvas, the wordmark on 212×94.
 */
import Svg, { Circle, G, Path } from 'react-native-svg'
import { colors } from '@/lib/theme'

export const STEM = 'M62 46 V154'
/** The three tap waves, on a 200×200 canvas. */
export const WAVES = [
  'M92.6 74.3 A40 40 0 0 1 92.6 125.7',
  'M115.6 55 A70 70 0 0 1 115.6 145',
  'M138.6 35.7 A100 100 0 0 1 138.6 164.3',
]

/** The R coin's shine, on the wordmark's grid. */
const SHINE = 'M40.8 20.5 A17 17 0 0 1 50.4 29.3'

/** The R coin. On ink, pass `ink={colors.white}` and a darker `shadow`. */
export function LogoMark({ size = 64, ink = colors.ink, shadow = colors.ink }: { size?: number; ink?: string; shadow?: string }) {
  const weight = size >= 40 ? 19 : 21
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityLabel="Ren">
      <G transform="translate(55.1 24.5) scale(1.36)">
        <Circle cx={35} cy={40} r={25} fill={shadow} />
        <Circle cx={35} cy={36.5} r={25} fill={colors.coral} stroke={ink} strokeWidth={5} />
        {size >= 40 ? <Path d={SHINE} fill="none" stroke={colors.white} strokeWidth={4.5} strokeLinecap="round" /> : null}
        <Path d="M10 19 V92" stroke={ink} strokeWidth={weight} strokeLinecap="round" fill="none" />
        <Path d="M34 62 L56 92" stroke={ink} strokeWidth={weight} strokeLinecap="round" fill="none" />
      </G>
    </Svg>
  )
}

/** "Ren": the R coin as its capital, then e and n in the same stroke. `height` is the full height. */
export function Wordmark({ height = 28, ink = colors.ink, shadow = colors.ink }: { height?: number; ink?: string; shadow?: string }) {
  const line = { stroke: ink, strokeWidth: 15.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  return (
    <Svg width={(height * 212) / 94} height={height} viewBox="0 8 212 94" accessibilityLabel="Ren">
      <Circle cx={35} cy={40} r={25} fill={shadow} />
      <Circle cx={35} cy={36.5} r={25} fill={colors.coral} stroke={ink} strokeWidth={4} />
      <Path d={SHINE} fill="none" stroke={colors.white} strokeWidth={4} strokeLinecap="round" />
      <Path d="M10 19 V92" {...line} />
      <Path d="M34 62 L56 92" {...line} />
      <Path d="M80 66 H132 A26 26 0 1 0 124.4 84.4" {...line} />
      <Path d="M158 40 V92" {...line} />
      <Path d="M158 64 A22 22 0 0 1 202 64 V92" {...line} />
    </Svg>
  )
}

/** The tap-to-pay symbol: a stem and three waves. On ink, pass `stem={colors.white}`. */
export function TapMark({ size = 24, stem = colors.ink, wave = colors.coral }: { size?: number; stem?: string; wave?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={STEM} stroke={stem} strokeWidth={19} strokeLinecap="round" />
      {WAVES.map((d) => (
        <Path key={d} d={d} stroke={wave} strokeWidth={17} strokeLinecap="round" fill="none" />
      ))}
    </Svg>
  )
}
