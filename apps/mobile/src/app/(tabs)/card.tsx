import * as Haptics from 'expo-haptics'
import { type ReactNode, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Switch, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { confirmWithFace } from '@/lib/auth'
import { usePrefs } from '@/lib/prefs'
import { colors } from '@/lib/theme'
import { CardArt } from '@/ui/art'
import { dockClearance } from '@/ui/Dock'
import { Icon, type IconName } from '@/ui/Icon'
import { Snowfall } from '@/ui/motion'
import { Txt } from '@/ui/primitives'

const limits = [50, 200, 500, 1000]
const spring = { damping: 14, stiffness: 140 }

/**
 * The Kova Card. You can pick it up: it tilts under your finger and springs back. Freezing
 * frosts it over and lets the snow fall while Reni sleeps on top; unfreezing needs your face.
 * Below, the limit is a meter, not a menu, and the rest are two plain rows.
 */
export default function Card() {
  const { card, updateCard } = usePrefs()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const reduced = useReducedMotion()
  const cardW = width - 60

  // Tilt: the finger's travel becomes a 3D rotation, and a spring brings the card back.
  const rx = useSharedValue(0)
  const ry = useSharedValue(0)
  const tilt = Gesture.Pan()
    .enabled(!reduced)
    .onUpdate((e) => {
      ry.value = Math.max(-18, Math.min(18, e.translationX / 8))
      rx.value = Math.max(-14, Math.min(14, -e.translationY / 8))
    })
    .onEnd(() => {
      rx.value = withSpring(0, spring)
      ry.value = withSpring(0, spring)
    })
  const tilted = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateX: `${rx.value}deg` }, { rotateY: `${ry.value}deg` }],
  }))

  // The freeze switch's thumb slides between its two halves.
  const frozen = useSharedValue(card.frozen ? 1 : 0)
  useEffect(() => {
    frozen.value = withTiming(card.frozen ? 1 : 0, { duration: 320, easing: Easing.bezier(0.32, 0.72, 0, 1) })
  }, [card.frozen, frozen])
  const [trackW, setTrackW] = useState(0)
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: frozen.value * (trackW / 2) }] }))

  const setFrozen = async (next: boolean) => {
    if (next === card.frozen) return
    if (!next) {
      if (!(await confirmWithFace('Unfreeze your Ren Card'))) return
    }
    void Haptics.notificationAsync(next ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success)
    updateCard({ frozen: next })
  }

  // Card taps settle through a paired card; none are recorded on this phone yet.
  const spentToday = 0

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: card.frozen ? colors.sunken : colors.paper }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: dockClearance + insets.bottom }}
    >
      <View style={styles.head}>
        <Txt weight="bold" size={32} style={{ letterSpacing: -1 }}>
          Card
        </Txt>
        <View style={[styles.status, { backgroundColor: card.frozen ? colors.ink : colors.teal }]}>
          <Icon name={card.frozen ? 'snow' : 'tap'} size={14} color={colors.white} />
          <Txt weight="semi" size={13} color={colors.white}>
            {card.frozen ? 'Frozen' : 'Ready to tap'}
          </Txt>
        </View>
      </View>

      <GestureDetector gesture={tilt}>
        <Animated.View style={[styles.hero, tilted]}>
          <CardArt width={cardW} last4={card.last4} frozen={card.frozen} />
          {card.frozen ? <Snowfall width={cardW + 20} height={cardW * 0.82} /> : null}
        </Animated.View>
      </GestureDetector>
      <Txt size={13} color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
        {card.frozen ? 'Nobody can tap with it until you unfreeze it.' : 'Drag the card to tilt it.'}
      </Txt>

      <View style={styles.body}>
        <View style={styles.switch} onLayout={(e) => setTrackW(e.nativeEvent.layout.width - 12)} accessibilityRole="radiogroup" accessibilityLabel="Card status">
          <Animated.View style={[styles.thumb, { width: trackW / 2, backgroundColor: card.frozen ? colors.ink : colors.teal }, thumb]} />
          <Choice icon="tap" label="Active" on={!card.frozen} onPress={() => void setFrozen(false)} />
          <Choice icon="snow" label="Frozen" on={card.frozen} onPress={() => void setFrozen(true)} />
        </View>

        <View style={styles.section}>
          <View style={styles.limitHead}>
            <View>
              <Txt size={13} color={colors.muted}>
                Daily limit
              </Txt>
              <Txt weight="bold" size={28} style={{ letterSpacing: -0.8 }}>
                ${card.dailyLimit.toLocaleString('en-US')}
                <Txt size={15} color={colors.muted}>
                  {'  '}a day
                </Txt>
              </Txt>
            </View>
            <Txt size={13} color={colors.muted} style={{ textAlign: 'right' }}>
              ${spentToday} spent{'\n'}today
            </Txt>
          </View>
          <View style={styles.meter}>
            <View style={[styles.meterFill, { width: `${Math.max(2, (spentToday / card.dailyLimit) * 100)}%` }]} />
          </View>
          <View style={styles.ticks}>
            {limits.map((l) => {
              const on = l === card.dailyLimit
              return (
                <Pressable
                  key={l}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`$${l} a day`}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    updateCard({ dailyLimit: l })
                  }}
                  hitSlop={6}
                  style={[styles.tick, on && styles.tickOn]}
                >
                  <Txt weight="semi" size={14} color={on ? colors.white : colors.ink}>
                    ${l.toLocaleString('en-US')}
                  </Txt>
                </Pressable>
              )
            })}
          </View>
          <Txt size={12} color={colors.muted} style={{ marginTop: 10 }}>
            The most the card can spend in a day. Your phone can still pay more.
          </Txt>
        </View>

        <View style={[styles.section, { padding: 0 }]}>
          <Row icon="tap" tint={colors.tealSoft} label="Ren terminals only" value="Online checkouts can’t charge it">
            <Switch
              value={card.terminalsOnly}
              onValueChange={(v) => updateCard({ terminalsOnly: v })}
              trackColor={{ true: colors.teal, false: colors.sunken }}
              ios_backgroundColor={colors.sunken}
            />
          </Row>
          <Pressable accessibilityRole="button" onPress={() => void setFrozen(true)} style={({ pressed }) => pressed && { opacity: 0.7 }}>
            <Row icon="lock" tint={colors.coralSoft} label="Report lost" value="Freezes it straight away" last>
              <Icon name="arrow" size={20} />
            </Row>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

function Choice({ icon, label, on, onPress }: { icon: IconName; label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={onPress} style={styles.choice}>
      <Icon name={icon} size={18} color={on ? colors.white : colors.ink} />
      <Txt weight="semi" size={16} color={on ? colors.white : colors.ink}>
        {label}
      </Txt>
    </Pressable>
  )
}

function Row({
  icon,
  tint,
  label,
  value,
  last,
  children,
}: {
  icon: IconName
  tint: string
  label: string
  value: string
  last?: boolean
  children?: ReactNode
}) {
  return (
    <View style={[styles.row, !last && styles.rowRule]}>
      <View style={[styles.rowIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={19} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt weight="semi" size={16}>
          {label}
        </Txt>
        <Txt size={13} color={colors.muted} numberOfLines={1}>
          {value}
        </Txt>
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  status: { height: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  hero: { alignItems: 'center', marginTop: 18, paddingHorizontal: 20 },
  body: { paddingHorizontal: 20, marginTop: 18, gap: 14 },
  switch: {
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    padding: 4,
  },
  thumb: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 26 },
  choice: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  section: { borderRadius: 22, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, padding: 16, overflow: 'hidden' },
  limitHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  meter: { height: 10, borderRadius: 5, backgroundColor: colors.sunken, marginTop: 12, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 5, backgroundColor: colors.coral },
  ticks: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tick: { flex: 1, height: 38, borderRadius: 19, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowRule: { borderBottomWidth: 1, borderColor: colors.sunken },
  rowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
})
