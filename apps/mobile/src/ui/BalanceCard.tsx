import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { isTestnet } from '@/lib/config'
import { baseToNumber, type DisplayCurrency, formatLocal, formatUsd } from '@/lib/money'
import { usePrefs } from '@/lib/prefs'
import { colors } from '@/lib/theme'
import { Coin, Reni, Sparkle } from './art'
import { Icon } from './Icon'
import { WAVES } from './Logo'
import { Bob, Breathe, Landing, Twinkle } from './motion'
import { Odometer } from './Odometer'
import { Sticker, Txt } from './primitives'

/** Money that has only just arrived, shown on the card for a moment: "+$12.00 from Ade, just now". */
export type Fresh = { id: string; line: string }

/** The amount's size: as large as the figures allow on a phone, smaller as the balance grows. */
const amountSize = (figures: number) => (figures <= 4 ? 68 : figures <= 6 ? 56 : figures <= 8 ? 46 : 38)

/**
 * The balance, as the first thing on Home: money at rest on a solid teal card, standing on the
 * same hard ink shadow as everything you can press. Whole dollars roll into place like a till's
 * counter, with the sign and cents set small and raised like a price tag. Money that has only
 * just landed shows as a chip for a moment; otherwise the chips say what the dollars are.
 */
export function BalanceCard({
  balance,
  currency,
  fresh,
}: {
  balance: bigint | null
  currency: DisplayCurrency
  fresh?: Fresh | null
}) {
  const { hideBalance, setHideBalance } = usePrefs()
  const usd = balance === null ? null : formatUsd(balance)
  const point = usd ? usd.lastIndexOf('.') : -1
  const whole = usd === null ? null : usd.slice(1, point)
  const cents = usd === null ? '' : usd.slice(point)
  const size = amountSize(whole?.length ?? 1)
  const local = balance !== null && currency !== 'USD' ? formatLocal(baseToNumber(balance), currency) : null

  return (
    <Sticker lift fill={colors.teal} radius={28} style={styles.frame} innerStyle={styles.card}>
      <Waves />
      <View style={styles.coins} pointerEvents="none">
        <Bob distance={5} duration={5000} delay={900} style={styles.coinBack}>
          <View style={{ transform: [{ rotate: '10deg' }] }}>
            <Coin size={40} symbol="€" />
          </View>
        </Bob>
        <Bob distance={5} duration={5000} style={styles.coinFront}>
          <View style={{ transform: [{ rotate: '-6deg' }] }}>
            <Coin size={58} symbol="$" />
          </View>
        </Bob>
      </View>

      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hideBalance ? 'Show balance' : 'Hide balance'}
          hitSlop={6}
          onPress={() => {
            void Haptics.selectionAsync()
            setHideBalance(!hideBalance)
          }}
          style={styles.label}
        >
          <Txt weight="bold" size={15}>
            Available
          </Txt>
          <Icon name={hideBalance ? 'eyeOff' : 'eye'} size={19} />
        </Pressable>
        <Sticker
          lift
          radius={22}
          fill={colors.card}
          onPress={() => router.push('/add-money')}
          accessibilityLabel="Add money"
          innerStyle={styles.add}
        >
          <Icon name="plus" size={17} strokeWidth={2.6} />
          <Txt weight="heavy" size={15}>
            Add
          </Txt>
        </Sticker>
      </View>

      <View style={styles.amount}>
        {hideBalance ? (
          <Txt weight="heavy" size={44} accessibilityLabel="Balance hidden" style={styles.hidden}>
            ••••••
          </Txt>
        ) : whole === null ? (
          <View accessible accessibilityLabel="Balance loading" style={styles.waiting}>
            <Txt weight="heavy" size={30} style={styles.sign} importantForAccessibility="no" accessibilityElementsHidden>
              $
            </Txt>
            <Breathe style={styles.waitBar} />
          </View>
        ) : (
          <>
            <Txt weight="heavy" size={30} exact style={[styles.sign, { marginTop: size * 0.2 }]} importantForAccessibility="no" accessibilityElementsHidden>
              $
            </Txt>
            <Odometer value={whole} size={size} label={`Available, ${usd}`} />
            <Txt
              weight="heavy"
              size={30}
              exact
              color={colors.onTint}
              style={[styles.cents, { marginTop: size * 0.2 }]}
              importantForAccessibility="no"
              accessibilityElementsHidden
            >
              {cents}
            </Txt>
          </>
        )}
      </View>

      <View style={styles.chips}>
        {fresh ? (
          <Landing key={fresh.id} active delay={1500} rest={colors.onTeal} style={[styles.chip, styles.fresh]}>
            <Icon name="upRight" size={15} strokeWidth={2.8} />
            <Txt weight="heavy" size={13} numberOfLines={1}>
              {fresh.line}
            </Txt>
          </Landing>
        ) : (
          <>
            {local ? (
              <View style={styles.chip}>
                <Txt weight="bold" size={13}>
                  {hideBalance ? '≈ ••••' : `≈ ${local}`}
                </Txt>
              </View>
            ) : null}
            {isTestnet ? (
              <View style={styles.chip}>
                <Txt weight="heavy" size={12}>
                  Test dollars
                </Txt>
              </View>
            ) : null}
          </>
        )}
      </View>
    </Sticker>
  )
}

/**
 * The balance card on a brand-new wallet: an honest $0.00, the one thing to do next, and Reni
 * catching the first coin.
 */
export function ReadyCard() {
  return (
    <Sticker lift fill={colors.teal} radius={28} style={styles.frame} innerStyle={[styles.card, styles.ready]}>
      <Waves />
      <View pointerEvents="none" style={styles.reni}>
        <Bob distance={6} duration={4500}>
          <Reni pose="catch" size={132} />
        </Bob>
      </View>
      <Twinkle style={styles.sparkA}>
        <Sparkle size={20} />
      </Twinkle>
      <Twinkle delay={700} style={styles.sparkB}>
        <Sparkle size={14} fill={colors.white} />
      </Twinkle>

      <View style={styles.top}>
        <View style={styles.label}>
          <Txt weight="bold" size={15}>
            Available
          </Txt>
        </View>
        {isTestnet ? (
          <View style={styles.chip}>
            <Txt weight="heavy" size={12}>
              Test dollars
            </Txt>
          </View>
        ) : null}
      </View>
      <View style={[styles.amount, { marginTop: 2 }]} accessible accessibilityLabel="Available, $0.00">
        <Txt weight="heavy" size={30} exact style={[styles.sign, { marginTop: 14 }]}>
          $
        </Txt>
        <Txt weight="heavy" size={68} exact style={{ lineHeight: 79, letterSpacing: -2.4 }}>
          0
        </Txt>
        <Txt weight="heavy" size={30} exact color={colors.onTint} style={[styles.cents, { marginTop: 14 }]}>
          .00
        </Txt>
      </View>
      <Txt weight="heavy" size={16} style={{ marginTop: 2 }}>
        Your wallet is ready.
      </Txt>
      <View style={styles.readyRow}>
        <Sticker
          lift
          radius={26}
          fill={colors.card}
          onPress={() => router.push('/add-money')}
          accessibilityLabel={isTestnet ? 'Add 5 test dollars, free' : 'Add money'}
          innerStyle={styles.readyButton}
        >
          <Txt weight="heavy" size={15}>
            {isTestnet ? 'Add $5, free' : 'Add money'}
          </Txt>
          <View style={styles.readyDisc}>
            <Icon name="plus" size={17} strokeWidth={2.8} />
          </View>
        </Sticker>
      </View>
    </Sticker>
  )
}

/** The logo's tap waves, drawn faint and large off the card's top right corner. */
function Waves() {
  return (
    <Svg width={200} height={200} viewBox="0 0 200 200" style={styles.waves} pointerEvents="none">
      {WAVES.map((d) => (
        <Path key={d} d={d} stroke={colors.ink} strokeWidth={11} strokeLinecap="round" fill="none" />
      ))}
    </Svg>
  )
}

const styles = StyleSheet.create({
  waiting: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    height: 66,
  },
  waitBar: {
    width: 128,
    height: 48,
    marginTop: 8,
    marginLeft: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 35, 63, 0.14)',
  },
  frame: { marginTop: 16 },
  card: { paddingLeft: 20, paddingRight: 14, paddingTop: 10, paddingBottom: 18 },
  ready: { minHeight: 244 },
  waves: { position: 'absolute', right: -58, top: -26, opacity: 0.16 },
  coins: { position: 'absolute', right: 16, bottom: 14, width: 92, height: 104 },
  coinFront: { position: 'absolute', right: 6, bottom: 0 },
  coinBack: { position: 'absolute', right: 0, top: 4 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44 },
  add: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 16 },
  amount: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, paddingRight: 64 },
  sign: { marginRight: 3 },
  cents: { marginLeft: 5, letterSpacing: -0.6 },
  hidden: { letterSpacing: 4, lineHeight: 72 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingRight: 88, minHeight: 30 },
  chip: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.onTeal,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fresh: { paddingLeft: 8, maxWidth: '100%' },
  reni: { position: 'absolute', right: 0, bottom: 0 },
  sparkA: { position: 'absolute', right: 128, bottom: 124 },
  sparkB: { position: 'absolute', right: 16, bottom: 140 },
  readyRow: { flexDirection: 'row', marginTop: 16 },
  readyButton: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 18, paddingRight: 5 },
  readyDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
