import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Image, View } from 'react-native'
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
 * (`fake=1` makes it from a random key, without the passkey sheet)
 * and jumps to a screen; `pay=<charge>` or `send=<address>&amount=<base units>&payee=<name>` runs the real
 * payment code, so every screen can be reached on a simulator without tapping. `pair=<code>`
 * pairs this phone as a terminal, `unpair=1` forgets it, `rename=<address>:<name>` names a contact,
 * `stall=<name>&tagline=<line>` opens a stall from this wallet the way Profile does, `seed=1` fills
 * that stall with a small menu (and a barcoded drink for the till), `seed=bakery` with a bakery's, `till=keypad|items|scan` picks
 * the till's mode, and `sell=<item name>*<qty>;<item name>*<qty>` rings a sale up at the till and shows the customer display.
 * Release builds redirect home.
 */
/** A small Lagos kitchen menu for trying the stall screens. */
const SEED = [
  {
    name: 'Jollof rice and chicken',
    price: '6.50',
    description: 'Smoky party jollof with a grilled drumstick',
  },
  { name: 'Suya, beef', price: '4.00', description: 'Spiced skewers with onions and yaji' },
  { name: 'Moi moi', price: '2.50', description: 'Steamed bean pudding with egg' },
  { name: 'Puff-puff, six', price: '2.00', description: null },
  { name: 'Zobo, 50cl', price: '1.50', description: 'Hibiscus, ginger and pineapple, cold' },
]

/** `seed=bakery`: a small bakery menu, for films and screens that shouldn't point at one country. */
const BAKERY = [
  { name: 'Sourdough loaf', price: '6.50', description: 'Slow-proved, with a crackly crust', category: 'Breads', stock: 8, photo: require('../../assets/demo/bakery-loaf.png') },
  { name: 'Baguette', price: '3.00', description: 'Baked three times a day', category: 'Breads', stock: 14, photo: require('../../assets/demo/bakery-baguette.png') },
  { name: 'Croissant', price: '3.25', description: 'All butter, baked this morning', category: 'Pastries', stock: 12, photo: require('../../assets/demo/bakery-croissant.png') },
  { name: 'Cinnamon bun', price: '3.75', description: 'Cardamom sugar on top', category: 'Pastries', stock: 3, photo: require('../../assets/demo/bakery-bun.png') },
  { name: 'Chocolate cookie', price: '2.50', description: 'Sea salt and dark chocolate', category: 'Pastries', stock: 0, photo: require('../../assets/demo/bakery-cookie.png') },
  { name: 'Carrot cake', price: '5.00', description: 'Cream cheese frosting', category: 'Cakes', stock: 6, photo: require('../../assets/demo/bakery-cake.png') },
  { name: 'Flat white', price: '4.50', description: 'Double shot, whole milk', category: 'Coffee', stock: null, photo: require('../../assets/demo/bakery-flatwhite.png') },
  { name: 'Iced latte', price: '4.75', description: 'Over ice, oat milk on request', category: 'Coffee', stock: null, photo: require('../../assets/demo/bakery-latte.png') },
]

/** A weaver's shop, for the film: each item with its photo, uploaded like any owner's. */
const WEAVES = [
  { name: 'Mountain blanket', price: '48.00', description: 'Handwoven wool, three weeks on the loom', photo: require('../../assets/demo/blanket.png') },
  { name: 'Wool scarf', price: '22.00', description: 'Soft, warm, striped in saffron', photo: require('../../assets/demo/scarf.png') },
  { name: 'Table runner', price: '16.00', description: 'Diamond weave, finished by hand', photo: require('../../assets/demo/runner.png') },
  { name: 'Woven pouch', price: '9.00', description: 'For coins, keys, small treasures', photo: require('../../assets/demo/pouch.png') },
]

export default function Dev() {
  const params = useLocalSearchParams<{
    name?: string
    cur?: string
    fake?: string
    fund?: string
    mode?: string
    to?: string
    then?: string
    reset?: string
    pay?: string
    send?: string
    amount?: string
    pair?: string
    unpair?: string
    rename?: string
    stall?: string
    tagline?: string
    seed?: string
    till?: string
    sell?: string
    payee?: string
  }>()
  const wallet = useWallet()
  const prefs = usePrefs()
  const terminal = useTerminal()
  const stall = useStall()
  const [step, showStep] = useState('starting')
  const setStep = (next: string) => {
    console.log(`[dev] ${next}`)
    showStep(next)
  }
  // The effect runs again whenever the wallet changes: reset and create each happen once, and
  // the steps after them run once, in the run that has the new wallet.
  const progress = useRef({ reset: false, created: false, finished: false })

  useEffect(() => {
    if (
      !__DEV__ ||
      wallet.status === 'loading' ||
      !prefs.ready ||
      !terminal.ready ||
      !stall.ready ||
      progress.current.finished
    )
      return
    void (async () => {
      try {
        if (params.reset && !progress.current.reset) {
          progress.current.reset = true
          if (wallet.status !== 'none') {
            setStep('signing out')
            await wallet.signOut()
            return
          }
        }
        if (params.mode) prefs.setMode(params.mode as Mode)
        if (params.name && wallet.status === 'none') {
          if (progress.current.created) return
          progress.current.created = true
          setStep('creating wallet')
          // fake=1: no passkey sheet, for a simulator nobody is tapping.
          if (params.fake && wallet.createForDev)
            await wallet.createForDev(params.name, (params.cur as DisplayCurrency) || 'USD')
          else await wallet.create(params.name, (params.cur as DisplayCurrency) || 'USD')
          return
        }
        progress.current.finished = true
        console.log(`[dev] wallet ${wallet.profile?.address ?? 'none'}`)
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
          if (profile)
            await stall.open(
              {
                name: params.stall,
                tagline: params.tagline,
                phone: `${profile.name.split(' ')[0]}’s phone`,
                settleTo: profile.address,
              },
              setStep,
            )
        }
        if (params.seed) {
          setStep('filling the stall')
          const detail = await stall.refresh()
          if (params.seed === 'weaves' || params.seed === 'bakery')
            for (const { photo, ...item } of params.seed === 'weaves' ? WEAVES : BAKERY) {
              const image = await uploadImage(Image.resolveAssetSource(photo).uri, 'image/png').catch(() => null)
              await createItem({ ...item, image_id: image?.id ?? null, stall_ids: detail ? [detail.id] : [] })
            }
          else
            for (const item of SEED)
              await createItem({ ...item, stall_ids: detail ? [detail.id] : [] })
          if (params.seed !== 'bakery' && params.seed !== 'weaves') {
            const coke = await lookupBarcode('5449000000996', 'owner').catch(() => null)
            const photo = coke?.suggestion?.image_url
              ? await uploadImage(coke.suggestion.image_url).catch(() => null)
              : null
            await createItem({
              name: 'Coca-Cola 33cl',
              price: '1.20',
              barcode: '5449000000996',
              image_id: photo?.id ?? null,
            })
          }
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
          return router.replace({
            pathname: '/terminal/[id]',
            params: { id: sale.payment_intent.id, price: `$${usd}`, usd },
          })
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
          const entry = await wallet.send(
            { address: params.send as `0x${string}`, name: params.payee || 'Tunde' },
            BigInt(params.amount),
          )
          return router.replace({ pathname: '/receipt/[id]', params: { id: entry.id } })
        }
        router.replace((params.to as never) || '/')
        // A screen to open over that one, e.g. `then=/send` for the send sheet over Home.
        if (params.then) setTimeout(() => router.push(params.then as never), 600)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[dev] failed: ${message}`)
        showStep(`failed: ${message}`)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.status, prefs.ready, terminal.ready, stall.ready])

  if (!__DEV__) return <Redirect href="/" />
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.paper,
      }}
    >
      <Txt>{step}</Txt>
    </View>
  )
}
