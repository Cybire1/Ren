import { router } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { hasMerchantKey } from '@/lib/api'
import { usePrefs } from '@/lib/prefs'
import { colors } from '@/lib/theme'
import { Kovi, ShopBadge } from '@/ui/art'
import { Bob } from '@/ui/motion'
import { Header, PillButton, Rise, Screen, Txt } from '@/ui/primitives'
import { useShop } from '@/lib/shop'

/** Turns this phone into the shop's terminal. It can switch back to a wallet any time. */
export default function TerminalSetup() {
  const { setMode } = usePrefs()
  const shop = useShop()

  return (
    <Screen bg={colors.coral}>
      <Header />
      <View style={styles.art}>
        <Bob>
          <ShopBadge size={150} fill={colors.white} />
        </Bob>
        <View style={styles.kovi}>
          <Kovi pose="wave" size={110} />
        </View>
      </View>
      <Rise style={{ paddingHorizontal: 28 }}>
        <Txt weight="semi" size={36} style={{ letterSpacing: -1, lineHeight: 40 }}>
          {hasMerchantKey ? `Take payments for ${shop.name}` : 'Take payments at your counter'}
        </Txt>
        <Txt size={17} color={colors.onTint} style={{ marginTop: 10, lineHeight: 25 }}>
          {hasMerchantKey
            ? 'Type the price, turn the phone around, and the customer pays with Kova or any Tempo wallet. It settles in about a second, with no card fees.'
            : "This phone isn't paired with a shop yet. Sign in to the Kova dashboard and pair it, then come back here."}
        </Txt>
      </Rise>
      <View style={styles.footer}>
        <PillButton
          label={hasMerchantKey ? 'Use this phone as a terminal' : 'Back'}
          icon={hasMerchantKey ? 'terminal' : 'back'}
          onPress={() => {
            if (!hasMerchantKey) return router.back()
            setMode('terminal')
            router.replace('/terminal')
          }}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  art: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kovi: { position: 'absolute', right: 60, bottom: 40 },
  footer: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 20 },
})
