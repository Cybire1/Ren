import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { usePrefs } from '@/lib/prefs'
import { useTerminal } from '@/lib/terminal'
import { colors, fonts } from '@/lib/theme'
import { Kovi, ShopBadge } from '@/ui/art'
import { Icon } from '@/ui/Icon'
import { Bob } from '@/ui/motion'
import { Header, PillButton, Screen, Txt } from '@/ui/primitives'

const LENGTH = 6
const clean = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, LENGTH)

/**
 * Turns this phone into a shop's terminal. The owner opens the Kova dashboard, taps
 * "Add a terminal" and reads out (or shows the QR of) a six-character code; this phone
 * redeems it once for its own key. It can switch back to a wallet any time.
 */
export default function TerminalSetup() {
  const params = useLocalSearchParams<{ code?: string }>()
  const { setMode } = usePrefs()
  const { paired, pair } = useTerminal()
  const [code, setCode] = useState(clean(params.code ?? ''))
  const [name, setName] = useState('Front counter')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const input = useRef<TextInput>(null)

  useEffect(() => {
    if (params.code) setCode(clean(params.code))
  }, [params.code])

  const start = () => {
    setMode('terminal')
    router.replace('/terminal')
  }

  const submit = async () => {
    setBusy(true)
    setProblem(null)
    try {
      await pair(code, name.trim() || 'Terminal')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      start()
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setProblem(error instanceof Error ? error.message : 'That didn’t work. Try the code again.')
    } finally {
      setBusy(false)
    }
  }

  if (paired)
    return (
      <Screen bg={colors.paper}>
        <Header />
        <View style={styles.center}>
          <Bob>
            <ShopBadge size={120} />
          </Bob>
          <Txt weight="bold" size={30} style={{ marginTop: 18, letterSpacing: -0.8, textAlign: 'center' }}>
            {paired.name}
          </Txt>
          <Txt size={16} color={colors.muted} style={{ marginTop: 4 }}>
            Paired to {paired.merchantName}
          </Txt>
        </View>
        <View style={styles.footer}>
          <PillButton label="Open the terminal" icon="terminal" onPress={start} />
        </View>
      </Screen>
    )

  return (
    <Screen bg={colors.paper}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.art}>
            <ShopBadge size={96} />
            <View style={styles.kovi}>
              <Kovi pose="wave" size={96} />
            </View>
          </View>
          <Txt weight="bold" size={32} style={{ letterSpacing: -1, lineHeight: 36 }}>
            Pair this phone with your shop
          </Txt>
          <Txt size={16} color={colors.muted} style={{ marginTop: 8, lineHeight: 23 }}>
            In your Kova dashboard, tap Add a terminal. Type the code it shows, or scan it.
          </Txt>

          {/* The code, as six boxes over one hidden input */}
          <Pressable accessibilityRole="button" accessibilityLabel="Pairing code" onPress={() => input.current?.focus()} style={styles.boxes}>
            {Array.from({ length: LENGTH }, (_, i) => {
              const ch = code[i] ?? ''
              const active = i === code.length
              return (
                <View key={i} style={[styles.box, ch ? styles.boxFilled : null, active ? styles.boxActive : null, i === 2 ? { marginRight: 12 } : null]}>
                  <Txt weight="bold" size={26} color={ch ? colors.ink : colors.muted}>
                    {ch}
                  </Txt>
                </View>
              )
            })}
          </Pressable>
          <TextInput
            ref={input}
            value={code}
            onChangeText={(v) => {
              setCode(clean(v))
              setProblem(null)
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus={!params.code}
            maxLength={LENGTH + 2}
            style={styles.hidden}
          />
          {problem ? (
            <Txt weight="medium" size={14} color={colors.danger} style={{ marginTop: 10 }}>
              {problem}
            </Txt>
          ) : null}

          <Pressable accessibilityRole="button" onPress={() => router.push('/scan')} style={styles.scan}>
            <Icon name="scan" size={18} />
            <Txt weight="semi" size={15}>
              Scan the code instead
            </Txt>
          </Pressable>

          <Txt weight="semi" size={14} color={colors.muted} style={{ marginTop: 26, marginBottom: 8, marginLeft: 4 }}>
            Name this terminal
          </Txt>
          <TextInput value={name} onChangeText={setName} maxLength={40} placeholder="Front counter" placeholderTextColor="#8C9799" style={styles.name} />
        </ScrollView>
        <View style={styles.footer}>
          <PillButton label="Pair this phone" icon="terminal" disabled={code.length < LENGTH} loading={busy} onPress={submit} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  art: { height: 120, justifyContent: 'center', marginBottom: 12 },
  kovi: { position: 'absolute', left: 64, top: 8 },
  boxes: { flexDirection: 'row', gap: 8, marginTop: 26 },
  box: {
    flex: 1,
    height: 64,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(11,26,29,0.18)',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.ink },
  boxActive: { borderColor: colors.coral },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  scan: {
    marginTop: 16,
    alignSelf: 'flex-start',
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(11,26,29,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    height: 56,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
  footer: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
})
