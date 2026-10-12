/**
 * The card on a café table: the table's number and its QR code (the stall link with ?table=3).
 * Rendered to public/spot/tent.png and used as the 3D tent's face in the spot.
 */
import { AbsoluteFill, Img, staticFile } from 'remotion'
import { Mark } from '../atm/Textures'
import { CORAL, IMG, INK, SURFACE } from '../os/ui/kit'
import run from '../../public/spot/run.json'

export function TableTent() {
  return (
    <AbsoluteFill style={{ background: SURFACE, fontFamily: 'Manrope', color: INK, padding: 70, flexDirection: 'row', alignItems: 'center', gap: 60 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 46, fontWeight: 700, color: CORAL, letterSpacing: 2 }}>TABLE</div>
        <div style={{ fontSize: 420, fontWeight: 800, lineHeight: 0.85, letterSpacing: -18 }}>{run.table}</div>
        <div style={{ fontSize: 44, fontWeight: 700, marginTop: 30, lineHeight: 1.15 }}>Scan to order and pay. No queue.</div>
        <div style={{ marginTop: 40 }}>
          <Mark h={56} />
        </div>
      </div>
      <div style={{ width: 400, height: 400, padding: 26, borderRadius: 40, border: `8px solid ${INK}`, background: '#fff' }}>
        <Img src={staticFile(IMG.qr)} style={{ width: '100%', height: '100%' }} />
      </div>
    </AbsoluteFill>
  )
}
