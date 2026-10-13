import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppState } from 'react-native'
import type { Address, LocalAccount } from 'viem'
import { getBalance, walletClient } from './chain-tempo'
import { chainKey } from './config'
import { spend } from './session'
import { load, save } from './storage'
import {
  deposit,
  moveOutReserve,
  type PrivateMove,
  privateBalance,
  privateMoves,
  unlockZone,
  waitForZone,
  withdraw,
  type ZoneInfo,
  zoneUnlocked,
} from './zone'

/**
 * Your private balance (zone.ts), for the wallet: what's in it, its history, and moving dollars in,
 * out and privately to someone. The app's twin of apps/web components/wallet/private-state.ts. The
 * zone shows a wallet only its own balance, once it signs for it, so after a relaunch the balance
 * is locked until Face ID opens it.
 */

export type PrivateKind = 'in' | 'out' | 'sent' | 'arrived'

export interface PrivateEntry {
  id: string
  kind: PrivateKind
  amount: bigint
  name: string
  detail: string
  at: number
  pending?: boolean
}

/** What this phone knows about a private move it made: the zone can't say who a deposit was for. */
export interface PrivateNote {
  kind: 'in' | 'out' | 'sent'
  amount: string
  at: number
  hash: string
  name?: string
  to?: string
  landed?: boolean
}

export interface Privacy {
  zone: ZoneInfo | null
  status: 'locked' | 'opening' | 'ready' | 'unreachable'
  balance: bigint | null
  /** What a move out keeps back for the zone's gas. */
  outReserve: bigint
  entries: PrivateEntry[]
  open: () => Promise<void>
  moveIn: (amount: bigint) => Promise<{ hash: string; ms: number }>
  moveOut: (amount: bigint) => Promise<{ hash: string; ms: number }>
  sendPrivately: (to: { address: Address; name: string }, amount: bigint) => Promise<{ hash: string; ms: number }>
}

const refused = (error: unknown) => {
  const e = error as { status?: number; cause?: { status?: number } }
  const status = e?.status ?? e?.cause?.status
  return status === 401 || status === 403
}

function plain(error: unknown, fallback: string): Error {
  const message = error instanceof Error ? error.message : String(error)
  if (/insufficient|exceeds balance/i.test(message)) return new Error('Not enough dollars for that. Nothing moved.')
  if (/cancel|denied|reject/i.test(message)) return new Error('Cancelled. Nothing moved.')
  return new Error(fallback)
}

/** In development, why a move failed, cause by cause. */
function explain(what: string, error: unknown) {
  if (!__DEV__) return
  type Failure = { name?: string; shortMessage?: string; message?: string; cause?: Failure }
  const causes: string[] = []
  for (let e = error as Failure | undefined; e && causes.length < 5; e = e.cause)
    causes.push(`${e.name}: ${e.shortMessage ?? e.message?.split('\n')[0]}`)
  console.log(`[private] ${what}`, causes.join(' <- '))
}

export function usePrivacy({
  zone,
  address,
  unlock,
  onMoved,
}: {
  zone: ZoneInfo | null
  address: Address | null
  unlock: (amount: bigint) => Promise<LocalAccount>
  onMoved: () => void
}): Privacy {
  const [status, setStatus] = useState<Privacy['status']>('locked')
  const [held, setHeld] = useState<bigint | null>(null)
  const [moves, setMoves] = useState<PrivateMove[]>([])
  const [notes, setNotes] = useState<PrivateNote[]>([])
  const [outReserve, setOutReserve] = useState(0n)
  const notesKey = address ? chainKey(`private.${address.toLowerCase()}`) : null

  useEffect(() => {
    setHeld(null)
    setMoves([])
    setStatus('locked')
    if (!notesKey) return setNotes([])
    void load<PrivateNote[]>(notesKey, []).then(setNotes)
  }, [notesKey])

  const remember = useCallback(
    (note: PrivateNote) => {
      setNotes((current) => {
        const next = [note, ...current.filter((n) => n.hash !== note.hash)].slice(0, 200)
        if (notesKey) void save(notesKey, next)
        return next
      })
    },
    [notesKey],
  )

  const refresh = useCallback(async () => {
    if (!zone || !address) return
    if (!zoneUnlocked(zone, address)) return setStatus('locked')
    try {
      const [amount, history] = await Promise.all([
        privateBalance(zone, address),
        privateMoves(zone, address).catch(() => null),
      ])
      setHeld(amount)
      if (history) setMoves(history)
      setStatus('ready')
      void moveOutReserve(zone).then(setOutReserve).catch(() => {})
    } catch (error) {
      setStatus(refused(error) ? 'locked' : 'unreachable')
    }
  }, [address, zone])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => {
      if (AppState.currentState === 'active') void refresh()
    }, 5000)
    return () => clearInterval(id)
  }, [refresh])

  const open = useCallback(async () => {
    if (!zone) throw new Error('No private balance on this build.')
    setStatus('opening')
    try {
      const account = await unlock(0n)
      await unlockZone(zone, account)
      await refresh()
    } catch (error) {
      setStatus('locked')
      throw plain(error, 'Your private balance didn’t open. Try again.')
    }
  }, [refresh, unlock, zone])

  const depositFor = useCallback(
    async (amount: bigint, to: Address, note: Omit<PrivateNote, 'hash' | 'at' | 'amount'>) => {
      if (!zone || !address) throw new Error('No private balance on this build.')
      const account = await unlock(amount)
      const started = Date.now()
      let receipt: Awaited<ReturnType<typeof deposit>>
      try {
        receipt = await deposit(walletClient(account) as never, zone, { amount, to, from: account.address })
      } catch (error) {
        explain('deposit failed', error)
        throw plain(error, 'The dollars didn’t move. Nothing left your wallet.')
      }
      spend(amount)
      remember({ ...note, amount: amount.toString(), at: Date.now(), hash: receipt.transactionHash })
      onMoved()
      return { account, receipt, hash: receipt.transactionHash as string, ms: Date.now() - started }
    },
    [address, onMoved, remember, unlock, zone],
  )

  const moveIn = useCallback(
    async (amount: bigint) => {
      if (!zone || !address) throw new Error('No private balance on this build.')
      const { account, receipt, hash, ms } = await depositFor(amount, address, { kind: 'in' })
      // The zone credits it once it has read that Tempo block; the session is open, so no new prompt.
      if (!zoneUnlocked(zone, address)) await unlockZone(zone, account).catch(() => {})
      await waitForZone(zone, receipt.blockNumber).catch(() => {})
      await refresh()
      return { hash, ms }
    },
    [address, depositFor, refresh, zone],
  )

  const sendPrivately = useCallback(
    async (to: { address: Address; name: string }, amount: bigint) => {
      const { hash, ms } = await depositFor(amount, to.address, { kind: 'sent', name: to.name, to: to.address })
      return { hash, ms }
    },
    [depositFor],
  )

  const moveOut = useCallback(
    async (amount: bigint) => {
      if (!zone || !address) throw new Error('No private balance on this build.')
      const account = await unlock(amount)
      const started = Date.now()
      if (!zoneUnlocked(zone, address)) await unlockZone(zone, account)
      const before = await getBalance(address).catch(() => null)
      let hash: string
      try {
        hash = (await withdraw(zone, account, { amount })).transactionHash
      } catch (error) {
        explain('withdrawal failed', error)
        throw plain(error, 'The zone didn’t take it. Your private balance hasn’t changed.')
      }
      spend(amount)
      const note: PrivateNote = { kind: 'out', amount: amount.toString(), at: Date.now(), hash, landed: false }
      remember(note)
      void refresh()
      // The zone settles it on Tempo in its next batch, seconds later: watch it land.
      void (async () => {
        for (let i = 0; i < 120; i++) {
          await new Promise((r) => setTimeout(r, 1000))
          const now = await getBalance(address).catch(() => null)
          if (before !== null && now !== null && now >= before + amount) break
        }
        remember({ ...note, landed: true })
        onMoved()
      })()
      return { hash, ms: Date.now() - started }
    },
    [address, onMoved, refresh, remember, unlock, zone],
  )

  const entries = useMemo<PrivateEntry[]>(() => {
    const list: PrivateEntry[] = []
    const used = new Set<string>()
    for (const move of moves) {
      if (move.kind === 'in') {
        // A deposit's mint names nobody: if this phone moved that amount in just before, it was you.
        const mine = notes.find(
          (n) =>
            n.kind === 'in' &&
            !used.has(n.hash) &&
            BigInt(n.amount) === move.amount &&
            n.at <= move.at + 120_000 &&
            n.at >= move.at - 600_000,
        )
        if (mine) used.add(mine.hash)
        list.push({
          id: move.hash,
          kind: mine ? 'in' : 'arrived',
          amount: move.amount,
          name: mine ? 'Moved in' : 'Arrived privately',
          detail: mine ? 'From your balance' : 'Someone sent you dollars privately',
          at: move.at,
        })
      } else {
        const mine = notes.find((n) => n.hash.toLowerCase() === move.hash.toLowerCase())
        if (mine) used.add(mine.hash)
        list.push({
          id: move.hash,
          kind: 'out',
          amount: move.amount,
          name: 'Moved out',
          detail: mine?.landed === false ? 'On its way to your balance' : 'To your balance',
          at: move.at,
        })
      }
    }
    for (const n of notes) {
      if (used.has(n.hash)) continue
      if (n.kind === 'sent')
        list.push({ id: n.hash, kind: 'sent', amount: BigInt(n.amount), name: n.name ?? 'Someone', detail: 'Sent privately', at: n.at })
      else if (n.kind === 'in' && Date.now() - n.at < 10 * 60_000)
        list.push({ id: n.hash, kind: 'in', amount: BigInt(n.amount), name: 'Moving in', detail: 'Arriving in a moment', at: n.at, pending: true })
    }
    return list.sort((a, b) => b.at - a.at)
  }, [moves, notes])

  return useMemo(
    () => ({ zone, status: zone ? status : 'locked', balance: held, outReserve, entries, open, moveIn, moveOut, sendPrivately }),
    [entries, held, moveIn, moveOut, open, outReserve, sendPrivately, status, zone],
  )
}
