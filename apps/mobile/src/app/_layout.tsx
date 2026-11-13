import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope'
import { router, Stack, useRootNavigationState } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useEffect } from 'react'
import { LogBox, Platform, Settings } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { PrefsProvider, usePrefs } from '@/lib/prefs'
import { useLiveRates } from '@/lib/rates'
import { StallProvider } from '@/lib/stall'
import { TerminalProvider } from '@/lib/terminal'
import { colors, palette } from '@/lib/theme'
import { TravelProvider } from '@/lib/travel'
import { useWallet, WalletProvider } from '@/lib/wallet'
import { OrderWatcher } from '@/lib/watch'

void SplashScreen.preventAutoHideAsync()

// React Native's own Animated warns when a value updates with no listener left (a screen that
// closed mid-animation). It's harmless, and in development its toast covers the dock.
LogBox.ignoreLogs(['Sending `onAnimatedValueUpdate` with no listeners registered'])

/**
 * Development only: `xcrun simctl launch <device> xyz.kova.pay.monad -KovaDevLink "name=Maya&fake=1&to=/"`
 * runs that dev link (app/dev.tsx) on launch. A kova:// link opened from outside asks "Open in
 * Kova?", which a simulator nobody is tapping can't answer; launch arguments ask nothing. Replacing
 * the root route remounts this layout, so "already ran" lives outside it.
 */
let devLaunched = false
function DevLaunch() {
  const navigation = useRootNavigationState()
  useEffect(() => {
    if (!__DEV__ || Platform.OS !== 'ios' || devLaunched || !navigation?.key) return
    devLaunched = true
    const link = Settings.get('KovaDevLink')
    if (typeof link === 'string' && link) router.replace(`/dev?${link}` as never)
  }, [navigation?.key])
  return null
}

/** The window's own ground, which shows behind sheets as they open: black, like every screen. */
function Ground() {
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(palette.dark.paper)
  }, [])
  return null
}

/** When money arrives while the app is open, celebrate it. Terminal mode has its own screens. */
function ArrivalWatcher() {
  const { arrival, clearArrival } = useWallet()
  const { mode } = usePrefs()
  useEffect(() => {
    if (!arrival || mode !== 'pay') return
    router.push({
      pathname: '/received',
      params: {
        amount: arrival.amount.toString(),
        name: arrival.name,
        hash: arrival.hash,
        ...(arrival.note ? { note: arrival.note } : {}),
      },
    })
    clearArrival()
  }, [arrival, clearArrival, mode])
  return null
}

/** Send is one sheet over Home, sized to each step, so the balance stays in view behind it. */
const sendSheet = {
  presentation: 'formSheet',
  sheetAllowedDetents: 'fitToContents',
  sheetGrabberVisible: true,
  sheetCornerRadius: 34,
  contentStyle: { backgroundColor: colors.paper },
} as const

export default function RootLayout() {
  const [loaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  })
  // Local prices on the first screen should already use today's rates.
  const ratesReady = useLiveRates()

  useEffect(() => {
    if (loaded && ratesReady) void SplashScreen.hideAsync()
  }, [loaded, ratesReady])

  if (!loaded || !ratesReady) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PrefsProvider>
          <TerminalProvider>
            <WalletProvider>
              <StallProvider>
                <TravelProvider>
                  <StatusBar style="light" />
                  <Ground />
                  <ArrivalWatcher />
                  <OrderWatcher />
                  <DevLaunch />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: colors.paper },
                    }}
                  >
                    <Stack.Screen name="index" options={{ animation: 'none' }} />
                    <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
                    <Stack.Screen
                      name="scan"
                      options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
                    />
                    <Stack.Screen
                      name="received"
                      options={{ presentation: 'fullScreenModal', animation: 'fade' }}
                    />
                    <Stack.Screen
                      name="ready/[id]"
                      options={{ presentation: 'fullScreenModal', animation: 'fade' }}
                    />
                    <Stack.Screen name="terminal" options={{ animation: 'fade' }} />
                    <Stack.Screen
                      name="open-stall"
                      options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
                    />
                    <Stack.Screen
                      name="card/link"
                      options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
                    />
                    <Stack.Screen
                      name="card/pin"
                      options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
                    />
                    <Stack.Screen
                      name="cash-out"
                      options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
                    />
                    <Stack.Screen
                      name="keys/agent"
                      options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
                    />
                    <Stack.Screen
                      name="keys/card"
                      options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
                    />
                    <Stack.Screen
                      name="keys/allowance"
                      options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
                    />
                    <Stack.Screen name="s/[slug]" options={{ animation: 'slide_from_bottom' }} />
                    <Stack.Screen name="travel" options={{ animation: 'slide_from_bottom' }} />
                    <Stack.Screen name="send/index" options={sendSheet} />
                    <Stack.Screen name="send/[to]" options={sendSheet} />
                    <Stack.Screen name="dollar-card/top-up" options={sendSheet} />
                    <Stack.Screen name="dollar-card/withdraw" options={sendSheet} />
                  </Stack>
                </TravelProvider>
              </StallProvider>
            </WalletProvider>
          </TerminalProvider>
        </PrefsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
