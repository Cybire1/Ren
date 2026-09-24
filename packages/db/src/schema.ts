import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Money is stored in TIP-20 base units (6 decimals) as bigint. Postgres bigint tops out at
 * ~9.2e18, i.e. ~9.2 trillion dollars, so it cannot overflow in practice. Never use floats.
 */
const amount = (name: string) => bigint(name, { mode: 'bigint' })
const address = (name: string) => text(name)
const id = () => uuid('id').primaryKey()
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' })

export const network = pgEnum('network', ['mainnet', 'testnet'])
export const currency = pgEnum('currency', ['USDC', 'pathUSD', 'USDT0'])

// --- Accounts -------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: id(),
    /** Tempo account address, derived from the user's passkey public key. */
    tempoAddress: address('tempo_address').notNull(),
    network: network('network').notNull(),
    passkeyCredentialId: text('passkey_credential_id'),
    passkeyPublicKey: text('passkey_public_key'),
    displayName: text('display_name'),
    phone: text('phone'),
    status: text('status').notNull().default('active'), // active | blocked
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_address_network_idx').on(t.tempoAddress, t.network)],
)

export const merchants = pgTable(
  'merchants',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    /** Where payments settle. Kova never custodies: funds land here directly. */
    settlementAddress: address('settlement_address').notNull(),
    network: network('network').notNull(),
    /** Registered virtual-address master id, when the merchant supports per-intent addresses. */
    virtualMasterId: integer('virtual_master_id'),
    ownerUserId: uuid('owner_user_id').references(() => users.id),
    country: text('country').notNull().default('NG'),
    category: text('category'),
    status: text('status').notNull().default('active'), // active | suspended
    /** Marks demo/test merchants so public metrics can separate real activity. */
    isTest: boolean('is_test').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('merchants_slug_idx').on(t.slug)],
)

export const terminals = pgTable(
  'terminals',
  {
    id: id(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    name: text('name').notNull(),
    /** Free-form device identity (model, serial) for support and fraud review. */
    device: jsonb('device').$type<Record<string, unknown>>(),
    status: text('status').notNull().default('active'), // active | disabled
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('terminals_merchant_idx').on(t.merchantId)],
)

/**
 * A short-lived code that pairs a phone as a merchant's terminal. The merchant creates it in
 * the dashboard; the phone redeems it once for its own device key. Only the code's hash is
 * stored.
 */
export const terminalPairings = pgTable(
  'terminal_pairings',
  {
    id: id(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    terminalId: uuid('terminal_id').references(() => terminals.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('terminal_pairings_code_idx').on(t.codeHash)],
)

// --- Payment credentials --------------------------------------------------

export const credentialType = pgEnum('credential_type', ['card', 'phone', 'agent'])

/**
 * A payment credential: a physical card, a phone's secure-element key, or an agent key.
 * All three are the same thing on Tempo — a P-256 access key on the user's account.
 */
export const credentials = pgTable(
  'credentials',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    type: credentialType('type').notNull(),
    label: text('label'),
    /** Tempo access key id: last20(keccak256(X || Y)). */
    keyId: address('key_id').notNull(),
    /** Uncompressed P-256 public key (0x04 || X || Y). The private key never leaves the chip. */
    publicKey: text('public_key').notNull(),
    network: network('network').notNull(),
    /** On-chain expiry of the access key. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /** active | frozen (limit set to 0) | revoked (permanent; key id can never be reused) */
    status: text('status').notNull().default('active'),
    /** Transaction that authorized the key on-chain. */
    authorizedTxHash: text('authorized_tx_hash'),
    /** Last four of the printed card number, for support. Never a key. */
    lastFour: text('last_four'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('credentials_key_network_idx').on(t.keyId, t.network),
    index('credentials_user_idx').on(t.userId),
  ],
)

/** Spending rules Kova enforces off-chain, on top of the access key's on-chain limits. */
export const policies = pgTable(
  'policies',
  {
    id: id(),
    credentialId: uuid('credential_id').references(() => credentials.id),
    userId: uuid('user_id').references(() => users.id),
    /** { perTransaction, perDay, perMonth, approvalThreshold, merchants, categories, hours } */
    rules: jsonb('rules').$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('policies_credential_idx').on(t.credentialId)],
)

// --- Payments -------------------------------------------------------------

export const intentStatus = pgEnum('intent_status', [
  'requires_payment',
  'processing',
  'paid',
  'held',
  'failed',
  'canceled',
  'expired',
])

export const paymentIntents = pgTable(
  'payment_intents',
  {
    id: id(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    terminalId: uuid('terminal_id').references(() => terminals.id),
    amount: amount('amount').notNull(),
    currency: currency('currency').notNull(),
    tokenAddress: address('token_address').notNull(),
    network: network('network').notNull(),
    /** Where the payer sends: the merchant address, or a per-intent virtual address. */
    payTo: address('pay_to').notNull(),
    /** The 32-byte Kova memo carried by the settling transfer. */
    memo: text('memo').notNull(),
    status: intentStatus('status').notNull().default('requires_payment'),
    /** Merchant's own order reference. */
    reference: text('reference'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    isTest: boolean('is_test').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('intents_merchant_created_idx').on(t.merchantId, t.createdAt),
    index('intents_status_idx').on(t.status),
    uniqueIndex('intents_memo_idx').on(t.memo),
    index('intents_pay_to_idx').on(t.payTo),
  ],
)

export const payments = pgTable(
  'payments',
  {
    id: id(),
    intentId: uuid('intent_id')
      .notNull()
      .references(() => paymentIntents.id),
    txHash: text('tx_hash').notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }),
    payerAddress: address('payer_address').notNull(),
    /** Which credential signed, when Kova submitted it. Null for outside wallets. */
    credentialId: uuid('credential_id').references(() => credentials.id),
    amount: amount('amount').notNull(),
    tokenAddress: address('token_address').notNull(),
    /** paid | held | failed */
    status: text('status').notNull(),
    gasUsed: bigint('gas_used', { mode: 'bigint' }),
    /** What Kova paid in fees for sponsoring, in base units. */
    feePaid: amount('fee_paid'),
    feePayerAddress: address('fee_payer_address'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('payments_tx_idx').on(t.txHash), index('payments_intent_idx').on(t.intentId)],
)

export const refunds = pgTable(
  'refunds',
  {
    id: id(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    amount: amount('amount').notNull(),
    memo: text('memo').notNull(),
    reason: text('reason'),
    txHash: text('tx_hash'),
    /** pending | sent | confirmed | failed */
    status: text('status').notNull().default('pending'),
    createdAt: createdAt(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (t) => [index('refunds_payment_idx').on(t.paymentId)],
)

/**
 * Double-entry ledger. Every confirmed movement writes balanced rows, so merchant balances
 * and Kova's fee spend are derived, never edited in place.
 */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: id(),
    /** e.g. "merchant:<uuid>", "user:<uuid>", "kova:fees", "external". */
    account: text('account').notNull(),
    direction: text('direction').notNull(), // debit | credit
    amount: amount('amount').notNull(),
    currency: currency('currency').notNull(),
    refType: text('ref_type').notNull(), // payment | refund | fee | payout
    refId: uuid('ref_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('ledger_account_idx').on(t.account, t.createdAt),
    uniqueIndex('ledger_ref_account_dir_idx').on(t.refType, t.refId, t.account, t.direction),
  ],
)

// --- Developer surface ----------------------------------------------------

export const apiKeys = pgTable(
  'api_keys',
  {
    id: id(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    name: text('name').notNull(),
    /** Visible prefix, e.g. "kova_test_a1b2". The secret itself is only stored hashed. */
    prefix: text('prefix').notNull(),
    secretHash: text('secret_hash').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    /** Set on a paired phone's device key: it can take payments, never manage the shop. */
    terminalId: uuid('terminal_id').references(() => terminals.id),
    isTest: boolean('is_test').notNull().default(true),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('api_keys_prefix_idx').on(t.prefix)],
)

/** Idempotency records, so a retried POST can never create a second payment. */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: id(),
    apiKeyId: uuid('api_key_id')
      .notNull()
      .references(() => apiKeys.id),
    key: text('key').notNull(),
    /** Hash of the request body: the same key with a different body is an error. */
    requestHash: text('request_hash').notNull(),
    statusCode: integer('status_code'),
    response: jsonb('response').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('idempotency_key_idx').on(t.apiKeyId, t.key)],
)

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: id(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    url: text('url').notNull(),
    /** Signing secret (whsec_...). Deliveries are HMAC-SHA256 signed over "timestamp.body". */
    secret: text('secret').notNull(),
    events: jsonb('events').$type<string[]>().notNull(),
    status: text('status').notNull().default('active'), // active | disabled
    createdAt: createdAt(),
  },
  (t) => [index('webhook_endpoints_merchant_idx').on(t.merchantId)],
)

/** Append-only event log. Webhook deliveries are generated from it (outbox pattern). */
export const events = pgTable(
  'events',
  {
    id: id(),
    merchantId: uuid('merchant_id').references(() => merchants.id),
    type: text('type').notNull(), // payment_intent.paid, refund.confirmed, ...
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('events_merchant_created_idx').on(t.merchantId, t.createdAt)],
)

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: id(),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => webhookEndpoints.id),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    status: text('status').notNull().default('pending'), // pending | delivered | failed
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    responseStatus: integer('response_status'),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('deliveries_due_idx').on(t.status, t.nextAttemptAt),
    uniqueIndex('deliveries_endpoint_event_idx').on(t.endpointId, t.eventId),
  ],
)

// --- Operations -----------------------------------------------------------

/** Cursor for the chain watcher, so restarts never miss or double-count logs. */
export const watcherState = pgTable('watcher_state', {
  network: network('network').primaryKey(),
  lastBlock: bigint('last_block', { mode: 'bigint' }).notNull(),
  updatedAt: updatedAt(),
})

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    actorType: text('actor_type').notNull(), // user | merchant | api_key | system
    actorId: text('actor_id'),
    action: text('action').notNull(), // credential.frozen, refund.created, ...
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_target_idx').on(t.targetType, t.targetId, t.createdAt)],
)

// --- Catalogue, stalls and orders -------------------------------------------

/**
 * Photos a shop uploads, for items and stall covers. They are resized on the phone before
 * upload (a few hundred KB at most), so Postgres holds them comfortably for now; move them to
 * object storage when that stops being true.
 */
export const images = pgTable(
  'images',
  {
    id: id(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    contentType: text('content_type').notNull(),
    bytes: bytea('bytes').notNull(),
    size: integer('size').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('images_merchant_idx').on(t.merchantId)],
)

/** One list of what a shop sells, shared by its stalls, its till and barcode scanning. */
export const catalogItems = pgTable(
  'catalog_items',
  {
    id: id(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    name: text('name').notNull(),
    description: text('description'),
    /** In dollars, base units. What a customer pays is always priced from here, server side. */
    price: amount('price').notNull(),
    imageId: uuid('image_id').references(() => images.id),
    /** EAN or UPC, digits only, as printed under the bars. */
    barcode: text('barcode'),
    soldOut: boolean('sold_out').notNull().default(false),
    position: integer('position').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('catalog_items_merchant_idx').on(t.merchantId),
    uniqueIndex('catalog_items_barcode_idx')
      .on(t.merchantId, t.barcode)
      .where(sql`${t.barcode} is not null and ${t.archivedAt} is null`),
  ],
)

/** A shop's pocket storefront, public at /s/<slug>. */
export const stalls = pgTable(
  'stalls',
  {
    id: id(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    tagline: text('tagline'),
    coverImageId: uuid('cover_image_id').references(() => images.id),
    open: boolean('open').notNull().default(true),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('stalls_slug_idx').on(t.slug), index('stalls_merchant_idx').on(t.merchantId)],
)

/** Which catalogue items a stall shows, in its order. */
export const stallItems = pgTable(
  'stall_items',
  {
    stallId: uuid('stall_id')
      .notNull()
      .references(() => stalls.id),
    itemId: uuid('item_id')
      .notNull()
      .references(() => catalogItems.id),
    position: integer('position').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.stallId, t.itemId] })],
)

export const orderSource = pgEnum('order_source', ['stall', 'till'])

export interface OrderLine {
  item_id: string
  name: string
  /** Dollars, as a decimal string, at the moment of checkout. */
  unit_price: string
  quantity: number
}

/**
 * What was bought: a stall order or a till sale. Its payment intent stays the source of truth
 * for the money; the order keeps the items, the buyer's name and note, and whether it has been
 * handed over.
 */
export const orders = pgTable(
  'orders',
  {
    id: id(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    intentId: uuid('intent_id')
      .notNull()
      .references(() => paymentIntents.id),
    stallId: uuid('stall_id').references(() => stalls.id),
    source: orderSource('source').notNull(),
    /** A snapshot at checkout, so later price changes never rewrite an order. */
    lines: jsonb('lines').$type<OrderLine[]>().notNull(),
    customerName: text('customer_name'),
    note: text('note'),
    /** The buyer sent the link to someone else to pay. */
    payForMe: boolean('pay_for_me').notNull().default(false),
    collectedAt: timestamp('collected_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('orders_intent_idx').on(t.intentId),
    index('orders_merchant_created_idx').on(t.merchantId, t.createdAt),
    index('orders_stall_idx').on(t.stallId),
  ],
)
