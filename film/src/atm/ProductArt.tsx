/**
 * Product photos for the demo bakery, drawn in Kova's sticker style (ink outline, warm fills) on a
 * soft tinted tile: 600 × 600 each. Rendered by scripts/product-art.sh into the app's demo assets.
 */
import { AbsoluteFill } from 'remotion'

const INK = '#0b1a1d'
const s = { stroke: INK, strokeWidth: 10, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

export type ProductKind = 'loaf' | 'croissant' | 'bun' | 'flatwhite' | 'cake' | 'latte' | 'baguette' | 'cookie'

const TILE: Record<ProductKind, string> = {
  loaf: '#efd9bd',
  croissant: '#f3dfb8',
  bun: '#f1d3c6',
  flatwhite: '#d9e6e2',
  cake: '#f2d6cc',
  latte: '#d6e4ec',
  baguette: '#efe1c4',
  cookie: '#ecdcc9',
}

function Art({ kind }: { kind: ProductKind }) {
  switch (kind) {
    case 'loaf':
      return (
        <g>
          <ellipse cx="300" cy="430" rx="190" ry="26" fill={INK} opacity="0.12" />
          <path d="M120 400 C110 250 220 190 300 190 C380 190 490 250 480 400 Z" fill="#c98a4b" {...s} />
          <path d="M200 260 L240 330 M290 235 L320 320 M380 255 L395 335" {...s} fill="none" stroke="#f3dfb8" strokeWidth={12} />
          <path d="M120 400 H480" {...s} />
        </g>
      )
    case 'croissant':
      return (
        <g>
          <ellipse cx="300" cy="420" rx="200" ry="24" fill={INK} opacity="0.12" />
          <path d="M110 380 C120 300 180 260 230 270 C250 210 350 210 370 270 C420 260 480 300 490 380 C440 360 400 360 380 380 C340 350 260 350 220 380 C200 360 160 360 110 380 Z" fill="#e2a24e" {...s} />
          <path d="M230 270 C250 320 250 350 245 372 M370 270 C350 320 350 350 355 372 M300 250 V362" {...s} fill="none" />
        </g>
      )
    case 'bun':
      return (
        <g>
          <ellipse cx="300" cy="430" rx="170" ry="24" fill={INK} opacity="0.12" />
          <path d="M140 400 C130 300 200 220 300 220 C400 220 470 300 460 400 Z" fill="#d79a5c" {...s} />
          <path d="M300 300 C340 300 350 340 315 350 C270 360 250 310 290 285 C340 255 400 300 380 350" {...s} fill="none" stroke="#8a4f22" strokeWidth={12} />
          <path d="M190 280 L200 270 M240 245 L252 240 M360 245 L372 250 M410 280 L418 290" {...s} fill="none" stroke="#fbf3e4" strokeWidth={10} />
          <path d="M140 400 H460" {...s} />
        </g>
      )
    case 'flatwhite':
      return (
        <g>
          <ellipse cx="300" cy="450" rx="190" ry="24" fill={INK} opacity="0.12" />
          <ellipse cx="300" cy="425" rx="190" ry="34" fill="#fbfaf7" {...s} />
          <path d="M170 250 H430 L410 400 C405 420 195 420 190 400 Z" fill="#fbfaf7" {...s} />
          <path d="M430 280 C500 280 500 360 425 360" {...s} fill="none" />
          <ellipse cx="300" cy="252" rx="130" ry="22" fill="#b67a4a" {...s} />
          <path d="M300 238 C285 250 285 258 300 268 C315 258 315 250 300 238" fill="#fbfaf7" stroke="none" />
        </g>
      )
    case 'cake':
      return (
        <g>
          <ellipse cx="300" cy="440" rx="200" ry="24" fill={INK} opacity="0.12" />
          <path d="M130 300 L300 220 L470 300 V410 L300 450 L130 410 Z" fill="#d88a4e" {...s} />
          <path d="M130 300 L300 340 L470 300 M300 340 V450" {...s} fill="none" />
          <path d="M130 355 L300 395 L470 355" {...s} fill="none" stroke="#fbf3e4" strokeWidth={16} />
          <path d="M130 300 L300 220 L470 300 L300 340 Z" fill="#fbf3e4" {...s} />
          <path d="M290 270 C300 250 320 250 330 268 L312 290 Z" fill="#e2703a" {...s} strokeWidth={7} />
          <path d="M318 255 L335 238" {...s} stroke="#4f8a4b" strokeWidth={8} />
        </g>
      )
    case 'latte':
      return (
        <g>
          <ellipse cx="300" cy="460" rx="150" ry="22" fill={INK} opacity="0.12" />
          <path d="M190 170 H410 L385 440 C380 455 220 455 215 440 Z" fill="#e8f1f4" {...s} />
          <path d="M200 230 H400 L382 435 C378 446 222 446 218 435 Z" fill="#c69a72" stroke="none" />
          <rect x="230" y="250" width="56" height="56" rx="10" fill="#fbfaf7" opacity="0.85" {...s} strokeWidth={6} />
          <rect x="300" y="300" width="56" height="56" rx="10" fill="#fbfaf7" opacity="0.85" {...s} strokeWidth={6} />
          <path d="M190 170 H410 L385 440 C380 455 220 455 215 440 Z" fill="none" {...s} />
          <path d="M330 170 L360 80" {...s} stroke="#d46558" strokeWidth={16} />
        </g>
      )
    case 'baguette':
      return (
        <g>
          <ellipse cx="300" cy="430" rx="230" ry="22" fill={INK} opacity="0.12" />
          <path d="M100 400 C80 370 100 340 140 330 L460 230 C500 220 525 250 510 285 C500 305 480 312 460 320 L150 410 C130 415 110 412 100 400 Z" fill="#d49452" {...s} />
          <path d="M180 345 L215 360 M260 318 L295 333 M340 292 L375 307 M420 266 L452 280" {...s} fill="none" stroke="#f3dfb8" strokeWidth={12} />
        </g>
      )
    case 'cookie':
      return (
        <g>
          <ellipse cx="300" cy="440" rx="180" ry="22" fill={INK} opacity="0.12" />
          <circle cx="300" cy="300" r="160" fill="#d9a066" {...s} />
          {[
            [240, 240],
            [350, 230],
            [300, 310],
            [220, 340],
            [380, 340],
            [310, 390],
          ].map(([x, y]) => (
            <path key={`${x}${y}`} d={`M${x - 16} ${y} l16 -14 l18 10 l-6 18 l-20 4 z`} fill="#4a2a17" {...s} strokeWidth={6} />
          ))}
        </g>
      )
  }
}

export function ProductArt({ kind = 'croissant' }: { kind?: ProductKind }) {
  return (
    <AbsoluteFill style={{ background: TILE[kind] }}>
      <svg width="600" height="600" viewBox="0 0 600 600" aria-hidden="true">
        <Art kind={kind} />
      </svg>
    </AbsoluteFill>
  )
}
