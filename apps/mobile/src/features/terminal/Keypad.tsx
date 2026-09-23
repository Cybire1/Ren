import * as Haptics from 'expo-haptics'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { EntryCurrency } from '@/lib/money'
import { colors, fonts } from '@/lib/theme'

/**
 * The counter keypad.
 *
 * In naira the fraction key becomes "00": prices at a Lagos counter are whole hundreds, and
 * every POS there has the same key. In dollars it is the decimal point.
 */
export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'frac' | 'del'

const layout: Key[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'frac', '0', 'del']

const MAX_NAIRA_DIGITS = 9 // ₦999,999,999
const MAX_DOLLAR_DIGITS = 7

/** Applies one key press to the typed value, keeping it valid for the entry currency. */
export function applyKey(value: string, key: Key, currency: EntryCurrency): string {
  if (key === 'del') return value.slice(0, -1)

  if (currency === 'NGN') {
    const next = key === 'frac' ? `${value}00` : value + key
    const trimmed = next.replace(/^0+/, '')
    return trimmed.length > MAX_NAIRA_DIGITS ? value : trimmed
  }

  if (key === 'frac') {
    if (value.includes('.')) return value
    return value === '' ? '0.' : `${value}.`
  }
  const next = value + key
  const [whole = '', decimals] = next.split('.')
  if (decimals !== undefined && decimals.length > 2) return value
  if (whole.length > MAX_DOLLAR_DIGITS) return value
  return whole.length > 1 && whole.startsWith('0') ? next.slice(1) : next
}

export function Keypad({
  currency,
  onKey,
}: {
  currency: EntryCurrency
  onKey: (key: Key) => void
}) {
  return (
    <View style={styles.grid}>
      {layout.map((key) => {
        const label = key === 'del' ? '⌫' : key === 'frac' ? (currency === 'NGN' ? '00' : '.') : key
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={key === 'del' ? 'Delete' : label}
            onPress={() => {
              void Haptics.selectionAsync()
              onKey(key)
            }}
            style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          >
            <Text style={[styles.label, key === 'del' && styles.labelMuted]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  key: {
    width: '33.3333%',
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    backgroundColor: colors.paperRaised,
  },
  keyPressed: { backgroundColor: colors.paper },
  label: { fontFamily: fonts.mono, fontSize: 28, color: colors.ink },
  labelMuted: { color: colors.inkMuted, fontSize: 24 },
})
