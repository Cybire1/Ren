import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { colors } from '@/lib/theme'
import { Reni, reniFeet, ReceiptTerminal, receipt } from './art'
import { Burst, Hop } from './motion'

/** The shared "it worked" moment: a receipt prints, Reni cheers on top, sparkles burst. */
export function PaidScene({ amount, height = 320 }: { amount: string; height?: number }) {
  const { width } = useWindowDimensions()
  const cx = width / 2
  const terminalTop = height - 250
  const reni = 130
  // Stand Reni's feet on the receipt's top edge.
  const reniTop = terminalTop + 250 * receipt.top - reni * reniFeet('cheer')
  return (
    <View style={{ height, width }}>
      <View style={[styles.receipt, { left: cx - 120, top: terminalTop }]}>
        <ReceiptTerminal amount={amount} width={240} />
      </View>
      <Hop style={{ position: 'absolute', left: cx - reni / 2, top: reniTop }}>
        <Reni pose="cheer" size={reni} />
      </Hop>
      <Burst
        spots={[
          { x: cx - 150, y: height - 250, size: 28, fill: colors.white, delay: 0 },
          { x: cx + 150, y: height - 270, size: 32, fill: colors.coralSoft, delay: 150 },
          { x: cx + 120, y: height - 110, size: 22, fill: colors.white, delay: 300 },
          { x: cx - 130, y: height - 80, size: 24, fill: colors.yellow, delay: 450 },
          { x: cx - 90, y: height - 300, size: 18, fill: colors.coralSoft, delay: 600 },
          { x: cx + 80, y: height - 320, size: 20, fill: colors.yellow, delay: 200 },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  receipt: { position: 'absolute' },
})
