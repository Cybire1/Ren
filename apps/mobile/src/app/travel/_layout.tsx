import { Stack } from 'expo-router'
import { colors } from '@/lib/theme'

export default function TravelLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="flights" />
      <Stack.Screen name="flight" />
      <Stack.Screen name="seats" options={{ presentation: 'modal' }} />
      <Stack.Screen name="stays" />
      <Stack.Screen name="stay" />
      <Stack.Screen name="book" />
      <Stack.Screen name="trip/[id]" options={{ gestureEnabled: true }} />
    </Stack>
  )
}
