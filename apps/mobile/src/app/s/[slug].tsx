import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getCheckout, getPublicStall, orderFromStall, type PlacedOrder, type PublicStall, payLinkFor } from '@/lib/api'
import { type DisplayCurrency, formatLocal } from '@/lib/money'
import { colors, fonts } from '@/lib/theme'
import { useWallet } from '@/lib/wallet'
import { Kovi } from '@/ui/art'
import { Awning } from '@/ui/Awning'
import { Icon } from '@/ui/Icon'
import { Stage as KoviStage } from '@/ui/Stage'
import { PillButton, RoundButton, Screen, Txt } from '@/ui/primitives'
import { about, dollars, ItemFace, Stepper } from '@/ui/StallParts'
import { chainName } from '@/lib/config'

type Basket = Record<string, number>

/**
 * A stall, as a buyer sees it in Kova Pay: the sign, what's for sale with prices in your own
 * currency, a basket, and two ways to pay: now with Face ID, or by sending the bill to
 * someone who'll pay it from wherever they are.
 */
export default function StallFront() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { profile } = useWallet()
  const [stall, setStall] = useState<PublicStall | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [basket, setBasket] = useState<Basket>({})
  const [open, setOpen] = useState(false)

  useEffect(() => {
    getPublicStall(slug)
      .then(setStall)
      .catch((error: Error) => setProblem(/no such/i.test(error.message) ? 'This stall isn’t here. It may have closed for good.' : error.message))
  }, [slug])

  const currency = profile?.currency ?? 'USD'
  const lines = useMemo(
    () => (stall?.items ?? []).flatMap((item) => (basket[item.id] ? [{ item, quantity: basket[item.id] as number }] : [])),
    [stall, basket],
  )
  const count = lines.reduce((n, l) => n + l.quantity, 0)
  const total = lines.reduce((sum, l) => sum + Math.round(Number(l.item.price) * 100) * l.quantity, 0) / 100
  const set = (id: string, quantity: number) => setBasket((b) => ({ ...b, [id]: Math.max(0, Math.min(99, quantity)) }))
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'))

  if (!stall)
    return (
      <Screen bg={colors.paper}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <RoundButton icon="close" label="Close" onPress={close} />
        </View>
        <View style={styles.center}>
          {problem ? (
            <>
              <KoviStage pose="oops" size={150} motion="bob" />
              <Txt weight="semi" size={24} style={{ marginTop: 12 }}>
                Not this time
              </Txt>
              <Txt size={16} color={colors.muted} style={{ textAlign: 'center', marginTop: 6, lineHeight: 23 }}>
                {problem}
              </Txt>
            </>
          ) : (
            <ActivityIndicator color={colors.ink} />
          )}
        </View>
      </Screen>
    )

  const ordering = stall.open
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View style={{ height: insets.top + 62, overflow: 'hidden' }}>
          <Awning width={width} height={insets.top + 62} stripe={30} tone={stall.open ? 'coral' : 'teal'} />
        </View>
        <View style={styles.sign}>
          <Txt weight="bold" size={32} style={{ letterSpacing: -1.1, lineHeight: 36 }}>
            {stall.name}
          </Txt>
          {stall.tagline ? (
            <Txt size={16} color={colors.muted} style={{ marginTop: 4, lineHeight: 22 }}>
              {stall.tagline}
            </Txt>
          ) : null}
          <View style={styles.chips}>
            <View style={[styles.chip, { backgroundColor: stall.open ? colors.tealSoft : colors.sunken }]}>
              <View style={[styles.dot, { backgroundColor: stall.open ? colors.teal : colors.muted }]} />
              <Txt weight="semi" size={13}>
                {stall.open ? 'Open now' : 'Closed right now'}
              </Txt>
            </View>
            {stall.livemode ? null : (
              <View style={[styles.chip, { backgroundColor: colors.coralSoft }]}>
                <Txt weight="semi" size={13}>
                  Test dollars
                </Txt>
              </View>
            )}
            {stall.shop_name !== stall.name ? (
              <View style={styles.chip}>
                <Txt weight="semi" size={13}>
                  by {stall.shop_name}
                </Txt>
              </View>
            ) : null}
          </View>
          {stall.open ? null : (
            <Txt size={14} color={colors.muted} style={{ marginTop: 10 }}>
              You can look around. Ordering opens when they do.
            </Txt>
          )}
        </View>

        {stall.items.length === 0 ? (
          <View style={styles.center}>
            <Kovi pose="sleep" size={140} />
            <Txt size={16} color={colors.muted}>
              Nothing on the menu yet. Check back soon.
            </Txt>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 10, marginTop: 18 }}>
            {stall.items.map((item) => {
              const qty = basket[item.id] ?? 0
              const local = about(item.price, currency)
              return (
                <View key={item.id} style={[styles.item, qty > 0 && styles.itemIn, item.sold_out && { opacity: 0.55 }]}>
                  <ItemFace item={item} size={76} radius={20} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt weight="semi" size={17} numberOfLines={2}>
                      {item.name}
                    </Txt>
                    {item.description ? (
                      <Txt size={13} color={colors.muted} numberOfLines={2} style={{ lineHeight: 18 }}>
                        {item.description}
                      </Txt>
                    ) : null}
                    <Txt weight="bold" size={16} style={{ marginTop: 2 }}>
                      {dollars(item.price)}
                      {local ? (
                        <Txt size={13} color={colors.muted}>
                          {'  '}
                          {local}
                        </Txt>
                      ) : null}
                    </Txt>
                  </View>
                  {item.sold_out ? (
                    <View style={[styles.chip, { backgroundColor: colors.sunken }]}>
                      <Txt weight="semi" size={12}>
                        Sold out
                      </Txt>
                    </View>
                  ) : qty === 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${item.name}`}
                      disabled={!ordering}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        set(item.id, 1)
                      }}
                      style={({ pressed }) => [styles.add, !ordering && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.92 }] }]}
                    >
                      <Icon name="plus" size={22} color={colors.white} strokeWidth={2.6} />
                    </Pressable>
                  ) : (
                    <Stepper value={qty} name={item.name} onChange={(n) => set(item.id, n)} small />
                  )}
                </View>
              )
            })}
          </View>
        )}
        <Txt size={13} color={colors.muted} style={{ textAlign: 'center', marginTop: 22, paddingHorizontal: 32, lineHeight: 19 }}>
          You pay in dollars from your Ren wallet, with no card fees. Local prices are a guide at Ren’s reference rate.
        </Txt>
      </ScrollView>

      <View style={[styles.close, { top: insets.top + 8 }]}>
        <RoundButton icon="close" label="Close" fill={colors.surface} onPress={close} />
      </View>

      {count > 0 ? (
        <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOutDown} style={[styles.barWrap, { bottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View basket, ${count} items, ${dollars(total)}`}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              setOpen(true)
            }}
            style={({ pressed }) => [styles.bar, pressed && { transform: [{ scale: 0.98 }] }]}
          >
            <View style={styles.barCount}>
              <Txt weight="bold" size={15}>
                {count}
              </Txt>
            </View>
            <Txt weight="semi" size={17} color={colors.white} style={{ flex: 1 }}>
              View basket
            </Txt>
            <Txt weight="bold" size={17} color={colors.white}>
              {dollars(total)}
            </Txt>
          </Pressable>
        </Animated.View>
      ) : null}

      <BasketSheet
        visible={open}
        stall={stall}
        lines={lines}
        total={total}
        currency={currency}
        defaultName={profile?.name.split(' ')[0] ?? ''}
        onQty={set}
        onClose={() => setOpen(false)}
        onPaid={() => setBasket({})}
      />
    </View>
  )
}

function BasketSheet({
  visible,
  stall,
  lines,
  total,
  currency,
  defaultName,
  onQty,
  onClose,
  onPaid,
}: {
  visible: boolean
  stall: PublicStall
  lines: { item: PublicStall['items'][number]; quantity: number }[]
  total: number
  currency: DisplayCurrency
  defaultName: string
  onQty: (id: string, quantity: number) => void
  onClose: () => void
  onPaid: () => void
}) {
  const insets = useSafeAreaInsets()
  const [name, setName] = useState(defaultName)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'pay' | 'ask' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [asked, setAsked] = useState<PlacedOrder | null>(null)

  useEffect(() => {
    if (visible && lines.length === 0 && !asked) onClose()
  }, [visible, lines.length, asked, onClose])

  const place = async (payForMe: boolean) => {
    setBusy(payForMe ? 'ask' : 'pay')
    setProblem(null)
    try {
      const placed = await orderFromStall(stall.slug, {
        items: lines.map((l) => ({ id: l.item.id, quantity: l.quantity })),
        customer_name: name.trim() || undefined,
        note: note.trim() || undefined,
        pay_for_me: payForMe,
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      if (payForMe) setAsked(placed)
      else {
        onClose()
        onPaid()
        router.push({ pathname: '/pay/[id]', params: { id: placed.checkout.id } })
      }
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setProblem(error instanceof Error ? error.message : 'The order didn’t go through. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const dismiss = () => {
    if (asked) {
      setAsked(null)
      onPaid()
    }
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={busy ? undefined : dismiss} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.grip} />
          {asked ? (
            <AskedToPay stall={stall} placed={asked} onDone={dismiss} />
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 14 }}>
              <Txt weight="bold" size={26} style={{ letterSpacing: -0.6 }}>
                Your order
              </Txt>
              <Txt size={14} color={colors.muted}>
                from {stall.name}
              </Txt>
              <View style={styles.basket}>
                {lines.map((l, i) => (
                  <View key={l.item.id} style={[styles.basketLine, i < lines.length - 1 && styles.rule]}>
                    <Stepper small value={l.quantity} name={l.item.name} onChange={(n) => onQty(l.item.id, n)} />
                    <Txt weight="semi" size={15} style={{ flex: 1 }} numberOfLines={2}>
                      {l.item.name}
                    </Txt>
                    <Txt weight="semi" size={15}>
                      {dollars(Number(l.item.price) * l.quantity)}
                    </Txt>
                  </View>
                ))}
                <View style={styles.totalRow}>
                  <Txt weight="semi" size={16}>
                    Total
                  </Txt>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt weight="bold" size={22}>
                      {dollars(total)}
                    </Txt>
                    {currency !== 'USD' ? (
                      <Txt size={13} color={colors.muted}>
                        about {formatLocal(total, currency)}
                      </Txt>
                    ) : null}
                  </View>
                </View>
              </View>

              <Txt weight="semi" size={14} color={colors.muted} style={styles.label}>
                Your name <Txt size={13} color="#8C9799">so they know it’s yours</Txt>
              </Txt>
              <TextInput value={name} onChangeText={setName} maxLength={60} placeholder="Tunde" placeholderTextColor="#8C9799" style={styles.input} />
              <Txt weight="semi" size={14} color={colors.muted} style={styles.label}>
                A note <Txt size={13} color="#8C9799">optional</Txt>
              </Txt>
              <TextInput value={note} onChangeText={setNote} maxLength={200} placeholder="No sugar, please" placeholderTextColor="#8C9799" style={styles.input} />

              {problem ? (
                <Txt weight="medium" size={14} color={colors.danger} style={{ marginTop: 12, textAlign: 'center' }}>
                  {problem}
                </Txt>
              ) : null}
              <View style={{ gap: 10, marginTop: 16 }}>
                <PillButton label={`Pay ${dollars(total)}`} icon="face" loading={busy === 'pay'} disabled={busy !== null || !stall.open} onPress={() => void place(false)} />
                <PillButton label="Ask someone else to pay" icon="send" tone="white" loading={busy === 'ask'} disabled={busy !== null || !stall.open} onPress={() => void place(true)} />
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/** The pay-for-me handoff: a link to send, and the moment it's paid. */
function AskedToPay({ stall, placed, onDone }: { stall: PublicStall; placed: PlacedOrder; onDone: () => void }) {
  const [paid, setPaid] = useState(false)
  const [copied, setCopied] = useState(false)
  const link = payLinkFor(placed.checkout.id)
  const message = `Can you pay for my order at ${stall.name}? It’s ${dollars(placed.checkout.amount)}, paid in dollars with Ren: ${link}`

  useEffect(() => {
    const id = setInterval(async () => {
      const latest = await getCheckout(placed.checkout.id).catch(() => null)
      if (latest?.status === 'paid') {
        clearInterval(id)
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setPaid(true)
      }
    }, 2500)
    return () => clearInterval(id)
  }, [placed.checkout.id])

  if (paid)
    return (
      <View style={styles.asked}>
        <KoviStage pose="cheer" size={140} />
        <Txt weight="bold" size={28} style={{ letterSpacing: -0.8, marginTop: 8 }}>
          It’s paid
        </Txt>
        <Txt size={16} color={colors.muted} style={{ textAlign: 'center', marginTop: 4, lineHeight: 22 }}>
          Someone paid {dollars(placed.checkout.amount)} for your order. {stall.name} has it.
        </Txt>
        <View style={{ alignSelf: 'stretch', marginTop: 18 }}>
          <PillButton label="Done" icon="check" onPress={onDone} />
        </View>
      </View>
    )

  return (
    <View style={styles.asked}>
      <Kovi pose="ride" size={120} />
      <Txt weight="bold" size={26} style={{ letterSpacing: -0.6, textAlign: 'center' }}>
        Send it to whoever’s paying
      </Txt>
      <Txt size={15} color={colors.muted} style={{ textAlign: 'center', marginTop: 6, lineHeight: 21 }}>
        They can pay from anywhere with Ren or any {chainName} wallet. The link stays open for a day, and this updates when it’s paid.
      </Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Copy the payment link"
        onPress={async () => {
          await Clipboard.setStringAsync(link)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        style={styles.linkPill}
      >
        <Icon name={copied ? 'check' : 'copy'} size={16} />
        <Txt weight="semi" size={14} numberOfLines={1} style={{ flexShrink: 1 }}>
          {copied ? 'Link copied' : link.replace(/^https?:\/\//, '')}
        </Txt>
      </Pressable>
      <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 16 }}>
        <PillButton label="Send on WhatsApp" icon="send" onPress={() => void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`)} />
        <PillButton label="Share another way" icon="share" tone="white" onPress={() => void Share.share({ message })} />
      </View>
      <View style={styles.waiting}>
        <ActivityIndicator size="small" color={colors.muted} />
        <Txt size={14} color={colors.muted}>
          Waiting for their payment
        </Txt>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingTop: 30 },
  close: { position: 'absolute', left: 20 },
  sign: { paddingHorizontal: 20, paddingTop: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 10,
    paddingRight: 12,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  itemIn: { backgroundColor: colors.white },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.coral, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  barWrap: { position: 'absolute', left: 20, right: 20 },
  bar: { height: 64, borderRadius: 32, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 8, paddingRight: 24 },
  barCount: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,26,29,0.32)' },
  sheet: { maxHeight: '88%', backgroundColor: colors.paper, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 10 },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(11,26,29,0.16)' },
  basket: { marginTop: 14, borderRadius: 24, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, paddingHorizontal: 14 },
  basketLine: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rule: { borderBottomWidth: 1, borderColor: colors.sunken },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 2, borderColor: colors.ink },
  label: { marginTop: 16, marginBottom: 8, marginLeft: 4 },
  input: {
    height: 52,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
  asked: { alignItems: 'center', paddingTop: 14, paddingBottom: 6 },
  linkPill: {
    marginTop: 14,
    maxWidth: '100%',
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
})
