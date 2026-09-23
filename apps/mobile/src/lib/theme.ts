/**
 * Shared with the web dashboard: one visual system across every Kova surface.
 * Amounts use the mono face because they line up down a receipt; everything else is Sans.
 */
export const colors = {
  paper: '#F3F5F4',
  paperRaised: '#FBFCFB',
  ink: '#0F1512',
  inkMuted: '#5B6560',
  rule: '#D6DBD8',
  settled: '#0B6B4F',
  settledDeep: '#08543E',
  onSettled: '#E9F4EF',
  pending: '#8A6A1F',
  failed: '#8C2F22',
} as const

export const fonts = {
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemi: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const

/** Kept for existing imports. */
export const theme = { ...colors, mono: fonts.mono } as const
