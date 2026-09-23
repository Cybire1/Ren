import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { SafeAreaView } from 'react-native-safe-area-context'
import { type PaymentIntent, payLinkFor } from '@/lib/api'
import { formatNaira } from '@/lib/money'
import { colors, fonts } from '@/lib/theme'

/**
 * The screen the merchant turns toward the customer.
 *
 * It is read from across a counter, so it says only what the customer needs: who they are
 * paying, how much, and how. Everything is centered because it is a display, not a form.
 */
export function WaitingView({
  intent,
  naira,
  merchantName,
  onCancel,
}: {
  intent: PaymentIntent
  naira: number | null
  merchantName: string
  onCancel: () => void
}) {
  const { width } = useWindowDimensions()
  const qrSize = Math.min(width - 128, 248)

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.centre}>
        <Text style={styles.payee}>Pay {merchantName}</Text>
        <Text style={styles.amount}>{naira !== null ? formatNaira(naira) : intent.amount}</Text>
        <Text style={styles.settle}>{intent.amount} USDC</Text>
        {intent.reference ? <Text style={styles.reference}>{intent.reference}</Text> : null}

        <View style={styles.qr}>
          <QRCode
            value={payLinkFor(intent)}
            size={qrSize}
            color={colors.ink}
            backgroundColor={colors.paperRaised}
          />
        </View>

        <Text style={styles.how}>Scan with Kova Pay or any Tempo wallet</Text>
        <View style={styles.waiting}>
          <View style={styles.dot} />
          <Text style={styles.waitingText}>Waiting for payment</Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancel}>
        <Text style={styles.cancelText}>Cancel charge</Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  payee: { fontFamily: fonts.sans, fontSize: 17, color: colors.inkMuted },
  amount: {
    fontFamily: fonts.monoMedium,
    fontSize: 52,
    letterSpacing: -2,
    color: colors.ink,
    marginTop: 4,
  },
  settle: { fontFamily: fonts.mono, fontSize: 15, color: colors.inkMuted, marginTop: 2 },
  reference: { fontFamily: fonts.sans, fontSize: 15, color: colors.ink, marginTop: 10 },
  qr: {
    marginTop: 28,
    padding: 18,
    backgroundColor: colors.paperRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  how: { fontFamily: fonts.sans, fontSize: 14, color: colors.inkMuted, marginTop: 18 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.pending },
  waitingText: { fontFamily: fonts.sans, fontSize: 14, color: colors.pending },
  cancel: { alignSelf: 'center', padding: 16, marginBottom: 4 },
  cancelText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.inkMuted,
    textDecorationLine: 'underline',
  },
})
