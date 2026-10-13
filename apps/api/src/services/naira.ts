import { randomBytes } from 'node:crypto'
import { schema, uuidv7 } from '@kova/db'
import { encodeMemo, formatAmount } from '@kova/tempo'
import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import { type Address, decodeEventLog, getAddress, type Hex, isAddressEqual, type TransactionReceipt } from 'viem'
import { Abis } from 'viem/tempo'
import { feePayerAddress, onTempo, publicClient, sendFromTreasury, settlementToken, treasuryClient } from '../chain.js'
import { config } from '../config.js'
import { db } from '../db.js'
import { KovaError } from '../errors.js'
import type { PaymentIntent } from './intents.js'
import {
  accountName,
  bankNamed,
  checkout,
  payment,
  paystackReady,
  paystackTestMode,
  transfer,
  transferRecipient,
  transferStatus,
} from './paystack.js'
import { rateBook } from './rates.js'
import { settleFromReceipt } from './settle.js'

/**
 * Naira, through Paystack (services/paystack.ts):
 *
 * - **Cashing out.** A wallet turns dollars into naira in a Nigerian bank account. Ren quotes the
 *   naira, looks up the name on the account, and the wallet sends the dollars to Ren's treasury
 *   with this cash-out's memo; once Ren sees them on Tempo, Paystack pays the account. If the bank
 *   transfer fails, the dollars go back to the wallet.
 * - **Paying a shop in naira.** A customer without a wallet pays a Ren charge by card, bank
 *   transfer or USSD in naira; once Paystack confirms it, Ren's treasury pays the shop the charge
 *   in dollars, with the charge's memo, so the till turns to paid like any other payment.
 *
 * Ren quotes from the market rate (rates.ts: two public sources, cross-checked) with a spread each
 * way (KOVA_NAIRA_SPREAD). In production the exchange is a licensed partner's (Yellow Card, Kotani);
 * this is the same flow against Paystack, and with a test key nothing real moves.
 */

export type CashOutRow = typeof schema.cashOuts.$inferSelect
export type PayInRow = typeof schema.nairaPayIns.$inferSelect

export const nairaReady = () => onTempo && paystackReady() && Boolean(treasuryClient && feePayerAddress)

function requireNaira() {
  if (!nairaReady()) throw new KovaError('conflict', 'Naira isn’t switched on for this server yet.')
}

const QUOTE_TTL_MS = 15 * 60_000
export const MIN_CASH_OUT = 1_000_000n // $1
export const MAX_CASH_OUT = 500_000_000n // $500
const MAX_PAY_IN = 500_000_000n // $500

/** The market's naira per dollar, now. */
async function marketRate(): Promise<number> {
  const ngn = (await rateBook()).rates.NGN?.perUsd
  if (!ngn || !(ngn > 0)) throw new KovaError('internal', 'Ren can’t read the naira rate right now. Try again soon.')
  return ngn
}

/** Paystack's fee for one bank transfer, by size, in kobo. */
function transferFee(kobo: bigint): bigint {
  if (kobo <= 500_000n) return 1_000n // ₦10 up to ₦5,000
  if (kobo <= 5_000_000n) return 2_500n // ₦25 up to ₦50,000
  return 5_000n // ₦50 above
}

const kobo = (units: bigint, rate: number, round: 'down' | 'up') => {
  const value = (Number(units) / 1e6) * rate * 100
  return BigInt(round === 'down' ? Math.floor(value) : Math.ceil(value))
}

export const formatNaira = (k: bigint) =>
  `₦${(Number(k) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export async function quoteCashOut(units: bigint) {
  const market = await marketRate()
  const rate = market * (1 - config.KOVA_NAIRA_SPREAD)
  const gross = kobo(units, rate, 'down')
  const fee = transferFee(gross)
  return { market, rate, gross, fee, naira: gross > fee ? gross - fee : 0n }
}

export async function quotePayIn(units: bigint) {
  const market = await marketRate()
  const rate = market * (1 + config.KOVA_NAIRA_SPREAD)
  return { market, rate, naira: kobo(units, rate, 'up') }
}

// ── Cashing out ─────────────────────────────────────────────────────────────────────────────

export const cashOutMemo = (row: Pick<CashOutRow, 'id'>) => encodeMemo({ kind: 'cashout', id: row.id })

export function serializeCashOut(row: CashOutRow) {
  return {
    object: 'cash_out',
    id: row.id,
    amount: formatAmount(row.amount),
    naira: formatNaira(row.naira),
    naira_kobo: row.naira.toString(),
    rate: Number(row.rate).toFixed(2),
    fee: formatNaira(row.fee),
    bank_name: row.bankName,
    account_name: row.accountName,
    account_last4: row.accountNumber.slice(-4),
    status: row.status === 'quoted' && row.expiresAt < new Date() ? 'expired' : row.status,
    /** Where the wallet sends the dollars, with what memo. */
    pay_to: feePayerAddress ? getAddress(feePayerAddress) : null,
    token: getAddress(settlementToken.address),
    memo: cashOutMemo(row),
    tx_hash: row.txHash,
    failure: row.failure,
    test_mode: paystackTestMode(),
    expires_at: row.expiresAt.toISOString(),
    paid_at: row.paidAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
  }
}

export async function createCashOut(
  wallet: Address,
  input: { amount: bigint; bankCode: string; accountNumber: string },
): Promise<CashOutRow> {
  requireNaira()
  if (input.amount < MIN_CASH_OUT) throw new KovaError('invalid_request', 'Cash out at least $1.')
  if (input.amount > MAX_CASH_OUT) throw new KovaError('invalid_request', 'Cash out up to $500 at a time.')
  const bank = await bankNamed(input.bankCode)
  if (!bank) throw new KovaError('invalid_request', 'Pick your bank from the list.')
  const name = await accountName(input.accountNumber, bank.code)
  const quote = await quoteCashOut(input.amount)
  if (quote.naira <= 0n) throw new KovaError('invalid_request', 'That’s too little to send to a bank.')
  const [row] = await db
    .insert(schema.cashOuts)
    .values({
      id: uuidv7(),
      network: config.KOVA_NETWORK,
      walletAddress: wallet.toLowerCase(),
      amount: input.amount,
      naira: quote.naira,
      rate: quote.rate.toFixed(4),
      fee: quote.fee,
      bankCode: bank.code,
      bankName: bank.name,
      accountNumber: input.accountNumber,
      accountName: name,
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
    })
    .returning()
  if (!row) throw new KovaError('internal', 'The cash-out wasn’t saved.')
  return row
}

export async function cashOutRow(id: string): Promise<CashOutRow | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined
  return db.query.cashOuts.findFirst({ where: eq(schema.cashOuts.id, id) })
}

export async function cashOutsOf(wallet: Address): Promise<CashOutRow[]> {
  return db.query.cashOuts.findMany({
    where: eq(schema.cashOuts.walletAddress, wallet.toLowerCase()),
    orderBy: [desc(schema.cashOuts.createdAt)],
    limit: 20,
  })
}

/**
 * Whether Ren's relay should pay the fee for this transfer: exactly an open cash-out's dollars, to
 * Ren's treasury, from the wallet that asked for it.
 */
export async function cashOutSponsorProblem(input: {
  id: string
  to: Address
  amount: bigint
  token: Address
  from: Address | undefined
}): Promise<string | null> {
  const row = await cashOutRow(input.id)
  if (!row) return 'no matching cash-out'
  if (row.status !== 'quoted') return `cash-out is ${row.status}`
  if (row.expiresAt < new Date()) return 'cash-out quote expired'
  if (!feePayerAddress || !isAddressEqual(input.to, feePayerAddress)) return 'cash-out must go to Ren’s treasury'
  if (input.amount !== row.amount) return 'amount does not match the cash-out'
  if (!isAddressEqual(input.token, settlementToken.address)) return 'token does not match the cash-out'
  if (!input.from || !isAddressEqual(input.from, row.walletAddress as Address)) return 'cash-out is another wallet’s'
  return null
}

/** The wallet's transfer of exactly these dollars, with this memo, to Ren's treasury, in a receipt. */
function paidIn(receipt: TransactionReceipt, row: CashOutRow): boolean {
  const memo = cashOutMemo(row).toLowerCase()
  for (const log of receipt.logs) {
    if (!isAddressEqual(log.address, settlementToken.address)) continue
    try {
      const event = decodeEventLog({ abi: Abis.tip20, data: log.data, topics: log.topics })
      if (event.eventName !== 'TransferWithMemo') continue
      const args = event.args as { from: Address; to: Address; amount: bigint; memo: Hex }
      if (
        feePayerAddress &&
        isAddressEqual(args.to, feePayerAddress) &&
        isAddressEqual(args.from, row.walletAddress as Address) &&
        args.amount === row.amount &&
        args.memo.toLowerCase() === memo
      )
        return true
    } catch {
      // Not a transfer event.
    }
  }
  return false
}

async function update(row: CashOutRow, values: Partial<typeof schema.cashOuts.$inferInsert>) {
  const [updated] = await db
    .update(schema.cashOuts)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(schema.cashOuts.id, row.id))
    .returning()
  return updated as CashOutRow
}

/** The bank transfer failed: the dollars go back to the wallet, marked as a refund. */
async function refundCashOut(row: CashOutRow, why: string): Promise<CashOutRow> {
  try {
    await sendFromTreasury({
      token: settlementToken.address,
      to: getAddress(row.walletAddress),
      amount: row.amount,
      memo: encodeMemo({ kind: 'refund', id: row.id }),
    })
    return update(row, { status: 'failed', failure: `${why} Your dollars went back to your wallet.` })
  } catch (error) {
    console.error('[naira] refund failed', row.id, error)
    return update(row, { status: 'failed', failure: `${why} Ren will send your dollars back.` })
  }
}

/**
 * The wallet sent the dollars: check the transaction did exactly that, then pay the naira out. It
 * happens once: the transfer's hash can only settle one cash-out, and the status moves only forward.
 */
export async function cashOutSent(wallet: Address, row: CashOutRow, txHash: Hex): Promise<CashOutRow> {
  requireNaira()
  if (!isAddressEqual(row.walletAddress as Address, wallet)) throw new KovaError('not_found', 'No such cash-out.')
  if (row.status !== 'quoted') return row
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 }).catch(() => null)
  if (!receipt || receipt.status !== 'success' || !paidIn(receipt as TransactionReceipt, row))
    throw new KovaError('invalid_request', 'That transaction didn’t send this cash-out’s dollars to Ren.')

  const [received] = await db
    .update(schema.cashOuts)
    .set({ status: 'received', txHash, updatedAt: new Date() })
    .where(and(eq(schema.cashOuts.id, row.id), eq(schema.cashOuts.status, 'quoted')))
    .returning()
  if (!received) return (await cashOutRow(row.id)) as CashOutRow
  return payOut(received)
}

async function payOut(row: CashOutRow): Promise<CashOutRow> {
  try {
    const recipient =
      row.recipientCode ??
      (await transferRecipient({ name: row.accountName, accountNumber: row.accountNumber, bankCode: row.bankCode }))
    if (!row.recipientCode) row = await update(row, { recipientCode: recipient })
    const sent = await transfer({
      kobo: row.naira,
      recipient,
      reference: row.id,
      reason: 'Ren cash-out',
    })
    if (sent.status === 'success') return update(row, { status: 'paid', transferCode: sent.code, paidAt: new Date() })
    if (sent.status === 'failed' || sent.status === 'reversed' || sent.status === 'rejected' || sent.status === 'blocked')
      return refundCashOut(await update(row, { transferCode: sent.code }), 'The bank transfer didn’t go through.')
    return update(row, { status: 'paying', transferCode: sent.code })
  } catch (error) {
    const said = error instanceof Error ? error.message : String(error)
    console.error('[naira] payout failed', row.id, said)
    return refundCashOut(
      row,
      /starter business/i.test(said)
        ? 'Naira payouts aren’t open on Ren’s Paystack account yet.'
        : `Paystack couldn’t send it (${said.slice(0, 120)}).`,
    )
  }
}

/** Cash-outs the bank hasn't confirmed yet: ask Paystack how each went. */
export async function checkPayingCashOuts(): Promise<void> {
  if (!nairaReady()) return
  const paying = await db.query.cashOuts.findMany({ where: eq(schema.cashOuts.status, 'paying'), limit: 20 })
  for (const row of paying) {
    const state = await transferStatus(row.id).catch(() => null)
    if (state === 'success') await update(row, { status: 'paid', paidAt: new Date() })
    else if (state === 'failed' || state === 'reversed') await refundCashOut(row, 'The bank sent it back.')
  }
  await db
    .update(schema.cashOuts)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(and(eq(schema.cashOuts.status, 'quoted'), lt(schema.cashOuts.expiresAt, new Date(Date.now() - 60 * 60_000))))
}

export async function cashOutTransferEvent(reference: string, event: string): Promise<void> {
  const row = await cashOutRow(reference)
  if (!row || (row.status !== 'paying' && row.status !== 'received')) return
  if (event === 'transfer.success') await update(row, { status: 'paid', paidAt: new Date() })
  else if (event === 'transfer.failed' || event === 'transfer.reversed') await refundCashOut(row, 'The bank sent it back.')
}

// ── Paying a shop in naira ──────────────────────────────────────────────────────────────────

export async function startPayIn(intent: PaymentIntent, input: { email: string; callbackUrl: string; shop: string }) {
  requireNaira()
  if (intent.status !== 'requires_payment') throw new KovaError('conflict', 'This charge isn’t open any more.')
  if (intent.expiresAt < new Date()) throw new KovaError('conflict', 'This charge has expired. Ask the shop for a new one.')
  if (!isAddressEqual(intent.tokenAddress as Address, settlementToken.address))
    throw new KovaError('invalid_request', 'This charge can’t be paid in naira.')
  if (intent.amount > MAX_PAY_IN) throw new KovaError('invalid_request', 'Pay up to $500 in naira at a time.')
  const quote = await quotePayIn(intent.amount)
  const reference = `ren_${intent.id.replace(/-/g, '')}_${randomBytes(4).toString('hex')}`
  await db.insert(schema.nairaPayIns).values({
    id: uuidv7(),
    intentId: intent.id,
    reference,
    naira: quote.naira,
    rate: quote.rate.toFixed(4),
    email: input.email.toLowerCase(),
  })
  const url = await checkout({
    email: input.email,
    kobo: quote.naira,
    reference,
    callbackUrl: input.callbackUrl,
    metadata: { shop: input.shop.slice(0, 80), charge_dollars: formatAmount(intent.amount) },
  })
  return { url, reference, naira: quote.naira, rate: quote.rate }
}

/**
 * Paystack says the naira arrived (the payer came back, or its webhook): pay the shop its dollars
 * from Ren's treasury, once, with the charge's memo, and settle the charge.
 */
export async function settlePayIn(reference: string): Promise<PayInRow> {
  requireNaira()
  const row = await db.query.nairaPayIns.findFirst({ where: eq(schema.nairaPayIns.reference, reference) })
  if (!row) throw new KovaError('not_found', 'No such naira payment.')
  if (row.status === 'settled' || row.status === 'failed') return row
  const paid = await payment(reference)
  if (paid.status !== 'success') {
    // "abandoned" is Paystack's word for a checkout nobody finished yet: the payer may still pay.
    if (paid.status === 'failed' || paid.status === 'reversed') {
      const [failed] = await db
        .update(schema.nairaPayIns)
        .set({ status: 'failed', failure: `Paystack: ${paid.status}`, updatedAt: new Date() })
        .where(eq(schema.nairaPayIns.id, row.id))
        .returning()
      return failed as PayInRow
    }
    return row
  }
  if (paid.currency !== 'NGN' || paid.kobo < row.naira)
    throw new KovaError('conflict', 'The naira Paystack took doesn’t match the charge.')

  // Claim it, so the payer's return and the webhook can't both pay the shop.
  const [claimed] = await db
    .update(schema.nairaPayIns)
    .set({ status: 'paid', updatedAt: new Date() })
    .where(and(eq(schema.nairaPayIns.id, row.id), inArray(schema.nairaPayIns.status, ['initialized'])))
    .returning()
  if (!claimed) return (await db.query.nairaPayIns.findFirst({ where: eq(schema.nairaPayIns.id, row.id) })) as PayInRow

  return payShop(claimed)
}

/** Ren's treasury pays the shop the charge, with its memo, and settles it. */
async function payShop(row: PayInRow): Promise<PayInRow> {
  const intent = await db.query.paymentIntents.findFirst({ where: eq(schema.paymentIntents.id, row.intentId) })
  if (!intent || intent.status !== 'requires_payment') {
    const [held] = await db
      .update(schema.nairaPayIns)
      .set({ failure: 'The charge was already paid or closed; Ren refunds the naira.', updatedAt: new Date() })
      .where(eq(schema.nairaPayIns.id, row.id))
      .returning()
    return held as PayInRow
  }
  try {
    const hash = await sendFromTreasury({
      token: intent.tokenAddress as Address,
      to: intent.payTo as Address,
      amount: intent.amount,
      memo: intent.memo as Hex,
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 })
    await settleFromReceipt(receipt as TransactionReceipt).catch(() => {})
    const [settled] = await db
      .update(schema.nairaPayIns)
      .set({ status: 'settled', txHash: hash, failure: null, updatedAt: new Date() })
      .where(eq(schema.nairaPayIns.id, row.id))
      .returning()
    return settled as PayInRow
  } catch (error) {
    console.error('[naira] paying the shop failed', row.id, error)
    const [stuck] = await db
      .update(schema.nairaPayIns)
      .set({ failure: 'Paying the shop didn’t go through yet; Ren retries.', updatedAt: new Date() })
      .where(eq(schema.nairaPayIns.id, row.id))
      .returning()
    return stuck as PayInRow
  }
}

/** Naira that arrived but whose shop isn't paid yet (a node hiccup): try again. */
export async function retryPayIns(): Promise<void> {
  if (!nairaReady()) return
  const stuck = await db.query.nairaPayIns.findMany({ where: eq(schema.nairaPayIns.status, 'paid'), limit: 10 })
  for (const row of stuck) if (!row.txHash) await payShop(row)
}
