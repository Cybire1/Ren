import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { type Address, isAddressEqual } from 'viem'
import { parseScanned } from '@/lib/links'
import { formatUsd } from '@/lib/money'
import { colors, fonts } from '@/lib/theme'
import { type Contact, type Entry, isUnnamed, useWallet } from '@/lib/wallet'
import { Avatar, Flyer } from '@/ui/art'
import { Icon, type IconName } from '@/ui/Icon'
import { Bob } from '@/ui/motion'
import { NameSheet } from '@/ui/NameSheet'
import { Header, Screen, Txt } from '@/ui/primitives'
import { chainName } from '@/lib/config'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const DAY = 86_400_000

function ago(at: number) {
  const days = Math.floor((Date.now() - at) / DAY)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(at).toLocaleDateString([], { day: 'numeric', month: 'short' })
}

/** One line about your history with someone: the latest money that moved between you. */
function story(last: Entry | undefined) {
  if (!last) return 'No payments yet'
  const amount = formatUsd(BigInt(last.amount))
  return last.kind === 'sent' || last.kind === 'paid' ? `You sent ${amount} · ${ago(last.at)}` : `Paid you ${amount} · ${ago(last.at)}`
}

/**
 * Who to send to. One field takes a name, an address or a Kova link: it filters your people as
 * you type, and anything payable becomes a "Send to" card at once. Scan and paste live inside
 * the field; the people you pay most recently are one tap away.
 */
export default function PickPerson() {
  const { contacts, activity } = useWallet()
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [naming, setNaming] = useState<Contact | null>(null)

  const people = useMemo(() => {
    const lastWith = (a: Address) => activity.find((e) => e.address && isAddressEqual(e.address, a))
    return contacts
      .map((c) => ({ ...c, last: lastWith(c.address) }))
      .sort((x, y) => (y.last?.at ?? 0) - (x.last?.at ?? 0))
  }, [contacts, activity])

  const query = text.trim().toLowerCase()
  const shown = query ? people.filter((p) => p.name.toLowerCase().includes(query) || p.address.toLowerCase().includes(query)) : people
  const direct = query ? parseScanned(text) : null

  const open = (c: Pick<Contact, 'address' | 'name' | 'currency'>) => {
    void Haptics.selectionAsync()
    router.push({ pathname: '/send/[to]', params: { to: c.address, name: c.name, cur: c.currency ?? '' } })
  }

  const name = (c: Contact) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setNaming(c)
  }

  const go = (value: string) => {
    const scanned = parseScanned(value)
    if (!scanned) return setProblem('That isn’t a Kova link or a wallet address.')
    if (scanned.kind === 'charge') return router.replace({ pathname: '/pay/[id]', params: { id: scanned.id } })
    if (scanned.kind === 'pair') return router.replace({ pathname: '/terminal/setup', params: { code: scanned.code } })
    if (scanned.kind === 'stall') return router.replace({ pathname: '/s/[slug]', params: { slug: scanned.slug } })
    router.push({
      pathname: '/send/[to]',
      params: { to: scanned.address, name: scanned.name ?? '', cur: scanned.currency ?? '', amount: scanned.amount ?? '', note: scanned.note ?? '' },
    })
  }

  const paste = async () => {
    const clip = (await Clipboard.getStringAsync()).trim()
    if (!clip) return setProblem('Nothing to paste. Ask them for their Kova link.')
    setText(clip)
    setProblem(parseScanned(clip) ? null : 'That isn’t a Kova link or a wallet address.')
  }

  return (
    <Screen bg={colors.paper}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Txt weight="bold" size={34} style={{ letterSpacing: -1 }}>
            Who’s it for?
          </Txt>

          {/* One smart field */}
          <View style={[styles.field, problem ? { borderColor: colors.danger } : null]}>
            <Icon name="send" size={18} color={colors.muted} />
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v)
                setProblem(null)
              }}
              onSubmitEditing={() => go(text)}
              placeholder="Name, address or link"
              placeholderTextColor="#8C9799"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              style={styles.input}
            />
            {text ? (
              <FieldButton icon="close" label="Clear" onPress={() => setText('')} />
            ) : (
              <>
                <FieldButton icon="copy" label="Paste" onPress={paste} />
                <FieldButton icon="scan" label="Scan" onPress={() => router.push('/scan')} solid />
              </>
            )}
          </View>
          {problem ? (
            <Txt weight="medium" size={14} color={colors.danger} style={{ marginTop: 8, marginLeft: 6 }}>
              {problem}
            </Txt>
          ) : null}

          {/* A payable address or link, recognised as you type or paste */}
          {direct && direct.kind === 'person' ? (
            <Pressable accessibilityRole="button" onPress={() => go(text)} style={({ pressed }) => [styles.direct, pressed && { transform: [{ scale: 0.98 }] }]}>
              <Avatar name={direct.name ?? direct.address} id={direct.address} size={52} />
              <View style={{ flex: 1 }}>
                <Txt weight="semi" size={17} color={colors.white}>
                  Send to {direct.name || short(direct.address)}
                </Txt>
                <Txt size={13} color={colors.onInk}>
                  {direct.amount ? `They asked for $${direct.amount}` : `${chainName} address, ready to pay`}
                </Txt>
              </View>
              <View style={styles.directGo}>
                <Icon name="arrow" size={20} />
              </View>
            </Pressable>
          ) : null}

          {people.length === 0 && !direct ? (
            <View style={styles.empty}>
              <Bob>
                <Flyer size={150} />
              </Bob>
              <Txt weight="semi" size={20} style={{ marginTop: 6 }}>
                Send your first payment
              </Txt>
              <Txt size={15} color={colors.muted} style={{ textAlign: 'center', marginTop: 4, lineHeight: 22 }}>
                Scan a friend’s Kova code or paste their link. They’ll be saved here for next time.
              </Txt>
            </View>
          ) : null}

          {/* Recent: big faces, one tap */}
          {!query && people.length > 0 ? (
            <>
              <Txt weight="semi" size={14} color={colors.muted} style={styles.section}>
                Recent
              </Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
                {people.slice(0, 6).map((p) => (
                  <Pressable
                    key={p.address}
                    accessibilityRole="button"
                    accessibilityLabel={`Send to ${p.name}`}
                    accessibilityHint="Hold to rename"
                    onPress={() => open(p)}
                    onLongPress={() => name(p)}
                    style={styles.recent}
                  >
                    <Avatar name={p.name} id={p.address} size={68} />
                    <Txt weight="semi" size={13} numberOfLines={1}>
                      {isUnnamed(p.name) ? p.address.slice(0, 6) : p.name.split(' ')[0]}
                    </Txt>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          {/* Everyone, with the story of what last moved between you */}
          {shown.length > 0 ? (
            <>
              <Txt weight="semi" size={14} color={colors.muted} style={styles.section}>
                {query ? `Matches (${shown.length})` : 'Everyone'}
              </Txt>
              <View style={styles.list}>
                {shown.map((p, i) => (
                  <Pressable
                    key={p.address}
                    accessibilityRole="button"
                    accessibilityLabel={`Send to ${p.name}`}
                    accessibilityHint="Hold to rename"
                    onPress={() => open(p)}
                    onLongPress={() => name(p)}
                    style={({ pressed }) => [styles.row, i < shown.length - 1 && styles.rule, pressed && { backgroundColor: colors.sunken }]}
                  >
                    <Avatar name={p.name} id={p.address} size={46} />
                    <View style={{ flex: 1 }}>
                      <Txt weight="semi" size={16} numberOfLines={1}>
                        {isUnnamed(p.name) ? short(p.address) : p.name}
                      </Txt>
                      <Txt size={13} color={colors.muted} numberOfLines={1}>
                        {story(p.last)}
                      </Txt>
                    </View>
                    {isUnnamed(p.name) ? (
                      <Pressable accessibilityRole="button" accessibilityLabel="Add a name" hitSlop={6} onPress={() => name(p)} style={styles.nameChip}>
                        <Icon name="pen" size={15} />
                      </Pressable>
                    ) : null}
                    <View style={styles.chip}>
                      <Txt weight="semi" size={13} color={colors.white}>
                        Send
                      </Txt>
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          ) : query && !direct ? (
            <Txt size={15} color={colors.muted} style={{ marginTop: 20, marginLeft: 6 }}>
              No one matches “{text.trim()}”. Paste their Kova link or a full address.
            </Txt>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <NameSheet person={naming} onClose={() => setNaming(null)} />
    </Screen>
  )
}

function FieldButton({ icon, label, onPress, solid }: { icon: IconName; label: string; onPress: () => void; solid?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.fieldButton, solid && { backgroundColor: colors.coral }, pressed && { transform: [{ scale: 0.94 }] }]}
    >
      <Icon name={icon} size={18} color={solid ? colors.white : colors.ink} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  field: {
    marginTop: 16,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 8,
    gap: 10,
  },
  input: { flex: 1, height: '100%', fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  fieldButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  direct: {
    marginTop: 14,
    borderRadius: 26,
    backgroundColor: colors.ink,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  directGo: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 26, marginBottom: 10, marginLeft: 4 },
  recent: { width: 76, alignItems: 'center', gap: 6 },
  list: { borderRadius: 24, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rule: { borderBottomWidth: 1, borderColor: colors.sunken },
  nameChip: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center' },
  chip: { height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.coral, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 30, paddingHorizontal: 20 },
})
