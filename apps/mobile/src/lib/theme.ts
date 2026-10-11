/**
 * Kova's visual system: warm paper, one deep teal-black ink, and three colours that each
 * mean something.
 *
 * Every surface is flat, drawn with a 2px ink outline and no shadows. Teal is money at rest
 * and arriving, coral is paying and anything that spends, yellow is Kovi and the coins.
 */
export const colors = {
  /** The ground every screen sits on. */
  paper: '#E7E5E0',
  /** Cards, keys and inputs: a shade lighter than the ground. */
  surface: '#F1EFEA',
  /** Recessed areas: chips, input fills, frozen things. */
  sunken: '#DEDCD8',
  ink: '#0B1A1D',
  teal: '#46878B',
  tealDeep: '#376B70',
  /** Teal grounds that carry ink text. */
  tealSoft: '#A9C9C9',
  tealLight: '#8FB9BB',
  /** The pay colour: the Pay button, its pulse, and every action that spends. */
  coral: '#D46558',
  coralDeep: '#A94B40',
  /** Coral grounds that carry ink text. */
  coralSoft: '#EBB3AA',
  /** The coin colour: Kovi, the coins, the card chip. Soft coral, a quieter echo of the pay colour. */
  yellow: '#EBB3AA',
  blush: '#E8A89C',
  /** Text and icons on ink or coral. */
  white: '#FFFFFF',
  muted: '#566568',
  /** Secondary text on tinted grounds; plain muted grey is too faint there. */
  onTint: '#1F3438',
  /** Secondary text on ink. */
  onInk: '#A7B8B9',
  positive: '#2E7268',
  danger: '#B03E32',
} as const

/** Manrope: a calm, open grotesk with even figures, so amounts read cleanly. */
/**
 * The whole app is drawn a step smaller than the sizes written in each screen: text by 8%,
 * icons by 12%. One place to tune how dense Kova feels.
 */
export const density = { text: 0.92, icon: 0.88 } as const

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semi: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const
