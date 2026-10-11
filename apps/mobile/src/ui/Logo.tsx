/**
 * The Ren logo: an ink stem and three coral contactless waves, a tap to pay. One stem and three arcs on one centre, all in one rounded stroke. The wordmark is
 * drawn in the same stroke, and its e is a coin.
 *
 * Geometry matches docs/design/logo/*.svg (a 200×200 canvas, waves centred on 62,100).
 */
import Svg, { Circle, Path } from 'react-native-svg'
import { colors } from '@/lib/theme'

const STEM = 'M62 46 V154'
const WAVES = [
  'M92.6 74.3 A40 40 0 0 1 92.6 125.7',
  'M115.6 55 A70 70 0 0 1 115.6 145',
  'M138.6 35.7 A100 100 0 0 1 138.6 164.3',
]

/** The mark. On ink, pass `stem={colors.surface}`. */
export function LogoMark({
  size = 64,
  stem = colors.ink,
  wave = colors.coral,
}: {
  size?: number
  stem?: string
  wave?: string
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityLabel="Ren">
      <Path d={STEM} stroke={stem} strokeWidth={19} strokeLinecap="round" />
      {WAVES.map((d) => (
        <Path key={d} d={d} stroke={wave} strokeWidth={17} strokeLinecap="round" fill="none" />
      ))}
    </Svg>
  )
}

/** The wordmark, drawn in the mark's stroke; its e is a coin. `height` is the full height. */
export function Wordmark({ height = 28, ink = colors.ink, coin = colors.coral }: { height?: number; ink?: string; coin?: string }) {
  const w = 15.5
  const line = { stroke: ink, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  return (
    <Svg width={(height * 184) / 78} height={height} viewBox="0 27 184 78" accessibilityLabel="Ren">
      <Path d="M8 40 V92" {...line} />
      <Path d="M8 66 Q8 40 40 41" {...line} />
      <Circle cx={80} cy={66} r={26} fill={coin} />
      <Path d="M54 66 H106 A26 26 0 1 0 98.4 84.4" {...line} />
      <Path d="M132 40 V92" {...line} />
      <Path d="M132 64 A22 22 0 0 1 176 64 V92" {...line} />
    </Svg>
  )
}
