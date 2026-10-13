import type { Address } from 'viem'
import { Scopes } from 'viem/tempo'

/**
 * Keys that spend a wallet's dollars without being the wallet: an AI agent's, a person's
 * allowance, a Ren Card. Each is a Tempo access key on the owner's account, and these are the
 * terms the owner's passkey signs for it, built the same way on the web, the phone and the API.
 *
 * The chain holds the key to them: it can only call `transfer` or `transferWithMemo` on the one
 * dollar (to the listed payees, when there are any), spend up to `limit` each `period`, and stops
 * at `expiry`. Ren's own rules for an agent (a cap per payment, asking first above a line) sit on
 * top, in the API, because the chain can't express them.
 */

export const DAY = 86_400
export const WEEK = 7 * DAY

/** The most any key may spend in one period. A wallet's own passkey is the only key without a cap. */
export const MAX_KEY_LIMIT = 1_000_000_000n // $1,000

/** How long a key may live before it has to be made again. */
export const MAX_KEY_DAYS = 90

export interface KeyTerms {
  token: Address
  /** What it may spend each period, in base units. */
  limit: bigint
  /** Seconds the limit renews over. */
  period: number
  /** Unix seconds when the key stops working. */
  expiry: number
  /** Who it may pay: anyone, or only these wallets. */
  payees: 'anyone' | readonly Address[]
}

/** The spending limit the chain enforces. */
export function keyLimits(terms: KeyTerms) {
  return [{ token: terms.token, limit: terms.limit, period: terms.period }]
}

/** The calls the chain lets the key make: paying in the one dollar, and nothing else. */
export function keyScopes(terms: KeyTerms) {
  const options = terms.payees === 'anyone' ? undefined : { recipients: terms.payees }
  const dollar = Scopes.tip20(terms.token)
  return [dollar.transfer(options), dollar.transferWithMemo(options)]
}

/** What's wrong with these terms, if anything, in words for the person setting them. */
export function keyTermsProblem(terms: KeyTerms, now = Math.floor(Date.now() / 1000)): string | null {
  if (terms.limit <= 0n) return 'Give it a limit of at least a cent.'
  if (terms.limit > MAX_KEY_LIMIT) return 'A key can spend $1,000 a period at most.'
  if (terms.period !== DAY && terms.period !== WEEK) return 'A limit renews daily or weekly.'
  if (terms.expiry <= now + 60) return 'Pick an end date in the future.'
  if (terms.expiry > now + MAX_KEY_DAYS * DAY) return `A key lasts ${MAX_KEY_DAYS} days at most.`
  if (terms.payees !== 'anyone' && terms.payees.length === 0) return 'Add someone it may pay, or let it pay anyone.'
  if (terms.payees !== 'anyone' && terms.payees.length > 20) return 'A key may list 20 payees at most.'
  return null
}

/**
 * The message a wallet signs to sign in to its keys on Ren's API for a while. The purpose and the
 * time are in the words, so it can't be mistaken for anything else or used much later.
 */
export function walletSignInMessage(params: { address: Address; issuedAt: string; nonce: string }): string {
  return [
    'Sign in to your keys on Ren.',
    '',
    'This lets Ren show and change the keys that can spend from this wallet. It moves no money.',
    '',
    `Wallet: ${params.address}`,
    `Issued: ${params.issuedAt}`,
    `Nonce: ${params.nonce}`,
  ].join('\n')
}

/** What an owner signs to approve or decline one payment an agent asked for. */
export function approvalMessage(params: {
  address: Address
  paymentId: string
  decision: 'approve' | 'decline'
  amount: string
  to: string
}): string {
  return [
    params.decision === 'approve' ? 'Approve this payment on Ren.' : 'Decline this payment on Ren.',
    '',
    `Wallet: ${params.address}`,
    `Payment: ${params.paymentId}`,
    `Amount: $${params.amount}`,
    `To: ${params.to}`,
  ].join('\n')
}
