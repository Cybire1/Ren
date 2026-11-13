import type { Address, Hex } from 'viem'
import { type PayRequest, type Sign, signed } from './signed'

/**
 * The dollar card (Nuvion), from the browser. Reads go through /api/wallet/:address/money/…; every
 * change carries the wallet's own signature. A top-up is paid by a transfer the wallet sends
 * itself (sponsored, with the top-up's memo), then reported by its hash.
 */

export interface DollarCard {
  live: boolean
  sandbox: boolean
  provider: string
  requested: boolean
  /**
   * intro: no card yet. checking: the ID check is with the issuer. fix: it didn't pass. card: ready.
   * closed: they deleted their card; its money is still theirs (`balance`).
   */
  stage: 'intro' | 'checking' | 'fix' | 'card' | 'closed'
  /** With fix: the check stopped before the issuer could review it (to finish), not refused. */
  unfinished?: boolean
  /** The ID check passed, but the issuer is still preparing the card. */
  approved?: boolean
  /** Approved, but the issuer refused to make the card when Ren last asked, in its words. */
  card_problem?: string | null
  /** With closed: what's still on the deleted card's account, base units; null if unknown. */
  balance?: string | null
  /** The most a wallet puts on its card in a day, base units. */
  daily_topup: string
  /** Ren's fee on a top-up, in basis points (50 = 0.5%), paid on top. */
  topup_fee_bps?: number
  reason?: string | null
  card?: {
    last_four: string
    /** mastercard, visa or other. */
    brand?: string
    exp_month: string | null
    exp_year: string | null
    frozen: boolean
    /** What the card can spend now, base units; null when the issuer didn't answer. */
    balance: string | null
    name: string
  }
  topups?: { today: string; left: string; treasury?: Address }
  activity?: Array<{
    id: string
    kind: 'spend' | 'refund' | 'topup' | 'check' | 'withdraw'
    amount: string
    status: string
    title: string
    at: string
  }>
}

export interface CardDetails {
  /** mastercard, visa or other. */
  brand?: string
  number: string
  cvv: string
  exp_month: string
  exp_year: string
  name: string
  /** What a checkout asks for with the number; null when Nuvion hasn't given one. */
  billing_address?: CardBillingAddress | null
}

export interface CardBillingAddress {
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
}

export interface CardCheck {
  first_name: string
  last_name: string
  /** YYYY-MM-DD. */
  date_of_birth: string
  email: string
  phone: string
  nationality: string
  gender: 'm' | 'f'
  address: { line1: string; city: string; state: string; postal_code: string; country: string }
  document: {
    type: 'international_passport' | 'national_id' | 'drivers_license'
    number: string
    /** Base64, no data: prefix. */
    file: string
    mime: 'image/jpeg' | 'image/png' | 'application/pdf'
  }
  /** The issuer needs a NIN or BVN from Nigerians and an SSN from Americans. */
  id_number?: { type: 'nin' | 'bvn' | 'ssn'; value: string }
  /** A bill or bank statement showing the home address: the issuer's second document. */
  address_proof: {
    type: 'utility_bill' | 'bank_statement'
    /** Base64, no data: prefix. */
    file: string
    mime: 'image/jpeg' | 'image/png' | 'application/pdf'
  }
}

/** A top-up waiting for its transfer: what lands on the card, Ren's fee, and what to send. */
export interface CardTopUp {
  id: string
  amount: string
  fee: string
  total: string
  expires_at: string
  pay: PayRequest
}

const base = (address: string) => `/api/wallet/${address}/money`

async function read<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!response.ok || !body) throw new Error(body?.error ?? 'Ren didn’t answer. Try again.')
  return body
}

/** The cap the API sets (KOVA_CARD_DAILY_TOPUP), for a server that leaves it out. */
const DEFAULT_DAILY_TOPUP = '100000000'

/** The screens do arithmetic on the daily cap, so it's always filled in. */
const filled = (d: DollarCard): DollarCard => ({
  ...d,
  daily_topup: d.daily_topup ?? DEFAULT_DAILY_TOPUP,
})

export const getDollarCard = (address: string) =>
  fetch(`${base(address)}/dollar-card`, { cache: 'no-store' })
    .then(read<DollarCard>)
    .then(filled)

async function post<T>(address: string, path: string, body: unknown): Promise<T> {
  return fetch(`${base(address)}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(read<T>)
}

/** Asks to be told when the card opens on this site. */
export async function requestCardAccess(address: Address, sign: Sign) {
  return post<{ requested: true }>(address, 'access-requests', {
    feature: 'dollar_card',
    ...(await signed(address, sign, 'request-access', 'dollar_card')),
  })
}

/** Your details, ID photo and proof of address, to the card issuer's check. */
export async function startCardCheck(address: Address, sign: Sign, check: CardCheck) {
  return post<DollarCard>(address, 'dollar-card/check', {
    ...check,
    ...(await signed(address, sign, 'dollar-card-check')),
  }).then(filled)
}

export async function setDollarCard(address: Address, sign: Sign, frozen: boolean) {
  return post<DollarCard>(address, 'dollar-card/settings', {
    frozen,
    ...(await signed(address, sign, 'dollar-card-settings', frozen ? 'freeze' : 'unfreeze')),
  }).then(filled)
}

/** Off the card, back to the wallet, free. The amount is in the signature. */
export async function withdrawFromCard(address: Address, sign: Sign, amount: bigint) {
  const result = await post<{ tx_hash: Hex | null; card: DollarCard }>(
    address,
    'dollar-card/withdraw',
    {
      amount: amount.toString(),
      ...(await signed(address, sign, 'dollar-card-withdraw', amount.toString())),
    },
  )
  return { ...result, card: filled(result.card) }
}

/** Deletes the card for good. Its money stays on its account, to move to Ren any time. */
export async function deleteDollarCard(address: Address, sign: Sign) {
  return post<DollarCard>(
    address,
    'dollar-card/delete',
    await signed(address, sign, 'dollar-card-delete'),
  ).then(filled)
}

/** A new card after deleting one, on the same account. */
export async function newDollarCard(address: Address, sign: Sign) {
  return post<DollarCard>(
    address,
    'dollar-card/new',
    await signed(address, sign, 'dollar-card-new'),
  ).then(filled)
}

/** The card's number, expiry and CVV, straight from the issuer. Shown, never stored. */
export async function revealDollarCard(address: Address, sign: Sign) {
  return post<CardDetails>(
    address,
    'dollar-card/reveal',
    await signed(address, sign, 'reveal-dollar-card'),
  )
}

/** Ren's fee on a top-up of `amount`, rounded up to the cent, as the API charges it. */
export function topUpFee(amount: bigint, bps: number) {
  const raw = (amount * BigInt(bps) + 9_999n) / 10_000n
  return ((raw + 9_999n) / 10_000n) * 10_000n
}

/**
 * Step one of a top-up: the wallet asks, signed, to put `amount` on its card, and Ren answers with
 * the transfer that pays for it (`amount` plus Ren's fee, with the top-up's memo).
 */
export async function startCardTopUp(address: Address, sign: Sign, amount: bigint) {
  return post<CardTopUp>(address, 'dollar-card/top-up', {
    amount: amount.toString(),
    ...(await signed(address, sign, 'dollar-card-top-up', amount.toString())),
  })
}

/** Step two: the transfer is on Tempo. Ren checks it and fills the card. */
export const reportCardTopUpSent = (address: Address, id: string, txHash: Hex) =>
  post<DollarCard>(address, `dollar-card/top-up/${id}/sent`, { tx_hash: txHash }).then(filled)
