import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { colors } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Reni } from '@/ui/art'
import { Icon, type IconName } from '@/ui/Icon'
import { Ask, KeyRow, KeysHero } from '@/ui/keys'
import { Header, PillButton, Screen, Sticker, Txt } from '@/ui/primitives'

/**
 * Keys (lib/keys-state.ts): everything that can spend this wallet's dollars short of the wallet
 * itself. An agent's key, a person's allowance: each has a limit Tempo enforces, and any of them
 * freezes in one tap. The app's twin of the web's Keys screen.
 */
export default function KeysScreen() {
  const { keys } = useWallet()
  const [problem, setProblem] = useState<string | null>(null)

  if (!keys.available)
    return (
      <Screen>
        <Header title="Keys" />
        <View style={styles.empty}>
          <Reni pose="key" size={130} />
          <Txt weight="bold" size={18} style={{ textAlign: 'center' }}>
            Keys are on Ren’s Tempo build
          </Txt>
        </View>
      </Screen>
    )

  const signIn = async () => {
    setProblem(null)
    try {
      await keys.signIn()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t open.'
      if (!/cancel/i.test(message)) setProblem(message)
    }
  }
  const live = keys.given.filter((k) => k.status !== 'revoked')

  return (
    <Screen>
      <Header title="Keys" />
      <ScrollView contentContainerStyle={styles.body}>
        <KeysHero />

        {keys.status === 'unavailable' ? (
          <Txt color={colors.danger} style={{ marginTop: 14 }}>
            Keys aren’t switched on for this server yet.
          </Txt>
        ) : keys.status !== 'ready' ? (
          <View style={{ marginTop: 16, gap: 8 }}>
            <PillButton
              label={keys.status === 'signing-in' ? 'Opening…' : 'Show your keys'}
              icon="face"
              loading={keys.status === 'signing-in'}
              onPress={() => void signIn()}
            />
            <Txt size={13} color={colors.muted} style={{ textAlign: 'center' }}>
              Face ID signs you in. It moves no money.
            </Txt>
            {problem ? <Txt color={colors.danger}>{problem}</Txt> : null}
          </View>
        ) : (
          <>
            {keys.approvals.length ? (
              <>
                <Txt weight="heavy" size={20} style={styles.section}>
                  Waiting for you
                </Txt>
                {keys.approvals.map((payment) => (
                  <Ask key={payment.id} payment={payment} />
                ))}
              </>
            ) : null}

            <View style={styles.new}>
              <NewTile icon="terminal" label="New agent key" sub="For Claude or any AI agent" onPress={() => router.push('/keys/agent')} />
              <NewTile
                icon="user"
                label="Give an allowance"
                sub="A weekly limit for someone"
                fill="#CFF5E6"
                disc={colors.tealDeep}
                onPress={() => router.push('/keys/allowance')}
              />
            </View>

            <Txt weight="heavy" size={20} style={styles.section}>
              Your keys
            </Txt>
            <View style={styles.list}>
              <View style={[styles.you, live.length > 0 && styles.rule]}>
                <View style={styles.youBadge}>
                  <Icon name="face" size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="bold" size={15}>
                    Your passkey
                  </Txt>
                  <Txt size={13} color={colors.muted}>
                    Full access. Only you hold it.
                  </Txt>
                </View>
                <View style={styles.youChip}>
                  <Txt weight="bold" size={12} color={colors.white}>
                    You
                  </Txt>
                </View>
              </View>
              {live.map((key, i) => (
                <KeyRow key={key.id} keyView={key} last={i === live.length - 1} />
              ))}
            </View>

            {keys.received.length ? (
              <>
                <Txt weight="heavy" size={20} style={styles.section}>
                  Given to you
                </Txt>
                <View style={styles.list}>
                  {keys.received.map((key, i) => (
                    <KeyRow key={key.id} keyView={key} received last={i === keys.received.length - 1} />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}

        <Txt weight="heavy" size={20} style={styles.section}>
          How keys work
        </Txt>
        <Fact icon="lock" title="Tempo enforces the limit" text="Each key is an access key on your wallet. It can only pay in dollars, up to its limit each day or week, until its end date. Not even Ren can raise it." />
        <Fact icon="bell" title="Agents ask before big payments" text="Ren checks an agent’s rules before it signs: the most a payment can be, and above what it waits for your yes." />
        <Fact icon="snow" title="Freeze in one tap" text="Freezing stops a key at once and sets its limit on Tempo to zero. Removing it is for good." />
      </ScrollView>
    </Screen>
  )
}

function NewTile({
  icon,
  label,
  sub,
  onPress,
  fill = colors.surface,
  disc = colors.ink,
}: {
  icon: IconName
  label: string
  sub: string
  onPress: () => void
  fill?: string
  disc?: string
}) {
  return (
    <Sticker onPress={onPress} lift fill={fill} radius={22} style={{ flex: 1 }} accessibilityLabel={label}>
      <View style={styles.tile}>
        <View style={styles.tileTop}>
          <View style={[styles.disc, { backgroundColor: disc }]}>
            <Icon name={icon} size={18} color={colors.white} />
          </View>
          <View style={styles.plus}>
            <Icon name="plus" size={14} />
          </View>
        </View>
        <Txt weight="heavy" size={15} style={{ lineHeight: 18 }}>
          {label}
        </Txt>
        <Txt size={12} color={colors.muted} style={{ lineHeight: 15 }}>
          {sub}
        </Txt>
      </View>
    </Sticker>
  )
}

function Fact({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.fact}>
      <View style={styles.factIcon}>
        <Icon name={icon} size={18} color={colors.tealSoft} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt weight="heavy" size={15}>
          {title}
        </Txt>
        <Txt size={14} color={colors.muted}>
          {text}
        </Txt>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 48 },
  section: { marginTop: 26, marginBottom: 10 },
  new: { flexDirection: 'row', gap: 10, marginTop: 16 },
  tile: { padding: 12, paddingBottom: 14, gap: 2, minHeight: 118 },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  disc: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  plus: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  list: { borderRadius: 22, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.card, paddingHorizontal: 14 },
  you: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.sunken },
  youBadge: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: colors.ink, backgroundColor: '#FFF0B5', alignItems: 'center', justifyContent: 'center' },
  youChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.ink },
  fact: { flexDirection: 'row', gap: 12, padding: 14, marginBottom: 8, borderRadius: 20, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface },
  factIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 24, paddingHorizontal: 24 },
})
