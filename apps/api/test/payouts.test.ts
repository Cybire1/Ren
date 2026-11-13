import { runMigrations, schema } from '@kova/db'
import { encodeMemo } from '@kova/tempo'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { encodeAbiParameters, encodeEventTopics, encodeFunctionData, getAddress } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Abis } from 'viem/tempo'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Cash-outs through Nuvion on Tempo: a recipient checked and saved, a quote that locks the rate and
 * says where to send the dollars, the payout made only after Ren reads the wallet's own transfer to
 * its treasury (the exact amount, token, sender and memo), paid out once by reference, followed to
 * paid, and sent back to the wallet once when Nuvion refuses or the bank fails it. Nuvion's
 * documented replies are played by a small fake; Tempo is a list of receipts and treasury sends; what
 * Ren keeps is checked in a real database (DATABASE_URL).
 */

const TREASURY = '0x000000000000000000000000000000000000fee1'

/** Tempo, as far as these tests need it: receipts by hash, and what the treasury has sent. */
const tempo = vi.hoisted(() => ({
  hashes: 0,
  receipts: new Map<string, unknown>(),
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
const { db } = await import('../src/db.js')
const chain = await import('../src/chain.js')
const { settlementToken } = chain
const { ibanValid, recipientFor, corridorById } = await import(
  '../src/services/payout-corridors.js'
)
const {
  addRecipient,
  quotePayout,
  payPayout,
  payoutMemo,
  payoutSponsorProblem,
  payoutsLive,
  serializePayout,
  settlePayouts,
  payoutRow,
  recipientsOf,
} = await import('../src/services/payouts.js')
const { shouldSponsor } = await import('../src/tempo/sponsorship.js')
const { payoutRoutes } = await import('../src/routes/payouts.js')
const { errorHandler } = await import('../src/errors.js')

/** Nuvion as far as payouts use it: the pot, counterparties, payment details, quotes, transfers. */
function fakeNuvion() {
  const state = {
    pot: 50_000,
    rate: 1.370269,
    quoteValidFor: 120,
    counterparties: [] as Record<string, unknown>[],
    details: [] as Record<string, unknown>[],
    transfers: [] as Array<Record<string, unknown> & { id: string; status: string }>,
    refuseDetail: false,
    refuseTransfer: false,
    silentOnce: false,
    staleQuoteOnce: false,
    quotes: 0,
    /** A verified person's own USD account (Mia's), for payouts in their own name. */
    mia: 0,
    /** Nuvion's fee on a payout. */
    fee: 50,
  }
  const ok = (data: unknown, status = 200) =>
    new Response(JSON.stringify({ status: 'success', data }), { status })
  const no = (status: number, message: string, type?: string) =>
    new Response(JSON.stringify({ status: 'error', message, type }), { status })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      const path = url.pathname
      const method = init?.method ?? 'GET'
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (method === 'GET' && path === '/accounts/acc_pot')
        return ok({ account: { id: 'acc_pot', balance: { available: state.pot } } })
      if (method === 'POST' && path === '/counterparties') {
        state.counterparties.push(body)
        return ok({ id: `cp_${state.counterparties.length}` }, 201)
      }
      if (method === 'GET' && path.startsWith('/counterparties/')) {
        const n = Number(path.split('_')[1])
        const c = state.counterparties[n - 1] as { profile?: unknown } | undefined
        return c ? ok({ counterparty: { id: `cp_${n}`, ...c } }) : no(404, 'Not found')
      }
      if (method === 'POST' && path === '/payment-details') {
        if (state.refuseDetail)
          return no(422, 'Validation error: account_number is invalid', 'error_validation_error')
        state.details.push(body)
        return ok({ id: `pd_${state.details.length}` }, 201)
      }
      if (method === 'GET' && path.startsWith('/bank-codes/'))
        return ok([
          {
            bank_name: 'Royal Bank of Canada',
            bank_institution_number: '003',
            swift_bic: 'ROYCCAT2',
          },
        ])
      if (method === 'POST' && path === '/fx-quotes') {
        state.quotes++
        // From Ren's pot, or from the person's own account, acting for their entity.
        if (body.entity_id)
          expect(body).toMatchObject({ account_id: 'acc_mia', entity_id: 'ent_mia' })
        else expect(body.account_id).toBe('acc_pot')
        return ok(
          {
            id: `fxq_${state.quotes}`,
            from: 'USD',
            to: body.to_currency,
            amount_from: body.amount_from,
            amount_to: Math.floor(body.amount_from * state.rate),
            rate: state.rate,
            quote: {
              status: 'active',
              expires_at: Date.now() + state.quoteValidFor * 1000,
              valid_for: state.quoteValidFor,
            },
          },
          201,
        )
      }
      if (method === 'POST' && path === '/transfers') {
        if (state.silentOnce) {
          // Nuvion took it, then the answer never arrived.
          state.silentOnce = false
          state.transfers.push({
            ...body,
            id: `tr_${state.transfers.length + 1}`,
            status: 'pending',
          })
          return no(503, 'Try later')
        }
        if (state.staleQuoteOnce) {
          state.staleQuoteOnce = false
          return no(422, 'The FX quote has expired', 'error_fx_quote_expired')
        }
        // Nuvion's documented 422: the message has no full stop, and each problem is keyed by its field.
        if (state.refuseTransfer)
          return new Response(
            JSON.stringify({
              status: 'error',
              message: 'Validation failed for one or more fields',
              type: 'error_validation_error',
              validations: [
                {
                  'bank_address.state': {
                    type: 'error_validation_required_field_missing',
                    message: 'bank_address.state is required.',
                  },
                },
              ],
            }),
            { status: 422 },
          )
        if (state.transfers.some((t) => t.unique_reference === body.unique_reference))
          return no(409, 'Duplicate', 'error_duplicate_resource')
        const fromMia = body.account_id === 'acc_mia'
        if (fromMia) expect(body.entity_id).toBe('ent_mia')
        if (body.payment_type === 'book-transfer') {
          // Inside Nuvion, straight away: Ren's pot ⇄ Mia's account.
          const toMia = body.payment_detail_id === 'pd_to_mia'
          expect(toMia || body.payment_detail_id === 'pd_to_pot').toBe(true)
          if ((fromMia ? state.mia : state.pot) < body.amount)
            return no(400, 'Insufficient funds', 'error_transfer_insufficient_funds')
          if (fromMia) state.mia -= body.amount
          else state.pot -= body.amount
          if (toMia) state.mia += body.amount
          else state.pot += body.amount
          const t = { ...body, id: `tr_${state.transfers.length + 1}`, status: 'successful' }
          state.transfers.push(t)
          return ok({ ...t, applicable_fee: 0 }, 201)
        }
        if (fromMia && state.mia < body.amount + state.fee)
          return no(
            400,
            `Insufficient funds. Available balance: ${state.mia}`,
            'error_transfer_insufficient_funds',
          )
        const t = { ...body, id: `tr_${state.transfers.length + 1}`, status: 'pending' }
        state.transfers.push(t)
        if (fromMia) state.mia -= body.amount + state.fee
        else state.pot -= body.amount
        return ok({ ...t, applicable_fee: state.fee }, 201)
      }
      if (method === 'GET' && path === '/transfers') {
        const ref = url.searchParams.get('unique_reference')
        return ok({ meta: {}, data: state.transfers.filter((t) => t.unique_reference === ref) })
      }
      if (method === 'GET' && path.startsWith('/transfers/')) {
        const t = state.transfers.find((x) => x.id === path.split('/')[2])
        return t ? ok(t) : no(404, 'Not found')
      }
      return no(404, `No ${method} ${path}`)
    }),
  )
  return state
}

const newWallet = () => privateKeyToAccount(generatePrivateKey()).address

/** A rail by its id, which these tests know exists. */
function rail(id: string) {
  const corridor = corridorById(id)
  if (!corridor) throw new Error(`no rail ${id}`)
  return corridor
}

/** A payout as the database has it now. */
async function kept(id: string) {
  const row = await payoutRow(id)
  if (!row) throw new Error(`no payout ${id}`)
  return row
}

const person = {
  holder_name: 'Mia Okafor',
  email: 'mia@example.com',
  address_line1: '11 Opebi Road',
  address_city: 'Ikeja',
  address_state: 'Lagos',
  address_postal_code: '100001',
  address_country: 'NG',
}

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

/** The wallet pays a payout exactly as its quote's `pay` says, and hands back the hash. */
const pays = (row: { id: string; wallet: string; amount: bigint }) =>
  transferOnTempo({ from: row.wallet, to: TREASURY, amount: row.amount, memo: payoutMemo(row) })

const saved = { ...config }
beforeAll(async () => {
  await runMigrations(config.DATABASE_URL)
})
beforeEach(async () => {
  // Each test's fake Nuvion numbers its transfers from 1: earlier payouts must not answer to them.
  await db.delete(schema.payouts)
  await db.delete(schema.payoutRecipients)
  Object.assign(config, {
    KOVA_NETWORK: 'testnet',
    NUVION_API_KEY: 'nv_test_ren',
    NUVION_API_URL: 'https://api.nuvion.dev',
    NUVION_POT_ACCOUNT: 'acc_pot',
    KOVA_PAYOUT_FEE_BPS: 0,
  })
  tempo.receipts.clear()
  tempo.sent.length = 0
  tempo.failNextSend = null
  vi.mocked(chain.sendFromTreasury).mockClear()
})
afterEach(() => {
  Object.assign(config, saved)
  vi.unstubAllGlobals()
})

const sepa = () =>
  recipientFor(rail('eu_sepa'), {
    ...person,
    iban: 'DE89 3704 0044 0532 0130 00',
    swift_bic: 'COBADEFFXXX',
    bank_name: 'Commerzbank',
  })

describe('payout rails', () => {
  it('checks IBANs by their check digits', () => {
    expect(ibanValid('DE89 3704 0044 0532 0130 00')).toBe(true)
    expect(ibanValid('DE89 3704 0044 0532 0130 01')).toBe(false)
    expect(ibanValid('AE070331234567890123456')).toBe(true)
  })

  it('turns each rail’s fields into Nuvion’s payment detail, masked for Ren', () => {
    const interac = recipientFor(rail('ca_interac_email'), person)
    expect(interac.detail).toMatchObject({
      payment_method: 'bank-transfer',
      currency: 'CAD',
      scheme: 'interac_email',
      email: 'mia@example.com',
      country: 'CA',
    })
    expect(interac.label).toBe('Interac m•••@example.com')
    expect(interac.person.address.country).toBe('NG')

    const mpesa = recipientFor(rail('ke_momo'), {
      ...person,
      scheme: 'mpesa',
      phone_number: '+254 712 345 678',
    })
    expect(mpesa.detail).toMatchObject({
      payment_method: 'momo-transfer',
      currency: 'KES',
      scheme: 'mpesa',
      phone_number: '+254712345678',
      country: 'KE',
    })

    const sepa = recipientFor(rail('eu_sepa'), {
      ...person,
      iban: 'DE89 3704 0044 0532 0130 00',
      swift_bic: 'cobadeffxxx',
      bank_name: 'Commerzbank',
    })
    expect(sepa.detail).toMatchObject({
      country: 'DE',
      iban: 'DE89370400440532013000',
      swift_bic: 'COBADEFFXXX',
    })
    expect(sepa.label).toBe('Commerzbank •••• 3000')

    const rtp = recipientFor(rail('us_rtp'), {
      ...person,
      routing_number: '121000248',
      account_number: '112233445566',
      account_type: 'checking',
      bank_name: 'Wells Fargo Bank',
      bank_line1: '420 Montgomery Street',
      bank_city: 'San Francisco',
      bank_state: 'ca',
      bank_postal_code: '94104',
    })
    expect(rtp.detail).toMatchObject({
      scheme: 'rtp',
      routing_number: '121000248',
      bank_address: { state: 'CA', postal_code: '94104', country: 'US' },
    })

    const eft = recipientFor(
      rail('ca_eft'),
      { ...person, transit_number: '00012', account_number: '1234567' },
      { bank_name: 'Royal Bank of Canada', code: '003' },
    )
    expect(eft.detail).toMatchObject({
      bank_institution_number: '003',
      bank_name: 'Royal Bank of Canada',
    })
  })

  it('sends what Nuvion’s docs ask of each rail: its scheme, Australia’s BSB, a SWIFT bank’s whole address', () => {
    expect(sepa().detail).toMatchObject({ scheme: 'sepa' })
    const fps = recipientFor(rail('gb_fps'), {
      ...person,
      sort_code: '04-00-04',
      account_number: '12345678',
      bank_name: 'Monzo',
    })
    expect(fps.detail).toMatchObject({ scheme: 'fps', sort_code: '040004', country: 'GB' })

    const becs = recipientFor(rail('au_becs'), {
      ...person,
      branch_code: '062000',
      account_number: '12345678',
      bank_name: 'Commonwealth Bank',
    })
    expect(becs.detail).toMatchObject({
      scheme: 'becs',
      bsb: '062000',
      bank_code: '062000',
      branch_code: '062000',
      account_number: '12345678',
    })

    const bank = {
      bank_line1: '1 Chome-1-2 Oshiage',
      bank_city: 'Tokyo',
      bank_state: 'Tokyo',
      bank_postal_code: '131-0045',
      swift_bic: 'BOTKJPJT',
      bank_name: 'MUFG Bank',
    }
    const swift = recipientFor(rail('swift_account'), {
      ...person,
      ...bank,
      bank_country: 'JP',
      account_number: '1234567',
    })
    expect(swift.detail).toMatchObject({
      scheme: 'swift',
      account_number: '1234567',
      swift_bic: 'BOTKJPJT',
      country: 'JP',
      bank_address: {
        line1: '1 Chome-1-2 Oshiage',
        city: 'Tokyo',
        state: 'Tokyo',
        postal_code: '131-0045',
        country: 'JP',
      },
    })
    expect(swift.label).toBe('MUFG Bank •••• 4567')

    const usdc = recipientFor(rail('usdc'), {
      ...person,
      blockchain_network: 'BASE_MAINNET',
      wallet_address: '0x67d185427d896aaf1d8781E094f1Bad16f7fa967',
    })
    expect(usdc.detail).toMatchObject({
      payment_method: 'stablecoin-transfer',
      scheme: 'stablecoin',
      blockchain_network: 'BASE_MAINNET',
    })
    expect(usdc.detail.country).toBeUndefined()
  })

  it('refuses details that can’t be right, naming the field', () => {
    expect(() => recipientFor(rail('us_ach'), { ...person, routing_number: '1234' })).toThrow(
      /9 digits/,
    )
    expect(() =>
      recipientFor(rail('eu_sepa'), {
        ...person,
        iban: 'DE89 3704 0044 0532 0130 01',
        swift_bic: 'COBADEFF',
        bank_name: 'Commerzbank',
      }),
    ).toThrow(/IBAN isn’t valid/)
    expect(() =>
      recipientFor(rail('ke_momo'), {
        ...person,
        scheme: 'mpesa',
        phone_number: '0712345678',
      }),
    ).toThrow(/country code/)
    expect(() =>
      recipientFor(rail('ca_eft'), {
        ...person,
        transit_number: '00012',
        account_number: '1234567',
      }),
    ).toThrow(/Pick the bank/)
    expect(() => recipientFor(rail('ca_interac_email'), { ...person, email: 'nope' })).toThrow(
      /email/,
    )
  })
})

describe('cash-outs through Nuvion', () => {
  async function interacPayout(state: ReturnType<typeof fakeNuvion>, dollars = 20) {
    const wallet = newWallet()
    const recipient = await addRecipient(wallet, 'ca_interac_email', person)
    const { row } = await quotePayout(wallet, recipient.id, BigInt(dollars) * 1_000_000n)
    return { wallet, recipient, row, state }
  }

  it('saves a recipient at Nuvion, locks a rate, says where to send the dollars, and pays out once', async () => {
    const nuvion = fakeNuvion()
    const { recipient, row } = await interacPayout(nuvion)
    expect(recipient).toMatchObject({ label: 'Interac m•••@example.com', counterpartyId: 'cp_1' })
    expect(nuvion.counterparties[0]).toMatchObject({
      type: 'individual',
      profile: {
        first_name: 'Mia',
        last_name: 'Okafor',
        address: { state_or_province: 'Lagos', postal_code: '100001', country: 'NG' },
      },
    })
    expect(row).toMatchObject({
      status: 'quoted',
      currency: 'CAD',
      amountTo: 2740n,
      fxQuoteId: 'fxq_1',
    })
    // Ren's quote ends before Nuvion's, so a payment never reaches a stale rate.
    expect(row.expiresAt.getTime()).toBeLessThan(Date.now() + 120_000)
    // The quote says what to send: this much of Ren's dollar, to the treasury, with the payout's memo.
    expect(serializePayout(row).pay).toEqual({
      token: getAddress(settlementToken.address),
      to: getAddress(TREASURY),
      amount: '20000000',
      memo: encodeMemo({ kind: 'payout', id: row.id }),
    })

    const hash = pays(row)
    const paid = await payPayout(row, hash)
    expect(paid).toMatchObject({
      status: 'sending',
      txHash: hash,
      transferId: 'tr_1',
      providerFee: 50n,
    })
    expect(nuvion.transfers[0]).toMatchObject({
      account_id: 'acc_pot',
      currency: 'USD',
      amount: 2000,
      fx_quote_id: 'fxq_1',
      payment_type: 'bank-transfer',
      unique_reference: `ren-out-${row.id.replace(/-/g, '')}`,
    })
    // The same hash again, on the row as it was or as it is, changes nothing.
    expect(await payPayout(paid, hash)).toMatchObject({ status: 'sending' })
    expect(await payPayout(row, hash)).toMatchObject({ status: 'sending' })
    expect(nuvion.transfers).toHaveLength(1)

    ;(nuvion.transfers[0] as { status: string }).status = 'successful'
    await settlePayouts()
    expect(await payoutRow(row.id)).toMatchObject({ status: 'paid' })
    expect(tempo.sent).toHaveLength(0)
  })

  it('quotes and pays over HTTP: the quote carries `pay`, and `pay` takes the transaction’s hash', async () => {
    const nuvion = fakeNuvion()
    const wallet = newWallet()
    const recipient = await addRecipient(wallet, 'ca_interac_email', person)
    const api = new Hono().onError(errorHandler).route('/v1', payoutRoutes)
    const post = (path: string, body: unknown) =>
      api.request(`/v1${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    const quoted = await post(`/wallets/${wallet}/payouts`, {
      recipient_id: recipient.id,
      amount: '20',
    })
    expect(quoted.status).toBe(200)
    const quote = (await quoted.json()) as ReturnType<typeof serializePayout>
    expect(quote).toMatchObject({
      object: 'payout',
      status: 'quoted',
      amount: '20.00',
      currency: 'CAD',
      amount_to: '27.40',
      recipient: { id: recipient.id, label: 'Interac m•••@example.com' },
      pay: {
        token: getAddress(settlementToken.address),
        to: getAddress(TREASURY),
        amount: '20000000',
        memo: encodeMemo({ kind: 'payout', id: quote.id }),
      },
    })

    // An authorization, as Kova's clients send, isn't what Ren takes.
    expect((await post(`/payouts/${quote.id}/pay`, { signature: '0x11' })).status).toBe(400)
    expect((await post(`/payouts/${quote.id}/pay`, { tx_hash: tempo.hash() })).status).toBe(400)
    const hash = transferOnTempo({
      from: wallet,
      to: TREASURY,
      amount: 20_000_000n,
      memo: quote.pay.memo,
    })
    const paid = await post(`/payouts/${quote.id}/pay`, { tx_hash: hash })
    expect(paid.status).toBe(200)
    expect(await paid.json()).toMatchObject({
      object: 'payout',
      id: quote.id,
      status: 'sending',
      tx_hash: hash,
      recipient: { id: recipient.id },
    })
    expect(nuvion.transfers).toHaveLength(1)
  })

  it('quotes nothing when Ren’s pot can’t pay it', async () => {
    const nuvion = fakeNuvion()
    const wallet = newWallet()
    const recipient = await addRecipient(wallet, 'ca_interac_email', person)
    nuvion.pot = 1_000
    await expect(quotePayout(wallet, recipient.id, 20_000_000n)).rejects.toMatchObject({
      code: 'conflict',
      message: expect.stringContaining('Nothing left your wallet'),
    })
  })

  it('pays out only for the wallet’s own transfer of exactly this payout: amount, token, sender, treasury, memo', async () => {
    const nuvion = fakeNuvion()
    const { row, wallet, recipient } = await interacPayout(nuvion)
    const other = (await quotePayout(wallet, recipient.id, 20_000_000n)).row
    const exact = { from: row.wallet, to: TREASURY, amount: row.amount, memo: payoutMemo(row) }
    const wrong = [
      transferOnTempo({ ...exact, amount: row.amount - 1n }),
      transferOnTempo({ ...exact, amount: row.amount + 1n }),
      transferOnTempo({ ...exact, token: `0x${'ab'.repeat(20)}` }),
      transferOnTempo({ ...exact, from: newWallet() }),
      transferOnTempo({ ...exact, to: newWallet() }),
      // Another payout's memo, a naira cash-out's, a charge's: none of them is this payout's.
      transferOnTempo({ ...exact, memo: payoutMemo(other) }),
      transferOnTempo({ ...exact, memo: encodeMemo({ kind: 'cashout', id: row.id }) }),
      transferOnTempo({ ...exact, memo: encodeMemo({ kind: 'payment', id: row.id }) }),
      transferOnTempo({ ...exact, status: 'reverted' }),
      // A hash Tempo has never seen.
      tempo.hash(),
    ]
    for (const hash of wrong)
      await expect(payPayout(row, hash)).rejects.toMatchObject({ code: 'invalid_request' })
    expect(await payoutRow(row.id)).toMatchObject({ status: 'quoted', txHash: null })
    expect(nuvion.transfers).toHaveLength(0)
  })

  it('has the relay pay the fee for exactly an open payout’s transfer, and nothing near it', async () => {
    const nuvion = fakeNuvion()
    const { row } = await interacPayout(nuvion)
    const wallet = row.wallet as `0x${string}`
    const token = settlementToken.address
    const exact = { id: row.id, to: TREASURY, amount: row.amount, token, from: wallet } as const
    expect(await payoutSponsorProblem(exact)).toBeNull()
    expect(await payoutSponsorProblem({ ...exact, amount: row.amount + 1n })).toMatch(/amount/)
    expect(await payoutSponsorProblem({ ...exact, to: newWallet() })).toMatch(/treasury/)
    expect(await payoutSponsorProblem({ ...exact, from: newWallet() })).toMatch(/another wallet/)
    expect(await payoutSponsorProblem({ ...exact, from: undefined })).toMatch(/another wallet/)
    expect(await payoutSponsorProblem({ ...exact, token: `0x${'ab'.repeat(20)}` })).toMatch(/token/)
    expect(await payoutSponsorProblem({ ...exact, id: crypto.randomUUID() })).toMatch(/no matching/)

    // Through the relay's own gate, as a wallet's transaction reaches it.
    const call = (amount: bigint, memo = payoutMemo(row)) => ({
      from: wallet,
      calls: [
        {
          to: token,
          data: encodeFunctionData({
            abi: Abis.tip20,
            functionName: 'transferWithMemo',
            args: [TREASURY, amount, memo],
          }),
        },
      ],
    })
    expect(await shouldSponsor(call(row.amount), { maxFee: 50_000n })).toEqual({
      sponsor: true,
      kind: 'payout',
    })
    expect(await shouldSponsor(call(row.amount + 1n), { maxFee: 50_000n })).toMatchObject({
      sponsor: false,
    })
    // Refunds and withdrawals are Ren's to send, never a wallet's to have paid for.
    expect(
      await shouldSponsor(call(row.amount, encodeMemo({ kind: 'card-withdraw', id: row.id })), {
        maxFee: 50_000n,
      }),
    ).toMatchObject({ sponsor: false })

    // Once it's paid, or its rate has run out, the relay pays for no more.
    await db
      .update(schema.payouts)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.payouts.id, row.id))
    expect(await payoutSponsorProblem(exact)).toMatch(/expired/)
    await payPayout(row, pays(row))
    expect(await payoutSponsorProblem(exact)).toMatch(/cash-out is sending/)
    expect(await shouldSponsor(call(row.amount), { maxFee: 50_000n })).toMatchObject({
      sponsor: false,
    })
  })

  it('still pays out dollars that arrived after the quote ran out, rather than strand them', async () => {
    const nuvion = fakeNuvion()
    const { row } = await interacPayout(nuvion)
    await db
      .update(schema.payouts)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(schema.payouts.id, row.id))
    const late = await kept(row.id)
    expect(await payPayout(late, pays(late))).toMatchObject({ status: 'sending' })
    expect(nuvion.transfers).toHaveLength(1)
  })

  it('sends the dollars straight back when the pot ran short between the quote and the payment', async () => {
    const nuvion = fakeNuvion()
    const { row } = await interacPayout(nuvion)
    nuvion.pot = 1_000
    const failed = await payPayout(row, pays(row))
    expect(failed).toMatchObject({
      status: 'failed',
      failure: 'Cashing out is paused for a moment. Your dollars went back to your wallet.',
    })
    expect(nuvion.transfers).toHaveLength(0)
    expect(tempo.sent).toEqual([
      {
        to: getAddress(row.wallet),
        amount: row.amount,
        memo: encodeMemo({ kind: 'refund', id: row.id }),
        hash: failed.refundTxHash,
      },
    ])
  })

  it('sends the dollars back once when Nuvion refuses the payout', async () => {
    const nuvion = fakeNuvion()
    const { row } = await interacPayout(nuvion)
    nuvion.refuseTransfer = true
    const failed = await payPayout(row, pays(row))
    expect(failed.status).toBe('failed')
    expect(failed.refundTxHash).toMatch(/^0x/)
    expect(failed.failure).toBe(
      'The payout was refused: Validation failed for one or more fields: bank_address.state: bank_address.state is required. Your dollars went back to your wallet.',
    )
    await settlePayouts()
    expect(tempo.sent).toHaveLength(1)
    expect(tempo.sent[0]).toMatchObject({ to: getAddress(row.wallet), amount: row.amount })
  })

  it('never sends a refund twice: one that got no answer is looked for on Tempo, and sent again only when it isn’t there', async () => {
    const nuvion = fakeNuvion()
    nuvion.refuseTransfer = true

    // The node took the refund and never answered. It is on Tempo all the same.
    const landed = (await interacPayout(nuvion)).row
    tempo.failNextSend = 'the node didn’t answer'
    expect(await payPayout(landed, pays(landed))).toMatchObject({ status: 'refunding' })
    expect(chain.sendFromTreasury).toHaveBeenCalledTimes(1)
    const there = {
      to: getAddress(landed.wallet),
      amount: landed.amount,
      memo: encodeMemo({ kind: 'refund', id: landed.id }),
      hash: tempo.hash(),
    }
    tempo.sent.push(there)
    await settlePayouts()
    expect(await payoutRow(landed.id)).toMatchObject({
      status: 'failed',
      refundTxHash: there.hash,
    })
    expect(chain.sendFromTreasury).toHaveBeenCalledTimes(1)

    // This one never left. Nothing is sent again on a guess while it might still land…
    const lost = (await interacPayout(nuvion)).row
    tempo.failNextSend = 'the node didn’t answer'
    await payPayout(lost, pays(lost))
    await settlePayouts()
    await settlePayouts()
    expect(await payoutRow(lost.id)).toMatchObject({ status: 'refunding', refundTxHash: null })
    expect(chain.sendFromTreasury).toHaveBeenCalledTimes(2)
    // …and ten minutes on, with still no sign of it on Tempo, it is sent once.
    await db
      .update(schema.payouts)
      .set({ refundTriedAt: new Date(Date.now() - 11 * 60_000) })
      .where(eq(schema.payouts.id, lost.id))
    await settlePayouts()
    await settlePayouts()
    expect(await payoutRow(lost.id)).toMatchObject({ status: 'failed' })
    expect(chain.sendFromTreasury).toHaveBeenCalledTimes(3)
    expect(tempo.sent.filter((s) => s.to === getAddress(lost.wallet))).toHaveLength(1)
  })

  it('asks again when Nuvion didn’t answer, and finds the payout it already made by reference', async () => {
    const nuvion = fakeNuvion()
    const { row } = await interacPayout(nuvion)
    nuvion.silentOnce = true
    const waiting = await payPayout(row, pays(row))
    expect(waiting.status).toBe('received')
    await settlePayouts()
    expect(nuvion.transfers).toHaveLength(1)
    expect(await payoutRow(row.id)).toMatchObject({ status: 'sending', transferId: 'tr_1' })
  })

  it('pays at a fresh rate when the locked one ran out between Tempo and Nuvion', async () => {
    const nuvion = fakeNuvion()
    const { row } = await interacPayout(nuvion)
    nuvion.staleQuoteOnce = true
    nuvion.rate = 1.36
    const sent = await payPayout(row, pays(row))
    expect(sent).toMatchObject({ status: 'sending', fxQuoteId: 'fxq_2', amountTo: 2720n })
    expect(nuvion.transfers[0]).toMatchObject({ fx_quote_id: 'fxq_2' })
  })

  it('sends the dollars back once when the bank fails the payout later', async () => {
    const nuvion = fakeNuvion()
    const { row } = await interacPayout(nuvion)
    await payPayout(row, pays(row))
    Object.assign(nuvion.transfers[0] as object, {
      status: 'failed',
      status_reason: 'account_closed',
    })
    await settlePayouts()
    await settlePayouts()
    const done = await kept(row.id)
    expect(done.status).toBe('failed')
    expect(done.failure).toMatch(/account closed/)
    expect(tempo.sent).toHaveLength(1)
  })

  it('stays off with a live Nuvion key on a test network, and never calls Nuvion', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    config.NUVION_API_KEY = 'nv_live_ren'
    expect(payoutsLive()).toBe(false)
    await expect(addRecipient(newWallet(), 'ca_interac_email', person)).rejects.toMatchObject({
      code: 'conflict',
    })
    config.NUVION_API_KEY = 'nv_test_ren'
    config.NUVION_API_URL = 'https://api.nuvion.co'
    expect(payoutsLive()).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps each rail within its own limits on what the account receives', async () => {
    const nuvion = fakeNuvion()
    nuvion.rate = 127.35
    const wallet = newWallet()
    const mpesa = await addRecipient(wallet, 'ke_momo', {
      ...person,
      scheme: 'mpesa',
      phone_number: '+254712345678',
    })
    // $1 is KSh127: fine. M-Pesa's floor is KSh20.
    expect((await quotePayout(wallet, mpesa.id, 1_000_000n)).row.amountTo).toBe(12735n)
    await expect(quotePayout(wallet, mpesa.id, 500_000n)).rejects.toMatchObject({
      code: 'invalid_request',
    })
    await expect(quotePayout(wallet, mpesa.id, 501_000_000n)).rejects.toMatchObject({
      code: 'invalid_request',
    })
    // A USD rail needs no quote at all.
    const rtp = await addRecipient(wallet, 'us_rtp', {
      ...person,
      routing_number: '121000248',
      account_number: '112233445566',
      account_type: 'checking',
      bank_name: 'Wells Fargo Bank',
      bank_line1: '420 Montgomery Street',
      bank_city: 'San Francisco',
      bank_state: 'CA',
      bank_postal_code: '94104',
    })
    const usd = await quotePayout(wallet, rtp.id, 25_000_000n)
    expect(usd.row).toMatchObject({ currency: 'USD', amountTo: 2500n, fxQuoteId: null })
  })

  it('says Ren’s side is down, not the person’s, when Nuvion refuses Ren’s own key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: 'error',
              message: 'Your credentials are invalid or have expired.',
              code: 'error_auth_credentials_invalid',
            }),
            { status: 401 },
          ),
      ),
    )
    const tried = addRecipient(newWallet(), 'ca_interac_email', person)
    await expect(tried).rejects.toMatchObject({ code: 'chain_error' })
    await expect(tried).rejects.toThrow(/isn’t working for us right now/)
    await expect(tried).rejects.not.toThrow(/credentials/)
  })

  it('refuses a recipient Nuvion won’t take, before any money could move', async () => {
    const nuvion = fakeNuvion()
    nuvion.refuseDetail = true
    await expect(addRecipient(newWallet(), 'ca_interac_email', person)).rejects.toMatchObject({
      code: 'invalid_request',
    })
  })

  it('asks for an account saved without a state or postal code again, and the new copy replaces the old', async () => {
    const nuvion = fakeNuvion()
    const wallet = newWallet()
    const old = await addRecipient(wallet, 'ca_interac_email', person)
    const address = (nuvion.counterparties[0] as { profile: { address: Record<string, unknown> } })
      .profile.address
    // Saved with a state but no postal code, as accounts were for a while.
    delete address.postal_code
    await expect(quotePayout(wallet, old.id, 5_000_000n)).rejects.toMatchObject({
      code: 'invalid_request',
      message: expect.stringMatching(/Add this account again/),
    })
    // And with neither, as accounts were before that.
    delete address.state_or_province
    delete address.state
    await expect(quotePayout(wallet, old.id, 5_000_000n)).rejects.toMatchObject({
      code: 'invalid_request',
    })
    const again = await addRecipient(wallet, 'ca_interac_email', person)
    const { row } = await quotePayout(wallet, again.id, 5_000_000n)
    expect(row.status).toBe('quoted')
    expect((await recipientsOf(wallet)).map((r) => r.id)).toEqual([again.id])
  })

  it('fills the bank from Nuvion’s directory', async () => {
    const nuvion = fakeNuvion()
    const r = await addRecipient(newWallet(), 'ca_eft', {
      ...person,
      bank: '003',
      transit_number: '00012',
      account_number: '1234567',
    })
    expect(r.label).toBe('Royal Bank of Canada •••• 4567')
    expect(nuvion.details[0]).toMatchObject({ bank_institution_number: '003', scheme: 'eft' })
  })
})

describe('cash-outs in the person’s own name', () => {
  /** Mia after the dollar card's ID check: her own entity and USD account, both ways to Ren's pot. */
  async function verified(wallet: `0x${string}`, status = 'approved') {
    await db.insert(schema.cardHolders).values({
      id: crypto.randomUUID(),
      wallet: wallet.toLowerCase(),
      network: 'testnet',
      provider: 'nuvion',
      entityId: 'ent_mia',
      status,
      firstName: 'Mia',
      lastName: 'Okafor',
      accountId: status === 'approved' ? 'acc_mia' : null,
      accountNumber: status === 'approved' ? '0011223344' : null,
      counterpartyId: status === 'approved' ? 'cp_to_mia' : null,
      paymentDetailId: status === 'approved' ? 'pd_to_mia' : null,
      returnCounterpartyId: status === 'approved' ? 'cp_to_pot' : null,
      returnPaymentDetailId: status === 'approved' ? 'pd_to_pot' : null,
    })
  }
  const ref = (step: string, id: string) => `ren-out-${step}-${id.replace(/-/g, '')}`

  beforeEach(() => {
    config.KOVA_PAYOUTS_OWN_NAME = '1'
  })

  it('asks for the ID check before a first cash-out abroad, and says where it stands', async () => {
    fakeNuvion()
    const nobody = newWallet()
    await expect(addRecipient(nobody, 'ca_interac_email', person)).rejects.toMatchObject({
      code: 'forbidden',
      details: { verification: 'needed' },
    })
    const waiting = newWallet()
    await verified(waiting, 'pending')
    await expect(addRecipient(waiting, 'ca_interac_email', person)).rejects.toMatchObject({
      code: 'forbidden',
      details: { verification: 'checking' },
    })
  })

  it('pays from the person’s own account, in their name, and sends the unused fee room back', async () => {
    const nuvion = fakeNuvion()
    const wallet = newWallet()
    await verified(wallet)
    const recipient = await addRecipient(wallet, 'ca_interac_email', person)
    expect(recipient.entityId).toBe('ent_mia')
    expect(nuvion.counterparties[0]).toMatchObject({ entity_id: 'ent_mia' })
    expect(nuvion.details[0]).toMatchObject({ entity_id: 'ent_mia' })

    const { row } = await quotePayout(wallet, recipient.id, 20_000_000n)
    expect(row).toMatchObject({ entityId: 'ent_mia', fxQuoteId: 'fxq_1', amountTo: 2740n })
    const sent = await payPayout(row, pays(row))
    expect(sent).toMatchObject({ status: 'sending', fundedCents: 2500n, providerFee: 50n })

    // 1. Ren's pot funds Mia's account: the $20 and $5 of room for Nuvion's fee.
    expect(nuvion.transfers[0]).toMatchObject({
      account_id: 'acc_pot',
      payment_type: 'book-transfer',
      payment_detail_id: 'pd_to_mia',
      amount: 2500,
      unique_reference: ref('in', row.id),
    })
    // 2. Mia's own account pays the bank, Ren acting for her entity.
    expect(nuvion.transfers[1]).toMatchObject({
      account_id: 'acc_mia',
      entity_id: 'ent_mia',
      amount: 2000,
      fx_quote_id: 'fxq_1',
      unique_reference: `ren-out-${row.id.replace(/-/g, '')}`,
    })
    // 3. The $4.50 of room Nuvion didn't use goes back to the pot, and her account is as it was.
    expect(nuvion.transfers[2]).toMatchObject({
      account_id: 'acc_mia',
      entity_id: 'ent_mia',
      payment_detail_id: 'pd_to_pot',
      amount: 450,
      unique_reference: ref('rest', row.id),
    })
    expect(nuvion.mia).toBe(0)
    expect(nuvion.pot).toBe(50_000 - 2050)

    ;(nuvion.transfers[1] as { status: string }).status = 'successful'
    await settlePayouts()
    expect(await payoutRow(row.id)).toMatchObject({ status: 'paid' })
    expect(nuvion.transfers).toHaveLength(3)
  })

  it('funds the room once more when Nuvion’s fee is bigger than it', async () => {
    const nuvion = fakeNuvion()
    nuvion.fee = 700
    const wallet = newWallet()
    await verified(wallet)
    const recipient = await addRecipient(wallet, 'ca_interac_email', person)
    const { row } = await quotePayout(wallet, recipient.id, 20_000_000n)
    const sent = await payPayout(row, pays(row))
    expect(sent).toMatchObject({ status: 'sending', fundedCents: 3000n, providerFee: 700n })
    expect(nuvion.transfers.map((t) => t.unique_reference)).toEqual([
      ref('in', row.id),
      ref('more', row.id),
      `ren-out-${row.id.replace(/-/g, '')}`,
      ref('rest', row.id),
    ])
    expect(nuvion.mia).toBe(0)
  })

  it('brings a payout the bank fails back to the pot before the dollars go back to the wallet', async () => {
    const nuvion = fakeNuvion()
    const wallet = newWallet()
    await verified(wallet)
    const recipient = await addRecipient(wallet, 'ca_interac_email', person)
    const { row } = await quotePayout(wallet, recipient.id, 20_000_000n)
    await payPayout(row, pays(row))
    // The bank sends it back: Nuvion returns the $20 to Mia's account.
    Object.assign(nuvion.transfers[1] as object, {
      status: 'failed',
      status_reason: 'account_closed',
    })
    nuvion.mia += 2000
    await settlePayouts()
    await settlePayouts()
    const done = await kept(row.id)
    expect(done.status).toBe('failed')
    expect(done.pulledBackAt).not.toBeNull()
    expect(nuvion.transfers.at(-1)).toMatchObject({
      account_id: 'acc_mia',
      payment_detail_id: 'pd_to_pot',
      amount: 2000,
      unique_reference: ref('back', row.id),
    })
    expect(nuvion.mia).toBe(0)
    expect(tempo.sent).toHaveLength(1)
  })

  it('asks for an account saved before, under Ren’s own name, to be added again', async () => {
    fakeNuvion()
    const wallet = newWallet()
    config.KOVA_PAYOUTS_OWN_NAME = '0'
    const old = await addRecipient(wallet, 'ca_interac_email', person)
    expect(old.entityId).toBeNull()
    config.KOVA_PAYOUTS_OWN_NAME = '1'
    await verified(wallet)
    await expect(quotePayout(wallet, old.id, 20_000_000n)).rejects.toMatchObject({
      code: 'invalid_request',
      message: expect.stringMatching(/Add this account again/),
    })
  })
})
