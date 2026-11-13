import * as Haptics from 'expo-haptics'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import type { Address } from 'viem'
import { type DollarCard, getDollarCard, requestAccess } from '@/lib/partners'
import { colors } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import type { ReniPose } from './art'
import { DollarCardFace } from './DollarCardFace'
import { Icon } from './Icon'
import { PillButton, Rise, Txt } from './primitives'
import { Stage } from './Stage'

/**
 * The parts the dollar card's screens share (loading it, and the honest state for a feature that
 * waits on a partner), and the ways into Cash out and the dollar card from Home and the Card tab.
 */

export const problemOf = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong. Try again.'

export function useMoney<T>(
  load: (address: Address) => Promise<T>,
  { loadOnMount = true }: { loadOnMount?: boolean } = {},
) {
  const { profile } = useWallet()
  const [data, setData] = useState<T | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const address = profile?.address
  const reload = useCallback(async () => {
    if (!address) return
    try {
      setData(await load(address))
      setProblem(null)
    } catch (e) {
      setProblem(problemOf(e))
    }
  }, [address, load])
  useEffect(() => {
    if (loadOnMount) void reload()
  }, [loadOnMount, reload])
  return { data, setData, problem, reload }
}

/** What it is, who runs it, and a way to be first when it opens. */
export function NotYet({
  pose,
  title,
  lead,
  facts,
  requested,
  onRequested,
}: {
  pose: ReniPose
  title: string
  lead: string
  facts: Array<[string, string]>
  requested: boolean
  onRequested: () => void
}) {
  const { profile, signMessage } = useWallet()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.art}>
        <Stage pose={pose} size={140} />
      </View>
      <Rise style={{ paddingHorizontal: 8 }}>
        <Txt weight="semi" size={30} style={styles.title}>
          {title}
        </Txt>
        <Txt size={16} color={colors.onTint} style={styles.lead}>
          {lead}
        </Txt>
      </Rise>
      <View style={styles.facts}>
        {facts.map(([k, v], i) => (
          <View key={k} style={[styles.fact, i > 0 && styles.rule]}>
            <Txt size={14} color={colors.muted}>
              {k}
            </Txt>
            <Txt weight="semi" size={14} style={{ flexShrink: 1, textAlign: 'right' }}>
              {v}
            </Txt>
          </View>
        ))}
      </View>
      {requested ? (
        <View style={styles.listed}>
          <Icon name="check" size={18} />
          <Txt weight="semi" size={14} style={{ flex: 1, lineHeight: 20 }}>
            You’re on the list. Ren switches this on for you as soon as its partner does.
          </Txt>
        </View>
      ) : (
        <View style={{ marginTop: 'auto', paddingTop: 16 }}>
          <Txt size={14} color={colors.muted} style={{ textAlign: 'center', marginBottom: 10 }}>
            Opening soon. Ask now and you’ll be among the first.
          </Txt>
          {problem ? (
            <Txt weight="medium" size={14} color={colors.danger} style={{ marginBottom: 8 }}>
              {problem}
            </Txt>
          ) : null}
          <PillButton
            label={busy ? 'Asking…' : 'Request access'}
            icon="sparkle"
            loading={busy}
            disabled={!profile}
            onPress={async () => {
              if (!profile) return
              setBusy(true)
              setProblem(null)
              try {
                await requestAccess(profile.address, signMessage, 'dollar_card')
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                onRequested()
              } catch (e) {
                setProblem(problemOf(e))
              } finally {
                setBusy(false)
              }
            }}
          />
        </View>
      )}
    </View>
  )
}

export function SandboxNote({ text }: { text: string }) {
  return (
    <View style={styles.sandbox}>
      <Icon name="info" size={14} color={colors.muted} />
      <Txt weight="semi" size={12} color={colors.muted}>
        {text}
      </Txt>
    </View>
  )
}

/**
 * Home: Cash out and the dollar card, side by side. Cash out is one button for every country
 * (app/cash-out-world.tsx asks where to); the card tile shows the card once there is one.
 */
export function MoneyTiles() {
  const { profile } = useWallet()
  const [card, setCard] = useState<DollarCard | null>(null)
  const address = profile?.address
  // Again on coming back to Home, so a new or frozen card shows without a restart.
  useFocusEffect(
    useCallback(() => {
      if (!address) return
      void getDollarCard(address)
        .then(setCard)
        .catch(() => null)
    }, [address]),
  )
  return (
    <View style={tiles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cash out. To your bank or mobile money"
        onPress={() => router.push('/cash-out-world')}
        style={({ pressed }) => [
          tiles.tile,
          { backgroundColor: colors.money },
          pressed && tiles.pressed,
        ]}
      >
        <View style={tiles.icon}>
          <Icon name="bank" size={18} color={colors.white} />
        </View>
        <Txt weight="semi" size={12} color={colors.onTeal}>
          Cash out
        </Txt>
        <Txt weight="bold" size={15} color={colors.white} numberOfLines={2}>
          To your bank or mobile money
        </Txt>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dollar card"
        onPress={() => router.push('/dollar-card')}
        style={({ pressed }) => [
          tiles.tile,
          { backgroundColor: colors.surface },
          pressed && tiles.pressed,
        ]}
      >
        <View style={tiles.card}>
          <DollarCardFace width={56} frozen={card?.card?.frozen} />
        </View>
        <Txt weight="semi" size={12} color={colors.muted}>
          Dollar card
        </Txt>
        <Txt weight="bold" size={15} numberOfLines={2}>
          {card?.card
            ? `•••• ${card.card.last_four}${card.card.frozen ? ' · Frozen' : ''}`
            : 'Spend anywhere'}
        </Txt>
      </Pressable>
    </View>
  )
}

/** The Card tab: the dollar card beside the Ren Card. */
export function DollarCardRow() {
  return (
    <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dollar card. Online and in shops, from your Ren dollars"
        onPress={() => router.push('/dollar-card')}
        style={({ pressed }) => [tiles.wide, pressed && tiles.pressed]}
      >
        <DollarCardFace width={52} />
        <View style={{ flex: 1 }}>
          <Txt weight="semi" size={16}>
            Dollar card
          </Txt>
          <Txt size={13} color={colors.muted}>
            Online and in shops, from your Ren dollars
          </Txt>
        </View>
        <Icon name="arrow" size={18} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  art: { alignItems: 'center', marginTop: 4, height: 150 },
  title: { letterSpacing: -0.8, textAlign: 'center' },
  lead: { lineHeight: 23, marginTop: 8, textAlign: 'center' },
  facts: {
    marginTop: 18,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 13 },
  rule: { borderTopWidth: 1.5, borderColor: colors.sunken },
  listed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 'auto',
    padding: 14,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.tealSoft,
  },
  sandbox: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.sunken,
    marginTop: 10,
  },
})

const tiles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  tile: {
    flex: 1,
    minHeight: 104,
    justifyContent: 'flex-end',
    gap: 2,
    padding: 14,
    paddingTop: 54,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 24,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  card: { position: 'absolute', top: 12, left: 12, transform: [{ rotate: '-8deg' }] },
  icon: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
})
