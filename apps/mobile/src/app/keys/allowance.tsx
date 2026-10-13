import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native'
import { chainName } from '@/lib/config'
import { colors, fonts } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Reni } from '@/ui/art'
import { Choice, dollars, Field, MoneyField, Snippet } from '@/ui/keys'
import { Header, PillButton, Screen, TextLink, Txt } from '@/ui/primitives'
import { SlideToSend } from '@/ui/send/SlideToSend'

type Step = 'setup' | 'review' | 'done'
const amountOk = (value: string) => /^\d{1,5}(\.\d{1,2})?$/.test(value) && Number(value) > 0

/**
 * An allowance: someone spends from your dollars, up to a limit each week or day. It starts as a
 * link; they accept it in Ren on their own phone, and you switch it on with Face ID.
 */
export default function NewAllowanceScreen() {
  const { keys, profile } = useWallet()
  const [step, setStep] = useState<Step>('setup')
  const [label, setLabel] = useState('')
  const [limit, setLimit] = useState('30')
  const [period, setPeriod] = useState<'day' | 'week'>('week')
  const [days, setDays] = useState(30)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [made, setMade] = useState<{ id: string; link: string } | null>(null)

  useEffect(() => {
    if (keys.status === 'signed-out') void keys.signIn().catch(() => {})
  }, [keys])

  const setupProblem = !label.trim() ? 'Say who it’s for' : !amountOk(limit) ? 'Set how much' : null
  const ends = new Date(Date.now() + days * 86_400_000).toLocaleDateString([], { day: 'numeric', month: 'long' })
  const from = profile?.name && !profile.name.startsWith('0x') ? profile.name : 'Someone'

  const go = async () => {
    setBusy(true)
    setProblem(null)
    try {
      const result = await keys.createAllowance({ label: label.trim(), limit, period, days })
      setMade({ id: result.key.id, link: result.link })
      setStep('done')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t go through.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <Header
        title={step === 'done' ? undefined : 'Give an allowance'}
        backIcon={step === 'review' ? 'back' : 'close'}
        onBack={step === 'review' && !busy ? () => setStep('setup') : busy ? null : () => router.back()}
      />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {step === 'setup' ? (
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Field label="Who it’s for">
              <TextInput value={label} onChangeText={setLabel} maxLength={40} placeholder="Mum" placeholderTextColor={colors.muted} style={styles.input} />
            </Field>
            <Field label="They can spend">
              <View style={styles.row}>
                <MoneyField value={limit} onChange={setLimit} label="Limit" />
                <Choice
                  value={period}
                  onChange={setPeriod}
                  options={[
                    { value: 'week', label: 'a week' },
                    { value: 'day', label: 'a day' },
                  ]}
                />
              </View>
            </Field>
            <Field label="For">
              <Choice
                value={days}
                onChange={setDays}
                options={[
                  { value: 7, label: '7 days' },
                  { value: 30, label: '30 days' },
                  { value: 90, label: '90 days' },
                ]}
              />
            </Field>
            <PillButton label={setupProblem ?? 'Review'} disabled={Boolean(setupProblem)} onPress={() => setStep('review')} />
          </ScrollView>
        ) : null}

        {step === 'review' ? (
          <View style={styles.flow}>
            <Txt weight="heavy" size={22}>
              Check and make the link
            </Txt>
            <View style={{ gap: 4, marginTop: 6 }}>
              <Txt weight="heavy" size={36} style={{ textAlign: 'center' }}>
                {dollars(limit)} a {period}
              </Txt>
              <Txt color={colors.muted} style={{ textAlign: 'center' }}>
                For {label.trim()}, until {ends}
              </Txt>
            </View>
            <View style={styles.facts}>
              <Fact label="How" value="A link you send them" hint="They open it in Ren and accept on their phone" />
              <Fact label="Then" value="You switch it on" hint="With Face ID, once they’ve accepted" />
              <Fact label={`${chainName} enforces`} value={`${dollars(limit)} a ${period}, dollars only`} last />
            </View>
            {problem ? <Txt color={colors.danger}>{problem}</Txt> : null}
            <View style={{ flex: 1 }} />
            <SlideToSend label="Slide to make the link" busy={busy} onSend={() => void go()} />
          </View>
        ) : null}

        {step === 'done' && made ? (
          <ScrollView contentContainerStyle={styles.done}>
            <Reni pose="wave" size={140} />
            <Txt weight="heavy" size={26} style={{ textAlign: 'center' }}>
              Send {label.trim()} the link
            </Txt>
            <Txt color={colors.muted} style={{ textAlign: 'center' }}>
              When they open it in Ren and accept, you’ll switch it on here. The link works once, for seven days.
            </Txt>
            <View style={{ alignSelf: 'stretch', gap: 10 }}>
              <PillButton
                label="Send the link"
                icon="share"
                onPress={() =>
                  void Share.share({
                    message: `${from} gave you an allowance on Ren: ${dollars(limit)} a ${period}. Open this to accept it: ${made.link}`,
                  })
                }
              />
              <Snippet text={made.link} />
            </View>
            <TextLink label="Done" onPress={() => router.replace({ pathname: '/keys/[id]', params: { id: made.id } })} />
          </ScrollView>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  )
}

function Fact({ label, value, hint, last }: { label: string; value: string; hint?: string; last?: boolean }) {
  return (
    <View style={[styles.fact, !last && { borderBottomWidth: 1, borderBottomColor: colors.sunken }]}>
      <Txt size={14} color={colors.muted}>
        {label}
      </Txt>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Txt weight="bold" size={14} style={{ textAlign: 'right' }}>
          {value}
        </Txt>
        {hint ? (
          <Txt size={12} color={colors.muted} style={{ textAlign: 'right' }}>
            {hint}
          </Txt>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: 20, paddingBottom: 40, gap: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderWidth: 2, borderColor: colors.ink, borderRadius: 16, backgroundColor: colors.white, fontFamily: fonts.semi, fontSize: 16, color: colors.ink },
  flow: { flex: 1, paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  facts: { borderRadius: 20, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, paddingHorizontal: 14 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  done: { alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingBottom: 40 },
})
