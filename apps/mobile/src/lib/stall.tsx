import * as SecureStore from 'expo-secure-store'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import {
  createOwnerKey,
  createPairing,
  createStall,
  getOwnedShop,
  getStall,
  linkShopOwner,
  listStalls,
  onOwnerKeyRevoked,
  openShop,
  type StallDetail,
  setOwnerKey,
  shopChallenge,
} from './api'
import { confirmWithFace } from './auth'
import { useTerminal } from './terminal'
import { useWallet } from './wallet'

/**
 * The shop this phone opened, if it opened one.
 *
 * Opening a stall from the wallet creates a shop that settles into this wallet, keeps the
 * shop's owner key in the Keychain (this device only, never backed up), pairs the phone as
 * the shop's first terminal, and opens its first stall. Each step is saved as it succeeds, so
 * a dropped connection halfway resumes where it stopped rather than opening a second shop.
 */
interface Owned {
  merchantId: string
  name: string
  stallId: string | null
}

export type OpenStep = 'shop' | 'stall' | 'till' | 'done'

interface StallState {
  ready: boolean
  /** Set when this phone opened a shop and holds its owner key. */
  owned: Owned | null
  /** The shop, its stall and this phone as its till are all set up. False midway, or once unpaired. */
  complete: boolean
  /** The stall and what it sells, as last loaded. */
  stall: StallDetail | null
  refresh: () => Promise<StallDetail | null>
  /** Shows a change at once; the server's answer replaces it on the next refresh. */
  patch: (next: StallDetail) => void
  open: (input: { name: string; tagline?: string; phone: string; settleTo: string }, onStep?: (step: OpenStep) => void) => Promise<void>
  /** The owner key, after Face ID, to sign in to the Kova dashboard with. */
  revealKey: () => Promise<string | null>
  /** Whether the wallet's passkey signs in to this shop on the web. Null until known. */
  ownerLinked: boolean | null
  /** Makes this wallet the shop's owner, for a shop opened before shops had owners. One Face ID. */
  linkOwner: () => Promise<void>
}

const STORE = 'kova.owner.v1'
const Ctx = createContext<StallState | null>(null)

export function useStall(): StallState {
  const value = useContext(Ctx)
  if (!value) throw new Error('useStall must be used inside <StallProvider>')
  return value
}

type Saved = Owned & { key: string }

async function save(saved: Saved) {
  await SecureStore.setItemAsync(STORE, JSON.stringify(saved), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })
}

export function StallProvider({ children }: { children: ReactNode }) {
  const terminal = useTerminal()
  const wallet = useWallet()
  const [ready, setReady] = useState(false)
  const [owned, setOwned] = useState<Owned | null>(null)
  const [stall, setStall] = useState<StallDetail | null>(null)
  const saved = useRef<Saved | null>(null)
  const [ownerLinked, setOwnerLinked] = useState<boolean | null>(null)

  useEffect(() => {
    void (async () => {
      const raw = await SecureStore.getItemAsync(STORE).catch(() => null)
      if (raw) {
        const value = JSON.parse(raw) as Saved
        saved.current = value
        setOwnerKey(value.key)
        setOwned({ merchantId: value.merchantId, name: value.name, stallId: value.stallId })
      }
      setReady(true)
    })()
  }, [])

  const remember = useCallback(async (next: Saved) => {
    saved.current = next
    await save(next)
    setOwned({ merchantId: next.merchantId, name: next.name, stallId: next.stallId })
  }, [])

  const refresh = useCallback(async () => {
    const current = saved.current
    if (!current) return null
    let stallId = current.stallId
    try {
      if (stallId) {
        const detail = await getStall(stallId)
        setStall(detail)
        return detail
      }
    } catch (error) {
      // Closed for good from the dashboard: fall through and pick up the shop's next stall.
      if (!(error instanceof Error) || !/no such|not found/i.test(error.message)) throw error
    }
    const [first] = await listStalls()
    stallId = first?.id ?? null
    await remember({ ...current, stallId })
    if (!stallId) {
      setStall(null)
      return null
    }
    const detail = await getStall(stallId)
    setStall(detail)
    return detail
  }, [remember])

  // Load the stall once the key is in, and again whenever the app comes back to the front.
  useEffect(() => {
    if (!owned) return
    const load = () => void refresh().catch(() => {})
    load()
    const sub = AppState.addEventListener('change', (state) => state === 'active' && load())
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owned?.merchantId])

  // The owner key was revoked from the dashboard: this phone no longer runs the shop.
  useEffect(() => {
    onOwnerKeyRevoked(() => {
      saved.current = null
      setOwnerKey(null)
      setOwned(null)
      setStall(null)
      void SecureStore.deleteItemAsync(STORE)
    })
    return () => onOwnerKeyRevoked(null)
  }, [])

  const open = useCallback<StallState['open']>(
    async ({ name, tagline, phone, settleTo }, onStep) => {
      let current = saved.current
      if (!current) {
        onStep?.('shop')
        // The wallet opening the shop owns it, so its passkey signs in to the same shop on the
        // web. One Face ID, or none if the wallet is already open.
        const me = wallet.profile?.address
        if (!me) throw new Error('Open your wallet first.')
        const challenge = await shopChallenge(me, 'open_shop')
        const signature = await wallet.signMessage(challenge.message)
        const shop = await openShop(name, settleTo, { message: challenge.message, signature })
        // That sign-in key lapses with a web session; the till gets a lasting owner key of its own.
        setOwnerKey(shop.key)
        const lasting = await createOwnerKey('Ren app')
        setOwnerKey(lasting.secret)
        current = { merchantId: shop.id, name: shop.name, stallId: null, key: lasting.secret }
        await remember(current)
      }
      if (!current.stallId) {
        onStep?.('stall')
        const created = await createStall({ name, tagline: tagline?.trim() || null })
        current = { ...current, stallId: created.id }
        await remember(current)
      }
      if (terminal.paired?.merchantId !== current.merchantId) {
        onStep?.('till')
        // A phone that was another shop's terminal stops being one (the screen asked first).
        if (terminal.paired) await terminal.unpair()
        const { code } = await createPairing()
        await terminal.pair(code, phone)
      }
      await refresh()
      onStep?.('done')
    },
    [remember, refresh, terminal, wallet],
  )

  // Whether this wallet already signs in to the shop on the web.
  const me = wallet.profile?.address
  useEffect(() => {
    if (!owned || !me) return
    let live = true
    getOwnedShop()
      .then((shop) => live && setOwnerLinked(shop.owner_address?.toLowerCase() === me.toLowerCase()))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [owned, me])

  const linkOwner = useCallback(async () => {
    if (!me) throw new Error('Open your wallet first.')
    const challenge = await shopChallenge(me, 'own_shop')
    const signature = await wallet.signMessage(challenge.message)
    const shop = await linkShopOwner(challenge.message, signature)
    setOwnerLinked(shop.owner_address?.toLowerCase() === me.toLowerCase())
  }, [me, wallet])

  const revealKey = useCallback(async () => {
    if (!saved.current) return null
    if (!(await confirmWithFace('Copy your shop key'))) return null
    return saved.current.key
  }, [])

  const complete = Boolean(owned?.stallId) && terminal.paired?.merchantId === owned?.merchantId
  return <Ctx.Provider value={{ ready, owned, complete, stall, refresh, patch: setStall, open, revealKey, ownerLinked, linkOwner }}>{children}</Ctx.Provider>
}
