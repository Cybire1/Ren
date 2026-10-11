import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { Linking, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { posterLinkFor, stallLinkFor } from '@/lib/api'
import { useStall } from '@/lib/stall'
import { colors } from '@/lib/theme'
import { Kovi } from '@/ui/art'
import { Awning } from '@/ui/Awning'
import { Icon, type IconName } from '@/ui/Icon'
import { Header, Screen, Txt } from '@/ui/primitives'

const coin = require('../../../assets/art/coin-usd.png')

/**
 * The stall's code, big enough to scan across a counter, with the other ways to spread it:
 * the link, WhatsApp, and a poster to print for the table.
 */
export default function ShareStall() {
  const { width } = useWindowDimensions()
  const { stall } = useStall()
  const [copied, setCopied] = useState(false)

  if (!stall)
    return (
      <Screen bg={colors.paper}>
        <Header backIcon="close" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Kovi pose="oops" size={120} />
        </View>
      </Screen>
    )

  const link = stallLinkFor(stall.slug)
  const message = `Order from ${stall.name} and pay in dollars with Ren: ${link}`
  const card = Math.min(width - 48, 340)
  const qr = card - 84

  return (
    <Screen bg={colors.paper} edges={['bottom']}>
      <View style={{ paddingTop: 8 }}>
        <Header title="Share your stall" backIcon="close" />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.card, { width: card }]}>
          <Awning width={card} height={54} stripe={card / 11} tone={stall.open ? 'coral' : 'teal'} />
          <View style={styles.cardBody}>
            <Txt weight="bold" size={24} style={{ textAlign: 'center', letterSpacing: -0.6 }} numberOfLines={2}>
              {stall.name}
            </Txt>
            <Txt size={14} color={colors.muted} style={{ textAlign: 'center', marginTop: 2 }}>
              Scan to order. Pay in dollars.
            </Txt>
            <View style={styles.qr}>
              <QRCode value={link} size={qr} color={colors.ink} backgroundColor={colors.white} ecl="H" logo={coin} logoSize={qr * 0.2} logoBackgroundColor={colors.white} logoMargin={4} logoBorderRadius={qr} />
            </View>
            {stall.open ? null : (
              <Txt weight="semi" size={13} color={colors.coralDeep} style={{ textAlign: 'center', marginTop: 10 }}>
                Your stall is closed. Open it so people can order.
              </Txt>
            )}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy the link"
          onPress={async () => {
            await Clipboard.setStringAsync(link)
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          style={styles.link}
        >
          <Icon name={copied ? 'check' : 'copy'} size={16} />
          <Txt weight="semi" size={14} numberOfLines={1} style={{ flexShrink: 1 }}>
            {copied ? 'Link copied' : link.replace(/^https?:\/\//, '')}
          </Txt>
        </Pressable>

        <View style={styles.actions}>
          <Action
            icon="whatsapp"
            label="Send on WhatsApp"
            tone={colors.coral}
            // wa.me opens the WhatsApp app when it's installed, and WhatsApp's site when it isn't.
            onPress={() => void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`)}
          />
          <Action icon="share" label="Share another way" tone={colors.surface} onPress={() => void Share.share({ message })} />
          <Action icon="print" label="Print a table poster" tone={colors.tealSoft} onPress={() => void WebBrowser.openBrowserAsync(posterLinkFor(stall.slug))} />
        </View>
      </ScrollView>
    </Screen>
  )
}

function Action({ icon, label, tone, onPress }: { icon: IconName; label: string; tone: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      style={({ pressed }) => [styles.action, { backgroundColor: tone }, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      <Icon name={icon} size={20} />
      <Txt weight="semi" size={16} style={{ flex: 1 }}>
        {label}
      </Txt>
      <Icon name="arrow" size={20} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8 },
  card: { borderRadius: 30, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, overflow: 'hidden' },
  cardBody: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 22, alignItems: 'center' },
  qr: { marginTop: 16, padding: 12, borderRadius: 22, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.ink },
  link: {
    marginTop: 14,
    maxWidth: '100%',
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 18 },
  action: {
    height: 58,
    paddingHorizontal: 18,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
})
