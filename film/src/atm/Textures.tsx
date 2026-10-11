/**
 * Flat artwork for Kova Point, the 3D ATM: rendered once to PNGs (scripts/atm-textures.sh) and
 * mapped onto the model: its screen states, the lit sign, the front decal, and the real Kova Card
 * faces from src/cards/markup.json.
 */
import { useMemo } from 'react'
import { AbsoluteFill, Img, staticFile } from 'remotion'
import markup from '../cards/markup.json'
import { C } from '../theme'

const ink = C.ink
const paper = '#f4f2ed'
const coral = '#d9573f'
const teal = '#a9c9c9'
const font: React.CSSProperties = { fontFamily: 'Manrope', color: ink }

/** Kova's mark and wordmark, in any colour. */
export function Mark({ h, color = ink, accent = coral, word = true }: { h: number; color?: string; accent?: string; word?: boolean }) {
  const line = { stroke: color, strokeWidth: 15.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: h * 0.18 }}>
      <svg width={h} height={h} viewBox="0 0 200 200">
        <path d="M62 46 V154" stroke={color} strokeWidth={19} strokeLinecap="round" />
        {['M92.6 74.3 A40 40 0 0 1 92.6 125.7', 'M115.6 55 A70 70 0 0 1 115.6 145', 'M138.6 35.7 A100 100 0 0 1 138.6 164.3'].map((d) => (
          <path key={d} d={d} stroke={accent} strokeWidth={17} strokeLinecap="round" fill="none" />
        ))}
      </svg>
      {word ? (
        <svg width={(h * 0.6 * 252) / 100} height={h * 0.6} viewBox="0 0 252 100">
          <path d="M8 8 V92" {...line} />
          <path d="M12 70 L40 38" {...line} />
          <path d="M26 56 L44 92" {...line} />
          <circle cx={86} cy={65} r={27} fill={C.coralSoft} stroke={color} strokeWidth={15.5} />
          <path d="M130 40 L150 92 L170 40" {...line} />
          <circle cx={212} cy={66} r={26} {...line} />
          <path d="M238 40 V92" {...line} />
        </svg>
      ) : null}
    </div>
  )
}

function Contactless({ size, color = ink }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="11" cy="20" r="3.6" fill={color} />
      <path d="M18 11 a12 12 0 0 1 0 18 M24.5 6 a19 19 0 0 1 0 28" fill="none" stroke={color} strokeWidth="3.6" strokeLinecap="round" />
    </svg>
  )
}

const pill = (bg: string, fg = ink): React.CSSProperties => ({
  ...font,
  fontWeight: 800,
  fontSize: 34,
  padding: '12px 26px',
  borderRadius: 999,
  border: `6px solid ${ink}`,
  background: bg,
  color: fg,
})

/** The ATM's screen, 1200 × 900, in the Kova app's own look. */
export function AtmScreen({ screen = 'tap' }: { screen?: 'tap' | 'menu' | 'send' | 'done' | 'cash' }) {
  return (
    <AbsoluteFill style={{ background: screen === 'done' ? teal : paper, ...font, padding: 70, boxSizing: 'border-box' }}>
      {screen === 'tap' ? (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 34 }}>
          <div style={{ width: 300, height: 300, borderRadius: 150, background: teal, border: `12px solid ${ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Contactless size={170} />
          </div>
          <div style={{ fontSize: 86, fontWeight: 800, letterSpacing: -3 }}>Tap your Kova card</div>
          <div style={{ fontSize: 40, fontWeight: 600, opacity: 0.75 }}>or your phone, or scan the code</div>
          <div style={{ display: 'flex', gap: 22, marginTop: 10 }}>
            <span style={pill(paper)}>Cash in</span>
            <span style={pill(paper)}>Cash out</span>
            <span style={pill(coral, '#fff')}>Send anywhere</span>
          </div>
        </AbsoluteFill>
      ) : null}
      {screen === 'menu' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36, height: '100%' }}>
          <div style={{ background: teal, border: `8px solid ${ink}`, borderRadius: 48, padding: '30px 44px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 38, fontWeight: 700 }}>Hi Ada</div>
              <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -5, lineHeight: 1 }}>$240.00</div>
            </div>
            <Img src={staticFile('art/coin-usd.png')} style={{ width: 170, height: 170 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, flexGrow: 1 }}>
            {[
              ['Take cash', paper, ink],
              ['Add cash', paper, ink],
              ['Send anywhere', coral, '#fff'],
              ['Pay a shop', paper, ink],
            ].map(([label, bg, fg]) => (
              <div key={label} style={{ border: `8px solid ${ink}`, borderRadius: 40, background: bg, color: fg, fontSize: 56, fontWeight: 800, padding: '28px 36px', letterSpacing: -1.5 }}>
                {label}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {screen === 'send' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, height: '100%' }}>
          <div style={{ fontSize: 40, fontWeight: 700, opacity: 0.7 }}>Send anywhere</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <div style={{ width: 120, height: 120, borderRadius: 60, background: C.coralSoft, border: `8px solid ${ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, fontWeight: 800 }}>L</div>
            <div>
              <div style={{ fontSize: 60, fontWeight: 800 }}>Lena</div>
              <div style={{ fontSize: 36, fontWeight: 600, opacity: 0.7 }}>Berlin · gets euros</div>
            </div>
          </div>
          <div style={{ fontSize: 190, fontWeight: 800, letterSpacing: -9, lineHeight: 1 }}>$50.00</div>
          <div style={{ fontSize: 40, fontWeight: 700, opacity: 0.75 }}>Arrives as about €44.27 · fee $0.00</div>
          <div style={{ marginTop: 'auto', background: ink, color: paper, borderRadius: 40, padding: '30px 40px', fontSize: 52, fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>
            Press ✓ to send <span>→</span>
          </div>
        </div>
      ) : null}
      {screen === 'done' ? (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <Img src={staticFile('art/kovi-cheer.png')} style={{ width: 320, height: 320 }} />
          <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -5, lineHeight: 1 }}>Sent!</div>
          <div style={{ fontSize: 46, fontWeight: 700 }}>$50.00 to Lena, in Berlin</div>
          <div style={{ display: 'flex', gap: 22, marginTop: 10 }}>
            <span style={pill(paper)}>Final in 0.9 s</span>
            <span style={pill(paper)}>Fee $0.00</span>
          </div>
        </AbsoluteFill>
      ) : null}
      {screen === 'cash' ? (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22, height: '100%' }}>
          <div style={{ fontSize: 44, fontWeight: 700, opacity: 0.7 }}>Take your cash</div>
          <div style={{ fontSize: 230, fontWeight: 800, letterSpacing: -10, lineHeight: 1 }}>$40.00</div>
          <div style={{ fontSize: 40, fontWeight: 600, opacity: 0.75 }}>From your Kova dollars. Your receipt is in the app.</div>
          <div style={{ fontSize: 46, fontWeight: 800, marginTop: 20 }}>Below the screen ↓</div>
        </div>
      ) : null}
    </AbsoluteFill>
  )
}

/** The lit sign on top: 1600 × 400. */
export function AtmSign() {
  return (
    <AbsoluteFill style={{ background: ink, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row', padding: '0 110px', ...font }}>
      <Mark h={250} color={paper} />
      <div style={{ textAlign: 'right', color: teal }}>
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: 10 }}>POINT</div>
        <div style={{ fontSize: 50, fontWeight: 600 }}>cash · send · pay</div>
      </div>
    </AbsoluteFill>
  )
}

/** The lower front panel: 1000 × 640. */
export function AtmDecal() {
  return (
    <AbsoluteFill style={{ background: '#fbfaf7', ...font, padding: 60, boxSizing: 'border-box', flexDirection: 'row', gap: 50 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexGrow: 1 }}>
        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02 }}>Cash in.</div>
        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02 }}>Cash out.</div>
        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02, color: coral }}>Send anywhere.</div>
        <div style={{ fontSize: 40, fontWeight: 600, marginTop: 'auto', opacity: 0.8 }}>No data? Dial *384*25891#</div>
      </div>
      <div style={{ width: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <Img src={staticFile('art/qr-ink.png')} style={{ width: 300, height: 300, borderRadius: 26, border: `8px solid ${ink}` }} />
        <div style={{ fontSize: 38, fontWeight: 700 }}>scan me</div>
        <Img src={staticFile('art/kovi-peek.png')} style={{ width: 260, height: 130, marginTop: 'auto' }} />
      </div>
    </AbsoluteFill>
  )
}

/** The tap pad's face: 600 × 600. */
export function AtmTapPad() {
  return (
    <AbsoluteFill style={{ background: teal, alignItems: 'center', justifyContent: 'center', gap: 30, ...font }}>
      <div style={{ width: 300, height: 300, borderRadius: 150, background: paper, border: `14px solid ${ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Contactless size={190} />
      </div>
      <div style={{ fontSize: 56, fontWeight: 800 }}>Tap card or phone</div>
    </AbsoluteFill>
  )
}

/** One key cap: 256 × 256. */
export function AtmKey({ label = '1', tone = 'paper' }: { label?: string; tone?: 'paper' | 'coral' | 'teal' }) {
  const bg = tone === 'coral' ? coral : tone === 'teal' ? '#46878b' : paper
  return (
    <AbsoluteFill style={{ background: bg, alignItems: 'center', justifyContent: 'center', ...font, color: tone === 'paper' ? ink : '#fff', fontSize: 150, fontWeight: 800 }}>
      {label}
    </AbsoluteFill>
  )
}

type CardId = keyof typeof markup

/** A real Kova Card face, from the card designs. */
export function CardFront({ id = 'main' }: { id?: CardId }) {
  const m = markup[id]
  const html = useMemo(() => m.html.replace(/\{\{art\}\}([\w.-]+)/g, (_, f: string) => staticFile(`art/${f}`)), [m.html])
  return (
    <AbsoluteFill style={{ background: 'transparent' }}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the card designs are our own markup, imported at build time */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </AbsoluteFill>
  )
}

export const CARD_SIZE = { main: markup.main, back: markup.back }

/** A thermal receipt from a Kova Terminal: 600 × 1500. Grey-black print on warm paper. */
export function TerminalReceipt() {
  const line: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: 40, fontWeight: 600 }
  return (
    <AbsoluteFill style={{ background: '#f7f4ee', ...font, color: '#2a2f30', padding: '70px 56px', boxSizing: 'border-box', gap: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Mark h={110} color="#2a2f30" accent="#2a2f30" />
      </div>
      <div style={{ textAlign: 'center', fontSize: 46, fontWeight: 800, marginTop: 10 }}>Ada’s Bakery</div>
      <div style={{ borderTop: '5px dashed #8a8f90', margin: '10px 0' }} />
      <div style={line}>
        <span>Cinnamon bun</span>
        <span>$3.75</span>
      </div>
      <div style={{ borderTop: '5px dashed #8a8f90', margin: '10px 0' }} />
      <div style={{ ...line, fontSize: 64, fontWeight: 800 }}>
        <span>PAID</span>
        <span>$3.75</span>
      </div>
      <div style={line}>
        <span>Card fees</span>
        <span>$0.00</span>
      </div>
      <div style={line}>
        <span>Paid with</span>
        <span>Kova Card</span>
      </div>
      <div style={line}>
        <span>Settled in</span>
        <span>AUSD on Monad</span>
      </div>
      <div style={{ borderTop: '5px dashed #8a8f90', margin: '10px 0' }} />
      <div style={{ textAlign: 'center', fontSize: 38, fontWeight: 700 }}>Thank you!</div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
        <Img src={staticFile('art/kovi-peek.png')} style={{ width: 300, height: 150, filter: 'grayscale(1) contrast(1.4)' }} />
      </div>
    </AbsoluteFill>
  )
}

/** Small marks printed on the terminal's shell: 512 × 512 each. */
export function TerminalMark({ kind = 'contactless', ink: color = '#0b1a1d' }: { kind?: 'contactless' | 'wordmark'; ink?: string }) {
  return (
    <AbsoluteFill style={{ background: 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {kind === 'contactless' ? <Contactless size={420} color={color} /> : <Mark h={150} color={color} />}
    </AbsoluteFill>
  )
}

/** Android status bar for the terminal screens. */
function TerminalStatus({ dark = false }: { dark?: boolean }) {
  const c = dark ? paper : ink
  return (
    <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 44px', ...font, color: c, fontSize: 30, fontWeight: 700 }}>
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true">
          <path d="M2 9 a22 22 0 0 1 30 0 M7 14 a14 14 0 0 1 20 0 M12 19 a7 7 0 0 1 10 0" fill="none" stroke={c} strokeWidth="3.4" strokeLinecap="round" />
        </svg>
        <span style={{ width: 46, height: 22, border: `3px solid ${c}`, borderRadius: 6, padding: 3, boxSizing: 'border-box' }}>
          <span style={{ display: 'block', width: '78%', height: '100%', background: c, borderRadius: 2 }} />
        </span>
      </span>
    </div>
  )
}

/**
 * Kova Terminal's own screens, 900 × 1800 (1:2): the charge keypad, the tap screen (its arrow
 * points up at the reader above the screen), and Paid.
 */
export function TerminalScreen({ screen = 'charge' }: { screen?: 'keypad' | 'charge' | 'paid' }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']
  if (screen === 'keypad')
    return (
      <AbsoluteFill style={{ background: paper, ...font }}>
        <TerminalStatus />
        <div style={{ padding: '10px 54px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 40, fontWeight: 800 }}>Ada’s Bakery</div>
          <div style={{ fontSize: 28, fontWeight: 700, padding: '10px 20px', borderRadius: 999, background: teal }}>Till 1</div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 90 }}>
          <div style={{ fontSize: 34, fontWeight: 600, opacity: 0.6 }}>Charge</div>
          <div style={{ fontSize: 210, fontWeight: 800, letterSpacing: -10, lineHeight: 1.05 }}>$3.75</div>
          <div style={{ display: 'inline-block', marginTop: 16, fontSize: 32, fontWeight: 700, padding: '12px 26px', borderRadius: 999, border: `5px solid ${ink}` }}>Cinnamon bun</div>
        </div>
        <div style={{ position: 'absolute', left: 54, right: 54, bottom: 240, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
          {keys.map((k) => (
            <div key={k} style={{ height: 150, borderRadius: 40, background: '#e9e5dc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 70, fontWeight: 700 }}>
              {k}
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 54, right: 54, bottom: 70, height: 140, borderRadius: 70, background: coral, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, fontWeight: 800 }}>
          Charge $3.75
        </div>
      </AbsoluteFill>
    )
  if (screen === 'charge')
    return (
      <AbsoluteFill style={{ background: teal, ...font }}>
        <TerminalStatus />
        {/* The reader is above the screen: point at it. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 40, gap: 20 }}>
          <svg width="150" height="120" viewBox="0 0 150 120" aria-hidden="true">
            <path d="M75 108 V20 M30 62 L75 16 L120 62" fill="none" stroke={ink} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 66, fontWeight: 800, letterSpacing: -2 }}>Tap card here</div>
          <div style={{ fontSize: 32, fontWeight: 600, opacity: 0.75 }}>Kova Card, phone or watch</div>
        </div>
        <div style={{ margin: '70px 54px 0', padding: '50px 46px', borderRadius: 60, background: paper, border: `6px solid ${ink}` }}>
          <div style={{ fontSize: 34, fontWeight: 700, opacity: 0.6 }}>Ada’s Bakery</div>
          <div style={{ fontSize: 200, fontWeight: 800, letterSpacing: -10, lineHeight: 1 }}>$3.75</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 36, fontWeight: 600, marginTop: 22 }}>
            <span>Cinnamon bun</span>
            <span>1 ×</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34, margin: '60px 54px 0' }}>
          <Img src={staticFile('art/qr-ink.png')} style={{ width: 220, height: 220, borderRadius: 30, border: `6px solid ${ink}`, background: paper }} />
          <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.3 }}>
            No card?
            <br />
            Scan to pay from any Kova or Monad wallet.
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 80, textAlign: 'center', fontSize: 36, fontWeight: 700, textDecoration: 'underline' }}>Cancel</div>
      </AbsoluteFill>
    )
  return (
    <AbsoluteFill style={{ background: paper, ...font }}>
      <TerminalStatus />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 70 }}>
        <div style={{ width: 360, height: 360, borderRadius: 180, background: teal, border: `8px solid ${ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Img src={staticFile('art/kovi-cheer.png')} style={{ width: 300, height: 300 }} />
        </div>
        <div style={{ fontSize: 190, fontWeight: 800, letterSpacing: -8, marginTop: 40, lineHeight: 1 }}>Paid</div>
        <div style={{ fontSize: 56, fontWeight: 700, marginTop: 14 }}>$3.75 · Cinnamon bun</div>
      </div>
      <div style={{ margin: '70px 54px 0', borderRadius: 50, border: `6px solid ${ink}`, background: '#fbfaf7', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
        {[
          ['Took', '0.9 s'],
          ['Card fees', '$0.00'],
          ['With', 'Kova Card'],
        ].map(([k, v], i) => (
          <div key={k} style={{ padding: '34px 10px', textAlign: 'center', borderLeft: i ? `4px solid ${ink}` : 'none' }}>
            <div style={{ fontSize: 30, fontWeight: 600, opacity: 0.6 }}>{k}</div>
            <div style={{ fontSize: 42, fontWeight: 800, marginTop: 6 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ margin: '40px 54px 0', display: 'flex', alignItems: 'center', gap: 18, fontSize: 36, fontWeight: 700 }}>
        <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v6H7zM5 9h14a2 2 0 0 1 2 2v6h-4v4H7v-4H3v-6a2 2 0 0 1 2-2z" fill="none" stroke={ink} strokeWidth="2" strokeLinejoin="round" /></svg>
        Printing the receipt
      </div>
      <div style={{ position: 'absolute', left: 54, right: 54, bottom: 70, height: 140, borderRadius: 70, background: ink, color: paper, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50, fontWeight: 800 }}>
        Next sale →
      </div>
    </AbsoluteFill>
  )
}
