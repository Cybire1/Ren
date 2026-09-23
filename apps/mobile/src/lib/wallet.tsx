import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { type Address, getAddress, type Hex, isAddressEqual } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { confirmCheckout, type Checkout } from './api'
import { confirmWithFace } from './auth'
import { fundFromFaucet, getBalance, incomingSince, payCharge, publicClient, sendMoney } from './chain'
import type { DisplayCurrency } from './money'
import { load, remove, save } from './storage'

/**
 * The wallet lives on the phone. Its key is generated here, kept in the iOS Keychain /
 * Android Keystore, and can only be read after Face ID (or the device's biometrics), so every
 * payment is approved by the owner's face. Kova's servers never see it.
 */

const KEY = 'kova.wallet.key.v1'
const PROFILE = 'kova.profile.v1'
const ACTIVITY = 'kova.activity.v1'
const CONTACTS = 'kova.contacts.v1'
const CURSOR = 'kova.cursor.v1'
const BALANCE = 'kova.balance.v1'
/** How far back the incoming-money scan will catch up, and where a fresh scan starts. */
const MAX_CATCH_UP = 2_000_000n
const RECENT = 50_000n

export interface Profile {
  name: string
  address: Address
  currency: DisplayCurrency
  /** Whether the key needs biometrics to read. False only on a dev simulator without Face ID. */
  protected: boolean
  /** When the wallet was created on this phone (ms). Older wallets predate this field. */
  createdAt?: number
}

export type EntryKind = 'paid' | 'sent' | 'received' | 'added'

export interface Entry {
  id: string
  kind: EntryKind
  /** Base units, as a string for storage. */
  amount: string
  name: string
  detail: string
  address?: Address
  txHash?: string
  ms?: number
  at: number
}

export interface Contact {
  address: Address
  name: string
  currency?: DisplayCurrency
}

export interface Arrival {
  amount: bigint
  name: string
  address: Address
  hash: string
}

type Status = 'loading' | 'none' | 'ready'

interface Wallet {
  status: Status
  profile: Profile | null
  balance: bigint | null
  activity: Entry[]
  contacts: Contact[]
  arrival: Arrival | null
  clearArrival: () => void
  refresh: () => Promise<void>
  create: (name: string, currency: DisplayCurrency) => Promise<void>
  setCurrency: (currency: DisplayCurrency) => Promise<void>
  addMoney: () => Promise<void>
  payCheckout: (checkout: Checkout) => Promise<Entry>
  send: (to: Contact, amount: bigint, note?: string) => Promise<Entry>
  rememberContact: (contact: Contact) => Promise<void>
  signOut: () => Promise<void>
}

const WalletContext = createContext<Wallet | null>(null)

export function useWallet(): Wallet {
  const wallet = useContext(WalletContext)
  if (!wallet) throw new Error('useWallet must be used inside <WalletProvider>')
  return wallet
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [balance, setBalance] = useState<bigint | null>(null)
  const [activity, setActivity] = useState<Entry[]>([])
  const [savedContacts, setSavedContacts] = useState<Contact[]>([])
  const [arrival, setArrival] = useState<Arrival | null>(null)
  /** Faucet top-ups in flight, so their arrival is logged as "Added" rather than "Received". */
  const funding = useRef(false)

  useEffect(() => {
    void (async () => {
      const [p, a, c, b] = await Promise.all([
        load<Profile | null>(PROFILE, null),
        load<Entry[]>(ACTIVITY, []),
        load<Contact[]>(CONTACTS, []),
        load<string | null>(BALANCE, null),
      ])
      // Show the last known balance at once; the chain confirms it moments later.
      if (b !== null) setBalance(BigInt(b))
      setActivity(a)
      setSavedContacts(c)
      setProfile(p)
      setStatus(p ? 'ready' : 'none')
    })()
  }, [])

  const record = useCallback(async (entry: Entry) => {
    setActivity((prev) => {
      if (entry.txHash && prev.some((e) => e.txHash === entry.txHash && e.kind === entry.kind)) return prev
      const next = [entry, ...prev].slice(0, 200)
      void save(ACTIVITY, next)
      return next
    })
  }, [])

  const refresh = useCallback(async () => {
    if (!profile) return
    try {
      const latest = await getBalance(profile.address)
      setBalance(latest)
      void save(BALANCE, latest.toString())
    } catch (error) {
      // Offline: keep showing the last known balance.
      if (__DEV__) {
        const e = error as { shortMessage?: string; details?: string; cause?: { message?: string; details?: string } }
        console.log('[wallet] balance refresh failed', e.shortMessage, '|', e.details, '|', e.cause?.message, '|', e.cause?.details)
      }
    }
  }, [profile])

  const contacts = useMemo(() => {
    const seen = new Map<string, Contact>()
    // Tokens are minted from the zero address (the testnet faucet): that is not a person.
    const zero = '0x0000000000000000000000000000000000000000'
    for (const e of activity) {
      if (e.address?.toLowerCase() === zero) continue
      if ((e.kind === 'sent' || e.kind === 'received') && e.address && !seen.has(e.address.toLowerCase()))
        seen.set(e.address.toLowerCase(), { address: e.address, name: e.name })
    }
    for (const c of savedContacts) {
      const key = c.address.toLowerCase()
      seen.set(key, { ...seen.get(key), ...c })
    }
    return [...seen.values()]
  }, [activity, savedContacts])

  const nameFor = useCallback(
    (address: Address) => contacts.find((c) => isAddressEqual(c.address, address))?.name,
    [contacts],
  )

  // Watch the chain for money arriving while the app is open.
  useEffect(() => {
    if (!profile) return
    let stopped = false
    let busy = false
    const tick = async () => {
      if (busy || AppState.currentState !== 'active') return
      busy = true
      try {
        const saved = await load<string | null>(CURSOR, null)
        const latest = await publicClient.getBlockNumber()
        // A missing or broken cursor (say, saved as 0 while offline) starts from the recent
        // past rather than crawling the whole chain.
        const cursor =
          saved && BigInt(saved) > 0n && latest - BigInt(saved) < MAX_CATCH_UP ? BigInt(saved) : latest - RECENT
        const { transfers, head } = await incomingSince(profile.address, cursor)
        if (stopped) return
        await save(CURSOR, head.toString())
        for (const t of transfers) {
          const topUp = funding.current
          const name = topUp ? 'Test dollars' : (nameFor(t.from) ?? `${t.from.slice(0, 6)}…${t.from.slice(-4)}`)
          await record({
            id: newId(),
            kind: topUp ? 'added' : 'received',
            amount: t.amount.toString(),
            name,
            detail: topUp ? 'Tempo testnet faucet' : 'Arrived',
            address: t.from,
            txHash: t.hash,
            at: Date.now(),
          })
          if (!topUp) setArrival({ amount: t.amount, name, address: t.from, hash: t.hash })
        }
        if (transfers.length) void refresh()
      } catch (error) {
        // Try again on the next tick.
        if (__DEV__) console.log('[wallet] incoming scan failed', error instanceof Error ? error.message.split('\n')[0] : error)
      } finally {
        busy = false
      }
    }
    void tick()
    const id = setInterval(tick, 4000)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [profile, nameFor, record, refresh])

  // The balance refreshes on its own clock, so a failed request (common on the first call after
  // launch) is retried in seconds rather than waiting on anything else.
  useEffect(() => {
    if (!profile) return
    void refresh()
    const id = setInterval(() => {
      if (AppState.currentState === 'active') void refresh()
    }, 6000)
    return () => clearInterval(id)
  }, [profile, refresh])

  /** Reads the key, which makes the OS ask for Face ID. Every signature goes through here. */
  const unlock = useCallback(async () => {
    if (!profile) throw new Error('No wallet on this phone')
    const key = await SecureStore.getItemAsync(KEY, {
      requireAuthentication: profile.protected,
      authenticationPrompt: 'Approve with Face ID',
    })
    if (!key) throw new Error('Face ID was cancelled')
    return privateKeyToAccount(key as Hex)
  }, [profile])

  const create = useCallback(async (name: string, currency: DisplayCurrency) => {
    const [hardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ])
    const canProtect = hardware && enrolled
    if (!canProtect && !__DEV__)
      throw new Error('Turn on Face ID or a passcode in Settings first. Your wallet key needs it.')
    if (canProtect) {
      if (!(await confirmWithFace('Protect your wallet with Face ID'))) throw new Error('Face ID was cancelled')
    }
    const key = generatePrivateKey()
    await SecureStore.setItemAsync(
      KEY,
      key,
      canProtect
        ? { requireAuthentication: true, keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY }
        : { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    )
    const address = privateKeyToAccount(key).address
    const next: Profile = { name: name.trim(), address, currency, protected: canProtect, createdAt: Date.now() }
    await save(PROFILE, next)
    const head = await publicClient.getBlockNumber().catch(() => null)
    if (head !== null) await save(CURSOR, head.toString())
    setProfile(next)
    setBalance(0n)
    setStatus('ready')
  }, [])

  const setCurrency = useCallback(
    async (currency: DisplayCurrency) => {
      if (!profile) return
      const next = { ...profile, currency }
      await save(PROFILE, next)
      setProfile(next)
    },
    [profile],
  )

  const addMoney = useCallback(async () => {
    if (!profile) return
    funding.current = true
    try {
      await fundFromFaucet(profile.address)
      await refresh()
    } finally {
      // Let the watcher see the faucet's transfer before arrivals count as gifts again.
      setTimeout(() => {
        funding.current = false
      }, 10_000)
    }
  }, [profile, refresh])

  const payCheckout = useCallback(
    async (checkout: Checkout) => {
      const account = await unlock()
      const { hash, ms } = await payCharge(account, {
        token: checkout.token,
        payTo: checkout.pay_to,
        amount: BigInt(checkout.amount_base),
        memo: checkout.memo,
      })
      // Kova checks the transaction against the chain itself; this only makes it instant.
      await confirmCheckout(checkout.id, hash).catch(() => {})
      const entry: Entry = {
        id: newId(),
        kind: 'paid',
        amount: checkout.amount_base,
        name: checkout.merchant_name,
        detail: checkout.reference ?? 'Scan to pay',
        address: getAddress(checkout.pay_to),
        txHash: hash,
        ms,
        at: Date.now(),
      }
      await record(entry)
      void refresh()
      return entry
    },
    [unlock, record, refresh],
  )

  const rememberContact = useCallback(async (contact: Contact) => {
    setSavedContacts((prev) => {
      const next = [contact, ...prev.filter((c) => !isAddressEqual(c.address, contact.address))].slice(0, 50)
      void save(CONTACTS, next)
      return next
    })
  }, [])

  const send = useCallback(
    async (to: Contact, amount: bigint, note?: string) => {
      const account = await unlock()
      const { hash, ms } = await sendMoney(account, to.address, amount)
      const entry: Entry = {
        id: newId(),
        kind: 'sent',
        amount: amount.toString(),
        name: to.name,
        detail: note || 'Sent',
        address: to.address,
        txHash: hash,
        ms,
        at: Date.now(),
      }
      await record(entry)
      await rememberContact(to)
      void refresh()
      return entry
    },
    [unlock, record, rememberContact, refresh],
  )

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(KEY)
    await remove(PROFILE, ACTIVITY, CONTACTS, CURSOR, BALANCE)
    setProfile(null)
    setBalance(null)
    setActivity([])
    setSavedContacts([])
    setStatus('none')
  }, [])

  const value: Wallet = {
    status,
    profile,
    balance,
    activity,
    contacts,
    arrival,
    clearArrival: () => setArrival(null),
    refresh,
    create,
    setCurrency,
    addMoney,
    payCheckout,
    send,
    rememberContact,
    signOut,
  }
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}
