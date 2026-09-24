import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope'
import { router, Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { PrefsProvider, usePrefs } from '@/lib/prefs'
import { StallProvider } from '@/lib/stall'
import { TerminalProvider } from '@/lib/terminal'
import { colors } from '@/lib/theme'
import { useWallet, WalletProvider } from '@/lib/wallet'

void SplashScreen.preventAutoHideAsync()

/** When money arrives while the app is open, celebrate it. Terminal mode has its own screens. */
function ArrivalWatcher() {
  const { arrival, clearArrival } = useWallet()
  const { mode } = usePrefs()
  useEffect(() => {
    if (!arrival || mode !== 'pay') return
    router.push({
      pathname: '/received',
      params: { amount: arrival.amount.toString(), name: arrival.name, hash: arrival.hash },
    })
    clearArrival()
  }, [arrival, clearArrival, mode])
  return null
}

export default function RootLayout() {
  const [loaded] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold })

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync()
  }, [loaded])

  if (!loaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PrefsProvider>
          <TerminalProvider>
            <WalletProvider>
              <StallProvider>
                <StatusBar style="dark" />
                <ArrivalWatcher />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
                  <Stack.Screen name="index" options={{ animation: 'none' }} />
                  <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
                  <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="received" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
                  <Stack.Screen name="terminal" options={{ animation: 'fade' }} />
                  <Stack.Screen name="open-stall" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="s/[slug]" options={{ animation: 'slide_from_bottom' }} />
                </Stack>
              </StallProvider>
            </WalletProvider>
          </TerminalProvider>
        </PrefsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
