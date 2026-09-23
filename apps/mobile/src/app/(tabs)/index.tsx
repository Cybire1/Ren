import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle } from 'react-native-svg'
import { isTestnet } from '@/lib/config'
import { colors } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { ActionTile } from '@/ui/ActionTile'
import { Avatar } from '@/ui/art'
import { BalanceCard } from '@/ui/BalanceCard'
import { dockClearance } from '@/ui/Dock'
import { EntryRow } from '@/ui/EntryRow'
import { Icon } from '@/ui/Icon'
import { RoundButton, Txt } from '@/ui/primitives'

/**
 * Home is for paying, but you should never have to look for your money. The balance opens the
 * screen on a solid teal card, since money at rest is teal across Kova; Pay sits right beneath it,
 * Send and Request beside Pay, and the people you pay are one tap away.
 */
export default function Home() {
  const { profile, balance, activity, contacts, refresh } = useWallet()
  const insets = useSafeAreaInsets()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  if (!profile) return null
  const empty = balance === 0n

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: dockClearance + insets.bottom, paddingHorizontal: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push('/(tabs)/profile')}>
          <Avatar name={profile.name} size={44} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt size={13} color={colors.muted}>
            Hello
          </Txt>
          <Txt weight="semi" size={18} style={{ letterSpacing: -0.3 }}>
            {profile.name.split(' ')[0]}
          </Txt>
        </View>
        <RoundButton icon="bell" label="Activity" size={40} onPress={() => router.push('/(tabs)/activity')} />
      </View>

      <BalanceCard balance={balance} currency={profile.currency} />

      <View style={styles.hero}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pay. Scan, tap or pay a link"
          onPress={() => router.push('/scan')}
          style={({ pressed }) => [styles.pay, pressed && { transform: [{ scale: 0.98 }] }]}
        >
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={[styles.payIcon, { backgroundColor: colors.coral }]}>
              <Icon name="scan" color={colors.white} />
            </View>
            <View style={[styles.payIcon, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
              <Icon name="tap" color={colors.white} />
            </View>
          </View>
          <Svg width={92} height={92} viewBox="-46 -46 92 92" style={styles.waves}>
            <Circle r={40} fill="none" stroke={colors.white} strokeOpacity={0.12} strokeWidth={2} />
            <Circle r={26} fill="none" stroke={colors.white} strokeOpacity={0.18} strokeWidth={2} />
            <Circle r={12} fill="none" stroke={colors.white} strokeOpacity={0.26} strokeWidth={2} />
          </Svg>
          <View>
            <Txt weight="bold" size={34} color={colors.white} style={{ letterSpacing: -1 }}>
              Pay
            </Txt>
            <Txt size={14} color={colors.onInk}>
              Scan, tap or pay a link
            </Txt>
          </View>
        </Pressable>
        <View style={{ flex: 1, gap: 12 }}>
          <ActionTile kind="send" onPress={() => router.push('/send')} />
          <ActionTile kind="request" onPress={() => router.push('/request')} />
        </View>
      </View>

      {empty ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/add-money')} style={styles.notice}>
          <View style={[styles.noticeIcon, { backgroundColor: colors.tealLight }]}>
            <Icon name="plus" />
          </View>
          <View style={{ flex: 1 }}>
            <Txt weight="semi" size={15}>
              {isTestnet ? 'Add test dollars to start' : 'Add money to start paying'}
            </Txt>
            <Txt size={13} color={colors.onTint}>
              {isTestnet ? 'Free on Tempo testnet. Arrives in about two seconds.' : 'From a card or a bank transfer.'}
            </Txt>
          </View>
          <View style={styles.noticeCta}>
            <Txt weight="semi" size={15} color={colors.white}>
              Add
            </Txt>
          </View>
        </Pressable>
      ) : null}

      <Txt weight="semi" size={18} style={styles.section}>
        Send again
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 20 }} style={{ marginHorizontal: -20, paddingLeft: 20 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Pay someone new" onPress={() => router.push('/send')} style={styles.person}>
          <View style={styles.newPerson}>
            <Icon name="plus" />
          </View>
          <Txt weight="medium" size={13}>
            New
          </Txt>
        </Pressable>
        {contacts.slice(0, 8).map((c) => (
          <Pressable
            key={c.address}
            accessibilityRole="button"
            accessibilityLabel={`Send to ${c.name}`}
            onPress={() => router.push({ pathname: '/send/[to]', params: { to: c.address, name: c.name, cur: c.currency ?? '' } })}
            style={styles.person}
          >
            <Avatar name={c.name} size={56} />
            <Txt weight="medium" size={13} numberOfLines={1}>
              {c.name.split(' ')[0]}
            </Txt>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.sectionRow]}>
        <Txt weight="semi" size={18}>
          Recent
        </Txt>
        {activity.length > 3 ? (
          <Pressable accessibilityRole="link" onPress={() => router.push('/(tabs)/activity')} hitSlop={10}>
            <Txt size={14} color={colors.muted} style={{ textDecorationLine: 'underline' }}>
              See all
            </Txt>
          </Pressable>
        ) : null}
      </View>
      {activity.length === 0 ? (
        <Txt size={15} color={colors.muted} style={{ marginTop: 6, lineHeight: 22 }}>
          Your payments show up here the moment they land.
        </Txt>
      ) : (
        activity.slice(0, 3).map((entry) => <EntryRow key={entry.id} entry={entry} />)
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  hero: { flexDirection: 'row', gap: 12, height: 204, marginTop: 14 },
  pay: {
    flex: 1.35,
    borderRadius: 30,
    backgroundColor: colors.ink,
    padding: 18,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  payIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  waves: { position: 'absolute', right: -14, top: 40 },
  small: { flex: 1, padding: 14, paddingHorizontal: 16, justifyContent: 'space-between' },
  notice: {
    marginTop: 22,
    borderRadius: 24,
    backgroundColor: colors.sunken,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 12,
    paddingLeft: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noticeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeCta: { height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: colors.ink, justifyContent: 'center' },
  section: { marginTop: 26, marginBottom: 12 },
  sectionRow: { marginTop: 26, marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  person: { alignItems: 'center', gap: 6, width: 60 },
  newPerson: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.ink,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
