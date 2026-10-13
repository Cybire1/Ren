'use client'

import {
  approvalMessage,
  getToken,
  type KeyTerms,
  keyLimits,
  keyScopes,
  type NetworkId,
  walletSignInMessage,
} from '@kova/tempo'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Address, getAddress, type Hex, type LocalAccount } from 'viem'
import { Actions } from 'viem/tempo'
import { relayedClient } from '@/lib/wallet/chain-tempo'

/**
 * Keys (the API's services/keys.ts), for the wallet: everything that can spend its dollars short of
 * the wallet itself, the payments its agents are waiting on, and the allowances others gave it.
 *
 * The wallet signs in to its keys once (a signed message, no money moves) and keeps the token for
 * the tab. Putting a key on-chain, freezing it and removing it are transactions the wallet's own
 * key signs, through Ren's relay, so they cost nothing; the API only records and checks them.
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
  public_key: Hex | null
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

export interface KeysValue {
  /** signed-out: the wallet hasn't signed in to its keys in this tab. */
  status: 'signed-out' | 'signing-in' | 'ready' | 'unavailable'
  given: KeyView[]
  received: KeyView[]
  approvals: KeyPaymentView[]
  connect: { api_url: string; mcp_url: string } | null
  signIn: () => Promise<void>
  refresh: () => Promise<void>
  /** Makes an agent's key, puts it on-chain with the passkey, and switches it on: the token is shown once. */
  createAgent: (input: AgentInput) => Promise<{ key: KeyView; token: string; ms: number }>
  createAllowance: (input: AllowanceInput) => Promise<{ key: KeyView; link: string }>
  /** The person accepted: put their key on-chain and switch the allowance on. */
  switchOn: (key: KeyView) => Promise<KeyView>
  freeze: (key: KeyView) => Promise<void>
  unfreeze: (key: KeyView) => Promise<void>
  remove: (key: KeyView) => Promise<void>
  newToken: (key: KeyView) => Promise<string>
  payments: (key: KeyView) => Promise<KeyPaymentView[]>
  answer: (payment: KeyPaymentView, decision: 'approve' | 'decline') => Promise<KeyPaymentView>
  /** For the allowance link's page: sign in as the person accepting it. */
  token: () => Promise<string>
}

const STORE = (address: string) => `ren.keys.session.${address.toLowerCase()}`

class KeysError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function call<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown; token?: string } = {}): Promise<T> {
  const response = await fetch(`/api/keys/${path}`, {
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

export function useKeys({
  network,
  address,
  unlock,
}: {
  network: NetworkId
  address: Address | null
  unlock: (amount: bigint) => Promise<LocalAccount>
}): KeysValue {
  const [status, setStatus] = useState<KeysValue['status']>('signed-out')
  const [given, setGiven] = useState<KeyView[]>([])
  const [received, setReceived] = useState<KeyView[]>([])
  const [approvals, setApprovals] = useState<KeyPaymentView[]>([])
  const [connect, setConnect] = useState<KeysValue['connect']>(null)
  const session = useRef<{ token: string; expires: number } | null>(null)

  // A new wallet in this tab starts signed out of its keys, unless this tab already signed it in.
  useEffect(() => {
    setGiven([])
    setReceived([])
    setApprovals([])
    session.current = null
    setStatus('signed-out')
    if (!address) return
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE(address)) ?? 'null') as { token: string; expires: number } | null
      if (saved && saved.expires > Date.now() + 60_000) {
        session.current = saved
        setStatus('ready')
      }
    } catch {
      // No storage: sign in again when needed.
    }
  }, [address])

  useEffect(() => {
    void call<{ api_url: string; mcp_url: string }>('connect').then(setConnect).catch(() => {})
  }, [])

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
      try {
        sessionStorage.setItem(STORE(address), JSON.stringify(session.current))
      } catch {
        // Fine: this tab just signs in again next time.
      }
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
        // The sign-in ran out on the server's side: once more, with a fresh one.
        if (error instanceof KeysError && error.status === 401 && address) {
          session.current = null
          sessionStorage.removeItem(STORE(address))
          return call<T>(path, { ...init, token: await token() })
        }
        throw error
      }
    },
    [address, token],
  )

  const refresh = useCallback(async () => {
    if (!address || !session.current) return
    const list = await authed<{ given: KeyView[]; received: KeyView[]; approvals: KeyPaymentView[] }>(
      `wallets/${address}/keys`,
    )
    setGiven(list.given)
    setReceived(list.received)
    setApprovals(list.approvals)
  }, [address, authed])

  // While signed in: keep the list fresh, so an agent's question shows up within seconds.
  useEffect(() => {
    if (status !== 'ready') return
    void refresh().catch(() => {})
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh().catch(() => {})
    }, 6000)
    return () => clearInterval(id)
  }, [refresh, status])

  const signIn = useCallback(async () => {
    await token()
    await refresh()
  }, [refresh, token])

  /** The wallet's own key puts a key on-chain with its terms, through Ren's relay. */
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
      const { receipt } = await Actions.accessKey.authorizeSync(relayedClient(network, account) as never, {
        accessKey: { address: authorization.key_id, type: authorization.key_type },
        expiry: terms.expiry,
        limits: keyLimits(terms),
        scopes: keyScopes(terms),
        feePayer: true,
      } as never)
      if (receipt.status !== 'success') throw new Error('Tempo didn’t take the key. Nothing changed.')
      return receipt.transactionHash as Hex
    },
    [network, unlock],
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
      const confirmed = await authed<{ key: KeyView; agent_token?: string }>(
        `wallets/${address}/keys/${made.key.id}/confirm`,
        { method: 'POST', body: { tx_hash: txHash } },
      )
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
      return { key: made.key, link: `${window.location.origin}/a/${made.code}` }
    },
    [address, authed, refresh],
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
      await Actions.accessKey.updateLimitSync(relayedClient(network, account) as never, {
        accessKey: key.key_id,
        token: key.token,
        limit: 0n,
        feePayer: true,
      } as never)
      await refresh()
    },
    [address, authed, network, refresh, unlock],
  )

  const unfreeze = useCallback(
    async (key: KeyView) => {
      if (!address || !key.key_id) return
      const account = await unlock(0n)
      const units = BigInt(Math.round(Number(key.limit) * 1e6))
      await Actions.accessKey.updateLimitSync(relayedClient(network, account) as never, {
        accessKey: key.key_id,
        token: key.token,
        limit: units,
        feePayer: true,
      } as never)
      await authed(`wallets/${address}/keys/${key.id}/unfreeze`, { method: 'POST', body: {} })
      await refresh()
    },
    [address, authed, network, refresh, unlock],
  )

  /** Removing is for good: Ren forgets it at once, then Tempo revokes it. */
  const remove = useCallback(
    async (key: KeyView) => {
      if (!address) return
      await authed(`wallets/${address}/keys/${key.id}/revoke`, { method: 'POST', body: {} })
      if (key.key_id && key.status !== 'pending') {
        const account = await unlock(0n)
        const { receipt } = await Actions.accessKey.revokeSync(relayedClient(network, account) as never, {
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
    [address, authed, network, refresh, unlock],
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

  return useMemo(
    () => ({
      status,
      given,
      received,
      approvals,
      connect,
      signIn,
      refresh,
      createAgent,
      createAllowance,
      switchOn,
      freeze,
      unfreeze,
      remove,
      newToken,
      payments,
      answer,
      token,
    }),
    [answer, approvals, connect, createAgent, createAllowance, freeze, given, newToken, payments, received, refresh, remove, signIn, status, switchOn, token, unfreeze],
  )
}

/** The dollar a key spends, as the API names it. */
export const keysDollar = (network: NetworkId) => getToken(network, 'USDC').address
