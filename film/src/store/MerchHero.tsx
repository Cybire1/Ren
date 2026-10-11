/**
 * Kova Store product shots, 1200 × 1200: one studio for the whole set. A tinted backdrop curving
 * into a floor, a key light from the upper left, materials with their own light (glazed ceramic,
 * canvas weave, cotton, enamel and gold, vinyl, a glossy card), Kovi printed onto each surface, a
 * soft contact shadow and fine grain. Each shot has one small story: steam off the coffee, a
 * baguette in the tote, a sticker peeling off its sheet, the card tapping a phone.
 */
import type React from 'react'
import { AbsoluteFill, Img, staticFile } from 'remotion'

const INK = '#0b1a1d'
export type HeroKind = 'stickers' | 'mug' | 'tote' | 'tee' | 'pin' | 'card'

const SET: Record<HeroKind, { back: string; floor: string; glow: string }> = {
  mug: { back: '#cfe0dc', floor: '#bcd2cd', glow: '#eef6f3' },
  tote: { back: '#f2d3c6', floor: '#e6c0b1', glow: '#fbece5' },
  tee: { back: '#d3e1ec', floor: '#bfd1df', glow: '#eef4f9' },
  pin: { back: '#f1e1c2', floor: '#e4cfa8', glow: '#fbf3e3' },
  stickers: { back: '#f5dfb4', floor: '#e9cd96', glow: '#fdf2db' },
  card: { back: '#ddd5ec', floor: '#c9bfdf', glow: '#f1edf8' },
}

const kovi = (pose: string) => staticFile(`art/kovi-${pose}.png`)
const abs = (style: React.CSSProperties): React.CSSProperties => ({ position: 'absolute', ...style })

function Studio({ kind, shadow, children }: { kind: HeroKind; shadow: { x: number; y: number; w: number; h: number }; children: React.ReactNode }) {
  const c = SET[kind]
  return (
    <AbsoluteFill style={{ background: c.back, overflow: 'hidden' }}>
      {/* The sweep: backdrop into floor, lit from the upper left. */}
      <div style={abs({ left: 0, right: 0, top: 760, bottom: 0, background: `linear-gradient(180deg, ${c.back} 0%, ${c.floor} 60%)` })} />
      <div style={abs({ inset: 0, background: `radial-gradient(ellipse 70% 60% at 30% 25%, ${c.glow}cc, ${c.glow}00 70%)` })} />
      <div style={abs({ inset: 0, background: 'radial-gradient(ellipse 90% 80% at 50% 45%, rgba(0,0,0,0) 60%, rgba(11,26,29,0.16))' })} />
      {/* Contact shadow: a tight core and a wide soft spread, pushed away from the light. */}
      <div style={abs({ left: shadow.x - shadow.w / 2 + 30, top: shadow.y - shadow.h / 2 + 10, width: shadow.w * 1.15, height: shadow.h * 2.2, borderRadius: '50%', background: 'rgba(11,26,29,0.22)', filter: 'blur(38px)' })} />
      <div style={abs({ left: shadow.x - shadow.w / 2, top: shadow.y - shadow.h / 2, width: shadow.w, height: shadow.h, borderRadius: '50%', background: 'rgba(11,26,29,0.35)', filter: 'blur(10px)' })} />
      {children}
      {/* Grain. */}
      <svg width="1200" height="1200" style={abs({ inset: 0, opacity: 0.07, mixBlendMode: 'multiply' })} aria-hidden="true">
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="1200" height="1200" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  )
}

function Sparkle({ x, y, size, fill }: { x: number; y: number; size: number; fill: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={abs({ left: x, top: y })} aria-hidden="true">
      <path d="M20 2 L24 16 L38 20 L24 24 L20 38 L16 24 L2 20 L16 16 Z" fill={fill} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  )
}

function Mug() {
  return (
    <Studio kind="mug" shadow={{ x: 600, y: 975, w: 560, h: 70 }}>
      {/* Steam. */}
      <svg width="1200" height="1200" style={abs({ inset: 0 })} aria-hidden="true">
        <defs><filter id="soft"><feGaussianBlur stdDeviation="9" /></filter></defs>
        {[470, 590, 710].map((x, i) => (
          <path key={x} d={`M${x} 330 C ${x - 50} 260, ${x + 50} 220, ${x} 150 S ${x + 30} 60, ${x - 10} 20`} fill="none" stroke="#ffffff" strokeWidth="26" strokeLinecap="round" opacity={0.55 - i * 0.08} filter="url(#soft)" />
        ))}
      </svg>
      <svg width="1200" height="1200" style={abs({ inset: 0 })} aria-hidden="true">
        <defs>
          <linearGradient id="glaze" x1="0" x2="1">
            <stop offset="0" stopColor="#e9e4da" />
            <stop offset="0.18" stopColor="#fffdf8" />
            <stop offset="0.55" stopColor="#f4efe6" />
            <stop offset="0.9" stopColor="#cfc7b8" />
            <stop offset="1" stopColor="#bdb4a3" />
          </linearGradient>
          <radialGradient id="coffee" cx="0.45" cy="0.4"><stop offset="0" stopColor="#9a6a43" /><stop offset="1" stopColor="#5b3b2a" /></radialGradient>
        </defs>
        {/* Handle. */}
        <path d="M838 470 C 1010 470, 1010 790, 838 790" fill="none" stroke={INK} strokeWidth="78" strokeLinecap="round" />
        <path d="M838 470 C 1010 470, 1010 790, 838 790" fill="none" stroke="#e9e3d8" strokeWidth="56" strokeLinecap="round" />
        <path d="M850 505 C 960 512, 962 640, 930 700" fill="none" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" opacity="0.7" />
        {/* Body. */}
        <path d="M330 360 H870 V880 Q870 990 760 990 H440 Q330 990 330 880 Z" fill="url(#glaze)" stroke={INK} strokeWidth="12" strokeLinejoin="round" />
        <rect x="378" y="400" width="34" height="520" rx="17" fill="#ffffff" opacity="0.65" />
        {/* Rim and coffee with a heart. */}
        <ellipse cx="600" cy="360" rx="270" ry="48" fill="#f7f3ec" stroke={INK} strokeWidth="12" />
        <ellipse cx="600" cy="366" rx="236" ry="34" fill="url(#coffee)" />
        <path d="M600 386 C 560 360, 560 338, 584 336 C 594 336, 600 344, 600 350 C 600 344, 606 336, 616 336 C 640 338, 640 360, 600 386 Z" fill="#f1dcc0" />
      </svg>
      <Img src={kovi('cheer')} style={abs({ left: 410, top: 520, width: 380, height: 380, mixBlendMode: 'multiply', transform: 'perspective(900px) rotateY(-8deg)' })} />
      <Sparkle x={170} y={250} size={70} fill="#e8c15a" />
      <Sparkle x={980} y={300} size={46} fill="#f7f4ee" />
    </Studio>
  )
}

function Tote() {
  return (
    <Studio kind="tote" shadow={{ x: 600, y: 1010, w: 640, h: 64 }}>
      <svg width="1200" height="1200" style={abs({ inset: 0 })} aria-hidden="true">
        <defs>
          <filter id="weave" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8 0.08" numOctaves="2" seed="3" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.18  0 0 0 0.25 0" result="t" />
            <feComposite in="t" in2="SourceGraphic" operator="in" />
          </filter>
          <linearGradient id="canvas" x1="0" x2="1">
            <stop offset="0" stopColor="#efe4cd" />
            <stop offset="0.5" stopColor="#f6eedc" />
            <stop offset="1" stopColor="#d9cbae" />
          </linearGradient>
        </defs>
        {/* A baguette and a sprig of flowers peeking out. */}
        <g transform="rotate(-16 700 300)">
          <rect x="640" y="140" width="96" height="420" rx="48" fill="#d39a58" stroke={INK} strokeWidth="12" />
          {[200, 270, 340].map((y) => (
            <path key={y} d={`M668 ${y} L708 ${y + 36}`} stroke="#f3dfb8" strokeWidth="12" strokeLinecap="round" />
          ))}
        </g>
        <path d="M470 420 C 450 300, 470 230, 430 170" fill="none" stroke="#2e7268" strokeWidth="10" strokeLinecap="round" />
        {[[430, 165], [462, 220], [402, 230]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="24" fill={i === 1 ? '#e8c15a' : '#d46558'} stroke={INK} strokeWidth="8" />
        ))}
        {/* Straps with stitching. */}
        {[380, 690].map((x) => (
          <g key={x}>
            <path d={`M${x} 470 C ${x} 230, ${x + 130} 230, ${x + 130} 470`} fill="none" stroke={INK} strokeWidth="58" strokeLinecap="round" />
            <path d={`M${x} 470 C ${x} 230, ${x + 130} 230, ${x + 130} 470`} fill="none" stroke="#e7dbc2" strokeWidth="38" strokeLinecap="round" />
            <path d={`M${x} 470 C ${x} 230, ${x + 130} 230, ${x + 130} 470`} fill="none" stroke="#bfae8d" strokeWidth="3" strokeDasharray="10 9" />
          </g>
        ))}
        {/* The bag. */}
        <path d="M250 440 H950 L912 1010 H288 Z" fill="url(#canvas)" stroke={INK} strokeWidth="12" strokeLinejoin="round" />
        <path d="M250 440 H950 L912 1010 H288 Z" fill="#000" filter="url(#weave)" />
        <path d="M262 482 H938" stroke="#bfae8d" strokeWidth="3" strokeDasharray="10 9" />
        <path d="M330 470 C 360 700, 340 860, 360 990" fill="none" stroke="#d1c2a2" strokeWidth="10" opacity="0.6" />
        <path d="M860 470 C 840 680, 870 860, 850 990" fill="none" stroke="#c9b894" strokeWidth="12" opacity="0.5" />
      </svg>
      <Img src={kovi('wave')} style={abs({ left: 400, top: 540, width: 400, height: 400, mixBlendMode: 'multiply' })} />
      <div style={abs({ left: 0, right: 0, top: 925, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 800, fontSize: 40, letterSpacing: 10, color: '#3b3226', opacity: 0.8 })}>KOVA</div>
      <Sparkle x={1000} y={540} size={64} fill="#e8c15a" />
    </Studio>
  )
}

function Tee() {
  return (
    <Studio kind="tee" shadow={{ x: 600, y: 1060, w: 520, h: 40 }}>
      <svg width="1200" height="1200" style={abs({ inset: 0 })} aria-hidden="true">
        <defs>
          <linearGradient id="cotton" x1="0" x2="1">
            <stop offset="0" stopColor="#e7e3db" />
            <stop offset="0.3" stopColor="#fbf9f5" />
            <stop offset="0.7" stopColor="#f3efe8" />
            <stop offset="1" stopColor="#d5cfc4" />
          </linearGradient>
        </defs>
        {/* A wooden hanger on a rail. */}
        <path d="M0 120 H1200" stroke={INK} strokeWidth="16" />
        <path d="M600 120 C 600 175, 640 175, 640 205" fill="none" stroke={INK} strokeWidth="12" strokeLinecap="round" />
        <path d="M600 230 L330 330 Q300 345 330 352 H870 Q900 345 870 330 Z" fill="#c98a4b" stroke={INK} strokeWidth="12" strokeLinejoin="round" />
        {/* The tee. */}
        <path d="M455 300 Q600 380 745 300 L960 400 Q985 412 975 440 L905 590 Q895 612 870 600 L800 570 V1030 Q800 1050 780 1050 H420 Q400 1050 400 1030 V570 L330 600 Q305 612 295 590 L225 440 Q215 412 240 400 Z" fill="url(#cotton)" stroke={INK} strokeWidth="12" strokeLinejoin="round" />
        <path d="M455 300 Q600 380 745 300" fill="none" stroke={INK} strokeWidth="12" />
        <path d="M478 312 Q600 368 722 312" fill="none" stroke="#cfc8bb" strokeWidth="10" />
        <path d="M430 620 C 450 800, 430 900, 450 1030" fill="none" stroke="#ddd6ca" strokeWidth="14" opacity="0.7" />
        <path d="M770 610 C 750 760, 780 900, 760 1030" fill="none" stroke="#cfc7b9" strokeWidth="16" opacity="0.6" />
      </svg>
      <Img src={kovi('ride')} style={abs({ left: 455, top: 470, width: 290, height: 290, mixBlendMode: 'multiply' })} />
      <div style={abs({ left: 0, right: 0, top: 760, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 800, fontSize: 34, color: '#2a3437', opacity: 0.85 })}>tap. paid. anywhere.</div>
      <Sparkle x={160} y={460} size={58} fill="#f7f4ee" />
      <Sparkle x={990} y={720} size={70} fill="#e8c15a" />
    </Studio>
  )
}

function Pin() {
  return (
    <Studio kind="pin" shadow={{ x: 600, y: 1000, w: 560, h: 56 }}>
      {/* A kraft backing card with its hang hole. */}
      <div style={abs({ left: 300, top: 150, width: 600, height: 840, borderRadius: 30, background: 'linear-gradient(160deg, #d8b98d, #c9a575)', border: `12px solid ${INK}`, boxSizing: 'border-box', transform: 'rotate(-3deg)' })}>
        <div style={abs({ left: 260, top: 40, width: 56, height: 56, borderRadius: 28, background: SET.pin.back, border: `10px solid ${INK}`, boxSizing: 'border-box' })} />
        <div style={abs({ left: 0, right: 0, bottom: 64, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 800, fontSize: 44, letterSpacing: 8, color: INK })}>KOVA</div>
        <div style={abs({ left: 0, right: 0, bottom: 30, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 700, fontSize: 22, color: '#5a4630' })}>hard enamel · gold plated</div>
      </div>
      <svg width="1200" height="1200" style={abs({ inset: 0 })} aria-hidden="true">
        <defs>
          <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff1b8" />
            <stop offset="0.35" stopColor="#e2b94a" />
            <stop offset="0.6" stopColor="#b7862a" />
            <stop offset="1" stopColor="#f2d27a" />
          </linearGradient>
          <radialGradient id="enamel" cx="0.4" cy="0.35"><stop offset="0" stopColor="#e47a6c" /><stop offset="1" stopColor="#c4523f" /></radialGradient>
        </defs>
        <circle cx="600" cy="540" r="250" fill={INK} />
        <circle cx="600" cy="540" r="238" fill="url(#gold)" />
        <circle cx="600" cy="540" r="206" fill="url(#enamel)" />
        <circle cx="600" cy="540" r="206" fill="none" stroke="#9a6d22" strokeWidth="5" />
      </svg>
      <Img src={kovi('cheer')} style={abs({ left: 420, top: 360, width: 360, height: 360 })} />
      {/* Glaze: a sweep of light across the enamel. */}
      <div style={abs({ left: 394, top: 334, width: 412, height: 412, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.18) 100%)' })} />
      <Sparkle x={850} y={280} size={64} fill="#ffffff" />
    </Studio>
  )
}

function Stickers() {
  return (
    <Studio kind="stickers" shadow={{ x: 600, y: 1000, w: 700, h: 50 }}>
      <div style={abs({ left: 230, top: 170, width: 740, height: 840, borderRadius: 36, background: '#fbfaf6', border: `12px solid ${INK}`, boxSizing: 'border-box', transform: 'rotate(-4deg)', boxShadow: 'inset 0 -30px 60px rgba(11,26,29,0.06)' })}>
        <div style={abs({ left: 40, top: 26, fontFamily: 'Manrope', fontWeight: 800, fontSize: 30, letterSpacing: 6, color: INK })}>KOVI · STICKERS</div>
        {[
          { pose: 'wave', x: 40, y: 90, r: -8 },
          { pose: 'key', x: 360, y: 90, r: 7 },
          { pose: 'ride', x: 40, y: 440, r: 5 },
        ].map((k) => (
          <div key={k.pose} style={abs({ left: k.x, top: k.y, width: 300, height: 300, transform: `rotate(${k.r}deg)` })}>
            <Img src={kovi(k.pose)} style={abs({ inset: 0, width: 300, height: 300, filter: 'drop-shadow(0 0 0 #fff) drop-shadow(7px 0 0 #fff) drop-shadow(-7px 0 0 #fff) drop-shadow(0 7px 0 #fff) drop-shadow(0 -7px 0 #fff) drop-shadow(3px 4px 2px rgba(11,26,29,0.25))' })} />
          </div>
        ))}
        {/* The empty die-cut where the peeled sticker was. */}
        <div style={abs({ left: 400, top: 470, width: 250, height: 250, borderRadius: '50%', border: '4px dashed #c9c4b8' })} />
      </div>
      {/* The peeled sticker, lifted toward the light with its curl. */}
      <div style={abs({ left: 700, top: 560, width: 330, height: 330, transform: 'rotate(18deg) translateY(-30px)', filter: 'drop-shadow(18px 26px 18px rgba(11,26,29,0.35))' })}>
        <Img src={kovi('cheer')} style={abs({ inset: 0, width: 330, height: 330, filter: 'drop-shadow(8px 0 0 #fff) drop-shadow(-8px 0 0 #fff) drop-shadow(0 8px 0 #fff) drop-shadow(0 -8px 0 #fff)' })} />
        <div style={abs({ right: 24, bottom: 30, width: 120, height: 120, borderRadius: '0 0 60% 0', background: 'linear-gradient(135deg, #ffffff 40%, #d9d4c8)', transform: 'rotate(-8deg)', boxShadow: '-6px -6px 12px rgba(11,26,29,0.12)' })} />
      </div>
      <Sparkle x={130} y={130} size={66} fill="#d46558" />
    </Studio>
  )
}

function Card() {
  return (
    <Studio kind="card" shadow={{ x: 600, y: 1010, w: 520, h: 50 }}>
      {/* A phone lying on the floor, its screen saying Paid. */}
      <div style={abs({ left: 455, top: 470, width: 290, height: 580, transform: 'perspective(1100px) rotateX(64deg) rotateZ(-6deg)', transformOrigin: 'center bottom' })}>
        <div style={abs({ inset: 0, borderRadius: 52, background: INK, boxShadow: '0 0 0 6px #8f897f' })}>
          <div style={abs({ inset: 14, borderRadius: 40, background: '#a9c9c9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, fontFamily: 'Manrope', fontWeight: 800, color: INK })}>
            <div style={{ width: 110, height: 110, borderRadius: 55, background: '#f1efea', border: `8px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 }}>✓</div>
            <div style={{ fontSize: 64 }}>Paid</div>
          </div>
          <div style={abs({ left: 105, top: 26, width: 80, height: 22, borderRadius: 11, background: '#050505' })} />
        </div>
      </div>
      {/* Contactless rings rising from the phone. */}
      <svg width="1200" height="1200" style={abs({ inset: 0 })} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <ellipse key={i} cx="600" cy={760 - i * 40} rx={140 + i * 70} ry={36 + i * 18} fill="none" stroke="#d46558" strokeWidth="10" opacity={0.9 - i * 0.25} />
        ))}
      </svg>
      {/* The card, tilted toward the camera, with a sheen. */}
      <div style={abs({ left: 430, top: 110, width: 340, height: 539, transform: 'perspective(1400px) rotateX(16deg) rotateZ(-10deg) rotateY(-14deg)', filter: 'drop-shadow(26px 40px 24px rgba(11,26,29,0.35))' })}>
        <Img src={staticFile('atm/card-main.png')} style={abs({ inset: 0, width: 340, height: 539 })} />
        <div style={abs({ inset: 0, borderRadius: 22, background: 'linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.5) 42%, rgba(255,255,255,0) 54%)' })} />
      </div>
      <Sparkle x={240} y={300} size={64} fill="#e8c15a" />
      <Sparkle x={900} y={520} size={46} fill="#ffffff" />
    </Studio>
  )
}

export function MerchHero({ kind }: { kind: HeroKind }) {
  switch (kind) {
    case 'mug':
      return <Mug />
    case 'tote':
      return <Tote />
    case 'tee':
      return <Tee />
    case 'pin':
      return <Pin />
    case 'stickers':
      return <Stickers />
    case 'card':
      return <Card />
  }
}
