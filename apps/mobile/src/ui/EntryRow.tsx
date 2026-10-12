import { router } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { formatUsd } from '@/lib/money'
import { colors } from '@/lib/theme'
import { Icon } from './Icon'
import type { Entry } from '@/lib/wallet'
import { AddBadge, Avatar, ShopBadge } from './art'
import { Landing } from './motion'
import { Txt } from './primitives'

export function when(at: number): string {
  const d = new Date(at)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return time
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

const verbs = { paid: 'Paid', sent: 'Sent', received: 'Received', added: 'Added' } as const

/**
 * One line of money: who, what, when, and how much, signed by direction. `inset` pads it for a
 * card; `fresh` drops it in with a mint glow, for money that has only just landed.
 */
export function EntryRow({ entry, inset, fresh }: { entry: Entry; inset?: boolean; fresh?: boolean }) {
  const incoming = entry.kind === 'received' || entry.kind === 'added'
  return (
    <Landing active={!!fresh} delay={1800} rest={inset ? colors.card : 'rgba(255,255,255,0)'}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${verbs[entry.kind]} ${formatUsd(BigInt(entry.amount))}, ${entry.name}`}
        onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: entry.id } })}
        style={({ pressed }) => [styles.row, inset && styles.inset, pressed && { opacity: 0.6 }]}
      >
        {entry.kind === 'paid' ? (
          <ShopBadge size={38} />
        ) : entry.kind === 'added' ? (
          <AddBadge size={38} />
        ) : (
          <Avatar name={entry.name} id={entry.address} size={38} />
        )}
        <View style={{ flex: 1 }}>
          <Txt weight="semi" size={16} numberOfLines={1}>
            {entry.name}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {entry.private ? <Icon name="lock" size={12} color={colors.muted} /> : null}
            <Txt size={13} color={colors.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
              {entry.detail}, {when(entry.at)}
            </Txt>
          </View>
        </View>
        <Txt weight={inset ? 'heavy' : 'semi'} size={16} color={incoming ? colors.positive : colors.ink}>
          {signed(entry)}
        </Txt>
      </Pressable>
    </Landing>
  )
}

export function signed(entry: Entry) {
  const amount = BigInt(entry.amount)
  return entry.kind === 'received' || entry.kind === 'added' ? formatUsd(amount, { sign: true }) : formatUsd(-amount)
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  inset: { paddingVertical: 10, paddingLeft: 10, paddingRight: 14 },
})
