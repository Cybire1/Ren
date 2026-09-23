import { Stack } from 'expo-router'
import { ShopProvider } from '@/lib/shop'
import { colors } from '@/lib/theme'

export default function TerminalLayout() {
  return (
    <ShopProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.tealSoft } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="[id]" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="today" options={{ presentation: 'modal' }} />
        <Stack.Screen name="setup" />
      </Stack>
    </ShopProvider>
  )
}
