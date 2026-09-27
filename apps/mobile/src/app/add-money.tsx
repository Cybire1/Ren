import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { isTestnet } from '@/lib/config'
import { formatUsd } from '@/lib/money'
import { colors } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { CoinRain } from '@/ui/motion'
import { Stage } from '@/ui/Stage'
import { Header, PillButton, Rise, Screen, Sticker, Txt } from '@/ui/primitives'

/**
 * Adding money. On testnet, Kova sends $5 of test AUSD a day from its own testnet treasury. On mainnet this is where
 * card and bank on-ramps go; Kova itself never holds or converts the money (D-012).
 */
export default function AddMoney() {
  const { addMoney, balance } = useWallet()
  const { width } = useWindowDimensions()
  const [stage, setStage] = useState<'ready' | 'adding' | 'done' | 'problem'>('ready')
  const [problem, setProblem] = useState<string | null>(null)

  const add = async () => {
    setStage('adding')
    try {
      await addMoney()
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setStage('done')
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Kova didn’t answer. Try again.')
      setStage('problem')
    }
  }

  return (
    <Screen bg={colors.tealLight}>
      <Header title="Add money" backIcon="close" />
      <View style={{ height: 300 }}>
        {stage === 'adding' || stage === 'done' ? <CoinRain width={width} height={300} /> : null}
        <View style={{ position: 'absolute', left: width / 2 - 95, top: 90 }}>
          <Stage pose={stage === 'done' ? 'cheer' : 'catch'} size={190} />
        </View>
      </View>
      <Rise style={styles.copy}>
        {stage === 'done' ? (
          <>
            <Txt weight="bold" size={48} style={{ letterSpacing: -1.5 }}>
              Money’s in.
            </Txt>
            <Txt size={17} color={colors.onTint} style={styles.body}>
              Your balance is {balance === null ? '…' : formatUsd(balance)}. Go pay a shop or send some to a friend.
            </Txt>
          </>
        ) : isTestnet ? (
          <>
            <Txt weight="semi" size={34} style={{ letterSpacing: -1 }}>
              Free test dollars
            </Txt>
            <Txt size={17} color={colors.onTint} style={styles.body}>
              Kova is running on Monad’s test network. It sends you $5 of test dollars a day to try every payment for real, and pays the gas.
            </Txt>
          </>
        ) : (
          <>
            <Txt weight="semi" size={34} style={{ letterSpacing: -1 }}>
              Add money
            </Txt>
            <Txt size={17} color={colors.onTint} style={styles.body}>
              Card and bank top-ups are coming to Kova. For now, send AUSD on Monad to your address.
            </Txt>
          </>
        )}
        {problem ? (
          <Txt weight="medium" size={15} color={colors.danger} style={{ marginTop: 8 }}>
            {problem}
          </Txt>
        ) : null}
      </Rise>
      {stage !== 'done' && isTestnet ? (
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <Sticker radius={24} style={{ height: 70 }}>
            <View style={styles.row}>
              <Txt size={15} color={colors.muted}>
                Amount
              </Txt>
              <Txt weight="semi" size={15}>
                $5, once a day
              </Txt>
            </View>
          </Sticker>
        </View>
      ) : null}
      <View style={styles.footer}>
        {stage === 'done' ? (
          <PillButton label="Back to home" icon="home" onPress={() => router.back()} />
        ) : isTestnet ? (
          <PillButton label="Add test dollars" icon="plus" loading={stage === 'adding'} onPress={add} />
        ) : (
          <PillButton label="Show my address" icon="receive" onPress={() => router.replace('/receive')} />
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  copy: { paddingHorizontal: 28 },
  body: { lineHeight: 25, marginTop: 10 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  footer: { paddingHorizontal: 20, paddingBottom: 12, marginTop: 'auto' },
})
