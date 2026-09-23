import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { colors } from '@/lib/theme'

/** Line icons on a 24px grid, drawn to match the illustrations' rounded ink stroke. */
const glyphs = {
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  back: ['M14.5 5.5L8 12l6.5 6.5'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  bell: ['M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z', 'M10 20a2 2 0 0 0 4 0'],
  send: ['M4 12l16-8-6 16-3-6z', 'M11 14l9-10'],
  scan: [
    'M4 8V6a2 2 0 0 1 2-2h2',
    'M16 4h2a2 2 0 0 1 2 2v2',
    'M20 16v2a2 2 0 0 1-2 2h-2',
    'M8 20H6a2 2 0 0 1-2-2v-2',
    'M7 12h10',
  ],
  receive: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
  request: ['M12 20V9', 'M7 14l5-5 5 5', 'M5 4h14'],
  plus: ['M12 5v14', 'M5 12h14'],
  home: ['M4 11l8-7 8 7v9H4z'],
  clock: ['M12 8v4l3 2'],
  user: ['M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6'],
  face: [
    'M4 8V6a2 2 0 0 1 2-2h2',
    'M16 4h2a2 2 0 0 1 2 2v2',
    'M20 16v2a2 2 0 0 1-2 2h-2',
    'M8 20H6a2 2 0 0 1-2-2v-2',
    'M9 9.5v1',
    'M15 9.5v1',
    'M9 15c1.8 1.4 4.2 1.4 6 0',
  ],
  lock: ['M8 11V8a4 4 0 0 1 8 0v3'],
  tap: ['M8.5 8.5a5 5 0 0 1 0 7', 'M11.5 6a8.5 8.5 0 0 1 0 12', 'M14.5 3.5a12 12 0 0 1 0 17'],
  del: ['M9 6h11v12H9l-5-6z', 'M12.5 9.5l5 5', 'M17.5 9.5l-5 5'],
  info: ['M12 11v5', 'M12 8h.01'],
  print: ['M7 9V4h10v5', 'M7 14h10v6H7z'],
  copy: ['M9 9h10v10H9z', 'M5 15V5h10'],
  share: ['M12 15V4', 'M8 8l4-4 4 4', 'M5 12v7h14v-7'],
  pen: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  snow: ['M12 3v18', 'M4.2 7.5l15.6 9', 'M19.8 7.5l-15.6 9'],
  card: ['M3 10h18'],
  terminal: ['M7 3h10v18H7z', 'M10 17h4'],
  chart: ['M5 19V11', 'M12 19V5', 'M19 19v-6'],
  swap: ['M7 7h12', 'M15 3l4 4-4 4', 'M17 17H5', 'M9 13l-4 4 4 4'],
  eye: ['M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z'],
  eyeOff: ['M4 4l16 16', 'M9.9 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 3.9', 'M6.3 7.4C3.9 9.2 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.5 0 2.9-.4 4.1-1'],
  down: ['M12 5v14', 'M6 13l6 6 6-6'],
} as const

export type IconName = keyof typeof glyphs

export function Icon({
  name,
  size = 22,
  color = colors.ink,
  strokeWidth = 2,
}: {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
}) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'clock' || name === 'info' ? <Circle cx={12} cy={12} r={8.5} {...common} /> : null}
      {name === 'user' ? <Circle cx={12} cy={8} r={4} {...common} /> : null}
      {name === 'eye' ? <Circle cx={12} cy={12} r={3} {...common} /> : null}
      {name === 'lock' ? <Rect x={5} y={11} width={14} height={9} rx={2.5} {...common} /> : null}
      {name === 'card' ? <Rect x={3} y={6} width={18} height={12} rx={3} {...common} /> : null}
      {name === 'print' ? <Rect x={4} y={9} width={16} height={7} rx={2} {...common} /> : null}
      {glyphs[name].map((d) => (
        <Path key={d} d={d} {...common} />
      ))}
    </Svg>
  )
}
