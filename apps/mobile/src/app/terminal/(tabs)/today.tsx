import { useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getSummary, listCharges, type PaymentIntent, type Summary } from '@/lib/api'
import { formatLocal } from '@/lib/money'
import { useShop } from '@/lib/shop'
import { colors } from '@/lib/theme'
import { Avatar, Reni, ReniPeek, peekEdge, ShopBadge } from '@/ui/art'
import { Icon } from '@/ui/Icon'
import { Landing } from '@/ui/motion'
import { Odometer } from '@/ui/Odometer'
import { Sticker, Txt } from '@/ui/primitives'
import { shopDockClearance } from '@/ui/ShopDock'
import { WalletBack } from '@/ui/WalletBack'

const labels: Record<PaymentIntent['status'], { text: string; color: string; fill: string }> = {
  paid: { text: 'Paid', color: colors.ink, fill: colors.tealSoft },
  requires_payment: { text: 'Waiting', color: colors.ink, fill: colors.yellow },
  processing: { text: 'Confirming', color: colors.ink, fill: colors.yellow },
  held: { text: 'Held', color: colors.white, fill: colors.danger },
  failed: { text: 'Failed', color: colors.white, fill: colors.danger },
  canceled: { text: 'Canceled', color: colors.ink, fill: colors.sunken },
  expired: { text: 'Expired', color: colors.ink, fill: colors.sunken },
}

/** How long a sale counts as just landed, so it prints onto the tape with a glow. */
const FRESH_MS = 120_000

/** Where a sale came from, the way the counter talks about it. */
function source(c: PaymentIntent) {
  if (c.order?.stall) return c.order.customer_name ? `${c.order.stall.name}, for ${c.order.customer_name}` : c.order.stall.name
  if (c.order) return c.terminal ? `Till, ${c.terminal.name}` : 'Till'
  return c.terminal?.name ?? 'Online'
}

const PEEK = 150

const money = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * The day at a glance: what came in, rolling into place like the till's counter; the day so far,
 * hour by hour; and every sale on a receipt tape, the newest printing on with a glow.
 */
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

  const paid = charges.filter((c) => c.status === 'paid')
  const total = Number(summary?.today?.total ?? paid.reduce((sum, c) => sum + Number(c.amount), 0))
  const count = summary?.today?.count ?? paid.length
  const [whole, cents] = money(total).slice(1).split('.')
  const freshId = paid[0] && Date.now() - new Date(paid[0].created_at).getTime() < FRESH_MS ? paid[0].id : null

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
          <View style={{ marginBottom: 10 }}>
            <WalletBack />
          </View>
          <Txt weight="heavy" size={32} style={{ letterSpacing: -1.1 }}>
            Today
          </Txt>
          <Txt weight="bold" size={14} color={colors.muted}>
            {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
          </Txt>

          <Sticker lift fill={colors.card} radius={26} style={{ marginTop: 16 }} innerStyle={styles.hero}>
            <View style={styles.reni} pointerEvents="none">
              <Reni pose="cheer" size={92} />
            </View>
            <Txt weight="heavy" size={15} color={colors.muted}>
              Taken today
            </Txt>
            <View style={styles.amount}>
              <Txt weight="heavy" size={26} style={{ marginTop: 12, marginRight: 3 }} importantForAccessibility="no" accessibilityElementsHidden>
                $
              </Txt>
              <Odometer value={whole} size={60} label={`Taken today, ${money(total)}`} />
              <Txt
                weight="heavy"
                size={26}
                color={colors.muted}
                style={{ marginTop: 12, marginLeft: 5 }}
                importantForAccessibility="no"
                accessibilityElementsHidden
              >
                .{cents}
              </Txt>
            </View>
            {shop.currency !== 'USD' ? (
              <Txt weight="semi" size={14} color={colors.onTint}>
                About {formatLocal(total, shop.currency)}
              </Txt>
            ) : null}
            <View style={styles.stats}>
              <Stat label="Sales" value={String(count)} />
              <Stat label="Average" value={count > 0 ? money(total / count) : '—'} />
              <Stat label="Card fees" value="$0.00" tone={colors.positive} />
            </View>
          </Sticker>

          <DaySoFar paid={paid} />

          <View style={styles.tapeHead}>
            <Txt weight="heavy" size={18} style={{ letterSpacing: -0.3 }}>
              On the tape
            </Txt>
            {charges.length ? (
              <Txt weight="bold" size={13} color={colors.muted}>
                {charges.length} {charges.length === 1 ? 'charge' : 'charges'}
              </Txt>
            ) : null}
          </View>
        </>
      }
      renderItem={({ item, index }) => {
        // A charge nobody paid stays open until the API's expiry sweep runs; show it as expired.
        const lapsed = item.status === 'requires_payment' && item.expires_at && new Date(item.expires_at) < new Date()
        const label = labels[lapsed ? 'expired' : item.status]
        const price = item.metadata?.price && item.metadata.price_currency ? `${item.metadata.price} ${item.metadata.price_currency}` : null
        const buyer = item.order?.customer_name
        const first = index === 0
        const last = index === charges.length - 1
        return (
          <View style={[styles.paper, first && styles.paperTop, last && styles.paperBottom]}>
            <Landing active={item.id === freshId} delay={600} rest={colors.card} style={[styles.row, !first && styles.perforated]}>
              {buyer ? (
                <Avatar name={buyer} size={40} />
              ) : item.order ? (
                <View style={styles.tillIcon}>
                  <Icon name="barcode" size={18} />
                </View>
              ) : (
                <ShopBadge size={40} />
              )}
              <View style={{ flex: 1 }}>
                <Txt weight="heavy" size={15} numberOfLines={1}>
                  {item.reference ?? (price ? `Sale, ${price}` : 'Sale')}
                </Txt>
                <Txt weight="semi" size={12} color={colors.muted} numberOfLines={1}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {source(item)}
                </Txt>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Txt
                  weight="heavy"
                  size={16}
                  color={label.text === 'Paid' ? colors.ink : colors.muted}
                  style={label.text === 'Expired' || label.text === 'Canceled' ? { textDecorationLine: 'line-through' } : undefined}
                >
                  ${item.amount}
                </Txt>
                <View style={[styles.status, { backgroundColor: label.fill }]}>
                  <Txt weight="heavy" size={11} color={label.color}>
                    {label.text}
                  </Txt>
                </View>
              </View>
            </Landing>
          </View>
        )
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <ReniPeek width={PEEK} />
          {/* Reni's hands rest on the card's top edge. */}
          <View style={[styles.emptyCard, { marginTop: -(PEEK / 2) * (1 - peekEdge) }]}>
            <Txt weight="heavy" size={17}>
              Your first sale prints here
            </Txt>
            <Txt size={14} color={colors.onTint} style={{ marginTop: 4, textAlign: 'center' }}>
              Tap Charge, type a price, and let your customer tap or scan.
            </Txt>
          </View>
        </View>
      }
    />
  )
}

function Stat({ label, value, tone = colors.ink }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Txt weight="heavy" size={11} color={colors.muted}>
        {label}
      </Txt>
      <Txt weight="heavy" size={18} color={tone} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {value}
      </Txt>
    </View>
  )
}

/**
 * The day so far, hour by hour, from opening (or the first sale, if earlier) to now: teal bars
 * for what came in, the busiest hour labelled, the current hour in coral.
 */
function DaySoFar({ paid }: { paid: PaymentIntent[] }) {
  const hours = useMemo(() => {
    const now = new Date().getHours()
    const byHour = new Map<number, number>()
    for (const c of paid) {
      const hour = new Date(c.created_at).getHours()
      byHour.set(hour, (byHour.get(hour) ?? 0) + Number(c.amount))
    }
    const first = Math.min(7, now, ...byHour.keys())
    return Array.from({ length: now - first + 1 }, (_, i) => {
      const hour = first + i
      return { hour, total: byHour.get(hour) ?? 0, now: hour === now }
    })
  }, [paid])
  if (!paid.length) return null
  const peak = hours.reduce((best, h) => (h.total > best.total ? h : best), hours[0])
  const label = (hour: number) => (hour === 0 ? '12am' : hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour - 12}pm`)
  return (
    <Sticker lift fill={colors.card} radius={26} style={{ marginTop: 16 }} innerStyle={styles.chart}>
      <Txt weight="heavy" size={17} style={{ letterSpacing: -0.3 }}>
        The day so far
      </Txt>
      <Txt weight="semi" size={13} color={colors.muted}>
        Busiest at {label(peak.hour)}, {money(peak.total)}
      </Txt>
      <View style={styles.bars} accessible accessibilityLabel={`The day so far. Busiest at ${label(peak.hour)}, ${money(peak.total)}`}>
        {hours.map((h) => (
          <View key={h.hour} style={styles.barSlot}>
            {h === peak && peak.total > 0 ? (
              <View style={styles.peak}>
                <Txt weight="heavy" size={10} color={colors.white} numberOfLines={1}>
                  {money(h.total)}
                </Txt>
              </View>
            ) : null}
            <View
              style={[
                styles.bar,
                {
                  height: h.total > 0 ? Math.max(8, Math.round((h.total / peak.total) * 92)) : 6,
                  backgroundColor: h.now ? colors.coral : h.total > 0 ? colors.teal : colors.sunken,
                  borderStyle: h.total > 0 ? 'solid' : 'dashed',
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.axis} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {hours.map((h, i) => (
          <View key={h.hour} style={styles.barSlot}>
            {h.now ? (
              <View style={styles.nowPill}>
                <Txt weight="heavy" size={10}>
                  Now
                </Txt>
              </View>
            ) : i % 3 === 0 ? (
              <Txt weight="bold" size={10} color={colors.muted} numberOfLines={1}>
                {label(h.hour)}
              </Txt>
            ) : null}
          </View>
        ))}
      </View>
    </Sticker>
  )
}

const styles = StyleSheet.create({
  hero: { padding: 18, paddingBottom: 16 },
  reni: { position: 'absolute', right: 4, top: 6 },
  amount: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.sunken,
    backgroundColor: colors.surface,
  },
  chart: { padding: 18, paddingBottom: 14 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 128, marginTop: 10, borderBottomWidth: 2, borderColor: colors.ink },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', maxWidth: 22, borderWidth: 2, borderBottomWidth: 0, borderColor: colors.ink, borderTopLeftRadius: 7, borderTopRightRadius: 7 },
  peak: {
    marginBottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.ink,
    minWidth: 44,
    alignItems: 'center',
  },
  axis: { flexDirection: 'row', gap: 4, marginTop: 6, height: 18 },
  nowPill: { paddingHorizontal: 5, borderRadius: 999, backgroundColor: colors.coral },
  tapeHead: { marginTop: 24, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  paper: { backgroundColor: colors.card, borderLeftWidth: 2, borderRightWidth: 2, borderColor: colors.ink, paddingHorizontal: 12 },
  paperTop: { borderTopWidth: 2, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 4 },
  paperBottom: { borderBottomWidth: 2, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 4, borderRadius: 12 },
  perforated: { borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.sunken, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  status: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999 },
  tillIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.tealSoft,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', marginTop: 6 },
  emptyCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    padding: 18,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.card,
  },
})
