import type { Address, Hex } from 'viem'
import { apiUrl } from './config'

/**
 * The dollar card: the part of Ren that runs through a card issuer. Reads are plain; every change
 * carries the wallet's own signature (the API's dollar-card routes check it).
 */

/**
 * The message a wallet signs to act on its own account (issue or freeze its card, see its card
 * number, save a cash-out account). `detail` pins the exact change, so a signature for one action
 * can't be replayed as another. The API builds the same string to check it, to the byte
 * (packages/tempo/src/money.ts): keep the two the same.
 */
export function moneyActionMessage(
  wallet: Address,
  action: string,
  signedAt: number,
  detail = '',
): string {
  return `Ren account\nWallet ${wallet.toLowerCase()}\nAction ${action}${detail ? `\n${detail}` : ''}\nSigned ${signedAt}`
}

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
  topups?: { today: string; left: string; treasury: Address }
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
    mime: 'image/jpeg' | 'image/png'
  }
  /** The issuer needs a NIN or BVN from Nigerians and an SSN from Americans. */
  id_number?: { type: 'nin' | 'bvn' | 'ssn'; value: string }
  /** A bill or bank statement showing the home address: the issuer's second document. */
  address_proof: {
    type: 'utility_bill' | 'bank_statement'
    /** Base64, no data: prefix. */
    file: string
    mime: 'image/jpeg' | 'image/png'
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `${apiUrl}/v1/wallets/${path}`,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
  )
  const json = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
  if (!response.ok)
    throw new Error(json.error?.message ?? `Ren is unreachable (${response.status})`)
  return json as T
}

/** The cap the API sets (KOVA_CARD_DAILY_TOPUP), for a server too old to say it. */
const DEFAULT_DAILY_TOPUP = '100000000'

/** The card, with the daily cap always filled in: an older server leaves it out, and the screens do
 * arithmetic on it. */
export const getDollarCard = (address: Address) =>
  call<DollarCard>(`${address}/dollar-card`).then((d) => ({
    ...d,
    daily_topup: d.daily_topup ?? DEFAULT_DAILY_TOPUP,
  }))

type Sign = (message: string) => Promise<Hex>

async function signed(address: Address, sign: Sign, action: string, detail = '') {
  const signed_at = Math.floor(Date.now() / 1000)
  return {
    signed_at,
    signature: await sign(moneyActionMessage(address, action, signed_at, detail)),
  }
}

/** Asks to be among the first when the dollar card opens (the screen's "Request access"). */
export async function requestAccess(address: Address, sign: Sign, feature: 'dollar_card') {
  return call<{ requested: true }>(`${address}/access-requests`, {
    feature,
    ...(await signed(address, sign, 'request-access', feature)),
  })
}

/** Your details and ID photo, to the card issuer's check. */
export async function startCardCheck(address: Address, sign: Sign, check: CardCheck) {
  return call<DollarCard>(`${address}/dollar-card/check`, {
    ...check,
    ...(await signed(address, sign, 'dollar-card-check')),
  })
}

export async function setDollarCard(address: Address, sign: Sign, frozen: boolean) {
  return call<DollarCard>(`${address}/dollar-card/settings`, {
    frozen,
    ...(await signed(address, sign, 'dollar-card-settings', frozen ? 'freeze' : 'unfreeze')),
  })
}

/** Off the card, back to the wallet, free. The amount is in the signature. */
export async function withdrawFromCard(address: Address, sign: Sign, amount: bigint) {
  return call<{ tx_hash: Hex | null; card: DollarCard }>(`${address}/dollar-card/withdraw`, {
    amount: amount.toString(),
    ...(await signed(address, sign, 'dollar-card-withdraw', amount.toString())),
  })
}

/** Deletes the card for good. Its money stays on its account, to move to Ren any time. */
export async function deleteDollarCard(address: Address, sign: Sign) {
  return call<DollarCard>(
    `${address}/dollar-card/delete`,
    await signed(address, sign, 'dollar-card-delete'),
  )
}

/** A new card after deleting one, on the same account. */
export async function newDollarCard(address: Address, sign: Sign) {
  return call<DollarCard>(
    `${address}/dollar-card/new`,
    await signed(address, sign, 'dollar-card-new'),
  )
}

/** The card's number, expiry and CVV, straight from the issuer. Shown, never stored. */
export async function revealDollarCard(address: Address, sign: Sign) {
  return call<CardDetails>(
    `${address}/dollar-card/reveal`,
    await signed(address, sign, 'reveal-dollar-card'),
  )
}

/** Ren's fee on a top-up of `amount`, rounded up to the cent, as the API charges it. */
export function topUpFee(amount: bigint, bps: number) {
  const raw = (amount * BigInt(bps) + 9_999n) / 10_000n
  return ((raw + 9_999n) / 10_000n) * 10_000n
}

/** A top-up Ren has priced and is waiting to be paid for. */
export interface CardTopUp {
  id: string
  /** What lands on the card, base units. */
  amount: string
  fee: string
  /** What leaves the wallet: the amount plus the fee. */
  total: string
  expires_at: string
  /**
   * The transfer that pays for it: exactly `amount` of `token` to `to`, with `memo`. `to` is null
   * while the server has nowhere to take top-ups.
   */
  pay: { token: Address; to: Address | null; amount: string; memo: Hex }
}

/** Onto the card, step one: Ren prices the top-up and says which transfer pays for it. */
export async function startCardTopUp(address: Address, sign: Sign, amount: bigint) {
  return call<CardTopUp>(`${address}/dollar-card/top-up`, {
    amount: amount.toString(),
    ...(await signed(address, sign, 'dollar-card-top-up', amount.toString())),
  })
}

/** Step two, after the wallet sent that transfer on Tempo: Ren checks it and loads the card. */
export const finishCardTopUp = (address: Address, id: string, txHash: Hex) =>
  call<DollarCard>(`${address}/dollar-card/top-up/${id}/sent`, { tx_hash: txHash })
