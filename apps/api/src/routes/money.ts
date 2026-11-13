import { MONEY_FEATURES, type MoneyFeature } from '@kova/tempo'
import { Hono } from 'hono'
import { type Address, getAddress, type Hex, isAddress, isHex } from 'viem'
import { z } from 'zod'
import { KovaError } from '../errors.js'
import { clientIp, limit } from '../limits.js'
import {
  deleteDollarCard,
  dollarCardFor,
  idNumberFor,
  newDollarCard,
  quoteTopUp,
  revealDollarCard,
  serializeTopUp,
  setDollarCard,
  startCheck,
  topUpSent,
  withdraw,
} from '../services/dollar-card.js'
import { requestAccess, requireWalletSignature } from '../services/money.js'

/**
 * The dollar card (services/dollar-card.ts).
 *
 *   POST /wallets/:address/access-requests              ask for a feature that waits on a partner (signed)
 *   GET  /wallets/:address/dollar-card                  where the card is: intro, checking, fix or the card itself
 *   POST /wallets/:address/dollar-card/check            the holder's details and ID photo, to the issuer's check (signed)
 *   POST /wallets/:address/dollar-card/top-up           a top-up's quote (signed): amount + 0.5%, and where to send it
 *   POST /wallets/:address/dollar-card/top-up/:id/sent  { tx_hash }: the wallet sent it, move the amount onto the card
 *   POST /wallets/:address/dollar-card/withdraw         money off the card, back to the wallet, free (signed)
 *   POST /wallets/:address/dollar-card/settings         freeze or unfreeze (signed)
 *   POST /wallets/:address/dollar-card/delete           delete the card for good (signed)
 *   POST /wallets/:address/dollar-card/new              a new card after a deleted one (signed)
 *   POST /wallets/:address/dollar-card/reveal           the card's number, expiry and CVV (signed)
 *
 * "Signed" is the wallet's signature over `moneyActionMessage` (packages/tempo money.ts), naming the
 * action and what it changes. A top-up's dollars move only by a transfer the wallet itself sends.
 *
 * Kova refuses the ID check and top-ups from countries under sanctions by the caller's IP. Ren has
 * no IP-to-country lookup yet, so that check isn't here; Nuvion's own ID check still applies.
 */

function walletAddress(c: { req: { param: (name: string) => string } }): Address {
  const address = c.req.param('address')
  if (!isAddress(address)) throw new KovaError('invalid_request', 'That isn’t a wallet address.')
  return getAddress(address)
}

const signed = { signed_at: z.number().int(), signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/) }
const accessBody = z.object({
  feature: z.enum(MONEY_FEATURES as [MoneyFeature, ...MoneyFeature[]]),
  ...signed,
})
const plainSigned = z.object(signed)
const checkBody = z.object({
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().min(1).max(60),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email: z.string().trim().email().max(200),
  phone: z.string().regex(/^\+\d{8,15}$/),
  nationality: z.string().regex(/^[A-Z]{2}$/),
  gender: z.enum(['m', 'f']),
  address: z.object({
    line1: z.string().trim().min(3).max(120),
    city: z.string().trim().min(2).max(60),
    state: z.string().trim().min(2).max(60),
    postal_code: z.string().trim().min(2).max(20),
    country: z.string().regex(/^[A-Z]{2}$/),
  }),
  document: z.object({
    type: z.enum(['international_passport', 'national_id', 'drivers_license']),
    number: z.string().trim().min(4).max(40),
    /** The photo, base64 (no data: prefix), at most about 6 MB. */
    file: z.string().min(100).max(8_000_000),
    mime: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
    file_back: z.string().min(100).max(8_000_000).optional(),
  }),
  /** NIN or BVN for Nigerians, SSN for Americans (see idNumberFor). */
  id_number: z
    .object({ type: z.enum(['nin', 'bvn', 'ssn']), value: z.string().trim().max(20) })
    .optional(),
  /** A bill or bank statement showing the home address. */
  address_proof: z
    .object({
      type: z.enum(['utility_bill', 'bank_statement']),
      file: z.string().min(100).max(8_000_000),
      mime: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
    })
    .optional(),
  ...signed,
})
/** What lands on the card, in base units; the wallet pays that plus Ren's fee. */
const topUpBody = z.object({ amount: z.string().regex(/^\d{1,15}$/), ...signed })
const sentBody = z.object({
  tx_hash: z.string().refine((v) => isHex(v) && v.length === 66, 'Expected a transaction hash'),
})
const settingsBody = z.object({ frozen: z.boolean(), ...signed })
const withdrawBody = z.object({ amount: z.string().regex(/^\d{1,15}$/), ...signed })

async function body<T>(
  c: { req: { json: () => Promise<unknown> } },
  schema: z.ZodType<T>,
  expected: string,
): Promise<T> {
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) throw new KovaError('invalid_request', `Expected ${expected}.`)
  return parsed.data
}

export const moneyRoutes = new Hono()
  .post('/wallets/:address/access-requests', async (c) => {
    const wallet = walletAddress(c)
    const b = await body(c, accessBody, '{ feature, signed_at, signature }')
    await requireWalletSignature(wallet, 'request-access', b.signed_at, b.signature, b.feature)
    limit(
      `money-access-ip:${clientIp(c)}`,
      60,
      3_600_000,
      'That’s a lot from here. Try again later.',
    )
    await requestAccess(wallet, b.feature)
    return c.json({ object: 'access_request', feature: b.feature, requested: true })
  })
  .get('/wallets/:address/dollar-card', async (c) => c.json(await dollarCardFor(walletAddress(c))))
  .post('/wallets/:address/dollar-card/check', async (c) => {
    const wallet = walletAddress(c)
    const b = await body(c, checkBody, '{ your details, document, signed_at, signature }')
    await requireWalletSignature(wallet, 'dollar-card-check', b.signed_at, b.signature)
    limit(
      `dollar-card-check:${clientIp(c)}`,
      6,
      3_600_000,
      'That’s a lot of ID checks from here. Try again later.',
    )
    if (!b.address_proof)
      throw new KovaError(
        'invalid_request',
        'Nuvion also needs a proof of address: a bill or bank statement.',
      )
    return c.json(
      await startCheck(
        wallet,
        {
          firstName: b.first_name,
          lastName: b.last_name,
          dateOfBirth: b.date_of_birth,
          email: b.email,
          phone: b.phone,
          nationality: b.nationality,
          gender: b.gender,
          address: {
            line1: b.address.line1,
            city: b.address.city,
            state: b.address.state,
            postalCode: b.address.postal_code,
            country: b.address.country,
          },
          document: { type: b.document.type, number: b.document.number },
          idNumber: idNumberFor(b.nationality, b.address.country, b.id_number),
          addressProof: b.address_proof.type,
        },
        {
          identity: {
            base64: b.document.file,
            mime: b.document.mime,
            backBase64: b.document.file_back,
          },
          address: { base64: b.address_proof.file, mime: b.address_proof.mime },
        },
      ),
    )
  })
  .post('/wallets/:address/dollar-card/top-up', async (c) => {
    const wallet = walletAddress(c)
    const b = await body(c, topUpBody, '{ amount, signed_at, signature }')
    // The amount is signed too, so a quote is only ever made for what the holder asked for.
    await requireWalletSignature(wallet, 'dollar-card-top-up', b.signed_at, b.signature, b.amount)
    limit(
      `dollar-card-top-up:${wallet.toLowerCase()}`,
      20,
      3_600_000,
      'That’s a lot of top-ups in an hour. Try again later.',
    )
    return c.json(serializeTopUp(await quoteTopUp(wallet, BigInt(b.amount))))
  })
  .post('/wallets/:address/dollar-card/top-up/:id/sent', async (c) => {
    const wallet = walletAddress(c)
    const b = await body(c, sentBody, '{ tx_hash }')
    limit(
      `dollar-card-top-up-sent:${wallet.toLowerCase()}`,
      60,
      3_600_000,
      'That’s a lot of top-ups in an hour. Try again later.',
    )
    // No signature here: the transaction is the wallet's word, and it is read on Tempo.
    return c.json(await topUpSent(wallet, c.req.param('id'), b.tx_hash as Hex))
  })
  .post('/wallets/:address/dollar-card/withdraw', async (c) => {
    const wallet = walletAddress(c)
    const b = await body(c, withdrawBody, '{ amount, signed_at, signature }')
    // The amount is signed too, so a signature moves exactly what the holder asked for.
    await requireWalletSignature(wallet, 'dollar-card-withdraw', b.signed_at, b.signature, b.amount)
    limit(
      `dollar-card-withdraw:${wallet.toLowerCase()}`,
      20,
      3_600_000,
      'That’s a lot of moves off the card in an hour. Try again later.',
    )
    return c.json(await withdraw(wallet, BigInt(b.amount)))
  })
  .post('/wallets/:address/dollar-card/settings', async (c) => {
    const wallet = walletAddress(c)
    const b = await body(c, settingsBody, '{ frozen, signed_at, signature }')
    await requireWalletSignature(
      wallet,
      'dollar-card-settings',
      b.signed_at,
      b.signature,
      b.frozen ? 'freeze' : 'unfreeze',
    )
    return c.json(await setDollarCard(wallet, b.frozen))
  })
  .post('/wallets/:address/dollar-card/delete', async (c) => {
    const wallet = walletAddress(c)
    const b = await body(c, plainSigned, '{ signed_at, signature }')
    await requireWalletSignature(wallet, 'dollar-card-delete', b.signed_at, b.signature)
    return c.json(await deleteDollarCard(wallet))
  })
  .post('/wallets/:address/dollar-card/new', async (c) => {
    const wallet = walletAddress(c)
    const b = await body(c, plainSigned, '{ signed_at, signature }')
    await requireWalletSignature(wallet, 'dollar-card-new', b.signed_at, b.signature)
    return c.json(await newDollarCard(wallet))
  })
  .post('/wallets/:address/dollar-card/reveal', async (c) => {
    const wallet = walletAddress(c)
    const b = await body(c, plainSigned, '{ signed_at, signature }')
    await requireWalletSignature(wallet, 'reveal-dollar-card', b.signed_at, b.signature)
    limit(
      `dollar-card-reveal:${wallet.toLowerCase()}`,
      20,
      3_600_000,
      'That’s a lot of looks at the card. Try again later.',
    )
    return c.json(await revealDollarCard(wallet))
  })
