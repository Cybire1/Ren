import { router } from 'expo-router'
import { Fragment, useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getSummary } from '@/lib/api'
import { chainName, isTestnet } from '@/lib/config'
import { formatUsd } from '@/lib/money'
import { usePrefs } from '@/lib/prefs'
import { useStall } from '@/lib/stall'
import { useTerminal } from '@/lib/terminal'
import { colors } from '@/lib/theme'
import { type Entry, isUnnamed, useWallet } from '@/lib/wallet'
import { ActionTile } from '@/ui/ActionTile'
import { Awning } from '@/ui/Awning'
import { Avatar, Flyer, ShopBadge } from '@/ui/art'
import { BalanceCard, type Fresh, ReadyCard } from '@/ui/BalanceCard'
import { dockClearance } from '@/ui/Dock'
import { EntryRow } from '@/ui/EntryRow'
import { Icon } from '@/ui/Icon'
import { LogoMark } from '@/ui/Logo'
import { PulseWaves } from '@/ui/motion'
import { Sticker, Txt } from '@/ui/primitives'
import { dollars } from '@/ui/StallParts'

/** How long money counts as just landed: long enough to notice it on the way back to Home. */
const FRESH_MS = 120_000

/**
 * Home is for paying, but you should never have to look for your money. The balance opens the
 * screen on a solid teal card, since money at rest is teal across Ren; Pay sits right beneath it,
 * Send and Request beside Pay, and what just happened is a glance below. A brand-new wallet gets
 * a first-run Home instead: an honest $0.00, Kovi, and three things to try.
 */
export default function Home() {
  const { profile, balance, activity, contacts, refresh } = useWallet()
  const insets = useSafeAreaInsets()
  const [refreshing, setRefreshing] = useState(false)
  const fresh = useFresh(activity)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  if (!profile) return null
  const firstRun = balance === 0n && activity.length === 0

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: dockClearance + insets.bottom, paddingHorizontal: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push('/(tabs)/profile')} style={styles.face}>
          <Avatar name={profile.name} id={profile.address} size={42} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt weight="semi" size={13} color={colors.muted}>
            {firstRun ? 'Welcome to Ren' : greeting()}
          </Txt>
          <Txt weight="heavy" size={19} style={{ letterSpacing: -0.4 }} numberOfLines={1}>
            {profile.name.split(' ')[0]}
          </Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fresh ? 'Activity, 1 new' : 'Activity'}
          hitSlop={4}
          onPress={() => router.push('/(tabs)/activity')}
          style={({ pressed }) => [styles.bell, pressed && { transform: [{ scale: 0.94 }] }]}
        >
          <Icon name="bell" />
          {fresh ? <View style={styles.bellDot} /> : null}
        </Pressable>
      </View>

      {firstRun ? (
        <>
          <ReadyCard />
          <FirstSteps />
          <ShopCard />
        </>
      ) : (
        <>
          <BalanceCard balance={balance} currency={profile.currency} fresh={fresh ? { id: fresh.id, line: freshLine(fresh) } : null} />

          <View style={styles.hero}>
            <PayTile />
            <View style={{ flex: 1, gap: 12 }}>
              <ActionTile kind="send" onPress={() => router.push('/send')} />
              <ActionTile kind="request" onPress={() => router.push('/request')} />
            </View>
          </View>

          <ShopCard />

          {balance === 0n ? (
            <Sticker
              lift
              radius={24}
              fill={colors.sunken}
              onPress={() => router.push('/add-money')}
              accessibilityLabel={isTestnet ? 'Add test dollars' : 'Add money'}
              style={{ marginTop: 16 }}
              innerStyle={styles.notice}
            >
              <View style={[styles.noticeIcon, { backgroundColor: colors.tealLight }]}>
                <Icon name="plus" />
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight="heavy" size={15}>
                  {isTestnet ? 'Add test dollars to start' : 'Add money to start paying'}
                </Txt>
                <Txt size={13} color={colors.onTint}>
                  {isTestnet ? `$5 a day, free on ${chainName} testnet. Arrives in about a second.` : 'From a card or a bank transfer.'}
                </Txt>
              </View>
              <View style={styles.noticeCta}>
                <Txt weight="heavy" size={15} color={colors.white}>
                  Add
                </Txt>
              </View>
            </Sticker>
          ) : null}

          <View style={styles.sectionRow}>
            <Txt weight="heavy" size={18} style={{ letterSpacing: -0.3 }}>
              Recent
            </Txt>
            {activity.length > 3 ? (
              <Pressable accessibilityRole="link" onPress={() => router.push('/(tabs)/activity')} hitSlop={10}>
                <Txt weight="bold" size={14} style={{ textDecorationLine: 'underline' }}>
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
            <View style={styles.listCard}>
              {activity.slice(0, 3).map((entry, i) => (
                <Fragment key={entry.id}>
                  {i > 0 ? <View style={styles.rule} /> : null}
                  <EntryRow entry={entry} inset fresh={fresh?.id === entry.id} />
                </Fragment>
              ))}
            </View>
          )}

          <Txt weight="heavy" size={18} style={[styles.section, { letterSpacing: -0.3 }]}>
            Send again
          </Txt>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 14, paddingRight: 20 }}
            style={{ marginHorizontal: -20, paddingLeft: 20 }}
          >
            <Pressable accessibilityRole="button" accessibilityLabel="Pay someone new" onPress={() => router.push('/send')} style={styles.person}>
              <View style={styles.newPerson}>
                <Icon name="plus" />
              </View>
              <Txt weight="bold" size={13}>
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
                <Avatar name={c.name} id={c.address} size={56} />
                <Txt weight="bold" size={13} numberOfLines={1}>
                  {isUnnamed(c.name) ? c.address.slice(0, 6) : c.name.split(' ')[0]}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>

          <Sticker
            lift
            radius={22}
            fill={colors.tealSoft}
            onPress={() => router.push('/travel')}
            accessibilityLabel="Travel. Flights and hotels, paid in dollars"
            style={{ marginTop: 26 }}
            innerStyle={styles.travel}
          >
            <View style={{ flex: 1 }}>
              <Txt weight="heavy" size={20} style={{ letterSpacing: -0.4 }}>
                Travel
              </Txt>
              <Txt size={12} color={colors.onTint} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                Flights and hotels, paid in dollars
              </Txt>
            </View>
            {/* The plane flies over the top right, clear of the line of text below it. */}
            <View style={styles.travelPlane} pointerEvents="none">
              <Flyer size={70} />
            </View>
            <View style={styles.go}>
              <Icon name="arrow" color={colors.white} />
            </View>
          </Sticker>
        </>
      )}
    </ScrollView>
  )
}

/** Good morning, afternoon or evening, by the phone's clock. */
function greeting(now = new Date()) {
  const hour = now.getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * The newest money in, if it landed in the last two minutes. Home re-renders when that time
 * runs out, so the chip and the glow are only ever about money that has just arrived.
 */
function useFresh(activity: Entry[]) {
  const newest = activity[0]
  const [now, setNow] = useState(() => Date.now())
  // A new entry is judged against the time it arrived, not when Home last rendered.
  useEffect(() => setNow(Date.now()), [newest?.id])
  const fresh = newest && (newest.kind === 'received' || newest.kind === 'added') && now - newest.at < FRESH_MS ? newest : null
  useEffect(() => {
    if (!fresh) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, fresh.at + FRESH_MS - Date.now()) + 50)
    return () => clearTimeout(timer)
  }, [fresh])
  return fresh
}

function freshLine(entry: Entry): Fresh['line'] {
  const amount = formatUsd(BigInt(entry.amount), { sign: true })
  if (entry.kind === 'added') return `${amount} test dollars, just now`
  const from = isUnnamed(entry.name) ? entry.name : entry.name.split(' ')[0]
  return `${amount} from ${from}, just now`
}

/**
 * Pay: the biggest thing under the balance, in ink, with the logo's tap waves brightening in turn
 * as if a reader were waiting for a phone.
 */
function PayTile() {
  return (
    <Sticker
      lift
      radius={26}
      fill={colors.ink}
      onPress={() => router.push('/scan')}
      accessibilityLabel="Pay. Scan a code or tap a card"
      style={{ flex: 1.1 }}
      innerStyle={styles.pay}
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={[styles.payIcon, { backgroundColor: colors.coral }]}>
          <Icon name="scan" strokeWidth={2.2} />
        </View>
        <View style={[styles.payIcon, { backgroundColor: colors.onTint }]}>
          <LogoMark size={26} stem={colors.white} wave={colors.onInk} />
        </View>
      </View>
      <View style={styles.payWaves} pointerEvents="none">
        <PulseWaves size={132} />
      </View>
      <View>
        <Txt weight="heavy" size={42} color={colors.white} style={{ letterSpacing: -1.8, lineHeight: 48 }}>
          Pay
        </Txt>
        <Txt weight="semi" size={13} color={colors.onInk} style={{ lineHeight: 17 }}>
          {'Scan a code\nor tap a card'}
        </Txt>
      </View>
    </Sticker>
  )
}

/** A new wallet's first three things: money in, a payment, a friend. Each opens the real screen. */
function FirstSteps() {
  const steps = [
    {
      title: isTestnet ? 'Add test dollars' : 'Add money',
      line: isTestnet ? `$5 a day, free on ${chainName} testnet` : 'From a card or a bank transfer',
      go: () => router.push('/add-money'),
    },
    { title: 'Pay at a shop', line: 'Scan their code or tap their phone', go: () => router.push('/scan') },
    { title: 'Send to a friend', line: 'Type a name or paste their link', go: () => router.push('/send') },
  ]
  return (
    <>
      <View style={styles.sectionRow}>
        <Txt weight="heavy" size={18} style={{ letterSpacing: -0.3 }}>
          Three things to try
        </Txt>
        <Txt weight="bold" size={13} color={colors.muted}>
          0 of 3 done
        </Txt>
      </View>
      <View style={styles.listCard}>
        {steps.map((step, i) => {
          const next = i === 0
          return (
            <Fragment key={step.title}>
              {i > 0 ? <View style={[styles.rule, { marginHorizontal: 0 }]} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Step ${i + 1}. ${step.title}. ${step.line}`}
                onPress={step.go}
                style={({ pressed }) => [styles.step, next && { backgroundColor: colors.coralTint }, pressed && { opacity: 0.7 }]}
              >
                <View style={[styles.stepNumber, { backgroundColor: next ? colors.coral : colors.paper }]}>
                  <Txt weight="heavy" size={16}>
                    {i + 1}
                  </Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="heavy" size={15}>
                    {step.title}
                  </Txt>
                  <Txt weight="semi" size={13} color={next ? colors.onTint : colors.muted}>
                    {step.line}
                  </Txt>
                </View>
                {next ? (
                  <View style={styles.stepGo}>
                    <Icon name="chevron" size={16} strokeWidth={2.6} />
                  </View>
                ) : (
                  <View style={{ marginRight: 9 }}>
                    <Icon name="chevron" size={18} strokeWidth={2.4} />
                  </View>
                )}
              </Pressable>
            </Fragment>
          )
        })}
      </View>
    </>
  )
}

/**
 * Your shop, one of the wallet's features: the way into shop mode, as on the web. With a shop it
 * shows today's takings and opens the shop; on a phone that's a shop's till it opens the till;
 * with neither, it opens a shop, owned by this wallet.
 */
function ShopCard() {
  const stall = useStall()
  const terminal = useTerminal()
  const { setMode } = usePrefs()
  const { width } = useWindowDimensions()
  const [today, setToday] = useState<{ total: string; count: number } | null>(null)

  useEffect(() => {
    if (!terminal.paired) return
    let live = true
    getSummary()
      .then((s) => live && setToday(s.today ?? null))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [terminal.paired])

  const owned = stall.owned
  const till = !owned ? terminal.paired : null
  const shop = stall.stall
  const enter = (to: '/terminal' | '/terminal/today') => {
    setMode('terminal')
    router.replace(to)
  }
  const card =
    owned && stall.complete
      ? {
          label: 'Your shop',
          title: owned.name,
          line: today
            ? today.count > 0
              ? `${dollars(today.total)} today, ${today.count} ${today.count === 1 ? 'sale' : 'sales'}`
              : 'No sales yet today'
            : shop
              ? `${shop.open ? 'Open' : 'Closed'}, ${shop.items.length} ${shop.items.length === 1 ? 'item' : 'items'}`
              : 'Your shop',
          go: () => enter('/terminal/today'),
        }
      : till
        ? { label: 'Your till', title: till.merchantName, line: `This phone is ${till.name}`, go: () => enter('/terminal') }
        : owned
          ? { label: 'Your shop', title: 'Finish your shop', line: 'A step or two left', go: () => router.push('/open-stall') }
          : { label: 'Run a shop?', title: 'Open a shop', line: 'Take payments into this wallet', go: () => router.push('/open-stall') }

  return (
    <Sticker
      lift
      radius={22}
      fill={colors.card}
      onPress={card.go}
      accessibilityLabel={`${card.title}. ${card.line}`}
      style={{ marginTop: 16 }}
    >
      <Awning width={width - 44} height={20} stripe={17} tone={shop && !shop.open ? 'teal' : 'coral'} />
      <View style={styles.shopBody}>
        <ShopBadge size={48} />
        <View style={{ flex: 1 }}>
          <Txt size={12} weight="bold" color={colors.onTint}>
            {card.label}
          </Txt>
          <Txt weight="heavy" size={18} numberOfLines={1} style={{ letterSpacing: -0.4 }}>
            {card.title}
          </Txt>
          <Txt size={13} weight="semi" color={colors.onTint} numberOfLines={1}>
            {card.line}
          </Txt>
        </View>
        <View style={styles.go}>
          <Icon name="arrow" color={colors.white} />
        </View>
      </View>
    </Sticker>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  face: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bell: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.coral,
  },
  hero: { flexDirection: 'row', gap: 12, height: 196, marginTop: 16 },
  pay: { padding: 16, justifyContent: 'space-between' },
  payIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  payWaves: { position: 'absolute', right: -34, top: 40 },
  shopBody: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingRight: 12, paddingTop: 6, paddingBottom: 12 },
  go: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  travel: { height: 76, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 18, paddingRight: 12 },
  travelPlane: { position: 'absolute', right: 58, top: -6, transform: [{ rotate: '-6deg' }] },
  notice: { padding: 12, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  sectionRow: { marginTop: 24, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  listCard: { borderRadius: 22, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.card, overflow: 'hidden' },
  rule: { height: 2, marginHorizontal: 14, backgroundColor: colors.sunken },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  stepNumber: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
