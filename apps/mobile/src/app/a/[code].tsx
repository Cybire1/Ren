import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { Address } from 'viem'
import { apiUrl, chainName } from '@/lib/config'
import { colors } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Reni } from '@/ui/art'
import { Icon, type IconName } from '@/ui/Icon'
import { dollars, shortAddress } from '@/ui/keys'
import { Header, PillButton, Screen, Txt } from '@/ui/primitives'

interface Invite {
  from: Address
  label: string
  limit: string
  period: 'day' | 'week'
  expires_at: string
  claimed: boolean
}

/**
 * An allowance someone sent (a /a/… link, opened from Messages or WhatsApp): who gives it and how
 * much, and accepting it, which makes a key in this phone's Keychain that never leaves it. The
 * giver then switches it on with their passkey.
 */
export default function AcceptAllowance() {
  const { code } = useLocalSearchParams<{ code: string }>()
  const { keys, profile, contacts, status } = useWallet()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    void fetch(`${apiUrl}/v1/allowances/${encodeURIComponent(code ?? '')}`)
      .then(async (response) => {
        const body = (await response.json()) as Invite & { error?: { message?: string } }
        if (!response.ok) throw new Error(body.error?.message ?? 'This link isn’t right.')
        setInvite(body)
      })
      .catch((error: Error) => setProblem(error.message))
  }, [code])

  const giver = (owner: string) => {
    const known = contacts.find((c) => c.address.toLowerCase() === owner.toLowerCase())
    return known && !known.name.startsWith('0x') ? known.name : shortAddress(owner)
  }
  const held = keys.held.find((h) => invite && h.owner.toLowerCase() === invite.from.toLowerCase())
  const own = invite && profile && invite.from.toLowerCase() === profile.address.toLowerCase()

  const accept = async () => {
    if (!code) return
    setBusy(true)
    setProblem(null)
    try {
      await keys.claim(code, profile?.name && !profile.name.startsWith('0x') ? profile.name : undefined)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setAccepted(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t go through.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <Header title="An allowance" />
      <ScrollView contentContainerStyle={styles.body}>
        {!invite && problem ? (
          <View style={styles.center}>
            <Reni pose="oops" size={130} />
            <Txt weight="heavy" size={20}>
              This link didn’t open
            </Txt>
            <Txt color={colors.muted} style={{ textAlign: 'center' }}>
              {problem}
            </Txt>
          </View>
        ) : null}
        {invite ? (
          <>
            <View style={styles.hero}>
              <View style={styles.label}>
                <Icon name="user" size={15} color={colors.onTeal} />
                <Txt weight="heavy" size={12} color={colors.onTeal} style={{ letterSpacing: 1.2 }}>
                  ALLOWANCE
                </Txt>
              </View>
              <Txt weight="bold" size={15} color={colors.onTeal} style={{ marginTop: 10 }}>
                {giver(invite.from)} gives you
              </Txt>
              <Txt weight="heavy" size={44} color={colors.white} exact>
                {dollars(invite.limit)}
              </Txt>
              <Txt size={14} color={colors.onTeal} style={{ paddingRight: 96 }}>
                a {invite.period}, from their dollars, until {new Date(invite.expires_at).toLocaleDateString([], { day: 'numeric', month: 'long' })}
              </Txt>
              <View style={styles.reni} pointerEvents="none">
                <Reni pose="wave" size={96} />
              </View>
            </View>

            {status !== 'ready' ? (
              <View style={styles.call}>
                <Txt weight="heavy" size={16}>
                  Make your Ren wallet first
                </Txt>
                <Txt size={14} color={colors.onTint}>
                  An allowance spends into a Ren wallet. Make yours, then open the link again.
                </Txt>
              </View>
            ) : held?.live ? (
              <View style={styles.call}>
                <Txt weight="heavy" size={16}>
                  It’s on
                </Txt>
                <Txt size={14} color={colors.onTint}>
                  You can spend up to {dollars((Number(held.remaining) / 1e6).toString())} {held.period === 'week' ? 'this week' : 'today'}. Pick it under “From” when you send.
                </Txt>
                <PillButton label="Go to your wallet" onPress={() => router.replace('/(tabs)')} />
              </View>
            ) : accepted || (invite.claimed && held) ? (
              <View style={styles.call}>
                <Txt weight="heavy" size={16}>
                  Accepted
                </Txt>
                <Txt size={14} color={colors.onTint}>
                  {giver(invite.from)} switches it on with their passkey. You’ll see it on Home as soon as they do.
                </Txt>
              </View>
            ) : invite.claimed ? (
              <Txt color={colors.danger} style={{ marginTop: 14 }}>
                Someone already accepted this allowance. Ask for a new link.
              </Txt>
            ) : own ? (
              <Txt color={colors.danger} style={{ marginTop: 14 }}>
                This is your own allowance. Send the link to the person it’s for.
              </Txt>
            ) : (
              <>
                <View style={styles.facts}>
                  <Fact label="From" value={giver(invite.from)} />
                  <Fact label="You can spend" value={`${dollars(invite.limit)} a ${invite.period}`} hint={`${chainName} enforces it`} icon="lock" />
                  <Fact label="Your key" value="Made on this phone" hint="It never leaves it, and Ren never sees it" last />
                </View>
                {problem ? <Txt color={colors.danger}>{problem}</Txt> : null}
                <View style={{ marginTop: 14, gap: 8 }}>
                  <PillButton label={busy ? 'Accepting…' : 'Accept'} icon="check" loading={busy} disabled={busy} onPress={() => void accept()} />
                  <Txt size={13} color={colors.muted} style={{ textAlign: 'center' }}>
                    Face ID says it’s you. Nothing moves until they switch it on.
                  </Txt>
                </View>
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

function Fact({ label, value, hint, icon, last }: { label: string; value: string; hint?: string; icon?: IconName; last?: boolean }) {
  return (
    <View style={[styles.fact, !last && { borderBottomWidth: 1, borderBottomColor: colors.sunken }]}>
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

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 48 },
  center: { alignItems: 'center', gap: 10, paddingTop: 40, paddingHorizontal: 20 },
  hero: { marginTop: 8, padding: 18, paddingBottom: 20, minHeight: 178, borderRadius: 28, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.tealDeep, overflow: 'hidden' },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reni: { position: 'absolute', right: 10, bottom: -6, transform: [{ rotate: '-4deg' }] },
  call: { marginTop: 14, padding: 16, gap: 8, borderRadius: 22, borderWidth: 2, borderColor: colors.ink, backgroundColor: '#FFF0B5' },
  facts: { marginTop: 16, borderRadius: 20, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, paddingHorizontal: 14 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
})
