/**
 * Flat art for the toy café in "The Queue": the queue's sign (both faces), the counter's banner and
 * each table's card. Rendered once to public/queue/*.png (scripts/queue-art.sh) and used as textures.
 */
import { AbsoluteFill, Img, staticFile } from 'remotion'
import { Mark } from '../atm/Textures'
import { CORAL, IMG, INK, SURFACE, TEAL } from '../os/ui/kit'

export type QueueArtKind = 'wait' | 'sit' | 'banner' | 'tent'

export function QueueArt({ kind, n = 3 }: { kind: QueueArtKind; n?: number }) {
  const ui = { fontFamily: 'Manrope', color: INK }
  if (kind === 'wait' || kind === 'sit')
    return (
      <AbsoluteFill style={{ ...ui, background: kind === 'wait' ? INK : TEAL, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: -4, lineHeight: 0.92, whiteSpace: 'pre-line', color: kind === 'wait' ? '#fff' : INK }}>{kind === 'wait' ? 'WAIT\nHERE' : 'SIT\nANYWHERE'}</div>
        <div style={{ fontSize: 46, fontWeight: 700, marginTop: 30, color: kind === 'wait' ? '#a7b8b9' : INK }}>{kind === 'wait' ? 'Pay at the counter only' : 'Every table is a counter'}</div>
      </AbsoluteFill>
    )
  if (kind === 'banner')
    return (
      <AbsoluteFill style={{ ...ui, background: CORAL, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: 6, color: '#fff' }}>ORDER &amp; PAY HERE</div>
      </AbsoluteFill>
    )
  return (
    <AbsoluteFill style={{ ...ui, background: SURFACE, flexDirection: 'row', alignItems: 'center', padding: 50, gap: 40 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 44, fontWeight: 700, color: CORAL, letterSpacing: 2 }}>TABLE</div>
        <div style={{ fontSize: 330, fontWeight: 800, lineHeight: 0.85, letterSpacing: -14 }}>{n}</div>
        <div style={{ marginTop: 26 }}>
          <Mark h={52} />
        </div>
      </div>
      <div style={{ width: 380, height: 380, padding: 22, borderRadius: 36, border: `8px solid ${INK}`, background: '#fff' }}>
        <Img src={staticFile(IMG.qr)} style={{ width: '100%', height: '100%' }} />
      </div>
    </AbsoluteFill>
  )
}
