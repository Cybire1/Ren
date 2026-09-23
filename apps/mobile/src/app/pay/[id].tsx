import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { type Checkout, getCheckout } from '@/lib/api'
import { baseToNumber, formatLocal, formatUsd } from '@/lib/money'
import { colors } from '@/lib/theme'
import { type Entry, useWallet } from '@/lib/wallet'
import { ShopBadge } from '@/ui/art'
import { Bob } from '@/ui/motion'
import { PaidScene } from '@/ui/PaidScene'
import { Stage as KoviStage } from '@/ui/Stage'
import { Chip, Header, PillButton, Rise, RoundButton, Screen, Sticker, TextLink, Txt } from '@/ui/primitives'

type Stage = 'loading' | 'review' | 'paying' | 'paid' | 'problem'

/** Paying a shop: see exactly what and to whom, approve with Face ID, and it's done. */
export default function PayCharge() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile, balance, payCheckout } = useWallet()
  const [stage, setStage] = useState<Stage>('loading')
  const [checkout, setCheckout] = useState<Checkout | null>(null)
  const [entry, setEntry] = useState<Entry | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    getCheckout(id)
      .then((c) => {
        setCheckout(c)
        if (c.status === 'requires_payment') setStage('review')
        else {
          setProblem(
            c.status === 'paid'
              ? 'This charge has already been paid.'
              : c.status === 'expired'
                ? 'This charge expired. Ask the shop to show a new code.'
                : 'This charge is no longer open. Ask the shop to start it again.',
          )
          setStage('problem')
        }
      })
      .catch((error: Error) => {
        setProblem(error.message)
        setStage('problem')
      })
  }, [id])

  const pay = async () => {
    if (!checkout) return
    setStage('paying')
    try {
      const done = await payCheckout(checkout)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setEntry(done)
      setStage('paid')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The payment did not go through.'
      if (/cancel/i.test(message)) setStage('review')
      else {
        setProblem(message)
        setStage('problem')
      }
    }
  }

  if (stage === 'loading')
    return (
      <Screen bg={colors.tealSoft} style={styles.centered}>
        <ActivityIndicator color={colors.ink} />
      </Screen>
    )

  if (stage === 'problem' || !checkout)
    return (
      <Screen bg={colors.sunken}>
        <Header backIcon="close" onBack={() => router.replace('/(tabs)')} />
        <View style={styles.centered}>
          <KoviStage pose="oops" size={160} motion="bob" />
          <Txt weight="semi" size={28} style={styles.title}>
            Not this time
          </Txt>
          <Txt size={16} color={colors.onTint} style={styles.body}>
            {problem}
          </Txt>
        </View>
        <View style={styles.footer}>
          <PillButton label="Scan again" icon="scan" onPress={() => router.replace('/scan')} />
        </View>
      </Screen>
    )

  const amount = BigInt(checkout.amount_base)
  const short = balance !== null && balance < amount

  if (stage === 'paid' && entry)
    return (
      <Screen bg={colors.sunken}>
        <View style={styles.paidTop}>
          <RoundButton icon="close" label="Close" onPress={() => router.replace('/(tabs)')} />
          <Txt weight="semi" size={18}>
            {checkout.merchant_name}
          </Txt>
          <Chip label="Paid" dot={colors.tealLight} />
        </View>
        <PaidScene amount={formatUsd(amount)} height={330} />
        <Rise style={styles.paidCopy}>
          <Txt weight="bold" size={64} style={{ letterSpacing: -2 }}>
            Paid!
          </Txt>
          <Txt weight="medium" size={22}>
            {formatUsd(amount)} to {checkout.merchant_name}
          </Txt>
        </Rise>
        <View style={{ paddingHorizontal: 20 }}>
          <Sticker radius={26}>
            <View style={styles.stats}>
              <Stat label="Took" value={entry.ms ? `${(entry.ms / 1000).toFixed(1)} seconds` : '—'} />
              <Stat label="Fee" value="$0.00" />
              <Stat label="Left" value={balance === null ? '—' : formatUsd(balance)} />
            </View>
          </Sticker>
        </View>
        <View style={[styles.footer, { gap: 14 }]}>
          <PillButton label="Done" icon="check" onPress={() => router.replace('/(tabs)')} />
          <View style={{ alignItems: 'center' }}>
            <TextLink label="See receipt" onPress={() => router.replace({ pathname: '/receipt/[id]', params: { id: entry.id } })} />
          </View>
        </View>
      </Screen>
    )

  return (
    <Screen bg={colors.tealSoft}>
      <Header backIcon="close" title="Confirm" onBack={() => router.replace('/(tabs)')} />
      <View style={styles.review}>
        <Bob>
          <ShopBadge size={96} />
        </Bob>
        <Txt size={18} style={{ marginTop: 18 }}>
          You’re paying
        </Txt>
        <Txt weight="semi" size={26}>
          {checkout.merchant_name}
        </Txt>
        <Txt weight="bold" size={72} style={styles.amount} adjustsFontSizeToFit numberOfLines={1}>
          {formatUsd(amount)}
        </Txt>
        {profile && profile.currency !== 'USD' ? (
          <Txt size={16} color={colors.onTint}>
            about {formatLocal(baseToNumber(amount), profile.currency)}
          </Txt>
        ) : null}
        {checkout.reference ? (
          <View style={styles.note}>
            <Txt weight="medium" size={15}>
              {checkout.reference}
            </Txt>
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 20 }}>
        <Sticker radius={24}>
          <View style={styles.lines}>
            <Line label="From" value={`Your wallet, ${balance === null ? '…' : formatUsd(balance)}`} />
            <Line label="Fee" value="$0.00, Kova covers it" />
          </View>
        </Sticker>
        {short ? (
          <Txt weight="medium" size={15} color={colors.danger} style={{ marginTop: 12, textAlign: 'center' }}>
            You need {formatUsd(amount - (balance ?? 0n))} more. Add money first.
          </Txt>
        ) : null}
      </View>
      <View style={styles.footer}>
        {short ? (
          <PillButton label="Add money" icon="plus" onPress={() => router.push('/add-money')} />
        ) : (
          <PillButton label={`Pay ${formatUsd(amount)}`} icon="face" loading={stage === 'paying'} onPress={pay} />
        )}
      </View>
    </Screen>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Txt size={15} color={colors.muted}>
        {label}
      </Txt>
      <Txt weight="semi" size={15}>
        {value}
      </Txt>
    </View>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Txt size={13} color={colors.muted}>
        {label}
      </Txt>
      <Txt weight="semi" size={15} numberOfLines={1}>
        {value}
      </Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  title: { marginTop: 16, letterSpacing: -0.6 },
  body: { textAlign: 'center', marginTop: 8, lineHeight: 23 },
  footer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, marginTop: 'auto' },
  review: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  amount: { letterSpacing: -2.5, marginTop: 8 },
  note: { marginTop: 14, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.ink, justifyContent: 'center' },
  lines: { paddingHorizontal: 18, paddingVertical: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  paidTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  paidCopy: { alignItems: 'center', marginTop: 4, marginBottom: 18 },
  stats: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8 },
})
