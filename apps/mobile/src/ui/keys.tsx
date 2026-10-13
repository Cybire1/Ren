import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import type { KeyPaymentView, KeyView } from '@/lib/keys-state'
import { colors, fonts } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Reni } from './art'
import { Icon, type IconName } from './Icon'
import { PillButton, Sticker, Txt } from './primitives'

/**
 * Keys on the phone (lib/keys-state.ts): the pieces the Keys screens share. Agents are ink like the
 * private balance, people are green like money at rest, and anything waiting on you is watermelon.
 */

export const dollars = (value: string | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
export const ended = (key: KeyView) => key.status === 'expired' || Date.parse(key.expires_at) < Date.now()
export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

export const KIND: Record<KeyView['kind'], { icon: IconName; noun: string; fill: string }> = {
  agent: { icon: 'terminal', noun: 'Agent', fill: colors.ink },
  allowance: { icon: 'user', noun: 'Allowance', fill: colors.teal },
  card: { icon: 'card', noun: 'Card', fill: colors.coral },
}

export function meter(key: KeyView): number {
  if (key.remaining === null) return 0
  const limit = Number(key.limit)
  return limit > 0 ? Math.max(0, Math.min(1, Number(key.remaining) / limit)) : 0
}

export function standing(key: KeyView): string {
  if (key.status === 'revoked') return 'Removed'
  if (ended(key)) return `Ended ${shortDate(key.expires_at)}`
  if (key.status === 'frozen') return 'Frozen: it can’t spend'
  if (key.status === 'pending')
    return key.kind === 'allowance'
      ? key.holder
        ? `${key.holder_name ?? 'They'} accepted. Switch it on`
        : 'Waiting for them to open your link'
      : 'Not on Tempo yet'
  const left = key.remaining === null ? '' : `${dollars(key.remaining)} left ${key.period === 'week' ? 'this week' : 'today'} · `
  return `${left}until ${shortDate(key.expires_at)}`
}

/** Keys on Home: a payment an agent is waiting on comes first; otherwise who can spend. */
export function KeysCard() {
  const { keys } = useWallet()
  if (!keys.available) return null
  const waiting = keys.approvals[0]
  if (waiting)
    return (
      <Sticker onPress={() => router.push('/keys')} fill={colors.coralSoft} radius={26} lift style={{ marginTop: 12 }}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: colors.coral }]}>
            <Icon name="bell" size={20} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt weight="heavy" size={12} color={colors.coralDeep} style={styles.kicker}>
              {(waiting.key.label ?? 'An agent').toUpperCase()} ASKS
            </Txt>
            <Txt weight="heavy" size={20}>
              Pay {dollars(waiting.amount)}?
            </Txt>
            <Txt size={13} color={colors.muted} numberOfLines={1}>
              {waiting.origin ? new URL(waiting.origin).host : (waiting.description ?? shortAddress(waiting.to))}
            </Txt>
          </View>
          <View style={styles.answer}>
            <Txt weight="bold" size={14} color={colors.white}>
              {keys.approvals.length > 1 ? `${keys.approvals.length} waiting` : 'Answer'}
            </Txt>
          </View>
        </View>
      </Sticker>
    )
  const live = keys.given.filter((k) => k.status === 'active' && !ended(k))
  const agents = live.filter((k) => k.kind === 'agent').length
  const people = live.filter((k) => k.kind === 'allowance').length
  const summary =
    keys.status !== 'ready'
      ? 'Give an agent or a person a limited key'
      : agents + people === 0
        ? 'None yet: only your passkey can spend'
        : [agents ? `${agents} agent${agents === 1 ? '' : 's'}` : '', people ? `${people} allowance${people === 1 ? '' : 's'}` : '']
            .filter(Boolean)
            .join(' · ')
  return (
    <Sticker onPress={() => router.push('/keys')} fill={colors.card} radius={26} lift style={{ marginTop: 12 }}>
      <View style={styles.cardRow}>
        <View style={[styles.cardIcon, { backgroundColor: '#FFF0B5' }]}>
          <Icon name="lock" size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="heavy" size={12} color={colors.muted} style={styles.kicker}>
            KEYS
          </Txt>
          <Txt weight="heavy" size={20}>
            Who can spend
          </Txt>
          <Txt size={13} color={colors.muted} numberOfLines={1}>
            {summary}
          </Txt>
        </View>
        <View style={styles.go}>
          <Icon name="arrow" size={18} />
        </View>
      </View>
    </Sticker>
  )
}

export function KeyRow({ keyView: key, received, last }: { keyView: KeyView; received?: boolean; last?: boolean }) {
  const kind = KIND[key.kind]
  const off = key.status !== 'active' || ended(key)
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/keys/[id]', params: { id: key.id } })}
      style={({ pressed }) => [styles.row, !last && styles.rowRule, off && { opacity: 0.6 }, pressed && { opacity: 0.5 }]}
      accessibilityRole="button"
      accessibilityLabel={`${key.label}. ${standing(key)}`}
    >
      <View style={[styles.badge, { backgroundColor: kind.fill }]}>
        <Icon name={key.status === 'frozen' ? 'snow' : kind.icon} size={18} color={key.kind === 'agent' ? colors.tealSoft : colors.white} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt weight="bold" size={15} numberOfLines={1}>
          {received ? `From ${shortAddress(key.owner)}` : key.label}
        </Txt>
        <Txt size={13} color={colors.muted} numberOfLines={1}>
          {standing(key)}
        </Txt>
        {key.status === 'active' && !ended(key) && key.remaining !== null ? <Meter value={meter(key)} /> : null}
      </View>
      {key.status === 'pending' && key.kind === 'allowance' && key.holder && !received ? (
        <View style={[styles.chip, { backgroundColor: colors.coral }]}>
          <Txt weight="bold" size={12} color={colors.white}>
            Switch on
          </Txt>
        </View>
      ) : key.status === 'frozen' ? (
        <View style={[styles.chip, { backgroundColor: colors.ink }]}>
          <Txt weight="bold" size={12} color={colors.white}>
            Frozen
          </Txt>
        </View>
      ) : (
        <View style={{ alignItems: 'flex-end' }}>
          <Txt weight="heavy" size={15}>
            {dollars(key.limit)}
          </Txt>
          <Txt size={12} color={colors.muted}>
            a {key.period}
          </Txt>
        </View>
      )}
    </Pressable>
  )
}

export function Meter({ value, onInk }: { value: number; onInk?: boolean }) {
  return (
    <View style={[styles.meter, onInk && { backgroundColor: 'rgba(255,255,255,0.18)', height: 8, maxWidth: 240 }]}>
      <View style={[styles.meterFill, { width: `${Math.round(value * 100)}%` }, onInk && { backgroundColor: colors.tealSoft }]} />
    </View>
  )
}

/** A payment an agent asked for, over its ask-first line: yes pays it now, within its limits. */
export function Ask({ payment }: { payment: KeyPaymentView }) {
  const { keys } = useWallet()
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const answer = async (decision: 'approve' | 'decline') => {
    setBusy(decision)
    setProblem(null)
    try {
      const answered = await keys.answer(payment, decision)
      if (answered.status === 'failed') setProblem(answered.reason ?? 'It didn’t go through.')
      else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t go through.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(null)
    }
  }
  const where = payment.origin ? new URL(payment.origin).host : (payment.description ?? shortAddress(payment.to))
  return (
    <Sticker fill={colors.coralTint} radius={22} lift style={{ marginBottom: 10 }}>
      <View style={{ padding: 14, gap: 12 }}>
        <View style={styles.askTop}>
          <View style={[styles.badge, { backgroundColor: colors.ink }]}>
            <Icon name="terminal" size={18} color={colors.tealSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt weight="heavy" size={15}>
              {payment.key.label ?? 'Your agent'}
            </Txt>
            <Txt size={13} color={colors.muted} numberOfLines={1}>
              wants to pay {where}
            </Txt>
          </View>
          <Txt weight="heavy" size={22}>
            {dollars(payment.amount)}
          </Txt>
        </View>
        {payment.description && payment.origin ? (
          <Txt size={13} color={colors.onTint} style={{ fontStyle: 'italic' }}>
            “{payment.description}”
          </Txt>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <PillButton label={busy === 'decline' ? 'Declining…' : 'Decline'} icon="close" tone="white" disabled={busy !== null} onPress={() => void answer('decline')} />
          </View>
          <View style={{ flex: 1 }}>
            <PillButton
              label={busy === 'approve' ? 'Paying…' : 'Approve'}
              icon="face"
              loading={busy === 'approve'}
              disabled={busy !== null}
              onPress={() => void answer('approve')}
            />
          </View>
        </View>
        {problem ? <Txt color={colors.danger}>{problem}</Txt> : null}
      </View>
    </Sticker>
  )
}

export function Choice<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <View style={styles.choice}>
      {options.map((option) => {
        const on = option.value === value
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => {
              void Haptics.selectionAsync()
              onChange(option.value)
            }}
            style={[styles.choiceItem, on && { backgroundColor: colors.ink }]}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
          >
            <Txt weight="bold" size={14} color={on ? colors.white : colors.ink}>
              {option.label}
            </Txt>
          </Pressable>
        )
      })}
    </View>
  )
}

export function MoneyField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return (
    <View style={styles.money}>
      <Txt weight="heavy" size={17} color={colors.muted}>
        $
      </Txt>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^\d.]/g, '').replace(/^(\d*\.\d{0,2}).*$/, '$1'))}
        keyboardType="decimal-pad"
        style={styles.moneyInput}
      />
    </View>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt weight="heavy" size={12} color={colors.onTint} style={{ letterSpacing: 0.6 }}>
        {label.toUpperCase()}
      </Txt>
      {children}
    </View>
  )
}

/** A token or a command, monospaced on ink, with a copy button. */
export function Snippet({ text, strong }: { text: string; strong?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <View style={styles.snippet}>
      <Txt size={strong ? 14 : 12} color={strong ? colors.white : colors.tealSoft} style={styles.mono} selectable>
        {text}
      </Txt>
      <Pressable
        onPress={async () => {
          await Clipboard.setStringAsync(text)
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        }}
        style={styles.copy}
        accessibilityLabel="Copy"
      >
        <Icon name={copied ? 'check' : 'copy'} size={16} color={colors.white} />
        <Txt weight="bold" size={13} color={colors.white}>
          {copied ? 'Copied' : 'Copy'}
        </Txt>
      </Pressable>
    </View>
  )
}

export function KeysHero() {
  return (
    <View style={styles.hero}>
      <View style={styles.heroLabel}>
        <Icon name="lock" size={14} color={colors.onTint} />
        <Txt weight="heavy" size={12} color={colors.onTint} style={{ letterSpacing: 1.2 }}>
          WHO CAN SPEND
        </Txt>
      </View>
      <Txt weight="heavy" size={24} style={{ marginTop: 8, paddingRight: 88, lineHeight: 28 }}>
        Your dollars, your rules
      </Txt>
      <Txt size={14} color={colors.onTint} style={{ marginTop: 6, paddingRight: 84, lineHeight: 20 }}>
        Give an AI agent or a person a key with its own limit. Tempo enforces every limit, and any key freezes in one tap.
      </Txt>
      <View style={styles.heroReni} pointerEvents="none">
        <Reni pose="key" size={96} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 12 },
  cardIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  kicker: { letterSpacing: 1.2 },
  answer: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.ink },
  go: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowRule: { borderBottomWidth: 1, borderBottomColor: colors.sunken },
  badge: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  meter: { height: 6, marginTop: 4, borderRadius: 999, backgroundColor: colors.sunken, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 999, backgroundColor: colors.teal },
  askTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  choice: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceItem: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.white },
  money: { flexDirection: 'row', alignItems: 'center', width: 120, paddingLeft: 14, borderWidth: 2, borderColor: colors.ink, borderRadius: 16, backgroundColor: colors.white },
  moneyInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, fontFamily: fonts.heavy, fontSize: 18, color: colors.ink },
  snippet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.ink },
  mono: { flex: 1, fontFamily: 'Menlo', lineHeight: 18 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 1 },
  hero: { marginTop: 8, padding: 18, paddingBottom: 20, borderRadius: 28, borderWidth: 2, borderColor: colors.ink, backgroundColor: '#FFF0B5', overflow: 'hidden' },
  heroLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroReni: { position: 'absolute', right: 8, bottom: -10, transform: [{ rotate: '-6deg' }] },
})
