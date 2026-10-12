import { useEffect } from 'react'
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { colors, type fonts } from '@/lib/theme'
import { Txt } from './primitives'

const FIGURES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

type Weight = keyof typeof fonts

/**
 * Whole dollars that roll into place like the counter on a till: one column of figures per
 * digit, each rolling to its figure, the leftmost first. When the amount changes, each column
 * rolls from the figure it showed. Screen readers hear `label` once; the columns are hidden.
 */
export function Odometer({
  value,
  size,
  label,
  color = colors.ink,
  weight = 'heavy',
  delay = 150,
  style,
}: {
  /** Digits and separators, e.g. "1,284". */
  value: string
  size: number
  label: string
  color?: string
  weight?: Weight
  delay?: number
  style?: StyleProp<ViewStyle>
}) {
  const line = Math.round(size * 1.16)
  // Keyed from the right, so a column keeps its place (and rolls) when the amount gains a digit.
  const chars = value.split('')
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={label} style={[styles.row, style]}>
      {chars.map((ch, i) => {
        const key = chars.length - i
        return /\d/.test(ch) ? (
          <Column key={key} figure={Number(ch)} order={i} size={size} line={line} color={color} weight={weight} delay={delay} />
        ) : (
          <Txt
            key={key}
            weight={weight}
            size={size}
            color={color}
            style={{ lineHeight: line, height: line, marginRight: -size * 0.02 }}
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            {ch}
          </Txt>
        )
      })}
    </View>
  )
}

function Column({
  figure,
  order,
  size,
  line,
  color,
  weight,
  delay,
}: {
  figure: number
  order: number
  size: number
  line: number
  color: string
  weight: Weight
  delay: number
}) {
  const reduced = useReducedMotion()
  const y = useSharedValue(reduced ? -figure * line : 0)
  useEffect(() => {
    if (reduced) {
      y.value = -figure * line
      return
    }
    y.value = withDelay(delay + order * 90, withTiming(-figure * line, { duration: 1150, easing: Easing.out(Easing.exp) }))
  }, [figure, line, order, delay, reduced, y])
  const strip = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }))
  return (
    <View
      style={{ height: line, overflow: 'hidden', marginRight: -size * 0.035 }}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Animated.View style={strip}>
        {FIGURES.map((f) => (
          <Txt key={f} weight={weight} size={size} color={color} style={{ height: line, lineHeight: line }}>
            {f}
          </Txt>
        ))}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
})
