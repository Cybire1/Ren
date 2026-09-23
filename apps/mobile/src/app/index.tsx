import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { applyKey, type Key, Keypad } from '@/features/terminal/Keypad'
import { PaidView } from '@/features/terminal/PaidView'
import { WaitingView } from '@/features/terminal/WaitingView'
import { createCharge, getIntent, getMerchant, type PaymentIntent } from '@/lib/api'
import { type EntryCurrency, groupDigits, nairaToUsdc, ngnPerUsd } from '@/lib/money'
import { colors, fonts } from '@/lib/theme'

/**
 * Kova Terminal: what a merchant holds at the counter.
 *
 * Type the price in naira (or dollars), charge, turn the phone to the customer, and watch
 * it settle. Card taps are added on top of this same flow; the QR path already works end
 * to end against Tempo.
 */

type Stage = 'amount' | 'waiting' | 'paid' | 'problem'

export default function Terminal() {
  const [stage, setStage] = useState<Stage>('amount')
  const [currency, setCurrency] = useState<EntryCurrency>('NGN')
  const [typed, setTyped] = useState('')
  const [reference, setReference] = useState('')
  const [intent, setIntent] = useState<PaymentIntent | null>(null)
  const [naira, setNaira] = useState<number | null>(null)
  const [merchantName, setMerchantName] = useState('this shop')
  const [problem, setProblem] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    getMerchant()
      .then((merchant) => setMerchantName(merchant.name))
      .catch(() => {})
  }, [])

  const usdc =
    currency === 'NGN'
      ? typed === ''
        ? '0.00'
        : nairaToUsdc(Number(typed))
      : typed === ''
        ? '0.00'
        : Number(typed).toFixed(2)
  const canCharge = Number(usdc) > 0 && !starting

  const onKey = useCallback((key: Key) => setTyped((v) => applyKey(v, key, currency)), [currency])

  const switchCurrency = () => {
    setTyped('')
    setCurrency((c) => (c === 'NGN' ? 'USD' : 'NGN'))
  }

  const start = async () => {
    setStarting(true)
    setProblem(null)
    const entered = currency === 'NGN' ? Number(typed) : null
    try {
      const created = await createCharge(usdc, {
        reference: reference.trim() || undefined,
        metadata:
          entered !== null ? { price_ngn: entered, ngn_per_usd: ngnPerUsd } : { price_usd: usdc },
      })
      setNaira(entered)
      setIntent(created)
      setStage('waiting')
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The charge could not be started.')
      setStage('problem')
    } finally {
      setStarting(false)
    }
  }

  // While the customer pays, ask the API what happened to the charge.
  useEffect(() => {
    if (stage !== 'waiting' || !intent) return
    let cancelled = false
    const id = setInterval(async () => {
      try {
        const latest = await getIntent(intent.id)
        if (cancelled) return
        setIntent(latest)
        if (latest.status === 'paid') setStage('paid')
        else if (['failed', 'expired', 'canceled', 'held'].includes(latest.status)) {
          setProblem(problemFor(latest.status))
          setStage('problem')
        }
      } catch {
        // A dropped poll is not a failed payment; keep waiting.
      }
    }, 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [stage, intent])

  const reset = () => {
    setTyped('')
    setReference('')
    setIntent(null)
    setNaira(null)
    setProblem(null)
    setStage('amount')
  }

  if (stage === 'paid' && intent) return <PaidView intent={intent} naira={naira} onNext={reset} />

  if (stage === 'waiting' && intent)
    return (
      <WaitingView intent={intent} naira={naira} merchantName={merchantName} onCancel={reset} />
    )

  if (stage === 'problem')
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.problem}>
          <Text style={styles.problemTitle}>This charge did not go through</Text>
          <Text style={styles.problemBody}>{problem}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={reset} style={styles.charge}>
          <Text style={styles.chargeLabel}>Start a new charge</Text>
        </Pressable>
      </SafeAreaView>
    )

  const display = currency === 'NGN' ? groupDigits(typed) : typed === '' ? '0' : typed

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.merchant} numberOfLines={1}>
          {merchantName}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Enter prices in ${currency === 'NGN' ? 'dollars' : 'naira'}`}
          onPress={switchCurrency}
          style={styles.toggle}
        >
          <Text style={[styles.toggleSide, currency === 'NGN' && styles.toggleActive]}>₦</Text>
          <Text style={[styles.toggleSide, currency === 'USD' && styles.toggleActive]}>$</Text>
        </Pressable>
      </View>

      <View style={styles.entry}>
        <Text
          style={[styles.amount, typed === '' && styles.amountEmpty]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {currency === 'NGN' ? '₦' : '$'}
          {display}
        </Text>
        <Text style={styles.conversion}>
          {currency === 'NGN'
            ? `${usdc} USDC at ₦${ngnPerUsd.toLocaleString('en-NG')} per dollar`
            : `${usdc} USDC`}
        </Text>
        <TextInput
          style={styles.reference}
          value={reference}
          onChangeText={setReference}
          placeholder="What's it for? (optional)"
          placeholderTextColor={colors.inkMuted}
          maxLength={60}
          returnKeyType="done"
        />
      </View>

      <Keypad currency={currency} onKey={onKey} />

      <Pressable
        accessibilityRole="button"
        disabled={!canCharge}
        onPress={start}
        style={({ pressed }) => [
          styles.charge,
          !canCharge && styles.chargeDisabled,
          pressed && styles.chargePressed,
        ]}
      >
        <Text style={[styles.chargeLabel, !canCharge && styles.chargeLabelDisabled]}>
          {starting
            ? 'Starting charge…'
            : canCharge
              ? `Charge ${currency === 'NGN' ? `₦${groupDigits(typed)}` : `$${usdc}`}`
              : 'Enter an amount'}
        </Text>
      </Pressable>
    </SafeAreaView>
  )
}

function problemFor(status: PaymentIntent['status']): string {
  switch (status) {
    case 'expired':
      return 'Nobody paid it in time. Start the charge again when the customer is ready.'
    case 'held':
      return "The customer's payment was stopped by the receiving wallet's rules. Check this shop's settlement wallet."
    case 'canceled':
      return 'The charge was canceled.'
    default:
      return 'The payment failed on-chain. No money moved. Start the charge again.'
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 16,
  },
  merchant: { fontFamily: fonts.sansSemi, fontSize: 17, color: colors.ink, flexShrink: 1 },
  toggle: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    borderRadius: 3,
    overflow: 'hidden',
  },
  toggleSide: {
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.inkMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleActive: { backgroundColor: colors.ink, color: colors.paperRaised },
  entry: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 16 },
  amount: {
    fontFamily: fonts.monoMedium,
    fontSize: 64,
    letterSpacing: -2,
    color: colors.ink,
    textAlign: 'right',
  },
  amountEmpty: { color: colors.rule },
  conversion: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  reference: {
    marginTop: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rule,
    paddingVertical: 10,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.ink,
  },
  charge: {
    backgroundColor: colors.ink,
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 3,
  },
  chargeDisabled: { backgroundColor: colors.rule },
  chargePressed: { backgroundColor: colors.settled },
  chargeLabel: { fontFamily: fonts.sansMedium, fontSize: 17, color: colors.paperRaised },
  chargeLabelDisabled: { color: colors.inkMuted },
  problem: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  problemTitle: { fontFamily: fonts.sansSemi, fontSize: 22, color: colors.ink },
  problemBody: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkMuted,
    marginTop: 10,
  },
})
