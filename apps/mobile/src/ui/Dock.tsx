import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { colors } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import Animated from './animated'
import { Avatar } from './art'
import { NavIcon, type NavIconName } from './NavIcons'
import { Txt } from './primitives'

const tabs: Record<string, { label: string; icon: NavIconName }> = {
  index: { label: 'Home', icon: 'home' },
  card: { label: 'Card', icon: 'card' },
  activity: { label: 'Activity', icon: 'activity' },
  profile: { label: 'You', icon: 'profile' },
}

/** The bar's height, its side margin, and its corner. */
const H = 64
const SIDE = 16
const CORNER = 26
/** Pay's coin, and the slot cut for it: a ring of air between the two. */
const COIN = 60
const NOTCH = COIN / 2 + 8
/** The fillet where the bar's top edge turns down into the slot. */
const FILLET = 9
/** The light that marks where you are. */
const LIGHT_W = 18

/**
 * The bar, drawn as one shape: a rounded slab with a coin-shaped slot cut into the middle of its
 * top edge, softened where the edge turns down into it, so Pay's coin sits in it like a coin in a
 * till's tray.
 */
function slabPath(w: number) {
  const cx = w / 2
  const r = NOTCH
  const f = FILLET
  // The fillet circle touches the top edge and the slot's circle from outside.
  const reach = Math.sqrt((r + f) ** 2 - f ** 2)
  const tx = (reach * r) / (r + f)
  const ty = (f * r) / (r + f)
  return [
    `M ${CORNER} 0`,
    `L ${cx - reach} 0`,
    `A ${f} ${f} 0 0 1 ${cx - tx} ${ty}`,
    `A ${r} ${r} 0 0 0 ${cx + tx} ${ty}`,
    `A ${f} ${f} 0 0 1 ${cx + reach} 0`,
    `L ${w - CORNER} 0`,
    `A ${CORNER} ${CORNER} 0 0 1 ${w} ${CORNER}`,
    `L ${w} ${H - CORNER}`,
    `A ${CORNER} ${CORNER} 0 0 1 ${w - CORNER} ${H}`,
    `L ${CORNER} ${H}`,
    `A ${CORNER} ${CORNER} 0 0 1 0 ${H - CORNER}`,
    `L 0 ${CORNER}`,
    `A ${CORNER} ${CORNER} 0 0 1 ${CORNER} 0`,
    'Z',
  ].join(' ')
}

/**
 * Ren's dock. A dark slab floats over the page with a slot cut in its top edge, and Pay is a
 * watermelon coin standing in the slot, half above the bar, one tap from anywhere: it breathes a
 * slow ring now and then, like the tap waves on a till. The four places (Home, Card, Activity,
 * You) are named under their icons, and a small light slides under the one you're on.
 */
export function Dock({ state, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { profile } = useWallet()
  const reduced = useReducedMotion()
  const bottom = Math.max(insets.bottom - 8, 14)
  const w = width - SIDE * 2
  // Two places either side of the coin, each in an equal slot.
  const slotW = (w - COIN - 24) / 4
  const slotX = (i: number) => (i < 2 ? i * slotW : w - (4 - i) * slotW)

  const routes = state.routes.filter((r) => tabs[r.name])
  const at = Math.max(
    0,
    routes.findIndex((r) => r.key === state.routes[state.index]?.key),
  )
  const light = useSharedValue(slotX(at) + slotW / 2 - LIGHT_W / 2)
  // biome-ignore lint/correctness/useExhaustiveDependencies: slotX follows slotW, which is listed
  useEffect(() => {
    const to = slotX(at) + slotW / 2 - LIGHT_W / 2
    light.value = reduced ? to : withSpring(to, { damping: 16, stiffness: 220, mass: 0.7 })
  }, [at, slotW, reduced, light])
  const lightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: light.value }] }))

  // The coin's breath: a ring that swells out and fades, every few seconds.
  const ring = useSharedValue(0)
  useEffect(() => {
    if (reduced) return
    ring.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
        withDelay(2600, withTiming(0, { duration: 0 })),
      ),
      -1,
    )
  }, [reduced, ring])
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - ring.value),
    transform: [{ scale: 1 + 0.32 * ring.value }],
  }))
  const press = useSharedValue(1)
  const coinStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }))

  const tab = (route: (typeof routes)[number], i: number) => {
    const meta = tabs[route.name]
    if (!meta) return null
    const focused = i === at
    const tint = focused ? colors.white : colors.onInk
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={meta.label}
        accessibilityState={{ selected: focused }}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!focused && !event.defaultPrevented) {
            void Haptics.selectionAsync()
            navigation.navigate(route.name)
          }
        }}
        style={({ pressed }) => [
          styles.slot,
          { left: slotX(i), width: slotW },
          pressed && { opacity: 0.7 },
        ]}
      >
        {meta.icon === 'profile' && profile ? (
          <View
            style={[
              styles.face,
              { borderColor: focused ? colors.white : 'rgba(255,255,255,0.35)' },
            ]}
          >
            <Avatar name={profile.name} id={profile.address} size={18} />
          </View>
        ) : (
          <NavIcon name={meta.icon} active={focused} size={24} color={tint} />
        )}
        <Txt weight={focused ? 'bold' : 'semi'} size={11} color={tint} style={styles.label}>
          {meta.label}
        </Txt>
      </Pressable>
    )
  }

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { top: undefined, height: H + bottom + 70 }]}
    >
      <Svg
        pointerEvents="none"
        width={width}
        height={H + bottom + 70}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.paper} stopOpacity={0} />
            <Stop offset="0.55" stopColor={colors.paper} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={H + bottom + 70} fill="url(#fade)" />
      </Svg>

      <View style={[styles.dock, { bottom, width: w }]} pointerEvents="box-none">
        <Svg width={w} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d={slabPath(w)} fill={colors.fill} />
        </Svg>
        {routes.map(tab)}
        <Animated.View pointerEvents="none" style={[styles.light, lightStyle]} />

        <View style={[styles.coinSpot, { left: w / 2 - COIN / 2 }]} pointerEvents="box-none">
          <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pay"
            accessibilityHint="Scan a code or tap a card"
            hitSlop={6}
            onPressIn={() => {
              press.value = withSpring(0.9, { damping: 14, stiffness: 420 })
            }}
            onPressOut={() => {
              press.value = withSpring(1, { damping: 12, stiffness: 300 })
            }}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              router.push('/scan')
            }}
          >
            <Animated.View style={[styles.coin, coinStyle]}>
              <View style={styles.coinFace}>
                <NavIcon name="pay" size={24} color={colors.white} />
              </View>
            </Animated.View>
          </Pressable>
          <Txt weight="bold" size={11} color={colors.white} style={styles.coinLabel}>
            Pay
          </Txt>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: SIDE, height: H },
  slot: {
    position: 'absolute',
    top: 0,
    height: H,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: { letterSpacing: 0.1 },
  /** You: your own face, ringed in white when you're there. */
  face: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  light: {
    position: 'absolute',
    left: 0,
    bottom: 7,
    width: LIGHT_W,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.coral,
  },
  coinSpot: {
    position: 'absolute',
    top: -COIN / 2,
    width: COIN,
    height: COIN + 32,
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    top: 0,
    width: COIN,
    height: COIN,
    borderRadius: COIN / 2,
    borderWidth: 2,
    borderColor: colors.coral,
  },
  coin: {
    width: COIN,
    height: COIN,
    borderRadius: COIN / 2,
    padding: 4,
    backgroundColor: colors.coralDeep,
  },
  coinFace: {
    flex: 1,
    borderRadius: COIN / 2,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinLabel: { marginTop: 7, letterSpacing: 0.1 },
})

/** Space to leave under scrolling content so the last row clears the dock and Pay's coin. */
export const dockClearance = H + 64
