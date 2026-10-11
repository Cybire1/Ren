/** The Register's rail, from the Kova POS design. */
import { INK, SURFACE } from './kit'

const NAV = [
  { label: 'Sell', icon: 'M5 12h3l2-6 4 12 2-6h3' },
  { label: 'Orders', icon: 'M6 4h12l-1 16H7zM9 8h6', count: '3' },
  { label: 'Products', icon: 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10' },
  { label: 'Today', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { label: 'Online', icon: 'M3 9l2-5h14l2 5M4 9v11h16V9M3 9h18M9 20v-6h6v6' },
]

export function Rail({ active, orders = '3' }: { active: string; orders?: string }) {
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 104, background: INK, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '22px 0', gap: 6, boxSizing: 'border-box' }}>
      <div style={{ width: 60, height: 60, borderRadius: 30, background: '#EBB3AA', border: '3px solid #E8C15A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, marginBottom: 18, color: INK }}>A</div>
      {NAV.map((n) => {
        const on = n.label === active
        const color = on ? INK : '#A7B8B9'
        const count = n.label === 'Orders' ? orders : undefined
        return (
          <div key={n.label} style={{ position: 'relative', width: 84, height: 72, borderRadius: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, background: on ? SURFACE : 'transparent', color }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{n.label}</span>
            {count ? (
              <span style={{ position: 'absolute', top: 6, right: 12, minWidth: 22, height: 22, padding: '0 5px', boxSizing: 'border-box', borderRadius: 11, background: '#D46558', border: `2px solid ${INK}`, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
            ) : null}
          </div>
        )
      })}
      <div style={{ flex: 1 }} />
      <div style={{ width: 44, height: 44, borderRadius: 22, background: '#A9C9C9', color: INK, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>AD</div>
    </div>
  )
}
