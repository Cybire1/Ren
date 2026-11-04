import { router } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { settlementToken } from '@/lib/config'
import { formatUsd } from '@/lib/money'
import { colors } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Icon } from './Icon'
import { Sticker, Txt } from './primitives'

/** "USDC", "USDC and USDT", "USDC, USDT and pathUSD" (Hermes has no Intl.ListFormat). */
const andList = (names: string[]) =>
  names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/**
 * Other dollars on Home (app/other-dollars.tsx): USDC, USDT and the like that reached this wallet
 * on Tempo, waiting apart from the balance until they're turned into Ren's dollar. Shown only
 * while there are some.
 */
export function OtherDollarsCard() {
  const { otherDollars } = useWallet()
  if (otherDollars.length === 0) return null
  const total = otherDollars.reduce((sum, h) => sum + h.amount, 0n)
  const names = andList(otherDollars.map((h) => h.dollar.name))
  return (
    <Sticker
      onPress={() => router.push('/other-dollars')}
      fill={colors.tealSoft}
      radius={26}
      lift
      style={{ marginTop: 12 }}
      accessibilityLabel={`Other dollars, ${formatUsd(total)} in ${names}. Add them to your balance as ${settlementToken.symbol}`}
    >
      <View style={styles.row}>
        <View style={styles.icon}>
          <Icon name="swap" size={20} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="heavy" size={12} color={colors.tealDeep} style={styles.kicker}>
            OTHER DOLLARS
          </Txt>
          <Txt weight="heavy" size={20}>
            {formatUsd(total)}
          </Txt>
          <Txt size={13} color={colors.muted} numberOfLines={1}>
            {names}
          </Txt>
        </View>
        <View style={styles.add}>
          <Txt weight="bold" size={14} color={colors.white}>
            Add
          </Txt>
        </View>
      </View>
    </Sticker>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { letterSpacing: 1.2 },
  add: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
})
