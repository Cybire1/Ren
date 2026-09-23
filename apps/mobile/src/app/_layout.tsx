import 'react-native-get-random-values'
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  useFonts as useMono,
} from '@expo-google-fonts/ibm-plex-mono'
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  useFonts as useSans,
} from '@expo-google-fonts/ibm-plex-sans'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { colors } from '@/lib/theme'

void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [sansLoaded] = useSans({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
  })
  const [monoLoaded] = useMono({ IBMPlexMono_400Regular, IBMPlexMono_500Medium })
  const ready = sansLoaded && monoLoaded

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}
      />
    </SafeAreaProvider>
  )
}
