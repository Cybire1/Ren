import * as SecureStore from 'expo-secure-store'
import { Appearance, type ColorValue, DynamicColorIOS, Platform, Settings } from 'react-native'

/**
 * Ren's visual system: mint paper, one deep navy ink, and three colours that each mean something.
 *
 * Every surface is flat, drawn with a 2px ink outline and no shadows. Green is money at rest and
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
  paper: '#E8F7EF',
  /** Cards, keys and inputs: a shade lighter than the ground. */
  surface: '#F6FCF8',
  /** Recessed areas: chips, input fills, frozen things. */
  sunken: '#D6EEE1',
  /** Text and icons on paper and cards. */
  ink: '#10233F',
  /** Outlines: the 2px edge of cards, stickers and fields. Gone in the dark. */
  line: '#10233F',
  /** An outline that is the whole control (an empty field, a dashed "new"): still there in the dark. */
  edge: '#10233F',
  /** Dark surfaces: the Pay card, the dock, ink pills. */
  fill: '#10233F',
  /** Light text and icons on a dark surface. */
  onFill: '#F6FCF8',
  /** The chosen chip, segment, day or dot: ink, and light in the dark so it still stands out. */
  chosen: '#10233F',
  /** Text and icons on a chosen chip. */
  onChosen: '#FFFFFF',
  /** Text on bright colours (watermelon, green, the coins, white), dark in either appearance. */
  dark: '#10233F',
  teal: '#00A37A',
  tealDeep: '#00805F',
  /** Green grounds that carry ink text. */
  tealSoft: '#A6E8D2',
  tealLight: '#6FD3B3',
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
  muted: '#4F6577',
  /** Secondary text on tinted grounds; plain muted grey is too faint there. */
  onTint: '#1E3557',
  /** Secondary text on ink. */
  onInk: '#A9C1D6',
  /** Text on green. */
  onTeal: '#E3FFF5',
  /** Light grounds inside cards: the awning's stripes, receipts. Grey in the dark. */
  card: '#FFFFFF',
  coralTint: '#FFE0E6',
  positive: '#00805F',
  danger: '#D2334B',
  /** White that lifts off a card: fields, the chosen tile, a filled stamp. Grey in the dark. */
  raised: '#FFFFFF',
  /** The money card's green: Ren's green, and a deep green in the dark so its figures stay crisp. */
  money: '#00A37A',
  /** Light green on a dark fill (the private card, key badges): mint by day, Ren's green by night. */
  glow: '#A6E8D2',
  /** The Keys sand: the colour of who-can-spend, deepened in the dark. */
  sand: '#FFF0B5',
  /** A faint ink wash: round buttons, pressed rows. */
  wash: 'rgba(16,35,63,0.07)',
  /** Hairlines and dividers. */
  rule: 'rgba(16,35,63,0.16)',
} as const

type Name = keyof typeof light

const dark: Record<Name, string> = {
  paper: '#000000',
  surface: '#161616',
  sunken: '#222222',
  ink: '#E6EEE9',
  // A faint edge rather than none: cards barely show it, and outlined controls still read.
  line: '#262626',
  edge: '#3A3A3A',
  fill: '#1B1B1B',
  onFill: '#E6EEE9',
  chosen: '#3A3A3A',
  onChosen: '#FFFFFF',
  dark: '#10233F',
  teal: '#20B487',
  tealDeep: '#189A73',
  tealSoft: '#10241C',
  tealLight: '#1F8A68',
  coral: '#FF6F8C',
  coralDeep: '#E0566F',
  coralSoft: '#2A1519',
  yellow: '#FFC0CC',
  blush: '#FF9DB0',
  white: '#FFFFFF',
  muted: '#8C9892',
  onTint: '#B0BAB5',
  onInk: '#B0BAB5',
  onTeal: '#E3FFF5',
  card: '#161616',
  coralTint: '#2A1519',
  positive: '#3EC79B',
  danger: '#FF6B7D',
  raised: '#262626',
  money: '#0E5C47',
  glow: '#20B487',
  sand: '#2A2512',
  wash: 'rgba(230,238,233,0.1)',
  rule: 'rgba(230,238,233,0.14)',
}

/** Where Appearance on You keeps its choice (readable before any style is made). */
export const LOOK_KEY = 'KovaLook'

/**
 * A setting the app needs before any style exists, so read synchronously: iOS user defaults, or on
 * Android the secure store's synchronous read (Android has no `Settings`).
 */
export function readStartSetting(key: string): string | null {
  if (Platform.OS === 'ios') {
    const value = Settings.get(key)
    return typeof value === 'string' && value ? value : null
  }
  try {
    return SecureStore.getItem(key)
  } catch {
    return null
  }
}

/** Saves (or, with null, clears) a setting `readStartSetting` reads. */
export function writeStartSetting(key: string, value: string | null) {
  if (Platform.OS === 'ios') {
    Settings.set({ [key]: value ?? '' })
    return
  }
  try {
    if (value) SecureStore.setItem(key, value)
    else void SecureStore.deleteItemAsync(key)
  } catch {
    // Not kept: the app starts in the phone's look, which is the default anyway.
  }
}

/**
 * Light or dark, if chosen on You; null follows the phone. Read once, as the app starts: a choice
 * draws every colour plain for that look, so nothing depends on the phone's setting (React Native
 * resolves border colours against the phone's appearance, not the screen's, so dynamic colours
 * under a chosen look would leave some edges in the other one). Changing it reloads the app.
 */
export const chosenLook: 'light' | 'dark' | null = (() => {
  const saved = readStartSetting(LOOK_KEY)
  return saved === 'light' || saved === 'dark' ? saved : null
})()

/**
 * The look Android draws this run in. Android has no dynamic colours, so following the phone means
 * taking its setting as the app starts, and reloading when it changes (lib/prefs.tsx).
 */
export const androidLook: 'light' | 'dark' =
  chosenLook ?? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light')

/**
 * A colour in each look. Following the phone on iOS, it's a dynamic colour, resolved against each
 * screen's own appearance, so module-level styles follow light and dark with no re-render. Under a
 * chosen look it's that look's plain colour; on Android, the look the app started in. Also for the
 * few one-off colours outside the palette.
 */
export function pair(lightValue: string, darkValue: string): ColorValue {
  if (chosenLook) return chosenLook === 'dark' ? darkValue : lightValue
  if (Platform.OS === 'ios') return DynamicColorIOS({ light: lightValue, dark: darkValue })
  return androidLook === 'dark' ? darkValue : lightValue
}

export const colors = Object.fromEntries(
  (Object.keys(light) as Name[]).map((name) => [name, pair(light[name], dark[name])]),
) as Record<Name, ColorValue>

/**
 * The plain values, for the few things that need a string (QR codes, gradients, SVG art) and
 * resolve the appearance themselves (ui/animated.tsx `useLook`).
 */
export const palette = { light, dark } as const

/** Ink at `alpha`, or the light text at `alpha` in the dark. */
export function inkAt(alpha: number): ColorValue {
  return pair(`rgba(16,35,63,${alpha})`, `rgba(230,238,233,${alpha})`)
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
