import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { type ReactNode, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { network } from '@/lib/config'
import { personLink } from '@/lib/links'
import { currencyInfo, displayCurrencies, formatUsd } from '@/lib/money'
import { usePrefs } from '@/lib/prefs'
import { useStall } from '@/lib/stall'
import { colors } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Avatar } from '@/ui/art'
import { dockClearance } from '@/ui/Dock'
import { Icon, type IconName } from '@/ui/Icon'
import { Txt } from '@/ui/primitives'

/**
 * You, as a Kova pass: an identity card with your face, your address and your code, torn
 * along a perforation like a boarding pass. Below it, what you've done with Kova, then the
 * few settings that matter, grouped so each reads at a glance.
 */
export default function Profile() {
  const { profile, activity, contacts, setCurrency, signOut } = useWallet()
  const { setMode } = usePrefs()
  const stall = useStall()
  const insets = useSafeAreaInsets()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [copied, setCopied] = useState(false)

  const stats = useMemo(() => {
    const out = activity.filter((e) => e.kind === 'paid' || e.kind === 'sent')
    const moved = activity.reduce((sum, e) => sum + BigInt(e.amount), 0n)
    return { payments: out.length, people: contacts.length, moved }
  }, [activity, contacts])

  if (!profile) return null
  const since = new Date(profile.createdAt ?? activity.at(-1)?.at ?? Date.now())
  const link = personLink({ address: profile.address, name: profile.name, currency: profile.currency })

  const copy = async () => {
    await Clipboard.setStringAsync(profile.address)
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: dockClearance + insets.bottom }}
    >
      <Txt weight="bold" size={32} style={{ letterSpacing: -1 }}>
        Profile
      </Txt>

      {/* The pass */}
      <View style={styles.pass}>
        <View style={styles.passTop}>
          <View style={styles.ring}>
            <Avatar name={profile.name} id={profile.address} size={64} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt weight="bold" size={22} color={colors.white} numberOfLines={1} style={{ letterSpacing: -0.4 }}>
              {profile.name}
            </Txt>
            <Txt size={13} color={colors.onInk}>
              Member since {since.toLocaleDateString([], { month: 'short', year: 'numeric' })}
            </Txt>
          </View>
        </View>

        <View style={styles.tear} pointerEvents="none">
          <View style={[styles.notch, { left: -13 }]} />
          <View style={styles.perforation} />
          <View style={[styles.notch, { right: -13 }]} />
        </View>

        <View style={styles.passBottom}>
          <View style={{ flex: 1, gap: 10 }}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt size={12} color={colors.onInk}>
                  Your address on Tempo
                </Txt>
                <View style={styles.network}>
                  <View style={[styles.dot, { backgroundColor: network.id === 'testnet' ? colors.yellow : colors.tealLight }]} />
                  <Txt weight="semi" size={10} color={colors.white}>
                    {network.id === 'testnet' ? 'Testnet' : 'Mainnet'}
                  </Txt>
                </View>
              </View>
              <Txt weight="semi" size={16} color={colors.white} style={{ letterSpacing: 0.4 }}>
                {profile.address.slice(0, 8)}…{profile.address.slice(-6)}
              </Txt>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Copy your address" onPress={copy} style={styles.copy}>
              <Icon name={copied ? 'check' : 'copy'} size={15} color={colors.ink} />
              <Txt weight="semi" size={13}>
                {copied ? 'Copied' : 'Copy'}
              </Txt>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Show my Kova code" onPress={() => router.push('/receive')} style={styles.qr}>
            <QRCode value={link} size={76} color={colors.ink} backgroundColor={colors.surface} ecl="L" />
          </Pressable>
        </View>
      </View>

      {/* What you've done */}
      <View style={styles.stats}>
        <Stat value={String(stats.payments)} label="Payments" />
        <Stat value={String(stats.people)} label="People" />
        <Stat value={formatUsd(stats.moved).replace(/\.\d+$/, '')} label="Moved" />
      </View>

      {/* Settings */}
      <Group title="Money">
        <Row icon="swap" label="Show my money in" value={currencyInfo[profile.currency].name} last>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.currencies}>
            {displayCurrencies.map((c) => {
              const on = c === profile.currency
              return (
                <Pressable
                  key={c}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={currencyInfo[c].name}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    void setCurrency(c)
                  }}
                  style={[styles.currency, on && styles.currencyOn]}
                >
                  <Txt weight="semi" size={14} color={on ? colors.white : colors.ink}>
                    {currencyInfo[c].symbol} {c}
                  </Txt>
                </Pressable>
              )
            })}
          </ScrollView>
        </Row>
      </Group>

      <Group title="For businesses">
        <Row
          icon="stall"
          tint={colors.coral}
          label={stall.complete ? (stall.owned?.name ?? 'Your stall') : stall.owned ? 'Finish opening your stall' : 'Open a stall'}
          value={
            stall.complete
              ? stall.stall
                ? `${stall.stall.open ? 'Open' : 'Closed'}, ${stall.stall.items.length} ${stall.stall.items.length === 1 ? 'item' : 'items'}`
                : 'Your stall'
              : 'Sell from a link. Get paid in dollars'
          }
          onPress={() => {
            if (!stall.complete) return router.push('/open-stall')
            setMode('terminal')
            router.replace('/terminal/stall')
          }}
        />
        <Row
          icon="terminal"
          label="Kova Terminal"
          value={stall.complete ? 'Charge, scan barcodes and hand over orders' : 'Take payments at your counter'}
          onPress={() => {
            setMode('terminal')
            router.replace('/terminal')
          }}
          last
        />
      </Group>

      <Group title="Security">
        <Row
          icon="face"
          label="Face ID"
          value={profile.protected ? 'Approves every payment' : 'Off on this device'}
          badge={profile.protected ? { text: 'On', tone: colors.teal } : { text: 'Off', tone: colors.coral }}
        />
        <Row icon="lock" label="Your key" value="Never leaves this phone" last />
      </Group>

      <View style={{ marginTop: 26, alignItems: 'center' }}>
        {confirmRemove ? (
          <View style={styles.confirm}>
            <Txt weight="semi" size={16}>
              Remove this wallet from the phone?
            </Txt>
            <Txt size={14} color={colors.muted} style={{ marginTop: 4, lineHeight: 20 }}>
              {stall.owned
                ? `The key is deleted and can’t be recovered, and ${stall.owned.name} pays into this wallet. Move your money out and point your shop at a new wallet on the Kova dashboard first.`
                : 'The key is deleted and can’t be recovered. Move your money out first.'}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Pressable accessibilityRole="button" onPress={() => setConfirmRemove(false)} style={[styles.small, { backgroundColor: colors.surface }]}>
                <Txt weight="semi" size={15}>
                  Keep it
                </Txt>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  await signOut()
                  router.replace('/welcome')
                }}
                style={[styles.small, { backgroundColor: colors.danger, borderColor: colors.danger }]}
              >
                <Txt weight="semi" size={15} color={colors.white}>
                  Remove wallet
                </Txt>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setConfirmRemove(true)} hitSlop={10}>
            <Txt weight="semi" size={15} color={colors.danger}>
              Remove wallet from this phone
            </Txt>
          </Pressable>
        )}
      </View>
    </ScrollView>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Txt weight="bold" size={20} numberOfLines={1} adjustsFontSizeToFit style={{ letterSpacing: -0.5 }}>
        {value}
      </Txt>
      <Txt size={12} color={colors.muted}>
        {label}
      </Txt>
    </View>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Txt weight="semi" size={13} color={colors.muted} style={{ marginBottom: 8, marginLeft: 4 }}>
        {title}
      </Txt>
      <View style={styles.group}>{children}</View>
    </View>
  )
}

function Row({
  icon,
  label,
  value,
  tint = colors.tealSoft,
  badge,
  onPress,
  last,
  children,
}: {
  icon: IconName
  label: string
  value?: string
  tint?: string
  badge?: { text: string; tone: string }
  onPress?: () => void
  last?: boolean
  children?: ReactNode
}) {
  const body = (
    <View style={[styles.row, !last && styles.rowRule]}>
      <View style={styles.rowTop}>
        <View style={[styles.rowIcon, { backgroundColor: tint }]}>
          <Icon name={icon} size={19} color={tint === colors.coral ? colors.white : colors.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="semi" size={16}>
            {label}
          </Txt>
          {value ? (
            <Txt size={13} color={colors.muted} numberOfLines={1}>
              {value}
            </Txt>
          ) : null}
        </View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: badge.tone }]}>
            <Txt weight="semi" size={12} color={colors.white}>
              {badge.text}
            </Txt>
          </View>
        ) : null}
        {onPress ? <Icon name="arrow" size={20} /> : null}
      </View>
      {children}
    </View>
  )
  if (!onPress) return body
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {body}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pass: { marginTop: 16, borderRadius: 28, backgroundColor: colors.ink },
  passTop: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, paddingBottom: 16 },
  ring: { borderRadius: 36, borderWidth: 3, borderColor: colors.yellow, padding: 2 },
  network: {
    height: 20,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  tear: { height: 26, justifyContent: 'center' },
  notch: { position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: colors.paper },
  perforation: { marginHorizontal: 22, borderTopWidth: 2, borderColor: 'rgba(255,255,255,0.22)', borderStyle: 'dashed' },
  passBottom: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, paddingTop: 12 },
  copy: {
    alignSelf: 'flex-start',
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qr: { padding: 8, borderRadius: 14, backgroundColor: colors.surface },
  stats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  group: { borderRadius: 22, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, overflow: 'hidden' },
  row: { paddingHorizontal: 14, paddingVertical: 12 },
  rowRule: { borderBottomWidth: 1, borderColor: colors.sunken },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  badge: { height: 24, paddingHorizontal: 10, borderRadius: 12, justifyContent: 'center' },
  currencies: { gap: 8, paddingTop: 12, paddingLeft: 50, paddingRight: 4 },
  currency: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.ink,
    justifyContent: 'center',
  },
  currencyOn: { backgroundColor: colors.ink },
  confirm: { alignSelf: 'stretch', borderRadius: 22, borderWidth: 2, borderColor: colors.ink, padding: 16, backgroundColor: colors.surface },
  small: { flex: 1, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
})
