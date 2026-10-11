/**
 * Product photos for the Kova Store (a testnet shop for trying Kova): Kovi things drawn in Kova's
 * sticker style on a soft tile, 600 × 600 each, plus a menu card to photograph with "Snap your menu".
 */
import { AbsoluteFill, Img, staticFile } from 'remotion'

const INK = '#0b1a1d'
const s = { stroke: INK, strokeWidth: 10, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

export type MerchKind = 'stickers' | 'mug' | 'tote' | 'tee' | 'pin' | 'card'

const TILE: Record<MerchKind, string> = {
  stickers: '#f3dfb8',
  mug: '#d9e6e2',
  tote: '#f1d3c6',
  tee: '#d6e4ec',
  pin: '#efe1c4',
  card: '#e4dcef',
}

const kovi = (pose: string) => staticFile(`art/kovi-${pose}.png`)

export function MerchArt({ kind }: { kind: MerchKind }) {
  return (
    <AbsoluteFill style={{ background: TILE[kind] }}>
      <svg width="600" height="600" viewBox="0 0 600 600" style={{ position: 'absolute', inset: 0 }}>
        <ellipse cx="300" cy="500" rx="200" ry="26" fill={INK} opacity="0.12" />
        {kind === 'mug' ? (
          <g>
            <path d="M455 250 C540 250 540 400 455 400" fill="none" {...s} strokeWidth={26} />
            <path d="M455 250 C540 250 540 400 455 400" fill="none" stroke="#f7f4ee" strokeWidth={10} strokeLinecap="round" />
            <path d="M140 170 H460 V430 Q460 490 400 490 H200 Q140 490 140 430 Z" fill="#f7f4ee" {...s} />
            <ellipse cx="300" cy="170" rx="160" ry="24" fill="#5b3b2a" {...s} />
          </g>
        ) : null}
        {kind === 'tote' ? (
          <g>
            <path d="M220 200 C220 90 380 90 380 200" fill="none" {...s} strokeWidth={22} />
            <path d="M220 200 C220 90 380 90 380 200" fill="none" stroke="#e9dcc3" strokeWidth={8} strokeLinecap="round" />
            <path d="M130 200 H470 L450 495 H150 Z" fill="#e9dcc3" {...s} />
          </g>
        ) : null}
        {kind === 'tee' ? (
          <path d="M215 110 Q300 160 385 110 L500 170 L460 260 L415 240 V495 H185 V240 L140 260 L100 170 Z" fill="#f7f4ee" {...s} />
        ) : null}
        {kind === 'stickers' ? (
          <g>
            <rect x="120" y="110" width="360" height="380" rx="28" fill="#f7f4ee" {...s} transform="rotate(-4 300 300)" />
          </g>
        ) : null}
        {kind === 'pin' ? <circle cx="300" cy="290" r="185" fill="#d46558" {...s} /> : null}
        {kind === 'card' ? null : null}
      </svg>
      {kind === 'mug' ? <Img src={kovi('cheer')} style={{ position: 'absolute', left: 205, top: 235, width: 190, height: 190 }} /> : null}
      {kind === 'tote' ? <Img src={kovi('wave')} style={{ position: 'absolute', left: 190, top: 240, width: 220, height: 220 }} /> : null}
      {kind === 'tee' ? <Img src={kovi('ride')} style={{ position: 'absolute', left: 190, top: 220, width: 220, height: 220 }} /> : null}
      {kind === 'pin' ? <Img src={kovi('cheer')} style={{ position: 'absolute', left: 150, top: 135, width: 300, height: 300, filter: 'drop-shadow(0 0 0 #fff)' }} /> : null}
      {kind === 'stickers' ? (
        <>
          <Img src={kovi('wave')} style={{ position: 'absolute', left: 135, top: 125, width: 180, height: 180, transform: 'rotate(-10deg)' }} />
          <Img src={kovi('cheer')} style={{ position: 'absolute', left: 300, top: 135, width: 170, height: 170, transform: 'rotate(8deg)' }} />
          <Img src={kovi('ride')} style={{ position: 'absolute', left: 130, top: 300, width: 190, height: 190, transform: 'rotate(6deg)' }} />
          <Img src={kovi('key')} style={{ position: 'absolute', left: 310, top: 300, width: 170, height: 170, transform: 'rotate(-6deg)' }} />
        </>
      ) : null}
      {kind === 'card' ? <Img src={staticFile('atm/card-main.png')} style={{ position: 'absolute', left: 190, top: 75, width: 220, height: 349, transform: 'rotate(-8deg)', filter: 'drop-shadow(10px 12px 0 rgba(11,26,29,0.9))' }} /> : null}
    </AbsoluteFill>
  )
}

export const MERCH = [
  { kind: 'stickers', name: 'Kovi sticker pack', price: '1.00' },
  { kind: 'pin', name: 'Kovi enamel pin', price: '1.50' },
  { kind: 'card', name: 'Kova Card', price: '2.00' },
  { kind: 'mug', name: 'Kovi mug', price: '3.00' },
  { kind: 'tote', name: 'Kova tote bag', price: '4.00' },
  { kind: 'tee', name: 'Kovi tee', price: '5.00' },
] as const

/** A menu card to photograph with "Snap your menu": Kova reads it into the catalogue. */
export function MerchMenu() {
  return (
    <AbsoluteFill style={{ background: '#22302f', color: '#EDEBE4', fontFamily: 'Manrope', padding: 90, boxSizing: 'border-box', border: '24px solid #8a6a4a' }}>
      <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: 4 }}>KOVA STORE</div>
      <div style={{ fontSize: 34, fontWeight: 600, opacity: 0.8, marginTop: 8 }}>Kovi things · test dollars</div>
      <div style={{ marginTop: 60, display: 'flex', flexDirection: 'column', gap: 34 }}>
        {MERCH.map((m) => (
          <div key={m.kind} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 52, fontWeight: 700 }}>
            <span>{m.name}</span>
            <span>{m.price}</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}
