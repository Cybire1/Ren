import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native'
import { getAddress, isAddress } from 'viem'
import {
  applyKey,
  baseToNumber,
  currencyInfo,
  type DisplayCurrency,
  displayCurrencies,
  formatLocal,
  formatUsd,
  groupTyped,
  toBase,
} from '@/lib/money'
import { colors, fonts } from '@/lib/theme'
import { type Entry, isUnnamed, useWallet } from '@/lib/wallet'
import { rateLabel } from '@/lib/rates'
import { Avatar, CitiesScene, Flyer, sendScene } from '@/ui/art'
import { Icon } from '@/ui/Icon'
import { Keypad } from '@/ui/Keypad'
import { NameSheet } from '@/ui/NameSheet'
import { Burst, Flight } from '@/ui/motion'
import { Stage as ReniStage } from '@/ui/Stage'
import { Header, PillButton, Rise, Screen, Sticker, TextLink, Txt } from '@/ui/primitives'

type Stage = 'amount' | 'review' | 'sending' | 'sent' | 'problem'

/**
 * Sending money to a person, anywhere. Kova moves dollars; what the other person sees in
 * their own currency is shown as a reference, never as a conversion Kova performs.
 */
export default function SendTo() {
  const params = useLocalSearchParams<{ to: string; name?: string; cur?: string; amount?: string; note?: string; rename?: string }>()
  const { profile, balance, send, contacts } = useWallet()
  const { width } = useWindowDimensions()
  const [typed, setTyped] = useState(params.amount ?? '')
  const [note, setNote] = useState(params.note ?? '')
  const [stage, setStage] = useState<Stage>(params.amount ? 'review' : 'amount')
  const [entry, setEntry] = useState<Entry | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  // `rename=1` opens straight into naming them, e.g. from a link that says who someone is.
  const [naming, setNaming] = useState(params.rename === '1')

  if (!params.to || !isAddress(params.to))
    return (
      <Screen>
        <Header />
        <Txt style={{ padding: 24 }}>That address doesn’t look right.</Txt>
      </Screen>
    )

  const address = getAddress(params.to)
  const saved = contacts.find((c) => c.address.toLowerCase() === address.toLowerCase())?.name
  const name = (saved && !isUnnamed(saved) ? saved : params.name) || `${address.slice(0, 6)}…${address.slice(-4)}`
  const first = name.split(' ')[0]
  const theirs = (displayCurrencies as readonly string[]).includes(params.cur ?? '') ? (params.cur as DisplayCurrency) : null
  const dollars = typed === '' ? 0 : Number(typed)
  const amount = dollars > 0 ? toBase(dollars.toFixed(2)) : 0n
  const short = balance !== null && amount > balance

  const go = async () => {
    setStage('sending')
    try {
      const [done] = await Promise.all([
        send({ address, name, currency: theirs ?? undefined }, amount, note.trim() || undefined),
        new Promise((r) => setTimeout(r, 1800)),
      ])
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setEntry(done)
      setStage('sent')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The money did not move.'
      if (/cancel/i.test(message)) setStage('review')
      else {
        setProblem(message)
        setStage('problem')
      }
    }
  }

  if (stage === 'sending') {
    const top = 260
    return (
      <Screen bg={colors.tealSoft}>
        <View style={{ flex: 1 }}>
          <View style={{ position: 'absolute', left: 24, top }}>
            <CitiesScene width={width - 48} />
          </View>
          <Flight {...sendScene.route(width - 48, 24, top)} size={120} duration={1700}>
            <Flyer size={120} />
          </Flight>
          <View style={styles.sendingCopy}>
            <Txt weight="semi" size={30} style={{ letterSpacing: -0.8 }}>
              Sending to {first}
            </Txt>
            <Txt size={17} color={colors.onTint} style={{ marginTop: 6 }}>
              {formatUsd(amount)} is on its way.
            </Txt>
          </View>
        </View>
      </Screen>
    )
  }

  if (stage === 'sent' && entry)
    return (
      <Screen bg={colors.paper}>
        <Header backIcon="close" onBack={() => router.replace('/(tabs)')} />
        <View style={styles.center}>
          <ReniStage pose="cheer" size={180} />
          <Burst
            spots={[
              { x: width / 2 - 120, y: 180, size: 26, fill: colors.white, delay: 0 },
              { x: width / 2 + 120, y: 160, size: 30, fill: colors.yellow, delay: 150 },
              { x: width / 2 + 90, y: 320, size: 20, fill: colors.white, delay: 300 },
              { x: width / 2 - 100, y: 330, size: 22, fill: colors.yellow, delay: 450 },
            ]}
          />
          <Rise style={{ alignItems: 'center' }}>
            <Txt weight="bold" size={56} style={{ letterSpacing: -2, marginTop: 12 }}>
              Sent!
            </Txt>
            <Txt weight="medium" size={20} style={{ textAlign: 'center' }}>
              {formatUsd(amount)} landed with {first}
            </Txt>
            <Txt size={16} color={colors.onTint} style={{ marginTop: 6 }}>
              {entry.ms ? `It took ${(entry.ms / 1000).toFixed(1)} seconds.` : 'It took seconds.'}
            </Txt>
          </Rise>
        </View>
        <View style={[styles.footer, { gap: 14 }]}>
          <PillButton label="Done" icon="check" onPress={() => router.replace('/(tabs)')} />
          <View style={{ alignItems: 'center' }}>
            <TextLink label="See receipt" onPress={() => router.replace({ pathname: '/receipt/[id]', params: { id: entry.id } })} />
          </View>
        </View>
      </Screen>
    )

  if (stage === 'problem')
    return (
      <Screen bg={colors.sunken}>
        <Header backIcon="close" onBack={() => router.replace('/(tabs)')} />
        <View style={styles.center}>
          <ReniStage pose="oops" size={160} motion="bob" />
          <Txt weight="semi" size={28} style={{ marginTop: 12 }}>
            It didn’t go through
          </Txt>
          <Txt size={16} color={colors.onTint} style={{ textAlign: 'center', marginTop: 8, lineHeight: 23 }}>
            {problem} Your money hasn’t moved.
          </Txt>
        </View>
        <View style={styles.footer}>
          <PillButton label="Try again" onPress={() => setStage('review')} />
        </View>
      </Screen>
    )

  if (stage === 'review') {
    const top = 0
    return (
      <Screen bg={colors.tealSoft}>
        <Header onBack={() => setStage('amount')} />
        <View style={{ paddingHorizontal: 24 }}>
          <Txt weight="semi" size={30} style={{ letterSpacing: -0.6 }}>
            Send to {first}
          </Txt>
          <Txt size={16} color={colors.onTint}>
            Reni gets it there in seconds.
          </Txt>
        </View>
        <View style={{ height: (width - 48) * sendScene.aspect, marginTop: 8 }}>
          <View style={{ position: 'absolute', left: 24, top }}>
            <CitiesScene width={width - 48} />
          </View>
          <Flight {...sendScene.route(width - 48, 24, top)} size={104} duration={5000}>
            <Flyer size={104} />
          </Flight>
        </View>
        <View style={styles.cards}>
          <Sticker radius={28} style={{ height: 96 }}>
            <View style={styles.moneyCard}>
              <View>
                <Txt size={14} color={colors.muted}>
                  You send
                </Txt>
                <Txt weight="semi" size={34} style={{ letterSpacing: -0.8 }}>
                  {formatUsd(amount)}
                </Txt>
              </View>
              <View style={styles.tag}>
                <Txt weight="semi" size={15}>
                  USD
                </Txt>
              </View>
            </View>
          </Sticker>
          {theirs && theirs !== 'USD' ? (
            <View style={styles.rate}>
              <Txt weight="semi" size={14}>
                1 USD ≈ {currencyInfo[theirs].perUsd.toLocaleString('en-US', { maximumFractionDigits: currencyInfo[theirs].decimals === 0 ? 0 : 4 })} {theirs}, {rateLabel()}
              </Txt>
            </View>
          ) : (
            <View style={{ height: 12 }} />
          )}
          <Sticker radius={28} fill={colors.ink} outline={false} style={{ height: 96 }}>
            <View style={styles.moneyCard}>
              <View>
                <Txt size={14} color={colors.onInk}>
                  {first} gets
                </Txt>
                <Txt weight="semi" size={34} color={colors.white} style={{ letterSpacing: -0.8 }}>
                  {formatUsd(amount)}
                </Txt>
              </View>
              {theirs && theirs !== 'USD' ? (
                <Txt size={15} color={colors.onInk}>
                  ≈ {formatLocal(dollars, theirs)}
                </Txt>
              ) : null}
            </View>
          </Sticker>
        </View>
        <View style={styles.feeRow}>
          <Txt size={15}>Fee</Txt>
          <Txt weight="semi" size={15}>
            Under $0.01, network fee
          </Txt>
        </View>
        {short ? (
          <Txt weight="medium" size={15} color={colors.danger} style={{ textAlign: 'center', marginTop: 8 }}>
            You have {formatUsd(balance ?? 0n)}. Add money or send less.
          </Txt>
        ) : null}
        <View style={styles.footer}>
          <PillButton label={`Send ${formatUsd(amount)}`} icon="face" disabled={short || amount === 0n} onPress={go} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen bg={colors.paper}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isUnnamed(name) ? 'Add a name' : `Rename ${name}`}
              hitSlop={8}
              onPress={() => setNaming(true)}
              style={styles.who}
            >
              <Avatar name={name} id={address} size={36} />
              <View style={styles.pen}>
                <Icon name={isUnnamed(name) ? 'plus' : 'pen'} size={10} color={colors.white} />
              </View>
            </Pressable>
          }
          title={`To ${first}`}
          subtitle={isUnnamed(name) ? 'Tap their face to add a name' : `${address.slice(0, 6)}…${address.slice(-4)}`}
        />
        <View style={styles.entry}>
          <Txt weight="semi" size={72} style={[styles.big, typed === '' && { color: '#B4B9B8' }]} numberOfLines={1} adjustsFontSizeToFit>
            ${groupTyped(typed)}
          </Txt>
          <Txt size={15} color={colors.muted}>
            {theirs && theirs !== 'USD'
              ? `${first} sees about ${formatLocal(dollars, theirs)}`
              : balance !== null
                ? `You have ${formatUsd(balance)}`
                : ' '}
          </Txt>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="What's it for?"
            placeholderTextColor="#8C9799"
            maxLength={60}
            style={styles.noteInput}
          />
        </View>
        <Keypad onKey={(key) => setTyped((v) => applyKey(v, key))} size={68} />
        <View style={[styles.footer, { marginTop: 14 }]}>
          <PillButton
            label={short ? 'More than you have' : 'Review'}
            disabled={amount === 0n || short}
            onPress={() => setStage('review')}
          />
        </View>
        {profile && balance !== null && short ? (
          <Txt size={13} color={colors.muted} style={{ textAlign: 'center' }}>
            Balance {formatUsd(balance)} ({baseToNumber(balance) > 0 ? 'send less' : 'add money first'})
          </Txt>
        ) : null}
        <NameSheet person={naming ? { address, name } : null} onClose={() => setNaming(false)} />
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, marginTop: 'auto' },
  sendingCopy: { position: 'absolute', left: 24, right: 24, top: 470, alignItems: 'center' },
  cards: { paddingHorizontal: 20, marginTop: 10 },
  moneyCard: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  tag: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.sunken, justifyContent: 'center' },
  rate: {
    alignSelf: 'center',
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: colors.coral,
    borderWidth: 2,
    borderColor: colors.ink,
    justifyContent: 'center',
    marginVertical: 8,
  },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 28, marginTop: 18 },
  who: { marginRight: 4 },
  pen: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.paper,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entry: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  big: { letterSpacing: -2.5 },
  noteInput: {
    marginTop: 16,
    minWidth: 200,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    backgroundColor: colors.sunken,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'center',
  },
})

