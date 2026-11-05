import * as Haptics from 'expo-haptics'
import { router, useFocusEffect } from 'expo-router'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  type ColorValue,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
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
import { cardsLive, changeCard, type KovaCard, listCards, removeCard } from '@/lib/card'
import { chainName, onTempo } from '@/lib/config'
import type { KeyPaymentView, KeyView } from '@/lib/keys-state'
import { load as loadSaved, save } from '@/lib/storage'
import { colors } from '@/lib/theme'
import { isUnnamed, useWallet } from '@/lib/wallet'
import { CardArt } from '@/ui/art'
import { type CardDesign, CardDesignPicker, CardFace } from '@/ui/CardFace'
import { dockClearance } from '@/ui/Dock'
import { Icon, type IconName } from '@/ui/Icon'
import { Snowfall } from '@/ui/motion'
import { PillButton, Txt } from '@/ui/primitives'

const limits = ['50', '100', '200', '500']
const spring = { damping: 14, stiffness: 140 }

/** Whole dollars without cents ($100), anything else with both digits ($3.20). */
const dollars = (value: string | null) => {
  if (value === null) return '—'
  const n = Number(value)
  const cents = Number.isInteger(n) ? 0 : 2
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: cents, maximumFractionDigits: cents })}`
}

/**
 * The Ren Card. You can pick it up: it tilts under your finger and springs back. Freezing
 * frosts it over and lets the snow fall.
 *
 * Everything here is the card's real state. On Tempo a card is an access key on this wallet
 * (Keys): its daily limit and what's left today are read from Tempo, and every change (freeze,
 * limit, removal) is signed by this wallet's passkey and enforced by the chain. A Monad build
 * keeps its cards in the KovaCard contract (`cardsLive`).
 */
export default function Card() {
  if (onTempo) return <TempoCards />
  return <MonadCards />
}

function MonadCards() {
  const { profile, signTypedData } = useWallet()
  const insets = useSafeAreaInsets()
  const [cards, setCards] = useState<KovaCard[] | null>(null)
  const [selected, setSelected] = useState(0)
  const [problem, setProblem] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!profile || !cardsLive) return
    try {
      const list = await listCards(profile.address)
      setCards(list.data)
      setProblem(null)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Ren is unreachable.')
    }
  }, [profile])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const card = cards?.[Math.min(selected, (cards?.length ?? 1) - 1)] ?? null
  const frozen = card?.frozen ?? false

  const scroll = (children: ReactNode) => (
    <ScrollView
      style={{ flex: 1, backgroundColor: frozen ? colors.sunken : colors.paper }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: dockClearance + insets.bottom,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true)
            await load()
            setRefreshing(false)
          }}
        />
      }
    >
      {children}
    </ScrollView>
  )

  if (!cardsLive) return scroll(<NoCard />)

  if (cards === null)
    return scroll(
      <View style={{ paddingTop: 160, alignItems: 'center', gap: 12 }}>
        {problem ? (
          <>
            <Txt
              size={16}
              color={colors.muted}
              style={{ textAlign: 'center', paddingHorizontal: 40 }}
            >
              {problem}
            </Txt>
            <Pressable onPress={() => void load()} hitSlop={10}>
              <Txt weight="semi" size={16}>
                Try again
              </Txt>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.ink} />
        )}
      </View>,
    )

  if (!card) return scroll(<NoCard />)

  return scroll(
    <CardView
      key={card.address}
      card={card}
      holderName={profile && !isUnnamed(profile.name) ? profile.name : undefined}
      others={cards}
      selected={selected}
      onSelect={setSelected}
      onChanged={(next) =>
        setCards((list) => list?.map((c) => (c.address === next.address ? next : c)) ?? null)
      }
      onRemoved={() => {
        setSelected(0)
        void load()
      }}
      signTypedData={signTypedData}
    />,
  )
}

/**
 * The Card tab on Tempo: the wallet's Ren Cards, each an access key with a daily limit that
 * Tempo enforces. The chip signs every tap itself, so there's no PIN and nothing for Ren to
 * cosign: freezing sets the key's limit to zero on Tempo.
 */
function TempoCards() {
  const { keys } = useWallet()
  const insets = useSafeAreaInsets()
  const [selected, setSelected] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (keys.status === 'signed-out') void keys.signIn().catch(() => {})
      else if (keys.status === 'ready') void keys.refresh()
    }, [keys]),
  )

  const cards = keys.given.filter(
    (k) => k.kind === 'card' && k.status !== 'revoked' && k.status !== 'pending',
  )
  const card = cards[Math.min(selected, Math.max(cards.length - 1, 0))] ?? null
  const frozen = card?.status === 'frozen'

  const scroll = (children: ReactNode) => (
    <ScrollView
      style={{ flex: 1, backgroundColor: frozen ? colors.sunken : colors.paper }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: dockClearance + insets.bottom,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true)
            await keys.refresh().catch(() => {})
            setRefreshing(false)
          }}
        />
      }
    >
      {children}
    </ScrollView>
  )

  if (keys.status === 'signing-in' && cards.length === 0)
    return scroll(
      <View style={{ paddingTop: 160, alignItems: 'center' }}>
        <ActivityIndicator color={colors.ink} />
      </View>,
    )
  if (!card) return scroll(<NoCard />)
  return scroll(
    <TempoCardView
      key={card.id}
      card={card}
      others={cards}
      selected={selected}
      onSelect={setSelected}
      onRemoved={() => setSelected(0)}
    />,
  )
}

const tempoLimits = ['20', '50', '100', '200']

/** "at 10:26 PM", "tomorrow at 10:26 PM", or "on Friday at 10:26 PM": a key's period runs from when it was made, not midnight. */
function whenRenews(at: Date) {
  const time = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((day(at) - day(new Date())) / 86_400_000)
  if (days <= 0) return `at ${time}`
  if (days === 1) return `tomorrow at ${time}`
  return `on ${at.toLocaleDateString([], { weekday: 'long' })} at ${time}`
}

function TempoCardView({
  card,
  others,
  selected,
  onSelect,
  onRemoved,
}: {
  card: KeyView
  others: KeyView[]
  selected: number
  onSelect: (index: number) => void
  onRemoved: () => void
}) {
  const { keys } = useWallet()
  const { width } = useWindowDimensions()
  const reduced = useReducedMotion()
  const cardW = width - 60
  const frozen = card.status === 'frozen'
  const expired = card.status === 'expired'
  const last4 = card.key_id?.slice(-4).toUpperCase() ?? '····'
  const [pending, setPending] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [taps, setTaps] = useState<KeyPaymentView[] | null>(null)

  useEffect(() => {
    let live = true
    keys
      .payments(card)
      .then((list) => live && setTaps(list.filter((p) => p.status === 'paid').slice(0, 8)))
      .catch(() => live && setTaps([]))
    return () => {
      live = false
    }
  }, [card, keys])

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

  const frozenAt = useSharedValue(frozen ? 1 : 0)
  useEffect(() => {
    frozenAt.value = withTiming(frozen ? 1 : 0, {
      duration: 320,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
    })
  }, [frozen, frozenAt])
  const [trackW, setTrackW] = useState(0)
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: frozenAt.value * (trackW / 2) }],
  }))

  const act = async (
    what: string,
    run: () => Promise<void>,
    feel = Haptics.NotificationFeedbackType.Success,
  ) => {
    if (pending) return
    setPending(what)
    setProblem(null)
    try {
      await run()
      void Haptics.notificationAsync(feel)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'That didn’t work. Try again.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setPending(null)
    }
  }

  const setFrozen = (next: boolean) => {
    if (next === frozen) return
    void act(
      next ? 'freeze' : 'unfreeze',
      () => (next ? keys.freeze(card) : keys.unfreeze(card)),
      next ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
    )
  }

  const remove = () =>
    Alert.alert(
      `Remove card •••• ${last4}?`,
      'It won’t be able to pay any more. To use it again, link it again.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            void act('remove', async () => {
              await keys.remove(card)
              onRemoved()
            }),
        },
      ],
    )

  const limit = Number(card.limit)
  const left = card.remaining === null ? null : Number(card.remaining)
  // Frozen, Tempo shows nothing left, which isn't spending: the meter rests until it's unfrozen.
  const spent = left === null || frozen ? 0 : Math.max(0, limit - left)
  const renews = card.period_ends_at ? new Date(card.period_ends_at) : null

  return (
    <>
      <View style={styles.head}>
        <Txt weight="bold" size={32} style={{ letterSpacing: -1 }}>
          Card
        </Txt>
        <View
          style={[
            styles.status,
            { backgroundColor: frozen || expired ? colors.fill : colors.teal },
          ]}
        >
          <Icon name={frozen ? 'snow' : 'tap'} size={14} color={colors.white} />
          <Txt weight="semi" size={13} color={colors.white}>
            {frozen ? 'Frozen' : expired ? 'Expired' : 'Ready to tap'}
          </Txt>
        </View>
      </View>

      <GestureDetector gesture={tilt}>
        <Animated.View style={[styles.hero, tilted]}>
          <CardArt width={cardW} last4={last4} frozen={frozen} />
          {frozen ? <Snowfall width={cardW + 20} height={cardW * 0.6} /> : null}
        </Animated.View>
      </GestureDetector>
      <Txt size={13} color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
        {frozen
          ? 'Nobody can tap with it until you unfreeze it.'
          : expired
            ? 'Its key has ended. Link it again to keep paying with it.'
            : `${card.label}. Tap it at any Ren till. Drag it to tilt it.`}
      </Txt>

      {others.length > 1 ? (
        <View style={styles.picker}>
          {others.map((c, i) => (
            <Pressable
              key={c.id}
              onPress={() => onSelect(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === selected }}
              style={[styles.pick, i === selected && styles.pickOn]}
            >
              <Txt weight="semi" size={14} color={i === selected ? colors.white : colors.ink}>
                •••• {c.key_id?.slice(-4).toUpperCase()}
              </Txt>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.body}>
        <View
          style={styles.switch}
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width - 12)}
          accessibilityRole="radiogroup"
          accessibilityLabel="Card status"
        >
          <Animated.View
            style={[
              styles.thumb,
              { width: trackW / 2, backgroundColor: frozen ? colors.fill : colors.teal },
              thumb,
            ]}
          />
          <Choice
            icon="tap"
            label="Active"
            on={!frozen}
            busy={pending === 'unfreeze'}
            onPress={() => setFrozen(false)}
          />
          <Choice
            icon="snow"
            label="Frozen"
            on={frozen}
            busy={pending === 'freeze'}
            onPress={() => setFrozen(true)}
          />
        </View>

        {problem ? (
          <View style={styles.problem}>
            <Icon name="info" size={18} color={colors.danger} />
            <Txt weight="medium" size={14} color={colors.danger} style={{ flex: 1 }}>
              {problem}
            </Txt>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.limitHead}>
            <View>
              <Txt size={13} color={colors.muted}>
                Daily limit
              </Txt>
              <Txt weight="bold" size={28} style={{ letterSpacing: -0.8 }}>
                {dollars(card.limit)}
                <Txt size={15} color={colors.muted}>
                  {'  '}a {card.period}
                </Txt>
              </Txt>
            </View>
            <Txt size={13} color={colors.muted} style={{ textAlign: 'right' }}>
              {frozen
                ? 'Paused'
                : `${dollars(String(spent))} spent\n${card.period === 'day' ? 'today' : 'this week'}`}
            </Txt>
          </View>
          <View style={styles.meter}>
            <View
              style={[
                styles.meterFill,
                { width: `${Math.max(2, Math.min(100, (spent / (limit || 1)) * 100))}%` },
              ]}
            />
          </View>
          <View style={styles.ticks}>
            {tempoLimits.map((l) => {
              const on = Number(l) === limit
              return (
                <Pressable
                  key={l}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, busy: pending === `limit:${l}` }}
                  accessibilityLabel={`$${l} a day`}
                  disabled={on || pending !== null || frozen || expired}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    void act(`limit:${l}`, () => keys.setLimit(card, l))
                  }}
                  hitSlop={6}
                  style={[
                    styles.tick,
                    on && styles.tickOn,
                    (frozen || expired) && !on && { opacity: 0.4 },
                  ]}
                >
                  {pending === `limit:${l}` ? (
                    <ActivityIndicator color={colors.ink} size="small" />
                  ) : (
                    <Txt weight="semi" size={14} color={on ? colors.white : colors.ink}>
                      ${l}
                    </Txt>
                  )}
                </Pressable>
              )
            })}
          </View>
          <Txt size={12} color={colors.muted} style={{ marginTop: 10, lineHeight: 17 }}>
            {frozen
              ? 'Frozen: its limit on Tempo is zero until you unfreeze it.'
              : `It can spend ${dollars(left === null ? null : String(left))} more${
                  renews ? `, and the limit renews ${whenRenews(renews)}` : ' today'
                }. It’s kept on ${chainName}, so only your Face ID can change it.`}
          </Txt>
        </View>

        <View style={[styles.section, { padding: 0 }]}>
          <Pressable
            accessibilityRole="button"
            disabled={frozen || pending !== null}
            onPress={() => setFrozen(true)}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            <Row
              icon="snow"
              tint={colors.coralSoft}
              label="Report lost"
              value={frozen ? 'Frozen. Unfreeze it if you find it.' : 'Freezes it straight away'}
            >
              <Icon name="arrow" size={17} />
            </Row>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/keys/card')}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            <Row
              icon="plus"
              tint={colors.sunken}
              label="Link another card"
              value="Each with its own daily limit"
            >
              <Icon name="arrow" size={17} />
            </Row>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={pending !== null}
            onPress={remove}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            <Row
              icon="trash"
              tint={colors.sunken}
              label="Remove card"
              value="Tempo revokes its key for good"
              last
            >
              {pending === 'remove' ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Icon name="arrow" size={17} />
              )}
            </Row>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Txt weight="semi" size={17}>
            Recent taps
          </Txt>
          {taps === null ? (
            <ActivityIndicator color={colors.ink} style={{ marginTop: 10 }} />
          ) : taps.length === 0 ? (
            <Txt size={14} color={colors.muted} style={{ marginTop: 6 }}>
              Nothing yet. Taps show up here the moment they’re paid.
            </Txt>
          ) : (
            taps.map((t) => (
              <View key={t.id} style={styles.tap}>
                <View style={[styles.rowIcon, { backgroundColor: colors.tealSoft }]}>
                  <Icon name="tap" size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="semi" size={15} numberOfLines={1}>
                    {t.description ?? 'A Ren till'}
                  </Txt>
                  <Txt size={13} color={colors.muted}>
                    {new Date(t.created_at).toLocaleString([], {
                      weekday: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Txt>
                </View>
                <Txt weight="semi" size={16}>
                  −{dollars(t.amount)}
                </Txt>
              </View>
            ))
          )}
        </View>
      </View>
    </>
  )
}

/** No card yet: what a Ren Card does, and the way to link one. */
function NoCard() {
  const { width } = useWindowDimensions()
  return (
    <>
      <View style={styles.head}>
        <Txt weight="bold" size={32} style={{ letterSpacing: -1 }}>
          Card
        </Txt>
      </View>
      <View style={[styles.hero, { opacity: 0.55 }]}>
        {cardsLive ? (
          <CardFace design="main" boxW={width - 60} boxH={(width - 60) * 0.95} />
        ) : (
          <CardArt width={width - 60} last4="••••" />
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.section}>
          <Txt weight="semi" size={22} style={{ letterSpacing: -0.5 }}>
            Pay with a tap, from your wallet.
          </Txt>
          <Txt size={15} color={colors.muted} style={{ marginTop: 6, lineHeight: 21 }}>
            A Ren Card is a chip that pays at any Ren till. It needs no phone, data or signal, and
            spends straight from this wallet, so there’s nothing to top up.
          </Txt>
          <View style={{ gap: 10, marginTop: 14 }}>
            {cardsLive ? (
              <Point icon="lock" text="A PIN over $25, checked by Ren, never stored on the card." />
            ) : null}
            <Point
              icon="card"
              text={
                cardsLive
                  ? 'A daily limit you set on Monad. Nobody else can raise it.'
                  : `A daily limit and an expiry, kept on ${chainName}. Nobody else can raise them.`
              }
            />
            <Point icon="snow" text="Freeze it in a second if it’s lost." />
          </View>
        </View>
        <PillButton
          label="Link a Ren Card"
          icon="tap"
          onPress={() => router.push(cardsLive ? '/card/link' : '/keys/card')}
        />
      </View>
    </>
  )
}

function CardView({
  card,
  others,
  selected,
  onSelect,
  onChanged,
  onRemoved,
  signTypedData,
  holderName,
}: {
  card: KovaCard
  others: KovaCard[]
  selected: number
  onSelect: (index: number) => void
  onChanged: (card: KovaCard) => void
  onRemoved: () => void
  signTypedData: ReturnType<typeof useWallet>['signTypedData']
  holderName?: string
}) {
  const { width } = useWindowDimensions()
  // The design is the holder's choice, kept on this phone for each card.
  const [design, setDesign] = useState<CardDesign>('main')
  useEffect(() => {
    loadSaved<CardDesign>(`card-design:${card.address}`, 'main').then(setDesign)
  }, [card.address])
  const pick = (d: CardDesign) => {
    setDesign(d)
    save(`card-design:${card.address}`, d).catch(() => {})
  }
  const reduced = useReducedMotion()
  const cardW = width - 60
  const [pending, setPending] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

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
  const frozenAt = useSharedValue(card.frozen ? 1 : 0)
  useEffect(() => {
    frozenAt.value = withTiming(card.frozen ? 1 : 0, {
      duration: 320,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
    })
  }, [card.frozen, frozenAt])
  const [trackW, setTrackW] = useState(0)
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: frozenAt.value * (trackW / 2) }],
  }))

  const limit = card.daily_limit ?? '0'
  const change = async (what: string, next: { dailyLimit: string; frozen: boolean }) => {
    if (pending) return
    setPending(what)
    setProblem(null)
    try {
      const updated = await changeCard(card, next, signTypedData)
      void Haptics.notificationAsync(
        next.frozen
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      )
      onChanged(updated)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'That didn’t work. Try again.')
    } finally {
      setPending(null)
    }
  }

  const setFrozen = (next: boolean) => {
    if (next === card.frozen) return
    void change(next ? 'freeze' : 'unfreeze', { dailyLimit: limit, frozen: next })
  }

  const remove = () =>
    Alert.alert(
      `Remove card •••• ${card.last_four}?`,
      'It won’t be able to pay any more. To use it again, link it again.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setPending('remove')
            try {
              await removeCard(card, signTypedData)
              onRemoved()
            } catch (error) {
              setProblem(error instanceof Error ? error.message : 'That didn’t work. Try again.')
              setPending(null)
            }
          },
        },
      ],
    )

  const spent = Number(card.spent_today ?? 0)
  const max = Number(limit) || 1
  const pinLocked = card.pin_locked_until ? new Date(card.pin_locked_until) : null

  return (
    <>
      <View style={styles.head}>
        <Txt weight="bold" size={32} style={{ letterSpacing: -1 }}>
          Card
        </Txt>
        <View style={[styles.status, { backgroundColor: card.frozen ? colors.fill : colors.teal }]}>
          <Icon name={card.frozen ? 'snow' : 'tap'} size={14} color={colors.white} />
          <Txt weight="semi" size={13} color={colors.white}>
            {card.frozen ? 'Frozen' : 'Ready to tap'}
          </Txt>
        </View>
      </View>

      <GestureDetector gesture={tilt}>
        <Animated.View style={[styles.hero, tilted]}>
          <CardFace
            design={design}
            boxW={cardW}
            boxH={cardW * 0.95}
            name={holderName}
            frozen={card.frozen}
          />
          {card.frozen ? <Snowfall width={cardW + 20} height={cardW * 0.82} /> : null}
        </Animated.View>
      </GestureDetector>
      <Txt size={13} color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
        {card.frozen
          ? 'Nobody can tap with it until you unfreeze it.'
          : 'Tap it at any Ren till. Drag it to tilt it.'}
      </Txt>
      <View style={{ marginTop: 18 }}>
        <CardDesignPicker value={design} onChange={pick} />
      </View>

      {others.length > 1 ? (
        <View style={styles.picker}>
          {others.map((c, i) => (
            <Pressable
              key={c.address}
              onPress={() => onSelect(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === selected }}
              style={[styles.pick, i === selected && styles.pickOn]}
            >
              <Txt weight="semi" size={14} color={i === selected ? colors.white : colors.ink}>
                •••• {c.last_four}
              </Txt>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.body}>
        <View
          style={styles.switch}
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width - 12)}
          accessibilityRole="radiogroup"
          accessibilityLabel="Card status"
        >
          <Animated.View
            style={[
              styles.thumb,
              { width: trackW / 2, backgroundColor: card.frozen ? colors.fill : colors.teal },
              thumb,
            ]}
          />
          <Choice
            icon="tap"
            label="Active"
            on={!card.frozen}
            busy={pending === 'unfreeze'}
            onPress={() => setFrozen(false)}
          />
          <Choice
            icon="snow"
            label="Frozen"
            on={card.frozen}
            busy={pending === 'freeze'}
            onPress={() => setFrozen(true)}
          />
        </View>

        {problem ? (
          <View style={styles.problem}>
            <Icon name="info" size={18} color={colors.danger} />
            <Txt weight="medium" size={14} color={colors.danger} style={{ flex: 1 }}>
              {problem}
            </Txt>
          </View>
        ) : null}

        {pinLocked && pinLocked > new Date() ? (
          <View style={styles.problem}>
            <Icon name="lock" size={18} color={colors.danger} />
            <Txt weight="medium" size={14} color={colors.danger} style={{ flex: 1 }}>
              Too many wrong PINs at a till. The card is paused until{' '}
              {pinLocked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
            </Txt>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.limitHead}>
            <View>
              <Txt size={13} color={colors.muted}>
                Daily limit
              </Txt>
              <Txt weight="bold" size={28} style={{ letterSpacing: -0.8 }}>
                {dollars(card.daily_limit)}
                <Txt size={15} color={colors.muted}>
                  {'  '}a day
                </Txt>
              </Txt>
            </View>
            <Txt size={13} color={colors.muted} style={{ textAlign: 'right' }}>
              {dollars(card.spent_today)} spent{'\n'}today
            </Txt>
          </View>
          <View style={styles.meter}>
            <View
              style={[
                styles.meterFill,
                { width: `${Math.max(2, Math.min(100, (spent / max) * 100))}%` },
              ]}
            />
          </View>
          <View style={styles.ticks}>
            {limits.map((l) => {
              const on = Number(l) === Number(limit)
              return (
                <Pressable
                  key={l}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, busy: pending === `limit:${l}` }}
                  accessibilityLabel={`$${l} a day`}
                  disabled={on || pending !== null}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    void change(`limit:${l}`, { dailyLimit: l, frozen: card.frozen })
                  }}
                  hitSlop={6}
                  style={[styles.tick, on && styles.tickOn]}
                >
                  {pending === `limit:${l}` ? (
                    <ActivityIndicator color={colors.ink} size="small" />
                  ) : (
                    <Txt weight="semi" size={14} color={on ? colors.white : colors.ink}>
                      ${l}
                    </Txt>
                  )}
                </Pressable>
              )
            })}
          </View>
          <Txt size={12} color={colors.muted} style={{ marginTop: 10, lineHeight: 17 }}>
            {card.frozen
              ? 'Frozen: it can’t spend anything until you unfreeze it.'
              : `It can spend ${dollars(card.left_today)} more today. The limit is kept on Monad, so only you can change it. A PIN is asked over ${dollars(card.no_pin_limit)}.`}
          </Txt>
        </View>

        <View style={[styles.section, { padding: 0 }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/card/pin', params: { address: card.address } })
            }
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            <Row
              icon="lock"
              tint={colors.tealSoft}
              label="Change PIN"
              value="For taps over the no-PIN limit"
            >
              <Icon name="arrow" size={17} />
            </Row>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={card.frozen || pending !== null}
            onPress={() => setFrozen(true)}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            <Row
              icon="snow"
              tint={colors.coralSoft}
              label="Report lost"
              value={
                card.frozen ? 'Frozen. Unfreeze it if you find it.' : 'Freezes it straight away'
              }
            >
              <Icon name="arrow" size={17} />
            </Row>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/card/link')}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            <Row
              icon="plus"
              tint={colors.sunken}
              label="Link another card"
              value="Each with its own limit and PIN"
            >
              <Icon name="arrow" size={17} />
            </Row>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={pending !== null}
            onPress={remove}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            <Row
              icon="trash"
              tint={colors.sunken}
              label="Remove card"
              value="It stops working for good"
              last
            >
              {pending === 'remove' ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Icon name="arrow" size={17} />
              )}
            </Row>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Txt weight="semi" size={17}>
            Recent taps
          </Txt>
          {card.recent.length === 0 ? (
            <Txt size={14} color={colors.muted} style={{ marginTop: 6 }}>
              Nothing yet. Taps show up here the moment they’re paid.
            </Txt>
          ) : (
            card.recent.map((t) => (
              <View key={`${t.at}-${t.tx_hash}`} style={styles.tap}>
                <View style={[styles.rowIcon, { backgroundColor: colors.tealSoft }]}>
                  <Icon name="tap" size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="semi" size={15} numberOfLines={1}>
                    {t.shop}
                  </Txt>
                  <Txt size={13} color={colors.muted}>
                    {new Date(t.at).toLocaleString([], {
                      weekday: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Txt>
                </View>
                <Txt weight="semi" size={16}>
                  −${t.amount}
                </Txt>
              </View>
            ))
          )}
        </View>
      </View>
    </>
  )
}

function Point({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={[styles.rowIcon, { width: 32, height: 32, backgroundColor: colors.tealSoft }]}>
        <Icon name={icon} size={16} />
      </View>
      <Txt size={14} style={{ flex: 1, lineHeight: 20 }}>
        {text}
      </Txt>
    </View>
  )
}

function Choice({
  icon,
  label,
  on,
  busy,
  onPress,
}: {
  icon: IconName
  label: string
  on: boolean
  busy: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on, busy }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.choice}
    >
      {busy ? (
        <ActivityIndicator color={on ? colors.white : colors.ink} />
      ) : (
        <Icon name={icon} size={15} color={on ? colors.white : colors.ink} />
      )}
      <Txt weight="semi" size={14} color={on ? colors.white : colors.ink}>
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
  tint: ColorValue
  label: string
  value: string
  last?: boolean
  children?: ReactNode
}) {
  return (
    <View style={[styles.row, !last && styles.rowRule]}>
      <View style={[styles.rowIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={16} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt weight="semi" size={15}>
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
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  status: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hero: { alignItems: 'center', marginTop: 18, paddingHorizontal: 20 },
  body: { paddingHorizontal: 20, marginTop: 18, gap: 14 },
  picker: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 },
  pick: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.line,
    justifyContent: 'center',
  },
  pickOn: { backgroundColor: colors.chosen },
  switch: {
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    padding: 4,
  },
  thumb: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 20 },
  choice: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  problem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  section: {
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 16,
    overflow: 'hidden',
  },
  limitHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  meter: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.sunken,
    marginTop: 12,
    overflow: 'hidden',
  },
  meterFill: { height: '100%', borderRadius: 5, backgroundColor: colors.coral },
  ticks: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tick: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: { backgroundColor: colors.chosen },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowRule: { borderBottomWidth: 1, borderColor: colors.sunken },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tap: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
})
