import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { currencyInfo, type DisplayCurrency, displayCurrencies } from '@/lib/money'
import { ratesLive } from '@/lib/rates'
import { colors, fonts } from '@/lib/theme'
import { Txt } from '@/ui/primitives'

/** Who you are to other people, and the currency you think in. Used by setup and by restore. */
export function ProfileForm({
  title,
  subtitle,
  name,
  onName,
  currency,
  onCurrency,
}: {
  title: string
  subtitle: string
  name: string
  onName: (name: string) => void
  currency: DisplayCurrency
  onCurrency: (currency: DisplayCurrency) => void
}) {
  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Txt weight="semi" size={34} style={styles.title}>
        {title}
      </Txt>
      <Txt size={16} color={colors.muted} style={{ marginTop: 8 }}>
        {subtitle}
      </Txt>
      <TextInput
        value={name}
        onChangeText={onName}
        placeholder="Your name"
        placeholderTextColor="#8C9799"
        autoFocus
        autoCapitalize="words"
        autoComplete="name"
        maxLength={40}
        returnKeyType="next"
        style={styles.input}
      />
      <Txt weight="semi" size={18} style={{ marginTop: 32 }}>
        Show my money in
      </Txt>
      <View style={styles.currencies}>
        {displayCurrencies.map((c) => {
          const on = c === currency
          return (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={currencyInfo[c].name}
              onPress={() => onCurrency(c)}
              style={[styles.currency, on && styles.currencyOn]}
            >
              <Txt weight="semi" size={15} color={on ? colors.white : colors.ink}>
                {currencyInfo[c].symbol} {c}
              </Txt>
            </Pressable>
          )
        })}
      </View>
      <Txt size={14} color={colors.muted} style={{ marginTop: 10 }}>
        Your money is held in dollars. {currency === 'USD' ? 'No conversion needed.' : `We show it in ${currencyInfo[currency].name.toLowerCase()} at ${ratesLive() ? 'a live reference rate from Chainlink' : 'a reference rate'}.`}
      </Txt>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  title: { letterSpacing: -1, lineHeight: 40 },
  form: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  input: {
    marginTop: 24,
    height: 60,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: 20,
    fontFamily: fonts.medium,
    fontSize: 20,
    color: colors.ink,
    backgroundColor: colors.sunken,
  },
  currencies: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  currency: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: colors.ink,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  currencyOn: { backgroundColor: colors.ink },
})
