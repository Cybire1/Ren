import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { load, save } from './storage'

/**
 * Settings that are not money: which side of the counter this phone is on, and the Kova Card.
 *
 * The card here is the app's view of it. Freezing is instant in the app and in Kova's
 * approval step; on-chain, a frozen card's access key has its spending limit set to zero
 * once a physical card is paired (docs/card/protocol.md).
 */
export type Mode = 'pay' | 'terminal'

export interface CardState {
  last4: string
  frozen: boolean
  /** Daily spending limit in dollars. */
  dailyLimit: number
  /** Only Kova terminals can charge it; online checkouts are refused. */
  terminalsOnly: boolean
}

interface Prefs {
  ready: boolean
  mode: Mode
  setMode: (mode: Mode) => void
  card: CardState
  updateCard: (patch: Partial<CardState>) => void
  /** Hides the balance on Home, for glances in public. */
  hideBalance: boolean
  setHideBalance: (hide: boolean) => void
}

const PREFS = 'kova.prefs.v1'
const defaults = { mode: 'pay' as Mode, hideBalance: false, card: { last4: '4821', frozen: false, dailyLimit: 200, terminalsOnly: true } }

const PrefsContext = createContext<Prefs | null>(null)

export function usePrefs(): Prefs {
  const prefs = useContext(PrefsContext)
  if (!prefs) throw new Error('usePrefs must be used inside <PrefsProvider>')
  return prefs
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [state, setState] = useState(defaults)

  useEffect(() => {
    void load(PREFS, defaults).then((saved) => {
      setState({ ...defaults, ...saved, card: { ...defaults.card, ...saved.card } })
      setReady(true)
    })
  }, [])

  const update = useCallback((next: typeof defaults) => {
    setState(next)
    void save(PREFS, next)
  }, [])

  return (
    <PrefsContext.Provider
      value={{
        ready,
        mode: state.mode,
        setMode: (mode) => update({ ...state, mode }),
        card: state.card,
        updateCard: (patch) => update({ ...state, card: { ...state.card, ...patch } }),
        hideBalance: state.hideBalance,
        setHideBalance: (hideBalance) => update({ ...state, hideBalance }),
      }}
    >
      {children}
    </PrefsContext.Provider>
  )
}
