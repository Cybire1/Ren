import { runMigrations, schema } from '@kova/db'
import { encodeMemo, moneyActionMessage } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { encodeAbiParameters, encodeEventTopics, encodeFunctionData, getAddress } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Abis } from 'viem/tempo'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The dollar card on Nuvion, on Tempo: the ID check, the card issued once the holder passes,
 * top-ups in two steps (a quote, then the wallet's own transfer to Ren's treasury, read on Tempo
 * before anything reaches the card) that credit exactly once and never past the day's limit,
 * money moved off the card and paid to the wallet once, freezing, and the number read without being
 * kept. Nuvion's documented replies are played by a small fake; Tempo is a list of receipts and
 * treasury sends; what Ren keeps is checked in a real database (DATABASE_URL).
 */

const TREASURY = '0x000000000000000000000000000000000000fee1'

/** Tempo, as far as these tests need it: receipts by hash, the treasury's balance and its sends. */
const tempo = vi.hoisted(() => ({
  hashes: 0,
  receipts: new Map<string, unknown>(),
  treasuryDollars: 100_000_000n,
  sent: [] as Array<{ to: string; amount: bigint; memo?: string; hash: string }>,
  /** The next treasury send throws this, as if the node never answered. */
  failNextSend: null as string | null,
  hash(): `0x${string}` {
    return `0x${crypto.randomUUID().replaceAll('-', '')}${(++tempo.hashes).toString(16).padStart(32, '0')}`
  },
}))

vi.mock('../src/chain.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/chain.js')>()
  return {
    ...real,
    feePayerAddress: '0x000000000000000000000000000000000000fee1',
    treasuryClient: {},
    balanceOf: vi.fn(async () => tempo.treasuryDollars),
    sendFromTreasury: vi.fn(async (p: { to: string; amount: bigint; memo?: string }) => {
      if (tempo.failNextSend) {
        const said = tempo.failNextSend
        tempo.failNextSend = null
        throw new Error(said)
      }
      const hash = tempo.hash()
      tempo.sent.push({ to: p.to, amount: p.amount, memo: p.memo, hash })
      return hash
    }),
    publicClient: {
      ...real.publicClient,
      getBlockNumber: vi.fn(async () => 100n),
      // The treasury's transfers to one wallet with one memo, as Tempo's logs would list them.
      getLogs: vi.fn(async ({ args }: { args: { to: string; memo: string } }) =>
        tempo.sent
          .filter((s) => s.to.toLowerCase() === args.to.toLowerCase() && s.memo === args.memo)
          .map((s) => ({ args: { amount: s.amount }, transactionHash: s.hash })),
      ),
      waitForTransactionReceipt: vi.fn(async ({ hash }: { hash: string }) => {
        const receipt = tempo.receipts.get(hash)
        if (!receipt) throw new Error('no such transaction')
        return receipt
      }),
    },
  }
})

const { config } = await import('../src/config.js')
const chain = await import('../src/chain.js')
const { settlementToken } = chain
const { db } = await import('../src/db.js')
const {
  creditTopups,
  deleteDollarCard,
  dollarCardFor,
  dollarCardLive,
  idNumberFor,
  newDollarCard,
  quoteTopUp,
  revealDollarCard,
  serializeTopUp,
  setDollarCard,
  settleWithdrawals,
  startCheck,
  topUpFee,
  topUpMemo,
  topUpSent,
  topUpSponsorProblem,
  withdraw,
} = await import('../src/services/dollar-card.js')
const { shouldSponsor } = await import('../src/tempo/sponsorship.js')
const { moneyRoutes } = await import('../src/routes/money.js')
const { errorHandler } = await import('../src/errors.js')

/** Nuvion as far as Ren uses it: entities, accounts, payees, transfers and one card per account. */
function fakeNuvion() {
  const card = `card_${Math.random().toString(36).slice(2, 10)}`
  const state = {
    card,
    status: 'incomplete',
    /** The next submission is refused for a missing proof of address, as Nuvion's 422 says it. */
    refuseSubmission: false,
    refusePayee: false,
    individual: null as null | { person: Record<string, unknown>; identification: unknown },
    documents: [] as string[],
    transfers: [] as Array<{ amount: number; reference: string }>,
    /** Moves off the card, from its own account back to Ren's pot. */
    returns: [] as Array<{ amount: number; reference: string; to: string }>,
    /** Ren as the holder's own counterparty, and its book-transfer detail. */
    renPayees: [] as Array<Record<string, unknown>>,
    renDetails: [] as Array<Record<string, unknown>>,
    balance: 0,
    frozen: false,
    failNextTransfer: false,
    failNextCardDetails: false,
    /** Nuvion already has this person (409 error_duplicate_resource on a new individual). */
    duplicatePerson: false,
    /** The card provider behind Nuvion refuses the card (503 on POST /virtual-cards). */
    providerRefusesCard: false,
    /** The cardholder each POST /virtual-cards asked for. */
    cardholders: [] as Array<Record<string, unknown>>,
    cardsIssued: 0,
    deleted: false,
    calls: [] as string[],
  }
  const ok = (data: unknown, status = 200) =>
    new Response(JSON.stringify({ status: 'success', data }), { status })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      const path = url.pathname
      const method = init?.method ?? 'GET'
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      state.calls.push(`${method} ${path}`)
      // Child resources must be requested on behalf of their entity, even with a parent key.
      if (
        (method === 'GET' &&
          (path === '/accounts/acc_1' ||
            path === '/cards' ||
            path.startsWith('/card-details/') ||
            path.startsWith('/card-transactions/') ||
            path.startsWith('/card-creation-fee/')) &&
          url.searchParams.get('entity_id') !== 'ent_1') ||
        (method === 'PATCH' && path.startsWith('/card-details/') && body.entity_id !== 'ent_1') ||
        (method === 'DELETE' &&
          path.startsWith('/card-details/') &&
          url.searchParams.get('entity_id') !== 'ent_1')
      )
        return new Response(JSON.stringify({ status: 'error', message: 'Wrong entity' }), {
          status: 404,
        })
      if (method === 'GET' && path === '/entities')
        return ok({ data: [{ id: 'ent_1', is_root: true, status: 'approved' }] })
      if (method === 'POST' && path === '/individual-entities') {
        if (state.duplicatePerson)
          return new Response(
            JSON.stringify({
              status: 'error',
              message:
                'A record with this person already exists. Please use different details or check your existing records.',
              code: 'error_duplicate_resource',
            }),
            { status: 409 },
          )
        state.individual = body
        return ok({ entity: { id: 'ent_1', status: 'incomplete' }, person: { id: 'per_1' } }, 201)
      }
      if (method === 'PATCH' && path === '/individual-entities/ent_1') return ok({})
      if (method === 'POST' && path === '/documents') {
        state.documents.push(body.key)
        return ok({})
      }
      if (method === 'POST' && path === '/onboarding-submissions') {
        if (state.refuseSubmission) {
          state.refuseSubmission = false
          return new Response(
            JSON.stringify({
              status: 'error',
              message: 'Validation error',
              type: 'error_validation_error',
              validations: [
                { message: 'proof_of_address is required', type: 'error_kyc_documents_incomplete' },
              ],
            }),
            { status: 422 },
          )
        }
        state.status = 'pending'
        return ok({})
      }
      if (method === 'GET' && path === '/entities/ent_1')
        return ok({
          entity: { id: 'ent_1', status: state.status },
          business: { email: 'hello@ren.test', phonenumber: '+2348000000000' },
          person: { email: 'mia@example.com' },
          address: { line_1: '1 Ren Way', city: 'Lagos', state: 'Lagos', country_code: 'NG' },
        })
      if (method === 'POST' && path === '/accounts')
        return ok({ account: { id: 'acc_1', nuvion_ban: '0010346002' } }, 201)
      if (method === 'GET' && path === '/accounts/acc_1')
        return ok({ account: { id: 'acc_1', balance: { available: state.balance } } })
      if (method === 'GET' && path === '/accounts/acc_pot')
        return ok({ account: { id: 'acc_pot', nuvion_ban: '0099990001' } })
      if (method === 'GET' && path === '/counterparties') return ok({ data: [] })
      if (method === 'POST' && path === '/counterparties' && body.entity_id) {
        state.renPayees.push(body)
        return ok({ counterparty: { id: 'cp_back' } }, 201)
      }
      if (method === 'POST' && path === '/payment-details' && body.entity_id) {
        state.renDetails.push(body)
        return ok({ payment_detail: { id: 'pd_back' } }, 201)
      }
      if (method === 'POST' && path === '/counterparties') {
        if (state.refusePayee) {
          state.refusePayee = false
          return new Response(JSON.stringify({ status: 'error', message: 'Try later' }), {
            status: 503,
          })
        }
        return ok({ id: 'cp_1' }, 201)
      }
      if (method === 'POST' && path === '/payment-details') return ok({ id: 'pd_1' }, 201)
      if (method === 'GET' && path === '/card-creation-fee/acc_1') return ok({ fee: 50 })
      if (method === 'GET' && path === '/cards') {
        expect(url.searchParams.get('account_id')).toBe('acc_1')
        // Like Nuvion, the list leaves out deleted cards.
        const live = state.deleted
          ? state.cardsIssued > 1
            ? [{ id: `${card}_2`, type: 'virtual', status: 'active' }]
            : []
          : state.cardsIssued
            ? [{ id: card, type: 'virtual', status: 'active' }]
            : []
        return ok({ cards: live })
      }
      if (method === 'POST' && path === '/transfers') {
        if (state.failNextTransfer) {
          state.failNextTransfer = false
          return new Response(JSON.stringify({ status: 'error', message: 'Try later' }), {
            status: 503,
          })
        }
        if (
          [...state.transfers, ...state.returns].some((t) => t.reference === body.unique_reference)
        )
          return new Response(JSON.stringify({ status: 'error', message: 'Duplicate' }), {
            status: 409,
          })
        // From the card's own account: on the holder's behalf, back to Ren's pot.
        if (body.account_id === 'acc_1') {
          if (body.entity_id !== 'ent_1')
            return new Response(JSON.stringify({ status: 'error', message: 'Wrong entity' }), {
              status: 404,
            })
          if (body.amount > state.balance)
            return new Response(
              JSON.stringify({ status: 'error', message: 'Insufficient balance' }),
              { status: 422 },
            )
          state.returns.push({
            amount: body.amount,
            reference: body.unique_reference,
            to: `${body.counterparty_id}/${body.payment_detail_id}`,
          })
          state.balance -= body.amount
          return ok({ id: `tr_back_${state.returns.length}` }, 201)
        }
        state.transfers.push({ amount: body.amount, reference: body.unique_reference })
        state.balance += body.amount
        return ok({ id: `tr_${state.transfers.length}` }, 201)
      }
      if (method === 'POST' && path === '/virtual-cards') {
        state.cardholders.push(body.cardholder)
        if (state.providerRefusesCard)
          return new Response(
            JSON.stringify({
              status: 'error',
              message: 'One of our partner services is temporarily unavailable.',
              code: 'error_system_dependency_unavailable',
            }),
            { status: 503 },
          )
        state.cardsIssued++
        state.balance -= 50
        // A card made after one was deleted is a new card with its own id.
        return ok({ id: state.deleted ? `${card}_2` : card, status: 'active' }, 201)
      }
      if (method === 'DELETE' && path === `/card-details/${card}`) {
        if (state.deleted)
          return new Response(JSON.stringify({ status: 'error', message: 'Not found' }), {
            status: 404,
          })
        state.deleted = true
        return ok({})
      }
      if (
        method === 'GET' &&
        (path === `/card-details/${card}` || path === `/card-details/${card}_2`)
      ) {
        if (state.failNextCardDetails) {
          state.failNextCardDetails = false
          return new Response(JSON.stringify({ status: 'error', message: 'Try later' }), {
            status: 503,
          })
        }
        return ok({
          id: card,
          status: state.frozen ? 'blocked' : 'active',
          number: '5412751234124821',
          cvv: '381',
          expiration_month: '09',
          expiration_year: '29',
          first_name: 'Mia',
          last_name: 'Okafor',
          billing: {
            address_line_1: '350 Fifth Avenue',
            address_line_2: '',
            city: 'New York',
            state: 'NY',
            postal_code: '10001',
          },
        })
      }
      if (method === 'PATCH' && path.startsWith(`/card-details/${card}/`)) {
        state.frozen = path.endsWith('/freeze')
        return ok({})
      }
      if (method === 'GET' && path === `/card-transactions/${card}`)
        return ok({
          payments: [
            {
              _id: 'pay_check',
              amount: 100,
              status: 'successful',
              type: 'outflow',
              status_reason: 'Reversible test payment approved and processed',
              narration: 'Reversible test payment to GOOGLE *TEMPORARY HOLD for 1 USD',
              created: Date.now() - 60_000,
            },
            {
              _id: 'pay_1',
              amount: 1099,
              status: 'successful',
              type: 'outflow',
              narration: 'Payment to Spotify for 10.99 USD',
              created: Date.now(),
            },
          ],
        })
      return new Response(JSON.stringify({ status: 'error', message: `No ${method} ${path}` }), {
        status: 404,
      })
    }),
  )
  return state
}

const person = {
  firstName: 'Mia',
  lastName: 'Okafor',
  dateOfBirth: '1996-03-14',
  email: 'mia@example.com',
  phone: '+2348012345678',
  nationality: 'NG',
  gender: 'f' as const,
  address: {
    line1: '11 Opebi Road',
    city: 'Ikeja',
    state: 'Lagos',
    postalCode: '101241',
    country: 'NG',
  },
  document: { type: 'international_passport' as const, number: 'A01234567' },
  idNumber: { type: 'nin' as const, value: '12345678901' },
  addressProof: 'utility_bill' as const,
}
const files = {
  identity: { base64: 'a'.repeat(200), mime: 'image/jpeg' },
  address: { base64: 'b'.repeat(200), mime: 'application/pdf' },
}

const saved = { ...config }
beforeAll(async () => {
  await runMigrations(config.DATABASE_URL)
})
beforeEach(() => {
  Object.assign(config, {
    KOVA_NETWORK: 'testnet',
    NUVION_API_KEY: 'nv_test_ren',
    NUVION_API_URL: 'https://api.nuvion.dev',
    NUVION_POT_ACCOUNT: 'acc_pot',
    KOVA_CARD_DAILY_TOPUP: '50000000',
  })
  tempo.receipts.clear()
  tempo.sent.length = 0
  tempo.failNextSend = null
  tempo.treasuryDollars = 100_000_000n
  vi.mocked(chain.sendFromTreasury).mockClear()
})
afterEach(() => {
  Object.assign(config, saved)
  vi.unstubAllGlobals()
})

const newWallet = () => privateKeyToAccount(generatePrivateKey()).address

/** A transaction on Tempo that moved dollars with a memo: its hash, with its receipt on file. */
function transferOnTempo(t: {
  from: string
  to: string
  amount: bigint
  memo: `0x${string}`
  token?: string
  status?: 'success' | 'reverted'
}): `0x${string}` {
  const hash = tempo.hash()
  tempo.receipts.set(hash, {
    status: t.status ?? 'success',
    transactionHash: hash,
    logs: [
      {
        address: t.token ?? settlementToken.address,
        topics: encodeEventTopics({
          abi: Abis.tip20,
          eventName: 'TransferWithMemo',
          args: { from: t.from as `0x${string}`, to: t.to as `0x${string}`, memo: t.memo },
        }),
        data: encodeAbiParameters([{ type: 'uint256' }], [t.amount]),
      },
    ],
  })
  return hash
}

type Quote = Awaited<ReturnType<typeof quoteTopUp>>

/** The wallet pays a top-up exactly as its quote's `pay` says, and hands back the hash. */
const pays = (quote: Quote) =>
  transferOnTempo({
    from: quote.wallet,
    to: TREASURY,
    amount: quote.amount + quote.fee,
    memo: topUpMemo(quote),
  })

/** Both steps of a top-up, as the app does them. */
async function topUp(wallet: `0x${string}`, amount: bigint) {
  const quote = await quoteTopUp(wallet, amount)
  return { quote, card: await topUpSent(wallet, quote.id, pays(quote)) }
}

async function cardHolder() {
  const nuvion = fakeNuvion()
  const wallet = newWallet()
  await startCheck(wallet, person, files)
  nuvion.status = 'approved'
  await dollarCardFor(wallet)
  return { nuvion, wallet }
}

describe('dollar card (Nuvion)', () => {
  it('recovers a card already issued before its details could be saved, without issuing again', async () => {
    const nuvion = fakeNuvion()
    const wallet = newWallet()
    await startCheck(wallet, person, files)
    nuvion.status = 'approved'
    nuvion.failNextCardDetails = true
    expect(await dollarCardFor(wallet)).toMatchObject({ stage: 'checking', approved: true })
    expect(nuvion.cardsIssued).toBe(1)
    expect(await dollarCardFor(wallet)).toMatchObject({ stage: 'card' })
    expect(nuvion.cardsIssued).toBe(1)
    expect(nuvion.transfers.filter((t) => t.reference.startsWith('ren-card-fee-'))).toHaveLength(1)
  })

  it('gives the card provider an E.164 phone, even one typed with its leading 0', async () => {
    const nuvion = fakeNuvion()
    const wallet = newWallet()
    await startCheck(
      wallet,
      { ...person, phone: '+234 0801 234 5678', email: ' Mia@Example.com ' },
      files,
    )
    nuvion.status = 'approved'
    expect(await dollarCardFor(wallet)).toMatchObject({ stage: 'card' })
    expect(nuvion.cardholders[0]).toMatchObject({
      phone_number: '+2348012345678',
      email: 'mia@example.com',
    })
  })

  it('refuses a phone that can’t be real before anything reaches Nuvion', async () => {
    const nuvion = fakeNuvion()
    await expect(startCheck(newWallet(), { ...person, phone: '+2341' }, files)).rejects.toThrow(
      /country code/,
    )
    expect(nuvion.calls).not.toContain('POST /individual-entities')
  })

  it('names the other Ren wallet when Nuvion already has the person, never “use different details”', async () => {
    const nuvion = fakeNuvion()
    const first = newWallet()
    const me = {
      ...person,
      email: `mia.${Date.now()}@example.com`,
      phone: `+234803${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`,
    }
    await startCheck(first, me, files)
    nuvion.duplicatePerson = true
    const again = startCheck(newWallet(), me, files)
    await expect(again).rejects.toThrow(
      `another Ren wallet, the one ending ${getAddress(first).slice(-4)}`,
    )
    await expect(again).rejects.not.toThrow(/different details/)
  })

  it('asks for the card again in minutes, not on every refresh, when the card provider refuses it', async () => {
    const nuvion = fakeNuvion()
    const wallet = newWallet()
    await startCheck(wallet, person, files)
    nuvion.status = 'approved'
    nuvion.providerRefusesCard = true
    expect(await dollarCardFor(wallet)).toMatchObject({ stage: 'checking', approved: true })
    expect(await dollarCardFor(wallet)).toMatchObject({ stage: 'checking', approved: true })
    expect(nuvion.calls.filter((call) => call === 'POST /virtual-cards')).toHaveLength(1)
  })

  it('shares one issuance when two status requests arrive after approval', async () => {
    const nuvion = fakeNuvion()
    const wallet = newWallet()
    await startCheck(wallet, person, files)
    nuvion.status = 'approved'
    const results = await Promise.all([dollarCardFor(wallet), dollarCardFor(wallet)])
    expect(results.every((result) => result.stage === 'card')).toBe(true)
    expect(nuvion.calls.filter((call) => call === 'POST /accounts')).toHaveLength(1)
    expect(nuvion.cardsIssued).toBe(1)
  })

  it('is honest without a key: asks for access, never calls Nuvion', async () => {
    config.NUVION_API_KEY = undefined
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(await dollarCardFor(newWallet())).toMatchObject({ live: false, stage: 'intro' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends the ID check, waits while Nuvion reviews, then issues the card with Ren paying the fee', async () => {
    const nuvion = fakeNuvion()
    const wallet = newWallet()
    expect(await dollarCardFor(wallet)).toMatchObject({ stage: 'intro' })
    expect(await startCheck(wallet, person, files)).toMatchObject({ stage: 'checking' })
    expect(nuvion.calls).toEqual([
      'POST /individual-entities',
      'POST /documents',
      'POST /documents',
      'POST /onboarding-submissions',
      'POST /counterparties',
      'GET /entities/ent_1',
    ])
    // Both documents Nuvion needs, the NIN and the kind of proof of address went with it.
    expect(nuvion.documents).toEqual(['identity', 'proof_of_address'])
    expect(nuvion.individual).toMatchObject({
      person: { nin: '12345678901' },
      identification: { proof_of_address: { type: 'utility_bill' } },
    })
    // Sent again while Nuvion reviews it: nothing is sent twice, it just says where it is.
    expect(await startCheck(wallet, person, files)).toMatchObject({ stage: 'checking' })
    expect(nuvion.calls.filter((c) => c === 'POST /onboarding-submissions')).toHaveLength(1)

    nuvion.status = 'approved'
    const ready = await dollarCardFor(wallet)
    expect(ready).toMatchObject({
      stage: 'card',
      card: {
        last_four: '4821',
        brand: 'mastercard',
        exp_month: '09',
        exp_year: '29',
        frozen: false,
      },
      topups: { today: '0', left: '50000000' },
    })
    expect(nuvion.transfers).toEqual([
      { amount: 50, reference: expect.stringMatching(/^ren-card-fee-/) },
    ])
    // Ren keeps the last four and expiry, never the number or CVV.
    const [card] = await db
      .select()
      .from(schema.dollarCards)
      .where(eq(schema.dollarCards.wallet, wallet.toLowerCase()))
    const kept = JSON.stringify(card, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
    expect(kept).not.toContain('5412751234124821')
    expect(kept).not.toContain('381')
  })

  it('gives an owner a card under Ren’s own business, with no ID check', async () => {
    const nuvion = fakeNuvion()
    const owner = newWallet()
    config.KOVA_CARD_OWNER_WALLETS = `0x${'12'.repeat(20)}, ${owner}`
    config.KOVA_CARD_OWNER_NAME = 'Afeez Shaibu'
    expect(await dollarCardFor(owner)).toMatchObject({
      stage: 'card',
      card: { last_four: '4821', name: 'Afeez Shaibu' },
    })
    expect(nuvion.calls).not.toContain('POST /individual-entities')
    // Anyone else still goes through the check.
    expect(await dollarCardFor(newWallet())).toMatchObject({ stage: 'intro' })
  })

  it('shows a refused check with Nuvion’s reason, and lets the holder send it again', async () => {
    const nuvion = fakeNuvion()
    const wallet = newWallet()
    await startCheck(wallet, person, files)
    nuvion.status = 'rejected'
    expect(await dollarCardFor(wallet)).toMatchObject({ stage: 'fix' })
    nuvion.status = 'pending'
    expect(await startCheck(wallet, person, files)).toMatchObject({ stage: 'checking' })
  })

  it('names what Nuvion is missing when it refuses a check, and lets it be sent again', async () => {
    const nuvion = fakeNuvion()
    nuvion.refuseSubmission = true
    const wallet = newWallet()
    await expect(startCheck(wallet, person, files)).rejects.toMatchObject({
      code: 'invalid_request',
      message: expect.stringContaining('proof_of_address is required'),
    })
    // Never reviewed: the card screen asks to finish it and says why, rather than "checking".
    expect(await dollarCardFor(wallet)).toMatchObject({
      stage: 'fix',
      unfinished: true,
      reason: expect.stringContaining('proof_of_address is required'),
    })
    nuvion.calls.length = 0
    expect(await startCheck(wallet, person, files)).toMatchObject({
      stage: 'checking',
      unfinished: false,
      reason: null,
    })
    expect(nuvion.calls).toEqual([
      'GET /entities/ent_1',
      'PATCH /individual-entities/ent_1',
      'POST /documents',
      'POST /documents',
      'POST /onboarding-submissions',
      'POST /counterparties',
      'GET /entities/ent_1',
    ])
  })

  it('makes a missing payee when the card is issued, if the check reached Nuvion without one', async () => {
    const nuvion = fakeNuvion()
    nuvion.refusePayee = true
    const wallet = newWallet()
    await expect(startCheck(wallet, person, files)).rejects.toMatchObject({
      code: 'invalid_request',
    })
    // Nuvion has the check, so it's being reviewed, whatever stopped after it.
    expect(await dollarCardFor(wallet)).toMatchObject({ stage: 'checking', reason: null })
    nuvion.status = 'approved'
    expect(await dollarCardFor(wallet)).toMatchObject({ stage: 'card' })
    expect(nuvion.calls.filter((c) => c === 'POST /counterparties')).toHaveLength(2)
  })

  it('asks Nigerians for a NIN or BVN and Americans for an SSN, and nobody else', () => {
    expect(idNumberFor('NG', 'NG', { type: 'bvn', value: '123 4567 8901' })).toEqual({
      type: 'bvn',
      value: '12345678901',
    })
    expect(() => idNumberFor('NG', 'NG', undefined)).toThrow(/NIN or BVN/)
    // Living in Nigeria counts too, and an SSN won't do there.
    expect(() => idNumberFor('GH', 'NG', { type: 'ssn', value: '123456789' })).toThrow(/NIN/)
    expect(() => idNumberFor('NG', 'NG', { type: 'nin', value: '1234' })).toThrow(/11 digits/)
    expect(idNumberFor('US', 'GB', { type: 'ssn', value: '123-45-6789' })).toEqual({
      type: 'ssn',
      value: '123456789',
    })
    expect(() => idNumberFor('GB', 'US', undefined)).toThrow(/Social Security/)
    expect(idNumberFor('GB', 'GB', { type: 'nin', value: '1' })).toBeUndefined()
  })

  it('stays off with a live Nuvion key or URL on a test network, and never calls Nuvion', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const wallet = newWallet()
    config.NUVION_API_KEY = 'nv_live_ren'
    expect(dollarCardLive()).toBe(false)
    expect(await dollarCardFor(wallet)).toMatchObject({ live: false, stage: 'intro' })
    await expect(startCheck(wallet, person, files)).rejects.toMatchObject({ code: 'conflict' })
    await expect(quoteTopUp(wallet, 5_000_000n)).rejects.toMatchObject({ code: 'conflict' })
    config.NUVION_API_KEY = 'nv_test_ren'
    config.NUVION_API_URL = 'https://api.nuvion.co'
    expect(dollarCardLive()).toBe(false)
    expect(await dollarCardFor(wallet)).toMatchObject({ live: false })
    // On mainnet the live API is what it's for.
    config.KOVA_NETWORK = 'mainnet'
    config.NUVION_API_KEY = 'nv_live_ren'
    expect(dollarCardLive()).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('tops up in two steps: a quote that says what to send, then the same cents onto the card, once', async () => {
    const { nuvion, wallet } = await cardHolder()
    const quote = await quoteTopUp(wallet, 20_000_000n)
    expect(serializeTopUp(quote)).toEqual({
      id: quote.id,
      amount: '20000000',
      fee: '100000',
      total: '20100000',
      expires_at: quote.expiresAt.toISOString(),
      pay: {
        token: getAddress(settlementToken.address),
        to: getAddress(TREASURY),
        amount: '20100000',
        memo: encodeMemo({ kind: 'card-topup', id: quote.id }),
      },
    })
    // A quote moves nothing and uses none of the day's allowance.
    expect(nuvion.transfers.filter((t) => t.reference.startsWith('ren-topup-'))).toHaveLength(0)
    const quoted = await dollarCardFor(wallet)
    expect(quoted).toMatchObject({ topups: { today: '0' } })
    expect('activity' in quoted ? quoted.activity.map((a) => a.kind) : []).not.toContain('topup')

    const hash = pays(quote)
    const card = await topUpSent(wallet, quote.id, hash)
    expect(card).toMatchObject({
      stage: 'card',
      card: { balance: '20000000' },
      topups: { today: '20000000', left: '30000000', treasury: getAddress(TREASURY) },
    })
    expect(nuvion.transfers.at(-1)).toEqual({
      amount: 2000,
      reference: `ren-topup-${quote.id.replace(/-/g, '')}`,
    })
    const activity = 'activity' in card ? card.activity : []
    expect(activity.map((a) => a.kind)).toEqual(expect.arrayContaining(['topup', 'spend', 'check']))
    // A shop's $1 card check is shown as a check, never as money spent.
    expect(activity.find((a) => a.kind === 'check')?.title).toBe('GOOGLE *TEMPORARY HOLD')

    // The same hash told again, and again by the worker, credits nothing more.
    await topUpSent(wallet, quote.id, hash)
    await creditTopups()
    expect(nuvion.transfers.filter((t) => t.reference.startsWith('ren-topup-'))).toHaveLength(1)
    const [row] = await db
      .select()
      .from(schema.cardTopups)
      .where(eq(schema.cardTopups.id, quote.id))
    expect(row).toMatchObject({ status: 'credited', txHash: hash, amount: 20_000_000n })
  })

  it('does both steps over HTTP: the quote needs the wallet’s signature on the amount, and `sent` answers with the card', async () => {
    const nuvion = fakeNuvion()
    const account = privateKeyToAccount(generatePrivateKey())
    const wallet = account.address
    await startCheck(wallet, person, files)
    nuvion.status = 'approved'
    await dollarCardFor(wallet)
    const api = new Hono().onError(errorHandler).route('/v1', moneyRoutes)
    const post = (path: string, body: unknown) =>
      api.request(`/v1/wallets/${wallet}/dollar-card/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    const signed_at = Math.floor(Date.now() / 1000)
    const sign = (detail: string) =>
      account.signMessage({
        message: moneyActionMessage(wallet, 'dollar-card-top-up', signed_at, detail),
      })

    // A signature for another amount, or none, makes no quote.
    const forged = await post('top-up', {
      amount: '20000000',
      signed_at,
      signature: await sign('5000000'),
    })
    expect(forged.status).toBe(403)
    expect((await post('top-up', { amount: '20000000' })).status).toBe(400)

    const quoted = await post('top-up', {
      amount: '20000000',
      signed_at,
      signature: await sign('20000000'),
    })
    expect(quoted.status).toBe(200)
    const quote = (await quoted.json()) as ReturnType<typeof serializeTopUp>
    expect(quote).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      amount: '20000000',
      fee: '100000',
      total: '20100000',
      expires_at: expect.any(String),
      pay: {
        token: getAddress(settlementToken.address),
        to: getAddress(TREASURY),
        amount: '20100000',
        memo: encodeMemo({ kind: 'card-topup', id: quote.id }),
      },
    })

    expect((await post(`top-up/${quote.id}/sent`, { tx_hash: '0x12' })).status).toBe(400)
    const hash = transferOnTempo({
      from: wallet,
      to: TREASURY,
      amount: 20_100_000n,
      memo: quote.pay.memo,
    })
    const sent = await post(`top-up/${quote.id}/sent`, { tx_hash: hash })
    expect(sent.status).toBe(200)
    // The same object GET /wallets/:address/dollar-card gives.
    const card = await sent.json()
    expect(card).toMatchObject({
      object: 'dollar_card',
      stage: 'card',
      card: { balance: '20000000' },
      topups: { today: '20000000' },
    })
    const got = await api.request(`/v1/wallets/${wallet}/dollar-card`)
    expect(Object.keys((await got.json()) as object)).toEqual(Object.keys(card as object))
  })

  it('charges 0.5% on top, rounded up to the cent: the card gets the amount, Ren keeps the fee', async () => {
    expect(topUpFee(20_000_000n)).toBe(100_000n) // $20.00 → $0.10
    expect(topUpFee(1_000_000n)).toBe(10_000n) // $1.00 → $0.005, rounded up to $0.01
    expect(topUpFee(50_000_000n)).toBe(250_000n) // $50.00 → $0.25
    const { nuvion, wallet } = await cardHolder()
    const { quote } = await topUp(wallet, 20_000_000n)
    expect(nuvion.transfers.at(-1)?.amount).toBe(2000)
    expect(quote).toMatchObject({ amount: 20_000_000n, fee: 100_000n })
  })

  it('credits only the wallet’s own transfer of exactly this top-up: amount with fee, token, sender, treasury, memo', async () => {
    const { nuvion, wallet } = await cardHolder()
    const quote = await quoteTopUp(wallet, 20_000_000n)
    const another = await quoteTopUp(wallet, 20_000_000n)
    const exact = { from: wallet, to: TREASURY, amount: 20_100_000n, memo: topUpMemo(quote) }
    const wrong = [
      // The amount without Ren's fee, a cent short, a cent over.
      transferOnTempo({ ...exact, amount: 20_000_000n }),
      transferOnTempo({ ...exact, amount: 20_090_000n }),
      transferOnTempo({ ...exact, amount: 20_110_000n }),
      transferOnTempo({ ...exact, token: `0x${'ab'.repeat(20)}` }),
      transferOnTempo({ ...exact, from: newWallet() }),
      transferOnTempo({ ...exact, to: `0x${'ab'.repeat(20)}` }),
      transferOnTempo({ ...exact, memo: topUpMemo(another) }),
      transferOnTempo({ ...exact, memo: encodeMemo({ kind: 'payout', id: quote.id }) }),
      transferOnTempo({ ...exact, status: 'reverted' }),
      tempo.hash(),
    ]
    for (const hash of wrong)
      await expect(topUpSent(wallet, quote.id, hash)).rejects.toMatchObject({
        code: 'invalid_request',
      })
    // Someone else can't claim it for their own card either.
    await expect(topUpSent(newWallet(), quote.id, pays(quote))).rejects.toMatchObject({
      code: 'not_found',
    })
    expect(nuvion.transfers.filter((t) => t.reference.startsWith('ren-topup-'))).toHaveLength(0)
    expect(await dollarCardFor(wallet)).toMatchObject({ topups: { today: '0' } })
  })

  it('has the relay pay the fee for exactly an open top-up’s transfer, and nothing near it', async () => {
    const { wallet } = await cardHolder()
    const quote = await quoteTopUp(wallet, 20_000_000n)
    const token = settlementToken.address
    const exact = { id: quote.id, to: TREASURY, amount: 20_100_000n, token, from: wallet } as const
    expect(await topUpSponsorProblem(exact)).toBeNull()
    expect(await topUpSponsorProblem({ ...exact, amount: 20_000_000n })).toMatch(/amount/)
    expect(await topUpSponsorProblem({ ...exact, to: newWallet() })).toMatch(/treasury/)
    expect(await topUpSponsorProblem({ ...exact, from: newWallet() })).toMatch(/another wallet/)
    expect(await topUpSponsorProblem({ ...exact, token: `0x${'ab'.repeat(20)}` })).toMatch(/token/)
    expect(await topUpSponsorProblem({ ...exact, id: crypto.randomUUID() })).toMatch(/no matching/)

    // Through the relay's own gate, as a wallet's transaction reaches it.
    const call = (amount: bigint) => ({
      from: wallet,
      calls: [
        {
          to: token,
          data: encodeFunctionData({
            abi: Abis.tip20,
            functionName: 'transferWithMemo',
            args: [TREASURY, amount, topUpMemo(quote)],
          }),
        },
      ],
    })
    expect(await shouldSponsor(call(20_100_000n), { maxFee: 50_000n })).toEqual({
      sponsor: true,
      kind: 'card-topup',
    })
    expect(await shouldSponsor(call(20_000_000n), { maxFee: 50_000n })).toMatchObject({
      sponsor: false,
    })

    // Once it's paid, or the quote has run out, the relay pays for no more.
    await topUpSent(wallet, quote.id, pays(quote))
    expect(await topUpSponsorProblem(exact)).toMatch(/top-up is credited/)
    const stale = await quoteTopUp(wallet, 5_000_000n)
    await db
      .update(schema.cardTopups)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.cardTopups.id, stale.id))
    expect(
      await topUpSponsorProblem({ ...exact, id: stale.id, amount: stale.amount + stale.fee }),
    ).toMatch(/expired/)
  })

  it('never lets a wallet put more than $50 on its card in a day', async () => {
    const { wallet } = await cardHolder()
    await topUp(wallet, 40_000_000n)
    await expect(quoteTopUp(wallet, 20_000_000n)).rejects.toMatchObject({
      code: 'policy_declined',
      message: 'You can top up $10.00 more today.',
    })
    await topUp(wallet, 10_000_000n)
    await expect(quoteTopUp(wallet, 10_000n)).rejects.toMatchObject({
      code: 'policy_declined',
      message: 'You’ve topped up $50.00 today, the most for a day. Try again tomorrow.',
    })
  })

  it('sends back, once, a payment that two open quotes would take past the day’s limit', async () => {
    const { nuvion, wallet } = await cardHolder()
    // Both quotes fit the day when they're made; together they don't.
    const first = await quoteTopUp(wallet, 30_000_000n)
    const second = await quoteTopUp(wallet, 30_000_000n)
    await topUpSent(wallet, first.id, pays(first))
    await expect(topUpSent(wallet, second.id, pays(second))).rejects.toMatchObject({
      code: 'policy_declined',
      message:
        'That’s past what your card takes in a day, so your $30.15 went back to your wallet.',
    })
    expect(nuvion.transfers.filter((t) => t.reference.startsWith('ren-topup-'))).toHaveLength(1)
    // The whole payment, fee included, with a refund memo naming the top-up.
    expect(tempo.sent).toEqual([
      {
        to: getAddress(wallet),
        amount: 30_150_000n,
        memo: encodeMemo({ kind: 'refund', id: second.id }),
        hash: expect.stringMatching(/^0x/),
      },
    ])
    await creditTopups()
    await creditTopups()
    expect(tempo.sent).toHaveLength(1)
    expect(await dollarCardFor(wallet)).toMatchObject({
      card: { balance: '30000000' },
      topups: { today: '30000000' },
    })
  })

  it('refuses a top-up in fractions of a cent, of nothing, or with no card', async () => {
    const { wallet } = await cardHolder()
    await expect(quoteTopUp(wallet, 5_000_001n)).rejects.toMatchObject({ code: 'invalid_request' })
    await expect(quoteTopUp(wallet, 0n)).rejects.toMatchObject({ code: 'invalid_request' })
    await expect(quoteTopUp(newWallet(), 5_000_000n)).rejects.toMatchObject({ code: 'not_found' })
  })

  it('keeps trying a top-up Nuvion couldn’t take yet, and never credits it twice', async () => {
    const { nuvion, wallet } = await cardHolder()
    nuvion.failNextTransfer = true
    const done = await topUp(wallet, 15_000_000n)
    expect(done.card).toMatchObject({ card: { balance: '0' } })
    await creditTopups()
    await creditTopups()
    const credited = nuvion.transfers.filter((t) => t.reference.startsWith('ren-topup-'))
    expect(credited).toHaveLength(1)
    expect(credited[0]?.amount).toBe(1500)
    expect(await dollarCardFor(wallet)).toMatchObject({ card: { balance: '15000000' } })
    // The dollars are Ren's and the card got them: nothing went back to the wallet.
    expect(tempo.sent).toHaveLength(0)
  })

  it('freezes and unfreezes at Nuvion, and reads the number without keeping it', async () => {
    const { nuvion, wallet } = await cardHolder()
    expect(await setDollarCard(wallet, true)).toMatchObject({ card: { frozen: true } })
    expect(nuvion.frozen).toBe(true)
    expect(await setDollarCard(wallet, false)).toMatchObject({ card: { frozen: false } })
    expect(await revealDollarCard(wallet)).toMatchObject({
      number: '5412751234124821',
      cvv: '381',
      exp_month: '09',
      exp_year: '29',
      name: 'Mia Okafor',
      billing_address: {
        line1: '350 Fifth Avenue',
        line2: '',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'US',
      },
    })
  })
  it('deletes the card at Nuvion for good, keeps its money on the account, and never makes another by itself', async () => {
    const { nuvion, wallet } = await cardHolder()
    nuvion.balance = 2_000
    const after = await deleteDollarCard(wallet)
    expect(nuvion.calls).toContain(`DELETE /card-details/${nuvion.card}`)
    expect(after).toMatchObject({ stage: 'closed', balance: (2_000n * 10_000n).toString() })
    // Asking again, as the app does on every refresh, makes no new card.
    expect(await dollarCardFor(wallet)).toMatchObject({ stage: 'closed' })
    expect(nuvion.cardsIssued).toBe(1)
    // A retry after Nuvion already deleted it doesn't fail, and there's nothing left to delete.
    await expect(deleteDollarCard(wallet)).rejects.toThrow('no dollar card to delete')
  })

  it('makes a new card only when asked, on the same account', async () => {
    const { nuvion, wallet } = await cardHolder()
    await deleteDollarCard(wallet)
    const fresh = await newDollarCard(wallet)
    expect(fresh).toMatchObject({ stage: 'card' })
    expect(nuvion.cardsIssued).toBe(2)
    // Ren paid each card's fee, so none of it came out of the holder's money.
    const fees = nuvion.transfers.filter((t) => t.reference.startsWith('ren-card-fee-'))
    expect(fees).toHaveLength(2)
    expect(new Set(fees.map((t) => t.reference)).size).toBe(2)
  })

  describe('moving money off the card', () => {
    it('moves money off the card to the wallet, free, through Ren’s own payee on the holder', async () => {
      const { nuvion, wallet } = await cardHolder()
      nuvion.balance = 2000
      const done = await withdraw(wallet, 5_000_000n)
      expect(done.tx_hash).toMatch(/^0x/)
      expect(nuvion.returns).toEqual([
        { amount: 500, reference: expect.stringMatching(/^ren-back-/), to: 'cp_back/pd_back' },
      ])
      expect(nuvion.balance).toBe(1500)
      // Ren as the holder's counterparty, with a detail naming Ren's pot.
      expect(nuvion.renPayees[0]).toMatchObject({ type: 'business', entity_id: 'ent_1' })
      expect(nuvion.renDetails[0]).toMatchObject({
        entity_id: 'ent_1',
        payment_method: 'book-transfer',
        account_number: '0099990001',
      })
      // The same dollars, free, from the treasury to the wallet, with the withdrawal's own memo.
      const [row] = await db
        .select()
        .from(schema.cardWithdrawals)
        .where(eq(schema.cardWithdrawals.wallet, wallet.toLowerCase()))
      expect(tempo.sent).toEqual([
        {
          to: getAddress(wallet),
          amount: 5_000_000n,
          memo: encodeMemo({ kind: 'card-withdraw', id: (row as { id: string }).id }),
          hash: done.tx_hash,
        },
      ])
      expect(done.card).toMatchObject({
        card: { balance: '15000000' },
        activity: expect.arrayContaining([
          expect.objectContaining({ kind: 'withdraw', amount: '-5000000', status: 'successful' }),
        ]),
      })
      // The way back is made once.
      await withdraw(wallet, 1_000_000n)
      expect(nuvion.renPayees).toHaveLength(1)
      expect(nuvion.returns).toHaveLength(2)
    })

    it('refuses more than the card has, less than $1, or when the treasury can’t pay, moving nothing', async () => {
      const { nuvion, wallet } = await cardHolder()
      nuvion.balance = 300
      await expect(withdraw(wallet, 5_000_000n)).rejects.toMatchObject({ code: 'policy_declined' })
      await expect(withdraw(wallet, 500_000n)).rejects.toMatchObject({ code: 'invalid_request' })
      await expect(withdraw(wallet, 1_000_001n)).rejects.toMatchObject({ code: 'invalid_request' })
      tempo.treasuryDollars = 1_000_000n
      await expect(withdraw(wallet, 2_000_000n)).rejects.toMatchObject({ code: 'conflict' })
      expect(nuvion.returns).toHaveLength(0)
      expect(nuvion.balance).toBe(300)
      expect(tempo.sent).toHaveLength(0)
    })

    it('finishes a move that stopped part way, never pulling or paying it twice', async () => {
      const { nuvion, wallet } = await cardHolder()
      nuvion.balance = 2000
      // Nuvion doesn't answer: nothing is paid yet, and the move waits with its reference.
      nuvion.failNextTransfer = true
      const first = await withdraw(wallet, 3_000_000n)
      expect(first.tx_hash).toBeNull()
      expect(tempo.sent).toHaveLength(0)
      // Then the treasury's send gets no answer: it may or may not have left.
      tempo.failNextSend = 'the node didn’t answer'
      await settleWithdrawals()
      expect(nuvion.returns).toHaveLength(1)
      // It isn't on Tempo, and it's too soon to say it never will be: nothing is sent on a guess.
      await settleWithdrawals()
      await settleWithdrawals()
      expect(chain.sendFromTreasury).toHaveBeenCalledTimes(1)
      expect(tempo.sent).toHaveLength(0)
      // Ten minutes on, with still no sign of it, it is sent once.
      await db
        .update(schema.cardWithdrawals)
        .set({ payTriedAt: new Date(Date.now() - 11 * 60_000) })
        .where(eq(schema.cardWithdrawals.wallet, wallet.toLowerCase()))
      await settleWithdrawals()
      await settleWithdrawals()
      expect(nuvion.returns).toHaveLength(1)
      expect(tempo.sent).toHaveLength(1)
      const [row] = await db
        .select()
        .from(schema.cardWithdrawals)
        .where(eq(schema.cardWithdrawals.wallet, wallet.toLowerCase()))
      expect(row).toMatchObject({ status: 'paid', amount: 3_000_000n, txHash: tempo.sent[0]?.hash })
      expect(nuvion.balance).toBe(1700)
    })

    it('finds a send that did reach Tempo though its answer never came, and pays nothing twice', async () => {
      const { nuvion, wallet } = await cardHolder()
      nuvion.balance = 2000
      tempo.failNextSend = 'the node didn’t answer'
      expect((await withdraw(wallet, 3_000_000n)).tx_hash).toBeNull()
      const [row] = await db
        .select()
        .from(schema.cardWithdrawals)
        .where(eq(schema.cardWithdrawals.wallet, wallet.toLowerCase()))
      const there = {
        to: getAddress(wallet),
        amount: 3_000_000n,
        memo: encodeMemo({ kind: 'card-withdraw', id: (row as { id: string }).id }),
        hash: tempo.hash(),
      }
      tempo.sent.push(there)
      await settleWithdrawals()
      await settleWithdrawals()
      expect(chain.sendFromTreasury).toHaveBeenCalledTimes(1)
      const [done] = await db
        .select()
        .from(schema.cardWithdrawals)
        .where(eq(schema.cardWithdrawals.id, (row as { id: string }).id))
      expect(done).toMatchObject({ status: 'paid', txHash: there.hash })
    })
  })
})
