import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import type { Address, Hex } from 'viem'
import { apiUrl, chainName } from '@/lib/config'
import { applyKey, formatUsd, groupTyped, type Key, toBase } from '@/lib/money'
import { useSessionCovers } from '@/lib/session'
import { colors, fonts } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Reni } from '@/ui/art'
import { Icon } from '@/ui/Icon'
import { Keypad } from '@/ui/Keypad'
import { Field } from '@/ui/keys'
import { Header, PillButton, Screen, Txt } from '@/ui/primitives'
import { SlideToSend } from '@/ui/send/SlideToSend'

interface Bank {
  name: string
  code: string
}

interface CashOut {
  id: string
  amount: string
  naira: string
  rate: string
  fee: string
  bank_name: string
  account_name: string
  account_last4: string
  status: 'quoted' | 'received' | 'paying' | 'paid' | 'failed' | 'expired'
  pay_to: Address
  memo: Hex
  failure: string | null
  test_mode: boolean
}

type Step = 'amount' | 'account' | 'review' | 'done'

async function nairaApi<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown; token?: string } = {}): Promise<T> {
  const response = await fetch(`${apiUrl}/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  })
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
  if (!response.ok) throw new Error(body.error?.message ?? `Ren is unreachable (${response.status})`)
  return body as T
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Cashing out to naira (the API's services/naira.ts): dollars from this wallet to a Nigerian bank
 * account, through Paystack. The app's twin of the web's cash-out. How much, which account (the
 * bank says whose it is), the quote, slide; if the bank can't take it, the dollars come back.
 */
export default function CashOutScreen() {
  const { balance, keys, profile, sendToRen } = useWallet()
  const [step, setStep] = useState<Step>('amount')
  const [typed, setTyped] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [banks, setBanks] = useState<Bank[] | null>(null)
  const [search, setSearch] = useState('')
  const [bank, setBank] = useState<Bank | null>(null)
  const [account, setAccount] = useState('')
  const [named, setNamed] = useState<{ number: string; name: string } | null>(null)
  const [looking, setLooking] = useState(false)
  const [quote, setQuote] = useState<CashOut | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const quick = useSessionCovers(0n)

  const onKey = useCallback((key: Key) => setTyped((v) => applyKey(v, key, 2)), [])
  const amount = useMemo(() => {
    try {
      return typed && Number(typed) > 0 ? toBase(Number(typed).toFixed(2)) : 0n
    } catch {
      return 0n
    }
  }, [typed])
  const over = balance !== null && amount > balance
  const tooSmall = amount > 0n && amount < 1_000_000n

  useEffect(() => {
    if (amount < 1_000_000n) return setPreview(null)
    const id = setTimeout(() => {
      void nairaApi<{ naira: string }>(`naira/quote?amount=${(Number(amount) / 1e6).toFixed(2)}`)
        .then((q) => setPreview(q.naira))
        .catch(() => setPreview(null))
    }, 250)
    return () => clearTimeout(id)
  }, [amount])

  useEffect(() => {
    if (step !== 'account' || banks) return
    void nairaApi<{ data: Bank[] }>('naira/banks').then((b) => setBanks(b.data)).catch((e: Error) => setProblem(e.message))
  }, [banks, step])

  useEffect(() => {
    setNamed(null)
    if (!bank || !/^\d{10}$/.test(account)) return
    setLooking(true)
    setProblem(null)
    void nairaApi<{ account_name: string }>('naira/account', { method: 'POST', body: { account_number: account, bank_code: bank.code } })
      .then((r) => setNamed({ number: account, name: r.account_name }))
      .catch((e: Error) => setProblem(e.message))
      .finally(() => setLooking(false))
  }, [account, bank])

  const shown = useMemo(() => {
    if (!banks) return []
    const q = search.trim().toLowerCase()
    return (q ? banks.filter((b) => b.name.toLowerCase().includes(q)) : banks).slice(0, 30)
  }, [banks, search])

  const review = async () => {
    if (!bank || !named || !profile) return
    setBusy(true)
    setProblem(null)
    try {
      setQuote(
        await nairaApi<CashOut>(`wallets/${profile.address}/cash-outs`, {
          method: 'POST',
          token: await keys.token(),
          body: { amount: (Number(amount) / 1e6).toFixed(2), bank_code: bank.code, account_number: named.number },
        }),
      )
      setStep('review')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t go through.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(false)
    }
  }

  const go = async () => {
    if (!quote || !profile) return
    setBusy(true)
    setProblem(null)
    try {
      const sent = await sendToRen({
        to: quote.pay_to,
        amount,
        memo: quote.memo,
        name: quote.bank_name,
        detail: `Cash out to ••••${quote.account_last4}`,
      })
      let result = await nairaApi<CashOut>(`wallets/${profile.address}/cash-outs/${quote.id}/sent`, {
        method: 'POST',
        token: await keys.token(),
        body: { tx_hash: sent.txHash },
      })
      void Haptics.notificationAsync(result.status === 'failed' ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success)
      setQuote(result)
      setStep('done')
      for (let i = 0; i < 20 && (result.status === 'paying' || result.status === 'received'); i++) {
        await wait(3000)
        result = await nairaApi<CashOut>(`wallets/${profile.address}/cash-outs/${quote.id}`, { token: await keys.token() })
        setQuote(result)
      }
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
        title={step === 'done' ? undefined : 'Cash out'}
        backIcon={step === 'amount' || step === 'done' ? 'close' : 'back'}
        onBack={
          busy
            ? null
            : step === 'account'
              ? () => setStep('amount')
              : step === 'review'
                ? () => setStep('account')
                : () => router.back()
        }
      />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {step === 'amount' ? (
          <View style={styles.flow}>
            <View style={styles.route}>
              <View style={styles.naira}>
                <Txt weight="heavy" size={18} color={colors.white}>
                  ₦
                </Txt>
              </View>
              <Txt size={14} color={colors.muted}>
                To any Nigerian bank, through Paystack
              </Txt>
            </View>
            <View style={styles.typed}>
              <Txt weight="semi" size={30} color={colors.muted} style={{ marginTop: 10 }}>
                $
              </Txt>
              <Txt weight="heavy" size={64} exact>
                {groupTyped(typed) || '0'}
              </Txt>
            </View>
            <View style={styles.pills}>
              {preview && !over ? (
                <View style={[styles.pill, { backgroundColor: colors.tealSoft }]}>
                  <Txt weight="semi" size={14}>
                    They get ≈ {preview}
                  </Txt>
                </View>
              ) : null}
              {balance !== null ? (
                <View style={[styles.pill, over && { backgroundColor: colors.coralSoft }]}>
                  <Txt weight="semi" size={14} color={over ? colors.danger : colors.onTint}>
                    {over ? `You have ${formatUsd(balance)}` : `${formatUsd(balance)} available`}
                  </Txt>
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1 }} />
            <Keypad onKey={onKey} />
            <View style={{ marginTop: 14 }}>
              <PillButton
                label={over ? 'More than you have' : tooSmall ? 'At least $1' : 'Choose the account'}
                disabled={amount === 0n || over || tooSmall}
                onPress={() => setStep('account')}
              />
            </View>
          </View>
        ) : null}

        {step === 'account' ? (
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Txt weight="heavy" size={22}>
              Which account?
            </Txt>
            {bank ? (
              <Pressable onPress={() => setBank(null)} style={styles.bankPick}>
                <View style={styles.bankBadge}>
                  <Icon name="web" size={17} color={colors.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="bold" size={15}>
                    {bank.name}
                  </Txt>
                  <Txt size={13} color={colors.muted}>
                    Change bank
                  </Txt>
                </View>
              </Pressable>
            ) : (
              <Field label="Bank">
                <TextInput value={search} onChangeText={setSearch} placeholder="Search your bank" placeholderTextColor={colors.muted} style={styles.input} />
                <View style={styles.bankList}>
                  {banks === null ? (
                    <Txt color={colors.muted} style={{ padding: 12 }}>
                      Loading banks…
                    </Txt>
                  ) : (
                    shown.map((b, i) => (
                      <Pressable key={`${b.code}-${b.name}`} onPress={() => setBank(b)} style={[styles.bankRow, i < shown.length - 1 && styles.rule]}>
                        <Txt size={15}>{b.name}</Txt>
                      </Pressable>
                    ))
                  )}
                </View>
              </Field>
            )}
            {bank ? (
              <Field label="Account number">
                <TextInput
                  value={account}
                  onChangeText={(t) => setAccount(t.replace(/\D/g, '').slice(0, 10))}
                  keyboardType="number-pad"
                  placeholder="10 digits"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </Field>
            ) : null}
            {looking ? <Txt color={colors.muted}>Asking the bank whose account it is…</Txt> : null}
            {named ? (
              <View style={styles.named}>
                <Icon name="check" size={16} color={colors.tealDeep} />
                <Txt weight="heavy" size={15} color={colors.tealDeep}>
                  {named.name}
                </Txt>
              </View>
            ) : null}
            {problem ? <Txt color={colors.danger}>{problem}</Txt> : null}
            <PillButton label={busy ? 'Getting a quote…' : 'Review'} loading={busy} disabled={!named || busy} onPress={() => void review()} />
          </ScrollView>
        ) : null}

        {step === 'review' && quote ? (
          <View style={styles.flow}>
            <Txt weight="heavy" size={22}>
              {busy ? 'Cashing out' : 'Check and cash out'}
            </Txt>
            <View style={{ gap: 4, marginTop: 10 }}>
              <Txt weight="heavy" size={40} style={{ textAlign: 'center' }}>
                {quote.naira}
              </Txt>
              <Txt color={colors.muted} style={{ textAlign: 'center' }}>
                to {quote.account_name}, {quote.bank_name} ••••{quote.account_last4}
              </Txt>
            </View>
            <View style={styles.facts}>
              <Fact label="You send" value={`$${quote.amount}`} hint={`From your balance on ${chainName}`} />
              <Fact label="Rate" value={`₦${quote.rate} per dollar`} />
              <Fact label="Bank fee" value={quote.fee} hint="Taken from the naira" />
              <Fact label="Network fee" value="$0.00, Ren covers it" />
              <Fact label="Arrives" value="In minutes" hint="If the bank can’t take it, your dollars come back" last />
            </View>
            {quote.test_mode ? (
              <Txt size={13} color={colors.muted}>
                Paystack test mode: no real naira moves.
              </Txt>
            ) : null}
            {problem ? <Txt color={colors.danger}>{problem}</Txt> : null}
            <View style={{ flex: 1 }} />
            <SlideToSend label={problem ? 'Slide to try again' : `Slide to cash out $${quote.amount}`} busy={busy} onSend={() => void go()} />
            <Txt size={13} color={colors.muted} style={{ textAlign: 'center', marginTop: 8 }}>
              {quick ? 'Your wallet is open, so this one needs no Face ID.' : 'Face ID approves it.'}
            </Txt>
          </View>
        ) : null}

        {step === 'done' && quote ? (
          <View style={styles.done}>
            <Reni pose={quote.status === 'failed' ? 'oops' : 'cheer'} size={150} />
            <Txt weight="heavy" size={26} style={{ textAlign: 'center' }}>
              {quote.status === 'paid' ? 'In their account' : quote.status === 'failed' ? 'It didn’t reach the bank' : 'On its way to the bank'}
            </Txt>
            <Txt color={colors.muted} style={{ textAlign: 'center' }}>
              {quote.status === 'failed'
                ? (quote.failure ?? 'The bank couldn’t take it. Your dollars came back to your wallet.')
                : `${quote.naira} to ${quote.account_name}, ${quote.bank_name} ••••${quote.account_last4}.`}
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
    <View style={[styles.fact, !last && styles.rule]}>
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
  flow: { flex: 1, paddingHorizontal: 20, paddingBottom: 12 },
  form: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  route: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  naira: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tealDeep, alignItems: 'center', justifyContent: 'center' },
  typed: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', marginTop: 28 },
  pills: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.sunken },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderWidth: 2, borderColor: colors.ink, borderRadius: 16, backgroundColor: colors.white, fontFamily: fonts.semi, fontSize: 16, color: colors.ink },
  bankList: { maxHeight: 300, borderWidth: 2, borderColor: colors.ink, borderRadius: 16, backgroundColor: colors.white, overflow: 'hidden' },
  bankRow: { paddingHorizontal: 14, paddingVertical: 12 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.sunken },
  bankPick: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 2, borderColor: colors.ink, backgroundColor: '#CFF5E6' },
  bankBadge: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  named: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, borderRadius: 14, backgroundColor: '#CFF5E6' },
  facts: { marginTop: 16, borderRadius: 20, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, paddingHorizontal: 14 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 },
})
