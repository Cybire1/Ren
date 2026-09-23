/**
 * Kova's illustrations: the painted artwork in assets/art, placed and labelled by the app.
 *
 * Kovi, a coin with a face, carries the payment story: he rides the plane when money goes
 * abroad, catches coins when it arrives, cheers on the receipt when a shop is paid and naps
 * on a frozen card. Anything that changes per payment (amounts, names, card numbers) is set
 * on top in the app's own type, never baked into the images.
 */
import { Image } from 'expo-image'
import { View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { colors } from '@/lib/theme'
import { Kovi } from './kovi'
import { Wordmark } from './Logo'
import { Txt } from './primitives'

const art = {
  welcome: require('../../assets/art/scene-welcome.png'),
  send: require('../../assets/art/scene-send.png'),
  terminal: require('../../assets/art/scene-paid-terminal.png'),
  cardActive: require('../../assets/art/card-active.png'),
  cardFrozen: require('../../assets/art/card-frozen-body.png'),
  plane: require('../../assets/art/plane.png'),
  snowflakes: require('../../assets/art/snowflakes.png'),
  flakes: [
    require('../../assets/art/snowflake-1.png'),
    require('../../assets/art/snowflake-2.png'),
    require('../../assets/art/snowflake-3.png'),
    require('../../assets/art/snowflake-4.png'),
    require('../../assets/art/snowflake-5.png'),
  ],
  shop: require('../../assets/art/badge-shop.png'),
  add: require('../../assets/art/badge-add.png'),
  coins: {
    $: require('../../assets/art/coin-usd.png'),
    '€': require('../../assets/art/coin-eur.png'),
    '£': require('../../assets/art/coin-gbp.png'),
    '₦': require('../../assets/art/coin-ngn.png'),
  } as Record<string, number>,
  sparkles: {
    coin: require('../../assets/art/sparkle-mustard.png'),
    white: require('../../assets/art/sparkle-white.png'),
    soft: require('../../assets/art/sparkle-orchid.png'),
    coral: require('../../assets/art/sparkle-tangerine.png'),
  } as Record<string, number>,
  faces: [
    require('../../assets/art/avatar-1.png'),
    require('../../assets/art/avatar-2.png'),
    require('../../assets/art/avatar-3.png'),
    require('../../assets/art/avatar-4.png'),
    require('../../assets/art/avatar-5.png'),
    require('../../assets/art/avatar-6.png'),
  ],
}

function Art({ source, width, height }: { source: number; width: number; height: number }) {
  return <Image source={source} style={{ width, height }} contentFit="contain" accessible={false} />
}

export { Floor, Kovi, KoviPeek, type KoviPose, koviFeet } from './kovi'

/** The peek artwork's edge is its bottom line. */
export const peekEdge = 1

/** Kovi riding his paper plane, facing right so a flight path can steer him. */
export function Flyer({ size = 120 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', left: size * 0.02, top: size * 0.2 }}>
        <Art source={art.plane} width={size * 0.96} height={size * 0.96} />
      </View>
      {/* Seated: his seat line meets the plane's back, centred over its body. */}
      <View style={{ position: 'absolute', left: size * 0.12, top: size * 0.06 }}>
        <Kovi pose="ride" size={size * 0.72} />
      </View>
    </View>
  )
}

export function Coin({ size = 44, symbol = '$' }: { size?: number; symbol?: string }) {
  return <Art source={art.coins[symbol] ?? art.coins.$} width={size} height={size} />
}

export function Sparkle({ size = 28, fill = colors.yellow }: { size?: number; fill?: string }) {
  const key = fill === colors.white ? 'white' : fill === colors.coral ? 'coral' : fill === colors.coralSoft && fill !== colors.yellow ? 'soft' : 'coin'
  return <Art source={art.sparkles[key]} width={size} height={size} />
}

export function Plane({ size = 64 }: { size?: number }) {
  return <Art source={art.plane} width={size} height={size} />
}

export function Snowflakes({ width = 200 }: { width?: number }) {
  return <Art source={art.snowflakes} width={width} height={width / 4} />
}

/** One snowflake from the painted set; `i` picks which. */
export function Flake({ i = 0, size = 18 }: { i?: number; size?: number }) {
  return <Art source={art.flakes[i % art.flakes.length]} width={size} height={size} />
}

type Point = { x: number; y: number }
type Route = { from: Point; via: Point; to: Point }

/**
 * Welcome: a little planet with a shop and a home, and a dotted route between them. The
 * route is measured from the artwork, so Kovi's flight follows the painted dots.
 */
export const welcomeScene = {
  aspect: 960 / 1170,
  route(width: number, top: number): Route {
    const s = width / 1170
    return {
      from: { x: 252 * s, y: top + 494 * s },
      via: { x: 582 * s, y: top + 97 * s },
      to: { x: 912 * s, y: top + 481 * s },
    }
  },
}
export function PlanetScene({ width }: { width: number }) {
  return <Art source={art.welcome} width={width} height={width * welcomeScene.aspect} />
}

/** Send: two skylines and the dotted route between them, measured from the artwork. */
export const sendScene = {
  aspect: 510 / 1026,
  route(width: number, left: number, top: number): Route {
    const s = width / 1026
    return {
      from: { x: left + 242 * s, y: top + 203 * s },
      via: { x: left + 510 * s, y: top - 79 * s },
      to: { x: left + 777 * s, y: top + 197 * s },
    }
  },
}
export function CitiesScene({ width }: { width: number }) {
  return <Art source={art.send} width={width} height={width * sendScene.aspect} />
}

/** Face ID setup: Kovi inside a scan frame, holding up the key to the wallet. */
export function KeyScene({ size = 300 }: { size?: number }) {
  const h = (size * 900) / 1080
  const r = h * 0.42
  return (
    <View style={{ width: size, height: h }}>
      <Svg width={size} height={h} viewBox={`${-size / 2} ${-h / 2} ${size} ${h}`}>
        <Circle cx={0} cy={0} r={r} fill={colors.surface} stroke={colors.ink} strokeWidth={2.6} />
        <Path
          d={frame(r * 0.62)}
          fill="none"
          stroke={colors.ink}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <View style={{ position: 'absolute', left: size / 2 - r * 0.8, top: h / 2 - r * 0.84 }}>
        <Kovi pose="key" size={r * 1.6} />
      </View>
      <View style={{ position: 'absolute', left: size * 0.06, top: h * 0.08 }}>
        <Sparkle size={28} fill={colors.yellow} />
      </View>
      <View style={{ position: 'absolute', right: size * 0.06, top: h * 0.3 }}>
        <Sparkle size={22} fill={colors.white} />
      </View>
      <View style={{ position: 'absolute', right: size * 0.1, bottom: h * 0.06 }}>
        <Sparkle size={30} fill={colors.coral} />
      </View>
    </View>
  )
}

/** Four rounded corner brackets of a face-scan frame, `half` from the centre. */
function frame(half: number) {
  const a = half
  const b = half * 0.55
  return [
    `M${-a} ${-b} L${-a} ${-a} L${-b} ${-a}`,
    `M${b} ${-a} L${a} ${-a} L${a} ${-b}`,
    `M${a} ${b} L${a} ${a} L${b} ${a}`,
    `M${-b} ${a} L${-a} ${a} L${-a} ${b}`,
  ].join(' ')
}

/**
 * Paid: the terminal printing a receipt, with the amount set on it by the app. The receipt's
 * top edge (where Kovi stands) and the blank strip under its printed lines were measured
 * from the artwork.
 */
export const receipt = { top: 54 / 750, amountY: 252 / 750, left: 224 / 720, width: 271 / 720 }
export function ReceiptTerminal({ amount, width = 240 }: { amount: string; width?: number }) {
  const height = (width * 750) / 720
  return (
    <View style={{ width, height }}>
      <Art source={art.terminal} width={width} height={height} />
      <View
        style={{
          position: 'absolute',
          top: height * receipt.amountY - 12,
          left: width * receipt.left,
          width: width * receipt.width,
          alignItems: 'center',
        }}
      >
        <Txt weight="bold" size={Math.round(width / 16)} numberOfLines={1} adjustsFontSizeToFit>
          PAID {amount}
        </Txt>
      </View>
    </View>
  )
}

/**
 * The Kova Card, with the wordmark and number set by the app. `frozen` swaps in the frosted
 * card and puts Kovi to sleep on its top edge, with a few flakes around him. Both card images
 * are cropped so the card body starts 4px in.
 */
export function CardArt({ width = 300, last4, frozen }: { width?: number; last4: string; frozen?: boolean }) {
  const card = { x: 4, y: 4, w: 887, h: 566 }
  const s = width / card.w
  const img = { width: 897 * s, height: 576 * s }
  const scale = width / 300
  const kovi = width * 0.42
  // Headroom above a frozen card for Kovi, whose body rests on the card's top edge.
  const room = frozen ? kovi * 0.66 : 0
  return (
    <View style={{ width: img.width, height: img.height + room }}>
      <View style={{ position: 'absolute', top: room }}>
        <Art source={frozen ? art.cardFrozen : art.cardActive} width={img.width} height={img.height} />
        <View style={{ position: 'absolute', left: (card.x + 70) * s, top: (card.y + 44) * s }}>
          <Wordmark height={Math.round(24 * scale)} coin={frozen ? colors.surface : colors.yellow} />
        </View>
        <Txt
          weight="semi"
          size={Math.round(17 * scale)}
          style={{ position: 'absolute', left: (card.x + 70) * s, top: (card.y + card.h - 118) * s, letterSpacing: 3 }}
        >
          •••• {last4}
        </Txt>
      </View>
      {frozen ? (
        <>
          <View style={{ position: 'absolute', left: img.width / 2 - kovi / 2, top: room - kovi * 0.7 }}>
            <Kovi pose="sleep" size={kovi} />
          </View>
          {[
            { x: 0.08, y: 0.1, size: 20, i: 0 },
            { x: 0.26, y: 0.45, size: 14, i: 2 },
            { x: 0.74, y: 0.2, size: 16, i: 3 },
            { x: 0.9, y: 0.55, size: 22, i: 1 },
          ].map((f) => (
            <View key={f.i} style={{ position: 'absolute', left: f.x * img.width, top: f.y * room }}>
              <Flake i={f.i} size={f.size} />
            </View>
          ))}
        </>
      ) : null}
    </View>
  )
}

/** FNV-1a: spreads similar strings (like two 0x addresses) evenly across the faces. */
function hash(text: string) {
  let h = 0x811c9dc5
  for (const c of text.toLowerCase()) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/**
 * A friendly face for a person. Picked from their wallet address when there is one (so the
 * same person always looks the same, whatever they are called), else from their name.
 */
export function Avatar({ name, id, size = 56 }: { name: string; id?: string; size?: number }) {
  return (
    <Image
      source={art.faces[hash(id || name || '?') % art.faces.length]}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="contain"
      accessible={false}
    />
  )
}

/** A merchant's badge: a little shop front, for payments to businesses. */
export function ShopBadge({ size = 44 }: { size?: number; fill?: string }) {
  return <Art source={art.shop} width={size} height={size} />
}

/** Money added from outside, like a faucet or a top-up. */
export function AddBadge({ size = 44 }: { size?: number }) {
  return <Art source={art.add} width={size} height={size} />
}
