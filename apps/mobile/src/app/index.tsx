import { useCallback, useEffect, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'
import { createCharge, getIntent, payLinkFor, type PaymentIntent } from '@/lib/api'
import { theme } from '@/lib/theme'

/**
 * Kova Terminal: what a merchant holds at the counter.
 *
 * Type an amount, take the payment, see it settle. The NFC tap is added on top of this same
 * screen; until a card is in hand, the QR path exercises the whole flow.
 */

type Stage = 'amount' | 'waiting' | 'paid' | 'problem'

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const

function applyKey(current: string, key: (typeof keys)[number]): string {
  if (key === 'del') return current.slice(0, -1)
  if (key === '.') return current.includes('.') ? current : current === '' ? '0.' : `${current}.`
  const next = current + key
  const [, decimals] = next.split('.')
  if (decimals && decimals.length > 2) return current
  if (next.replace('.', '').length > 9) return current
  return next.startsWith('0') && !next.startsWith('0.') ? next.slice(1) : next
}

export default function Terminal() {
  const [stage, setStage] = useState<Stage>('amount')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [intent, setIntent] = useState<PaymentIntent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { width } = useWindowDimensions()

  const value = amount === '' ? '0' : amount
  const canCharge = Number(value) > 0

  const start = useCallback(async () => {
    setError(null)
    try {
      const created = await createCharge(Number(value).toFixed(2), reference.trim() || undefined)
      setIntent(created)
      setStage('waiting')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the charge')
      setStage('problem')
    }
  }, [value, reference])

  useEffect(() => {
    if (stage !== 'waiting' || !intent) return
    let cancelled = false
    const id = setInterval(async () => {
      try {
        const latest = await getIntent(intent.id)
        if (cancelled) return
        setIntent(latest)
        if (latest.status === 'paid') setStage('paid')
        else if (['failed', 'expired', 'canceled', 'held'].includes(latest.status))
          setStage('problem')
      } catch {
        /* a dropped poll is not a failed payment */
      }
    }, 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [stage, intent])

  const reset = () => {
    setAmount('')
    setReference('')
    setIntent(null)
    setError(null)
    setStage('amount')
  }

  if (stage === 'paid' && intent)
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.paidMark}>✓</Text>
        <Text style={styles.paidAmount}>{intent.amount}</Text>
        <Text style={styles.muted}>
          Paid{intent.reference ? ` · ${intent.reference}` : ''}
        </Text>
        <Pressable style={styles.button} onPress={reset}>
          <Text style={styles.buttonText}>Next charge</Text>
        </Pressable>
      </SafeAreaView>
    )

  if (stage === 'problem')
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.problemTitle}>
          {error ? 'Could not start the charge' : `Charge ${intent?.status}`}
        </Text>
        <Text style={[styles.muted, styles.problemBody]}>{error ?? 'Try the charge again.'}</Text>
        <Pressable style={styles.button} onPress={reset}>
          <Text style={styles.buttonText}>Start again</Text>
        </Pressable>
      </SafeAreaView>
    )

  if (stage === 'waiting' && intent)
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.waitAmount}>{intent.amount}</Text>
        <Text style={[styles.muted, styles.waitLabel]}>
          {intent.reference ? `${intent.reference} · ` : ''}Scan to pay
        </Text>
        <View style={styles.qr}>
          <QRCode
            value={payLinkFor(intent)}
            size={Math.min(width - 120, 260)}
            color={theme.ink}
            backgroundColor={theme.paperRaised}
          />
        </View>
        <Text style={[styles.muted, styles.waitHint]}>Waiting for payment.</Text>
        <Pressable onPress={reset}>
          <Text style={styles.link}>Cancel</Text>
        </Pressable>
      </SafeAreaView>
    )

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.amountArea} keyboardShouldPersistTaps="handled">
        <Text style={styles.wordmark}>
          Kova <Text style={styles.muted}>Terminal</Text>
        </Text>
        <View style={styles.amountRow}>
          <Text style={[styles.amount, amount === '' && styles.amountEmpty]}>{value}</Text>
          <Text style={styles.amountUnit}>USDC</Text>
        </View>
        <TextInput
          style={styles.reference}
          value={reference}
          onChangeText={setReference}
          placeholder="What is it for? (optional)"
          placeholderTextColor={theme.inkMuted}
          maxLength={60}
        />
      </ScrollView>

      <View style={styles.keypad}>
        {keys.map((key) => (
          <Pressable
            key={key}
            style={styles.key}
            onPress={() => setAmount((current) => applyKey(current, key))}
          >
            <Text style={styles.keyText}>{key === 'del' ? '⌫' : key}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.chargeBar, !canCharge && styles.chargeBarDisabled]}
        disabled={!canCharge}
        onPress={start}
      >
        <Text style={styles.chargeText}>
          Charge{canCharge ? ` ${Number(value).toFixed(2)}` : ''}
        </Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.paper },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: theme.inkMuted },
  wordmark: { fontSize: 15, fontWeight: '600', color: theme.ink },
  amountArea: { padding: 20, paddingTop: 16 },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 28 },
  amount: {
    fontFamily: theme.mono,
    fontSize: 56,
    color: theme.ink,
    letterSpacing: -2,
  },
  amountEmpty: { color: theme.rule },
  amountUnit: { color: theme.inkMuted, fontSize: 16, marginBottom: 10 },
  reference: {
    marginTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.rule,
    paddingVertical: 8,
    fontSize: 15,
    color: theme.ink,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: theme.rule,
    marginHorizontal: 20,
  },
  key: {
    width: '33.333%',
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: theme.paperRaised,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.rule,
  },
  keyText: { fontFamily: theme.mono, fontSize: 24, color: theme.ink },
  chargeBar: {
    backgroundColor: theme.ink,
    margin: 20,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 2,
  },
  chargeBarDisabled: { backgroundColor: '#3A423E' },
  chargeText: { color: theme.paperRaised, fontSize: 17 },
  button: {
    backgroundColor: theme.ink,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 2,
    marginTop: 32,
  },
  buttonText: { color: theme.paperRaised, fontSize: 16 },
  link: { color: theme.inkMuted, marginTop: 24, textDecorationLine: 'underline' },
  paidMark: { fontSize: 56, color: theme.settled },
  paidAmount: {
    fontFamily: theme.mono,
    fontSize: 56,
    color: theme.settled,
    letterSpacing: -2,
    marginTop: 8,
  },
  waitAmount: { fontFamily: theme.mono, fontSize: 40, color: theme.ink, letterSpacing: -1 },
  waitLabel: { marginTop: 4, marginBottom: 28 },
  waitHint: { marginTop: 24 },
  qr: {
    padding: 20,
    backgroundColor: theme.paperRaised,
    borderWidth: 1,
    borderColor: theme.rule,
  },
  problemTitle: { fontSize: 18, color: theme.ink, textAlign: 'center' },
  problemBody: { marginTop: 8, textAlign: 'center' },
})
