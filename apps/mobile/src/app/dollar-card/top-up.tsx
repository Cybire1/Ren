import { parseAmount } from '@kova/monad'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { Hex } from 'viem'
import { applyKey, formatUsd } from '@/lib/money'
import {
  type DollarCard,
  finishCardTopUp,
  getDollarCard,
  startCardTopUp,
  topUpFee,
} from '@/lib/partners'
import { colors } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Keypad } from '@/ui/Keypad'
import { problemOf, useMoney } from '@/ui/Money'
import { PillButton, Txt } from '@/ui/primitives'

const BLOCKS = 10

/**
 * Top up the dollar card: a sheet over the card. Type an amount, see where it lands in today's limit,
 * and approve it with Face ID. Ren prices it (the amount plus Ren's 0.5% fee) and names the transfer
 * that pays for it; the wallet sends that transfer on Tempo with Ren paying the network fee, tells
 * Ren which transaction it was, and the amount lands on the card.
 */
export default function TopUpSheet() {
  const { profile, signMessage, sendToRen, balance } = useWallet()
  const { data } = useMoney<DollarCard>(getDollarCard)
  const [typed, setTyped] = useState('20')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A top-up whose transfer already left the wallet but Ren hasn't confirmed: trying again tells
  // Ren about that same transfer, and never pays twice.
  const sent = useRef<{ id: string; txHash: Hex } | null>(null)

  const cap = BigInt(data?.daily_topup ?? '100000000')
  const today = BigInt(data?.topups?.today ?? '0')
  const left = BigInt(data?.topups?.left ?? cap.toString())
  const value = (() => {
    try {
      return typed ? parseAmount(typed) : 0n
    } catch {
      return 0n
    }
  })()
  const bps = data?.topup_fee_bps ?? 50
  const fee = value > 0n ? topUpFee(value, bps) : 0n
  const total = value + fee
  const tooMuch = value > left
  const short = balance !== null && total > balance
  const after = left > value ? left - value : 0n
  const earlier = cap > 0n ? Number((today * BigInt(BLOCKS)) / cap) : 0
  const now = cap > 0n ? Math.ceil(Number(((today + value) * BigInt(BLOCKS)) / cap)) - earlier : 0

  const go = async () => {
    if (!profile) return
    setBusy(true)
    setError(null)
    try {
      if (!sent.current) {
        const quote = await startCardTopUp(profile.address, signMessage, value)
        if (!quote.pay.to) throw new Error('Topping up isn’t switched on yet. Nothing moved.')
        const paid = await sendToRen({
          token: quote.pay.token,
          to: quote.pay.to,
          amount: BigInt(quote.pay.amount),
          memo: quote.pay.memo,
          name: 'Dollar card',
          detail: `Top up ${formatUsd(BigInt(quote.amount))}`,
        })
        if (!paid.txHash) throw new Error('Tempo didn’t take it. Nothing left your wallet.')
        sent.current = { id: quote.id, txHash: paid.txHash as Hex }
      }
      try {
        await finishCardTopUp(profile.address, sent.current.id, sent.current.txHash)
      } catch (e) {
        throw new Error(
          `Your dollars reached Ren, but the card isn’t loaded yet (${problemOf(e)}). Try again: nothing is taken twice.`,
        )
      }
      sent.current = null
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.back()
    } catch (e) {
      const message = problemOf(e)
      if (!/cancel/i.test(message)) setError(message)
    } finally {
      setBusy(false)
    }
  }
  const waiting = sent.current !== null

  return (
    <View style={styles.sheet}>
      <Txt weight="bold" size={17}>
        Top up card
      </Txt>
      <Txt weight="bold" size={56} style={styles.amount}>
        <Txt weight="bold" size={30} color={colors.muted}>
          $
        </Txt>
        {typed || '0'}
      </Txt>
      <View style={styles.meter}>
        <View style={styles.blocks}>
          {Array.from({ length: BLOCKS }, (_, i) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: ten fixed blocks of a meter
              key={i}
              style={[
                styles.block,
                i < earlier && styles.blockEarlier,
                i >= earlier && i < earlier + now && (tooMuch ? styles.blockOver : styles.blockNow),
              ]}
            />
          ))}
        </View>
        <View style={styles.meterFoot}>
          <Txt weight="semi" size={12} color={colors.muted}>
            {today > 0n ? `${formatUsd(today)} earlier · ` : ''}
            <Txt weight="semi" size={12} color={tooMuch ? colors.danger : colors.coralDeep}>
              +{formatUsd(value)} now
            </Txt>
          </Txt>
          <Txt weight="bold" size={12} color={tooMuch ? colors.danger : colors.ink}>
            {tooMuch ? `${formatUsd(left)} left today` : `${formatUsd(after)} left today`}
          </Txt>
        </View>
      </View>
      <View style={styles.from}>
        <Txt weight="semi" size={14} style={{ flex: 1 }}>
          From Ren balance
        </Txt>
        <Txt weight="bold" size={14} color={short ? colors.danger : colors.muted}>
          {balance === null ? '—' : formatUsd(balance)}
        </Txt>
      </View>
      <View style={[styles.from, { marginTop: 0 }]}>
        <Txt size={13} color={colors.muted} style={{ flex: 1 }}>
          Ren fee ({(bps / 100).toFixed(1)}%)
        </Txt>
        <Txt weight="semi" size={13} color={colors.muted}>
          {formatUsd(fee)} · you pay {formatUsd(total)}
        </Txt>
      </View>
      <Keypad
        size={52}
        onKey={(key) => (waiting ? undefined : setTyped((t) => applyKey(t, key)))}
      />
      {error ? (
        <Txt weight="medium" size={14} color={colors.danger} style={{ marginTop: 8 }}>
          {error}
        </Txt>
      ) : null}
      <View style={{ marginTop: 14 }}>
        <PillButton
          label={
            waiting
              ? busy
                ? 'Loading your card…'
                : 'Try again'
              : tooMuch
                ? `Up to ${formatUsd(left)} today`
                : short
                  ? 'Not enough in your balance'
                  : busy
                    ? 'Topping up…'
                    : `Top up ${formatUsd(value)}`
          }
          icon="face"
          loading={busy}
          disabled={!waiting && (value <= 0n || tooMuch || short || !data?.topups)}
          onPress={() => void go()}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 30,
    backgroundColor: colors.paper,
  },
  amount: { textAlign: 'center', marginTop: 4, letterSpacing: -2 },
  meter: {
    marginTop: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  blocks: { flexDirection: 'row', gap: 4 },
  block: { flex: 1, height: 14, borderRadius: 3, backgroundColor: colors.sunken },
  blockEarlier: { backgroundColor: colors.teal },
  blockNow: { backgroundColor: colors.coral },
  blockOver: { backgroundColor: colors.danger },
  meterFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  from: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
})
