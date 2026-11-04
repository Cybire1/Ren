import type { SwapIn } from '@kova/tempo'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { explorerTx } from '@/lib/chain'
import { quoteIntoDollars } from '@/lib/chain-tempo'
import { chainName, settlementToken } from '@/lib/config'
import { formatUsd } from '@/lib/money'
import { colors } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Reni } from '@/ui/art'
import { Icon } from '@/ui/Icon'
import { Header, PillButton, Screen, Txt } from '@/ui/primitives'
import { SlideToSend } from '@/ui/send/SlideToSend'

const sum = (values: bigint[]) => values.reduce((a, b) => a + b, 0n)

/**
 * Other dollars: every other dollar the wallet holds on Tempo, what each becomes in Ren's dollar,
 * and one slide that turns them all into it, in one transaction on Tempo's stablecoin exchange,
 * all or nothing. Ren pays the fee.
 */
export default function OtherDollarsScreen() {
  const { otherDollars, turnIntoDollars, refresh } = useWallet()
  const ours = settlementToken.symbol
  const [quotes, setQuotes] = useState<SwapIn[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<{ got: bigint; ms: number; hash: string } | null>(null)

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (done || otherDollars.length === 0) return
    let live = true
    setQuotes(null)
    quoteIntoDollars(otherDollars)
      .then((q) => live && setQuotes(q))
      .catch(() => live && setQuotes([]))
    return () => {
      live = false
    }
  }, [otherDollars, done])

  const quoted = quotes ? sum(quotes.map((q) => q.quoted)) : null
  const held = sum(otherDollars.map((h) => h.amount))
  const unpriced = quotes
    ? otherDollars.filter((h) => !quotes.some((q) => q.token === h.dollar.address))
    : []

  const go = async () => {
    if (!quotes || quotes.length === 0) return
    setBusy(true)
    setProblem(null)
    try {
      const entry = await turnIntoDollars(quotes)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setDone({
        got: sum(quotes.map((q) => q.quoted)),
        ms: entry.ms ?? 0,
        hash: entry.txHash ?? '',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t go through.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(false)
    }
  }

  if (done)
    return (
      <Screen>
        <Header backIcon="close" />
        <View style={styles.center}>
          <Reni pose="cheer" size={160} />
          <Txt weight="heavy" size={28} style={{ textAlign: 'center' }}>
            In your balance
          </Txt>
          <Txt color={colors.muted} style={{ textAlign: 'center' }}>
            {formatUsd(done.got)} in {ours}, ready to pay with. One transaction on {chainName}, and
            Ren paid its fee.
          </Txt>
          <View style={styles.time}>
            <Icon name="bolt" size={15} color={colors.white} />
            <Txt weight="bold" size={14} color={colors.white}>
              Done in {(done.ms / 1000).toFixed(2)} s
            </Txt>
          </View>
          {done.hash ? (
            <Txt
              size={14}
              color={colors.muted}
              style={{ textDecorationLine: 'underline' }}
              onPress={() => void WebBrowser.openBrowserAsync(explorerTx(done.hash))}
            >
              See it on {chainName}’s explorer
            </Txt>
          ) : null}
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            <PillButton label="Done" icon="check" onPress={() => router.back()} />
          </View>
        </View>
      </Screen>
    )

  if (otherDollars.length === 0)
    return (
      <Screen>
        <Header title="Other dollars" />
        <View style={styles.center}>
          <Reni pose="sleep" size={150} />
          <Txt weight="heavy" size={22} style={{ textAlign: 'center' }}>
            No other dollars
          </Txt>
          <Txt color={colors.muted} style={{ textAlign: 'center' }}>
            When USDC, USDT or another dollar reaches this wallet on {chainName}, it shows up here,
            ready to turn into {ours}.
          </Txt>
        </View>
      </Screen>
    )

  return (
    <Screen>
      <Header title="Other dollars" onBack={busy ? null : () => router.back()} />
      <ScrollView contentContainerStyle={styles.flow}>
        <Txt color={colors.muted} style={{ lineHeight: 21 }}>
          Ren keeps one dollar, {ours}, so these wait apart from your balance. Add them and they
          become {ours} in one go.
        </Txt>
        <View style={styles.list}>
          {otherDollars.map((h, i) => {
            const q = quotes?.find((x) => x.token === h.dollar.address)
            return (
              <View key={h.dollar.address} style={[styles.row, i > 0 && styles.rule]}>
                <View style={styles.coin}>
                  <Txt weight="heavy" size={16}>
                    {h.dollar.name.slice(0, 1)}
                  </Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="bold" size={16}>
                    {h.dollar.name}
                  </Txt>
                  <Txt size={13} color={colors.muted}>
                    {formatUsd(h.amount).slice(1)} on {chainName}
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {quotes === null ? (
                    <Txt size={13} color={colors.muted}>
                      Pricing…
                    </Txt>
                  ) : q ? (
                    <>
                      <Txt weight="bold" size={16}>
                        {formatUsd(q.quoted)}
                      </Txt>
                      <Txt size={13} color={colors.muted}>
                        {ours}
                      </Txt>
                    </>
                  ) : (
                    <Txt size={13} color={colors.muted}>
                      No price now
                    </Txt>
                  )}
                </View>
              </View>
            )
          })}
        </View>
        <Txt weight="heavy" size={44} style={{ textAlign: 'center', marginTop: 18 }} exact>
          {quoted === null ? '…' : formatUsd(quoted)}
        </Txt>
        <Txt color={colors.muted} style={{ textAlign: 'center' }}>
          {quoted === null
            ? 'Asking Tempo’s exchange'
            : `Into your balance, from ${formatUsd(held)} of other dollars`}
        </Txt>
        <View style={styles.facts}>
          <Fact label="Fee" value="$0.00, Ren covers it" first />
          <Fact
            label="Rate"
            value={`${chainName}’s stablecoin exchange`}
            hint="Its quote, or at most 0.5% under it, or nothing moves"
          />
          <Fact label="How" value="One transaction" hint="Every swap goes, or none does" />
        </View>
        {unpriced.length > 0 ? (
          <Txt size={13} color={colors.muted}>
            {unpriced.map((h) => h.dollar.name).join(', ')} can’t be priced right now, so{' '}
            {unpriced.length === 1 ? 'it stays as it is' : 'they stay as they are'}.
          </Txt>
        ) : null}
        {problem ? (
          <Txt color={colors.danger} style={{ marginTop: 8 }}>
            {problem}
          </Txt>
        ) : null}
        <View style={{ marginTop: 18 }}>
          <SlideToSend
            label={
              problem
                ? 'Slide to try again'
                : quoted
                  ? `Slide to add ${formatUsd(quoted)}`
                  : 'Slide to add them'
            }
            busy={busy}
            disabled={!quotes || quotes.length === 0}
            onSend={() => void go()}
          />
        </View>
        <Txt size={13} color={colors.muted} style={{ textAlign: 'center', marginTop: 8 }}>
          Face ID approves it. Nothing leaves your wallet.
        </Txt>
      </ScrollView>
    </Screen>
  )
}

function Fact({
  label,
  value,
  hint,
  first,
}: {
  label: string
  value: string
  hint?: string
  first?: boolean
}) {
  return (
    <View style={[styles.fact, !first && styles.rule]}>
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
  flow: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 28,
  },
  list: {
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rule: { borderTopWidth: 1, borderTopColor: colors.sunken },
  coin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facts: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  time: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
})
