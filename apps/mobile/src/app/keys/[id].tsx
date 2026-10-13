import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Linking, ScrollView, StyleSheet, View } from 'react-native'
import { chainName, network } from '@/lib/config'
import type { KeyPaymentView } from '@/lib/keys-state'
import { colors } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Reni } from '@/ui/art'
import { Icon, type IconName } from '@/ui/Icon'
import { dollars, ended, KIND, Meter, meter, shortAddress, shortDate, Snippet, standing } from '@/ui/keys'
import { Header, PillButton, Screen, TextLink, Txt } from '@/ui/primitives'

/** One key: what it can still spend, its rules, connecting an agent, freezing it, and what it paid. */
export default function KeyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { keys, profile } = useWallet()
  const key = keys.given.find((k) => k.id === id) ?? keys.received.find((k) => k.id === id)
  const mine = Boolean(key && profile && key.owner.toLowerCase() === profile.address.toLowerCase())
  const [payments, setPayments] = useState<KeyPaymentView[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    if (keys.status === 'signed-out') void keys.signIn().catch(() => {})
  }, [keys])

  useEffect(() => {
    if (!key || !mine) return
    let live = true
    const load = () => void keys.payments(key).then((rows) => live && setPayments(rows)).catch(() => {})
    load()
    const timer = setInterval(load, 8000)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [key, keys, mine])

  if (!key)
    return (
      <Screen>
        <Header title="Key" />
        <View style={styles.empty}>
          <Reni pose="sleep" size={120} />
          <Txt weight="bold" size={17}>
            {keys.status === 'ready' ? 'No such key' : 'Opening your keys…'}
          </Txt>
        </View>
      </Screen>
    )

  const act = async (what: string, run: () => Promise<unknown>) => {
    setBusy(what)
    setProblem(null)
    try {
      await run()
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t go through.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(null)
    }
  }

  const kind = KIND[key.kind]
  const live = key.status === 'active' && !ended(key)
  const shown = dollars(live ? key.remaining : key.status === 'frozen' ? '0' : key.limit)
  const command = `claude mcp add --transport http ren ${keys.mcpUrl} --header "Authorization: Bearer ${token ?? 'YOUR_TOKEN'}"`
  const renews = key.period_ends_at
    ? new Date(key.period_ends_at).toDateString() === new Date().toDateString()
      ? new Date(key.period_ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : shortDate(key.period_ends_at)
    : null

  return (
    <Screen>
      <Header title={key.label} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.hero, { backgroundColor: key.kind === 'allowance' ? colors.tealDeep : key.kind === 'card' ? colors.coralDeep : colors.ink }]}>
          <View style={styles.heroTop}>
            <View style={styles.label}>
              <Icon name={kind.icon} size={15} color={colors.tealSoft} />
              <Txt weight="heavy" size={12} color={colors.tealSoft} style={{ letterSpacing: 1.2 }}>
                {(mine ? kind.noun : `From ${shortAddress(key.owner)}`).toUpperCase()}
              </Txt>
            </View>
            <View style={[styles.chip, { backgroundColor: live ? colors.tealSoft : 'rgba(255,255,255,0.18)' }]}>
              <Txt weight="bold" size={12} color={live ? colors.ink : colors.white}>
                {key.status === 'revoked' ? 'Removed' : ended(key) ? 'Ended' : key.status === 'frozen' ? 'Frozen' : key.status === 'pending' ? 'Not on yet' : 'Active'}
              </Txt>
            </View>
          </View>
          <View style={styles.amount}>
            <Txt weight="semi" size={24} color={colors.tealSoft} style={{ marginTop: 6 }}>
              $
            </Txt>
            <Txt weight="heavy" size={46} color={colors.white} exact>
              {shown.slice(1, shown.indexOf('.'))}
            </Txt>
            <Txt weight="semi" size={22} color={colors.tealSoft} style={{ marginTop: 6 }}>
              {shown.slice(shown.indexOf('.'))}
            </Txt>
          </View>
          <Txt size={14} color={colors.onInk} style={{ paddingRight: 90 }}>
            {live
              ? `left of ${dollars(key.limit)} ${key.period === 'week' ? 'this week' : 'today'}${renews ? `, renews ${renews}` : ''}`
              : key.status === 'pending'
                ? `${dollars(key.limit)} a ${key.period}, once it’s on`
                : standing(key)}
          </Txt>
          {live ? <Meter value={meter(key)} onInk /> : null}
          <View style={styles.heroReni} pointerEvents="none">
            <Reni pose={key.kind === 'agent' ? 'key' : 'wave'} size={90} />
          </View>
        </View>

        {problem ? (
          <Txt color={colors.danger} style={{ marginTop: 12 }}>
            {problem}
          </Txt>
        ) : null}

        {mine && key.kind === 'allowance' && key.status === 'pending' ? (
          <View style={styles.call}>
            <Txt weight="heavy" size={16}>
              {key.holder ? `${key.holder_name ?? shortAddress(key.holder)} accepted` : 'Waiting for them'}
            </Txt>
            <Txt size={14} color={colors.onTint}>
              {key.holder
                ? `Switch it on and they can spend up to ${dollars(key.limit)} a ${key.period} from your dollars.`
                : 'Once they open your link in Ren, you switch it on here. Lost the link? Remove this one and make a new one.'}
            </Txt>
            {key.holder ? (
              <PillButton
                label={busy === 'on' ? 'Switching on…' : 'Switch it on'}
                icon="face"
                loading={busy === 'on'}
                disabled={busy !== null}
                onPress={() => void act('on', () => keys.switchOn(key))}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.facts}>
          <Fact label="Limit" value={`${dollars(key.limit)} a ${key.period}`} hint={`${chainName} enforces it`} icon="lock" />
          {key.rules ? (
            <>
              <Fact label="Most per payment" value={dollars(key.rules.per_payment)} />
              <Fact
                label="Asks you above"
                value={Number(key.rules.approve_above) >= Number(key.rules.per_payment) ? 'Never asks' : dollars(key.rules.approve_above)}
              />
              <Fact
                label="May pay"
                value={key.rules.payees === 'anyone' ? 'Anyone' : `${key.rules.payees.length} wallet${key.rules.payees.length === 1 ? '' : 's'} you listed`}
              />
            </>
          ) : null}
          {key.kind === 'allowance' && key.holder ? (
            <Fact label="Held by" value={key.holder_name ? `${key.holder_name} (${shortAddress(key.holder)})` : shortAddress(key.holder)} />
          ) : null}
          <Fact label="Ends" value={new Date(key.expires_at).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })} />
          {key.key_id ? <Fact label={`Key on ${chainName}`} value={shortAddress(key.key_id)} last /> : null}
        </View>
        {key.key_id && key.status !== 'pending' ? (
          <View style={{ marginTop: 8 }}>
            <TextLink
              label={`See the wallet on ${chainName}’s explorer`}
              color={colors.tealDeep}
              onPress={() => void Linking.openURL(`${network.explorerUrl}/address/${key.owner}`)}
            />
          </View>
        ) : null}

        {mine && key.kind === 'agent' && key.status !== 'revoked' && key.status !== 'pending' ? (
          <View style={{ marginTop: 22, gap: 10 }}>
            <Txt weight="heavy" size={20}>
              Connect your agent
            </Txt>
            <Txt color={colors.muted}>
              Your agent pays through Ren’s MCP server with this key’s token. Ren keeps the key itself; the token only lets the agent ask.
            </Txt>
            <Snippet text={command} />
            {token ? (
              <Txt size={13} color={colors.muted}>
                This token is shown once. The old one stopped working.
              </Txt>
            ) : (
              <PillButton
                label={busy === 'token' ? 'Making…' : 'Make a new token'}
                icon="swap"
                tone="white"
                disabled={busy !== null}
                onPress={() => void act('token', async () => setToken(await keys.newToken(key)))}
              />
            )}
          </View>
        ) : null}

        {mine && key.status !== 'revoked' && key.status !== 'pending' ? (
          <View style={{ marginTop: 22, gap: 8 }}>
            {key.status === 'frozen' ? (
              <PillButton
                label={busy === 'unfreeze' ? 'Unfreezing…' : 'Unfreeze'}
                icon="bolt"
                loading={busy === 'unfreeze'}
                disabled={busy !== null}
                onPress={() => void act('unfreeze', () => keys.unfreeze(key))}
              />
            ) : (
              <PillButton
                label={busy === 'freeze' ? 'Freezing…' : 'Freeze this key'}
                icon="snow"
                loading={busy === 'freeze'}
                disabled={busy !== null}
                onPress={() => void act('freeze', () => keys.freeze(key))}
              />
            )}
          </View>
        ) : null}

        {mine && key.status !== 'revoked' ? (
          confirmRemove ? (
            <View style={[styles.call, { backgroundColor: colors.coralTint }]}>
              <Txt weight="heavy" size={16}>
                Remove {key.label} for good?
              </Txt>
              <Txt size={14} color={colors.onTint}>
                It stops at once and {chainName} revokes it. A removed key can’t come back.
              </Txt>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <PillButton label="Keep it" icon="close" tone="white" onPress={() => setConfirmRemove(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PillButton
                    label={busy === 'remove' ? 'Removing…' : 'Remove'}
                    icon="trash"
                    loading={busy === 'remove'}
                    disabled={busy !== null}
                    onPress={() =>
                      void act('remove', async () => {
                        await keys.remove(key)
                        router.back()
                      })
                    }
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', marginTop: 16 }}>
              <TextLink label="Remove this key" color={colors.danger} onPress={() => setConfirmRemove(true)} />
            </View>
          )
        ) : null}

        {mine && key.kind === 'agent' ? (
          <>
            <Txt weight="heavy" size={20} style={{ marginTop: 26, marginBottom: 10 }}>
              What it paid
            </Txt>
            {payments === null ? (
              <Txt color={colors.muted}>Loading…</Txt>
            ) : payments.length === 0 ? (
              <View style={styles.empty}>
                <Reni pose="sleep" size={110} />
                <Txt weight="bold" size={17}>
                  Nothing yet
                </Txt>
                <Txt color={colors.muted} style={{ textAlign: 'center' }}>
                  Every payment it makes, or asks for, or is refused, shows up here.
                </Txt>
              </View>
            ) : (
              <View style={styles.list}>
                {payments.map((payment, i) => (
                  <PaymentRow key={payment.id} payment={payment} last={i === payments.length - 1} />
                ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

function Fact({ label, value, hint, icon, last }: { label: string; value: string; hint?: string; icon?: IconName; last?: boolean }) {
  return (
    <View style={[styles.fact, !last && styles.rule]}>
      <Txt size={14} color={colors.muted}>
        {label}
      </Txt>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {icon ? <Icon name={icon} size={13} /> : null}
          <Txt weight="bold" size={14} style={{ textAlign: 'right' }}>
            {value}
          </Txt>
        </View>
        {hint ? (
          <Txt size={12} color={colors.muted} style={{ textAlign: 'right' }}>
            {hint}
          </Txt>
        ) : null}
      </View>
    </View>
  )
}

const STATUS: Record<KeyPaymentView['status'], { label: string; fill: string; ink: string }> = {
  paid: { label: 'Paid', fill: colors.tealSoft, ink: colors.ink },
  paying: { label: 'Paying', fill: colors.sunken, ink: colors.ink },
  approved: { label: 'Approved', fill: colors.tealSoft, ink: colors.ink },
  pending_approval: { label: 'Asks you', fill: colors.coral, ink: colors.white },
  denied: { label: 'Refused', fill: colors.ink, ink: colors.white },
  declined: { label: 'Declined', fill: colors.ink, ink: colors.white },
  failed: { label: 'Didn’t go', fill: colors.ink, ink: colors.white },
  expired: { label: 'Lapsed', fill: colors.sunken, ink: colors.ink },
}

function PaymentRow({ payment, last }: { payment: KeyPaymentView; last: boolean }) {
  const status = STATUS[payment.status]
  const where =
    payment.kind === 'mpp' && payment.origin
      ? new URL(payment.origin).host
      : payment.kind === 'charge'
        ? (payment.description ?? 'A Ren shop')
        : shortAddress(payment.to)
  const what = payment.kind === 'mpp' ? 'Paid request' : payment.kind === 'charge' ? 'Shop charge' : 'Payment'
  const when = new Date(payment.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <View style={[styles.payment, !last && styles.rule]}>
      <View style={[styles.payBadge, { backgroundColor: payment.kind === 'mpp' ? colors.ink : colors.teal }]}>
        <Icon name={payment.kind === 'mpp' ? 'web' : payment.kind === 'charge' ? 'stall' : 'send'} size={16} color={colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt weight="bold" size={15} numberOfLines={1}>
          {where}
        </Txt>
        <Txt size={13} color={colors.muted} numberOfLines={2}>
          {payment.reason && payment.status !== 'paid' ? payment.reason : `${what}, ${when}`}
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Txt weight="bold" size={15} color={payment.status === 'paid' ? colors.ink : colors.muted}>
          {dollars(payment.amount)}
        </Txt>
        <View style={[styles.chip, { backgroundColor: status.fill }]}>
          <Txt weight="bold" size={11} color={status.ink}>
            {status.label}
          </Txt>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 48 },
  hero: { marginTop: 8, padding: 18, paddingBottom: 20, minHeight: 178, borderRadius: 28, borderWidth: 2, borderColor: colors.ink, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  amount: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 },
  heroReni: { position: 'absolute', right: 10, bottom: -6, transform: [{ rotate: '-4deg' }] },
  call: { marginTop: 14, padding: 16, gap: 8, borderRadius: 22, borderWidth: 2, borderColor: colors.ink, backgroundColor: '#FFF0B5' },
  facts: { marginTop: 16, borderRadius: 20, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, paddingHorizontal: 14 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.sunken },
  list: { borderRadius: 22, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.card, paddingHorizontal: 14 },
  payment: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  payBadge: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 24, paddingHorizontal: 24 },
})
