import { Redirect, Tabs } from 'expo-router'
import { useTerminal } from '@/lib/terminal'
import { ShopDock } from '@/ui/ShopDock'

export const unstable_settings = { initialRouteName: 'index' }

/** The shop side of the app: Charge in the middle, orders and the stall on the left, the day and the shop on the right. */
export default function ShopTabs() {
  const terminal = useTerminal()
  // An unpaired phone has nothing to charge with: send it to pairing.
  if (terminal.ready && !terminal.canCharge) return <Redirect href="/terminal/setup" />
  return (
    <Tabs tabBar={(props) => <ShopDock {...props} />} screenOptions={{ headerShown: false, animation: 'shift' }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="stall" />
      <Tabs.Screen name="today" />
      <Tabs.Screen name="shop" />
    </Tabs>
  )
}
