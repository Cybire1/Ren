import * as Haptics from 'expo-haptics'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatUsd } from '@/lib/money'
import { colors } from '@/lib/theme'
import { type Entry, useWallet } from '@/lib/wallet'
import { Kovi } from '@/ui/art'
import { dockClearance } from '@/ui/Dock'
import { EntryRow } from '@/ui/EntryRow'
import { Txt } from '@/ui/primitives'

const filters = [
  { key: 'all', label: 'All' },
  { key: 'out', label: 'Money out' },
  { key: 'in', label: 'Money in' },
] as const
type Filter = (typeof filters)[number]['key']

const incoming = (e: Entry) => e.kind === 'received' || e.kind === 'added'
const DAY = 86_400_000

function dayLabel(at: number) {
  const d = new Date(at)
  if (d.toDateString() === new Date().toDateString()) return 'Today'
  if (d.toDateString() === new Date(Date.now() - DAY).toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Compact dollars for spoken chart labels: $1.2k, $3.4M. */
function short(base: bigint) {
  const n = Number(base) / 1e6
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
  return `$${n.toFixed(2)}`
}

/**
 * Everything that moved. The month opens as a single card: the net, the split between money
 * in and out, and the last seven days as bars. Below, each day is its own card with its own
 * total, so a busy week still reads at a glance.
 */
export default function Activity() {
  const { activity } = useWallet()
  const insets = useSafeAreaInsets()
  const [filter, setFilter] = useState<Filter>('all')

  const month = useMemo(() => {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    let out = 0n
    let got = 0n
    for (const e of activity) {
      if (e.at < start.getTime()) continue
      if (incoming(e)) got += BigInt(e.amount)
      else out += BigInt(e.amount)
    }
    return { out, got, net: got - out, name: start.toLocaleDateString([], { month: 'long' }) }
  }, [activity])

  const week = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days = Array.from({ length: 7 }, (_, i) => {
      const start = today.getTime() - (6 - i) * DAY
      let got = 0n
      let out = 0n
      for (const e of activity) {
        if (e.at < start || e.at >= start + DAY) continue
        if (incoming(e)) got += BigInt(e.amount)
        else out += BigInt(e.amount)
      }
      return { start, got, out, label: new Date(start).toLocaleDateString([], { weekday: 'narrow' }) }
    })
    const max = days.reduce((m, d) => (d.got + d.out > m ? d.got + d.out : m), 0n)
    return { days, max }
  }, [activity])

  const groups = useMemo(() => {
    const shown = activity.filter((e) => (filter === 'all' ? true : filter === 'in' ? incoming(e) : !incoming(e)))
    const map = new Map<string, Entry[]>()
    for (const e of shown) map.set(dayLabel(e.at), [...(map.get(dayLabel(e.at)) ?? []), e])
    return [...map.entries()].map(([title, entries]) => ({
      title,
      entries,
      net: entries.reduce((sum, e) => sum + (incoming(e) ? BigInt(e.amount) : -BigInt(e.amount)), 0n),
    }))
  }, [activity, filter])

  const total = month.got + month.out
  const inShare = total > 0n ? Number((month.got * 1000n) / total) / 1000 : 0.5

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: dockClearance + insets.bottom }}
    >
      <Txt weight="bold" size={32} style={{ letterSpacing: -1 }}>
        Activity
      </Txt>

      {/* The month */}
      <View style={styles.month}>
        <Txt weight="medium" size={14} color={colors.onInk}>
          {month.name}, net
        </Txt>
        <Txt
          weight="bold"
          size={40}
          color={month.net < 0n ? colors.coralSoft : colors.white}
          style={{ letterSpacing: -1.4 }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatUsd(month.net, { sign: true })}
        </Txt>

        <View style={styles.split}>
          <View style={[styles.splitIn, { flex: Math.max(inShare, 0.02) }]} />
          <View style={[styles.splitOut, { flex: Math.max(1 - inShare, 0.02) }]} />
        </View>
        <View style={styles.legend}>
          <Legend color={colors.tealLight} label="In" value={formatUsd(month.got)} />
          <Legend color={colors.coral} label="Out" value={formatUsd(month.out)} align="right" />
        </View>

        <View style={styles.rule} />
        <Txt weight="medium" size={13} color={colors.onInk}>
          Last 7 days
        </Txt>
        <View style={styles.bars}>
          {week.days.map((d, i) => {
            const scale = week.max > 0n ? 88 / Number(week.max) : 0
            const hIn = Math.max(Number(d.got) * scale, d.got > 0n ? 4 : 0)
            const hOut = Math.max(Number(d.out) * scale, d.out > 0n ? 4 : 0)
            const today = i === 6
            return (
              <View key={d.start} style={styles.barCol} accessibilityLabel={`${d.label}: in ${short(d.got)}, out ${short(d.out)}`}>
                <View style={styles.barTrack}>
                  {hOut > 0 ? <View style={[styles.bar, { height: hOut, backgroundColor: colors.coral }]} /> : null}
                  {hIn > 0 ? <View style={[styles.bar, { height: hIn, backgroundColor: colors.tealLight }]} /> : null}
                  {hIn === 0 && hOut === 0 ? <View style={styles.barEmpty} /> : null}
                </View>
                <Txt weight={today ? 'bold' : 'medium'} size={12} color={today ? colors.white : colors.onInk}>
                  {d.label}
                </Txt>
              </View>
            )
          })}
        </View>
      </View>

      <FilterSwitch value={filter} onChange={setFilter} />

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Kovi pose="wave" size={130} />
          <Txt weight="semi" size={20} style={{ marginTop: 8 }}>
            {activity.length === 0 ? 'Nothing here yet' : 'Nothing in this view'}
          </Txt>
          <Txt size={15} color={colors.muted} style={{ textAlign: 'center', marginTop: 4, lineHeight: 22 }}>
            {activity.length === 0 ? 'Pay a shop or send money to a friend and it shows up here.' : 'Try another filter.'}
          </Txt>
        </View>
      ) : (
        groups.map((g) => (
          <View key={g.title} style={{ marginTop: 20 }}>
            <View style={styles.dayHead}>
              <Txt weight="semi" size={14} color={colors.muted}>
                {g.title}
              </Txt>
              <Txt weight="semi" size={14} color={g.net >= 0n ? colors.positive : colors.muted}>
                {formatUsd(g.net, { sign: true })}
              </Txt>
            </View>
            <View style={styles.day}>
              {g.entries.map((e, i) => (
                <View key={e.id} style={[styles.dayRow, i < g.entries.length - 1 && styles.dayRule]}>
                  <EntryRow entry={e} />
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  )
}

function Legend({ color, label, value, align }: { color: string; label: string; value: string; align?: 'right' }) {
  return (
    <View style={{ alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Txt size={12} color={colors.onInk}>
          {label}
        </Txt>
      </View>
      <Txt weight="semi" size={16} color={colors.white}>
        {value}
      </Txt>
    </View>
  )
}

/** All / Money out / Money in, with a thumb that slides to the choice. */
function FilterSwitch({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  const [w, setW] = useState(0)
  const index = filters.findIndex((f) => f.key === value)
  const x = useSharedValue(index)
  useEffect(() => {
    x.value = withTiming(index, { duration: 280, easing: Easing.bezier(0.32, 0.72, 0, 1) })
  }, [index, x])
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: (x.value * w) / filters.length }] }))
  return (
    <View style={styles.filter} onLayout={(e) => setW(e.nativeEvent.layout.width - 10)} accessibilityRole="tablist">
      <Animated.View style={[styles.filterThumb, { width: w / filters.length }, thumb]} />
      {filters.map((f) => {
        const on = f.key === value
        return (
          <Pressable
            key={f.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              void Haptics.selectionAsync()
              onChange(f.key)
            }}
            style={styles.filterItem}
          >
            <Txt weight="semi" size={14} color={on ? colors.white : colors.ink}>
              {f.label}
            </Txt>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  month: { marginTop: 16, borderRadius: 28, backgroundColor: colors.ink, padding: 18 },
  split: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 3, marginTop: 14 },
  splitIn: { backgroundColor: colors.tealLight, borderRadius: 6 },
  splitOut: { backgroundColor: colors.coral, borderRadius: 6 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  rule: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 16 },
  bars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, height: 112 },
  barCol: { alignItems: 'center', gap: 6, flex: 1 },
  barTrack: { height: 90, justifyContent: 'flex-end', alignItems: 'center', gap: 2 },
  bar: { width: 16, borderRadius: 5 },
  barEmpty: { width: 16, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)' },
  filter: {
    marginTop: 16,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    padding: 3,
  },
  filterThumb: { position: 'absolute', left: 3, top: 3, bottom: 3, borderRadius: 20, backgroundColor: colors.ink },
  filterItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  day: { borderRadius: 22, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, paddingHorizontal: 14 },
  dayRow: { paddingVertical: 2 },
  dayRule: { borderBottomWidth: 1, borderColor: colors.sunken },
  empty: { alignItems: 'center', paddingTop: 36, paddingHorizontal: 20 },
})
