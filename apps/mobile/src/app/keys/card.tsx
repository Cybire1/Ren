import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import type { Address } from 'viem'
import { readCardToLink } from '@/lib/card-tempo'
import { chainName } from '@/lib/config'
import { colors, fonts } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { CardArt, Reni } from '@/ui/art'
import { Icon } from '@/ui/Icon'
import { Choice, dollars, Field, MoneyField } from '@/ui/keys'
import { Header, PillButton, Screen, Txt } from '@/ui/primitives'
import { SlideToSend } from '@/ui/send/SlideToSend'

type Step = 'tap' | 'setup' | 'review' | 'done'
const amountOk = (value: string) => /^\d{1,5}(\.\d{1,2})?$/.test(value) && Number(value) > 0

/**
 * Linking a Ren Card on Tempo: tap the card, choose its daily limit, and Face ID puts the chip's
 * key on Tempo as an access key on this wallet. From then on the card pays at any Ren till by
 * tapping, up to that limit each day, and freezes in one tap from Keys.
 */
export default function LinkCardScreen() {
  const { keys } = useWallet()
  const [step, setStep] = useState<Step>('tap')
  const [card, setCard] = useState<Address | null>(null)
  const [label, setLabel] = useState('Ren Card')
  const [limit, setLimit] = useState('50')
  const [days, setDays] = useState(90)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (keys.status === 'signed-out') void keys.signIn().catch(() => {})
  }, [keys])

  const tap = async () => {
    setBusy(true)
    setProblem(null)
    try {
      const read = await readCardToLink()
      setCard(read.address)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setStep('setup')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The card didn’t read. Try again.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(false)
    }
  }

  const link = async () => {
    if (!card) return
    setBusy(true)
    setProblem(null)
    try {
      await keys.createCard({ label: label.trim() || 'Ren Card', keyId: card, limit, days })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setStep('done')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t go through.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(false)
    }
  }

  const ends = new Date(Date.now() + days * 86_400_000).toLocaleDateString([], { day: 'numeric', month: 'long' })

  return (
    <Screen>
      <Header
        title={step === 'done' ? undefined : 'Link a Ren Card'}
        backIcon={step === 'review' ? 'back' : 'close'}
        onBack={step === 'review' && !busy ? () => setStep('setup') : busy ? null : () => router.back()}
      />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {step === 'tap' ? (
          <View style={styles.center}>
            <CardArt width={260} last4="····" />
            <Txt weight="heavy" size={24} style={{ textAlign: 'center' }}>
              Tap your Ren Card
            </Txt>
            <Txt color={colors.muted} style={{ textAlign: 'center' }}>
              Hold it to the top of the iPhone. Its chip makes a key that never leaves it.
            </Txt>
            {problem ? <Txt color={colors.danger}>{problem}</Txt> : null}
            <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
              <PillButton label={busy ? 'Reading…' : 'Read the card'} icon="tap" loading={busy} disabled={busy} onPress={() => void tap()} />
            </View>
          </View>
        ) : null}

        {step === 'setup' ? (
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <View style={styles.read}>
              <Icon name="check" size={16} color={colors.tealDeep} />
              <Txt weight="bold" size={14} color={colors.tealDeep}>
                Card read: ••••{card?.slice(-4)}
              </Txt>
            </View>
            <Field label="Name">
              <TextInput value={label} onChangeText={setLabel} maxLength={40} style={styles.input} />
            </Field>
            <Field label="It can spend a day">
              <MoneyField value={limit} onChange={setLimit} label="Daily limit" />
            </Field>
            <Field label="It works for">
              <Choice
                value={days}
                onChange={setDays}
                options={[
                  { value: 30, label: '30 days' },
                  { value: 90, label: '90 days' },
                ]}
              />
            </Field>
            <PillButton label={amountOk(limit) ? 'Review' : 'Set its daily limit'} disabled={!amountOk(limit)} onPress={() => setStep('review')} />
          </ScrollView>
        ) : null}

        {step === 'review' ? (
          <View style={styles.flow}>
            <Txt weight="heavy" size={22}>
              {busy ? 'Linking the card' : 'Check and link'}
            </Txt>
            <View style={{ gap: 4, marginTop: 6 }}>
              <Txt weight="heavy" size={36} style={{ textAlign: 'center' }}>
                {dollars(limit)} a day
              </Txt>
              <Txt color={colors.muted} style={{ textAlign: 'center' }}>
                {label.trim() || 'Ren Card'} ••••{card?.slice(-4)}, until {ends}
              </Txt>
            </View>
            <View style={styles.facts}>
              <Fact label={`${chainName} enforces`} value={`${dollars(limit)} a day, dollars only`} hint="The chip can’t spend more, whoever holds it" />
              <Fact label="Pays" value="Any Ren till, by tapping" />
              <Fact label="Lost it?" value="Freeze it in Keys" hint="Its limit on Tempo goes to zero at once" last />
            </View>
            {problem ? <Txt color={colors.danger}>{problem}</Txt> : null}
            <View style={{ flex: 1 }} />
            <SlideToSend label={problem ? 'Slide to try again' : 'Slide to link the card'} busy={busy} onSend={() => void link()} />
          </View>
        ) : null}

        {step === 'done' ? (
          <View style={styles.center}>
            <Reni pose="cheer" size={150} />
            <Txt weight="heavy" size={26} style={{ textAlign: 'center' }}>
              Your card is ready
            </Txt>
            <Txt color={colors.muted} style={{ textAlign: 'center' }}>
              Tap it at any Ren till. It spends up to {dollars(limit)} a day from this wallet.
            </Txt>
            <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
              <PillButton label="Done" icon="check" onPress={() => router.back()} />
            </View>
          </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 },
  form: { paddingHorizontal: 20, paddingBottom: 40, gap: 18 },
  flow: { flex: 1, paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  read: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, borderRadius: 14, backgroundColor: '#CFF5E6' },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderWidth: 2, borderColor: colors.ink, borderRadius: 16, backgroundColor: colors.white, fontFamily: fonts.semi, fontSize: 16, color: colors.ink },
  facts: { borderRadius: 20, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, paddingHorizontal: 14 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
})
