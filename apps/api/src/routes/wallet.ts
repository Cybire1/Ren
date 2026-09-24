import { schema } from '@kova/db'
import {
  AUSD_TESTNET_FAUCET,
  decodeMemo,
  explorerTxUrl,
  faucetAbi,
  formatAmount,
  parseSignedAuthorization,
  tokenByAddress,
} from '@kova/monad'
import { and, asc, eq, gt, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { type Address, getAddress, type Hex, isAddress } from 'viem'
import { z } from 'zod'
import { network, walletClient } from '../chain.js'
import { config } from '../config.js'
import { db } from '../db.js'
import { KovaError } from '../errors.js'
import { relayAuthorization } from '../relay.js'
import { indexedThrough } from '../workers/watcher.js'

/**
 * Kova Pay's side of Monad. There is no account and no key: a wallet is its address, and it
 * proves itself by signing.
 *
 * - POST /transfers relays a transfer between people that the sender signed; Kova pays the gas.
 * - GET /wallets/:address/transfers lists what moved in or out, from Kova's index of the chain.
 * - POST /faucet sends test dollars, on testnet only.
 */

const hits = new Map<string, number[]>()
function limit(key: string, max: number, windowMs: number, message: string) {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) throw new KovaError('rate_limited', message)
  hits.set(key, [...recent, now])
}
const ip = (c: { req: { header: (name: string) => string | undefined } }) =>
  c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'

/** An approval to send is used within seconds; one that lives longer is only a risk to its signer. */
const MAX_SEND_VALIDITY = 3_600n

type TransferRow = typeof schema.transfers.$inferSelect

function serializeTransfer(row: TransferRow) {
  const token = tokenByAddress(config.KOVA_NETWORK, row.tokenAddress as Address)
  return {
    object: 'transfer',
    id: `${row.txHash}:${row.logIndex}`,
    currency: token?.currency ?? null,
    token: getAddress(row.tokenAddress),
    from: getAddress(row.fromAddress),
    to: getAddress(row.toAddress),
    amount: formatAmount(row.amount),
    amount_base: row.amount.toString(),
    tx_hash: row.txHash,
    block: row.blockNumber.toString(),
    /** What the money was, when a Kova memo says: a payment, a refund, a payout. */
    kind: row.nonce ? (decodeMemo(row.nonce as Hex)?.kind ?? null) : null,
    /** Test dollars from the testnet faucet rather than from a person. */
    faucet: config.KOVA_NETWORK === 'testnet' && row.fromAddress === AUSD_TESTNET_FAUCET.toLowerCase(),
    explorer_url: explorerTxUrl(network, row.txHash as Hex),
  }
}

const faucetBody = z.object({ address: z.string().refine((v) => isAddress(v), 'Not a Monad address') })

export const walletRoutes = new Hono()
  .post('/transfers', async (c) => {
    const signed = parseSignedAuthorization(await c.req.json().catch(() => null))
    if (!signed) throw new KovaError('invalid_request', 'Expected a signed transfer authorization.')
    const { authorization, signature } = signed
    const token = tokenByAddress(config.KOVA_NETWORK, signed.token)
    if (!token) throw new KovaError('invalid_request', 'Kova only sends the dollars it settles in.')
    // Charges have their own door, which checks the charge. A Kova memo here is refused, so
    // nothing can pay a charge without that check.
    if (decodeMemo(authorization.nonce)) throw new KovaError('invalid_request', 'Pay a charge through its checkout.')
    const now = BigInt(Math.floor(Date.now() / 1000))
    if (authorization.validBefore > now + MAX_SEND_VALIDITY)
      throw new KovaError('invalid_request', 'An approval to send can last an hour at most.')

    limit(`send:${authorization.from.toLowerCase()}`, 20, 600_000, 'That’s a lot of sends in a few minutes. Try again shortly.')
    limit(`send-ip:${ip(c)}`, 60, 600_000, 'That’s a lot of sends from here. Try again shortly.')

    const { receipt, ms } = await relayAuthorization(token, authorization, signature)
    return c.json({
      object: 'transfer',
      tx_hash: receipt.transactionHash,
      block: receipt.blockNumber.toString(),
      explorer_url: explorerTxUrl(network, receipt.transactionHash),
      ms: Math.round(ms),
    })
  })
  .get('/wallets/:address/transfers', async (c) => {
    const address = c.req.param('address')
    if (!isAddress(address)) throw new KovaError('invalid_request', 'Not a Monad address.')
    const afterText = c.req.query('after_block') ?? '0'
    if (!/^\d{1,20}$/.test(afterText)) throw new KovaError('invalid_request', 'after_block must be a block number.')
    const direction = c.req.query('direction') ?? 'in'
    if (direction !== 'in' && direction !== 'out' && direction !== 'all')
      throw new KovaError('invalid_request', 'direction is in, out or all.')

    const who = address.toLowerCase()
    const side =
      direction === 'in'
        ? eq(schema.transfers.toAddress, who)
        : direction === 'out'
          ? eq(schema.transfers.fromAddress, who)
          : or(eq(schema.transfers.toAddress, who), eq(schema.transfers.fromAddress, who))
    const page = 200
    const [rows, through] = await Promise.all([
      db.query.transfers.findMany({
        where: and(eq(schema.transfers.network, config.KOVA_NETWORK), gt(schema.transfers.blockNumber, BigInt(afterText)), side),
        orderBy: [asc(schema.transfers.blockNumber), asc(schema.transfers.logIndex)],
        limit: page,
      }),
      indexedThrough(),
    ])
    // A full page may end mid-block: resume from the block before the last one, and let the
    // wallet drop the few it has already seen.
    const last = rows.at(-1)
    const cursor = rows.length === page && last ? last.blockNumber - 1n : (through ?? BigInt(afterText))
    return c.json({ object: 'list', data: rows.map(serializeTransfer), indexed_through: cursor.toString(), has_more: rows.length === page })
  })
  .post('/faucet', async (c) => {
    if (config.KOVA_NETWORK !== 'testnet') throw new KovaError('forbidden', 'Test dollars are for testnet only.')
    const parsed = faucetBody.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success) throw new KovaError('invalid_request', 'Expected { address }.')
    if (!walletClient) throw new KovaError('chain_error', 'Test dollars are not switched on for this server yet.')
    const address = getAddress(parsed.data.address)
    limit(`faucet:${address.toLowerCase()}`, 3, 3_600_000, 'That wallet has had its test dollars for now. Try again in an hour.')
    limit(`faucet-ip:${ip(c)}`, 10, 3_600_000, 'Lots of test dollars from here. Try again in an hour.')

    // Agora's faucet sends 10,000 test AUSD to whoever it is asked for; Kova's relayer asks, and pays the gas.
    const receipt = await walletClient
      .writeContractSync({ address: AUSD_TESTNET_FAUCET, abi: faucetAbi, functionName: 'requestFunds', args: [address], timeout: 10_000 })
      .catch((error: Error) => {
        console.error('[faucet]', error.message.split('\n')[0])
        throw new KovaError('chain_error', 'The test-dollar faucet didn’t answer. Try again in a moment.')
      })
    if (receipt.status !== 'success') throw new KovaError('chain_error', 'The test-dollar faucet said no. Try again later.')
    return c.json({
      object: 'faucet',
      amount: '10000.00',
      currency: 'AUSD',
      tx_hash: receipt.transactionHash,
      explorer_url: explorerTxUrl(network, receipt.transactionHash),
    })
  })
