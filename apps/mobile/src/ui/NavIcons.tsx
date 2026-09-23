import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { colors } from '@/lib/theme'

/**
 * Kova's own tab icons. Each one tells part of the money story: home has a coin for a door,
 * the card shows its chip and tap waves, activity is a receipt, and you are a person with a
 * coin for a head. Inactive they are quiet outlines; active, their key part fills with colour.
 */
export type NavIconName = 'home' | 'card' | 'activity' | 'profile' | 'pay'

export function NavIcon({
  name,
  active,
  size = 24,
  color,
}: {
  name: NavIconName
  active?: boolean
  size?: number
  color: string
}) {
  const line = {
    stroke: color,
    strokeWidth: active ? 2 : 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  const fill = (accent: string) => (active ? accent : 'none')

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' ? (
        <>
          <Path d="M3.8 10.4 12 3.8l8.2 6.6v8.4a1.7 1.7 0 0 1-1.7 1.7h-13a1.7 1.7 0 0 1-1.7-1.7z" fill={fill(colors.tealLight)} {...line} />
          <Circle cx={12} cy={15.2} r={3} fill={fill(colors.yellow)} {...line} />
          <Path d="M12 13.9v2.6" {...line} strokeWidth={1.4} />
        </>
      ) : null}
      {name === 'card' ? (
        <>
          <Rect x={2.8} y={5.8} width={18.4} height={12.4} rx={2.8} fill={fill(colors.tealLight)} {...line} />
          <Rect x={5.8} y={9.4} width={4.4} height={3.4} rx={0.9} fill={fill(colors.yellow)} {...line} strokeWidth={1.5} />
          <Path d="M14.6 10.2a2.4 2.4 0 0 1 0 3.2M17 8.8a4.6 4.6 0 0 1 0 6" fill="none" {...line} strokeWidth={1.5} />
        </>
      ) : null}
      {name === 'activity' ? (
        <>
          <Path
            d="M5.5 3.2h13v17.4l-2.2-1.6-2.1 1.6-2.2-1.6-2.2 1.6-2.1-1.6-2.2 1.6z"
            fill={fill(colors.coralSoft)}
            {...line}
          />
          <Path d="M8.6 8h6.8M8.6 11.4h6.8M8.6 14.8h3.6" fill="none" {...line} strokeWidth={1.5} />
        </>
      ) : null}
      {name === 'profile' ? (
        <>
          <Path d="M4.6 20.4c.9-3.9 3.9-6 7.4-6s6.5 2.1 7.4 6" fill={fill(colors.coralSoft)} {...line} />
          <Circle cx={12} cy={8.4} r={4.2} fill={fill(colors.yellow)} {...line} />
          {active ? <Circle cx={12} cy={8.4} r={2.6} fill="none" {...line} strokeWidth={1} strokeDasharray="0.6 1.6" /> : null}
        </>
      ) : null}
      {name === 'pay' ? (
        <>
          <Path
            d="M4 8.2V6.2a2.2 2.2 0 0 1 2.2-2.2h2M15.8 4h2a2.2 2.2 0 0 1 2.2 2.2v2M20 15.8v2a2.2 2.2 0 0 1-2.2 2.2h-2M8.2 20h-2A2.2 2.2 0 0 1 4 17.8v-2"
            fill="none"
            {...line}
            strokeWidth={2.1}
          />
          <Circle cx={12} cy={12} r={3.2} fill={colors.white} />
        </>
      ) : null}
    </Svg>
  )
}
