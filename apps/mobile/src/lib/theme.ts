/**
 * Ren's visual system: mint paper, one deep teal-black ink, and three colours that each
 * mean something.
 *
 * Every surface is flat, drawn with a 2px ink outline. What you can press stands on a hard ink
 * shadow and sinks into it when pressed; nothing is blurred. Teal is money at rest and arriving,
 * coral is paying and anything that spends, yellow is Kovi and the coins.
 */
export const colors = {
  /** The ground every screen sits on. */
  paper: '#E8F7EF',
  /** Cards, keys and inputs: a shade lighter than the ground. */
  surface: '#F6FCF8',
  /** Recessed areas: chips, input fills, frozen things. */
  sunken: '#D6EEE1',
  ink: '#10233F',
  teal: '#00A37A',
  tealDeep: '#00805F',
  /** Teal grounds that carry ink text. */
  tealSoft: '#A6E8D2',
  tealLight: '#6FD3B3',
  /** The pay colour: the Pay button, its pulse, and every action that spends. */
  coral: '#FF5E7E',
  coralDeep: '#D13C5C',
  /** Coral grounds that carry ink text. */
  coralSoft: '#FFC0CC',
  /** The coin colour: Kovi, the coins, the card chip. Soft coral, a quieter echo of the pay colour. */
  yellow: '#FFC0CC',
  blush: '#FF9DB0',
  /** Text and icons on ink or coral. */
  white: '#FFFFFF',
  muted: '#4F6577',
  /** Secondary text on tinted grounds; plain muted grey is too faint there. */
  onTint: '#1E3557',
  /** Secondary text on ink. */
  onInk: '#A9C1D6',
  /** Text on teal. */
  onTeal: '#E3FFF5',
  /** Light grounds inside cards: the awning's stripes, receipts. */
  card: '#FFFFFF',
  coralTint: '#FFE0E6',
  positive: '#00805F',
  danger: '#D2334B',
} as const

/** Manrope: a calm, open grotesk with even figures, so amounts read cleanly. */
export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semi: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  /** Headlines and amounts. */
  heavy: 'Manrope_800ExtraBold',
} as const
