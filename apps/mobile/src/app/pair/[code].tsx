import { Redirect, useLocalSearchParams } from 'expo-router'

/** kova://pair/<code>, from the dashboard's pairing QR: opens terminal pairing with the code filled in. */
export default function PairLink() {
  const { code } = useLocalSearchParams<{ code: string }>()
  return <Redirect href={{ pathname: '/terminal/setup', params: { code } }} />
}
