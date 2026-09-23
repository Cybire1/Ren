import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { getCheckout } from '@/lib/api'
import type { DisplayCurrency } from '@/lib/money'
import { type Mode, usePrefs } from '@/lib/prefs'
import { colors } from '@/lib/theme'
import { useTerminal } from '@/lib/terminal'
import { useWallet } from '@/lib/wallet'
import { Txt } from '@/ui/primitives'

/**
 * Development only: `kova://dev?name=Maya&cur=EUR&fund=1&mode=pay&to=/send` sets up a wallet
 * and jumps to a screen; `pay=<charge>` or `send=<address>&amount=<base units>` runs the real
 * payment code, so every screen can be reached on a simulator without tapping. `pair=<code>`
 * pairs this phone as a terminal, `unpair=1` forgets it, `rename=<address>:<name>` names a contact.
 * Release builds redirect home.
 */
export default function Dev() {
  const params = useLocalSearchParams<{ name?: string; cur?: string; fund?: string; mode?: string; to?: string; reset?: string; pay?: string; send?: string; amount?: string; pair?: string; unpair?: string; rename?: string }>()
  const wallet = useWallet()
  const prefs = usePrefs()
  const terminal = useTerminal()
  const [step, setStep] = useState('starting')

  useEffect(() => {
    if (!__DEV__ || wallet.status === 'loading' || !prefs.ready || !terminal.ready) return
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
  }, [wallet.status, prefs.ready, terminal.ready])

  if (!__DEV__) return <Redirect href="/" />
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
      <Txt>{step}</Txt>
    </View>
  )
}
