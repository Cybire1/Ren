import * as Clipboard from 'expo-clipboard'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { parseScanned } from '@/lib/links'
import { colors, fonts } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Avatar } from '@/ui/art'
import { Icon } from '@/ui/Icon'
import { Header, Screen, Sticker, Txt } from '@/ui/primitives'

/** Who to send to: someone you've paid before, their code, or their Kova link. */
export default function PickPerson() {
  const { contacts } = useWallet()
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const go = (value: string) => {
    const scanned = parseScanned(value)
    if (!scanned) return setProblem("That isn't a Kova link or a wallet address.")
    if (scanned.kind === 'charge') return router.replace({ pathname: '/pay/[id]', params: { id: scanned.id } })
    router.push({
      pathname: '/send/[to]',
      params: { to: scanned.address, name: scanned.name ?? '', cur: scanned.currency ?? '', amount: scanned.amount ?? '', note: scanned.note ?? '' },
    })
  }

  return (
    <Screen bg={colors.paper}>
      <Header title="Send" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.options}>
          <Sticker fill={colors.coralSoft} radius={26} style={{ flex: 1, height: 110 }} onPress={() => router.push('/scan')} accessibilityLabel="Scan their code">
            <View style={styles.option}>
              <Icon name="scan" />
              <Txt weight="semi" size={16}>
                Scan their code
              </Txt>
            </View>
          </Sticker>
          <Sticker
            fill={colors.coral}
            radius={26}
            style={{ flex: 1, height: 110 }}
            accessibilityLabel="Paste their link"
            onPress={async () => {
              const clip = await Clipboard.getStringAsync()
              if (clip) go(clip)
              else setProblem('Nothing to paste. Ask them to share their Kova link.')
            }}
          >
            <View style={styles.option}>
              <Icon name="copy" />
              <Txt weight="semi" size={16}>
                Paste their link
              </Txt>
            </View>
          </Sticker>
        </View>

        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v)
            setProblem(null)
          }}
          onSubmitEditing={() => go(text)}
          placeholder="Or type a Tempo address, 0x…"
          placeholderTextColor="#8C9799"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          style={styles.input}
        />
        {problem ? (
          <Txt weight="medium" size={14} color={colors.danger} style={{ marginTop: 8 }}>
            {problem}
          </Txt>
        ) : null}

        <Txt weight="semi" size={18} style={{ marginTop: 28, marginBottom: 6 }}>
          People you pay
        </Txt>
        {contacts.length === 0 ? (
          <Txt size={15} color={colors.muted} style={{ lineHeight: 22 }}>
            Nobody yet. Scan a friend’s code from their Receive screen and they’ll stay here.
          </Txt>
        ) : (
          contacts.map((c) => (
            <Pressable
              key={c.address}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/send/[to]', params: { to: c.address, name: c.name, cur: c.currency ?? '' } })}
              style={({ pressed }) => [styles.person, pressed && { opacity: 0.6 }]}
            >
              <Avatar name={c.name} id={c.address} size={48} />
              <View style={{ flex: 1 }}>
                <Txt weight="semi" size={16}>
                  {c.name}
                </Txt>
                <Txt size={13} color={colors.muted}>
                  {c.address.slice(0, 6)}…{c.address.slice(-4)}
                </Txt>
              </View>
              <Icon name="arrow" size={20} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  options: { flexDirection: 'row', gap: 12 },
  option: { flex: 1, padding: 16, justifyContent: 'space-between' },
  input: {
    marginTop: 18,
    height: 56,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: 18,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.sunken,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
})
