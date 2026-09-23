/**
 * Kova's brand on the web: the Tap K mark, the wordmark (its o is a coin) and the painted art.
 * Geometry matches the app's ui/Logo.tsx and docs/design/logo/*.svg.
 */

const STEM = 'M62 46 V154'
const WAVES = [
  'M92.6 74.3 A40 40 0 0 1 92.6 125.7',
  'M115.6 55 A70 70 0 0 1 115.6 145',
  'M138.6 35.7 A100 100 0 0 1 138.6 164.3',
]

export function LogoMark({ size = 40, stem = 'var(--ink)', wave = 'var(--coral)' }: { size?: number; stem?: string; wave?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Kova">
      <path d={STEM} stroke={stem} strokeWidth={19} strokeLinecap="round" />
      {WAVES.map((d) => (
        <path key={d} d={d} stroke={wave} strokeWidth={17} strokeLinecap="round" fill="none" />
      ))}
    </svg>
  )
}

export function Wordmark({ height = 24, ink = 'var(--ink)', coin = 'var(--coral-soft)' }: { height?: number; ink?: string; coin?: string }) {
  const line = { stroke: ink, strokeWidth: 15.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  return (
    <svg width={(height * 252) / 100} height={height} viewBox="0 0 252 100" role="img" aria-label="Kova">
      <path d="M8 8 V92" {...line} />
      <path d="M12 70 L40 38" {...line} />
      <path d="M26 56 L44 92" {...line} />
      <circle cx={86} cy={65} r={27} fill={coin} stroke={ink} strokeWidth={15.5} />
      <path d="M130 40 L150 92 L170 40" {...line} />
      <circle cx={212} cy={66} r={26} {...line} />
      <path d="M238 40 V92" {...line} />
    </svg>
  )
}

/** Mark + wordmark + what this surface is, e.g. "Merchant". */
export function Brand({ label }: { label?: string }) {
  return (
    <a href="/" className="brand" aria-label="Kova home">
      <LogoMark size={34} />
      <Wordmark height={20} />
      {label ? <span className="brand-label">{label}</span> : null}
    </a>
  )
}

type ArtName = 'kovi-wave' | 'kovi-cheer' | 'kovi-oops' | 'kovi-catch' | 'kovi-peek' | 'badge-shop' | 'scene-paid-terminal' | 'coin-usd' | 'plane'

export function Art({ name, size, className, alt = '' }: { name: ArtName; size: number; className?: string; alt?: string }) {
  const tall = name === 'scene-paid-terminal' ? 750 / 720 : name === 'kovi-peek' ? 0.5 : 1
  // biome-ignore lint/performance/noImgElement: static painted art, sized explicitly
  return <img src={`/art/${name}.png`} width={size} height={Math.round(size * tall)} className={className} alt={alt} draggable={false} />
}

const glyphs = {
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  back: ['M14.5 5.5L8 12l6.5 6.5'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  terminal: ['M7 3h10v18H7z', 'M10 17h4'],
  tap: ['M8.5 8.5a5 5 0 0 1 0 7', 'M11.5 6a8.5 8.5 0 0 1 0 12', 'M14.5 3.5a12 12 0 0 1 0 17'],
  del: ['M9 6h11v12H9l-5-6z', 'M12.5 9.5l5 5', 'M17.5 9.5l-5 5'],
  copy: ['M9 9h10v10H9z', 'M5 15V5h10'],
  refresh: ['M19 12a7 7 0 1 1-2.05-4.95', 'M19 4v4h-4'],
} as const

export type IconName = keyof typeof glyphs

export function Icon({ name, size = 20, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {glyphs[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

/** The app's pill button: label on the left, its icon in a round cap on the right. */
export function Pill({
  children,
  icon = 'arrow',
  href,
  onClick,
  disabled,
  tone = 'ink',
  type = 'button',
}: {
  children: React.ReactNode
  icon?: IconName
  href?: string
  onClick?: () => void
  disabled?: boolean
  tone?: 'ink' | 'coral' | 'light'
  type?: 'button' | 'submit'
}) {
  const inner = (
    <>
      <span className="pill-label">{children}</span>
      <span className="pill-cap">
        <Icon name={icon} size={18} />
      </span>
    </>
  )
  if (href)
    return (
      <a className="pill" data-tone={tone} href={href}>
        {inner}
      </a>
    )
  return (
    // biome-ignore lint/a11y/useButtonType: type is passed in
    <button className="pill" data-tone={tone} type={type} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  )
}
