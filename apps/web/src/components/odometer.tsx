'use client'

import { useEffect, useState } from 'react'

const DIGITS = '0123456789'.split('')

/**
 * A number on rolling wheels, like a till's display: each digit turns to its new value when
 * the amount changes. Screen readers get the plain value; the wheels are decoration.
 */
export function Odometer({ value, className }: { value: string; className?: string }) {
  // Start on zeros so the first render rolls up to the real amount.
  const [shown, setShown] = useState(() => value.replace(/\d/g, '0'))
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value))
    return () => cancelAnimationFrame(id)
  }, [value])

  const chars = shown.split('')
  return (
    <span className={`odo${className ? ` ${className}` : ''}`} role="img" aria-label={value}>
      {chars.map((ch, i) => {
        // Key from the right, so the units stay the units when the number grows a digit.
        const key = chars.length - i
        return /\d/.test(ch) ? (
          <span key={key} className="odo-digit" aria-hidden="true">
            <span className="odo-reel" style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={`s${key}`} className="odo-sep" aria-hidden="true">
            {ch}
          </span>
        )
      })}
    </span>
  )
}
