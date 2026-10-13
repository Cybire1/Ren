import { approvalMessage, type KeyTerms, keyLimits, keyScopes, walletSignInMessage } from '@kova/tempo'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { type Address, getAddress, type Hex, type LocalAccount } from 'viem'
import { Actions } from 'viem/tempo'
import { publicClient, walletClient } from './chain-tempo'
import { heldKeys, keepKey, makeKey, spendingAccount } from './held-keys'
import { apiUrl, onTempo, webUrl } from './config'

/**
 * Keys (the API's services/keys.ts), for the wallet: everything that can spend its dollars short of
 * the wallet itself, the payments its agents are waiting on, and the allowances others gave it. The
 * app's twin of apps/web components/wallet/keys-state.ts.
 *
 * The wallet signs in to its keys once (a signed message, no money moves) and keeps the token in
 * memory. Putting a key on-chain, freezing it and removing it are transactions the wallet's own key
 * signs, through Ren's relay, so they cost nothing; the API only records and checks them.
 */

export type KeyKind = 'agent' | 'allowance' | 'card'
export type KeyStatus = 'pending' | 'active' | 'frozen' | 'revoked' | 'expired'

export interface KeyView {
  id: string
  kind: KeyKind
  label: string
  status: KeyStatus
  owner: Address
  key_id: Address | null
  key_type: string
  holder: Address | null
  holder_name: string | null
  token: Address
  limit: string
  period: 'day' | 'week'
  remaining: string | null
  period_ends_at: string | null
  expires_at: string
  rules: { per_payment: string; approve_above: string; payees: 'anyone' | Address[] } | null
  last_used_at: string | null
  created_at: string
}

export interface KeyPaymentView {
  id: string
  key: { id: string; label?: string; kind?: KeyKind }
  kind: 'pay' | 'mpp' | 'charge'
  to: Address
  amount: string
  origin: string | null
  url: string | null
  description: string | null
  status: 'paid' | 'denied' | 'pending_approval' | 'approved' | 'declined' | 'failed' | 'expired' | 'paying'
  reason: string | null
  tx_hash: string | null
  created_at: string
  decided_at: string | null
}

interface Authorization {
  key_id: Address
  key_type: 'secp256k1' | 'p256'
  token: Address
  limit_units: string
  period: number
  expiry: number
  payees: 'anyone' | Address[]
}

export interface AgentInput {
  label: string
  limit: string
  period: 'day' | 'week'
  days: number
  perPayment: string
  approveAbove: string
  payees: 'anyone' | Address[]
}

export interface AllowanceInput {
  label: string
  limit: string
  period: 'day' | 'week'
  days: number
}

export interface Keys {
  /** Only Tempo builds have keys: a Monad build's limits live in its card contract. */
  available: boolean
  status: 'signed-out' | 'signing-in' | 'ready' | 'unavailable'
  given: KeyView[]
  received: KeyView[]
  approvals: KeyPaymentView[]
  mcpUrl: string
  signIn: () => Promise<void>
  refresh: () => Promise<void>
  createAgent: (input: AgentInput) => Promise<{ key: KeyView; token: string; ms: number }>
  createAllowance: (input: AllowanceInput) => Promise<{ key: KeyView; link: string }>
  /** Links a Ren Card: its chip's key goes on-chain with a daily limit (lib/card-tempo.ts). */
  createCard: (input: { label: string; keyId: Address; limit: string; days: number }) => Promise<KeyView>
  switchOn: (key: KeyView) => Promise<KeyView>
  freeze: (key: KeyView) => Promise<void>
  unfreeze: (key: KeyView) => Promise<void>
  remove: (key: KeyView) => Promise<void>
  newToken: (key: KeyView) => Promise<string>
  payments: (key: KeyView) => Promise<KeyPaymentView[]>
  answer: (payment: KeyPaymentView, decision: 'approve' | 'decline') => Promise<KeyPaymentView>
  /** This wallet's signed-in token for Ren's API (keys, cash-outs), signing in if it must. */
  token: () => Promise<string>
  /** Accept an allowance from its link: this phone makes the key, and the giver switches it on. */
  claim: (code: string, name: string | undefined) => Promise<KeyView>
  /** Allowances given to this wallet that this phone holds the key for, as the chain sees them now. */
  held: HeldAllowance[]
  /** Pays from an allowance: the giver's dollars, signed for by this phone's key. */
  spend: (allowance: HeldAllowance, to: Address, amount: bigint, memo?: Hex) => Promise<{ hash: Hex; ms: number }>
}

/** An allowance this phone can spend: read from the chain, so it needs no sign-in to show. */
export interface HeldAllowance {
  id: string
  owner: Address
  keyId: Address
  token: Address
  limit: bigint
  period: 'day' | 'week'
  expiresAt: string
  remaining: bigint
  renewsAt: number | null
  live: boolean
}

class KeysError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function call<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown; token?: string } = {}): Promise<T> {
  const response = await fetch(`${apiUrl}/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  })
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
  if (!response.ok) throw new KeysError(body.error?.message ?? `Ren is unreachable (${response.status})`, response.status)
  return body as T
}

const randomHex = (bytes: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('')

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()
const units = (dollars: string) => BigInt(Math.round(Number(dollars) * 1e6))

export function useKeys({
  address,
  unlock,
}: {
  address: Address | null
  unlock: (amount: bigint) => Promise<LocalAccount>
}): Keys {
  const [status, setStatus] = useState<Keys['status']>('signed-out')
  const [given, setGiven] = useState<KeyView[]>([])
  const [received, setReceived] = useState<KeyView[]>([])
  const [approvals, setApprovals] = useState<KeyPaymentView[]>([])
  const session = useRef<{ token: string; expires: number } | null>(null)
  const [held, setHeld] = useState<HeldAllowance[]>([])

  // The allowances this phone holds the key for, and what the chain says each can spend now.
  const readHeld = useCallback(async () => {
    if (!address) return setHeld([])
    const mine = (await heldKeys()).filter((k) => k.holder.toLowerCase() === address.toLowerCase())
    if (mine.length === 0) return setHeld([])
    const read = await Promise.all(
      mine.map(async (k): Promise<HeldAllowance> => {
        const [meta, limit] = await Promise.all([
          Actions.accessKey.getMetadata(publicClient as never, { account: k.owner, accessKey: k.keyId }).catch(() => null),
          Actions.accessKey.getRemainingLimit(publicClient as never, { account: k.owner, accessKey: k.keyId, token: k.token }).catch(() => null),
        ])
        const live = Boolean(meta && Number(meta.expiry) > Date.now() / 1000 && !meta.isRevoked)
        return {
          id: k.id,
          owner: k.owner,
          keyId: k.keyId,
          token: k.token,
          limit: BigInt(k.limit),
          period: k.period,
          expiresAt: k.expiresAt,
          remaining: live ? (limit?.remaining ?? 0n) : 0n,
          renewsAt: limit?.periodEnd ? Number(limit.periodEnd) * 1000 : null,
          live,
        }
      }),
    )
    setHeld(read)
  }, [address])

  useEffect(() => {
    void readHeld()
    const id = setInterval(() => {
      if (AppState.currentState === 'active') void readHeld()
    }, 15_000)
    return () => clearInterval(id)
  }, [readHeld])

  useEffect(() => {
    setGiven([])
    setReceived([])
    setApprovals([])
    session.current = null
    setStatus('signed-out')
  }, [address])

  const token = useCallback(async (): Promise<string> => {
    if (!address) throw new Error('Open your wallet first.')
    if (session.current && session.current.expires > Date.now() + 60_000) return session.current.token
    setStatus('signing-in')
    try {
      const account = await unlock(0n)
      const message = walletSignInMessage({ address, issuedAt: new Date().toISOString(), nonce: randomHex(16) })
      const signed = await call<{ token: string; expires_at: string }>(`wallets/${address}/keys/sign-in`, {
        method: 'POST',
        body: { message, signature: await account.signMessage({ message }) },
      })
      session.current = { token: signed.token, expires: Date.parse(signed.expires_at) }
      setStatus('ready')
      return signed.token
    } catch (error) {
      setStatus(error instanceof KeysError && error.status === 409 ? 'unavailable' : 'signed-out')
      throw error
    }
  }, [address, unlock])

  const authed = useCallback(
    async <T,>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> => {
      try {
        return await call<T>(path, { ...init, token: await token() })
      } catch (error) {
        if (error instanceof KeysError && error.status === 401) {
          session.current = null
          return call<T>(path, { ...init, token: await token() })
        }
        throw error
      }
    },
    [token],
  )

  const refresh = useCallback(async () => {
    if (!address || !session.current) return
    const list = await authed<{ given: KeyView[]; received: KeyView[]; approvals: KeyPaymentView[] }>(`wallets/${address}/keys`)
    setGiven(list.given)
    setReceived(list.received)
    setApprovals(list.approvals)
  }, [address, authed])

  // While signed in, keep the list fresh, so an agent's question shows up within seconds.
  useEffect(() => {
    if (status !== 'ready') return
    void refresh().catch(() => {})
    const id = setInterval(() => {
      if (AppState.currentState === 'active') void refresh().catch(() => {})
    }, 6000)
    return () => clearInterval(id)
  }, [refresh, status])

  const signIn = useCallback(async () => {
    await token()
    await refresh()
  }, [refresh, token])

  const authorizeOnChain = useCallback(
    async (authorization: Authorization) => {
      const account = await unlock(0n)
      const terms: KeyTerms = {
        token: authorization.token,
        limit: BigInt(authorization.limit_units),
        period: authorization.period,
        expiry: authorization.expiry,
        payees: authorization.payees,
      }
      const { receipt } = await Actions.accessKey.authorizeSync(walletClient(account) as never, {
        accessKey: { address: authorization.key_id, type: authorization.key_type },
        expiry: terms.expiry,
        limits: keyLimits(terms),
        scopes: keyScopes(terms),
        feePayer: true,
      } as never)
      if (receipt.status !== 'success') throw new Error('Tempo didn’t take the key. Nothing changed.')
      return receipt.transactionHash as Hex
    },
    [unlock],
  )

  const createAgent = useCallback(
    async (input: AgentInput) => {
      if (!address) throw new Error('Open your wallet first.')
      const started = Date.now()
      const made = await authed<{ key: KeyView; authorize: Authorization }>(`wallets/${address}/keys/agents`, {
        method: 'POST',
        body: {
          label: input.label,
          limit: input.limit,
          period: input.period,
          expires_at: daysFromNow(input.days),
          per_payment: input.perPayment,
          approve_above: input.approveAbove,
          payees: input.payees,
        },
      })
      const txHash = await authorizeOnChain(made.authorize)
      const confirmed = await authed<{ key: KeyView; agent_token?: string }>(`wallets/${address}/keys/${made.key.id}/confirm`, {
        method: 'POST',
        body: { tx_hash: txHash },
      })
      if (!confirmed.agent_token) throw new Error('The key is on Tempo, but Ren didn’t switch it on. Try again.')
      await refresh()
      return { key: confirmed.key, token: confirmed.agent_token, ms: Date.now() - started }
    },
    [address, authed, authorizeOnChain, refresh],
  )

  const createAllowance = useCallback(
    async (input: AllowanceInput) => {
      if (!address) throw new Error('Open your wallet first.')
      const made = await authed<{ key: KeyView; code: string }>(`wallets/${address}/keys/allowances`, {
        method: 'POST',
        body: { label: input.label, limit: input.limit, period: input.period, expires_at: daysFromNow(input.days) },
      })
      await refresh()
      return { key: made.key, link: `${webUrl}/a/${made.code}` }
    },
    [address, authed, refresh],
  )

  const createCard = useCallback(
    async (input: { label: string; keyId: Address; limit: string; days: number }) => {
      if (!address) throw new Error('Open your wallet first.')
      const made = await authed<{ key: KeyView; authorize: Authorization }>(`wallets/${address}/keys/cards`, {
        method: 'POST',
        body: { label: input.label, key_id: input.keyId, limit: input.limit, expires_at: daysFromNow(input.days) },
      })
      const txHash = await authorizeOnChain(made.authorize)
      const confirmed = await authed<{ key: KeyView }>(`wallets/${address}/keys/${made.key.id}/confirm`, {
        method: 'POST',
        body: { tx_hash: txHash },
      })
      await refresh()
      return confirmed.key
    },
    [address, authed, authorizeOnChain, refresh],
  )

  const switchOn = useCallback(
    async (key: KeyView) => {
      if (!address) throw new Error('Open your wallet first.')
      const authorization = await authed<Authorization>(`wallets/${address}/keys/${key.id}/authorize`)
      const txHash = await authorizeOnChain(authorization)
      const confirmed = await authed<{ key: KeyView }>(`wallets/${address}/keys/${key.id}/confirm`, {
        method: 'POST',
        body: { tx_hash: txHash },
      })
      await refresh()
      return confirmed.key
    },
    [address, authed, authorizeOnChain, refresh],
  )

  /** Freezing tells Ren first (it stops at once), then sets the key's limit to zero on Tempo. */
  const freeze = useCallback(
    async (key: KeyView) => {
      if (!address || !key.key_id) return
      await authed(`wallets/${address}/keys/${key.id}/freeze`, { method: 'POST', body: {} })
      const account = await unlock(0n)
      await Actions.accessKey.updateLimitSync(walletClient(account) as never, {
        accessKey: key.key_id,
        token: key.token,
        limit: 0n,
        feePayer: true,
      } as never)
      await refresh()
    },
    [address, authed, refresh, unlock],
  )

  const unfreeze = useCallback(
    async (key: KeyView) => {
      if (!address || !key.key_id) return
      const account = await unlock(0n)
      await Actions.accessKey.updateLimitSync(walletClient(account) as never, {
        accessKey: key.key_id,
        token: key.token,
        limit: units(key.limit),
        feePayer: true,
      } as never)
      await authed(`wallets/${address}/keys/${key.id}/unfreeze`, { method: 'POST', body: {} })
      await refresh()
    },
    [address, authed, refresh, unlock],
  )

  const remove = useCallback(
    async (key: KeyView) => {
      if (!address) return
      await authed(`wallets/${address}/keys/${key.id}/revoke`, { method: 'POST', body: {} })
      if (key.key_id && key.status !== 'pending') {
        const account = await unlock(0n)
        const { receipt } = await Actions.accessKey.revokeSync(walletClient(account) as never, {
          accessKey: key.key_id,
          feePayer: true,
        } as never)
        await authed(`wallets/${address}/keys/${key.id}/revoke`, {
          method: 'POST',
          body: { tx_hash: receipt.transactionHash },
        }).catch(() => {})
      }
      await refresh()
    },
    [address, authed, refresh, unlock],
  )

  const newToken = useCallback(
    async (key: KeyView) => {
      if (!address) throw new Error('Open your wallet first.')
      return (await authed<{ agent_token: string }>(`wallets/${address}/keys/${key.id}/token`, { method: 'POST', body: {} }))
        .agent_token
    },
    [address, authed],
  )

  const payments = useCallback(
    async (key: KeyView) => {
      if (!address) return []
      return (await authed<{ data: KeyPaymentView[] }>(`wallets/${address}/keys/${key.id}/payments`)).data
    },
    [address, authed],
  )

  const answer = useCallback(
    async (payment: KeyPaymentView, decision: 'approve' | 'decline') => {
      if (!address) throw new Error('Open your wallet first.')
      const account = await unlock(0n)
      const message = approvalMessage({
        address,
        paymentId: payment.id,
        decision,
        amount: payment.amount,
        to: payment.origin ?? getAddress(payment.to),
      })
      const answered = await authed<{ payment: KeyPaymentView }>(`wallets/${address}/approvals/${payment.id}`, {
        method: 'POST',
        body: { decision, signature: await account.signMessage({ message }) },
      })
      await refresh()
      return answered.payment
    },
    [address, authed, refresh, unlock],
  )

  const claim = useCallback(
    async (code: string, name: string | undefined) => {
      if (!address) throw new Error('Open your wallet first.')
      const key = makeKey()
      const claimed = await call<{ key: KeyView }>(`allowances/${code}/claim`, {
        method: 'POST',
        token: await token(),
        body: { holder: address, holder_name: name, key_id: key.keyId, key_type: 'secp256k1' },
      })
      await keepKey(
        {
          id: claimed.key.id,
          owner: claimed.key.owner,
          holder: address,
          keyId: key.keyId,
          token: claimed.key.token,
          limit: units(claimed.key.limit).toString(),
          period: claimed.key.period,
          expiresAt: claimed.key.expires_at,
        },
        key.privateKey,
      )
      await readHeld()
      return claimed.key
    },
    [address, readHeld, token],
  )

  const spend = useCallback(
    async (allowance: HeldAllowance, to: Address, amount: bigint, memo?: Hex) => {
      const local = (await heldKeys()).find((k) => k.id === allowance.id)
      if (!local) throw new Error('This phone doesn’t hold the key for that allowance.')
      if (amount > allowance.remaining) throw new Error('That’s more than the allowance has left.')
      const started = Date.now()
      const { receipt } = await Actions.token.transferSync(walletClient((await spendingAccount(local)) as never) as never, {
        token: allowance.token,
        to,
        amount,
        ...(memo ? { memo } : {}),
        feePayer: true,
      } as never)
      if (receipt.status !== 'success') throw new Error('Tempo didn’t take it. Nothing moved.')
      void readHeld()
      return { hash: receipt.transactionHash as Hex, ms: Date.now() - started }
    },
    [readHeld],
  )

  return useMemo(
    () => ({
      claim,
      held,
      spend,
      token,
      available: onTempo,
      status,
      given,
      received,
      approvals,
      mcpUrl: `${apiUrl}/mcp`,
      signIn,
      refresh,
      createAgent,
      createAllowance,
      createCard,
      switchOn,
      freeze,
      unfreeze,
      remove,
      newToken,
      payments,
      answer,
    }),
    [answer, approvals, claim, createAgent, createAllowance, createCard, freeze, given, held, newToken, payments, received, refresh, remove, signIn, spend, status, switchOn, token, unfreeze],
  )
}
