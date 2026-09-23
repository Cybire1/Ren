import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { getSummary, listCharges, type PaymentIntent, type Summary } from '@/lib/api'
import { useShop } from '@/lib/shop'
import { colors } from '@/lib/theme'
import { Kovi, ShopBadge } from '@/ui/art'
import { Header, Screen, Txt } from '@/ui/primitives'

const labels: Record<PaymentIntent['status'], { text: string; color: string }> = {
  paid: { text: 'Paid', color: colors.positive },
  requires_payment: { text: 'Waiting', color: '#8A6A1F' },
  processing: { text: 'Confirming', color: '#8A6A1F' },
  held: { text: 'Held', color: colors.danger },
  failed: { text: 'Failed', color: colors.danger },
  canceled: { text: 'Canceled', color: colors.muted },
  expired: { text: 'Expired', color: colors.muted },
}

/** The day at a glance: what came in, how many sales, and each charge as it settled. */
export default function Today() {
  const shop = useShop()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [charges, setCharges] = useState<PaymentIntent[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([getSummary(), listCharges(50)]).catch(() => [null, []] as const)
    if (s) setSummary(s)
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    setCharges(c.filter((x) => new Date(x.created_at) >= midnight))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const paid = charges.filter((c) => c.status === 'paid')

  return (
    <Screen bg={colors.paper}>
      <Header title="Today" subtitle={shop.name} backIcon="close" />
      <FlatList
        data={charges}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true)
              await load()
              setRefreshing(false)
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.hero}>
            <Txt size={15}>Taken today</Txt>
            <Txt weight="bold" size={52} style={{ letterSpacing: -2 }}>
              ${summary?.today?.total ?? '0.00'}
            </Txt>
            <Txt size={15} color={colors.onTint}>
              {summary?.today?.count ?? paid.length} sales, $0.00 in card fees
            </Txt>
            <View style={styles.kovi}>
              <Kovi pose="cheer" size={96} />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          // A charge nobody paid stays open until the API's expiry sweep runs; show it as expired.
          const lapsed = item.status === 'requires_payment' && item.expires_at && new Date(item.expires_at) < new Date()
          const label = labels[lapsed ? 'expired' : item.status]
          const price = item.metadata?.price && item.metadata.price_currency ? `${item.metadata.price} ${item.metadata.price_currency}` : null
          return (
            <View style={styles.row}>
              <ShopBadge size={40} fill={item.status === 'paid' ? colors.tealLight : colors.sunken} />
              <View style={{ flex: 1 }}>
                <Txt weight="semi" size={16}>
                  {item.reference ?? (price ? `Sale, ${price}` : 'Sale')}
                </Txt>
                <Txt size={13} color={colors.muted}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {label.text}
                </Txt>
              </View>
              <Txt weight="semi" size={16} color={label.color}>
                ${item.amount}
              </Txt>
            </View>
          )
        }}
        ListEmptyComponent={
          <Txt size={15} color={colors.muted} style={{ marginTop: 20 }}>
            No sales yet today.
          </Txt>
        }
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: {
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tealSoft,
    padding: 20,
    overflow: 'hidden',
  },
  kovi: { position: 'absolute', right: 6, bottom: -10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
})
