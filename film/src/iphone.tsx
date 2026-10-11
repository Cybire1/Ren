/**
 * An iPhone 16 Pro, built to its real proportions (71.5 x 149.6 mm, 6.3" display): a hairline black
 * border, a natural titanium band with lit edges, the Dynamic Island, side buttons, glass sheen and
 * layered shadows. It can turn in 3D (rotateX / rotateY with perspective), and the band has depth,
 * so a turned phone shows its side.
 *
 * `h` is the screen height in film pixels. `children` draw in screenshot pixels (1179 x 2556), over
 * the screen, so overlays land exactly on the capture.
 */
import type React from 'react'
import { Img, staticFile } from 'remotion'
import { SCREEN } from './parts'

const TI = {
  // Natural titanium, lit from the upper left.
  band: 'linear-gradient(135deg, #e9e5df 0%, #b9b3aa 18%, #8f897f 42%, #cfc9c0 58%, #a39d93 80%, #ece8e2 100%)',
  side: '#7d776e',
  button: 'linear-gradient(90deg, #8a847a, #d8d3cb 45%, #9c968c)',
}

export function IPhone({
  src,
  to,
  swap = 0,
  h,
  x,
  y,
  rotate = 0,
  rx = 0,
  ry = 0,
  scale = 1,
  shadow = 1,
  style,
  children,
}: {
  src?: string
  /** A second screen that crossfades in over the first. */
  to?: string
  swap?: number
  h: number
  x: number
  y: number
  /** Turn in the picture plane, in degrees. */
  rotate?: number
  /** Tilt back (rx) and turn sideways (ry), in degrees. */
  rx?: number
  ry?: number
  scale?: number
  /** 0 to 1: how strongly the phone sits on the paper. */
  shadow?: number
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  const w = (h * SCREEN.w) / SCREEN.h
  const k = h / SCREEN.h
  // Proportions of the real device, relative to the screen height.
  const border = h * 0.0125 // black border round the display
  const band = h * 0.0085 // titanium seen from the front
  const radius = w * 0.142 // display corner radius (55 pt on a 393 pt screen)
  const W = w + 2 * (border + band)
  const H = h + 2 * (border + band)
  const R = radius + border + band
  const depth = h * 0.028 // 8.25 mm of body
  const layers = 10
  // Light falls from the upper left: the far side of a turned phone shows its titanium.
  return (
    <div
      style={{
        position: 'absolute',
        left: x - W / 2,
        top: y - H / 2,
        width: W,
        height: H,
        perspective: H * 3.2,
        ...style,
      }}
    >
      {/* Shadows on the paper: a tight contact shadow and a wide, soft one, pushed away from the light. */}
      {[
        { blur: H * 0.012, dy: H * 0.012, a: 0.22, s: 0.98 },
        { blur: H * 0.06, dy: H * 0.05, a: 0.22, s: 0.94 },
      ].map((l, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: R,
            background: `rgba(28, 33, 34, ${l.a * shadow})`,
            filter: `blur(${l.blur}px)`,
            transform: `translate(${-ry * 1.5}px, ${l.dy}px) rotate(${rotate}deg) scale(${scale * l.s})`,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformStyle: 'preserve-3d',
          transform: `rotate(${rotate}deg) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`,
        }}
      >
        {/* The body's depth: titanium slices behind the front. */}
        {Array.from({ length: layers }, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: R,
              background: TI.side,
              transform: `translateZ(${-((i + 1) / layers) * depth}px)`,
              filter: `brightness(${1.15 - (i / layers) * 0.35})`,
            }}
          />
        ))}
        {/* Buttons: action and volume on the left, side button on the right. */}
        {[
          { side: -1, top: 0.19, len: 0.045 },
          { side: -1, top: 0.265, len: 0.075 },
          { side: -1, top: 0.36, len: 0.075 },
          { side: 1, top: 0.29, len: 0.105 },
        ].map((b, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: H * b.top,
              height: H * b.len,
              width: band * 0.9,
              left: b.side < 0 ? -band * 0.55 : undefined,
              right: b.side > 0 ? -band * 0.55 : undefined,
              borderRadius: band,
              background: TI.button,
              transform: `translateZ(${-depth / 2}px)`,
            }}
          />
        ))}
        {/* Titanium band, with lit edges. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: R,
            background: TI.band,
            boxShadow: `inset 0 0 0 ${Math.max(1, band * 0.12)}px rgba(255,255,255,0.55), inset 0 0 0 ${band * 0.5}px rgba(60,55,50,0.18)`,
          }}
        />
        {/* Black border and display. */}
        <div style={{ position: 'absolute', inset: band, borderRadius: R - band, background: '#0b0c0d' }} />
        <div
          style={{
            position: 'absolute',
            left: band + border,
            top: band + border,
            width: w,
            height: h,
            borderRadius: radius,
            overflow: 'hidden',
            background: '#f1efea',
          }}
        >
          {src ? <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} /> : null}
          {to ? <Img src={staticFile(to)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: swap }} /> : null}
          <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN.w, height: SCREEN.h, transform: `scale(${k})`, transformOrigin: 'top left' }}>
            {children}
          </div>
          {/* Dynamic Island: 126 x 37 pt, 11 pt from the top. */}
          <div
            style={{
              position: 'absolute',
              left: w / 2 - (378 * k) / 2,
              top: 33 * k,
              width: 378 * k,
              height: 111 * k,
              borderRadius: 60 * k,
              background: '#050505',
            }}
          />
          {/* Glass: a soft diagonal sheen that moves as the phone turns. */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(${115 + ry * 1.5}deg, rgba(255,255,255,0) ${30 + ry}%, rgba(255,255,255,0.13) ${42 + ry}%, rgba(255,255,255,0) ${56 + ry}%)`,
              mixBlendMode: 'screen',
            }}
          />
        </div>
      </div>
    </div>
  )
}
