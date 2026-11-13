import { StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { colors, palette } from '@/lib/theme'
import { CardBrand } from './CardBrand'
import { Icon } from './Icon'
import { Txt } from './primitives'

/**
 * The dollar card's own inks: Ren's raspberry body with light print, the same wherever the card is
 * drawn (home tile, the card screen, its details). Raw strings, since SVG strokes need them.
 */
export const cardInk = {
  body: palette.light.teal,
  mark: palette.light.tealDeep,
  print: palette.light.onTeal,
  printSoft: 'rgba(255,240,245,0.72)',
  stripe: palette.dark.paper,
} as const

/** The EMV chip: gold, with its contact pads. */
export function CardChip({ left, top, width }: { left: number; top: number; width: number }) {
  return (
    <Svg
      width={width}
      height={(width * 35) / 46}
      viewBox="0 0 46 35"
      style={{ position: 'absolute', left, top }}
    >
      <Defs>
        <LinearGradient id="chipGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F3DB9A" />
          <Stop offset="0.5" stopColor="#D9B866" />
          <Stop offset="1" stopColor="#C49A48" />
        </LinearGradient>
      </Defs>
      <Rect x={0.5} y={0.5} width={45} height={34} rx={6} fill="url(#chipGold)" stroke="#A8823A" />
      <Path
        d="M0.5 12h14M0.5 23h14M31.5 12h14M31.5 23h14M14.5 0.5v34M31.5 0.5v34M14.5 17.5h17"
        stroke="#A8823A"
        fill="none"
      />
    </Svg>
  )
}

/**
 * The dollar card, drawn: Ren's raspberry, the pay mark pressed into it, the chip, the last four
 * digits and the network. Frozen, it dims under a lock. `width` is the card's width; it keeps a
 * bank card's proportions (ISO ID-1).
 */
export function DollarCardFace({
  width,
  last4,
  brand,
  frozen,
}: {
  width: number
  /** Left out, the card shows no number (the intro, the home tile). */
  last4?: string
  brand?: string
  frozen?: boolean
}) {
  const s = width / 354
  const at = (n: number) => Math.round(n * s)
  const small = width < 120
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={
        last4
          ? `Dollar card ending ${last4}${frozen ? ', frozen' : ''}`
          : `Dollar card${frozen ? ', frozen' : ''}`
      }
      style={[styles.face, { width, height: at(223), borderRadius: at(13) }]}
    >
      <Svg width={width} height={at(223)} viewBox="0 0 354 223" style={StyleSheet.absoluteFill}>
        <Path d="M236 44v136" stroke={cardInk.mark} strokeWidth={20} strokeLinecap="round" />
        <Path
          d="M264 80a44 44 0 0 1 0 64M286 62a72 72 0 0 1 0 100M308 44a100 100 0 0 1 0 136"
          stroke={cardInk.mark}
          strokeWidth={15}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
      <CardChip left={at(30)} top={at(68)} width={at(46)} />
      {small ? null : (
        <>
          <Txt
            exact
            weight="bold"
            size={at(21)}
            color={cardInk.print}
            style={{ position: 'absolute', left: at(22), top: at(15), letterSpacing: -0.5 }}
          >
            ren
          </Txt>
          <Txt
            exact
            weight="bold"
            size={at(9)}
            color={cardInk.printSoft}
            style={{ position: 'absolute', right: at(22), top: at(24), letterSpacing: 1.6 }}
          >
            VIRTUAL
          </Txt>
          {last4 ? (
            <Txt
              exact
              weight="bold"
              size={at(20)}
              color={cardInk.print}
              style={{ position: 'absolute', left: at(22), bottom: at(18), letterSpacing: at(2.4) }}
            >
              •••• {last4}
            </Txt>
          ) : null}
          <View style={{ position: 'absolute', right: at(20), bottom: at(16) }}>
            <CardBrand brand={brand ?? 'mastercard'} width={at(48)} />
          </View>
        </>
      )}
      {frozen ? (
        <View style={styles.frost}>
          <View style={[styles.lock, { width: at(64), height: at(64), borderRadius: at(32) }]}>
            <Icon name="snow" size={at(30)} color={colors.white} />
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  face: {
    backgroundColor: cardInk.body,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  frost: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  lock: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
})
