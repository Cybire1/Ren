import type { ColorValue } from 'react-native'

/**
 * Ren's visual system: mint paper, one deep navy ink, and three colours that each mean something.
 *
 * Every surface is flat, drawn with a 2px ink outline and no shadows. Cobalt is money at rest and
 * arriving, watermelon is paying and anything that spends, and the coins are Reni's.
 *
 * In the dark (the phone's setting, or Appearance on You) it's the same system on black, as on
 * Ren's site: cool light text, grey cards standing off the black with no outlines, green and
 * watermelon lifted a step so they hold their contrast. Ink has three jobs, split so the dark can
 * tell them apart: text (`ink`), outlines (`line`) and dark surfaces (`fill`); in light they're
 * all ink.
 */
const light = {
  /** The ground every screen sits on. */
  paper: '#F6F1F0',
  /** Cards, keys and inputs: a shade lighter than the ground. */
  surface: '#FCF9F8',
  /** Recessed areas: chips, input fills, frozen things. */
  sunken: '#EDE6E5',
  /** Text and icons on paper and cards. */
  ink: '#1E1A1C',
  /** Outlines: the 2px edge of cards, stickers and fields. Gone in the dark. */
  line: '#1E1A1C',
  /** An outline that is the whole control (an empty field, a dashed "new"): still there in the dark. */
  edge: '#1E1A1C',
  /** Dark surfaces: the Pay card, the dock, ink pills. */
  fill: '#1E1A1C',
  /** Light text and icons on a dark surface. */
  onFill: '#FCF9F8',
  /** The chosen chip, segment, day or dot: ink, and light in the dark so it still stands out. */
  chosen: '#1E1A1C',
  /** Text and icons on a chosen chip. */
  onChosen: '#FFFFFF',
  /** Text on bright colours (watermelon, green, the coins, white), dark in either appearance. */
  dark: '#1E1A1C',
  teal: '#C2185B',
  tealDeep: '#A3144C',
  /** Green grounds that carry ink text. */
  tealSoft: '#FBE0EA',
  tealLight: '#F08DB0',
  /** The pay colour: the Pay button, its pulse, and every action that spends. */
  coral: '#FF5E7E',
  coralDeep: '#D13C5C',
  /** Watermelon grounds that carry ink text. */
  coralSoft: '#FFC0CC',
  /** The coin colour: Reni, the coins, the card chip. Soft watermelon, a quieter echo of paying. */
  yellow: '#FFC0CC',
  blush: '#FF9DB0',
  /** Text and icons on ink or watermelon. */
  white: '#FFFFFF',
  muted: '#63585C',
  /** Secondary text on tinted grounds; plain muted grey is too faint there. */
  onTint: '#3D3438',
  /** Secondary text on ink. */
  onInk: '#C7BEC1',
  /** Text on green. */
  onTeal: '#FFF0F5',
  /** Light grounds inside cards: the awning's stripes, receipts. Grey in the dark. */
  card: '#FFFFFF',
  coralTint: '#FFE0E6',
  positive: '#A3144C',
  danger: '#C43D12',
  /** White that lifts off a card: fields, the chosen tile, a filled stamp. Grey in the dark. */
  raised: '#FFFFFF',
  /** The money card's green: Ren's green, and a deep green in the dark so its figures stay crisp. */
  money: '#C2185B',
  /** Light green on a dark fill (the private card, key badges): mint by day, Ren's green by night. */
  glow: '#FF9DB8',
  /** The Keys sand: the colour of who-can-spend, deepened in the dark. */
  sand: '#FFF0B5',
  /** A faint ink wash: round buttons, pressed rows. */
  wash: 'rgba(30,26,28,0.07)',
  /** Hairlines and dividers. */
  rule: 'rgba(30,26,28,0.16)',
} as const

type Name = keyof typeof light

const dark: Record<Name, string> = {
  paper: '#000000',
  surface: '#161616',
  sunken: '#222222',
  ink: '#EEECEA',
  // A faint edge rather than none: cards barely show it, and outlined controls still read.
  line: '#262626',
  edge: '#3A3A3A',
  fill: '#1B1B1B',
  onFill: '#EEECEA',
  chosen: '#3A3A3A',
  onChosen: '#FFFFFF',
  dark: '#1E1A1C',
  teal: '#E0457A',
  tealDeep: '#C2185B',
  tealSoft: '#241018',
  tealLight: '#D63A72',
  coral: '#FF6F8C',
  coralDeep: '#E0566F',
  coralSoft: '#2A1519',
  yellow: '#FFC0CC',
  blush: '#FF9DB0',
  white: '#FFFFFF',
  muted: '#9C9497',
  onTint: '#B8B0B3',
  onInk: '#B8B0B3',
  onTeal: '#FFF0F5',
  card: '#161616',
  coralTint: '#2A1519',
  positive: '#FF8FB5',
  danger: '#FF7A59',
  raised: '#262626',
  money: '#7D0F3B',
  glow: '#FF8FB5',
  sand: '#2A2512',
  wash: 'rgba(238,236,234,0.1)',
  rule: 'rgba(238,236,234,0.14)',
}

/**
 * Ren is dark, always: raspberry on black. Every colour is its dark value, plain, so nothing
 * depends on the phone's setting. The light values stay written down for the QR codes (dark on
 * white, whatever the look) and for a light look, should Ren ever offer one again.
 */
export function pair(_lightValue: string, darkValue: string): ColorValue {
  return darkValue
}

export const colors = Object.fromEntries(
  (Object.keys(light) as Name[]).map((name) => [name, pair(light[name], dark[name])]),
) as Record<Name, ColorValue>

/**
 * The plain values, for the few things that need a string (QR codes, gradients, SVG art) and
 * need raw strings.
 */
export const palette = { light, dark } as const

/** Ink at `alpha`, or the light text at `alpha` in the dark. */
export function inkAt(alpha: number): ColorValue {
  return pair(`rgba(30,26,28,${alpha})`, `rgba(238,236,234,${alpha})`)
}

/**
 * The whole app is drawn a step smaller than the sizes written in each screen: text by 8%,
 * icons by 12%. One place to tune how dense Ren feels.
 */
export const density = { text: 0.92, icon: 0.88 } as const

/** Manrope: a calm, open grotesk with even figures, so amounts read cleanly. */
export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semi: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  /** Headlines and amounts. */
  heavy: 'Manrope_800ExtraBold',
} as const
