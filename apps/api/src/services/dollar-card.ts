import { schema, uuidv7 } from '@kova/db'
import { encodeMemo, formatAmount } from '@kova/tempo'
import { and, desc, eq, gte, inArray, lt, ne, or, sql } from 'drizzle-orm'
import { type Address, getAddress, type Hex, isAddressEqual } from 'viem'
import { balanceOf, feePayerAddress, onTempo, settlementToken, treasuryClient } from '../chain.js'
import { config, nuvionReady } from '../config.js'
import { db } from '../db.js'
import { KovaError } from '../errors.js'
import { cleanEmail, e164 } from './contact-format.js'
import { hasRequested } from './money.js'
import {
  accountBalance,
  addBookDetail,
  bookTransfer,
  bookTransferToPot,
  businessContact,
  cardFee,
  cardPayments,
  cardSecrets,
  createIndividual,
  createKovaPayee,
  createPayee,
  deleteVirtualCard,
  entityStatus,
  findBookDetail,
  findVirtualCard,
  issueVirtualCard,
  NuvionRefused,
  nuvionSandbox,
  openUsdAccount,
  type Person,
  personContact,
  potAccountNumber,
  rootEntity,
  setCardFrozen,
  submitForReview,
  updateIndividual,
  uploadDocument,
} from './nuvion.js'
import { paidTreasury, sendOnceFromTreasury } from './treasury.js'

/**
 * The dollar card: a virtual USD card from Nuvion, topped up from the wallet.
 *
 * 1. The holder passes Nuvion's ID check once (their details, a photo of their ID and a proof of
 *    address go straight to Nuvion; Ren keeps the ids and whether they passed).
 * 2. Once they pass, Ren opens their card's USD account, makes Ren's pot able to pay it, covers
 *    the card fee from the pot and issues the card.
 * 3. A top-up is two steps, because Tempo has no signed authorization Ren could relay: Ren quotes
 *    the amount plus its fee (KOVA_CARD_TOPUP_FEE_BPS, 0.5%), the wallet sends that to Ren's
 *    treasury with the top-up's memo (Ren's relay pays the fee for exactly that transfer), and tells
 *    Ren the hash. Ren reads the receipt, and only then moves the amount from the pot to the card by
 *    book transfer. A wallet puts at most KOVA_CARD_DAILY_TOPUP on its card a UTC day, and one Tempo
 *    transaction credits once.
 * 4. Money moves off the card the other way, free: the amount from the card's account back to the
 *    pot by book transfer, then the same dollars sent to the wallet from Ren's treasury.
 *
 * The card's number and CVV are read from Nuvion when the holder asks and never stored.
 */

const net = config.KOVA_NETWORK

/**
 * On when Nuvion's key and pot are set and allowed on this network (never a live key on a test
 * network: config.ts), and this server holds the treasury that top-ups pay and withdrawals leave.
 */
export const dollarCardLive = () =>
  onTempo && nuvionReady() && Boolean(treasuryClient && feePayerAddress)

const dailyCap = () => BigInt(config.KOVA_CARD_DAILY_TOPUP)
/** The card's brand, from the first digits of its number (only the name is kept). */
export function cardBrand(number: string): 'mastercard' | 'visa' | 'other' {
  const two = Number(number.slice(0, 2))
  const four = Number(number.slice(0, 4))
  if (number.startsWith('4')) return 'visa'
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return 'mastercard'
  return 'other'
}

/** Base units (6 decimals) per cent. */
const CENT = 10_000n

/** Ren's fee on a top-up of `amount`: KOVA_CARD_TOPUP_FEE_BPS of it, rounded up to the cent. */
export function topUpFee(amount: bigint) {
  const raw = (amount * BigInt(config.KOVA_CARD_TOPUP_FEE_BPS) + 9_999n) / 10_000n
  return ((raw + CENT - 1n) / CENT) * CENT
}

type Holder = typeof schema.cardHolders.$inferSelect
type Card = typeof schema.dollarCards.$inferSelect

const PASSED = 'approved'
/** Sent to Nuvion and being reviewed. */
const REVIEWING = 'pending'
/** Made at Nuvion but never sent for review: a check that stopped part way, to finish. */
const UNSENT = 'incomplete'

/**
 * The national number Nuvion needs, by where the holder is from or lives: a NIN or BVN (11 digits)
 * in Nigeria, a Social Security number in the US, nothing elsewhere.
 */
export function idNumberFor(
  nationality: string,
  residence: string,
  given: { type: 'nin' | 'bvn' | 'ssn'; value: string } | undefined,
): Person['idNumber'] {
  const from = [nationality, residence]
  if (from.includes('NG')) {
    const value = given?.value.replace(/\s/g, '') ?? ''
    if ((given?.type !== 'nin' && given?.type !== 'bvn') || !/^\d{11}$/.test(value))
      throw new KovaError(
        'invalid_request',
        'Nuvion needs your NIN or BVN (11 digits) to check a Nigerian ID.',
      )
    return { type: given.type, value }
  }
  if (from.includes('US')) {
    const value = given?.value.replace(/[\s-]/g, '') ?? ''
    if (given?.type !== 'ssn' || !/^\d{9}$/.test(value))
      throw new KovaError('invalid_request', 'Nuvion needs your Social Security number (9 digits).')
    return { type: 'ssn', value }
  }
  return undefined
}

const isOwner = (wallet: Address) =>
  (config.KOVA_CARD_OWNER_WALLETS ?? '')
    .split(',')
    .some((a) => a.trim().toLowerCase() === wallet.toLowerCase())

/**
 * An owner's holder record: Ren's own business at Nuvion, approved already, since an owner's ID is
 * on file as that business and Nuvion won't take the same person again as a customer.
 */
async function ownerHolder(wallet: Address): Promise<Holder> {
  const [first, ...rest] = config.KOVA_CARD_OWNER_NAME.trim().split(/\s+/)
  await db
    .insert(schema.cardHolders)
    .values({
      id: uuidv7(),
      wallet: wallet.toLowerCase(),
      network: net,
      entityId: await rootEntity(),
      status: PASSED,
      firstName: first || 'Ren',
      lastName: rest.join(' ') || 'Team',
    })
    .onConflictDoNothing()
  return (await holderOf(wallet)) as Holder
}

async function holderOf(wallet: Address): Promise<Holder | null> {
  const row = await db.query.cardHolders.findFirst({
    where: and(
      eq(schema.cardHolders.wallet, wallet.toLowerCase()),
      eq(schema.cardHolders.network, net),
    ),
  })
  return row ?? null
}

async function cardOf(wallet: Address): Promise<Card | null> {
  const [row] = await db
    .select()
    .from(schema.dollarCards)
    .where(
      and(
        eq(schema.dollarCards.wallet, wallet.toLowerCase()),
        eq(schema.dollarCards.network, net),
        sql`${schema.dollarCards.state} <> 'closed'`,
      ),
    )
    .orderBy(desc(schema.dollarCards.createdAt))
    .limit(1)
  return row ?? null
}

/** The start of today in UTC, when a wallet's daily top-up allowance starts again. */
function startOfDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** Top-ups whose dollars reached Ren: on the card, or on their way to it. */
const ARRIVED = ['paid', 'credited', 'failed']

/**
 * What a wallet put on its card on the UTC day of `at`. A top-up counts on the day it was quoted,
 * and only once its dollars arrived: a quote nobody paid uses none of the day's allowance.
 */
async function toppedUpOn(wallet: Address, at = new Date()): Promise<bigint> {
  const from = startOfDay(at)
  const [row] = await db
    .select({ sum: sql<string>`coalesce(sum(${schema.cardTopups.amount}), 0)` })
    .from(schema.cardTopups)
    .where(
      and(
        eq(schema.cardTopups.wallet, wallet.toLowerCase()),
        eq(schema.cardTopups.network, net),
        inArray(schema.cardTopups.status, ARRIVED),
        gte(schema.cardTopups.createdAt, from),
        lt(schema.cardTopups.createdAt, new Date(from.getTime() + 86_400_000)),
      ),
    )
  return BigInt(row?.sum ?? '0')
}

/** Refreshes a holder still being checked, and issues their card the first time they pass. */
async function advance(holder: Holder): Promise<Holder> {
  let row = holder
  if (row.status === REVIEWING || row.status === UNSENT) {
    const now = await entityStatus(row.entityId).catch(() => null)
    // Nuvion's word wins, but a check it never received keeps Ren's note of why it stopped.
    const reason = now && now.status === row.status ? (now.reason ?? row.reason) : now?.reason
    if (now && (now.status !== row.status || reason !== row.reason)) {
      row =
        (
          await db
            .update(schema.cardHolders)
            .set({ status: now.status, reason: reason ?? null, updatedAt: new Date() })
            .where(eq(schema.cardHolders.id, row.id))
            .returning()
        )[0] ?? row
    }
  }
  // A holder who deleted their card asks for the next one: it costs a fee, so it's never automatic.
  if (
    row.status === PASSED &&
    !(await cardOf(row.wallet as Address)) &&
    !(await deletedCardOf(row.wallet as Address))
  )
    row = await issueOnce(row)
  return row
}

/** The newest card this wallet deleted, if any. */
async function deletedCardOf(wallet: Address): Promise<Card | null> {
  const [row] = await db
    .select()
    .from(schema.dollarCards)
    .where(
      and(
        eq(schema.dollarCards.wallet, wallet.toLowerCase()),
        eq(schema.dollarCards.network, net),
        eq(schema.dollarCards.state, 'closed'),
      ),
    )
    .orderBy(desc(schema.dollarCards.createdAt))
    .limit(1)
  return row ?? null
}

/** Why the last try at making a holder's card failed, kept while it keeps failing. */
const issueProblems = new Map<string, string>()
/** For Ren's dashboard: why this holder's card isn't made yet, if a try failed since the restart. */
export const cardIssueProblem = (holderId: string) => issueProblems.get(holderId) ?? null
/**
 * When to ask for a holder's card again after the card provider refused it (Nuvion's 503 on
 * POST /virtual-cards: "the card provider rejected the request", not an outage, so asking on every
 * refresh of the card screen fails the same way). Every few minutes is enough.
 */
const issueAgainAt = new Map<string, number>()
const ISSUE_PAUSE_MS = 10 * 60_000

/** Focus and foreground refreshes can arrive together; share the same issuance attempt. */
const issuing = new Map<string, Promise<Holder>>()
function issueOnce(holder: Holder): Promise<Holder> {
  const running = issuing.get(holder.id)
  if (running) return running
  const job = (async () => {
    const fresh = (await holderOf(holder.wallet as Address)) ?? holder
    if (await cardOf(holder.wallet as Address)) return fresh
    if ((issueAgainAt.get(holder.id) ?? 0) > Date.now()) return fresh
    try {
      const made = await issue(fresh)
      issueProblems.delete(holder.id)
      issueAgainAt.delete(holder.id)
      return made
    } catch (error) {
      issueProblems.set(
        holder.id,
        error instanceof NuvionRefused || error instanceof KovaError
          ? error.message
          : 'The card issuer didn’t answer.',
      )
      throw error
    }
  })().finally(() => issuing.delete(holder.id))
  issuing.set(holder.id, job)
  return job
}

/** Opens the card's account, lets the pot pay it, covers the card fee and issues the card. */
async function issue(holder: Holder): Promise<Holder> {
  let row = holder
  if (!row.accountId) {
    const account = await openUsdAccount(row.entityId)
    row =
      (
        await db
          .update(schema.cardHolders)
          .set({ ...account, updatedAt: new Date() })
          .where(eq(schema.cardHolders.id, row.id))
          .returning()
      )[0] ?? row
  }
  if (!row.paymentDetailId && row.accountNumber) {
    // Already made on an earlier try? Reuse it rather than make a duplicate.
    const found = await findBookDetail(row.accountNumber).catch(() => null)
    if (found)
      row =
        (
          await db
            .update(schema.cardHolders)
            .set({ ...found, updatedAt: new Date() })
            .where(eq(schema.cardHolders.id, row.id))
            .returning()
        )[0] ?? row
  }
  if (isOwner(row.wallet as Address) && (!row.email || !row.phone || !row.counterpartyId)) {
    // An owner's card and payee carry Ren's own business email, phone and address.
    const contact = await businessContact(row.entityId)
    const counterpartyId =
      row.counterpartyId ?? (row.paymentDetailId ? null : await createPayee({ ...row, ...contact }))
    row =
      (
        await db
          .update(schema.cardHolders)
          .set({
            email: row.email ?? contact.email,
            phone: row.phone ?? contact.phone,
            ...(counterpartyId ? { counterpartyId } : {}),
            updatedAt: new Date(),
          })
          .where(eq(schema.cardHolders.id, row.id))
          .returning()
      )[0] ?? row
  }
  if (!row.counterpartyId && !row.paymentDetailId) {
    // A check that reached Nuvion before Ren's payee was made: make it from what Nuvion holds.
    const contact = await personContact(row.entityId)
    row =
      (
        await db
          .update(schema.cardHolders)
          .set({ counterpartyId: await createPayee({ ...row, ...contact }), updatedAt: new Date() })
          .where(eq(schema.cardHolders.id, row.id))
          .returning()
      )[0] ?? row
  }
  if (!row.paymentDetailId) {
    if (!row.accountNumber)
      throw new KovaError('chain_error', 'The card’s account has no number yet. Try again shortly.')
    if (!row.counterpartyId)
      throw new KovaError('chain_error', 'This card holder has no payee at the issuer yet.')
    const payee = {
      paymentDetailId: await addBookDetail(
        row.counterpartyId,
        `${row.firstName} ${row.lastName}`,
        row.accountNumber,
      ),
    }
    row =
      (
        await db
          .update(schema.cardHolders)
          .set({ ...payee, updatedAt: new Date() })
          .where(eq(schema.cardHolders.id, row.id))
          .returning()
      )[0] ?? row
  }
  const accountId = row.accountId as string
  const found = await findVirtualCard(row.entityId, accountId)
  // Nuvion leaves deleted cards out of its list, but never take back one this holder deleted.
  const deleted = await deletedCardOf(row.wallet as Address)
  const existingCard = found && found !== deleted?.providerCardToken ? found : null
  const fee = existingCard ? 0 : await cardFee(accountId, row.entityId)
  if (fee > 0) {
    // Ren pays the issuer's card fee; the reference makes sure it's paid once per holder.
    await bookTransfer(
      {
        counterpartyId: row.counterpartyId as string,
        paymentDetailId: row.paymentDetailId as string,
      },
      fee,
      // Once per card: a card made after a deleted one pays its own fee, never the holder's money.
      deleted ? `ren-card-fee-${row.id}-${deleted.id.replace(/-/g, '')}` : `ren-card-fee-${row.id}`,
      'Ren card fee',
    ).catch((e) => {
      if (!(e instanceof NuvionRefused && e.status === 409)) throw e
    })
  }
  if (!row.email || !row.phone)
    throw new KovaError('chain_error', 'The card issuer needs an email and phone for this card.')
  // The card provider takes only E.164 phones and clean emails: fix ones saved before Ren did
  // ("+2340803…" → "+234803…"), and keep the fixed copy.
  const contact = { email: cleanEmail(row.email), phone: e164(row.phone) ?? row.phone }
  if (contact.email !== row.email || contact.phone !== row.phone)
    row =
      (
        await db
          .update(schema.cardHolders)
          .set({ ...contact, updatedAt: new Date() })
          .where(eq(schema.cardHolders.id, row.id))
          .returning()
      )[0] ?? row
  const cardId =
    existingCard ??
    (await issueVirtualCard(row.entityId, accountId, { ...row, ...contact }).catch((e) => {
      // The card provider refused to make it: ask again in a few minutes, not on every refresh.
      if (e instanceof NuvionRefused && e.status >= 500)
        issueAgainAt.set(row.id, Date.now() + ISSUE_PAUSE_MS)
      throw e
    }))
  const secrets = await cardSecrets(cardId, row.entityId)
  await db.insert(schema.dollarCards).values({
    id: uuidv7(),
    wallet: row.wallet,
    network: net,
    provider: 'nuvion',
    providerCardToken: cardId,
    lastFour: secrets.number.slice(-4),
    brand: cardBrand(secrets.number),
    expMonth: secrets.expMonth,
    expYear: secrets.expYear,
    state: secrets.status === 'blocked' ? 'paused' : 'open',
    dailyLimit: dailyCap(),
  })
  return row
}

export async function dollarCardFor(wallet: Address) {
  const live = dollarCardLive()
  const base = {
    object: 'dollar_card' as const,
    live,
    sandbox: live && nuvionSandbox(),
    provider: 'Nuvion',
    daily_topup: dailyCap().toString(),
    topup_fee_bps: config.KOVA_CARD_TOPUP_FEE_BPS,
  }
  if (!live)
    return {
      ...base,
      requested: await hasRequested(wallet, 'dollar_card'),
      stage: 'intro' as const,
    }
  let holder = await holderOf(wallet)
  if (!holder && isOwner(wallet)) holder = await ownerHolder(wallet).catch(() => null)
  if (holder)
    holder = await advance(holder).catch(async (error) => {
      console.error('[dollar-card]', error)
      // Approval may have been saved before a later issuer request failed.
      return (await holderOf(wallet)) ?? holder
    })
  let card = await cardOf(wallet)
  if (card && !card.brand && holder) {
    // A card made before Ren kept its brand: work it out once.
    const brand = await cardSecrets(card.providerCardToken, holder.entityId)
      .then((s) => cardBrand(s.number))
      .catch(() => null)
    if (brand) {
      await db
        .update(schema.dollarCards)
        .set({ brand, updatedAt: new Date() })
        .where(eq(schema.dollarCards.id, card.id))
      card = { ...card, brand }
    }
  }
  if (holder && !card && holder.status === PASSED && (await deletedCardOf(wallet))) {
    // They deleted their card. Whatever was on its account is still theirs to move to Ren.
    const cents = holder.accountId
      ? await accountBalance(holder.accountId, holder.entityId).catch(() => null)
      : null
    return {
      ...base,
      requested: false,
      stage: 'closed' as const,
      approved: true,
      balance: cents === null ? null : (BigInt(cents) * CENT).toString(),
    }
  }
  if (!holder || !card)
    return {
      ...base,
      requested: false,
      // Approved, but the issuer wouldn't make the card yet: say so rather than wait in silence.
      card_problem: holder ? (issueProblems.get(holder.id) ?? null) : null,
      stage: !holder
        ? ('intro' as const)
        : holder.status === PASSED || holder.status === REVIEWING
          ? ('checking' as const)
          : ('fix' as const),
      // Never reviewed (it stopped before Nuvion had everything), as against reviewed and refused.
      unfinished: holder?.status === UNSENT,
      approved: holder?.status === PASSED,
      reason: holder?.reason ?? null,
    }

  const [cents, payments, today, topups, withdrawals] = await Promise.all([
    holder.accountId ? accountBalance(holder.accountId, holder.entityId).catch(() => null) : null,
    cardPayments(card.providerCardToken, holder.entityId).catch(() => []),
    toppedUpOn(wallet),
    db
      .select()
      .from(schema.cardTopups)
      .where(
        and(
          eq(schema.cardTopups.wallet, wallet.toLowerCase()),
          eq(schema.cardTopups.network, net),
          inArray(schema.cardTopups.status, ARRIVED),
        ),
      )
      .orderBy(desc(schema.cardTopups.createdAt))
      .limit(20),
    db
      .select()
      .from(schema.cardWithdrawals)
      .where(
        and(
          eq(schema.cardWithdrawals.wallet, wallet.toLowerCase()),
          eq(schema.cardWithdrawals.network, net),
          sql`${schema.cardWithdrawals.status} <> 'failed'`,
        ),
      )
      .orderBy(desc(schema.cardWithdrawals.createdAt))
      .limit(20),
  ])
  const activity = [
    ...payments.map((p) => ({
      id: p.id,
      kind: p.check ? ('check' as const) : p.cents < 0 ? ('spend' as const) : ('refund' as const),
      amount: (BigInt(p.cents) * CENT).toString(),
      status: p.status,
      title: p.merchant,
      at: p.at.toISOString(),
    })),
    ...topups.map((t) => ({
      id: t.id,
      kind: 'topup' as const,
      amount: t.amount.toString(),
      status: t.status === 'credited' ? 'successful' : 'pending',
      title: 'Top up from Ren',
      at: t.createdAt.toISOString(),
    })),
    ...withdrawals.map((w) => ({
      id: w.id,
      kind: 'withdraw' as const,
      amount: (-w.amount).toString(),
      status: w.status === 'paid' ? 'successful' : 'pending',
      title: 'Moved to Ren',
      at: w.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 20)
  const left = dailyCap() > today ? dailyCap() - today : 0n
  return {
    ...base,
    requested: false,
    stage: 'card' as const,
    card: {
      last_four: card.lastFour,
      brand: card.brand ?? 'other',
      exp_month: card.expMonth,
      exp_year: card.expYear,
      frozen: card.state === 'paused',
      balance: cents === null ? null : (BigInt(cents) * CENT).toString(),
      name: `${holder.firstName} ${holder.lastName}`,
    },
    topups: {
      today: today.toString(),
      left: left.toString(),
      treasury: feePayerAddress ? getAddress(feePayerAddress) : null,
    },
    activity,
  }
}

/** A file for Nuvion, base64 without the data: prefix. */
type Upload = { base64: string; mime: string; backBase64?: string }

/**
 * Sends the holder's details, ID and proof of address to Nuvion's check. Safe to send again: a
 * check that stopped part way carries on where Nuvion has it, and one Nuvion is already reviewing
 * just answers where it is. A refusal is kept as the reason, so the card screen says what to fix.
 */
export async function startCheck(
  wallet: Address,
  given: Person,
  files: { identity: Upload; address: Upload },
) {
  if (!dollarCardLive())
    throw new KovaError('conflict', 'The dollar card isn’t switched on for this server yet.')
  // As the card provider will want them later: an E.164 phone ("+2340803…" → "+234803…").
  const phone = e164(given.phone)
  if (!phone)
    throw new KovaError(
      'invalid_request',
      'Enter your phone number with its country code, like +234 803 123 4567.',
    )
  const person: Person = { ...given, email: cleanEmail(given.email), phone }
  const mine = and(
    eq(schema.cardHolders.wallet, wallet.toLowerCase()),
    eq(schema.cardHolders.network, net),
  )
  let existing = await holderOf(wallet)
  // Where Nuvion has it now: an earlier try may have got further than Ren recorded.
  if (existing) existing = await advance(existing).catch(() => existing)
  // Already with Nuvion: nothing to send again (a payee it lacks is made when the card is issued).
  if (existing && (existing.status === PASSED || existing.status === REVIEWING))
    return dollarCardFor(wallet)
  try {
    let entityId: string
    let personId: string | null
    if (existing) {
      ;({ entityId, personId } = existing)
      await updateIndividual(entityId, person)
    } else {
      ;({ entityId, personId } = await createIndividual(person))
      await db.insert(schema.cardHolders).values({
        id: uuidv7(),
        wallet: wallet.toLowerCase(),
        network: net,
        entityId,
        personId,
        status: UNSENT,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        phone: person.phone,
      })
    }
    await uploadDocument(entityId, personId, 'identity', files.identity)
    await uploadDocument(entityId, personId, 'proof_of_address', files.address)
    await submitForReview(entityId)
    // Ren's payee for this holder, made now while their address is in hand (it isn't kept).
    const counterpartyId = existing?.counterpartyId ?? (await createPayee(person))
    await db
      .update(schema.cardHolders)
      .set({
        status: REVIEWING,
        reason: null,
        counterpartyId,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        phone: person.phone,
        updatedAt: new Date(),
      })
      .where(mine)
  } catch (e) {
    if (!(e instanceof NuvionRefused)) throw e
    console.error('[dollar-card] check refused:', e.status, e.code ?? '', e.message)
    // 409: Nuvion has this person already. Its own words ("use different details") would push
    // people to make details up; say where they are instead.
    const said =
      e.status === 409
        ? await alreadyOnFile(wallet, person, given)
        : `The card issuer couldn’t take that: ${e.message}`
    await db
      .update(schema.cardHolders)
      .set({ reason: e.status === 409 ? said : e.message, updatedAt: new Date() })
      .where(mine)
    throw new KovaError('invalid_request', said)
  }
  return dollarCardFor(wallet)
}

/**
 * Nuvion already has this person: most often from an earlier check on another Ren wallet (a new
 * phone, a reinstall), which this names by its last four characters so they can open it. It never
 * moves that record to this wallet: anyone who knew the person's name and email could ask that.
 */
async function alreadyOnFile(wallet: Address, person: Person, given: Person): Promise<string> {
  const other = await db.query.cardHolders.findFirst({
    where: and(
      eq(schema.cardHolders.network, net),
      ne(schema.cardHolders.wallet, wallet.toLowerCase()),
      or(
        sql`lower(${schema.cardHolders.email}) = ${person.email}`,
        inArray(schema.cardHolders.phone, [...new Set([person.phone, given.phone])]),
      ),
    ),
    // More than one: the one used last is the one they'll recognise.
    orderBy: desc(schema.cardHolders.updatedAt),
  })
  return other
    ? `You’ve already done this check with another Ren wallet, the one ending ${getAddress(other.wallet).slice(-4)}. Open that wallet to use your card and cash out.`
    : 'Ren’s banking partner already has you on file, from another account. Write to Ren and we’ll sort it out.'
}

// ── Topping up ─────────────────────────────────────────────────────────────────────────────

type Topup = typeof schema.cardTopups.$inferSelect

/** A top-up's quote stays payable this long. */
const TOPUP_QUOTE_MS = 10 * 60_000

export const topUpMemo = (row: Pick<Topup, 'id'>) => encodeMemo({ kind: 'card-topup', id: row.id })

/** What the wallet needs to pay a top-up: how much, where to, and the memo that names it. */
export function serializeTopUp(row: Topup) {
  const total = row.amount + row.fee
  return {
    id: row.id,
    amount: row.amount.toString(),
    fee: row.fee.toString(),
    total: total.toString(),
    expires_at: row.expiresAt.toISOString(),
    pay: {
      token: getAddress(settlementToken.address),
      to: feePayerAddress ? getAddress(feePayerAddress) : null,
      amount: total.toString(),
      memo: topUpMemo(row),
    },
  }
}

async function topUpRow(id: string): Promise<Topup | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined
  return db.query.cardTopups.findFirst({ where: eq(schema.cardTopups.id, id) })
}

/** Why a top-up of `value` would take a wallet past the day's limit, given what it has put on already. */
function overTheDay(already: bigint, value: bigint): string | null {
  if (already + value <= dailyCap()) return null
  const left = dailyCap() > already ? dailyCap() - already : 0n
  return left === 0n
    ? `You’ve topped up $${formatAmount(dailyCap())} today, the most for a day. Try again tomorrow.`
    : `You can top up $${formatAmount(left)} more today.`
}

/**
 * Step one of a top-up of `amount` onto the card: what it costs with Ren's fee, and where the wallet
 * sends it. Nothing moves here; the quote only fixes the amount the relay will pay the fee for and
 * the API will accept.
 */
export async function quoteTopUp(wallet: Address, amount: bigint): Promise<Topup> {
  if (!dollarCardLive())
    throw new KovaError('conflict', 'The dollar card isn’t switched on for this server yet.')
  const holder = await holderOf(wallet)
  const card = await cardOf(wallet)
  if (!holder?.paymentDetailId || !card)
    throw new KovaError('not_found', 'This wallet has no dollar card yet.')
  if (amount <= 0n || amount % CENT !== 0n)
    throw new KovaError('invalid_request', 'Top up a whole number of cents, more than $0.00.')
  const over = overTheDay(await toppedUpOn(wallet), amount)
  if (over) throw new KovaError('policy_declined', over)
  const id = uuidv7()
  const [row] = await db
    .insert(schema.cardTopups)
    .values({
      id,
      wallet: wallet.toLowerCase(),
      network: net,
      amount,
      fee: topUpFee(amount),
      // Unique at Nuvion, so the move onto the card happens once however often it's asked for.
      reference: `ren-topup-${id.replace(/-/g, '')}`,
      expiresAt: new Date(Date.now() + TOPUP_QUOTE_MS),
    })
    .returning()
  if (!row) throw new KovaError('internal', 'Ren couldn’t start that top-up. Try again.')
  return row
}

/**
 * Whether Ren's relay should pay the fee for this transfer: exactly an open top-up's amount and
 * fee, to Ren's treasury, from the wallet that asked for it.
 */
export async function topUpSponsorProblem(input: {
  id: string
  to: Address
  amount: bigint
  token: Address
  from: Address | undefined
}): Promise<string | null> {
  if (!dollarCardLive()) return 'the dollar card is off'
  const row = await topUpRow(input.id)
  if (!row || row.network !== net) return 'no matching top-up'
  if (row.status !== 'quoted') return `top-up is ${row.status}`
  if (row.expiresAt < new Date()) return 'top-up quote expired'
  if (!feePayerAddress || !isAddressEqual(input.to, feePayerAddress))
    return 'a top-up must go to Ren’s treasury'
  if (input.amount !== row.amount + row.fee) return 'amount does not match the top-up'
  if (!isAddressEqual(input.token, settlementToken.address))
    return 'token does not match the top-up'
  if (!input.from || !isAddressEqual(input.from, row.wallet as Address))
    return 'top-up is another wallet’s'
  return null
}

/** Wallets whose top-up is being read right now: one at a time each, so the day's limit holds. */
const toppingUp = new Map<string, Promise<unknown>>()

/**
 * Step two: the wallet sent the dollars. Ren reads the transaction, and only if it is exactly this
 * top-up's (amount plus fee, Ren's dollar, from this wallet, to the treasury, with its memo) moves
 * the amount onto the card. It happens once: a top-up leaves `quoted` once, and its reference is
 * unique at Nuvion. If the move onto the card fails, the dollars are already Ren's and
 * `creditTopups` keeps trying, so the card always gets what was paid for.
 *
 * The day's limit is checked again here, because two quotes can both be under it and then both be
 * paid: the one that goes over is sent back to the wallet rather than put on the card.
 */
export async function topUpSent(wallet: Address, id: string, txHash: Hex) {
  const key = wallet.toLowerCase()
  if (toppingUp.has(key))
    throw new KovaError('conflict', 'A top-up is already on its way. Give it a second.')
  const job = (async () => {
    if (!dollarCardLive())
      throw new KovaError('conflict', 'The dollar card isn’t switched on for this server yet.')
    const row = await topUpRow(id)
    if (!row || row.wallet !== key || row.network !== net)
      throw new KovaError('not_found', 'No such top-up.')
    if (row.status !== 'quoted') return dollarCardFor(wallet)
    const paid = await paidTreasury(txHash, {
      from: wallet,
      amount: row.amount + row.fee,
      memo: topUpMemo(row),
    })
    if (!paid)
      throw new KovaError(
        'invalid_request',
        'That transaction didn’t send this top-up’s dollars to Ren.',
      )
    const [claimed] = await db
      .update(schema.cardTopups)
      .set({ status: 'paid', txHash, updatedAt: new Date() })
      .where(and(eq(schema.cardTopups.id, row.id), eq(schema.cardTopups.status, 'quoted')))
      .returning()
    if (!claimed) return dollarCardFor(wallet)
    // Its own amount is in the day's sum now, so the sum itself is what must fit.
    if ((await toppedUpOn(wallet, claimed.createdAt)) > dailyCap()) {
      const total = formatAmount(claimed.amount + claimed.fee)
      const [refunding] = await db
        .update(schema.cardTopups)
        .set({
          status: 'refunding',
          problem: 'Past the day’s limit: sent back to the wallet.',
          updatedAt: new Date(),
        })
        .where(eq(schema.cardTopups.id, claimed.id))
        .returning()
      const back = refunding ? await refundTopUp(refunding) : null
      throw new KovaError(
        'policy_declined',
        back
          ? `That’s past what your card takes in a day, so your $${total} went back to your wallet.`
          : `That’s past what your card takes in a day, so Ren is sending your $${total} back to your wallet.`,
      )
    }
    const holder = await holderOf(wallet)
    if (holder?.paymentDetailId) await credit(claimed, holder)
    return dollarCardFor(wallet)
  })()
  toppingUp.set(key, job)
  try {
    return await job
  } finally {
    toppingUp.delete(key)
  }
}

/** Sends a top-up that can't go on the card back to its wallet, once (services/treasury.ts). */
async function refundTopUp(row: Topup): Promise<Hex | null> {
  const mine = eq(schema.cardTopups.id, row.id)
  try {
    const hash = await sendOnceFromTreasury(
      { txHash: row.refundTxHash, block: row.refundBlock, triedAt: row.refundTriedAt },
      {
        to: getAddress(row.wallet),
        amount: row.amount + row.fee,
        memo: encodeMemo({ kind: 'refund', id: row.id }),
      },
      async (next) => {
        await db
          .update(schema.cardTopups)
          .set({
            ...('txHash' in next ? { refundTxHash: next.txHash } : {}),
            ...('block' in next ? { refundBlock: next.block } : {}),
            ...('triedAt' in next ? { refundTriedAt: next.triedAt } : {}),
            updatedAt: new Date(),
          })
          .where(mine)
      },
    )
    if (!hash) return null
    await db
      .update(schema.cardTopups)
      .set({ status: 'refunded', refundTxHash: hash, updatedAt: new Date() })
      .where(mine)
    return hash
  } catch (e) {
    console.error('[dollar-card] sending a top-up back failed:', row.id, (e as Error).message)
    return null
  }
}

async function credit(row: typeof schema.cardTopups.$inferSelect, holder: Holder) {
  try {
    const transferId = await bookTransfer(
      {
        counterpartyId: holder.counterpartyId as string,
        paymentDetailId: holder.paymentDetailId as string,
      },
      Number(row.amount / CENT),
      row.reference,
      'Ren card top-up',
    )
    await db
      .update(schema.cardTopups)
      .set({ status: 'credited', transferId, problem: null, updatedAt: new Date() })
      .where(eq(schema.cardTopups.id, row.id))
  } catch (e) {
    // 409: a transfer with this reference already exists, so the card already has it.
    const done = e instanceof NuvionRefused && e.status === 409
    await db
      .update(schema.cardTopups)
      .set(
        done
          ? { status: 'credited', problem: null, updatedAt: new Date() }
          : {
              status: 'failed',
              problem: (e as Error).message.slice(0, 500),
              updatedAt: new Date(),
            },
      )
      .where(eq(schema.cardTopups.id, row.id))
  }
}

/** Moves onto cards whatever was paid but didn't reach the card yet (run every 30 seconds). */
export async function creditTopups() {
  if (!dollarCardLive()) return
  const due = await db
    .select()
    .from(schema.cardTopups)
    .where(
      and(
        eq(schema.cardTopups.network, net),
        inArray(schema.cardTopups.status, ['paid', 'failed']),
      ),
    )
    .limit(20)
  for (const row of due) {
    const holder = await holderOf(row.wallet as Address)
    if (holder?.paymentDetailId) await credit(row, holder)
  }
  // And sends back whatever arrived past a day's limit and hasn't reached its wallet yet.
  const back = await db
    .select()
    .from(schema.cardTopups)
    .where(and(eq(schema.cardTopups.network, net), eq(schema.cardTopups.status, 'refunding')))
    .limit(20)
  for (const row of back) if (!toppingUp.has(row.wallet)) await refundTopUp(row)
}

/** Wallets moving money off their card right now: one move at a time each. */
const withdrawing = new Map<string, Promise<unknown>>()

/** The least that moves off a card at once. */
const MIN_WITHDRAW = 1_000_000n

/**
 * Moves `amount` off the card to the wallet, free: from the card's account back to Ren's pot at
 * Nuvion, then the same dollars from Ren's treasury to the wallet. Nothing leaves the card unless
 * the treasury holds the dollars to pay it, and a move that stops part way is finished by
 * `settleWithdrawals`, so dollars that left the card always reach the wallet.
 */
export async function withdraw(wallet: Address, amount: bigint) {
  const key = wallet.toLowerCase()
  if (withdrawing.has(key))
    throw new KovaError('conflict', 'Money is already on its way off your card. Give it a second.')
  const job = (async () => {
    if (!dollarCardLive() || !feePayerAddress)
      throw new KovaError('conflict', 'The dollar card isn’t switched on for this server yet.')
    const holder = await holderOf(wallet)
    // The money sits on the card's account, not the card: it moves even after the card is deleted.
    const card = (await cardOf(wallet)) ?? (await deletedCardOf(wallet))
    if (!holder?.accountId || !card)
      throw new KovaError('not_found', 'This wallet has no dollar card yet.')
    if (amount % CENT !== 0n)
      throw new KovaError('invalid_request', 'Move a whole number of cents.')
    if (amount < MIN_WITHDRAW)
      throw new KovaError('invalid_request', `Move at least $${formatAmount(MIN_WITHDRAW)}.`)
    const onCard = BigInt(await accountBalance(holder.accountId, holder.entityId)) * CENT
    if (amount > onCard)
      throw new KovaError(
        'policy_declined',
        `Your card has $${formatAmount(onCard)}. Move that much or less.`,
      )
    // Ren pays the wallet from its treasury: it must hold the dollars before any leave the card.
    const [held, owed] = await Promise.all([
      balanceOf(settlementToken.address, feePayerAddress),
      owedToWallets(),
    ])
    if (held < owed + amount) {
      console.error('[dollar-card] the treasury is short for a move off a card', {
        held: String(held),
        owed: String(owed),
        amount: String(amount),
      })
      throw new KovaError(
        'conflict',
        'Moving money off the card is paused for a moment. Everything is still on your card.',
      )
    }
    const back = await wayBack(holder)
    const [row] = await db
      .insert(schema.cardWithdrawals)
      .values({
        id: uuidv7(),
        wallet: key,
        network: net,
        amount,
        reference: `ren-back-${uuidv7().replace(/-/g, '')}`,
      })
      .returning()
    if (!row) throw new KovaError('internal', 'Ren couldn’t start that move. Try again.')
    const pulled = await pull(row, holder, back)
    if (pulled === 'refused')
      throw new KovaError(
        'policy_declined',
        'The card issuer didn’t let that money move. Everything is still on your card.',
      )
    const paid = pulled === 'pulled' ? await pay(row) : null
    return { tx_hash: paid, card: await dollarCardFor(wallet) }
  })()
  withdrawing.set(key, job)
  try {
    return await job
  } finally {
    withdrawing.delete(key)
  }
}

/** Dollars already off cards and not yet sent to their wallets. */
async function owedToWallets() {
  const [row] = await db
    .select({ sum: sql<string>`coalesce(sum(${schema.cardWithdrawals.amount}), 0)` })
    .from(schema.cardWithdrawals)
    .where(
      and(
        eq(schema.cardWithdrawals.network, net),
        inArray(schema.cardWithdrawals.status, ['pulling', 'pulled']),
      ),
    )
  return BigInt(row?.sum ?? '0')
}

/**
 * The holder's way to pay Ren's pot: Ren's business as their own counterparty, with a
 * book-transfer detail naming the pot. Made the first time they move money off the card.
 */
async function wayBack(holder: Holder) {
  if (holder.returnCounterpartyId && holder.returnPaymentDetailId)
    return {
      counterpartyId: holder.returnCounterpartyId,
      paymentDetailId: holder.returnPaymentDetailId,
    }
  const mine = eq(schema.cardHolders.id, holder.id)
  try {
    const ren = await businessContact(await rootEntity())
    const counterpartyId =
      holder.returnCounterpartyId ?? (await createKovaPayee(holder.entityId, ren))
    await db
      .update(schema.cardHolders)
      .set({ returnCounterpartyId: counterpartyId, updatedAt: new Date() })
      .where(mine)
    const paymentDetailId = await addBookDetail(
      counterpartyId,
      ren.name,
      await potAccountNumber(),
      holder.entityId,
    )
    await db
      .update(schema.cardHolders)
      .set({ returnPaymentDetailId: paymentDetailId, updatedAt: new Date() })
      .where(mine)
    return { counterpartyId, paymentDetailId }
  } catch (e) {
    if (!(e instanceof NuvionRefused)) throw e
    console.error('[dollar-card] no way back to the pot:', e.status, e.code ?? '', e.message)
    throw new KovaError(
      'conflict',
      'Moving money off the card isn’t ready for your card yet. Everything is still on it.',
    )
  }
}

// ── Cash-outs in the person's own name ─────────────────────────────────────────────────────

/** Where a wallet stands on the ID check that cash-outs abroad need (the same as the card's). */
export type PayoutVerification = 'verified' | 'checking' | 'needed' | 'failed'

export async function payoutVerification(wallet: Address): Promise<PayoutVerification> {
  const holder = await holderOf(wallet)
  if (!holder || holder.status === UNSENT) return 'needed'
  if (holder.status === PASSED)
    return holder.accountId && holder.paymentDetailId ? 'verified' : 'checking'
  if (holder.status === REVIEWING) return 'checking'
  return 'failed'
}

/**
 * The wallet's verified person at Nuvion, for a cash-out in their own name: passed the ID check,
 * with their own USD account open and both ways set up between it and Ren's pot. Null until then.
 */
export async function payoutHolder(wallet: Address) {
  const holder = await holderOf(wallet)
  if (
    !holder ||
    holder.status !== PASSED ||
    !holder.accountId ||
    !holder.counterpartyId ||
    !holder.paymentDetailId
  )
    return null
  return {
    entityId: holder.entityId,
    accountId: holder.accountId,
    /** Ren's pot pays their account through this. */
    toAccount: { counterpartyId: holder.counterpartyId, paymentDetailId: holder.paymentDetailId },
    /** Their account pays Ren's pot back through this, made the first time it's needed. */
    toPot: () => wayBack(holder),
  }
}

export type PayoutHolder = NonNullable<Awaited<ReturnType<typeof payoutHolder>>>

type Withdrawal = typeof schema.cardWithdrawals.$inferSelect

/**
 * Moves a withdrawal's amount from the card back to the pot, once (its reference is unique at
 * Nuvion). `refused` means Nuvion said no and nothing moved; `unsure` means it didn't answer, so it
 * is asked again with the same reference until it says.
 */
async function pull(
  row: Withdrawal,
  holder: Holder,
  back: { counterpartyId: string; paymentDetailId: string },
): Promise<'pulled' | 'refused' | 'unsure'> {
  const mine = eq(schema.cardWithdrawals.id, row.id)
  try {
    const transferId = await bookTransferToPot(
      { accountId: holder.accountId as string, entityId: holder.entityId },
      back,
      Number(row.amount / CENT),
      row.reference,
      'Moved to Ren',
    )
    await db
      .update(schema.cardWithdrawals)
      .set({ status: 'pulled', transferId, problem: null, updatedAt: new Date() })
      .where(mine)
    return 'pulled'
  } catch (e) {
    // 409: a transfer with this reference already exists, so the money already left the card.
    if (e instanceof NuvionRefused && e.status === 409) {
      await db
        .update(schema.cardWithdrawals)
        .set({ status: 'pulled', problem: null, updatedAt: new Date() })
        .where(mine)
      return 'pulled'
    }
    const problem = (e as Error).message.slice(0, 500)
    const refused = e instanceof NuvionRefused && e.status < 500
    if (refused) console.error('[dollar-card] a move off a card was refused:', problem)
    await db
      .update(schema.cardWithdrawals)
      .set({ status: refused ? 'failed' : 'pulling', problem, updatedAt: new Date() })
      .where(mine)
    return refused ? 'refused' : 'unsure'
  }
}

/**
 * Sends a pulled withdrawal's dollars from Ren's treasury to the wallet, once: the transfer carries
 * this withdrawal's memo, and one that got no answer is looked for on Tempo before it's sent again
 * (services/treasury.ts).
 */
async function pay(row: Withdrawal): Promise<Hex | null> {
  const mine = eq(schema.cardWithdrawals.id, row.id)
  try {
    const hash = await sendOnceFromTreasury(
      { txHash: row.txHash, block: row.payBlock, triedAt: row.payTriedAt },
      {
        to: getAddress(row.wallet),
        amount: row.amount,
        memo: encodeMemo({ kind: 'card-withdraw', id: row.id }),
      },
      async (next) => {
        await db
          .update(schema.cardWithdrawals)
          .set({
            ...('txHash' in next ? { txHash: next.txHash } : {}),
            ...('block' in next ? { payBlock: next.block } : {}),
            ...('triedAt' in next ? { payTriedAt: next.triedAt } : {}),
            updatedAt: new Date(),
          })
          .where(mine)
      },
    )
    if (!hash) return null
    await db
      .update(schema.cardWithdrawals)
      .set({ status: 'paid', txHash: hash, problem: null, updatedAt: new Date() })
      .where(mine)
    return hash
  } catch (e) {
    const problem = (e as Error).message.slice(0, 500)
    console.error('[dollar-card] paying a move off a card failed:', problem)
    await db.update(schema.cardWithdrawals).set({ problem, updatedAt: new Date() }).where(mine)
    return null
  }
}

/** Finishes moves off cards that stopped part way (run every 30 seconds). */
export async function settleWithdrawals() {
  if (!dollarCardLive()) return
  const due = await db
    .select()
    .from(schema.cardWithdrawals)
    .where(
      and(
        eq(schema.cardWithdrawals.network, net),
        inArray(schema.cardWithdrawals.status, ['pulling', 'pulled']),
      ),
    )
    .limit(20)
  for (const row of due) {
    if (withdrawing.has(row.wallet)) continue
    if (row.status === 'pulling') {
      const holder = await holderOf(row.wallet as Address)
      if (!holder?.accountId || !holder.returnCounterpartyId || !holder.returnPaymentDetailId)
        continue
      const pulled = await pull(row, holder, {
        counterpartyId: holder.returnCounterpartyId,
        paymentDetailId: holder.returnPaymentDetailId,
      })
      if (pulled !== 'pulled') continue
    }
    await pay(row)
  }
}

export async function setDollarCard(wallet: Address, frozen: boolean) {
  const holder = await holderOf(wallet)
  const card = await cardOf(wallet)
  if (!card || !holder) throw new KovaError('not_found', 'This wallet has no dollar card yet.')
  await setCardFrozen(card.providerCardToken, frozen, holder.entityId)
  await db
    .update(schema.dollarCards)
    .set({ state: frozen ? 'paused' : 'open', updatedAt: new Date() })
    .where(eq(schema.dollarCards.id, card.id))
  return dollarCardFor(wallet)
}

/**
 * Deletes the holder's card for good. Nuvion can't bring a deleted card back, but the money was
 * never on the card itself: it stays on the card's account, and moves to Ren as before.
 */
export async function deleteDollarCard(wallet: Address) {
  const holder = await holderOf(wallet)
  const card = await cardOf(wallet)
  if (!card || !holder)
    throw new KovaError('not_found', 'This wallet has no dollar card to delete.')
  await deleteVirtualCard(card.providerCardToken, holder.entityId).catch((error) => {
    // Already deleted at Nuvion (a retry, or deleted there): finish the job here.
    if (error instanceof NuvionRefused && error.status === 404) return
    throw error
  })
  await db
    .update(schema.dollarCards)
    .set({ state: 'closed', updatedAt: new Date() })
    .where(eq(schema.dollarCards.id, card.id))
  return dollarCardFor(wallet)
}

/** A new card for a holder who deleted theirs, on the same account (Nuvion charges for each card). */
export async function newDollarCard(wallet: Address) {
  const holder = await holderOf(wallet)
  if (!holder || holder.status !== PASSED)
    throw new KovaError('not_found', 'Pass the ID check before getting a card.')
  if (await cardOf(wallet)) return dollarCardFor(wallet)
  limitNewCards(wallet)
  await issueOnce(holder)
  return dollarCardFor(wallet)
}

/** At most two new cards a day per wallet: each one costs Ren Nuvion's card fee. */
const newCards = new Map<string, number[]>()
function limitNewCards(wallet: Address) {
  const key = wallet.toLowerCase()
  const day = Date.now() - 86_400_000
  const recent = (newCards.get(key) ?? []).filter((t) => t > day)
  if (recent.length >= 2)
    throw new KovaError('rate_limited', 'That’s two new cards today. Try again tomorrow.')
  newCards.set(key, [...recent, Date.now()])
}

/** The card's number, expiry, CVV and billing address, read from Nuvion for the holder and never kept. */
export async function revealDollarCard(wallet: Address) {
  const holder = await holderOf(wallet)
  const card = await cardOf(wallet)
  if (!card || !holder) throw new KovaError('not_found', 'This wallet has no dollar card yet.')
  const s = await cardSecrets(card.providerCardToken, holder.entityId)
  return {
    object: 'dollar_card_details' as const,
    number: s.number,
    cvv: s.cvv,
    exp_month: s.expMonth,
    exp_year: s.expYear,
    name: s.name,
    brand: cardBrand(s.number),
    billing_address: s.billing
      ? {
          line1: s.billing.line1,
          line2: s.billing.line2,
          city: s.billing.city,
          state: s.billing.state,
          postal_code: s.billing.postalCode,
          country: s.billing.country,
        }
      : null,
  }
}
