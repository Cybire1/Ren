'use client'

import { useState } from 'react'
import type { Terminal } from '@/lib/api'
import { ago } from '@/lib/format'
import { Icon } from './brand'

/** One paired phone. Removing it asks once, inline, then revokes its key. */
export function TerminalRow({ terminal, onRemoved }: { terminal: Terminal; onRemoved: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const remove = async () => {
    setBusy(true)
    setProblem(null)
    try {
      const response = await fetch(`/api/terminals/${terminal.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error ?? 'Could not remove it')
      onRemoved(terminal.id)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Could not remove it')
      setBusy(false)
    }
  }

  const seen = terminal.last_seen_at && terminal.last_seen_at !== terminal.created_at ? `Used ${ago(terminal.last_seen_at)}` : `Paired ${ago(terminal.created_at)}`

  return (
    <div className="term" data-confirming={confirming ? 'true' : undefined}>
      <span className="term-icon">
        <Icon name="terminal" size={18} />
      </span>
      {confirming ? (
        <>
          <span>
            <span className="row-title">Remove this phone?</span>
            <span className="row-sub">{problem ?? `${terminal.name} stops taking payments at once.`}</span>
          </span>
          <span className="term-actions">
            <button type="button" className="mini" onClick={() => setConfirming(false)} disabled={busy}>
              Keep
            </button>
            <button type="button" className="mini mini-danger" onClick={remove} disabled={busy}>
              {busy ? 'Removing' : 'Remove'}
            </button>
          </span>
        </>
      ) : (
        <>
          <span>
            <span className="row-title">{terminal.name}</span>
            <span className="row-sub">{seen}</span>
          </span>
          <button type="button" className="round term-remove" aria-label={`Remove ${terminal.name}`} onClick={() => setConfirming(true)}>
            <Icon name="close" size={16} />
          </button>
        </>
      )}
    </div>
  )
}
