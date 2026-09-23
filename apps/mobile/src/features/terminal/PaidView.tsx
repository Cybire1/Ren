import * as Haptics from 'expo-haptics'
import { useEffect, useRef } from 'react'
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { PaymentIntent } from '@/lib/api'
import { formatNaira } from '@/lib/money'
import { colors, fonts } from '@/lib/theme'

/**
 * The alert.
 *
 * In Nigeria a payment is not real until the alert lands, and this screen is that moment
 * for the merchant and the customer across the counter: the whole screen turns settled
 * green, the phone buzzes, and a receipt slip feeds down from the top like thermal paper.
 * This is the one animated moment in the app.
 */
export function PaidView({
  intent,
  naira,
  onNext,
}: {
  intent: PaymentIntent
  naira: number | null
  onNext: () => void
}) {
  const flood = useRef(new Animated.Value(0)).current
  const slip = useRef(new Animated.Value(0)).current

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) {
        flood.setValue(1)
        slip.setValue(1)
        return
      }
      Animated.sequence([
        Animated.timing(flood, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(slip, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start()
    })
  }, [flood, slip])

  const background = flood.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.paper, colors.settled],
  })
  const slipY = slip.interpolate({ inputRange: [0, 1], outputRange: [-260, 0] })

  const paidAt = new Date(intent.paid_at ?? Date.now()).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Animated.View style={[styles.flex, { backgroundColor: background }]}>
      <SafeAreaView style={styles.flex}>
        <Animated.View style={[styles.slip, { transform: [{ translateY: slipY }] }]}>
          <Row label="Time" value={paidAt} />
          <Row label="For" value={intent.reference ?? 'No reference'} />
          <Row label="Charge" value={intent.id.slice(0, 12)} mono />
          <Row label="Settled on" value="Tempo" />
          <View style={styles.perforation} />
        </Animated.View>

        <View style={styles.centre}>
          <Text style={styles.word}>Paid</Text>
          <Text style={styles.amount} accessibilityLabel={`Paid ${naira ?? intent.amount}`}>
            {naira !== null ? formatNaira(naira) : intent.amount}
          </Text>
          <Text style={styles.sub}>{intent.amount} USDC received</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onNext}
          style={({ pressed }) => [styles.next, pressed && styles.nextPressed]}
        >
          <Text style={styles.nextLabel}>Next customer</Text>
        </Pressable>
      </SafeAreaView>
    </Animated.View>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.rowMono]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  slip: {
    marginHorizontal: 24,
    backgroundColor: colors.paperRaised,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
  },
  perforation: {
    marginTop: 10,
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.rule,
    marginHorizontal: -18,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, gap: 16 },
  rowLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.inkMuted },
  rowValue: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink, flexShrink: 1 },
  rowMono: { fontFamily: fonts.mono },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  word: { fontFamily: fonts.sansMedium, fontSize: 22, color: colors.onSettled },
  amount: {
    fontFamily: fonts.monoMedium,
    fontSize: 64,
    letterSpacing: -2,
    color: '#FFFFFF',
    marginTop: 6,
  },
  sub: { fontFamily: fonts.sans, fontSize: 16, color: colors.onSettled, marginTop: 8 },
  next: {
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: colors.paperRaised,
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 3,
  },
  nextPressed: { backgroundColor: colors.onSettled },
  nextLabel: { fontFamily: fonts.sansMedium, fontSize: 17, color: colors.settledDeep },
})
