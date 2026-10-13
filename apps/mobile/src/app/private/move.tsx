import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { chainName } from '@/lib/config'
import { applyKey, formatUsd, groupTyped, type Key, toBase } from '@/lib/money'
import { useSessionCovers } from '@/lib/session'
import { colors } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Reni } from '@/ui/art'
import { Icon } from '@/ui/Icon'
import { Keypad } from '@/ui/Keypad'
import { Header, PillButton, Screen, Txt } from '@/ui/primitives'
import { SlideToSend } from '@/ui/send/SlideToSend'

type Step = 'amount' | 'review' | 'done'

/**
 * Moving dollars between your balance and your private balance: how much, a look at what Tempo
 * will see, slide, done. Moving in lands in a second or two; moving out lands back in your balance
 * once the zone settles its next batch on Tempo, seconds later.
 */
export default function MoveScreen() {
  const { dir } = useLocalSearchParams<{ dir?: string }>()
  const into = dir !== 'out'
  const { balance, privacy } = useWallet()
  const [step, setStep] = useState<Step>('amount')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [took, setTook] = useState<number | null>(null)

  // Moving out keeps back what the zone charges for gas, where it charges any.
  const available = into
    ? balance
    : privacy.balance === null
      ? null
      : privacy.balance > privacy.outReserve
        ? privacy.balance - privacy.outReserve
        : 0n
  const onKey = useCallback((key: Key) => setTyped((v) => applyKey(v, key, 2)), [])
  const amount = useMemo(() => {
    try {
      return typed && Number(typed) > 0 ? toBase(Number(typed).toFixed(2)) : 0n
    } catch {
      return 0n
    }
  }, [typed])
  const over = available !== null && amount > available
  const quick = useSessionCovers(amount)
  const locked = !into && privacy.status !== 'ready'

  const go = async () => {
    setBusy(true)
    setProblem(null)
    try {
      const moved = into ? await privacy.moveIn(amount) : await privacy.moveOut(amount)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setTook(moved.ms)
      setStep('done')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t move.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(false)
    }
  }

  const title = into ? 'Move in' : 'Move out'
  const from = into ? 'Your balance' : 'Private balance'
  const to = into ? 'Private balance' : 'Your balance'

  if (locked)
    return (
      <Screen>
        <Header title={title} backIcon="close" />
        <View style={styles.center}>
          <Reni pose="key" size={140} />
          <Txt weight="heavy" size={22} style={{ textAlign: 'center' }}>
            Show your private balance first
          </Txt>
          <Txt color={colors.muted} style={{ textAlign: 'center' }}>
            Moving out comes from your private balance, so the zone needs to know it’s you.
          </Txt>
          <View style={{ alignSelf: 'stretch' }}>
            <PillButton
              label={privacy.status === 'opening' ? 'Opening…' : 'Show with Face ID'}
              icon="face"
              loading={privacy.status === 'opening'}
              onPress={() =>
                void privacy.open().catch((e: Error) => {
                  if (!/cancel/i.test(e.message)) setProblem(e.message)
                })
              }
            />
          </View>
          {problem ? <Txt color={colors.danger}>{problem}</Txt> : null}
        </View>
      </Screen>
    )

  return (
    <Screen>
      <Header
        title={step === 'done' ? undefined : title}
        backIcon={step === 'review' ? 'back' : 'close'}
        onBack={step === 'review' && !busy ? () => setStep('amount') : busy ? null : () => router.back()}
      />
      {step === 'amount' ? (
        <View style={styles.flow}>
          <View style={styles.route}>
            <View style={[styles.badge, !into && styles.badgeOut]}>
              <Icon name={into ? 'down' : 'up'} size={20} color={into ? colors.tealSoft : colors.white} />
            </View>
            <Txt size={14} color={colors.muted}>
              {from} to {to.toLowerCase()}
            </Txt>
          </View>
          <View style={styles.typed}>
            <Txt weight="semi" size={30} color={colors.muted} style={{ marginTop: 10 }}>
              $
            </Txt>
            <Txt weight="heavy" size={64} exact>
              {groupTyped(typed) || '0'}
            </Txt>
          </View>
          <View style={styles.pills}>
            {available !== null ? (
              <View style={[styles.pill, over && styles.pillOver]}>
                <Txt weight="semi" size={14} color={over ? colors.danger : colors.onTint}>
                  {over
                    ? `${into ? 'You have' : 'Private balance:'} ${formatUsd(available)}`
                    : `${formatUsd(available)} ${into ? 'available' : 'private'}`}
                </Txt>
              </View>
            ) : null}
            {available !== null && available > 0n ? (
              <View style={[styles.pill, { backgroundColor: colors.tealSoft }]}>
                <Txt weight="semi" size={14} onPress={() => setTyped((Number(available) / 1e6).toFixed(2))}>
                  All of it
                </Txt>
              </View>
            ) : null}
          </View>
          <View style={{ flex: 1 }} />
          <Keypad onKey={onKey} />
          <View style={{ marginTop: 14 }}>
            <PillButton label={over ? 'More than you have' : 'Review'} disabled={amount === 0n || over} onPress={() => setStep('review')} />
          </View>
        </View>
      ) : null}

      {step === 'review' ? (
        <View style={styles.flow}>
          <Txt weight="heavy" size={22}>
            {busy ? (into ? 'Moving in' : 'Moving out') : 'Check and move'}
          </Txt>
          <View style={styles.arc}>
            <End icon={into ? 'eye' : 'lock'} label={from} ink={!into} />
            <View style={styles.dots}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={styles.dot} />
              ))}
            </View>
            <End icon={into ? 'lock' : 'eye'} label={to} ink={into} />
          </View>
          <Txt weight="heavy" size={44} style={{ textAlign: 'center' }} exact>
            {formatUsd(amount)}
          </Txt>
          <Txt color={colors.muted} style={{ textAlign: 'center' }}>
            {into ? 'Out of sight in a second or two' : 'Back in your balance in seconds'}
          </Txt>
          <View style={styles.facts}>
            <Fact
              label="Fee"
              value={
                into
                  ? '$0.00, Ren covers it'
                  : privacy.outReserve > 0n
                    ? `Under ${formatUsd(privacy.outReserve)}, the zone’s gas`
                    : '$0.00'
              }
            />
            <Fact
              label={`${chainName} sees`}
              value={`${formatUsd(amount)} ${into ? 'going in' : 'coming out'}`}
              hint={into ? 'Not what you do with it after' : 'Not what you did with it inside'}
            />
          </View>
          {problem ? (
            <Txt color={colors.danger} style={{ marginTop: 8 }}>
              {problem}
            </Txt>
          ) : null}
          <View style={{ flex: 1 }} />
          <SlideToSend
            label={problem ? 'Slide to try again' : `Slide to move ${formatUsd(amount)} ${into ? 'in' : 'out'}`}
            busy={busy}
            disabled={over || amount === 0n}
            onSend={() => void go()}
          />
          <Txt size={13} color={colors.muted} style={{ textAlign: 'center', marginTop: 8 }}>
            {quick ? 'Your wallet is open, so this one needs no Face ID.' : 'Face ID approves it.'}
          </Txt>
        </View>
      ) : null}

      {step === 'done' ? (
        <View style={styles.center}>
          <Reni pose={into ? 'key' : 'cheer'} size={160} />
          <Txt weight="heavy" size={28} style={{ textAlign: 'center' }}>
            {into ? 'Out of sight' : 'On its way back'}
          </Txt>
          <Txt color={colors.muted} style={{ textAlign: 'center' }}>
            {into
              ? `${formatUsd(amount)} is in your private balance. Only you can see it.`
              : `${formatUsd(amount)} lands in your balance as soon as the zone settles, in seconds.`}
          </Txt>
          {took !== null ? (
            <View style={styles.time}>
              <Icon name="bolt" size={15} color={colors.white} />
              <Txt weight="semi" size={14} color={colors.white}>
                {into ? 'Moved' : 'Requested'} in {(took / 1000).toFixed(2)} s
              </Txt>
            </View>
          ) : null}
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            <PillButton label="Done" icon="check" onPress={() => router.back()} />
          </View>
        </View>
      ) : null}
    </Screen>
  )
}

function End({ icon, label, ink }: { icon: 'eye' | 'lock'; label: string; ink: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 6, width: 104 }}>
      <View style={[styles.end, ink && { backgroundColor: colors.ink }]}>
        <Icon name={icon} size={22} color={ink ? colors.tealSoft : colors.ink} />
      </View>
      <Txt weight="semi" size={13} color={colors.muted}>
        {label}
      </Txt>
    </View>
  )
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.fact}>
      <Txt size={14} color={colors.muted}>
        {label}
      </Txt>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Txt weight="bold" size={14} style={{ textAlign: 'right' }}>
          {value}
        </Txt>
        {hint ? (
          <Txt size={12} color={colors.muted} style={{ textAlign: 'right' }}>
            {hint}
          </Txt>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flow: { flex: 1, paddingHorizontal: 20, paddingBottom: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 },
  route: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  badge: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  badgeOut: { backgroundColor: colors.teal },
  typed: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', marginTop: 28 },
  pills: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 10 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.sunken },
  pillOver: { backgroundColor: colors.coralSoft },
  arc: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 18, marginBottom: 6 },
  end: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', height: 54 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.ink, opacity: 0.55 },
  facts: { marginTop: 16, borderRadius: 20, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, paddingHorizontal: 14 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.ink },
})
