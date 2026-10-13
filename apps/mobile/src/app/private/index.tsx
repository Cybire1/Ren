import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { chainName, isTestnet } from '@/lib/config'
import { formatUsd } from '@/lib/money'
import type { PrivateEntry } from '@/lib/private'
import { colors } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Avatar, Reni } from '@/ui/art'
import { Icon, type IconName } from '@/ui/Icon'
import { Header, PillButton, Screen, Sticker, Txt } from '@/ui/primitives'

/**
 * The private balance's own screen (lib/private.ts): the balance, the three ways to move it, what
 * stays private and what doesn't, and its history. The app's twin of the web's Private screen.
 */
export default function PrivateScreen() {
  const { privacy } = useWallet()
  const [problem, setProblem] = useState<string | null>(null)
  const zone = privacy.zone

  if (!zone)
    return (
      <Screen>
        <Header title="Private" />
        <View style={styles.empty}>
          <Reni pose="key" size={130} />
          <Txt weight="bold" size={18} style={{ textAlign: 'center' }}>
            Private dollars aren’t on this build
          </Txt>
          <Txt color={colors.muted} style={{ textAlign: 'center' }}>
            Ren keeps private balances on a Tempo Zone. Your wallet works exactly the same without it.
          </Txt>
        </View>
      </Screen>
    )

  const ready = privacy.status === 'ready' && privacy.balance !== null
  const usd = ready ? formatUsd(privacy.balance ?? 0n) : ''
  const open = async () => {
    setProblem(null)
    try {
      await privacy.open()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t open.'
      if (!/cancel/i.test(message)) setProblem(message)
    }
  }

  return (
    <Screen>
      <Header title="Private" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.label}>
              <Icon name="lock" size={15} color={colors.tealSoft} />
              <Txt weight="heavy" size={12} color={colors.tealSoft} style={{ letterSpacing: 1.2 }}>
                PRIVATE BALANCE
              </Txt>
            </View>
            {isTestnet ? (
              <View style={styles.chip}>
                <Txt weight="bold" size={12} color={colors.white}>
                  Test dollars
                </Txt>
              </View>
            ) : null}
          </View>
          {ready ? (
            <View style={styles.amount}>
              <Txt weight="semi" size={24} color={colors.tealSoft} style={{ marginTop: 6 }}>
                $
              </Txt>
              <Txt weight="heavy" size={46} color={colors.white} exact>
                {usd.slice(1, usd.lastIndexOf('.'))}
              </Txt>
              <Txt weight="semi" size={22} color={colors.tealSoft} style={{ marginTop: 6 }}>
                {usd.slice(usd.lastIndexOf('.'))}
              </Txt>
            </View>
          ) : (
            <View style={styles.locked}>
              <Txt weight="heavy" size={34} color={colors.white} style={{ letterSpacing: 6 }}>
                ••••••
              </Txt>
              <View style={{ alignSelf: 'flex-start' }}>
                <PillButton
                  label={privacy.status === 'opening' ? 'Opening…' : 'Show with Face ID'}
                  icon="face"
                  tone="white"
                  loading={privacy.status === 'opening'}
                  onPress={() => void open()}
                />
              </View>
            </View>
          )}
          <Txt size={14} color={colors.onInk} style={styles.where}>
            In {zone.operator}’s private zone{zone.operator === chainName ? '' : ` on ${chainName}`}
          </Txt>
          <View style={styles.cardReni} pointerEvents="none">
            <Reni pose="key" size={96} />
          </View>
        </View>
        {problem ? (
          <Txt size={14} color={colors.danger} style={{ marginTop: 10 }}>
            {problem}
          </Txt>
        ) : null}
        {privacy.status === 'unreachable' ? (
          <Txt size={14} color={colors.danger} style={{ marginTop: 10 }}>
            The private zone isn’t answering right now. Your dollars are safe there; try again soon.
          </Txt>
        ) : null}

        <View style={styles.actions}>
          <Action icon="down" label="Move in" sub="From your balance" onPress={() => router.push('/private/move?dir=in')} />
          <Action
            icon="send"
            label="Send privately"
            sub="To anyone"
            fill={colors.coralSoft}
            disc={colors.coral}
            onPress={() => router.push({ pathname: '/send', params: { privately: '1' } })}
          />
          <Action icon="up" label="Move out" sub="Back to your balance" onPress={() => router.push('/private/move?dir=out')} />
        </View>

        <Txt weight="heavy" size={20} style={styles.section}>
          What stays private
        </Txt>
        <Fact
          icon="eyeOff"
          title={`Hidden on ${chainName}`}
          text={`Your private balance doesn’t show on ${chainName}’s explorer. Only you can see it, once Face ID says it’s you.`}
        />
        <Fact
          icon="lock"
          title="Who you pay stays between you"
          text={`Dollars you send privately land in their private balance. ${chainName} sees dollars going into the zone, and how many, but not who they’re for.`}
        />
        <Fact
          icon="info"
          title={`Run by ${zone.operator}`}
          text={`Like a bank, whoever runs the zone can see inside it. Moving in and out shows on ${chainName} as an amount.`}
        />

        <Txt weight="heavy" size={20} style={styles.section}>
          Private activity
        </Txt>
        {ready ? (
          privacy.entries.length ? (
            <View style={styles.list}>
              {privacy.entries.map((entry, i) => (
                <Row key={entry.id} entry={entry} last={i === privacy.entries.length - 1} />
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Reni pose="key" size={110} />
              <Txt weight="bold" size={17}>
                Nothing private yet
              </Txt>
              <Txt color={colors.muted} style={{ textAlign: 'center' }}>
                Move dollars in, or send someone dollars privately. It lands in seconds.
              </Txt>
            </View>
          )
        ) : (
          <Txt color={colors.muted}>Show your private balance to see what moved through it.</Txt>
        )}
      </ScrollView>
    </Screen>
  )
}

function Action({
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
      <View style={styles.action}>
        <View style={[styles.disc, { backgroundColor: disc }]}>
          <Icon name={icon} size={18} color={colors.white} />
        </View>
        <Txt weight="heavy" size={15} style={{ lineHeight: 18 }}>
          {label}
        </Txt>
        <Txt size={12} color={fill === colors.surface ? colors.muted : colors.onTint} style={{ lineHeight: 15 }}>
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

function when(at: number) {
  const d = new Date(at)
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? time : d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

/** One line of private history. A private send came from your balance, so it isn't signed. */
function Row({ entry, last }: { entry: PrivateEntry; last: boolean }) {
  const incoming = entry.kind === 'in' || entry.kind === 'arrived'
  const amount =
    entry.kind === 'sent' ? formatUsd(entry.amount) : entry.kind === 'out' ? formatUsd(-entry.amount) : formatUsd(entry.amount, { sign: true })
  return (
    <View style={[styles.row, !last && styles.rowRule, entry.pending && { opacity: 0.6 }]}>
      {entry.kind === 'sent' ? (
        <Avatar name={entry.name} id={entry.name} size={40} />
      ) : (
        <View style={styles.badge}>
          <Icon name={entry.kind === 'out' ? 'up' : entry.kind === 'in' ? 'down' : 'lock'} size={18} color={colors.tealSoft} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Txt weight="bold" size={15} numberOfLines={1}>
          {entry.name}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="lock" size={11} color={colors.muted} />
          <Txt size={13} color={colors.muted} numberOfLines={1}>
            {entry.detail}, {when(entry.at)}
          </Txt>
        </View>
      </View>
      <Txt weight="bold" size={15} color={incoming ? colors.positive : entry.kind === 'sent' ? colors.muted : colors.ink}>
        {amount}
      </Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 48 },
  card: {
    marginTop: 8,
    padding: 18,
    paddingBottom: 20,
    minHeight: 178,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.ink,
    overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: '#1E3557' },
  amount: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10, paddingRight: 90 },
  locked: { marginTop: 8, gap: 10, paddingRight: 90 },
  where: { marginTop: 12, paddingRight: 90 },
  cardReni: { position: 'absolute', right: 10, bottom: -6, transform: [{ rotate: '-4deg' }] },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  action: { padding: 12, paddingBottom: 14, gap: 2, minHeight: 118 },
  disc: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  section: { marginTop: 26, marginBottom: 10 },
  fact: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  factIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  list: { borderRadius: 22, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.card, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowRule: { borderBottomWidth: 1, borderBottomColor: colors.sunken },
  badge: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 24, paddingHorizontal: 24 },
})
