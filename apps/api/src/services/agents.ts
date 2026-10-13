import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { schema, uuidv7 } from '@kova/db'
import { approvalMessage, formatAmount } from '@kova/tempo'
import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import { Mppx, tempo } from 'mppx/client'
import { type Address, getAddress, type Hex, isAddress, isAddressEqual, recoverMessageAddress } from 'viem'
import { Account, Actions, createClient, http } from 'viem/tempo'
import { feePayerAccount, network, rpcUrl } from '../chain.js'
import { isProduction } from '../config.js'
import { db } from '../db.js'
import { KovaError } from '../errors.js'
import { decodeId } from '../ids.js'
import { openAgentKey, sameSecret, tokenHash } from '../secrets.js'
import { settleFromReceipt } from './settle.js'
import { type KeyPaymentRow, type KeyRow, keyRow, onChainKey, requireKeys } from './keys.js'

/**
 * What an AI agent does with its key, through Ren.
 *
 * The agent signs in with its token and asks; Ren checks the key's rules, and only then signs
 * with the key it keeps for the agent. Two ways to pay:
 *
 * - **pay**: send dollars to a wallet, like a person's send. Ren pays the network fee.
 * - **fetch**: call a URL that charges per request over MPP (HTTP 402, the Machine Payments
 *   Protocol Tempo and Stripe wrote). Ren reads the price before paying anything, checks it, pays
 *   with the key, and hands back what the site returned.
 *
 * A payment above the key's ask-first line waits for its owner, who approves it on their phone
 * with their passkey; Ren pays it then. Whatever Ren's rules say, the chain still caps the key's
 * spending per period and only lets it pay in the one dollar.
 */

const TOKEN_PREFIX = 18
/** An approval nobody answers lapses after this. */
const APPROVAL_TTL_MS = 60 * 60_000
/** What a paid response may weigh, as handed back to the agent. */
const MAX_BODY_BYTES = 512 * 1024
const FETCH_TIMEOUT_MS = 25_000

// ── Who's asking ────────────────────────────────────────────────────────────────────────────

/** The key an agent's token belongs to. A removed key's token is gone, so it fails here. */
export async function agentForToken(token: string | undefined): Promise<KeyRow> {
  requireKeys()
  if (!token?.startsWith('ren_agent_') || token.length < 40)
    throw new KovaError('unauthorized', 'Send your Ren agent token as `Authorization: Bearer ren_agent_…`.')
  const row = await db.query.walletKeys.findFirst({
    where: eq(schema.walletKeys.tokenPrefix, token.slice(0, TOKEN_PREFIX)),
  })
  if (!row?.tokenHash || !sameSecret(row.tokenHash, tokenHash(token)) || row.kind !== 'agent')
    throw new KovaError('unauthorized', 'That agent token isn’t Ren’s, or its owner replaced it.')
  return row
}

export async function describeAgent(row: KeyRow) {
  const chain = row.keyId
    ? await onChainKey(getAddress(row.ownerAddress), getAddress(row.keyId), getAddress(row.token)).catch(() => null)
    : null
  const rules = row.rules
  return {
    object: 'agent',
    name: row.label,
    status: row.status === 'active' && row.expiresAt < new Date() ? 'expired' : row.status,
    wallet: getAddress(row.ownerAddress),
    dollar: getAddress(row.token),
    limit: formatAmount(row.spendLimit),
    period: row.period === 604_800 ? 'week' : 'day',
    left: chain?.live ? formatAmount(chain.remaining) : '0',
    renews_at: chain?.periodEnd ? new Date(chain.periodEnd * 1000).toISOString() : null,
    expires_at: row.expiresAt.toISOString(),
    per_payment: rules ? formatAmount(BigInt(rules.perPayment)) : null,
    asks_owner_above: rules ? formatAmount(BigInt(rules.approveAbove)) : null,
    may_pay: rules?.payees ?? 'anyone',
  }
}

function agentAccount(row: KeyRow) {
  if (!row.sealedKey) throw new KovaError('forbidden', 'This key was removed by its owner.')
  return Account.fromSecp256k1(openAgentKey(row.sealedKey, row.id), { access: getAddress(row.ownerAddress) })
}

function agentClient(row: KeyRow) {
  return createClient({
    account: agentAccount(row),
    testnet: network.id === 'testnet',
    feeToken: getAddress(row.token),
    transport: http(rpcUrl, { timeout: 15_000 }),
  })
}

// ── The rules ───────────────────────────────────────────────────────────────────────────────

type Verdict = { kind: 'pay' } | { kind: 'ask' } | { kind: 'deny'; reason: string }

/** Whether this key may pay this much to this wallet now: pay, ask the owner first, or no. */
async function judge(row: KeyRow, amount: bigint, to: Address, approved: boolean): Promise<Verdict> {
  if (row.status === 'frozen') return { kind: 'deny', reason: 'This key is frozen by its owner.' }
  if (row.status !== 'active') return { kind: 'deny', reason: 'This key isn’t switched on.' }
  if (row.expiresAt < new Date()) return { kind: 'deny', reason: 'This key has expired. Its owner can make a new one.' }
  if (amount <= 0n) return { kind: 'deny', reason: 'A payment has to move some money.' }
  const rules = row.rules
  if (!rules) return { kind: 'deny', reason: 'This key has no rules, so it pays nothing.' }
  if (amount > BigInt(rules.perPayment))
    return { kind: 'deny', reason: `That’s over this key’s limit of $${formatAmount(BigInt(rules.perPayment))} a payment.` }
  if (rules.payees !== 'anyone' && !rules.payees.some((p) => isAddressEqual(p as Address, to)))
    return { kind: 'deny', reason: 'This key may only pay the wallets its owner listed.' }
  if (!row.keyId) return { kind: 'deny', reason: 'This key isn’t on Tempo.' }
  const chain = await onChainKey(getAddress(row.ownerAddress), getAddress(row.keyId), getAddress(row.token))
  if (!chain.live) return { kind: 'deny', reason: 'This key isn’t on Tempo any more.' }
  if (chain.remaining < amount) {
    const renews = chain.periodEnd ? ` It renews ${new Date(chain.periodEnd * 1000).toISOString()}.` : ''
    return { kind: 'deny', reason: `That’s over what this key has left: $${formatAmount(chain.remaining)}.${renews}` }
  }
  if (!approved && amount > BigInt(rules.approveAbove)) return { kind: 'ask' }
  return { kind: 'pay' }
}

async function record(
  row: KeyRow,
  values: Omit<typeof schema.keyPayments.$inferInsert, 'id' | 'walletKeyId'>,
): Promise<KeyPaymentRow> {
  const [payment] = await db
    .insert(schema.keyPayments)
    .values({ id: uuidv7(), walletKeyId: row.id, ...values })
    .returning()
  if (values.status === 'paid')
    await db.update(schema.walletKeys).set({ lastUsedAt: new Date() }).where(eq(schema.walletKeys.id, row.id))
  return payment as KeyPaymentRow
}

async function settle(payment: KeyPaymentRow, values: Partial<typeof schema.keyPayments.$inferInsert>) {
  const [updated] = await db
    .update(schema.keyPayments)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(schema.keyPayments.id, payment.id))
    .returning()
  if (values.status === 'paid')
    await db.update(schema.walletKeys).set({ lastUsedAt: new Date() }).where(eq(schema.walletKeys.id, payment.walletKeyId))
  return updated as KeyPaymentRow
}

const why = (error: unknown) => {
  const e = error as { shortMessage?: string; message?: string }
  return (e.shortMessage ?? e.message ?? String(error)).split('\n')[0]?.slice(0, 300) ?? 'unknown'
}

// ── Paying a wallet ─────────────────────────────────────────────────────────────────────────

async function send(row: KeyRow, to: Address, amount: bigint, memo?: Hex): Promise<Hex> {
  const { receipt } = await Actions.token.transferSync(agentClient(row) as never, {
    token: getAddress(row.token),
    to,
    amount,
    ...(memo ? { memo } : {}),
    // Ren pays the network fee, so the key spends exactly the amount.
    feePayer: feePayerAccount,
  } as never)
  if (receipt.status !== 'success') throw new Error('Tempo reverted the payment')
  // A Ren charge's memo settles it: the shop's till turns to paid now, not when the watcher looks.
  if (memo) await settleFromReceipt(receipt as never).catch(() => {})
  return receipt.transactionHash
}

export async function agentPay(
  row: KeyRow,
  input: { to: Address; amount: bigint; note?: string | undefined },
): Promise<KeyPaymentRow> {
  const verdict = await judge(row, input.amount, input.to, false)
  const base = {
    kind: 'pay',
    recipient: input.to.toLowerCase(),
    amount: input.amount,
    description: input.note?.slice(0, 200) ?? null,
  }
  if (verdict.kind === 'deny') return record(row, { ...base, status: 'denied', reason: verdict.reason })
  if (verdict.kind === 'ask')
    return record(row, { ...base, status: 'pending_approval', request: { to: input.to, amount: input.amount.toString() } })
  const payment = await record(row, { ...base, status: 'paying' })
  try {
    return await settle(payment, { status: 'paid', txHash: await send(row, input.to, input.amount) })
  } catch (error) {
    return settle(payment, { status: 'failed', reason: why(error) })
  }
}

// ── Paying a Ren charge ─────────────────────────────────────────────────────────────────────

/** A charge's id from what an agent was given: the id itself, or a pay link or QR's URL. */
export function chargeIdFrom(text: string): string | null {
  return /\bpi_[0-9a-z]{26}\b/.exec(text)?.[0] ?? null
}

async function openCharge(row: KeyRow, chargeId: string) {
  const uuid = decodeId('paymentIntent', chargeId)
  const intent = uuid ? await db.query.paymentIntents.findFirst({ where: eq(schema.paymentIntents.id, uuid) }) : undefined
  if (!intent) throw new KovaError('not_found', 'No such Ren charge.')
  if (intent.status !== 'requires_payment') throw new KovaError('conflict', `This charge is ${intent.status.replace('_', ' ')}.`)
  if (intent.expiresAt < new Date()) throw new KovaError('conflict', 'This charge has expired. Ask the shop for a new one.')
  if (!isAddressEqual(intent.tokenAddress as Address, row.token as Address))
    throw new KovaError('invalid_request', 'This charge is in a different dollar than this key pays in.')
  const merchant = await db.query.merchants.findFirst({ where: eq(schema.merchants.id, intent.merchantId) })
  return { intent, shop: merchant?.name ?? 'A Ren shop' }
}

/**
 * Pays a Ren charge (a till's QR, a stall order, a payment link) for exactly what it asks, with its
 * memo, so the shop's till turns to paid as it would for a person.
 */
export async function agentPayCharge(row: KeyRow, chargeId: string): Promise<KeyPaymentRow> {
  const { intent, shop } = await openCharge(row, chargeId)
  const to = getAddress(intent.payTo)
  const base = {
    kind: 'charge',
    recipient: to.toLowerCase(),
    amount: intent.amount,
    description: `${shop}${intent.reference ? ` · ${intent.reference}` : ''}`.slice(0, 200),
    request: { charge: chargeId },
  }
  const verdict = await judge(row, intent.amount, to, false)
  if (verdict.kind === 'deny') return record(row, { ...base, status: 'denied', reason: verdict.reason })
  if (verdict.kind === 'ask') return record(row, { ...base, status: 'pending_approval' })
  const payment = await record(row, { ...base, status: 'paying' })
  try {
    return await settle(payment, { status: 'paid', txHash: await send(row, to, intent.amount, intent.memo as Hex) })
  } catch (error) {
    return settle(payment, { status: 'failed', reason: why(error) })
  }
}

// ── Paying for a request (MPP) ──────────────────────────────────────────────────────────────

export interface FetchInput {
  url: string
  method: string
  headers?: Record<string, string> | undefined
  body?: string | undefined
  /** The most the agent agrees to pay for this one request. */
  maxAmount?: bigint | undefined
}

export interface FetchResult {
  status: 'free' | 'paid' | 'pending_approval' | 'denied' | 'failed'
  payment: KeyPaymentRow | null
  response: { status: number; content_type: string | null; body: string; encoding: 'utf8' | 'base64'; truncated: boolean } | null
  /** Why it didn't go through, when it didn't. */
  reason?: string
}

const PRIVATE_V4 = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./]
const privateAddress = (ip: string): boolean =>
  isIP(ip) === 4
    ? PRIVATE_V4.some((r) => r.test(ip))
    : /^(::1|::|fc|fd|fe80)/i.test(ip) || ip.toLowerCase().startsWith('::ffff:') && privateAddress(ip.slice(7))

/**
 * Ren calls the URL from its own servers, so it must be a public site: never Ren's own network or
 * the machine it runs on. (On a developer's machine, localhost is allowed for testing.)
 */
async function checkUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new KovaError('invalid_request', 'That isn’t a URL.')
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (!isProduction && local && (url.protocol === 'http:' || url.protocol === 'https:')) return url
  if (url.protocol !== 'https:') throw new KovaError('invalid_request', 'Ren only pays for https URLs.')
  if (url.username || url.password) throw new KovaError('invalid_request', 'A URL with a password in it isn’t allowed.')
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true }).catch(() => [])
  if (addresses.length === 0) throw new KovaError('invalid_request', 'That site doesn’t resolve.')
  if (addresses.some((a) => privateAddress(a.address)))
    throw new KovaError('invalid_request', 'Ren only calls public sites.')
  return url
}

async function readBody(response: Response): Promise<NonNullable<FetchResult['response']>> {
  const type = response.headers.get('content-type')
  const bytes = new Uint8Array(await response.arrayBuffer())
  const truncated = bytes.length > MAX_BODY_BYTES
  const kept = truncated ? bytes.slice(0, MAX_BODY_BYTES) : bytes
  const text = !type || /json|text|xml|javascript|csv|yaml|html/i.test(type)
  return {
    status: response.status,
    content_type: type,
    body: text ? new TextDecoder().decode(kept) : Buffer.from(kept).toString('base64'),
    encoding: text ? 'utf8' : 'base64',
    truncated,
  }
}

function receiptReference(response: Response): string | null {
  const header = response.headers.get('payment-receipt')
  if (!header) return null
  try {
    const receipt = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { reference?: string }
    return receipt.reference ?? null
  } catch {
    return null
  }
}

/**
 * Calls the URL; if it asks for payment, reads the price, checks it, and pays only if the key's
 * rules allow (or the owner already approved this payment).
 */
export async function agentFetch(row: KeyRow, input: FetchInput, approved?: KeyPaymentRow): Promise<FetchResult> {
  const url = await checkUrl(input.url)
  const method = input.method.toUpperCase()
  const init: RequestInit = {
    method,
    headers: input.headers,
    ...(input.body !== undefined && method !== 'GET' && method !== 'HEAD' ? { body: input.body } : {}),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }
  const mppx = Mppx.create({
    methods: [
      tempo.charge({
        account: agentAccount(row),
        getClient: () => agentClient(row) as never,
        expectedChainId: network.chainId,
      }),
    ],
    polyfill: false,
  })

  let prepared: Awaited<ReturnType<typeof mppx.prepareRequest>>
  try {
    prepared = await mppx.prepareRequest(url, init, { maxRedirects: 0, acceptPayment: 'tempo/charge' })
  } catch (error) {
    if (approved) await settle(approved, { status: 'failed', reason: why(error) })
    return { status: 'failed', payment: null, response: null, reason: why(error) }
  }
  if (!prepared.payment) return { status: 'free', payment: null, response: await readBody(prepared.response) }

  const challenge = prepared.payment.challenge
  const terms = challenge.request as { amount?: string; currency?: string; recipient?: string; description?: string }
  const base = {
    kind: 'mpp',
    origin: url.origin,
    url: url.toString().slice(0, 500),
    description: (challenge.description ?? terms.description ?? null)?.slice(0, 200) ?? null,
  }
  const refuse = async (reason: string, amount = 0n, to: string = row.ownerAddress): Promise<FetchResult> => ({
    status: 'denied',
    payment: approved
      ? await settle(approved, { status: 'failed', reason })
      : await record(row, { ...base, recipient: to.toLowerCase(), amount, status: 'denied', reason }),
    response: null,
    reason,
  })
  if (challenge.method !== 'tempo' || challenge.intent !== 'charge')
    return refuse(`This site asks for ${challenge.method} ${challenge.intent}; Ren pays one-off Tempo charges only.`)
  if (!terms.amount || !/^\d+$/.test(terms.amount) || !terms.recipient || !isAddress(terms.recipient))
    return refuse('This site’s price isn’t readable.')
  const amount = BigInt(terms.amount)
  const to = getAddress(terms.recipient)
  if (!terms.currency || !isAddressEqual(terms.currency as Address, row.token as Address))
    return refuse('This site wants a different dollar than this key pays in.', amount, to)
  if (input.maxAmount !== undefined && amount > input.maxAmount)
    return refuse(`It costs $${formatAmount(amount)}, more than the $${formatAmount(input.maxAmount)} you allowed.`, amount, to)
  if (approved && (amount > approved.amount || !isAddressEqual(to, approved.recipient as Address)))
    return refuse('The price changed since the owner approved it. Ask again.', amount, to)

  const verdict = await judge(row, amount, to, Boolean(approved))
  if (verdict.kind === 'deny') return refuse(verdict.reason, amount, to)
  if (verdict.kind === 'ask')
    return {
      status: 'pending_approval',
      payment: await record(row, {
        ...base,
        recipient: to.toLowerCase(),
        amount,
        status: 'pending_approval',
        request: { url: input.url, method, headers: input.headers ?? {}, body: input.body ?? null },
      }),
      response: null,
    }

  const payment =
    approved ?? (await record(row, { ...base, recipient: to.toLowerCase(), amount, status: 'paying' }))
  try {
    const response = await prepared.payment.pay()
    const body = await readBody(response)
    const reference = receiptReference(response)
    if (response.status >= 400 && !reference) {
      const settled = await settle(payment, { status: 'failed', reason: `The site answered ${response.status} and didn’t take the payment.` })
      return { status: 'failed', payment: settled, response: body }
    }
    const settled = await settle(payment, {
      status: 'paid',
      txHash: reference,
      ...(approved ? { response: body as unknown as Record<string, unknown> } : {}),
    })
    return { status: 'paid', payment: settled, response: body }
  } catch (error) {
    const settled = await settle(payment, { status: 'failed', reason: why(error) })
    return { status: 'failed', payment: settled, response: null }
  }
}

// ── The owner's answer ──────────────────────────────────────────────────────────────────────

/** Payments waiting for this owner, across all their keys. Ones nobody answered in time lapse. */
export async function approvalsFor(owner: Address): Promise<{ payment: KeyPaymentRow; key: KeyRow }[]> {
  const keys = await db.query.walletKeys.findMany({
    where: and(eq(schema.walletKeys.ownerAddress, owner.toLowerCase()), eq(schema.walletKeys.network, network.id)),
  })
  if (keys.length === 0) return []
  const ids = keys.map((k) => k.id)
  await db
    .update(schema.keyPayments)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(
      and(
        inArray(schema.keyPayments.walletKeyId, ids),
        eq(schema.keyPayments.status, 'pending_approval'),
        lt(schema.keyPayments.createdAt, new Date(Date.now() - APPROVAL_TTL_MS)),
      ),
    )
  const waiting = await db.query.keyPayments.findMany({
    where: and(inArray(schema.keyPayments.walletKeyId, ids), eq(schema.keyPayments.status, 'pending_approval')),
    orderBy: [desc(schema.keyPayments.createdAt)],
  })
  return waiting.map((payment) => ({ payment, key: keys.find((k) => k.id === payment.walletKeyId) as KeyRow }))
}

export async function paymentRow(id: string): Promise<KeyPaymentRow | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined
  return db.query.keyPayments.findFirst({ where: eq(schema.keyPayments.id, id) })
}

/**
 * The owner says yes or no to one payment, signing exactly that answer with their wallet. A yes
 * pays it now, still within the key's limits on-chain.
 */
export async function answerApproval(input: {
  owner: Address
  paymentId: string
  decision: 'approve' | 'decline'
  signature: Hex
}): Promise<{ payment: KeyPaymentRow; result?: FetchResult }> {
  const payment = await paymentRow(input.paymentId)
  const key = payment ? await keyRow(payment.walletKeyId) : undefined
  if (!payment || !key || !isAddressEqual(key.ownerAddress as Address, input.owner))
    throw new KovaError('not_found', 'No such payment waiting for this wallet.')
  if (payment.status !== 'pending_approval')
    throw new KovaError('conflict', `This payment is ${payment.status.replace('_', ' ')}, not waiting.`)
  const message = approvalMessage({
    address: getAddress(input.owner),
    paymentId: payment.id,
    decision: input.decision,
    amount: formatAmount(payment.amount),
    to: payment.origin ?? getAddress(payment.recipient),
  })
  const signer = await recoverMessageAddress({ message, signature: input.signature }).catch(() => null)
  if (!signer || !isAddressEqual(signer, input.owner))
    throw new KovaError('forbidden', 'Only the wallet that owns this key can answer for it.')

  // Claim it, so two answers can't both act.
  const [claimed] = await db
    .update(schema.keyPayments)
    .set({ status: input.decision === 'approve' ? 'approved' : 'declined', decidedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.keyPayments.id, payment.id), eq(schema.keyPayments.status, 'pending_approval')))
    .returning()
  if (!claimed) throw new KovaError('conflict', 'This payment was already answered.')
  if (input.decision === 'decline') return { payment: claimed }

  if (payment.kind === 'charge') {
    try {
      const { intent } = await openCharge(key, String((payment.request as { charge?: string } | null)?.charge ?? ''))
      const verdict = await judge(key, intent.amount, getAddress(intent.payTo), true)
      if (verdict.kind === 'deny') return { payment: await settle(claimed, { status: 'failed', reason: verdict.reason }) }
      const txHash = await send(key, getAddress(intent.payTo), intent.amount, intent.memo as Hex)
      return { payment: await settle(claimed, { status: 'paid', txHash }) }
    } catch (error) {
      return { payment: await settle(claimed, { status: 'failed', reason: why(error) }) }
    }
  }
  if (payment.kind === 'pay') {
    const verdict = await judge(key, payment.amount, getAddress(payment.recipient), true)
    if (verdict.kind === 'deny') return { payment: await settle(claimed, { status: 'failed', reason: verdict.reason }) }
    try {
      return { payment: await settle(claimed, { status: 'paid', txHash: await send(key, getAddress(payment.recipient), payment.amount) }) }
    } catch (error) {
      return { payment: await settle(claimed, { status: 'failed', reason: why(error) }) }
    }
  }
  const request = (payment.request ?? {}) as { url?: string; method?: string; headers?: Record<string, string>; body?: string | null }
  const result = await agentFetch(
    key,
    { url: request.url ?? '', method: request.method ?? 'GET', headers: request.headers, body: request.body ?? undefined },
    claimed,
  )
  return { payment: result.payment ?? claimed, result }
}
