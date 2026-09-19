# Tempo: API Platform, Webhooks & Data

Tempo runs a hosted **Tempo API** at `https://api.tempo.xyz`. It covers most of the backend infrastructure Kova would otherwise build or rent: indexed REST data (transfers, transactions, activities, balances, tokens), **signed webhooks** (`token:transfer`, `transaction:included`, `log:emitted`, …), a read-only **SQL indexer** (`tidx`), a hosted **fee-payer relay** (`/rpc/sponsor`), a best-effort **JSON-RPC passthrough**, a hosted **MCP server**, **Routes** (cross-chain deposit quotes and addresses) and **Earn** (vault data). Most read endpoints also work without a key at 20 req/min per IP. The catch is that the management plane is gated. The API Console is **invite-only**. `webhooks:read`, `webhooks:write` and `routes:write` scopes are **not self-serve**. Production sponsorship requires **active Stripe billing**. For the hackathon, Kova should confirm payments from the synchronous receipt of transactions it submits, detect inbound payments with its own WebSocket log subscriber, and reconcile against `/v1/transfers`. It should self-host fee sponsorship with the relay handler or a viem fee-payer account. Tempo webhooks and the hosted Fee Payer API become upgrades once Console access and scopes are granted.

> Evidence base: official docs downloaded 2026-09-19, the live OpenAPI spec (`https://api.tempo.xyz/openapi.json`), anonymous live probes of `api.tempo.xyz` on 2026-09-19 (labelled **Observed**), and the published `tapimo@0.15.1` package source (labelled **Inference (tapimo source)**; this is Tempo's API server/client package, but hosted configuration may differ).

## What Kova needs from this

- **Payment confirmation** for POS/app/agent payments in about 1 s, including payments Kova did not submit itself (e.g. an external wallet paying a merchant QR).
- **Merchant transaction feed and CSV export** with memo/intent matching, fee visibility and cursor-based sync.
- **Reconciliation**: an independent onchain record to diff against Kova's Postgres ledger.
- **Public metrics** (volume, tx count, unique users/merchants), verifiable and split real vs test.
- **Fee sponsorship** so users never hold a fee token, with policy caps that Kova controls.
- **RPC** with WebSocket for subscriptions, plus a fallback.
- **Compliance screening** of payers/payees for the risk layer.
- **No self-run node or indexer**, if the hosted services can cover it.

---

## 1. Tempo API basics

Sources: https://tempo.xyz/developers/docs/api/conventions, /api/authentication, /api/console, /api/console/api-keys, /api/console/projects-and-environments, /api/rate-limits, /api/errors, /api/pagination, /api/versioning-policy, /api/faq, https://api.tempo.xyz/openapi.json

**Base URL:** `https://api.tempo.xyz`. REST is under `/v1`, RPC under `/rpc`, MCP under `/mcp`. Select the chain per request with the `chainId` query param: `mainnet`/`4217` or `testnet`/`42431`. **If omitted, `chainId` defaults to mainnet.** A sandbox key steers an omitted `chainId` to testnet.

**Conventions:** addresses and hashes are returned lowercase. Amounts are **decimal strings in base units** (never floats). Timestamps are ISO-8601 UTC. Opt-in fields use `include=` (for example `include=memo,totalCount`). Every response carries a `tempo-request-id` header, which also appears as `requestId` in error bodies.

**Authentication** (OpenAPI `securitySchemes`):

| Method | Form | Notes |
|---|---|---|
| Header (canonical) | `tempo-api-key: <key>` | The typed client uses this |
| Bearer | `Authorization: Bearer <key>` | Compatibility alternative |
| Query | `?key=<key>` | Supported, but the docs warn URLs get logged. Used by the sponsor URL |
| MPP pay-per-request | `Authorization: Payment <credential>` | For anonymous over-quota or paid endpoints (`402` + `WWW-Authenticate`) |
| Session | Cookie / SIWE (`POST /v1/auth/siwe/challenge`, `POST /v1/auth/siwe`) | Console/management only |

**Key formats:** production keys are `tempo:sk:…` and sandbox keys are `tempo_sandbox:sk:…`. A key is shown once and is fixed to its environment. Optional `allowedIps` accepts up to 100 IP/CIDR entries; a request from outside the list returns `403 api_key_ip_forbidden`. Rotate by creating a new key and then revoking the old one (`POST …/api-keys/{keyId}/rotate` also exists and requires a session).

**Scopes.** Observed from `GET /v1/scopes` (live). `selfServe=false` means Tempo must grant the scope:

| Scope | Grants | Self-serve |
|---|---|---|
| `data:read` | Public chain data: tokens, txs, transfers, blocks, receipts, and `/rpc` | yes |
| `indexer:query` | `GET /v1/indexer/query` | yes |
| `rpc-relay:read` | Fill and submit txs through the relay | yes |
| `rpc-relay:sponsor` | Sponsor fees through the relay as the managed fee payer | yes |
| `mpp:write` | `POST /v1/mpp/validate`, `/v1/mpp/broadcast` | yes |
| `routes:read` | Org route transfers, deposit addresses, deposits | yes |
| `routes:write` | Create route transfers and deposit addresses | **no** |
| `webhooks:read` / `webhooks:write` | Read / manage webhook subscriptions | **no** |
| `management:read` / `management:write` | Org, projects, keys, billing, usage | yes |
| `rewards:*`, `zone:<chainId>:read/write` | Rewards / private Zones | no |

**Projects and environments.** The hierarchy is Organization → Project → Environment (production/sandbox) → API key. A project can hold keys in both environments. Usage and billing are tracked separately per environment.

| | Production | Sandbox |
|---|---|---|
| Key prefix | `tempo:sk:` | `tempo_sandbox:sk:` |
| Chains | Any, including mainnet 4217 | **Non-mainnet only** (testnet 42431) |
| Default chain | mainnet | testnet |
| Billing / usage | Separate | Separate |

**Rate limits.** Fixed 1-minute windows. The **API-key** bucket is per key per scope, default **100 req/min** (can be raised). The **anonymous** bucket is per IP, **20 req/min**; Observed: `ratelimit-limit: 20`. Response headers are `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (unix seconds) and `RateLimit-Scope`. Over the limit you get `429` + `Retry-After`. On MPP-enabled endpoints an anonymous over-quota request gets `402 Payment Required` instead. `/rpc` and the REST reads **both draw from the `data:read` bucket** of a key.

**Error envelope:** `{"error":{"code","message","details":[{"message","path"}]},"requestId"}`. Branch on `error.code`. Examples: `query_invalid`, `address_invalid`, `chain_id_unsupported`, `api_key_missing`, `api_key_invalid`, `api_key_forbidden` (missing scope), `api_key_ip_forbidden`, `limit_exceeded` (e.g. webhook count), `webhooks_not_enabled`, `rate_limit_exceeded`, `payment_required`, `internal_error`, `upstream_error`. A `5xx` on a `POST` means the outcome is unknown, so reconcile before retrying.

**Pagination.** Cursor-based: pass `nextCursor` back as `cursor`; `nextCursor === null` is the only end signal. Page mode is also available (`page`, 1-indexed; do not mix with `cursor`, which gives `422`). `include=totalCount` returns a count capped at 10,000. **Endpoint limits override the general guide:** the pagination page says `limit` 5–200 and `page×limit ≤ 10,000`, but the reference for `/v1/transfers`, `/v1/transactions`, `/v1/addresses/{a}/activities` and balances says `limit` **5–50** and `page×limit ≤ 500`. Webhooks list: 5–50.

**Versioning.** The REST API is `/v1`. The versioning page warns: *"The Tempo API is under active development. Endpoints are not yet stable and may change without notice."* `/rpc` is outside the policy. Deprecations come with `Deprecation`/`Sunset` headers.

**Pricing / free tier:**
- Anonymous reads are free at 20 req/min/IP.
- There is **no public price list**; `tempo.xyz/pricing` returns 404 (Observed).
- Billing is Stripe-backed per org and environment (`GET/PATCH /v1/orgs/{orgId}/billing`). The billable `spend` is described as *"finalized fees plus in-flight fee caps"*, i.e. sponsorship. `spendLimit` is a monthly USD limit; `txFeeLimit` is a per-tx sponsorship cap in USD, and the platform default applies if unset. `GET …/billing/invoice-preview` shows the next invoice.
- Paid anonymous access goes through MPP. Observed: an anonymous indexer query returned `402` with an MPP `session` challenge of `amount: "100"` base units of pathUSD, i.e. **$0.0001/request**, with `suggestedDeposit` 0.01, on chain 4217.

**Sign-up.** Go to https://console.tempo.xyz and choose "Sign in with Tempo". Access is **invite-only; request it via https://tempo.xyz/contact/**. The flow is: create org → create project → switch to sandbox → add a payment method (needed for sponsorship) → create a key → select scopes → store the key.

---

## 2. Webhooks

Sources: https://tempo.xyz/developers/docs/api/webhooks, `openapi.json` (`CreateWebhookRequest`, `WebhookEventEnvelope`), `GET /v1/webhooks/event-types` (live), `tapimo@0.15.1` `dist/internal/Webhooks.js` and `WebhookDestination.js`.

**Event types.** These are exhaustive, from `WebhookSubscriptionEventType` and the live `/v1/webhooks/event-types`:

| Type | What fires it | Filters (single value unless noted) |
|---|---|---|
| `token:transfer` | Any TIP-20 `Transfer` log | `address` (sender or recipient), `recipient`, `sender`, `token`. **Plain strings only, no `in`** |
| `transaction:included` | A tx included in a block | `hash`, `address`, `from`, `to`, `txType`, `feeToken`, `nonceKey` accept `eq`/`in` (≤64)/`not`. `value`, `gasLimit`, `nonce`, `blockNumber`, `timestamp`, `validBefore`/`validAfter`, `callCount` accept `eq/gt/gte/lt/lte`. Also `input` (`selector`/`startsWith`/`eq`), `calls`, `includeCalls` (default true: `to`/`address` also match AA inner calls) |
| `log:emitted` | Any contract log (`filters` object required) | `address` (eq/in/not), `signature` (e.g. `event TransferWithMemo(address indexed from, address indexed to, uint256 amount, bytes32 indexed memo)`), `topic0..3` (eq/in ≤64/not), `args` (decoded args by name; requires `signature`), `blockNumber` |
| `block:created` | Every new block | `number`, `miner`, `proposer`, `gasUsed`, `gasLimit`, `timestamp` |
| `routes:deposit.updated` | A Routes deposit changed | `depositAddressId`, `recipient`, `status` |
| `routes:transfer.updated` | A Routes transfer changed | `id`, `status` |
| `ping` | Synthetic test from `POST /v1/webhooks/{id}/ping` | n/a |

**Subscription model.** Each subscription has one `eventType` and one `chainId` (`mainnet`/`testnet`/number), plus one `destination` and optional `filters` and `context` (`title`, `description`, `metadata` ≤20 k/v, echoed on every event). Omitting filters gives a firehose. Each `POST` creates a separate subscription with **its own secret**. Destinations are `{type:"url",url}` (HTTPS, signed), `{type:"slack",url}` or `{type:"betterstack",url,token}`. Subscription `status` is `active`/`paused`/`disabled`. There is a per-owner subscription cap (`403 limit_exceeded`). **Inference (tapimo source):** the default cap is `defaultMaxPerOwner = 100`. The same source says a new subscription starts at the **current RPC head, with no backfill**, and that MPP-payer-owned subscriptions have a 30-day TTL; anonymous creation was Observed to return `401 api_key_missing`.

**Payload.** The envelope is `{id: "evt_…", subscriptionId: "wh_…", chainId, createdAt, type, context?, data}`. Delivery headers are `tempo-signature`, `tempo-event-id` and `tempo-event-type`. The `token:transfer` data looks like this:
```json
{"address":"0x20c0…(token)","amount":"10000","blockNumber":1000002,"recipient":"0x9e39…","sender":"0xe768…",
 "timestamp":"2026-01-14T18:38:03.685Z","transactionHash":"0x3d24…","token":{"decimals":6,"symbol":"USDC"}}
```
The `token:transfer` payload has **no `memo` and no `logIndex`**. For memo matching, use `log:emitted` with the `TransferWithMemo` signature: its `data` includes `args`, `event`, `logIndex`, `topics` and `transactionHash`. Alternatively, look up `/v1/transfers?include=memo`. `transaction:included` data carries the full tx (`hash`, `sender`, `recipient`, `calls[]`, `feeToken`, `nonceKey`, `type` ∈ `legacy|eip1559|…|tempo`, `meta.rpc`).

**Signature verification.** The docs say: *"`tempo-signature`: An HMAC-SHA256 of the body using your webhook secret, formatted `t=<unix>,v1=<hex>`."* The secret is `whsec_…` and is returned once by the create call. **Inference (tapimo source `WebhookDestination.sign/verify`):** the signed string is `` `${t}.${rawBody}` `` (Stripe-style), the key is the UTF-8 bytes of the full secret string, the output is lowercase hex, and the tolerance is 300 s. Confirm this against a `ping` before relying on it.
```ts
import { createHmac, timingSafeEqual } from 'node:crypto'
export function verifyTempo(raw: string, header: string, secret: string, tolSec = 300) {
  const p = Object.fromEntries(header.split(',').map(kv => kv.split('=', 2)))
  const t = Number(p.t); if (!p.v1 || !Number.isFinite(t) || Math.abs(Date.now()/1e3 - t) > tolSec) return false
  const exp = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')
  return exp.length === p.v1.length && timingSafeEqual(Buffer.from(exp), Buffer.from(p.v1))
}
```
Because every subscription has its own secret, look the secret up by the (still untrusted) `subscriptionId`, then verify with it.

**Delivery guarantees:**
- Documented: at-least-once delivery ("the same event may be delivered more than once"), so dedupe on `tempo-event-id`/`id`.
- Documented: any 2xx acknowledges. A non-2xx, a timeout or a **redirect** is retried "with increasing delays". An endpoint that keeps failing is disabled.
- Documented: `failureCount` counts consecutive failures, and `lastDeliveryAt` is refreshed at most once a minute.
- Replay: `POST /v1/webhooks/{id}/deliveries/{deliveryId}/retry`. History: `GET /v1/webhooks/{id}/deliveries`.
- **Inference (tapimo source):** backoff is 5 s, 25 s, ~2 m, ~10 m, ~52 m, then hourly. The destination timeout is 10 s. The subscription **auto-disables after 10 consecutive failures** (`maxFailures = 10`). Delivery logs are retained for 7 days.
- Latency is **not documented**.

**Management endpoints.** Scopes: `webhooks:read` for reads, `webhooks:write` for writes; API key required.

| Endpoint | Purpose |
|---|---|
| `POST /v1/webhooks`, `GET /v1/webhooks` | Create / list (API key) |
| `GET/PATCH/DELETE /v1/webhooks/{id}` | Get / update URL, filters, `status` (pause, resume) / delete |
| `POST /v1/webhooks/{id}/ping` | Signed test event; returns `delivered`, `responseStatus`, `responseMs` |
| `GET /v1/webhooks/{id}/deliveries`, `POST …/deliveries/{deliveryId}/retry` | Audit / replay |
| `GET /v1/webhooks/event-types` | Catalog (public) |
| `/v1/orgs/{orgId}/webhooks…` | Same operations, session-authenticated (Console) |

**Testnet:** supported. Pass `chainId: "testnet"`; a sandbox key targets testnet.

**Evaluation: webhooks vs `eth_subscribe`.**

| | Tempo `token:transfer` webhook | Own WS `eth_subscribe("logs")` |
|---|---|---|
| Setup | Needs Console (invite-only) plus **non-self-serve** `webhooks:write` | None: `wss://rpc.tempo.xyz` (public) or a provider WS |
| Reliability | Retries, replay, dedupe ids, delivery log; no SLA; auto-disable risk | Kova owns reconnects and catch-up via `eth_getLogs` block ranges; public RPC has no SLA |
| Per-merchant scaling | One subscription per recipient (no `in`), cap ~100 (source default). `log:emitted` with `topic2: {in:[…64 padded addrs]}` scales further | One subscription can use a topic array of many addresses |
| Memo | Not in `token:transfer`; use `log:emitted` | Decode `TransferWithMemo` directly |
| Backfill | None (starts at head) | `eth_getLogs` over a range |
| Ops | Public HTTPS endpoint, HMAC verification | A long-lived process (not serverless-friendly) |

**Recommendation.** Do **not** make Tempo webhooks the *only* "payment received" signal.
1. For Kova-submitted payments (card tap, in-app, agent), the synchronous receipt from `eth_sendRawTransactionSync` is the confirmation. Tempo has deterministic Simplex BFT finality with ~0.5 s blocks, so the receipt is final.
2. For inbound payments Kova did not submit, run a small WS subscriber on `TransferWithMemo` and `Transfer` logs with `topic2` = merchant addresses, with `eth_getLogs` catch-up on reconnect.
3. Add Tempo `token:transfer` or `log:emitted` webhooks as a redundant, signed push channel once scopes are granted.
4. Run a reconciliation sweeper on `/v1/transfers` so no path is single-point.

---

## 3. Data endpoints for feed, analytics and reconciliation

Sources: https://tempo.xyz/developers/docs/api/transfers, /api/transactions, /api/transactions-and-transfers, /api/activities, /api/balances, /api/tokens, /api/verified-tokens, /api/indexer, /api/indexer-api (in `llms-full.txt`), https://github.com/tempoxyz/tidx (README). All need `data:read`, except the indexer (`indexer:query`). **Observed:** they work anonymously (e.g. `GET /v1/transfers?limit=5&include=memo` returned 200).

| Endpoint | Key params | Kova use |
|---|---|---|
| `GET /v1/transfers` | `address` (sender or recipient; alone) **or** `sender`/`recipient`, `token`, `blockNumber.from/.to`, `timestamp.from/.to`, `order=asc\|desc`, `include=memo,token.logoUri,token.verified,crossToken,totalCount`, `valuation.currency`, `limit` 5–50, `cursor` | **Merchant feed, CSV export, reconciliation.** Each row has `id` = `${txHash}-${logIndex}` (stable dedupe key), `sender`, `recipient`, `sourceAmount{baseUnits,decimals,formatted}`, `sourceToken`, `timestamp`, `blockNumber`, `transactionHash`, and `memo` (decoded **text** from `TransferWithMemo`) plus `attribution` (MPP service name) with `include=memo` |
| `GET /v1/transactions`, `/v1/transactions/receipts`, `/v1/transactions/{hash}`, `/v1/transactions/{hash}/receipt` | `address`, `sender`, `recipient`, **`feePayer`**, `feeToken`, `status`, block/time ranges, `include=receipt` | Audit sponsored txs (`feePayer` = Kova's sponsor address → sponsorship spend report) and tx status |
| `GET /v1/tokens/{token}/transactions` | `feePayer`, `feeToken`, ranges | Per-token tx list |
| `GET /v1/addresses/{address}/activities`, `GET /v1/transactions/{hash}/activities` | `type` (e.g. `transfer`, `swap`, `approval`, `access-key-created`, `spending-limit-updated`, `channel-*`; 60+ types), `sender`, `recipient`, `token`, `amount.from/.to`, `logs=true`, `group=true` | Consumer-app history ("Token transferred", `perspective` incoming/outgoing, `direction`, `memo`, `signer` = `self` or access-key address) |
| `GET /v1/addresses/{address}/balances`, `…/balances/{token}`, `…/valuation` | `verified`, `currency=USD`, `feeEligible`, `valuation.currency` | Merchant balance widget; reconciliation of ledger vs chain |
| `GET /v1/tokens`, `/v1/tokens/{token\|symbol}`, `/v1/tokens/{token}/holders`, `/v1/verified-tokens`, `/v1/tokenlist` | | Token metadata and an allowlist of accepted stablecoins |

Transactions are what a user submits; transfers are the 0..N token movements they cause. Use transfers for money movement and reconciliation.

**Indexer SQL API** (`GET /v1/indexer/query`, scope `indexer:query`, self-serve):
- **Params:** `sql` (SELECT only), `chainId`, `signature` (repeatable; exposes a decoded event as a virtual table), `engine` (auto by default; `clickhouse` for analytics), `live=true` (SSE re-run every block; not with clickhouse), `limit` (clamped 1–10,000 rows), `timeout_ms` (100–30,000).
- **Response:** `{ok, columns, rows, row_count, engine, query_time_ms}`. SQL errors return `422` with `{ok:false,error}`. The request deadline is 60 s (`504`).
- **Access:** **Observed:** anonymous queries return `402` MPP at $0.0001/req; with an API key they use the normal quota.
- **Engine and data model:** backed by `tidx`, which uses Postgres for hot and point reads plus live streaming, and ClickHouse for the full archive and analytics.
- **Base tables:** `blocks`, `txs` (`from`, `to`, `fee_token`, `calls`, `nonce_key`, …), `logs` (`address`, `selector`, `topics`, `data`), `receipts` (`status`, **`fee_payer`**).
- **ClickHouse tables** (`engine=clickhouse`): `token_transfers` (`block_num`, `block_timestamp`, `tx_hash`, `log_idx`, `token`, `from`, `to`, `amount`, `is_virtual_forward`), `token_transfer_stats` (per day and token: `transfer_count`, `volume`, `unique_senders`, `unique_recipients`), `token_balances`, `address_balances(_snapshot)`, `address_transfers`, `address_txs`, `token_holder_counts`, `token_supply`, `token_metadata`, `dex_*`, `contract_creations`.
- **Self-hosting:** possible with `docker run … ghcr.io/tempoxyz/tidx up`.

Example Kova metrics query. It is illustrative, uses tidx README column names, and **should be tested**:
```sql
-- engine=clickhouse ; merchant list injected by Kova
SELECT count() AS payments, toString(sum(amount)) AS volume_base_units,
       uniqExact(`from`) AS unique_payers, uniqExact(`to`) AS unique_merchants
FROM token_transfers
WHERE `to` IN ('0xmerchant1…','0xmerchant2…')
  AND `to` != '0xfeec000000000000000000000000000000000000'   -- FeeManager fee legs
  AND is_virtual_forward = 0                                  -- avoid double-counting virtual-address hops
  AND block_timestamp >= toDateTime('2026-09-20 00:00:00')
```

**Can the public metrics page be computed from the indexer?** Only partly. The indexer can **independently verify** onchain volume, counts and unique counterparties for a known set of Kova merchant addresses, or for memos with a Kova prefix via `signature=TransferWithMemo(...)`. It **cannot**:
- tell real from test activity on mainnet (team or demo wallets look like users);
- see testnet vs mainnet in one query (one `chainId` per query);
- know refunds, intents, agent vs NFC vs QR channel, or which address is a "user".

**Inference:** compute the metrics page from Kova's Postgres ledger, which carries `environment` (mainnet/testnet) and `is_internal`/`is_test` flags. Then publish tx hashes with explorer links, and run a nightly job that cross-checks totals against `/v1/transfers` or the indexer. Show "verified onchain" when they match.

---

## 4. Fee sponsorship: hosted Fee Payer API vs self-hosted relay

Sources: https://tempo.xyz/developers/docs/api/fee-payer (in `llms-full.txt`), /server/relay-handler, /guide/payments/sponsor-user-fees, /api/console/usage-and-billing, /api/billing, /api/usage, https://tempo.xyz/developers/docs/protocol/upgrades/t7

**Hosted Fee Payer API**
- **Endpoint:** a JSON-RPC relay that fills, sponsors and broadcasts Tempo transactions at `https://api.tempo.xyz/rpc/sponsor`. Authenticate with an API key, e.g. `…/rpc/sponsor?key=tempo_sandbox:sk:…`. Scopes: `rpc-relay:sponsor` (and `rpc-relay:read`), both self-serve.
- **Client:** viem `withRelay(http(), http(sponsorUrl))` in `viem/tempo` (verified exported in `viem@2.56.8`), then send with `feePayer: true`.
- **Environments:** sandbox keys give testnet and production keys give mainnet. The guide says to add a payment method **even in sandbox**. *"Production fee sponsorship requires an active billing source."*
- **Limits:**
  - Org-level monthly `spendLimit` (USD).
  - Per-transaction `txFeeLimit` ("maximum transaction fee the API may sponsor for one transaction"; platform default unpublished).
  - Tempo platform limits.
  - Refusal reasons include `billing_past_due`, `billing_required`, `fee_token_unsupported`, `spend_limit_exceeded` and `tx_fee_limit_exceeded`.
- **Monitoring:** `GET /v1/orgs/{orgId}/usage/sponsorships` and the Console Usage page.
- **Billing:** actual fees ("finalized fees plus in-flight fee caps"). Any markup is undocumented.

**Public testnet fee payer:** `https://sponsor.moderato.tempo.xyz`. No key; for demos and testnet only.

**Self-hosted Relay & Fee Payer Handler** (npm `tapimo`, v0.15.1):
- **Setup:** `Handler.relay({ apiKey?, feePayer: { account, feeToken?, name?, url?, validate?, onSponsored? }, features?: 'all', autoSwap?, cache?, onRequest?, path?, resolveTokens?, getClient?, multisig?, cors?, headers? })`.
- **What it does:** proxies JSON-RPC and enriches `eth_fillTransaction` with sponsorship, fee-token selection, balance diffs, fee estimates, auto-swap via the Stablecoin DEX and `requireFunds`. It signs the `feePayerSignature` for approved requests and also handles `eth_signRawTransaction`, `eth_sendRawTransaction` and `eth_sendRawTransactionSync`.
- **Frameworks:** exposes `handler.fetch` for Bun, Deno, Hono, Next.js and Elysia, and `handler.listener` for Node and Express.
- **Policy:** `validate(request)` returns `false` or a named refusal. With no `validate`, it sponsors **everything** it receives.
- **Client side:** the app points `withRelay`, or `Provider.create({ relay })` from the `accounts` package, at Kova's relay URL.

| | Hosted Fee Payer API | Self-hosted `Handler.relay` | Public testnet sponsor |
|---|---|---|---|
| Access | Console invite plus Stripe billing | Just npm; runs in Kova's backend | Open |
| Chains | Sandbox → testnet; prod → mainnet | Both | Testnet |
| Who holds fee funds | Tempo (bills Kova) | Kova's hot fee-payer key (fund it with pathUSD/USDC.e) | Tempo |
| Policy | Org spend limit + per-tx cap; no documented per-sender rules | Arbitrary code (`validate`), Kova auth, rate limits | None |
| Ops risk | Key must stay server-side (`?key=` URL) | Key custody, funding top-ups | Demo only |

Cost scale: after T7 (active on mainnet) the base-fee cap for a 50k-gas TIP-20 transfer is about **$0.0006** (floor $0.00003).

**Recommendation for Kova.** Self-host sponsorship inside the Kova backend, using `Handler.relay` from `tapimo/server` or simply a viem local `feePayer` account where the backend builds the tx. Put the fee-payer key in KMS or secret storage. The `validate` function should check four things: the sender is an authenticated Kova user or card, the call targets an allowlisted TIP-20 `transfer`/`transferWithMemo`, the fee is at or below a cap, and the per-user rate is within limits. Use `sponsor.moderato.tempo.xyz` for early testnet work. Move to the hosted Fee Payer API only if Console access arrives and Kova wants Tempo-managed fee funds and usage reports.

---

## 5. JSON-RPC

Sources: https://tempo.xyz/developers/docs/api/json-rpc (in `llms-full.txt`), /api/rpc, /protocol/rpc, /quickstart/connection-details, /quickstart/evm-compatibility, /ecosystem/node-infrastructure

| Endpoint | Mainnet | Testnet | Notes |
|---|---|---|---|
| Public RPC (HTTP) | `https://rpc.tempo.xyz` | `https://rpc.moderato.tempo.xyz` | No key; no published SLA or limits |
| Public RPC (WS) | `wss://rpc.tempo.xyz` | `wss://rpc.moderato.tempo.xyz` | **Observed:** `eth_subscribe("logs")` returns a subscription id on mainnet WS |
| Tempo API RPC | `https://api.tempo.xyz/rpc` (or `/rpc/mainnet`, `/rpc/4217`) | `https://api.tempo.xyz/rpc/testnet` | `data:read` bucket (100/min/key default). **Best-effort: "No compatibility, latency, availability, or data-freshness guarantees."** **Observed:** no WebSocket upgrade |
| Node providers | Alchemy, Quicknode, Chainstack, Conduit, dRPC (free tier, flat plans from $10), Blockdaemon, Validation Cloud, Luganodes, SenseiNode | varies | Commercial SLAs |

- **Methods:** standard `eth_`, `net_`, `web3_`, `txpool_`, `trace_`, `debug_` (availability depends on the node), plus `eth_fillTransaction`, `eth_sendRawTransactionSync` (returns the receipt, or times out), `eth_simulateV1` and `eth_getBlockAccessList`.
- **Tempo namespaces:** `tempo_forkSchedule` (all nodes); `tempo_fundAddress` (faucet-enabled testnet: mints pathUSD, AlphaUSD, BetaUSD and ThetaUSD); `consensus_getFinalization`, `consensus_getLatest`, `consensus_subscribe` (validators only; WS), `consensus_getIdentityTransitionProof`; `admin_validatorKey` (self-hosted only).
- **Modified `eth_`:** `eth_getBalance` always returns the constant `0x9612…c9b2`, because there is no native token; use TIP-20 `balanceOf`. `eth_estimateGas` uses the fee-token balance of the effective fee payer. `eth_sendRawTransaction` accepts Tempo transactions, which are type `0x76`. The `/protocol/rpc` page says `0x54`, a doc error; the spec and webhook filters say `0x76`.

---

## 6. Typed client, MCP server, MPP API

Sources: https://tempo.xyz/developers/docs/api/typed-client, /api/mcp, /guide/using-tempo-with-ai, /api/mpp; `npm view tapimo`.

**Typed client** (`npm i tapimo`, 0.15.1, Hono RPC-style):
```ts
import { Client } from 'tapimo'
const client = Client.create({ apiKey: process.env.TEMPO_API_KEY })   // sends tempo-api-key
const r = await client.v1.transfers.$get({ query: { address: merchant, include: ['memo'], limit: 50 } })
```
Status-narrowed responses and `client.rpc[':chain{mainnet|testnet|[0-9]+}?'].$post(...)` give typed RPC passthrough. The query-shape example above is **Inference**; check the generated types.

**MCP:**
- **Docs server for coding agents:** `claude mcp add --transport http tempo https://mcp.tempo.xyz`, with tools `search`, `find_pages`, `read_page`, `code`. There is also a plugin: `claude plugin marketplace add tempoxyz/docs` and `claude plugin install docs@tempo`.
- **Data MCP:** `POST https://api.tempo.xyz/mcp`, stateless streamable HTTP. It requires `Accept: application/json, text/event-stream`. Anonymous use is allowed at 100 req/min; `Authorization: Bearer <key>` unlocks protected tools.
- **Observed tools:** meta-tools `search_tools`, `get_tool_details`, `call_read_tool` and `call_write_tool` front about 70+ tools. These include `docs_*`, `rpc_chain`, `rpc_post`, `v1_transfers…`, `v1_addresses_address_activities`, `v1_indexer_query`, `v1_routes_*` and org webhook tools.
- **Kova use:** give Kova's agent features read-only chain lookups for free. Keep payment execution in Kova's own API so spending policy applies.

**MPP API** (scope `mpp:write`):
- `POST /v1/mpp/validate` checks a completed MPP credential (challenge + payload) **and screens payment parties** without settling.
- `POST /v1/mpp/broadcast` validates, screens and submits. It supports the `Idempotency-Key` header and returns `receipt{method,reference(tx hash),timestamp,externalId?}`.
- Errors come back as `{success:false,error.code}` with `unsupported|policy_denied|invalid_payment|insufficient_funds|expired|already_used|screen_rejected|simulation_failed|broadcast_failed|temporarily_unavailable|unknown`.
- Useful if Kova acts as an MPP server for agent payments; MPP itself is covered in another section.

---

## 7. Routes API: funding a Kova Pay wallet from other chains

Sources: https://tempo.xyz/developers/docs/api/routes/chains, /routes/providers, /routes/quotes, /routes/deposit-addresses, /routes/transfers, /api/faq; live calls (Observed 2026-09-19).

- **Supported source chains and tokens** (Observed, `GET /v1/routes/chains`): Ethereum, BNB Chain, Base and Polygon (USDC, USDT); Solana (USDC, USDT); Tron (USDT). The destination is Tempo mainnet `eip155:4217`, and the default destination token is **USDC.e**. No testnet routes were seen.
- **Providers** (`GET /v1/routes/providers`): Across, Relay, USDT0 Legacy Mesh, Rhino, Squid, Stargate, Symbiosis.
- **Quotes** (`GET /v1/routes/quotes?sourceChain=base&sourceToken=USDC&sourceAmount=10000000`, public, `data:read`): the result compares providers.
  - Observed for 10 USDC Base→Tempo: Stargate 10.000000, Across 9.998709, Squid 9.99437, Rhino 9.982997, Relay 9.978424, Symbiosis 9.496477 USDC.e.
  - Fees are embedded in `destinationAmount`; any explicit `fees[]` are listed separately.
- **Deposit addresses** (`POST /v1/routes/deposit-addresses`, **`routes:write`, not self-serve**, `idempotency-key` required):
  - Body: `sourceChain`, `sourceToken`, `destinationToken`, `recipient` (the user's Tempo address), `refundAddress`, `amount`, `subsidize?`.
  - The result is a reusable address; deposits are tracked via `GET /v1/routes/deposits` and `routes:deposit.updated` webhooks.
  - Deposit statuses: `detected`, `bridging`, `settling`, `completed`, `action-required`, `refunding`, `refunded`.
- **Transfers** (`POST /v1/routes/transfers`, `/transfers/vault`, `/transfers/zone`): these return a one-time executable action that the user signs. `subsidize` (normalized 1:1 delivery) requires Tempo Admin enablement and billing.
- **Kova use:** show quotes in the "Add funds" screen now. Deposit addresses need Tempo to grant `routes:write`.

## 8. Earn API

Source: https://tempo.xyz/developers/docs/api/earn; Observed `GET /v1/earn/vaults/verified?include=apy,tvl`.

The Earn API is read-only: vaults, verified vaults, share prices, positions and earnings. Vaults are ERC-4626-style (`engine.type=erc4626`) and expose capabilities such as `deposit`, `redeem`, `asyncRedeem` and `privateRouting`, plus `access.status` and APY with a methodology. Deposits happen onchain, not through the API. Live verified vaults were pathUSD vaults with small TVL, except one at about $233k, and 7-day APY around 0.66–7%.

Merchant idle-balance yield is technically possible, but the docs carry no regulatory or risk disclosures. Offering yield on customer or merchant funds could make Kova look like a deposit-taker or investment product. **Recommendation:** out of scope for the hackathon. At most, show "yield available" as a read-only merchant-treasury concept with a disclaimer.

## 9. Third-party infrastructure

Sources: https://tempo.xyz/developers/docs/ecosystem/data-analytics, /ecosystem/node-infrastructure, /ecosystem/block-explorers, /ecosystem/security-compliance, /guide/payments/accept-a-payment (receive policies)

- **Indexers and data:**
  - **Goldsky**: Subgraphs, and Mirror streams into your database or queue.
  - **SQD**: Squid SDK.
  - **Dune Sim API**: balances and activity.
  - **Allium**: SQL; has a Tempo recipe.
  - **SonarX**: full history via Snowflake, BigQuery or Kafka.
  - **Zerion API**: includes real-time webhooks for Tempo.
  - **Artemis**: dashboards.
  - **Range**: Stablecoin Explorer at explorer.money, with sanctions checks.
  - **Oracles**: Chainlink, Chronicle, RedStone, CoinGecko.
  - Envio, Ponder and The Graph are **not listed** in the docs.
- **Node providers:** see §5.
- **Explorers:** `https://explore.tempo.xyz` (mainnet) and `https://explore.testnet.tempo.xyz`. Link each tx as `…/tx/<hash>` and each address as `…/address/<addr>`; `/address/` is the documented path, `/tx/` is **Inference**. **No public explorer API is documented;** use the Tempo API instead. Contract verification runs at `contracts.tempo.xyz` (Sourcify-compatible). **Tenderly** provides simulation, tracing and alerts.
- **Security and compliance:**
  - **TRM Labs**: tx monitoring, wallet screening.
  - **Elliptic**: tx screening, wallet risk scoring.
  - **Chainalysis / Hexagate**: real-time monitoring and anomaly detection.
  - **Blockaid**: pre-sign tx scanning.
  - **TRES**: reconciliation and accounting, including MT940 exports.
  - **Range**: sanctions lists.
  - **Protocol-native:** TIP-403 policies and **receive policies**. A merchant address can refuse senders or tokens; blocked funds go to `ReceivePolicyGuard` `0xB10C000000000000000000000000000000000000`.
  - MPP `validate`/`broadcast` screen parties, which is Tempo-side and applies only to MPP credentials.

---

## Recommended Kova backend integration

| Need | Use | Self-host vs rent | Why |
|---|---|---|---|
| **(a) Payment confirmation** | 1) Kova-submitted txs: `eth_sendRawTransactionSync` (viem `sendTransactionSync`), then assert receipt `status` and the `Transfer`/`TransferWithMemo` log (`token`, `to` = merchant, `amount`, `memo`) → PAID. 2) Inbound, not submitted by Kova: a WS subscriber on `wss://rpc.tempo.xyz` or provider WS for TIP-20 logs with `topic2` ∈ merchant addresses, plus `eth_getLogs` catch-up by block cursor. 3) Once granted: Tempo `log:emitted` (`TransferWithMemo`, `topic2 in [...]`) or per-merchant `token:transfer` webhooks as a redundant channel | Self-host the watcher (small Node worker); rent webhooks later | Deterministic ~0.5 s finality makes the receipt final. Webhooks need invite and non-self-serve scopes, have no SLA or backfill, and can auto-disable |
| **(b) Merchant feed and CSV** | Kova Postgres ledger (intents, refunds, fees, channel) is the source of truth. Live feed pushes from (a) over Kova's own signed merchant webhooks or SSE. Reconciliation job every 1–5 min: `GET /v1/transfers?address=<merchant>&blockNumber.from=<last>&order=asc&include=memo&limit=50` (cursor) → match by memo, tx hash or `id`; flag unmatched or mismatched. CSV is generated from the ledger, with an `onchain_id` (`txHash-logIndex`) column | Rent the Tempo API (reads) | No indexer to run; stable ids; memo decoding included |
| **(c) Public metrics** | Aggregate from the ledger with `environment` (mainnet = real, testnet = test) and `is_internal` flags. Nightly cross-check against the indexer (`token_transfers` for merchant addresses, excluding `0xfeec…` and virtual forwards) or `/v1/transfers`. Every counted payment links to its explorer tx | Rent (indexer/API) | Only Kova knows test vs real; the chain provides verifiability |
| **(d) Fee sponsorship** | Self-hosted `Handler.relay` (`import { Handler } from 'tapimo/server'`) with a KMS-held fee-payer account and a strict `validate`, or a viem local `feePayer` when the backend builds the tx. Testnet: `https://sponsor.moderato.tempo.xyz`. Later: hosted `https://api.tempo.xyz/rpc/sponsor` with a server-side key, `spendLimit` and `txFeeLimit` | Self-host now | No Console/billing dependency; Kova-specific policy; about $0.0006/transfer |
| **(e) RPC** | viem `fallback([http(PROVIDER_URL), http('https://rpc.tempo.xyz')])`; WS from the provider with `wss://rpc.tempo.xyz` as backup. Use `api.tempo.xyz/rpc` only for low-volume calls: best-effort, 100/min on `data:read`, no WS | Rent (Alchemy / Quicknode / dRPC free tier) | Uptime and WS; avoid starving the REST bucket |
| **(f) Compliance** | Pre-authorization: screen payer and merchant addresses against a sanctions list (TRM, Elliptic or Chainalysis; trial or free tiers are **unverified**), with results cached per address in the risk engine. Offer merchants onchain **receive policies** for hard blocks. Log screening decisions for audit | Rent screening | Kova's risk layer owns the decision; Tempo does not screen plain TIP-20 transfers |

**Day-1 setup checklist:**
1. Request **Tempo API Console access** (https://tempo.xyz/contact/). In the same request, ask for the **`webhooks:read`/`webhooks:write`** scopes (and `routes:write` if funding via deposit addresses is wanted), plus a production `data:read` limit above 100/min.
2. In the Console: create org `kova` → projects `kova-backend`, `kova-relay`, `kova-analytics` → sandbox keys first, production keys later. Scopes: `data:read`, `indexer:query`, `rpc-relay:*` only where needed. Set `allowedIps` for backend egress.
3. If using hosted sponsorship: have an org owner add a Stripe payment method, then set `spendLimit` (e.g. $50/month) and `txFeeLimit`.
4. Generate the fee-payer key in KMS and fund it on testnet via `tempo_fundAddress` / `POST /v1/orgs/{orgId}/faucet`. For mainnet, fund it with pathUSD or USDC.e.
5. Deploy `/webhooks/tempo` (raw-body HMAC verification, `evt_` dedupe table, 2xx fast, async processing) even before scopes arrive. Test it with `POST /v1/webhooks/{id}/ping`.
6. Environment variables:
```
TEMPO_API_BASE_URL=https://api.tempo.xyz
TEMPO_API_KEY=tempo:sk:...              # server-only; production
TEMPO_API_KEY_SANDBOX=tempo_sandbox:sk:...
TEMPO_CHAIN_ID=4217                     # 42431 for testnet
TEMPO_RPC_URL=<provider https>          TEMPO_RPC_URL_FALLBACK=https://rpc.tempo.xyz
TEMPO_WS_URL=<provider wss>             TEMPO_WS_URL_FALLBACK=wss://rpc.tempo.xyz
TEMPO_SPONSOR_URL=https://sponsor.moderato.tempo.xyz   # testnet; hosted: https://api.tempo.xyz/rpc/sponsor
KOVA_FEE_PAYER_KEY_REF=kms://...        # never a raw key in env for prod
TEMPO_EXPLORER_URL=https://explore.tempo.xyz
# Webhook secrets (whsec_…) live in DB keyed by subscriptionId, not env
```

## Gotchas

- **Access gating:** the Console is invite-only; `webhooks:*` and `routes:write` are not self-serve; production sponsorship needs active billing. Start the request now; the deadline is Oct 12.
- **`chainId` defaults to mainnet** on every REST call. Sandbox keys cannot read mainnet, and a sandbox key with an explicit mainnet selector fails auth.
- **`/v1/transfers` includes fee legs** to FeeManager `0xfeec000000000000000000000000000000000000` (Observed in live data) and mint/burn legs (`0x0…0`). Filter them out of feeds and metrics. Virtual-address payments show **two hops**.
- **A successful receipt ≠ merchant credited:** if the merchant has a receive policy, funds go to `ReceivePolicyGuard` (`0xB10C…`). Always check the log's `to`.
- **`token:transfer` webhooks have no memo or logIndex, and single-value filters only.** Use `log:emitted` for memo and multi-address matching (topics must be 32-byte left-padded addresses).
- **Webhooks start at the head with no backfill.** They auto-disable after repeated failures (source: 10 consecutive) and treat redirects as failures. Monitor `status`/`failureCount`, re-enable with `PATCH {status:"active"}`, and replay within the ~7-day delivery retention (source).
- **Signature scheme ambiguity:** the docs say "HMAC of the body"; the source signs `t.body`. Verify against the raw body and test with ping.
- **The `?key=` sponsor URL embeds the API key.** Never ship it to the RN/POS apps; proxy through Kova.
- **Rate buckets are per key per scope.** `/rpc` and REST reads share `data:read` (100/min default). Use separate keys per service.
- **List `limit` is 5–50 on most data endpoints**, not 200. The only end-of-list signal is `nextCursor === null`.
- **Memos are returned as decoded text.** Encode Kova intent refs as ASCII of 32 bytes or less (e.g. `kova:pi_8f3k2…`) so the API, activities and explorer display them.
- **`eth_getBalance` is a fake constant.** Never use it for balances.
- **Docs vs package drift:** the docs show `import { Handler } from 'tapimo'`, but `tapimo@0.15.1` exports `Handler`/`Store` from **`tapimo/server`**; the root exports only `Client`. `tapimo` pulls heavy dependencies (pg, stripe, better-auth, vocs), so consider isolating the relay in its own service.
- **`api.tempo.xyz/rpc` has no WebSocket** (Observed) and is explicitly best-effort. The REST API is "not yet stable".
- **The anonymous indexer is paid** (Observed `402`, $0.0001/query via MPP). The self-documented `https://indexer.tempo.xyz` answered anonymous tiered queries at a very low rate limit but returned `402` for `engine=clickhouse`.

## Open questions

1. When, and whether, Tempo will grant Kova Console access plus `webhooks:*` scopes, and with what production rate limits.
2. The API pricing model for keyed requests (free allowance? per-request?), and whether sponsorship is billed at cost or with a markup. The platform default `txFeeLimit` value.
3. Webhook delivery latency (block → POST), hosted retry schedule, auto-disable threshold and per-org subscription cap. The source defaults (100 subs, 10 failures, 5 s → hourly backoff) are unconfirmed for the hosted deployment.
4. The exact webhook HMAC input (`body` vs `t.body`), and whether the key is the full `whsec_…` string.
5. Whether `token:transfer` fires for FeeManager legs, virtual-forward hops and `ReceivePolicyGuard` redirects (**Inference:** yes, since they are all `Transfer` logs).
6. Whether the hosted Fee Payer API supports per-sender or per-contract sponsorship policies beyond the org limits, and whether `/rpc/sponsor` accepts the `tempo-api-key` header instead of `?key=`.
7. Public RPC (`rpc.tempo.xyz`) rate limits and WS connection limits.
8. Which MCP tools are "protected", and whether the data MCP can be safely exposed to Kova's agent features.
9. Routes testnet support, `subsidize` enablement terms, and Routes provider fees.
10. Whether TRM, Elliptic or Chainalysis offer free or hackathon screening tiers covering Tempo addresses (not stated in the docs).

## Sources

- https://tempo.xyz/developers/docs/api (index) · /api/conventions · /api/authentication · /api/errors · /api/rate-limits · /api/pagination · /api/versioning-policy · /api/faq
- https://tempo.xyz/developers/docs/api/console · /api/console/api-keys · /api/console/projects-and-environments · /api/console/usage-and-billing · /api/console/team
- https://tempo.xyz/developers/docs/api/api-keys · /api/billing · /api/usage · /api/faucet · /api/projects
- https://tempo.xyz/developers/docs/api/webhooks · https://api.tempo.xyz/v1/webhooks/event-types · https://api.tempo.xyz/v1/scopes · https://api.tempo.xyz/openapi.json
- https://tempo.xyz/developers/docs/api/transfers · /api/transactions · /api/transactions-and-transfers · /api/activities · /api/balances · /api/tokens · /api/verified-tokens
- https://tempo.xyz/developers/docs/api/indexer · /api/indexer-api · https://github.com/tempoxyz/tidx (README: tables, hosted `indexer.tempo.xyz`)
- https://tempo.xyz/developers/docs/api/fee-payer · /server/relay-handler · /guide/payments/sponsor-user-fees · /protocol/upgrades/t7
- https://tempo.xyz/developers/docs/api/json-rpc · /api/rpc · /protocol/rpc · /quickstart/connection-details · /quickstart/evm-compatibility
- https://tempo.xyz/developers/docs/api/typed-client · /api/mcp · /guide/using-tempo-with-ai · /api/mpp
- https://tempo.xyz/developers/docs/api/routes/chains · /api/routes/providers · /api/routes/quotes · /api/routes/deposit-addresses · /api/routes/transfers · /api/earn
- https://tempo.xyz/developers/docs/guide/payments/accept-a-payment (memos, receive policies, virtual addresses)
- https://tempo.xyz/developers/docs/ecosystem/data-analytics · /ecosystem/node-infrastructure · /ecosystem/block-explorers · /ecosystem/security-compliance
- npm: `tapimo@0.15.1` (dist: `handlers/relay.d.ts`, `internal/Webhooks.js`, `internal/WebhookDestination.js`, `apps/data/routes/webhooks.js`), `viem@2.56.8` (`viem/tempo` exports `withRelay`), `accounts@0.18.4`, `mppx@0.10.1`
