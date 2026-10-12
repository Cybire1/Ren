'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '@/components/brand'

/** The pieces every money sheet shares: send, send privately, and moving in and out of private. */

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Holds the sheet at its content's height and animates between heights as the steps change. */
export function Fit({ children }: { children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const measure = () => setHeight(el.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div className="w-sheet-fit" style={height === null ? undefined : { height }}>
      <div ref={inner}>{children}</div>
    </div>
  )
}

export function Fact({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon?: IconName
}) {
  return (
    <div className="w-fact">
      <dt>{label}</dt>
      <dd>
        <span>
          {icon ? (
            <span className={icon === 'lock' ? 'w-fact-lock' : undefined}>
              <Icon name={icon} size={15} />
            </span>
          ) : null}
          {value}
        </span>
        {hint ? <small>{hint}</small> : null}
      </dd>
    </div>
  )
}

const KNOB = 56
const PAD = 6

/**
 * Slide to send: the one deliberate gesture between a review and money leaving. The track fills
 * coral behind the knob; letting go short of the end springs it home. With a keyboard, the knob
 * is a button: Enter or Space sends.
 */
export function SlideToSend({
  label,
  busy,
  busyLabel = 'Sending',
  disabled,
  onSend,
}: {
  label: string
  busy: boolean
  busyLabel?: string
  disabled?: boolean
  onSend: () => void
}) {
  const track = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [nudge, setNudge] = useState(false)
  const drag = useRef<{ start: number; from: number; moved: boolean } | null>(null)
  const max = () => (track.current ? track.current.clientWidth - KNOB - PAD * 2 : 0)

  useEffect(() => {
    const el = track.current
    setX(busy && el ? el.clientWidth - KNOB - PAD * 2 : 0)
  }, [busy])

  const commit = () => {
    setX(max())
    navigator.vibrate?.(20)
    onSend()
  }

  return (
    <div
      ref={track}
      className={`w-slide${disabled ? ' w-slide-off' : ''}${busy ? ' w-slide-busy' : ''}${dragging ? ' w-slide-drag' : ''}`}
    >
      <span className="w-slide-fill" style={{ width: x + KNOB + PAD }} />
      <span
        className="w-slide-words"
        style={{ opacity: busy ? 0 : Math.max(0, 1 - x / (max() * 0.5 || 1)) }}
      >
        {label}
        <span className="w-slide-chevrons" aria-hidden="true">
          <Icon name="chevron" size={16} />
          <Icon name="chevron" size={16} />
          <Icon name="chevron" size={16} />
        </span>
      </span>
      {busy ? <span className="w-slide-words">{busyLabel}</span> : null}
      <button
        type="button"
        className={`w-slide-knob${nudge ? ' w-slide-nudge' : ''}`}
        style={{ transform: `translateX(${x}px)` }}
        disabled={disabled || busy}
        aria-label={`${label}. Press Enter to send.`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            commit()
          }
        }}
        onPointerDown={(e) => {
          if (disabled || busy) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { start: e.clientX, from: x, moved: false }
          setDragging(true)
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const dx = e.clientX - drag.current.start
          if (Math.abs(dx) > 4) drag.current.moved = true
          setX(Math.min(max(), Math.max(0, drag.current.from + dx)))
        }}
        onPointerUp={() => {
          const d = drag.current
          drag.current = null
          setDragging(false)
          if (!d) return
          if (x >= max() * 0.86) return commit()
          setX(0)
          // A click instead of a slide: show which way it goes.
          if (!d.moved) {
            setNudge(true)
            setTimeout(() => setNudge(false), 700)
          }
        }}
        onPointerCancel={() => {
          drag.current = null
          setDragging(false)
          setX(0)
        }}
        onClick={(e) => e.preventDefault()}
      >
        {busy ? <span className="w-slide-spin" /> : <Icon name="arrow" size={24} />}
      </button>
    </div>
  )
}
