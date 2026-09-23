'use client'

import { useState } from 'react'
import { Icon } from './brand'

/** A value someone pastes into another wallet, with a one-tap copy. */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="field-value">
        <code>{value}</code>
        <button
          type="button"
          className="round"
          aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={16} />
        </button>
      </div>
    </div>
  )
}
