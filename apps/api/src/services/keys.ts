import { randomBytes } from 'node:crypto'
import { schema, uuidv7 } from '@kova/db'
import { DAY, formatAmount, type KeyTerms, keyTermsProblem, WEEK } from '@kova/tempo'
import { and, desc, eq, inArray, lt, or } from 'drizzle-orm'
import { type Address, getAddress, type Hex, isAddressEqual } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Actions } from 'viem/tempo'
import { feePayerAccount, onTempo, publicClient, settlementToken } from '../chain.js'
import { config } from '../config.js'
import { db } from '../db.js'
import { KovaError } from '../errors.js'
import { hashSecret, sealAgentKey, secretMatches, tokenHash } from '../secrets.js'

/**
 * Keys (Tempo): everything that can spend a wallet's dollars short of the wallet itself.
 *
 * - **An agent's key.** Ren makes it, seals it, and signs with it for the agent, after its rules
 *   (a cap per payment, who it may pay, asking the owner above a line). The agent holds only a
 *   token, so it never touches a key, and the owner can stop it at once.
 * - **An allowance.** A person's own phone makes the key; the owner gives it a weekly or daily
 *   limit on their dollars. Ren only passes the invite between them.
 *
 * Every key is a Tempo access key on the owner's account, authorized by the owner's passkey on
 * their own device: the chain caps what it spends per period, allows only paying in the one
 * dollar, ends it at its expiry, and freezing sets its limit to zero. Ren never holds the owner's
 * money or their passkey, so it can't raise a limit or make a key; it can only refuse to sign.
 */

export type KeyRow = typeof schema.walletKeys.$inferSelect
export type KeyPaymentRow = typeof schema.keyPayments.$inferSelect

export const keysReady = () => onTempo && Boolean(config.KOVA_KEYS_MASTER_KEY && feePayerAccount)

export function requireKeys() {
  if (!keysReady()) throw new KovaError('conflict', 'Keys aren’t switched on for this server yet.')
}

const net = config.KOVA_NETWORK
const lower = (address: string) => address.toLowerCase()
const nowS = () => Math.floor(Date.now() / 1000)

/** How long an allowance invite can wait to be accepted. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60_000
/** A key Ren made that its owner never put on-chain is forgotten after this. */
const PENDING_TTL_MS = 60 * 60_000

// ── The chain's view ────────────────────────────────────────────────────────────────────────

export interface OnChainKey {
  /** The key is authorized on the account and not revoked. */
  live: boolean
  revoked: boolean
  expiry: number
  remaining: bigint
  /** Unix seconds when the current period's limit renews. */
  periodEnd: number | null
}

export async function onChainKey(owner: Address, keyId: Address, token: Address): Promise<OnChainKey> {
  const [meta, limit] = await Promise.all([
    Actions.accessKey.getMetadata(publicClient as never, { account: owner, accessKey: keyId }),
    Actions.accessKey
      .getRemainingLimit(publicClient as never, { account: owner, accessKey: keyId, token })
      .catch(() => null),
  ])
  const expiry = Number(meta.expiry)
  return {
    live: expiry > 0 && !meta.isRevoked,
    revoked: meta.isRevoked,
    expiry,
    remaining: limit?.remaining ?? 0n,
    periodEnd: limit?.periodEnd ? Number(limit.periodEnd) : null,
  }
}

// ── Reading ─────────────────────────────────────────────────────────────────────────────────

export async function keyRow(id: string): Promise<KeyRow | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined
  return db.query.walletKeys.findFirst({ where: eq(schema.walletKeys.id, id) })
}

/** One of the owner's keys, or a 404: a key is only ever its owner's to see. */
export async function ownedKey(owner: Address, id: string): Promise<KeyRow> {
  const row = await keyRow(id)
  if (!row || row.network !== net || !isAddressEqual(row.ownerAddress as Address, owner))
    throw new KovaError('not_found', 'No such key on this wallet.')
  return row
}

/** The keys that spend this wallet's dollars, newest first, and the allowances others gave it. */
export async function keysOf(wallet: Address): Promise<{ given: KeyRow[]; received: KeyRow[] }> {
  // A key made but never put on-chain within the hour is dropped, with its sealed key.
  await db
    .delete(schema.walletKeys)
    .where(
      and(
        eq(schema.walletKeys.status, 'pending'),
        eq(schema.walletKeys.kind, 'agent'),
        lt(schema.walletKeys.createdAt, new Date(Date.now() - PENDING_TTL_MS)),
      ),
    )
    .catch(() => {})
  const rows = await db.query.walletKeys.findMany({
    where: and(
      eq(schema.walletKeys.network, net),
      or(eq(schema.walletKeys.ownerAddress, lower(wallet)), eq(schema.walletKeys.holderAddress, lower(wallet))),
    ),
    orderBy: [desc(schema.walletKeys.createdAt)],
  })
  return {
    given: rows.filter((r) => isAddressEqual(r.ownerAddress as Address, wallet)),
    received: rows.filter((r) => r.holderAddress && isAddressEqual(r.holderAddress as Address, wallet) && r.status !== 'revoked'),
  }
}

const periodName = (seconds: number) => (seconds === WEEK ? 'week' : 'day')

/** A key as its owner's screens show it, with what the chain says it can still spend. */
export async function serializeKey(row: KeyRow, options: { chain?: boolean } = {}) {
  const chain =
    options.chain !== false && row.keyId && row.status !== 'pending'
      ? await onChainKey(getAddress(row.ownerAddress), getAddress(row.keyId), getAddress(row.token)).catch(() => null)
      : null
  const expired = row.expiresAt.getTime() < Date.now()
  const status = row.status === 'active' && expired ? 'expired' : row.status
  return {
    object: 'key',
    id: row.id,
    kind: row.kind,
    label: row.label,
    status,
    owner: getAddress(row.ownerAddress),
    key_id: row.keyId ? getAddress(row.keyId) : null,
    key_type: row.keyType,
    holder: row.holderAddress ? getAddress(row.holderAddress) : null,
    holder_name: row.holderName,
    token: getAddress(row.token),
    limit: formatAmount(row.spendLimit),
    period: periodName(row.period),
    remaining: chain?.live ? formatAmount(chain.remaining > row.spendLimit ? row.spendLimit : chain.remaining) : null,
    period_ends_at: chain?.periodEnd ? new Date(chain.periodEnd * 1000).toISOString() : null,
    expires_at: row.expiresAt.toISOString(),
    rules: row.rules
      ? {
          per_payment: formatAmount(BigInt(row.rules.perPayment)),
          approve_above: formatAmount(BigInt(row.rules.approveAbove)),
          payees: row.rules.payees,
        }
      : null,
    on_chain: chain ? { live: chain.live, revoked: chain.revoked } : null,
    last_used_at: row.lastUsedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
  }
}

// ── Making keys ─────────────────────────────────────────────────────────────────────────────

export interface AgentInput {
  label: string
  limit: bigint
  period: number
  expiresAt: Date
  perPayment: bigint
  approveAbove: bigint
  payees: 'anyone' | Address[]
}

function termsOf(input: { limit: bigint; period: number; expiresAt: Date; payees: 'anyone' | Address[] }): KeyTerms {
  return {
    token: settlementToken.address,
    limit: input.limit,
    period: input.period,
    expiry: Math.floor(input.expiresAt.getTime() / 1000),
    payees: input.payees,
  }
}

function checkTerms(terms: KeyTerms) {
  const problem = keyTermsProblem(terms)
  if (problem) throw new KovaError('invalid_request', problem)
}

/**
 * An AI agent's key: Ren makes it and seals it, and the owner's device puts it on-chain with the
 * terms below. Until it's there (confirmKey), it's pending and signs nothing.
 */
export async function createAgentKey(owner: Address, input: AgentInput): Promise<KeyRow> {
  requireKeys()
  const terms = termsOf(input)
  checkTerms(terms)
  if (input.perPayment <= 0n || input.perPayment > input.limit)
    throw new KovaError('invalid_request', 'A single payment can be at most the key’s whole limit.')
  if (input.approveAbove < 0n || input.approveAbove > input.perPayment)
    throw new KovaError('invalid_request', 'Ask-first can’t be above the most one payment can be.')
  const label = input.label.trim().slice(0, 40)
  if (!label) throw new KovaError('invalid_request', 'Give the agent a name.')

  const privateKey = generatePrivateKey()
  const id = uuidv7()
  const rules: schema.KeyRules = {
    perPayment: input.perPayment.toString(),
    approveAbove: input.approveAbove.toString(),
    payees: input.payees === 'anyone' ? 'anyone' : input.payees.map((p) => getAddress(p)),
  }
  const [row] = await db
    .insert(schema.walletKeys)
    .values({
      id,
      network: net,
      ownerAddress: lower(owner),
      kind: 'agent',
      label,
      keyId: lower(privateKeyToAccount(privateKey).address),
      keyType: 'secp256k1',
      token: lower(settlementToken.address),
      spendLimit: input.limit,
      period: input.period,
      expiresAt: input.expiresAt,
      rules,
      sealedKey: sealAgentKey(privateKey, id),
      status: 'pending',
    })
    .returning()
  if (!row) throw new KovaError('internal', 'The key wasn’t saved.')
  return row
}

/** What the owner's device signs to put a key on-chain: the same terms Ren checks it against. */
export function authorizationFor(row: KeyRow) {
  if (!row.keyId) throw new KovaError('conflict', 'Nobody has accepted this allowance yet.')
  return {
    key_id: getAddress(row.keyId),
    key_type: row.keyType,
    public_key: row.publicKey,
    token: getAddress(row.token),
    limit: formatAmount(row.spendLimit),
    limit_units: row.spendLimit.toString(),
    period: row.period,
    expiry: Math.floor(row.expiresAt.getTime() / 1000),
    payees: row.rules?.payees ?? 'anyone',
  }
}

const newAgentToken = () => `ren_agent_${randomBytes(24).toString('base64url')}`
const TOKEN_PREFIX = 18

/**
 * The owner's device says it put the key on-chain: Ren checks the chain has it, on terms no looser
 * than the ones Ren shows, and switches it on. An agent gets its token now, shown once.
 */
export async function confirmKey(
  owner: Address,
  row: KeyRow,
  txHash: Hex | undefined,
): Promise<{ row: KeyRow; agentToken?: string }> {
  requireKeys()
  if (row.status === 'revoked') throw new KovaError('conflict', 'This key was removed.')
  if (row.status !== 'pending') return { row }
  if (!row.keyId) throw new KovaError('conflict', 'Nobody has accepted this allowance yet.')
  const chain = await onChainKey(owner, getAddress(row.keyId), getAddress(row.token))
  if (!chain.live) throw new KovaError('conflict', 'Tempo doesn’t have this key yet. Try again in a moment.')
  const wanted = Math.floor(row.expiresAt.getTime() / 1000)
  if (Math.abs(chain.expiry - wanted) > 300 || chain.remaining > row.spendLimit)
    throw new KovaError('invalid_request', 'The key on Tempo doesn’t match what you set. Make it again.')

  const agentToken = row.kind === 'agent' ? newAgentToken() : undefined
  const [updated] = await db
    .update(schema.walletKeys)
    .set({
      status: 'active',
      authorizedTxHash: txHash ?? null,
      ...(agentToken ? { tokenPrefix: agentToken.slice(0, TOKEN_PREFIX), tokenHash: tokenHash(agentToken) } : {}),
      inviteHash: null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.walletKeys.id, row.id), eq(schema.walletKeys.status, 'pending')))
    .returning()
  if (!updated) return { row: (await keyRow(row.id)) as KeyRow }
  return { row: updated, ...(agentToken ? { agentToken } : {}) }
}

/** A new token for an agent; the old one stops working at once. */
export async function replaceAgentToken(row: KeyRow): Promise<string> {
  if (row.kind !== 'agent') throw new KovaError('invalid_request', 'Only an agent’s key has a token.')
  if (row.status === 'pending' || row.status === 'revoked')
    throw new KovaError('conflict', 'This key isn’t on Tempo.')
  const token = newAgentToken()
  await db
    .update(schema.walletKeys)
    .set({ tokenPrefix: token.slice(0, TOKEN_PREFIX), tokenHash: tokenHash(token), updatedAt: new Date() })
    .where(eq(schema.walletKeys.id, row.id))
  return token
}

// ── Freezing and removing ───────────────────────────────────────────────────────────────────

/**
 * Freeze: Ren stops signing for the key at once, before the owner's device sets its limit to zero
 * on-chain. Unfreeze: the device sets the limit back, and Ren checks the chain before trusting it.
 */
export async function setFrozen(owner: Address, row: KeyRow, frozen: boolean): Promise<KeyRow> {
  if (row.status === 'revoked') throw new KovaError('conflict', 'This key was removed.')
  if (row.status === 'pending') throw new KovaError('conflict', 'This key isn’t on Tempo yet.')
  if (!frozen && row.keyId) {
    const chain = await onChainKey(owner, getAddress(row.keyId), getAddress(row.token))
    if (!chain.live) throw new KovaError('conflict', 'This key isn’t on Tempo any more.')
    if (chain.remaining === 0n && !chain.periodEnd)
      throw new KovaError('conflict', 'Its limit on Tempo is still zero. Try again in a moment.')
  }
  const [updated] = await db
    .update(schema.walletKeys)
    .set({ status: frozen ? 'frozen' : 'active', updatedAt: new Date() })
    .where(eq(schema.walletKeys.id, row.id))
    .returning()
  return updated as KeyRow
}

/**
 * Removing a key is for good. Ren forgets an agent's key and token at once, so it can't sign
 * again whatever happens on-chain; the owner's device revokes it on Tempo, which can't be undone.
 */
export async function revokeKey(row: KeyRow, txHash: Hex | undefined): Promise<KeyRow> {
  const [updated] = await db
    .update(schema.walletKeys)
    .set({
      status: 'revoked',
      sealedKey: null,
      tokenPrefix: null,
      tokenHash: null,
      inviteHash: null,
      ...(txHash ? { revokedTxHash: txHash } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.walletKeys.id, row.id))
    .returning()
  return updated as KeyRow
}

// ── Allowances ──────────────────────────────────────────────────────────────────────────────

export interface AllowanceInput {
  label: string
  limit: bigint
  period: number
  expiresAt: Date
}

/**
 * An allowance starts as an invite: its terms and a link. Whoever opens the link first, in their
 * own Ren wallet, makes the key on their phone and claims it; the owner then puts it on-chain.
 */
export async function createAllowance(owner: Address, input: AllowanceInput): Promise<{ row: KeyRow; code: string }> {
  requireKeys()
  checkTerms(termsOf({ ...input, payees: 'anyone' }))
  const label = input.label.trim().slice(0, 40)
  if (!label) throw new KovaError('invalid_request', 'Say who it’s for.')
  const code = randomBytes(12).toString('base64url')
  const [row] = await db
    .insert(schema.walletKeys)
    .values({
      id: uuidv7(),
      network: net,
      ownerAddress: lower(owner),
      kind: 'allowance',
      label,
      keyType: 'secp256k1',
      token: lower(settlementToken.address),
      spendLimit: input.limit,
      period: input.period,
      expiresAt: input.expiresAt,
      inviteHash: await hashSecret(code),
      status: 'pending',
    })
    .returning()
  if (!row) throw new KovaError('internal', 'The allowance wasn’t saved.')
  // The code's first characters find the row; the hash proves the rest.
  const [withLookup] = await db
    .update(schema.walletKeys)
    .set({ tokenPrefix: `inv_${code.slice(0, 10)}` })
    .where(eq(schema.walletKeys.id, row.id))
    .returning()
  return { row: withLookup as KeyRow, code }
}

async function inviteRow(code: string): Promise<KeyRow> {
  if (!/^[A-Za-z0-9_-]{16}$/.test(code)) throw new KovaError('not_found', 'This allowance link isn’t right.')
  const row = await db.query.walletKeys.findFirst({ where: eq(schema.walletKeys.tokenPrefix, `inv_${code.slice(0, 10)}`) })
  if (!row?.inviteHash || !(await secretMatches(code, row.inviteHash)))
    throw new KovaError('not_found', 'This allowance link isn’t right, or it was already used.')
  if (row.createdAt.getTime() + INVITE_TTL_MS < Date.now())
    throw new KovaError('conflict', 'This allowance link has run out. Ask for a new one.')
  return row
}

/** What an invite offers, for the person who opened the link. */
export async function inviteFor(code: string) {
  const row = await inviteRow(code)
  return {
    object: 'allowance_invite',
    from: getAddress(row.ownerAddress),
    label: row.label,
    limit: formatAmount(row.spendLimit),
    period: periodName(row.period),
    expires_at: row.expiresAt.toISOString(),
    claimed: Boolean(row.holderAddress),
  }
}

/** The person accepts: their phone made a key for it, and their wallet is where they'll see it. */
export async function claimAllowance(
  code: string,
  input: { holder: Address; holderName: string | undefined; keyId: Address; keyType: 'secp256k1' | 'p256'; publicKey?: Hex },
): Promise<KeyRow> {
  const row = await inviteRow(code)
  if (row.holderAddress) throw new KovaError('conflict', 'Someone already accepted this allowance.')
  if (isAddressEqual(input.holder, row.ownerAddress as Address))
    throw new KovaError('invalid_request', 'This is your own allowance. Send the link to the person it’s for.')
  const [updated] = await db
    .update(schema.walletKeys)
    .set({
      holderAddress: lower(input.holder),
      holderName: input.holderName?.trim().slice(0, 40) || null,
      keyId: lower(input.keyId),
      keyType: input.keyType,
      publicKey: input.publicKey ?? null,
      tokenPrefix: null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.walletKeys.id, row.id), eq(schema.walletKeys.status, 'pending')))
    .returning()
  if (!updated) throw new KovaError('conflict', 'Someone already accepted this allowance.')
  return updated
}

// ── Agents' payments ────────────────────────────────────────────────────────────────────────

export async function paymentsOf(keyIds: string[], limit = 50): Promise<KeyPaymentRow[]> {
  if (keyIds.length === 0) return []
  return db.query.keyPayments.findMany({
    where: inArray(schema.keyPayments.walletKeyId, keyIds),
    orderBy: [desc(schema.keyPayments.createdAt)],
    limit,
  })
}

export function serializePayment(row: KeyPaymentRow, key?: KeyRow) {
  return {
    object: 'key_payment',
    id: row.id,
    key: key ? { id: key.id, label: key.label, kind: key.kind } : { id: row.walletKeyId },
    kind: row.kind,
    to: getAddress(row.recipient),
    amount: formatAmount(row.amount),
    origin: row.origin,
    url: row.url,
    description: row.description,
    status: row.status,
    reason: row.reason,
    tx_hash: row.txHash,
    created_at: row.createdAt.toISOString(),
    decided_at: row.decidedAt?.toISOString() ?? null,
  }
}

export { DAY, nowS, WEEK }
