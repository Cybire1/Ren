import { router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { currencyInfo, type DisplayCurrency, displayCurrencies } from '@/lib/money'
import { colors, fonts } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { KeyScene } from '@/ui/art'
import { Bob } from '@/ui/motion'
import { Header, PillButton, Rise, Screen, Txt } from '@/ui/primitives'

/** Two steps: who you are, then your face becomes the key. No passwords, no seed phrase. */
export default function Setup() {
  const { create } = useWallet()
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<DisplayCurrency>('USD')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const finish = async () => {
    setBusy(true)
    setProblem(null)
    try {
      await create(name, currency)
      router.replace('/(tabs)')
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const steps = (
    <View accessibilityLabel={`Step ${step} of 2`} style={styles.steps}>
      <View style={[styles.step, step === 1 && styles.stepOn]} />
      <View style={[styles.step, step === 2 && styles.stepOn]} />
    </View>
  )

  if (step === 2)
    return (
      <Screen bg={colors.tealSoft}>
        <Header onBack={() => setStep(1)} right={steps} />
        <View style={styles.center}>
          <Bob duration={3000}>
            <KeyScene size={320} />
          </Bob>
        </View>
        <Rise style={styles.copy}>
          <Txt weight="semi" size={38} style={styles.title}>
            Your face is your key.
          </Txt>
          <Txt size={17} color={colors.onTint} style={styles.body}>
            No passwords and no seed phrase to lose. Only your face can open your wallet or approve a payment.
          </Txt>
          {problem ? (
            <Txt weight="medium" size={15} color={colors.danger} style={{ marginTop: 12 }}>
              {problem}
            </Txt>
          ) : null}
        </Rise>
        <View style={styles.footer}>
          <PillButton label="Turn on Face ID" icon="face" loading={busy} onPress={finish} />
        </View>
      </Screen>
    )

  return (
    <Screen bg={colors.paper}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header right={steps} />
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Txt weight="semi" size={34} style={styles.title}>
            What should people call you?
          </Txt>
          <Txt size={16} color={colors.muted} style={{ marginTop: 8 }}>
            This is the name people see when you pay them or ask them for money.
          </Txt>
          <TextInput
            value={name}
            onChangeText={setName}
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
                  onPress={() => setCurrency(c)}
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
            Your money is held in dollars. {currency === 'USD' ? 'No conversion needed.' : `We show it in ${currencyInfo[currency].name.toLowerCase()} at a reference rate.`}
          </Txt>
        </ScrollView>
        <View style={styles.footer}>
          <PillButton label="Continue" disabled={name.trim().length < 2} onPress={() => setStep(2)} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', gap: 6, marginRight: 4 },
  step: { width: 18, height: 8, borderRadius: 4, backgroundColor: 'rgba(13,13,18,0.2)' },
  stepOn: { width: 36, backgroundColor: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  copy: { paddingHorizontal: 28, paddingBottom: 12 },
  title: { letterSpacing: -1, lineHeight: 40 },
  body: { lineHeight: 25, marginTop: 12 },
  footer: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
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
