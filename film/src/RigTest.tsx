import { AbsoluteFill, Img, staticFile } from 'remotion'
import { KoviRig } from './KoviRig'

export function RigTest() {
  return (
    <AbsoluteFill style={{ background: '#e7e5e0' }}>
      <Img src={staticFile('art/kovi-wave.png')} style={{ position: 'absolute', left: 0, top: 40, width: 380, height: 380 }} />
      <KoviRig x={570} y={40 + 912 * (380 / 1024)} size={380} />
      <KoviRig x={950} y={40 + 912 * (380 / 1024)} size={380} pose={{ blink: 1, mouth: 'grin', armL: -70, armR: 120 }} />
      <KoviRig x={1330} y={40 + 912 * (380 / 1024)} size={380} pose={{ happy: 1, mouth: 'smile', armL: -10, armR: 180, waveLines: 1, blush: 1 }} />
      <KoviRig x={1710} y={40 + 912 * (380 / 1024)} size={380} pose={{ mouth: 'o', armL: -150, armR: 150, look: { x: 1, y: -0.5 }, sy: 1.15, sx: 0.9 }} />
      <KoviRig x={380} y={900} size={380} pose={{ crouch: 1, sy: 0.85, sx: 1.12, mouth: 'ooh', look: { x: -1, y: 0.3 } }} />
      <KoviRig x={760} y={900} size={380} pose={{ lean: -12, armL: -40, bendL: 1, armR: 150, bendR: -1, look: { x: -1, y: 0 } }} />
    </AbsoluteFill>
  )
}
