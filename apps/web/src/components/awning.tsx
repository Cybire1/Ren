/**
 * A market stall's awning: coral and paper stripes with a scalloped edge, outlined in ink like
 * everything else. It is the mark of a Kova Stall wherever one appears.
 *
 * Drawn in CSS pixels, not a viewBox, so the stripes keep their width and the scallops their
 * shape however wide the awning is: it simply repeats across its container.
 */
export function Awning({ height = 56, stripe = 24, className, tone = 'coral' }: { height?: number; stripe?: number; className?: string; tone?: 'coral' | 'teal' }) {
  const fill = tone === 'coral' ? 'var(--coral)' : 'var(--teal)'
  const id = `awning-${tone}-${stripe}-${height}`
  const r = stripe / 2
  const edge = height - r
  return (
    <svg className={className} width="100%" height={height} aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <pattern id={id} width={stripe * 2} height={height} patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width={stripe} height={edge} style={{ fill }} />
          <rect x={stripe} y="0" width={stripe} height={edge} style={{ fill: 'var(--card)' }} />
          <path d={`M0 ${edge} A${r} ${r} 0 0 0 ${stripe} ${edge} Z`} style={{ fill, stroke: 'var(--ink)' }} strokeWidth="2" strokeLinejoin="round" />
          <path d={`M${stripe} ${edge} A${r} ${r} 0 0 0 ${stripe * 2} ${edge} Z`} style={{ fill: 'var(--card)', stroke: 'var(--ink)' }} strokeWidth="2" strokeLinejoin="round" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height={height} fill={`url(#${id})`} />
      <rect x="0" y="0" width="100%" height="2" style={{ fill: 'var(--ink)' }} />
    </svg>
  )
}
