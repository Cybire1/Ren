import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getSummary, listCharges, type PaymentIntent, type Summary } from '@/lib/api'
import { formatLocal } from '@/lib/money'
import { useShop } from '@/lib/shop'
import { colors } from '@/lib/theme'
import { Avatar, Kovi, ShopBadge } from '@/ui/art'
import { Icon } from '@/ui/Icon'
import { Txt } from '@/ui/primitives'
import { shopDockClearance } from '@/ui/ShopDock'

const labels: Record<PaymentIntent['status'], { text: string; color: string }> = {
  paid: { text: 'Paid', color: colors.positive },
  requires_payment: { text: 'Waiting', color: '#8A6A1F' },
  processing: { text: 'Confirming', color: '#8A6A1F' },
  held: { text: 'Held', color: colors.danger },
  failed: { text: 'Failed', color: colors.danger },
  canceled: { text: 'Canceled', color: colors.muted },
  expired: { text: 'Expired', color: colors.muted },
}

/** Where a sale came from, the way the counter talks about it. */
function source(c: PaymentIntent) {
  if (c.order?.stall) return c.order.customer_name ? `${c.order.stall.name}, for ${c.order.customer_name}` : c.order.stall.name
  if (c.order) return c.terminal ? `Till, ${c.terminal.name}` : 'Till'
  return c.terminal?.name ?? 'Online'
}

/** The day at a glance: what came in, how many sales, and each one as it settled. */
export default function Today() {
  const shop = useShop()
  const insets = useSafeAreaInsets()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [charges, setCharges] = useState<PaymentIntent[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([getSummary(), listCharges(60)]).catch(() => [null, []] as const)
    if (s) setSummary(s)
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    setCharges(c.filter((x) => new Date(x.created_at) >= midnight))
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const total = summary?.today?.total ?? '0.00'
  const paid = charges.filter((c) => c.status === 'paid')

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.paper }}
      data={charges}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: shopDockClearance + insets.bottom }}
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
        <>
          <Txt weight="bold" size={32} style={{ letterSpacing: -1 }}>
            Today
          </Txt>
          <View style={styles.hero}>
            <Txt size={15}>Taken today</Txt>
            <Txt weight="bold" size={52} style={{ letterSpacing: -2 }} numberOfLines={1} adjustsFontSizeToFit>
              ${Number(total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Txt>
            <Txt size={15} color={colors.onTint}>
              {shop.currency !== 'USD' ? `About ${formatLocal(Number(total), shop.currency)}. ` : ''}
              {summary?.today?.count ?? paid.length} {(summary?.today?.count ?? paid.length) === 1 ? 'sale' : 'sales'}, $0.00 in card fees
            </Txt>
            <View style={styles.kovi} pointerEvents="none">
              <Kovi pose="cheer" size={96} />
            </View>
          </View>
        </>
      }
      renderItem={({ item }) => {
        // A charge nobody paid stays open until the API's expiry sweep runs; show it as expired.
        const lapsed = item.status === 'requires_payment' && item.expires_at && new Date(item.expires_at) < new Date()
        const label = labels[lapsed ? 'expired' : item.status]
        const price = item.metadata?.price && item.metadata.price_currency ? `${item.metadata.price} ${item.metadata.price_currency}` : null
        const buyer = item.order?.customer_name
        return (
          <View style={styles.row}>
            {buyer ? <Avatar name={buyer} size={40} /> : item.order ? <View style={styles.tillIcon}><Icon name="barcode" size={18} /></View> : <ShopBadge size={40} />}
            <View style={{ flex: 1 }}>
              <Txt weight="semi" size={16} numberOfLines={1}>
                {item.reference ?? (price ? `Sale, ${price}` : 'Sale')}
              </Txt>
              <Txt size={13} color={colors.muted} numberOfLines={1}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {source(item)}, {label.text}
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
  )
}

const styles = StyleSheet.create({
  hero: {
    marginTop: 14,
    marginBottom: 12,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tealSoft,
    padding: 20,
    paddingRight: 100,
    overflow: 'hidden',
  },
  kovi: { position: 'absolute', right: 6, bottom: -10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  tillIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tealSoft, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
})
