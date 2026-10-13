import { useLocalSearchParams } from 'expo-router'
import { SendSheet } from '@/ui/send/SendSheet'

/** Send, as a sheet over Home: who, how much, review, slide to send, sent. From Private, privately. */
export default function Send() {
  const { privately } = useLocalSearchParams<{ privately?: string }>()
  return <SendSheet privately={privately === '1'} />
}
