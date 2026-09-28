import { loadFont } from '@remotion/fonts'
import { staticFile } from 'remotion'

/** Kova's palette, from apps/web/src/app/globals.css. One ground, one ink, one accent. */
export const C = {
  paper: '#e7e5e0',
  surface: '#f1efea',
  ink: '#0b1a1d',
  coral: '#d46558',
  coralSoft: '#ebb3aa',
  /** Colours inside the captured screens, used only to mask what the film animates. */
  todayCard: 'rgb(169, 201, 201)',
  onTint: '#1f3438',
}

/** Manrope, the app's own face, from the app's own font files. */
export const fontsReady = Promise.all(
  [
    ['400', 'Manrope_400Regular'],
    ['500', 'Manrope_500Medium'],
    ['600', 'Manrope_600SemiBold'],
    ['700', 'Manrope_700Bold'],
    ['800', 'Manrope_800ExtraBold'],
  ].map(([weight, file]) => loadFont({ family: 'Manrope', url: staticFile(`fonts/${file}.ttf`), weight })),
)
