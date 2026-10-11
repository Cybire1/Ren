/**
 * "Kova OS for stores": one day at Ada's Bakery, 57 seconds at 110 BPM. Every screen is live (drawn
 * from the frame, src/os/ui and src/store/ui); the 3D Register and Terminal show the same screens
 * as frame sequences (public/os/live). Cuts land on bar lines (src/store/store-cues.json).
 *
 *   open    7:00, the door sign flips to OPEN, Kovi pops up, the camera dives into the sign
 *   title   the Register in 3D under a light streak: "Kova OS for stores"
 *   setup   Products: she snaps her chalkboard menu and it becomes the catalogue
 *   online  Noor's phone: the shop, a loaf in the bag, Pay, Paid; the order flies off the phone
 *   orders  ...and lands on the Orders board with everything else
 *   sell    the till: taps on the beat, punch in on Charge
 *   pay     round the back: a Kova Card on the reader, Paid on the customer display
 *   hand    the Terminal on teal: a sale on the floor
 *   stock   Products: cinnamon buns count down to sold out, online and in store. No voice.
 *   today   Today: $24.25 made, $2.50 kept
 *   send    her wallet: $10 to her flour mill in Italy, €9.20 there in about a second
 *   end     both devices, "Kova OS, for every store", mykova.app
 */
import { ThreeCanvas } from '@remotion/three'
import type React from 'react'
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import * as THREE from 'three'
import vo from '../../public/store/audio/vo.json'
import { Mark } from '../atm/Textures'
import { decel, mix, span } from '../motion'
import { IPhone } from '../iphone'
import { Captions, type Line } from '../parts'
import { BOUNCY, sp, Words } from '../ShopLink'
import { READER_Y } from '../terminal/KovaTerminal3D'
import { Finish } from '../terminal/TerminalShowcase'
import { C } from '../theme'
import { ease, Flat, lerp2, lerp3, reel, SellShot, type Shot3, Stage3D } from '../os/ShopOsFilm'
import { BEAT, CORAL, FPS, hero, IMG, INK, Pic, SURFACE, TEAL } from '../os/ui/kit'
import { OrdersUI } from '../os/ui/OrdersUI'
import { TodayUI } from '../os/ui/TodayUI'
import cues from './store-cues.json'
import { StoreOpen } from './StoreOpen'
import { PhoneSendUI } from './ui/PhoneSendUI'
import { H as PH, PhoneShopUI, W as PW } from './ui/PhoneShopUI'
import { ProductsUI } from './ui/ProductsUI'

export const STORE_DURATION = cues.duration
const LINES = vo.lines as Line[]
const S = cues.shots

const display: React.CSSProperties = { fontFamily: 'Manrope', fontWeight: 800, letterSpacing: -4, lineHeight: 0.98 }
const body: React.CSSProperties = { fontFamily: 'Manrope', fontWeight: 600 }

// ——— 3D ———————————————————————————————————————————————————————————————————————————

function shot3(t: number): Shot3 {
  const base = { screen: reel('RegisterReel', 0), customer: reel('CustomerReel', 0), ground: '#e9e3d8', register: true }
  if (t < S.setup) {
    const out = ease(t, S.title, S.title + 3.4)
    const dive = span(t, S.title + 3.4, S.setup) ** 2.2
    const pos = lerp3(lerp3([1.7, 1.55, 3.1], [2.3, 1.85, 5.3], out), [0, 2.04, 2.34], dive)
    const look = lerp3(lerp3([-0.45, 1.25, 0], [-0.5, 1.0, 0], out), [0, 1.42, 0.02], dive)
    return { ...base, pos, look, streak: mix(-4, 4, span(t, S.title, S.title + 3.0)) }
  }
  if (t < S.hand) {
    const rel = t - S.pay
    const fly = ease(t, cues.card[0], cues.card[1])
    const away = ease(t, cues.paid + 0.3, cues.paid + 1.2)
    const dip = t >= cues.card[1] ? Math.exp(-(t - cues.card[1]) * 7) * 0.04 : 0
    const close = t >= S.pay + 5.5 * BEAT
    const p = ease(t, close ? S.pay + 5.5 * BEAT : S.pay, close ? S.hand : S.pay + 5.5 * BEAT)
    return {
      ...base,
      customer: reel('CustomerReel', rel),
      // Low on the customer's side, facing their display, the reader in the foreground; then close on Paid.
      pos: close ? lerp3([-0.5, 1.0, -1.75], [-0.38, 1.05, -1.55], p) : lerp3([-1.75, 1.3, -3.85], [-1.55, 1.25, -3.6], p),
      look: close ? [0, 1.22, -0.06] : [-0.25, 0.8, -0.2],
      // A real-sized card comes down flat onto the reader, face up and tipped toward the customer.
      card: { at: [mix(-0.95, -0.42, fly) - 0.5 * away, mix(1.0, 0.36 - dip, fly) + 0.45 * away, mix(-0.95, -0.3, fly) - 0.5 * away], rot: [mix(-2.3, -1.87, fly), mix(-0.5, -0.08, fly), Math.PI + mix(-0.35, -0.04, fly)] },
      pulse: span(t, cues.card[1], cues.card[1] + 0.9),
      receipt: ease(t, cues.print[0], cues.print[1]),
    }
  }
  if (t < S.stock) {
    const rel = t - S.hand
    const p = ease(t, S.hand, S.stock)
    const fly = ease(t, cues.handCard[0], cues.handCard[1])
    const away = ease(t, cues.handPaid + 0.1, cues.handPaid + 0.7)
    return {
      ...base,
      register: false,
      ground: TEAL,
      pos: lerp3([0.1, 1.35, 5.4], [-0.25, 1.25, 4.9], p),
      look: [-0.6, 1.0, 0],
      terminal: {
        at: [0, 0.02, 0],
        turn: mix(-0.42, 0.12, p),
        scale: 1,
        tilt: 0,
        screen: reel('TerminalReel', rel),
        card: rel > 5 * BEAT && away < 1 ? { at: [mix(0.9, 0, fly) + 1.2 * away, mix(2.3, READER_Y + 0.12, fly) + 0.8 * away, mix(0.9, 0.22, fly) + 0.6 * away], rot: [mix(-0.5, 0, fly), mix(-0.6, 0, fly), mix(0.4, 0.05, fly)] } : null,
      },
    }
  }
  const p = ease(t, S.end, cues.duration)
  return {
    ...base,
    screen: reel('RegisterReel', 99),
    customer: reel('CustomerReel', 99),
    pos: lerp3([-3.1, 1.9, 7.3], [-2.6, 1.8, 6.8], p),
    look: [-0.95, 0.85, 0.2],
    terminal: { at: [1.3, 0, 0.75], turn: -0.5, scale: 0.62, tilt: 0, shadow: false, screen: reel('TerminalReel', 99) },
  }
}

// ——— Flat shots ——————————————————————————————————————————————————————————————————————

function SetupShot({ t }: { t: number }) {
  const rel = t - S.setup
  const land = hero(span(rel, 0, 0.9))
  const read = hero(span(rel, 1.5 * BEAT, 3 * BEAT)) * (1 - hero(span(rel, 6.5 * BEAT, 7.8 * BEAT)))
  return (
    <Flat focus={lerp2(lerp2([720, 450], [760, 440], land), [1050, 430], read)} zoom={mix(mix(1.36, 1.1, land), 1.32, read)}>
      <ProductsUI t={rel} mode="snap" />
    </Flat>
  )
}

function StockShot({ t }: { t: number }) {
  const rel = t - S.stock
  const p = hero(span(rel, 0, 1.6))
  // The cinnamon bun's row: its stock and status, close.
  return (
    <Flat focus={lerp2([700, 520], [860, 530], p)} zoom={mix(1.4, 1.5, p)}>
      <ProductsUI t={rel} mode="stock" />
    </Flat>
  )
}

function OrdersShot({ t }: { t: number }) {
  const rel = t - S.orders
  const p = ease(t, S.orders, S.sell)
  const land = hero(span(rel, 0, 0.7))
  return (
    <Flat focus={lerp2([300, 560], [620, 420], p)} zoom={mix(mix(1.7, 1.45, land), 1.15, p)}>
      <OrdersUI t={rel} taps={cues.orderTaps} />
    </Flat>
  )
}

function TodayShot({ t }: { t: number }) {
  const rel = t - S.today
  const across = hero(span(rel, 4 * BEAT, 5.5 * BEAT))
  const back = hero(span(rel, 6 * BEAT, 7.8 * BEAT))
  return (
    <Flat focus={lerp2(lerp2([500, 240], [1160, 250], across), [760, 470], back)} zoom={mix(1.85, 1.08, back)}>
      <TodayUI t={rel} />
    </Flat>
  )
}

const PHONE_H = 780
const k = PHONE_H / PH
/** A live phone screen inside the iPhone, drawn in points and scaled to the capture's pixels. */
function LivePhone({ children, x, y, ry, rx = 0, rotate = 0 }: { children: React.ReactNode; x: number; y: number; ry: number; rx?: number; rotate?: number }) {
  return (
    <IPhone h={PHONE_H} x={x} y={y} ry={ry} rx={rx} rotate={rotate}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: PW, height: PH, transform: `scale(${1179 / PW})`, transformOrigin: 'top left' }}>{children}</div>
    </IPhone>
  )
}

function OnlineShot({ t }: { t: number }) {
  const rel = t - S.online
  const turn = hero(span(rel, 0, 1.2))
  const leave = span(t, S.orders - 0.9, S.orders)
  const fly = leave ** 1.8
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 80% at 60% 40%, #f2efe9, #ddd8cf)' }}>
      <div style={{ position: 'absolute', left: 120, top: 300, width: 640 }}>
        <Words t={t} at={S.online + 0.3} out={S.orders - 0.3} text={'Order online.\nPay in a tap.'} style={{ ...display, color: C.ink, fontSize: 104 }} />
        <div style={{ ...body, fontSize: 32, marginTop: 28, color: C.ink, opacity: sp(t, S.online + 1.2) }}>mykova.app/s/adas-bakery</div>
      </div>
      <LivePhone x={1300} y={545} ry={mix(-22, -8, turn)} rx={mix(6, 2, turn)} rotate={mix(4, 2, turn)}>
        <PhoneShopUI t={rel} taps={cues.shopTaps} />
      </LivePhone>
      {/* The order lifts off the phone and flies to the counter. */}
      {leave > 0 ? (
        <div style={{ position: 'absolute', left: mix(1150, 2100, fly), top: mix(470, 300, fly), width: 360, height: 92, borderRadius: 46, background: INK, color: SURFACE, display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px', boxSizing: 'border-box', fontFamily: 'Manrope', fontSize: 24, fontWeight: 800, transform: `scale(${mix(0.6, 1.1, hero(span(leave, 0, 0.4)))}) rotate(${mix(-4, 6, fly)}deg)`, boxShadow: '0 30px 60px -20px rgba(11,26,29,0.5)' }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: CORAL }} />
          New order · Noor · $6.50
        </div>
      ) : null}
    </AbsoluteFill>
  )
}

function SendShot({ t }: { t: number }) {
  const rel = t - S.send
  const turn = hero(span(rel, 0, 1.2))
  const sent = t >= cues.sent
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 80% at 40% 40%, #f2efe9, #ddd8cf)' }}>
      <LivePhone x={620} y={545} ry={mix(22, 8, turn)} rx={mix(6, 2, turn)} rotate={mix(-4, -2, turn)}>
        <PhoneSendUI t={rel} tap={cues.sendTap - S.send} sent={cues.sent - S.send} />
      </LivePhone>
      <div style={{ position: 'absolute', left: 1040, top: 300, width: 760 }}>
        <Words t={t} at={S.send + 0.3} out={S.end - 0.3} text={'Your money,\nanywhere.'} style={{ ...display, color: C.ink, fontSize: 112 }} />
        <div style={{ ...body, fontSize: 34, marginTop: 30, color: C.ink, opacity: sp(t, cues.sent + 0.2), transform: `translateY(${(1 - sp(t, cues.sent + 0.2)) * 20}px)` }}>{sent ? '€9.20 at the mill in Italy. $0.00 in fees.' : ''}</div>
      </div>
    </AbsoluteFill>
  )
}

export function StoreFilm({ voice = true }: { voice?: boolean }) {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const t = frame / FPS
  const in3d = (t >= S.title && t < S.setup) || (t >= S.pay && t < S.stock) || t >= S.end
  return (
    <AbsoluteFill style={{ background: '#e9e3d8' }}>
      {in3d ? (
        <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.05 }} camera={{ fov: 26, near: 0.02, far: 60 }}>
          <Stage3D s={shot3(t)} />
        </ThreeCanvas>
      ) : null}
      {t < S.title ? <StoreOpen t={t} flip={cues.flip} end={S.title} /> : null}
      {t >= S.setup && t < S.online ? <SetupShot t={t} /> : null}
      {t >= S.online && t < S.orders ? <OnlineShot t={t} /> : null}
      {t >= S.orders && t < S.sell ? <OrdersShot t={t} /> : null}
      {t >= S.sell && t < S.pay ? <SellShot t={t} start={S.sell} /> : null}
      {t >= S.stock && t < S.today ? <StockShot t={t} /> : null}
      {t >= S.today && t < S.send ? <TodayShot t={t} /> : null}
      {t >= S.send && t < S.end ? <SendShot t={t} /> : null}

      {t >= S.title && t < S.setup ? (
        <div style={{ position: 'absolute', left: 110, top: 150, opacity: 1 - span(t, S.setup - 1.0, S.setup - 0.6) }}>
          <div style={{ opacity: sp(t, S.title + 0.3), transform: `translateY(${(1 - sp(t, S.title + 0.3)) * 24}px)` }}>
            <Mark h={80} />
          </div>
          <Words t={t} at={S.title + 0.4} text={'Kova OS\nfor stores'} style={{ ...display, color: C.ink, fontSize: 130, marginTop: 18 }} />
        </div>
      ) : null}
      {t >= S.hand && t < S.stock ? (
        <div style={{ position: 'absolute', left: 110, top: 170 }}>
          <Words t={t} at={S.hand + 0.3} out={S.stock - 0.3} text={'Same shop,\nin her hand.'} style={{ ...display, color: C.ink, fontSize: 104 }} />
        </div>
      ) : null}
      {t >= S.end ? (
        <div style={{ position: 'absolute', left: 110, top: 210 }}>
          <div style={{ opacity: sp(t, S.end + 0.2), transform: `translateY(${(1 - sp(t, S.end + 0.2)) * 30}px)` }}>
            <Mark h={96} />
          </div>
          <Words t={t} at={cues.vo.end} text={'Kova OS\nfor every store'} style={{ ...display, color: C.ink, fontSize: 108, marginTop: 24 }} />
          <div style={{ ...body, color: C.ink, fontSize: 30, marginTop: 18, opacity: sp(t, cues.vo.end + 1.4) }}>Online shop · Register · Terminal · Wallet</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 34, opacity: sp(t, cues.url), transform: `scale(${sp(t, cues.url, BOUNCY)})`, transformOrigin: 'left center' }}>
            <span style={{ ...body, fontWeight: 800, color: C.ink, fontSize: 40, padding: '14px 30px', borderRadius: 999, border: `5px solid ${C.ink}`, background: '#f4f2ed' }}>mykova.app</span>
            <span style={{ ...body, fontWeight: 700, color: C.ink, fontSize: 28, padding: '18px 24px', borderRadius: 999, border: `4px solid ${C.ink}`, alignSelf: 'center' }}>Live on Monad</span>
          </div>
          <Pic src={IMG.koviWave} style={{ position: 'absolute', left: 540, top: 395, width: 190, height: 190, transform: `scale(${sp(t, cues.url + 0.3, BOUNCY)}) rotate(8deg)` }} />
        </div>
      ) : null}

      <Captions t={t} starts={cues.vo} lines={LINES} />
      <Finish frame={frame} />
      <AbsoluteFill style={{ background: '#000', opacity: 1 - decel(span(t, 0, 0.6)), pointerEvents: 'none' }} />

      {voice ? <Html5Audio src={staticFile('store/audio/score.wav')} volume={0.5} /> : null}
      {voice
        ? vo.lines.map((l) => (
            <Sequence key={l.id} from={Math.round(cues.vo[l.id as keyof typeof cues.vo] * FPS)} layout="none">
              <Html5Audio src={staticFile(l.file)} volume={1.6} />
            </Sequence>
          ))
        : null}
    </AbsoluteFill>
  )
}
