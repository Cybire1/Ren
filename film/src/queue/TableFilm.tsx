/**
 * "Every table is a counter": a 34-second film. A café queue filmed like a commercial (Higgsfield
 * Soul stills animated with Seedance 2.0, public/queue/hf/), the real Kova screens from a real run
 * at Ada's Bakery on Monad testnet (public/spot/*.png, run.json), and one line at the end.
 *
 *   0.0  the buzzer: its lights go dark. "8:02. Still waiting."
 *   5.0  the queue along the counter, the tables empty. "The tables are empty. The queue isn't."
 *  10.0  paper: "What if every table was the counter?"
 *  12.5  table 3: she scans, pays from the table in 0.76 s, her coffee comes to her
 *  19.0  the stamp card: the sixth is on the house, paid $0.00, a receipt on Monad
 *  24.0  the café, full and easy. "No queue. No buzzer. No card machine."
 *  29.5  Every table is a counter. Kova.
 */
import type React from 'react'
import { AbsoluteFill, Html5Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion'
import run from '../../public/spot/run.json'
import { Mark } from '../atm/Textures'
import { IPhone } from '../iphone'
import { mix, span } from '../motion'
import { bounce, CORAL, FPS, hero, INK, SURFACE } from '../os/ui/kit'
import { Grain } from '../parts'

export const TABLE_DURATION = 34
const ui: React.CSSProperties = { fontFamily: 'Manrope' }
const rise = (t: number, at: number, d = 0.5) => hero(span(t, at, at + d))
const PAPER = '#ebe6dc'

/** A filmed shot, a touch bigger than the frame and drifting, so the cut never sits still. */
function Clip({ src, from, dur, t, push = 0.05, x = 0 }: { src: string; from: number; dur: number; t: number; push?: number; x?: number }) {
  const p = span(t, from, from + dur)
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Sequence from={Math.round(from * FPS)} durationInFrames={Math.round(dur * FPS)} layout="none">
        <OffthreadVideo src={staticFile(src)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.04 + push * p}) translateX(${x * p}px)`, filter: 'saturate(0.92) contrast(1.04)' }} />
      </Sequence>
    </AbsoluteFill>
  )
}

/** Small words in the lower left, the way a film titles a place. */
function Caption({ t, at, out, text }: { t: number; at: number; out: number; text: string }) {
  const show = rise(t, at, 0.6) * (1 - span(t, out - 0.4, out))
  if (show <= 0) return null
  return (
    <div style={{ ...ui, position: 'absolute', left: 90, bottom: 86, color: '#fff', fontSize: 46, fontWeight: 700, letterSpacing: -1, textShadow: '0 2px 24px rgba(0,0,0,0.45)', opacity: show, transform: `translateY(${(1 - show) * 16}px)` }}>
      {text}
    </div>
  )
}

/** Words that arrive one at a time on paper; a newline starts a new line. */
function Words({ t, at, text, size = 92 }: { t: number; at: number; text: string; size?: number }) {
  let n = 0
  return (
    <div style={{ ...ui, fontSize: size, fontWeight: 800, letterSpacing: -size * 0.04, lineHeight: 1.04, color: INK, textAlign: 'center' }}>
      {text.split('\n').map((line, l) => (
        <div key={l} style={{ whiteSpace: 'nowrap' }}>
          {line.split(' ').map((w, i) => {
            const s = rise(t, at + n++ * 0.13, 0.45)
            return (
              <span key={i} style={{ display: 'inline-block', marginRight: size * 0.24, opacity: s, transform: `translateY(${(1 - s) * 30}px)`, filter: `blur(${(1 - s) * 8}px)` }}>
                {w}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** A chip that pops onto the frame with a number from the real run. */
function Chip({ t, at, out, text, x, y, tone = CORAL }: { t: number; at: number; out: number; text: string; x: number; y: number; tone?: string }) {
  const show = (t >= at ? 1 : 0) * (1 - span(t, out - 0.3, out))
  if (show <= 0) return null
  const pop = bounce(t, at)
  return (
    <div style={{ ...ui, position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${0.6 + 0.4 * pop})`, opacity: show, fontSize: 38, fontWeight: 800, color: '#fff', background: tone, padding: '16px 30px', borderRadius: 999, border: `4px solid ${INK}`, whiteSpace: 'nowrap', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
      {text}
    </div>
  )
}

export function TableFilm({ sound = true }: { sound?: boolean }) {
  const frame = useCurrentFrame()
  const t = frame / FPS
  // Table 3: the phone comes in over her shot and plays the real screens.
  const phone = rise(t, 13.0, 0.7) * (1 - span(t, 18.4, 19.0))
  const screen = t < 15.9 ? 'spot/stall-table.png' : 'spot/ready.png'
  const tap = span(t, 14.3, 14.7)
  // The stamp card on paper, then the free order on the phone.
  const stamps = Array.from({ length: run.every }, (_, i) => 19.5 + i * 0.32)
  const free = rise(t, 21.6, 0.6)
  return (
    <AbsoluteFill style={{ background: '#111' }}>
      {t < 5.0 ? <Clip src="queue/hf/v1.mp4" from={0} dur={5.0} t={t} push={0.06} /> : null}
      {t >= 5.0 && t < 10.0 ? <Clip src="queue/hf/v2.mp4" from={5.0} dur={5.0} t={t} push={0.03} x={-40} /> : null}
      {t >= 12.5 && t < 19.0 ? <Clip src="queue/hf/v3.mp4" from={12.5} dur={6.5} t={t} push={0.05} /> : null}
      {t >= 24.0 && t < 29.6 ? <Clip src="queue/hf/v4.mp4" from={24.0} dur={5.6} t={t} push={0.05} /> : null}

      <Caption t={t} at={0.8} out={4.9} text="8:02. Still waiting." />
      <Caption t={t} at={5.6} out={9.9} text="The tables are empty. The queue isn't." />

      {t >= 10.0 && t < 12.5 ? (
        <AbsoluteFill style={{ background: PAPER, alignItems: 'center', justifyContent: 'center' }}>
          <Words t={t} at={10.15} text={"What if every table\nwas the counter?"} size={100} />
        </AbsoluteFill>
      ) : null}

      {phone > 0 ? (
        <IPhone src={screen} h={820} x={mix(2300, 1430, phone)} y={540} rotate={mix(8, -3, phone)} ry={-10}>
          {tap > 0 && tap < 1 ? <div style={{ position: 'absolute', left: 590 - 320 * tap, top: 1180 - 320 * tap, width: 640 * tap, height: 640 * tap, borderRadius: '50%', border: `18px solid ${CORAL}`, opacity: 1 - tap }} /> : null}
        </IPhone>
      ) : null}
      <Chip t={t} at={14.8} out={16.6} text={`Paid from table ${run.table} · ${run.seconds} s`} x={660} y={250} />
      <Chip t={t} at={16.1} out={18.6} text="Your order is ready" x={660} y={250} tone={INK} />

      {t >= 19.0 && t < 24.0 ? (
        <AbsoluteFill style={{ background: PAPER }}>
          <div style={{ position: 'absolute', left: 140, top: 250, width: 980 }}>
            <Words t={t} at={19.1} text={"Buy five.\nThe sixth is on the house."} size={76} />
            <div style={{ display: 'flex', gap: 24, marginTop: 56, justifyContent: 'center' }}>
              {stamps.map((at, i) => (
                <div key={i} style={{ width: 120, height: 120, borderRadius: 60, border: `4px ${t >= at ? 'solid' : 'dashed'} ${INK}`, background: t >= at ? CORAL : 'transparent', transform: `scale(${t >= at ? 0.7 + 0.3 * bounce(t, at) : 1})` }} />
              ))}
              <div style={{ ...ui, width: 120, height: 120, borderRadius: 60, border: `4px solid ${INK}`, background: t >= 21.4 ? '#edc354' : SURFACE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, transform: `scale(${t >= 21.4 ? 0.8 + 0.2 * bounce(t, 21.4) : 1})` }}>Free</div>
            </div>
            <div style={{ ...ui, fontSize: 34, fontWeight: 600, color: '#566568', textAlign: 'center', marginTop: 40, opacity: rise(t, 22.2) }}>No sign-up. Your wallet is the card.</div>
          </div>
          {free > 0 ? <IPhone src="spot/free.png" h={760} x={mix(2300, 1520, free)} y={540} rotate={mix(8, -3, free)} ry={-10} /> : null}
          <Chip t={t} at={22.6} out={24.0} text="Paid $0.00 · still a receipt on Monad" x={1520} y={140} tone={INK} />
        </AbsoluteFill>
      ) : null}

      <Caption t={t} at={24.6} out={29.5} text="No queue. No buzzer. No card machine." />

      {t >= 29.5 ? (
        <AbsoluteFill style={{ background: PAPER, alignItems: 'center', justifyContent: 'center' }}>
          <Words t={t} at={29.6} text="Every table is a counter." size={104} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginTop: 50, opacity: rise(t, 31.0, 0.6) }}>
            <Mark h={72} />
            <span style={{ ...ui, fontSize: 38, fontWeight: 800, color: INK, padding: '10px 30px', borderRadius: 999, border: `4px solid ${INK}`, background: SURFACE }}>mykova.app</span>
          </div>
          <div style={{ ...ui, fontSize: 26, fontWeight: 600, color: '#566568', marginTop: 26, opacity: rise(t, 31.6, 0.6) }}>Order and pay from the table. Live on Monad.</div>
        </AbsoluteFill>
      ) : null}

      <Grain frame={frame} />
      <AbsoluteFill style={{ background: '#000', opacity: 1 - span(t, 0, 0.6) + span(t, TABLE_DURATION - 0.7, TABLE_DURATION), pointerEvents: 'none' }} />
      {sound ? <Html5Audio src={staticFile('queue/hf/sound.wav')} /> : null}
    </AbsoluteFill>
  )
}
