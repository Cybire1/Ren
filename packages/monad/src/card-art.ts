/**
 * The Kova Card's face, as one SVG drawn from code: the app (react-native-svg's SvgXml), the web
 * (an <img> or inline), the films and the print file all use this, so the design lives in one place.
 *
 * The card is a tiny shopfront: an awning across the top, a window where Kovi waves, and the
 * holder's name over the counter. It's a contactless card (an NFC chip, no contacts), so it shows
 * the tap mark, never an EMV chip. Portrait, ID-1 proportions (54 × 85.6 mm).
 */

export type CardFinish = 'paper' | 'ink' | 'coral'

export interface CardArtOptions {
  /** The holder's name as it prints, e.g. "Ada Laine". */
  name?: string
  /** The last four characters of the card's address, shown as "•• 4821". */
  lastFour?: string
  finish?: CardFinish
  /** Frozen cards wear frost and a lock. */
  frozen?: boolean
  /** Shown under the name: a short label the holder gave the card. */
  label?: string
}

const W = 540
const H = 856
const R = 34

const FINISH: Record<CardFinish, { base: string; text: string; sub: string; dots: string; awningA: string; awningB: string; window: string; frame: string; mark: string }> = {
  paper: { base: '#F4F1EA', text: '#0B1A1D', sub: '#55636A', dots: '#0B1A1D', awningA: '#D46558', awningB: '#FBF8F2', window: '#A9C9C9', frame: '#0B1A1D', mark: '#D46558' },
  ink: { base: '#0F1E21', text: '#F1EFEA', sub: '#A7B8B9', dots: '#F1EFEA', awningA: '#D46558', awningB: '#F1EFEA', window: '#2B4A4C', frame: '#F1EFEA', mark: '#D46558' },
  coral: { base: '#D46558', text: '#FFFFFF', sub: '#FBE3DE', dots: '#0B1A1D', awningA: '#0B1A1D', awningB: '#F1EFEA', window: '#F4D8A8', frame: '#0B1A1D', mark: '#0B1A1D' },
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

/** Kovi, drawn in vector so it stays sharp on the card: a waving coin with a dotted rim. */
function kovi(cx: number, cy: number, r: number) {
  const dots = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2
    return `<circle cx="${(cx + Math.cos(a) * r * 0.8).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 0.8).toFixed(1)}" r="${(r * 0.035).toFixed(1)}" fill="#0B1A1D"/>`
  }).join('')
  const s = r / 100
  return `
  <g>
    <path d="M${cx + 90 * s} ${cy - 18 * s} Q${cx + 128 * s} ${cy - 40 * s} ${cx + 136 * s} ${cy - 92 * s}" fill="none" stroke="#0B1A1D" stroke-width="${8 * s}" stroke-linecap="round"/>
    <circle cx="${cx + 138 * s}" cy="${cy - 100 * s}" r="${17 * s}" fill="#F2C55C" stroke="#0B1A1D" stroke-width="${7 * s}"/>
    <path d="M${cx - 90 * s} ${cy - 18 * s} Q${cx - 128 * s} ${cy - 40 * s} ${cx - 136 * s} ${cy - 92 * s}" fill="none" stroke="#0B1A1D" stroke-width="${8 * s}" stroke-linecap="round"/>
    <circle cx="${cx - 138 * s}" cy="${cy - 100 * s}" r="${17 * s}" fill="#F2C55C" stroke="#0B1A1D" stroke-width="${7 * s}"/>
    <circle cx="${cx + 12 * s}" cy="${cy}" r="${r}" fill="#E39A3C" stroke="#0B1A1D" stroke-width="${8 * s}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#F2C55C" stroke="#0B1A1D" stroke-width="${8 * s}"/>
    ${dots}
    <path d="M${cx - 52 * s} ${cy - 50 * s} Q${cx - 40 * s} ${cy - 72 * s} ${cx - 14 * s} ${cy - 76 * s}" stroke="#FFFFFF" stroke-width="${10 * s}" stroke-linecap="round" fill="none" opacity="0.85"/>
    <ellipse cx="${cx - 26 * s}" cy="${cy - 6 * s}" rx="${8 * s}" ry="${13 * s}" fill="#0B1A1D"/>
    <ellipse cx="${cx + 26 * s}" cy="${cy - 6 * s}" rx="${8 * s}" ry="${13 * s}" fill="#0B1A1D"/>
    <circle cx="${cx - 23 * s}" cy="${cy - 11 * s}" r="${3 * s}" fill="#FFFFFF"/>
    <circle cx="${cx + 29 * s}" cy="${cy - 11 * s}" r="${3 * s}" fill="#FFFFFF"/>
    <ellipse cx="${cx - 50 * s}" cy="${cy + 16 * s}" rx="${13 * s}" ry="${9 * s}" fill="#EE8F86" opacity="0.8"/>
    <ellipse cx="${cx + 50 * s}" cy="${cy + 16 * s}" rx="${13 * s}" ry="${9 * s}" fill="#EE8F86" opacity="0.8"/>
    <path d="M${cx - 18 * s} ${cy + 18 * s} Q${cx} ${cy + 46 * s} ${cx + 18 * s} ${cy + 18 * s} Z" fill="#E86A6A" stroke="#0B1A1D" stroke-width="${6 * s}" stroke-linejoin="round"/>
  </g>`
}

/** The tap mark: a dot and two arcs. */
function tapMark(x: number, y: number, color: string, size = 1) {
  const s = size
  return `<g fill="none" stroke="${color}" stroke-width="${7 * s}" stroke-linecap="round">
    <circle cx="${x}" cy="${y}" r="${5 * s}" fill="${color}" stroke="none"/>
    <path d="M${x + 16 * s} ${y - 18 * s} a26 26 0 0 1 0 36"/>
    <path d="M${x + 30 * s} ${y - 32 * s} a46 46 0 0 1 0 64"/>
  </g>`
}

export function cardArtSvg({ name = 'Your name', lastFour = '0000', finish = 'paper', frozen = false, label }: CardArtOptions = {}): string {
  const f = FINISH[finish]
  const stripe = 54
  const stripes = Array.from({ length: Math.ceil(W / stripe) + 1 }, (_, i) =>
    `<rect x="${i * stripe}" y="0" width="${stripe}" height="118" fill="${i % 2 ? f.awningB : f.awningA}"/>`,
  ).join('')
  const scallops = Array.from({ length: Math.ceil(W / stripe) + 1 }, (_, i) =>
    `<path d="M${i * stripe} 118 a${stripe / 2} ${stripe / 2.2} 0 0 0 ${stripe} 0 Z" fill="${i % 2 ? f.awningB : f.awningA}" stroke="#0B1A1D" stroke-width="5" stroke-linejoin="round"/>`,
  ).join('')
  const frost = frozen
    ? `<rect width="${W}" height="${H}" fill="#DCEBF5" opacity="0.72"/>
       ${Array.from({ length: 9 }, (_, i) => {
         const x = 60 + (i % 3) * 210
         const y = 170 + Math.floor(i / 3) * 230
         return `<g stroke="#7FA6C2" stroke-width="5" stroke-linecap="round" opacity="0.7"><path d="M${x - 24} ${y} H${x + 24} M${x} ${y - 24} V${y + 24} M${x - 17} ${y - 17} L${x + 17} ${y + 17} M${x - 17} ${y + 17} L${x + 17} ${y - 17}"/></g>`
       }).join('')}
       <g transform="translate(${W / 2 - 120} ${H / 2 - 44})">
         <rect width="240" height="88" rx="44" fill="#0B1A1D"/>
         <rect x="38" y="40" width="34" height="28" rx="6" fill="#F1EFEA"/>
         <path d="M45 40 v-8 a10 10 0 0 1 20 0 v8" fill="none" stroke="#F1EFEA" stroke-width="6"/>
         <text x="92" y="58" font-family="Manrope, system-ui, sans-serif" font-weight="800" font-size="30" fill="#F1EFEA">Frozen</text>
       </g>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <clipPath id="kc-card"><rect width="${W}" height="${H}" rx="${R}"/></clipPath>
    <pattern id="kc-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1.6" fill="${f.dots}" opacity="0.09"/></pattern>
    <linearGradient id="kc-sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="0.42" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.16"/>
      <stop offset="0.58" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#kc-card)">
    <rect width="${W}" height="${H}" fill="${f.base}"/>
    <rect width="${W}" height="${H}" fill="url(#kc-dots)"/>
    ${stripes}
    <rect y="113" width="${W}" height="5" fill="#0B1A1D"/>
    ${scallops}

    <rect x="58" y="214" width="${W - 116}" height="352" rx="${(W - 116) / 2}" ry="176" fill="${f.window}" stroke="${f.frame}" stroke-width="8"/>
    <path d="M58 482 H${W - 58}" stroke="${f.frame}" stroke-width="8"/>
    <rect x="58" y="482" width="${W - 116}" height="84" fill="${f.base}" stroke="${f.frame}" stroke-width="8"/>
    ${kovi(W / 2, 380, 86)}
    <text x="${W / 2}" y="536" text-anchor="middle" font-family="Manrope, system-ui, sans-serif" font-weight="800" font-size="34" letter-spacing="-1" fill="${f.text}">Tap. Paid. Anywhere.</text>

    ${tapMark(W - 112, 186, f.text, 0.9)}
    <text x="58" y="190" font-family="Manrope, system-ui, sans-serif" font-weight="800" font-size="20" letter-spacing="4" fill="${f.sub}">DOLLARS · MONAD</text>

    <text x="58" y="${H - 132}" font-family="Manrope, system-ui, sans-serif" font-weight="700" font-size="16" letter-spacing="3" fill="${f.sub}">${esc((label ?? 'CARDHOLDER').toUpperCase())}</text>
    <text x="58" y="${H - 94}" font-family="Manrope, system-ui, sans-serif" font-weight="800" font-size="34" letter-spacing="1" fill="${f.text}">${esc(name.toUpperCase())}</text>
    <text x="58" y="${H - 54}" font-family="Manrope, system-ui, sans-serif" font-weight="700" font-size="24" letter-spacing="3" fill="${f.sub}">•• ${esc(lastFour.toUpperCase())}</text>

    <g transform="translate(${W - 198} ${H - 104})">
      <path d="M6 10 V52" stroke="${f.text}" stroke-width="8" stroke-linecap="round"/>
      <path d="M20 20 a16 16 0 0 1 0 22" fill="none" stroke="${f.mark}" stroke-width="7" stroke-linecap="round"/>
      <path d="M30 12 a28 28 0 0 1 0 38" fill="none" stroke="${f.mark}" stroke-width="7" stroke-linecap="round"/>
      <text x="52" y="48" font-family="Manrope, system-ui, sans-serif" font-weight="800" font-size="46" letter-spacing="-1.5" fill="${f.text}">kova</text>
    </g>

    ${frost}
    <rect width="${W}" height="${H}" fill="url(#kc-sheen)"/>
  </g>
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="${R - 2}" fill="none" stroke="#0B1A1D" stroke-opacity="0.18" stroke-width="4"/>
</svg>`
}
