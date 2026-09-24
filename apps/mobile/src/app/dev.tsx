import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { createItem, getCatalog, getCheckout, lookupBarcode, ringUp, uploadImage } from '@/lib/api'
import { save } from '@/lib/storage'
import type { DisplayCurrency } from '@/lib/money'
import { type Mode, usePrefs } from '@/lib/prefs'
import { colors } from '@/lib/theme'
import { useStall } from '@/lib/stall'
import { useTerminal } from '@/lib/terminal'
import { useWallet } from '@/lib/wallet'
import { Txt } from '@/ui/primitives'

/**
 * Development only: `kova://dev?name=Maya&cur=EUR&fund=1&mode=pay&to=/send` sets up a wallet
 * and jumps to a screen; `pay=<charge>` or `send=<address>&amount=<base units>` runs the real
 * payment code, so every screen can be reached on a simulator without tapping. `pair=<code>`
 * pairs this phone as a terminal, `unpair=1` forgets it, `rename=<address>:<name>` names a contact,
 * `stall=<name>&tagline=<line>` opens a stall from this wallet the way Profile does, `seed=1` fills
 * that stall with a small menu (and a barcoded drink for the till), `till=keypad|items|scan` picks
 * the till's mode, and `sell=<item name>*<qty>;<item name>*<qty>` rings a sale up at the till and shows the customer display.
 * Release builds redirect home.
 */
/** A small Lagos kitchen menu for trying the stall screens. */
const SEED = [
  { name: 'Jollof rice and chicken', price: '6.50', description: 'Smoky party jollof with a grilled drumstick' },
  { name: 'Suya, beef', price: '4.00', description: 'Spiced skewers with onions and yaji' },
  { name: 'Moi moi', price: '2.50', description: 'Steamed bean pudding with egg' },
  { name: 'Puff-puff, six', price: '2.00', description: null },
  { name: 'Zobo, 50cl', price: '1.50', description: 'Hibiscus, ginger and pineapple, cold' },
]

export default function Dev() {
  const params = useLocalSearchParams<{ name?: string; cur?: string; fund?: string; mode?: string; to?: string; reset?: string; pay?: string; send?: string; amount?: string; pair?: string; unpair?: string; rename?: string; stall?: string; tagline?: string; seed?: string; till?: string; sell?: string }>()
  const wallet = useWallet()
  const prefs = usePrefs()
  const terminal = useTerminal()
  const stall = useStall()
  const [step, setStep] = useState('starting')

  useEffect(() => {
    if (!__DEV__ || wallet.status === 'loading' || !prefs.ready || !terminal.ready || !stall.ready) return
    void (async () => {
      if (params.reset) await wallet.signOut()
      if (params.mode) prefs.setMode(params.mode as Mode)
      if (params.name && wallet.status === 'none') {
        setStep('creating wallet')
        await wallet.create(params.name, (params.cur as DisplayCurrency) || 'USD')
      }
      if (params.fund) {
        setStep('funding')
        await wallet.addMoney().catch(() => {})
      }
      if (params.unpair) await terminal.unpair()
      if (params.pair) {
        setStep('pairing')
        await terminal.pair(params.pair, 'Front counter')
      }
      if (params.stall) {
        setStep('opening a stall')
        const profile = wallet.profile
        if (profile) await stall.open({ name: params.stall, tagline: params.tagline, phone: `${profile.name.split(' ')[0]}’s phone`, settleTo: profile.address }, setStep)
      }
      if (params.seed) {
        setStep('filling the stall')
        const detail = await stall.refresh()
        for (const item of SEED) await createItem({ ...item, stall_ids: detail ? [detail.id] : [] })
        const coke = await lookupBarcode('5449000000996', 'owner').catch(() => null)
        const photo = coke?.suggestion?.image_url ? await uploadImage(coke.suggestion.image_url).catch(() => null) : null
        await createItem({ name: 'Coca-Cola 33cl', price: '1.20', barcode: '5449000000996', image_id: photo?.id ?? null })
        await stall.refresh()
      }
      if (params.till) await save('kova.till.mode', params.till)
      if (params.sell) {
        setStep('ringing up')
        const catalog = await getCatalog()
        const lines = params.sell.split(';').flatMap((part) => {
          const [name, qty] = part.split('*')
          const item = catalog.find((i) => i.name === name)
          return item ? [{ id: item.id, quantity: Number(qty ?? 1) }] : []
        })
        const sale = await ringUp(lines)
        const usd = sale.payment_intent.amount
        console.log(`[dev] till sale ${sale.payment_intent.id} for $${usd}`)
        return router.replace({ pathname: '/terminal/[id]', params: { id: sale.payment_intent.id, price: `$${usd}`, usd } })
      }
      if (params.rename) {
        const [address, ...name] = params.rename.split(':')
        await wallet.renameContact(address as `0x${string}`, name.join(':'))
      }
      if (params.pay) {
        setStep('paying')
        const entry = await wallet.payCheckout(await getCheckout(params.pay))
        return router.replace({ pathname: '/receipt/[id]', params: { id: entry.id } })
      }
      if (params.send && params.amount) {
        setStep('sending')
        const entry = await wallet.send({ address: params.send as `0x${string}`, name: 'Tunde' }, BigInt(params.amount))
        return router.replace({ pathname: '/receipt/[id]', params: { id: entry.id } })
      }
      router.replace((params.to as never) || '/')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.status, prefs.ready, terminal.ready, stall.ready])

  if (!__DEV__) return <Redirect href="/" />
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
      <Txt>{step}</Txt>
    </View>
  )
}
