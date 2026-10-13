import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { type Address, getAddress, isAddress } from 'viem'
import { chainName } from '@/lib/config'
import { useSessionCovers } from '@/lib/session'
import { colors, fonts } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Reni } from '@/ui/art'
import { Icon } from '@/ui/Icon'
import { Choice, dollars, Field, MoneyField, Snippet } from '@/ui/keys'
import { Header, PillButton, Screen, Txt } from '@/ui/primitives'
import { SlideToSend } from '@/ui/send/SlideToSend'

type Step = 'setup' | 'review' | 'done'
const amountOk = (value: string) => /^\d{1,5}(\.\d{1,2})?$/.test(value) && Number(value) > 0

/**
 * A key for an AI agent: what it may spend a day or a week, the most one payment can be, above
 * what it asks you first, and for how long. Your Face ID puts it on Tempo; the agent gets a token,
 * shown once, and Ren keeps the key itself.
 */
export default function NewAgentScreen() {
  const { keys } = useWallet()
  const [step, setStep] = useState<Step>('setup')
  const [label, setLabel] = useState('')
  const [limit, setLimit] = useState('20')
  const [period, setPeriod] = useState<'day' | 'week'>('day')
  const [perPayment, setPerPayment] = useState('5')
  const [approveAbove, setApproveAbove] = useState('1')
  const [days, setDays] = useState(30)
  const [onlyListed, setOnlyListed] = useState(false)
  const [listed, setListed] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [made, setMade] = useState<{ id: string; token: string; ms: number } | null>(null)
  const quick = useSessionCovers(0n)

  useEffect(() => {
    if (keys.status === 'signed-out') void keys.signIn().catch(() => {})
  }, [keys])

  const payees = useMemo(() => {
    const found = listed.split(/[\s,]+/).filter((a) => isAddress(a)).map((a) => getAddress(a) as Address)
    return [...new Set(found)]
  }, [listed])
  const askNever = Number(approveAbove) >= Number(perPayment)
  const setupProblem = !label.trim()
    ? 'Give it a name'
    : !amountOk(limit) || !amountOk(perPayment)
      ? 'Set its limits'
      : Number(perPayment) > Number(limit)
        ? 'A payment can’t be more than its limit'
        : onlyListed && payees.length === 0
          ? 'Add a wallet it may pay'
          : null
  const ends = new Date(Date.now() + days * 86_400_000).toLocaleDateString([], { day: 'numeric', month: 'long' })

  const go = async () => {
    setBusy(true)
    setProblem(null)
    try {
      const result = await keys.createAgent({
        label: label.trim(),
        limit,
        period,
        days,
        perPayment,
        approveAbove: askNever ? perPayment : approveAbove,
        payees: onlyListed ? payees : 'anyone',
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setMade({ id: result.key.id, token: result.token, ms: result.ms })
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
        title={step === 'done' ? undefined : 'New agent key'}
        backIcon={step === 'review' ? 'back' : 'close'}
        onBack={step === 'review' && !busy ? () => setStep('setup') : busy ? null : () => router.back()}
      />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {step === 'setup' ? (
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Field label="Name">
              <TextInput value={label} onChangeText={setLabel} maxLength={40} placeholder="Research agent" placeholderTextColor={colors.muted} style={styles.input} />
            </Field>
            <Field label="It can spend">
              <View style={styles.row}>
                <MoneyField value={limit} onChange={setLimit} label="Limit" />
                <Choice
                  value={period}
                  onChange={setPeriod}
                  options={[
                    { value: 'day', label: 'a day' },
                    { value: 'week', label: 'a week' },
                  ]}
                />
              </View>
            </Field>
            <Field label="Most one payment can be">
              <MoneyField value={perPayment} onChange={setPerPayment} label="Most per payment" />
            </Field>
            <Field label="Ask me first above">
              <View style={styles.row}>
                {askNever ? null : <MoneyField value={approveAbove} onChange={setApproveAbove} label="Ask above" />}
                <Choice
                  value={askNever ? 'never' : 'ask'}
                  onChange={(v) => setApproveAbove(v === 'never' ? perPayment : String(Math.min(1, Number(perPayment))))}
                  options={[
                    { value: 'ask', label: 'Ask' },
                    { value: 'never', label: 'Never ask' },
                  ]}
                />
              </View>
            </Field>
            <Field label="It lasts">
              <Choice
                value={days}
                onChange={setDays}
                options={[
                  { value: 1, label: '1 day' },
                  { value: 7, label: '7 days' },
                  { value: 30, label: '30 days' },
                  { value: 90, label: '90 days' },
                ]}
              />
            </Field>
            <Field label="It may pay">
              <Choice
                value={onlyListed ? 'listed' : 'anyone'}
                onChange={(v) => setOnlyListed(v === 'listed')}
                options={[
                  { value: 'anyone', label: 'Anyone' },
                  { value: 'listed', label: 'Only wallets I list' },
                ]}
              />
              {onlyListed ? (
                <TextInput
                  value={listed}
                  onChangeText={setListed}
                  multiline
                  placeholder="0x… one wallet a line"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.area]}
                />
              ) : null}
            </Field>
            <PillButton label={setupProblem ?? 'Review'} disabled={Boolean(setupProblem)} onPress={() => setStep('review')} />
          </ScrollView>
        ) : null}

        {step === 'review' ? (
          <View style={styles.flow}>
            <Txt weight="heavy" size={22}>
              {busy ? 'Making the key' : 'Check and create'}
            </Txt>
            <View style={styles.sum}>
              <Txt weight="heavy" size={28} style={{ textAlign: 'center' }}>
                {label.trim()}
              </Txt>
              <Txt color={colors.muted} style={{ textAlign: 'center' }}>
                Up to {dollars(limit)} a {period}, until {ends}
              </Txt>
            </View>
            <View style={styles.facts}>
              <Fact label={`${chainName} enforces`} value={`${dollars(limit)} a ${period}, dollars only`} hint={`Ends ${ends}. Not even Ren can raise it.`} />
              <Fact label="Ren checks" value={`${dollars(perPayment)} a payment at most`} hint={askNever ? 'Never asks you first' : `Asks you above ${dollars(approveAbove)}`} />
              <Fact label="May pay" value={onlyListed ? `${payees.length} wallet${payees.length === 1 ? '' : 's'}` : 'Anyone'} />
              <Fact label="Fee" value="$0.00, Ren covers it" last />
            </View>
            {problem ? <Txt color={colors.danger}>{problem}</Txt> : null}
            <View style={{ flex: 1 }} />
            <SlideToSend label={problem ? 'Slide to try again' : 'Slide to create the key'} busy={busy} onSend={() => void go()} />
            <Txt size={13} color={colors.muted} style={{ textAlign: 'center', marginTop: 8 }}>
              {quick ? 'Your wallet is open, so this one needs no Face ID.' : 'Face ID approves it.'}
            </Txt>
          </View>
        ) : null}

        {step === 'done' && made ? (
          <ScrollView contentContainerStyle={styles.done}>
            <Reni pose="key" size={140} />
            <Txt weight="heavy" size={26} style={{ textAlign: 'center' }}>
              {label.trim()} is ready
            </Txt>
            <Txt color={colors.muted} style={{ textAlign: 'center' }}>
              Its key is on {chainName}. Give your agent this token: it’s shown once, so copy it now.
            </Txt>
            <View style={{ alignSelf: 'stretch' }}>
              <Snippet text={made.token} strong />
            </View>
            <Txt size={13} color={colors.muted} style={{ alignSelf: 'flex-start' }}>
              Connect Claude Code in one line:
            </Txt>
            <View style={{ alignSelf: 'stretch' }}>
              <Snippet text={`claude mcp add --transport http ren ${keys.mcpUrl} --header "Authorization: Bearer ${made.token}"`} />
            </View>
            <View style={styles.time}>
              <Icon name="bolt" size={15} color={colors.white} />
              <Txt weight="semi" size={14} color={colors.white}>
                On {chainName} in {(made.ms / 1000).toFixed(2)} s
              </Txt>
            </View>
            <View style={{ alignSelf: 'stretch' }}>
              <PillButton label="Done" icon="check" onPress={() => router.replace({ pathname: '/keys/[id]', params: { id: made.id } })} />
            </View>
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
  area: { minHeight: 80, marginTop: 8, fontFamily: 'Menlo', fontSize: 13, textAlignVertical: 'top' },
  flow: { flex: 1, paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  sum: { marginTop: 6, gap: 4 },
  facts: { borderRadius: 20, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, paddingHorizontal: 14 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  done: { alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingBottom: 40 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.ink },
})
