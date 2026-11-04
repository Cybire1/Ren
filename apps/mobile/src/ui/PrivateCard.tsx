import { router } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { formatUsd } from '@/lib/money'
import { colors, pair, palette } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Reni } from './art'
import { Icon } from './Icon'
import { Sticker, Txt } from './primitives'

/**
 * Your private balance on Home (lib/private.ts): a dark card, so it reads as the place out of
 * sight. Money at rest is green across Ren and paying is watermelon; private is ink.
 */
/** Green that glows on the private card's dark ground, in either look. */
const glow = pair(palette.light.tealSoft, palette.dark.teal)

export function PrivateCard() {
  const { privacy } = useWallet()
  if (!privacy.zone) return null
  const shown = privacy.status === 'ready' && privacy.balance !== null
  return (
    <Sticker
      onPress={() => router.push('/private')}
      fill={colors.fill}
      radius={26}
      style={styles.wrap}
      accessibilityLabel={
        shown ? `Private balance ${formatUsd(privacy.balance ?? 0n)}` : 'Private balance, hidden'
      }
    >
      <View style={styles.row}>
        <View style={styles.lock}>
          <Icon name="lock" size={18} color={glow} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="heavy" size={11} color={glow} style={styles.kicker}>
            PRIVATE
          </Txt>
          <Txt weight="bold" size={17} color={colors.white}>
            {shown
              ? formatUsd(privacy.balance ?? 0n)
              : privacy.status === 'opening'
                ? 'Opening…'
                : 'Hidden'}
          </Txt>
          <Txt size={12} color={colors.onInk} numberOfLines={1}>
            {shown
              ? privacy.balance === 0n
                ? 'Keep dollars out of sight'
                : 'Only you can see this'
              : privacy.status === 'unreachable'
                ? 'The private zone isn’t answering'
                : 'Open it with Face ID'}
          </Txt>
        </View>
        <View style={styles.reni}>
          <Reni pose="key" size={48} />
        </View>
        <View style={styles.go}>
          <Icon name="arrow" size={18} />
        </View>
      </View>
    </Sticker>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 12,
  },
  lock: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: pair('#1E3557', '#262626'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { letterSpacing: 1.2 },
  reni: { marginVertical: -10, transform: [{ rotate: '-6deg' }] },
  go: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
