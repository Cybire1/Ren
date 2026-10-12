'use client'

import { getNetwork, type NetworkId } from '@kova/tempo'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  type Address,
  defineChain,
  getAddress,
  http,
  isAddressEqual,
  type LocalAccount,
} from 'viem'
import { tempoModerato } from 'viem/chains'
import { Actions, createClient } from 'viem/tempo'
import { balanceOf, type Moved } from '@/lib/wallet/chain'
import { relayedClient } from '@/lib/wallet/chain-tempo'
import { spend } from '@/lib/wallet/session'
import {
  deposit,
  moveOutReserve,
  type PrivateMove,
  privateBalance,
  privateMoves,
  unlockZone,
  waitForZone,
  withdraw,
  type ZoneAccess,
  type ZoneConfig,
  zoneUnlocked,
} from '@/lib/wallet/zone'

/**
 * Your private balance (lib/wallet/zone.ts), for the wallet: what's in it, its history, and moving
 * dollars in, out, and privately to someone. The zone shows a wallet only its own balance, and
 * only once the wallet has signed for it in this tab, so after a reload the balance is locked
 * until the passkey opens it, as private notes are.
 */

export type PrivateKind = 'in' | 'out' | 'sent' | 'arrived'

export interface PrivateEntry {
  id: string
  kind: PrivateKind
  /** Base units. */
  amount: bigint
  name: string
  detail: string
  at: number
  hash: string
  /** Moved here, and the zone (or Tempo, for a move out) hasn't shown it yet. */
  pending?: boolean
}

export interface PrivateValue {
  zone: ZoneConfig | null
  /** locked: the zone needs this wallet's signature first. unreachable: it didn't answer. */
  status: 'locked' | 'opening' | 'ready' | 'unreachable'
  balance: bigint | null
  /** What can move in: your balance on the zone's Tempo. */
  available: bigint | null
  /** What a move out keeps back for the zone's gas (nothing on a current-runtime zone). */
  outReserve: bigint
  entries: PrivateEntry[]
  open: () => Promise<void>
  moveIn: (amount: bigint) => Promise<Moved>
  moveOut: (amount: bigint) => Promise<Moved>
  sendPrivately: (to: { address: string; name: string }, amount: bigint) => Promise<Moved>
  /** What this wallet did with a Tempo transaction into or out of the zone, for public history. */
  noteFor: (hash: string) => PrivateNote | undefined
  /** Every private move this browser made. */
  notes: PrivateNote[]
}

/** What this browser knows about a private move it made. The zone can't say who a deposit was for. */
export interface PrivateNote {
  kind: 'in' | 'out' | 'sent'
  amount: string
  at: number
  /** The Tempo transaction (a deposit) or the zone transaction (a move out). */
  hash: string
  ms: number
  name?: string
  to?: string
  /** A move out that has reached the Tempo balance. */
  landed?: boolean
}

const notesKey = (address: string) => `kova.web.private.v1.${address.toLowerCase()}`
const PATH_USD = '0x20c0000000000000000000000000000000000000' as Address

const readNotes = (address: string): Record<string, PrivateNote> => {
  try {
    return JSON.parse(localStorage.getItem(notesKey(address)) ?? '{}')
  } catch {
    return {}
  }
}

/** A 401 or 403 from the zone: no token, or one that has run out. */
const refused = (error: unknown) => {
  const status =
    (error as { status?: number; cause?: { status?: number } })?.status ??
    (error as { cause?: { status?: number } })?.cause?.status
  return status === 401 || status === 403
}

/** Chain errors in words a person can act on. */
function plain(error: unknown, fallback: string): Error {
  const message = error instanceof Error ? error.message : String(error)
  if (/insufficient|exceeds balance/i.test(message))
    return new Error('Not enough dollars for that. Nothing moved.')
  if (/reject|denied|cancel|not allowed|abort/i.test(message))
    return new Error('Cancelled. Nothing moved.')
  return new Error(fallback)
}

export function usePrivate({
  zone,
  network,
  address,
  balance,
  unlock,
  onMoved,
}: {
  zone: ZoneConfig | null
  network: NetworkId
  address: Address | null
  balance: bigint | null
  unlock: (amount: bigint) => Promise<LocalAccount>
  onMoved: () => void
}): PrivateValue {
  const access = useMemo<ZoneAccess | null>(
    () => (zone ? { zone, rpc: '/api/zone' } : null),
    [zone],
  )
  const [status, setStatus] = useState<PrivateValue['status']>('locked')
  const [held, setHeld] = useState<bigint | null>(null)
  const [moves, setMoves] = useState<PrivateMove[]>([])
  const [notes, setNotes] = useState<Record<string, PrivateNote>>({})
  const [parentBalance, setParentBalance] = useState<bigint | null>(null)
  const [outReserve, setOutReserve] = useState(0n)

  // The zone's Tempo: this site's own, through Ren's relay, or a local test chain with no relay.
  const parent = useMemo(() => {
    if (!zone?.parentRpc) return null
    const chain = defineChain({
      ...tempoModerato,
      id: zone.parent,
      rpcUrls: { default: { http: [zone.parentRpc] } },
    })
    return { chain, rpc: zone.parentRpc }
  }, [zone])
  const parentClient = useCallback(
    (account: LocalAccount) =>
      parent
        ? {
            client: createClient({
              account,
              chain: parent.chain,
              feeToken: PATH_USD,
              transport: http(parent.rpc),
            }),
            sponsored: false,
          }
        : { client: relayedClient(network, account), sponsored: true },
    [network, parent],
  )

  useEffect(() => {
    setNotes(address ? readNotes(address) : {})
    setHeld(null)
    setMoves([])
    setStatus('locked')
  }, [address])

  const remember = useCallback(
    (note: PrivateNote) => {
      if (!address) return
      setNotes((current) => {
        const next = { ...current, [note.hash.toLowerCase()]: note }
        try {
          localStorage.setItem(notesKey(address), JSON.stringify(next))
        } catch {}
        return next
      })
    },
    [address],
  )

  /** Your dollars on the zone's Tempo: the wallet's own balance, unless the zone hangs off a test chain. */
  const tempoBalance = useCallback(async (): Promise<bigint | null> => {
    if (!address || !zone) return null
    if (!parent) return balanceOf(network, address)
    const client = createClient({ chain: parent.chain, transport: http(parent.rpc) })
    const { amount } = await Actions.token.getBalance(client as never, {
      account: address,
      token: zone.token,
    })
    return amount
  }, [address, network, parent, zone])

  const refreshParent = useCallback(async () => {
    if (!parent) return
    const amount = await tempoBalance()
    if (amount !== null) setParentBalance(amount)
  }, [parent, tempoBalance])

  const refresh = useCallback(async () => {
    void refreshParent().catch(() => {})
    if (!access || !address) return
    if (!zoneUnlocked(access.zone, address)) return setStatus('locked')
    try {
      // The balance is what matters; a history the zone won't give right now keeps the last one.
      const [amount, history] = await Promise.all([
        privateBalance(access, address),
        privateMoves(access, address).catch(() => null),
      ])
      setHeld(amount)
      if (history) setMoves(history)
      setStatus('ready')
      void moveOutReserve(access)
        .then(setOutReserve)
        .catch(() => {})
    } catch (error) {
      setStatus(refused(error) ? 'locked' : 'unreachable')
    }
  }, [access, address, refreshParent])

  // Live while open: the balance every few seconds, as the public one is.
  useEffect(() => {
    void refresh()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 5_000)
    return () => clearInterval(timer)
  }, [refresh])

  const open = useCallback(async () => {
    if (!access) throw new Error('This wallet has no private balance here.')
    setStatus('opening')
    try {
      const account = await unlock(0n)
      await unlockZone(access, account)
      await refresh()
    } catch (error) {
      setStatus('locked')
      throw plain(error, 'Your private balance didn’t open. Try again.')
    }
  }, [access, refresh, unlock])

  /** Deposits from the Tempo balance into the zone, for yourself or for them. */
  const depositFor = useCallback(
    async (
      amount: bigint,
      to: Address,
      note: Omit<PrivateNote, 'hash' | 'ms' | 'at' | 'amount'>,
    ) => {
      if (!access || !zone) throw new Error('This wallet has no private balance here.')
      const account = await unlock(amount)
      const started = performance.now()
      const { client, sponsored } = parentClient(account)
      let receipt: Awaited<ReturnType<typeof deposit>>
      try {
        receipt = await deposit(client as never, zone, { amount, to, sponsored })
      } catch (error) {
        throw plain(error, 'The dollars didn’t move. Nothing left your wallet.')
      }
      spend(amount)
      const ms = Math.round(performance.now() - started)
      const hash = receipt.transactionHash
      remember({ ...note, amount: amount.toString(), at: Date.now(), hash, ms })
      onMoved()
      return { account, receipt, hash, ms }
    },
    [access, onMoved, parentClient, remember, unlock, zone],
  )

  const explorerTx = useCallback(
    (hash: string) => (parent ? '' : `${getNetwork(network).explorerUrl}/tx/${hash}`),
    [network, parent],
  )

  const moveIn = useCallback(
    async (amount: bigint) => {
      if (!access || !address) throw new Error('Open your wallet first.')
      const { account, receipt, hash, ms } = await depositFor(amount, address, { kind: 'in' })
      // The zone credits it once it has read that Tempo block, a second or two later. Opening the
      // zone now costs no second prompt: the passkey just approved, so the session is open.
      if (!zoneUnlocked(access.zone, address)) await unlockZone(access, account).catch(() => {})
      await waitForZone(access, receipt.blockNumber).catch(() => {})
      await refresh()
      return { hash, ms, explorer: explorerTx(hash) }
    },
    [access, address, depositFor, explorerTx, refresh],
  )

  const sendPrivately = useCallback(
    async (to: { address: string; name: string }, amount: bigint) => {
      const { hash, ms } = await depositFor(amount, getAddress(to.address), {
        kind: 'sent',
        name: to.name,
        to: to.address,
      })
      return { hash, ms, explorer: explorerTx(hash) }
    },
    [depositFor, explorerTx],
  )

  const moveOut = useCallback(
    async (amount: bigint) => {
      if (!access || !address) throw new Error('Open your wallet first.')
      const account = await unlock(amount)
      const started = performance.now()
      if (!zoneUnlocked(access.zone, address)) await unlockZone(access, account)
      const before = await tempoBalance().catch(() => null)
      let hash: `0x${string}`
      try {
        hash = (await withdraw(access, account, { amount })).transactionHash
      } catch (error) {
        throw plain(error, 'The zone didn’t take it. Your private balance hasn’t changed.')
      }
      spend(amount)
      const ms = Math.round(performance.now() - started)
      const note: PrivateNote = {
        kind: 'out',
        amount: amount.toString(),
        at: Date.now(),
        hash,
        ms,
        landed: false,
      }
      remember(note)
      void refresh()
      // The zone's sequencer settles it on Tempo in its next batch, seconds later: watch it land.
      void (async () => {
        for (let i = 0; i < 120; i++) {
          await new Promise((r) => setTimeout(r, 1_000))
          const now = await tempoBalance().catch(() => null)
          if (before !== null && now !== null && now >= before + amount) break
        }
        remember({ ...note, landed: true })
        void refreshParent().catch(() => {})
        onMoved()
      })()
      return { hash, ms, explorer: '' }
    },
    [access, address, onMoved, refresh, refreshParent, remember, tempoBalance, unlock],
  )

  // History: what the zone shows its owner, named from what this browser did.
  const entries = useMemo<PrivateEntry[]>(() => {
    const list: PrivateEntry[] = []
    const used = new Set<string>()
    const notesList = Object.values(notes)
    for (const move of moves) {
      if (move.kind === 'in') {
        // A deposit's mint names nobody: if this browser moved that amount in just before, it was you.
        const mine = notesList.find(
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
          hash: move.hash,
        })
      } else {
        const mine = notes[move.hash.toLowerCase()]
        if (mine) used.add(mine.hash)
        list.push({
          id: move.hash,
          kind: 'out',
          amount: move.amount,
          name: 'Moved out',
          detail: mine?.landed === false ? 'On its way to your balance' : 'To your balance',
          at: move.at,
          hash: move.hash,
        })
      }
    }
    for (const n of notesList) {
      if (used.has(n.hash)) continue
      if (n.kind === 'sent')
        list.push({
          id: n.hash,
          kind: 'sent',
          amount: BigInt(n.amount),
          name: n.name ?? 'Someone',
          detail: 'Sent privately',
          at: n.at,
          hash: n.hash,
        })
      else if (n.kind === 'in' && Date.now() - n.at < 10 * 60_000)
        list.push({
          id: n.hash,
          kind: 'in',
          amount: BigInt(n.amount),
          name: 'Moving in',
          detail: 'Arriving in a moment',
          at: n.at,
          hash: n.hash,
          pending: true,
        })
    }
    return list.sort((a, b) => b.at - a.at)
  }, [moves, notes])

  const noteFor = useCallback((hash: string) => notes[hash.toLowerCase()], [notes])
  const noteList = useMemo(() => Object.values(notes), [notes])

  return useMemo(
    () => ({
      zone,
      status: zone ? status : 'locked',
      balance: held,
      available: parent ? parentBalance : balance,
      outReserve,
      entries,
      open,
      moveIn,
      moveOut,
      sendPrivately,
      noteFor,
      notes: noteList,
    }),
    [
      balance,
      entries,
      held,
      moveIn,
      moveOut,
      noteFor,
      noteList,
      open,
      outReserve,
      parent,
      parentBalance,
      sendPrivately,
      status,
      zone,
    ],
  )
}

/** Whether a Tempo transfer went into the zone, or came out of it. */
export const isZonePortal = (zone: ZoneConfig | null, address: string | undefined) =>
  !!zone && !!address && isAddressEqual(zone.portal, address as Address)
