import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, isMeraError } from '@category-labs/mera'
import { base64urlnopad } from '@scure/base'
import * as SecureStore from 'expo-secure-store'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { type Address, getAddress, isAddress, isAddressEqual, type LocalAccount } from 'viem'
import type { Checkout } from './api'
import { fundFromFaucet, getBalance, incomingSince, payCharge, sendMoney } from './chain'
import { chainKey, passkeyDomain } from './config'
import { openSigningSession } from './keys'
import { type DisplayCurrency, formatUsd } from './money'
import { kovaWebAuthnClient, takeVaultOutput } from './passkey'
import { endSession, sessionAccount, spend, startSession } from './session'
import { load, remove, save } from './storage'
import { forgetVaultSecret, keepVaultSecret, openVault, saveVault } from './vault'

/**
 * The wallet is a passkey. Creating it takes one Face ID: the passkey, which iCloud Keychain
 * keeps and carries to your next phone, gives Kova a 32-byte secret, and the account is derived
 * from it (Mera's derivation, keys.ts), the same address on Tempo and on Monad. No seed phrase,
 * and nothing for Kova's servers to hold.
 *
 * On this phone the secret waits in the Keychain behind Face ID. Approving a payment opens a
 * short signing session (see session.ts), so a few small payments in a row need one Face ID.
 * On a new phone, the same passkey brings the same wallet back.
 */

const PRF = chainKey('prf.v1')
const PROFILE = 'kova.profile.v1'
// History, balance and the block cursor belong to one chain, so each chain's build keeps its own.
const ACTIVITY = chainKey('activity.v1')
const CONTACTS = 'kova.contacts.v1'
const CURSOR = chainKey('cursor.v1')
const BALANCE = chainKey('balance.v1')

/** How test dollars read in Activity and on receipts. */
export const TEST_DOLLARS_DETAIL = 'Ren test dollars'

export interface Profile {
  name: string
  address: Address
  currency: DisplayCurrency
  /** Whether the key needs biometrics to read. False only on a dev simulator without Face ID. */
  protected: boolean
  /** When the wallet was created on this phone (ms). Older wallets predate this field. */
  createdAt?: number
  /** The passkey this wallet comes from, so Kova asks for that one and no other. */
  passkey?: { credentialId: string; transports?: readonly string[] }
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

/** A contact we only know by address: shown as "0x12ab…cdef" until you give them a name. */
export const isUnnamed = (name: string) => name.startsWith('0x')

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
  /** Makes a passkey, and the wallet with it. One Face ID. */
  create: (name: string, currency: DisplayCurrency) => Promise<void>
  /**
   * Development only: a wallet from a random secret, without the passkey sheet a simulator can't
   * be tapped through, so the dev link reaches every screen. It keeps no secret: its session is
   * all it has, and it ends with the app.
   */
  createForDev?: (name: string, currency: DisplayCurrency) => Promise<void>
  /** Brings a wallet back from its passkey, on this phone or a new one. The name may be empty. */
  restore: () => Promise<Profile>
  setName: (name: string) => Promise<void>
  setCurrency: (currency: DisplayCurrency) => Promise<void>
  addMoney: () => Promise<void>
  payCheckout: (checkout: Checkout) => Promise<Entry>
  send: (to: Contact, amount: bigint, note?: string) => Promise<Entry>
  rememberContact: (contact: Contact) => Promise<void>
  /** Your own name for someone. It replaces their address everywhere, past payments included. */
  renameContact: (address: Address, name: string) => Promise<void>
  /**
   * Signs a message as this wallet (the open session, or Face ID): Kova's shop sign-in and shop
   * ownership, which the web checks the same way. It moves no money.
   */
  signMessage: (message: string) => Promise<`0x${string}`>
  signOut: () => Promise<void>
}

const WalletContext = createContext<Wallet | null>(null)

export function useWallet(): Wallet {
  const wallet = useContext(WalletContext)
  if (!wallet) throw new Error('useWallet must be used inside <WalletProvider>')
  return wallet
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/** Keeps the passkey's secret on this phone, readable only after Face ID. */
async function keep(prf: Uint8Array) {
  await SecureStore.setItemAsync(PRF, base64urlnopad.encode(prf), {
    requireAuthentication: true,
    keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  })
}

/** What went wrong with a passkey, in words someone can act on. */
function passkeyProblem(error: unknown): string {
  if (isMeraError(error) && error.code === 'PRF_UNAVAILABLE')
    return 'This phone’s passkeys can’t hold a wallet yet. Ren needs iOS 18 or later, with iCloud Keychain on.'
  const message = error instanceof Error ? error.message : ''
  if (/cancel/i.test(message)) return 'Cancelled. Nothing was changed.'
  return 'The passkey didn’t open. Try again.'
}

/** Opens a signing session from the passkey's secret, and checks it is this wallet's. */
async function begin(prf: Uint8Array, expected?: Address): Promise<LocalAccount> {
  const { session, account } = await openSigningSession(prf)
  prf.fill(0)
  if (expected && !isAddressEqual(account.address, expected)) {
    session.end()
    throw new Error('That passkey belongs to a different Ren wallet.')
  }
  startSession(session, account)
  return account
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [balance, setBalance] = useState<bigint | null>(null)
  const [activity, setActivity] = useState<Entry[]>([])
  const [savedContacts, setSavedContacts] = useState<Contact[]>([])
  const [arrival, setArrival] = useState<Arrival | null>(null)

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
      setSavedContacts(c.filter((x) => isAddress(x.address)))
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

  // Back up the vault a moment after the owner changes their name, currency or a contact: the
  // changes that set `edited`, not the ones that come from loading or restoring.
  const edited = useRef(false)
  useEffect(() => {
    if (!edited.current || !profile?.name) return
    const timer = setTimeout(() => {
      edited.current = false
      void saveVault({ v: 1, name: profile.name, currency: profile.currency, contacts: savedContacts }).catch(() => {})
    }, 1500)
    return () => clearTimeout(timer)
  }, [profile?.name, profile?.currency, savedContacts])

  // The names you gave people, applied to every payment with them, past ones included.
  const named = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of savedContacts) if (!isUnnamed(c.name)) map.set(c.address.toLowerCase(), c.name)
    return map
  }, [savedContacts])
  const shownActivity = useMemo(
    () =>
      activity.map((e) => {
        const name = (e.kind === 'sent' || e.kind === 'received') && e.address ? named.get(e.address.toLowerCase()) : undefined
        return name && name !== e.name ? { ...e, name } : e
      }),
    [activity, named],
  )

  const nameFor = useCallback(
    (address: Address) => contacts.find((c) => isAddressEqual(c.address, address))?.name,
    [contacts],
  )

  // Watch for money arriving while the app is open. Kova's index of the chain answers; a wallet
  // with no cursor yet (new, or restored on a fresh phone) gets everything it ever received.
  useEffect(() => {
    if (!profile) return
    let stopped = false
    let busy = false
    const tick = async () => {
      if (busy || AppState.currentState !== 'active') return
      busy = true
      try {
        const saved = await load<string | null>(CURSOR, null)
        const cursor = saved && /^\d+$/.test(saved) ? BigInt(saved) : 0n
        const { transfers, head } = await incomingSince(profile.address, cursor)
        if (stopped) return
        await save(CURSOR, head.toString())
        for (const t of transfers) {
          const refund = t.kind === 'refund'
          const name = t.faucet ? 'Test dollars' : refund ? 'Refund' : (nameFor(t.from) ?? `${t.from.slice(0, 6)}…${t.from.slice(-4)}`)
          await record({
            id: newId(),
            kind: t.faucet ? 'added' : 'received',
            amount: t.amount.toString(),
            name,
            detail: t.faucet ? TEST_DOLLARS_DETAIL : refund ? 'Money back from a booking' : 'Arrived',
            address: t.from,
            txHash: t.hash,
            at: Date.now(),
          })
          if (!t.faucet) setArrival({ amount: t.amount, name, address: t.from, hash: t.hash })
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

  /**
   * The account that signs a payment of `amount`. Inside a live session it answers at once;
   * otherwise Face ID opens the Keychain, and a new session starts. Every signature goes through here.
   */
  const unlock = useCallback(
    async (amount: bigint) => {
      if (!profile) throw new Error('No wallet on this phone')
      const open = sessionAccount(amount)
      if (open) return open
      const stored = await SecureStore.getItemAsync(PRF, {
        requireAuthentication: true,
        authenticationPrompt: amount > 0n ? `Approve ${formatUsd(amount)}` : 'Open your wallet',
      }).catch(() => {
        throw new Error('Face ID was cancelled. Nothing was paid.')
      })
      if (stored) return begin(base64urlnopad.decode(stored), profile.address)
      // The Keychain copy is gone (a new passcode, a restored phone): ask the passkey itself.
      const asserted = await getPasskeyPrfOutput({
        rpId: passkeyDomain,
        ...(profile.passkey ? { credential: profile.passkey } : {}),
        webAuthnClient: kovaWebAuthnClient,
      }).catch((error) => {
        throw new Error(passkeyProblem(error))
      })
      const vault = takeVaultOutput()
      if (vault) await keepVaultSecret(vault)
      await keep(asserted.prfOutput)
      return begin(asserted.prfOutput, profile.address)
    },
    [profile],
  )

  const create = useCallback(async (name: string, currency: DisplayCurrency) => {
    const clean = name.trim()
    const created = await createPasskeyWithPrfOutput({
      rp: { id: passkeyDomain, name: 'Ren' },
      user: { name: clean, displayName: clean },
      webAuthnClient: kovaWebAuthnClient,
    }).catch((error) => {
      throw new Error(passkeyProblem(error))
    })
    const vault = takeVaultOutput()
    if (vault) await keepVaultSecret(vault)
    await keep(created.prfOutput)
    const account = await begin(created.prfOutput)
    const next: Profile = {
      name: clean,
      address: account.address,
      currency,
      protected: true,
      createdAt: Date.now(),
      passkey: { credentialId: created.credentialId, ...(created.transports ? { transports: created.transports } : {}) },
    }
    await save(PROFILE, next)
    setProfile(next)
    setBalance(0n)
    setStatus('ready')
    void saveVault({ v: 1, name: next.name, currency: next.currency, contacts: [] }).catch(() => {})
  }, [])

  const restore = useCallback(async () => {
    const asserted = await getPasskeyPrfOutput({ rpId: passkeyDomain, webAuthnClient: kovaWebAuthnClient }).catch((error) => {
      throw new Error(passkeyProblem(error))
    })
    const vault = takeVaultOutput()
    if (vault) await keepVaultSecret(vault)
    await keep(asserted.prfOutput)
    const account = await begin(asserted.prfOutput)
    // Who you are comes back from the vault this passkey sealed, if it sealed one.
    const backup = vault ? await openVault(vault).catch(() => null) : null
    const restoredContacts = (backup?.contacts ?? []).filter((c) => isAddress(c.address)) as Contact[]
    if (restoredContacts.length) {
      setSavedContacts(restoredContacts)
      await save(CONTACTS, restoredContacts)
    }
    // A fresh history for this wallet: Kova's index of the chain brings back what arrived.
    await remove(ACTIVITY, CURSOR, BALANCE)
    const next: Profile = {
      name: backup?.name ?? '',
      address: account.address,
      currency: (backup?.currency as DisplayCurrency | undefined) ?? 'USD',
      protected: true,
      createdAt: Date.now(),
      passkey: { credentialId: asserted.credentialId },
    }
    await save(PROFILE, next)
    setActivity([])
    setProfile(next)
    setBalance(null)
    setStatus('ready')
    return next
  }, [])

  const setName = useCallback(
    async (name: string) => {
      if (!profile || name.trim().length < 2) return
      const next = { ...profile, name: name.trim() }
      await save(PROFILE, next)
      edited.current = true
      setProfile(next)
    },
    [profile],
  )

  const setCurrency = useCallback(
    async (currency: DisplayCurrency) => {
      if (!profile) return
      const next = { ...profile, currency }
      await save(PROFILE, next)
      edited.current = true
      setProfile(next)
    },
    [profile],
  )

  const addMoney = useCallback(async () => {
    if (!profile) return
    await fundFromFaucet(profile.address)
    await refresh()
  }, [profile, refresh])

  const payCheckout = useCallback(
    async (checkout: Checkout) => {
      const amount = BigInt(checkout.amount_base)
      const account = await unlock(amount)
      // Kova submits the signed payment and settles it before answering, so paid means paid.
      const { hash, ms } = await payCharge(account, checkout)
      spend(amount)
      const entry: Entry = {
        id: newId(),
        kind: 'paid',
        amount: checkout.amount_base,
        name: checkout.order?.stall?.name ?? checkout.merchant_name,
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
      const before = prev.find((c) => isAddressEqual(c.address, contact.address))
      // Paying someone by address must not wipe the name you gave them.
      const name = isUnnamed(contact.name) && before && !isUnnamed(before.name) ? before.name : contact.name
      const merged = { ...before, ...contact, name, currency: contact.currency ?? before?.currency }
      const next = [merged, ...prev.filter((c) => !isAddressEqual(c.address, contact.address))].slice(0, 50)
      void save(CONTACTS, next)
      edited.current = true
      return next
    })
  }, [])

  const renameContact = useCallback(async (address: Address, name: string) => {
    const clean = name.trim()
    if (!clean || !isAddress(address)) return
    setSavedContacts((prev) => {
      const before = prev.find((c) => isAddressEqual(c.address, address))
      const next = before
        ? prev.map((c) => (c === before ? { ...c, name: clean } : c))
        : [{ address, name: clean }, ...prev].slice(0, 50)
      void save(CONTACTS, next)
      edited.current = true
      return next
    })
  }, [])

  const send = useCallback(
    async (to: Contact, amount: bigint, note?: string) => {
      const account = await unlock(amount)
      const { hash, ms } = await sendMoney(account, to.address, amount)
      spend(amount)
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
    // The passkey itself stays in iCloud Keychain: it can bring this wallet back at any time.
    endSession()
    await SecureStore.deleteItemAsync(PRF)
    await forgetVaultSecret()
    await remove(PROFILE, ACTIVITY, CONTACTS, CURSOR, BALANCE)
    setProfile(null)
    setBalance(null)
    setActivity([])
    setSavedContacts([])
    setStatus('none')
  }, [])

  const signMessage = useCallback(async (message: string) => (await unlock(0n)).signMessage({ message }), [unlock])

  const createForDev = useCallback(async (name: string, currency: DisplayCurrency) => {
    if (!__DEV__) throw new Error('Development only')
    const account = await begin(crypto.getRandomValues(new Uint8Array(32)))
    const next: Profile = { name: name.trim(), address: account.address, currency, protected: false, createdAt: Date.now() }
    await save(PROFILE, next)
    setProfile(next)
    setBalance(0n)
    setStatus('ready')
  }, [])

  const value: Wallet = {
    status,
    profile,
    balance,
    activity: shownActivity,
    contacts,
    arrival,
    clearArrival: () => setArrival(null),
    refresh,
    create,
    ...(__DEV__ ? { createForDev } : {}),
    restore,
    setName,
    setCurrency,
    addMoney,
    payCheckout,
    send,
    rememberContact,
    renameContact,
    signMessage,
    signOut,
  }
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}
