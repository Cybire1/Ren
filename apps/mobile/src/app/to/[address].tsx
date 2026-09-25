import { Redirect, useLocalSearchParams } from 'expo-router'
import { parseScanned } from '@/lib/links'

/**
 * A request link opened on the phone (https://mykova.app/to/…): the web page and this screen are
 * the same link, so iOS opens it here when Kova is installed. It goes straight to sending.
 */
export default function PayPerson() {
  const params = useLocalSearchParams<{
    address: string
    name?: string
    cur?: string
    amount?: string
    note?: string
  }>()
  const query = new URLSearchParams()
  for (const key of ['name', 'cur', 'amount', 'note'] as const) {
    const value = params[key]
    if (typeof value === 'string' && value) query.set(key, value)
  }
  const person = parseScanned(`kova://to/${params.address}${query.size ? `?${query}` : ''}`)
  if (person?.kind !== 'person') return <Redirect href="/" />
  return (
    <Redirect
      href={{
        pathname: '/send/[to]',
        params: {
          to: person.address,
          ...(person.name ? { name: person.name } : {}),
          ...(person.currency ? { cur: person.currency } : {}),
          ...(person.amount ? { amount: person.amount } : {}),
          ...(person.note ? { note: person.note } : {}),
        },
      }}
    />
  )
}
