import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { createCharge } from '@/lib/api'
import { applyKey, currencyInfo, type DisplayCurrency, formatLocal, groupTyped, localToUsd } from '@/lib/money'
import { usePrefs } from '@/lib/prefs'
import { colors, fonts } from '@/lib/theme'
import { Keypad } from '@/ui/Keypad'
import { PillButton, RoundButton, Screen, Txt } from '@/ui/primitives'
import { useShop } from '@/lib/shop'

const currencies: DisplayCurrency[] = ['USD', 'EUR', 'GBP', 'NGN']

/**
 * The counter: type the price in the shop's currency, charge. Kova asks for the dollar
 * equivalent at a reference rate the customer can see, and it settles in dollars.
 */
export default function Charge() {
  const shop = useShop()
  const { setMode } = usePrefs()
  const [typed, setTyped] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)

  const info = currencyInfo[shop.currency]
  const local = typed === '' ? 0 : Number(typed)
  const usd = local > 0 ? localToUsd(local, shop.currency) : '0.00'
  const label = `${info.symbol}${groupTyped(typed)}`

  const charge = async () => {
    setBusy(true)
    setProblem(null)
    try {
      const intent = await createCharge(usd, {
        reference: note.trim() || undefined,
        metadata: { price: local, price_currency: shop.currency, reference_rate: info.perUsd },
      })
      setTyped('')
      setNote('')
      router.push({ pathname: '/terminal/[id]', params: { id: intent.id, price: label, usd } })
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Kova is unreachable. Check the connection.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen bg={colors.tealSoft}>
      <View style={styles.header}>
        <RoundButton icon={menu ? 'close' : 'user'} label="Terminal menu" onPress={() => setMenu((m) => !m)} />
        <View style={{ alignItems: 'center' }}>
          <Txt weight="semi" size={18}>
            {shop.name}
          </Txt>
          <Txt size={13} color={colors.onTint}>
            Kova Terminal
          </Txt>
        </View>
        <RoundButton icon="chart" label="Today's sales" onPress={() => router.push('/terminal/today')} />
      </View>

      {menu ? (
        <View style={styles.menu}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode('pay')
              router.replace('/')
            }}
            style={styles.menuItem}
          >
            <Txt weight="semi" size={16}>
              Switch to my wallet
            </Txt>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.entry}>
        <Txt weight="semi" size={76} style={[styles.big, typed === '' && { color: 'rgba(13,13,18,0.28)' }]} numberOfLines={1} adjustsFontSizeToFit>
          {label}
        </Txt>
        <Txt size={15} color={colors.onTint}>
          {shop.currency === 'USD'
            ? `Customer pays $${usd} in USDC`
            : `Customer pays $${usd} USDC at ${formatLocal(1, shop.currency)} per dollar`}
        </Txt>
        <View role="radiogroup" accessibilityLabel="Price currency" style={styles.toggle}>
          {currencies.map((c) => {
            const on = c === shop.currency
            return (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  shop.setCurrency(c)
                  setTyped('')
                }}
                style={[styles.toggleItem, on && { backgroundColor: colors.ink }]}
              >
                <Txt weight="semi" size={14} color={on ? colors.white : colors.ink}>
                  {c}
                </Txt>
              </Pressable>
            )
          })}
        </View>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What's it for? (optional)"
          placeholderTextColor="rgba(13,13,18,0.45)"
          maxLength={60}
          style={styles.note}
        />
        {problem ? (
          <Txt weight="medium" size={14} color={colors.danger} style={{ marginTop: 8 }}>
            {problem}
          </Txt>
        ) : null}
      </View>

      <Keypad onKey={(key) => setTyped((v) => applyKey(v, key, info.decimals))} decimals={info.decimals > 0} size={70} />
      <View style={styles.footer}>
        <PillButton label={local > 0 ? `Charge ${label}` : 'Enter a price'} icon="tap" disabled={local <= 0} loading={busy} onPress={charge} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  menu: {
    position: 'absolute',
    top: 110,
    left: 20,
    zIndex: 10,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 6,
  },
  menuItem: { paddingHorizontal: 16, paddingVertical: 12 },
  entry: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 6 },
  big: { letterSpacing: -3 },
  toggle: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.ink, marginTop: 10 },
  toggleItem: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center' },
  note: {
    marginTop: 10,
    minWidth: 220,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'center',
  },
  footer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
})
