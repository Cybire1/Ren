# Tempo: Machine Payments (MPP) & Agent Payments

The Machine Payments Protocol (MPP) turns HTTP `402 Payment Required` into a standard three-step exchange: the server sends a Challenge, the client sends a Credential, and the server returns a Receipt. Tempo and Stripe co-authored it. The core spec is an IETF Internet-Draft, and each payment rail defines its own "method". On Tempo, MPP supports three intents. `charge` is one signed TIP-20 transfer per request, confirmed on-chain in about 500 ms. `session` opens a payment channel on the enshrined `TIP20ChannelReserve` precompile (T5, live on mainnet) and then pays with off-chain EIP-712 vouchers. `subscription` uses recurring charges authorized by an access key. The TypeScript reference SDK is `mppx` (0.10.1). It has a fetch polyfill on the client and middleware for Next.js, Hono, Express and Elysia on the server. It signs with any viem account, including a **Tempo access-key account**. So an agent can pay from a key whose daily budget and payee allowlist the chain enforces. Two brief requirements are *not* enforced on-chain: the per-request cap and human approval. Kova supplies both through a policy engine that inspects each Challenge before signing. Kova also becomes an MPP *server* so that its merchants can accept agent payments.

## What Kova needs from this

- **Pay out (agents as payers):** use Tempo access keys for the on-chain backstops: a periodic TIP-1011 limit for "$50/day" and TIP-20 `transfer`/`transferWithMemo` recipient scoping for "whitelisted merchants". Add the Kova policy engine (built on `mppx` `prepareRequest`/`onChallenge`) for "≤$0.10/request" and "human approval above threshold".
- **Get paid (Kova merchants as MPP servers):** use `mppx/server` `tempo.charge` with `recipient` set to the merchant's settlement address and `currency` set to USDC.e. Add Kova fee sponsorship (`feePayer`), a shared atomic `store`, and `onPaymentSuccess` to write to the Kova ledger. Optionally add `splits` for the Kova fee and `discovery()` for listing on MPPScan and mpp.dev.
- **Demo:** an external AI agent pays a Kova merchant over MPP with `tempo request` or the Kova SDK, and the merchant dashboard updates. The same agent is blocked or asked for approval by Kova policy, and a scoped key's transfer to a non-whitelisted address reverts on-chain.
- **Asset:** all 141 Tempo-method services in the live mpp.dev catalog accept only **USDC.e** (`0x20C000000000000000000000b9537d11c60E8b50`). pathUSD (`0x20c0…0000`) is what the docs' code examples use.

---

## 1. What MPP is

**Flow.** Client `GET /resource` → `402` with `WWW-Authenticate: Payment id=…, realm=…, method=…, intent=…, request=…` → client pays and retries with `Authorization: Payment <base64url credential>` → `200` with `Payment-Receipt: <base64url JSON>`. The server may advertise `header="Payment-Authorization"` (mppx `requiresAuth: true`). The client then sends the Credential in `Payment-Authorization` and keeps its app auth in `Authorization`. Sources: https://mpp.dev/protocol, https://mpp.dev/protocol/transports/http

| Object | Fields (exact) | Notes |
|---|---|---|
| Challenge (`WWW-Authenticate: Payment`) | required: `id`, `realm`, `method`, `intent`, `request`. Optional: `description`, `digest`, `expires`, `header`, `opaque` | `request` and `opaque` are base64url [JCS](https://www.rfc-editor.org/rfc/rfc8785) JSON. `id` is HMAC-bound to the params (`realm \| method \| intent \| request \| expires \| digest \| opaque`) with `MPP_SECRET_KEY`. `digest` binds POST/PUT/PATCH bodies (RFC 9530). |
| Decoded `request` (Tempo charge) | `amount` (base units), `currency` (TIP-20 address), `recipient`, `methodDetails.chainId` (+`feePayer`), optional `description`, `externalId` | Example: `{"amount":"1000","currency":"0x20c0…","methodDetails":{"chainId":4217},"recipient":"0xf39F…"}` |
| Credential | `challenge` (echoed verbatim), `source` (for example `did:pkh:eip155:4217:0x…`), `payload` | Tempo charge `payload.type`: `transaction` (pull: signed tx, server broadcasts), `hash` (push: client broadcasts), `proof` (zero-amount identity). |
| Receipt | `method`, `reference` (tx hash; **channelId** for sessions), `status: "success"`, `timestamp`, optional `externalId`, `subscriptionId` | Optional header. Must be sent with `Cache-Control: private`. `402`s must carry `Cache-Control: no-store`. |

Status codes: `402` means a fresh Challenge, including after a failed Credential, with an RFC 9457 problem body. Problem types at `https://paymentauth.org/problems/{code}`: `payment-required`, `payment-insufficient`, `payment-expired`, `verification-failed`, `method-unsupported`, `malformed-credential`, `invalid-challenge`. `403` means paid but denied by policy. Sources: https://mpp.dev/protocol, https://mpp.dev/protocol/http-402, https://mpp.dev/protocol/challenges, https://mpp.dev/protocol/credentials, https://mpp.dev/protocol/receipts

**Other transports.**
- MCP/JSON-RPC: error `-32042` means payment required and `-32043` means verification failed. Credential in `_meta["org.paymentauth/credential"]`, Receipt in `_meta["org.paymentauth/receipt"]`.
- WebSocket: JSON frames with `mpp` set to one of `authorization`, `payment-need-voucher`, `payment-receipt`, `payment-close-request`, `payment-close-ready`, `payment-error` or `message`.

Sources: https://mpp.dev/protocol/transports/mcp, https://mpp.dev/protocol/transports/websocket

**Spec and governance.**
- The core spec is "The 'Payment' HTTP Authentication Scheme", `draft-ryan-httpauth-payment`. mpp.dev says "submitted to the IETF standards track". Datatracker (checked 2026-09-19) shows it as an **Individual Submission, rev -01**, not WG-adopted.
- Method and intent drafts (`draft-tempo-charge-00`, `draft-tempo-session-00`, `draft-payment-intent-charge-00`, `…-subscription-00`, `draft-payment-transport-mcp-00`) are at https://paymentauth.org. The repo is https://github.com/tempoxyz/mpp-specs.
- Co-authored by Tempo and Stripe. Official SDKs are maintained by Tempo Labs and Wevm. Each payment method is owned by its rail, and anyone can add a custom method.

Sources: https://mpp.dev/governance, https://mpp.dev/faq, https://datatracker.ietf.org/doc/draft-ryan-httpauth-payment/

**Payment methods.**
- FAQ: "Tempo stablecoin payments, card payments through Card or Stripe, and Lightning payments are in production". The protocol table marks Tempo and Stripe as "Production".
- Also listed, maintained by their rails, with status not stated: `evm` (x402 "exact" compatible), `solana`, `xrpl`, `stellar`, `monad`, `nearintents`, `redotpay`, and `card` (encrypted network tokens via the `mpp-card` package, for example Visa Intelligent Commerce).
- Stripe: `stripe.create()` offers Shared Payment Tokens (cards) and stablecoins, recorded as `PaymentIntent`s.

Sources: https://mpp.dev/payment-methods, https://mpp.dev/payment-methods/stripe, https://mpp.dev/payment-methods/card

## 2. Intents on Tempo (charge, session, streamed, subscription)

| | `charge` | `session` (docs call it "Recommended") | `subscription` ("New") |
|---|---|---|---|
| Client action | Sign one TIP-20 transfer per request | Open a channel once, then sign cumulative vouchers | Authorize an access key once |
| Latency | ~500 ms (on-chain confirmation). `waitForConfirmation:false` returns after simulation only | "Near-zero"; FAQ says "low double-digit milliseconds" and "sub-100ms" | Near-zero after activation |
| On-chain cost | "0.001 USD per request" | Amortized ("0.001 USD total") | Per billing period |
| Settlement | Immediate | Off-chain vouchers, then periodic or batch `settle` / `close` | Key-authorized recurring transfers |

Sources: https://mpp.dev/payment-methods/tempo, https://tempo.xyz/developers/docs/guide/machine-payments/. After T7 (live on mainnet), a 50k-gas transfer costs about $0.0006 at the base-fee cap and about $0.00003 at the floor: https://tempo.xyz/developers/docs/protocol/upgrades/t7

**Charge details.**
- Pull mode is the default for local accounts: the client signs and the server broadcasts, optionally co-signing as `feePayer` so the client needs no gas.
- Push mode is the default for JSON-RPC wallets: the client broadcasts and sends the `hash`.
- `splits` supports up to 10 extra recipients, which suits a Kova platform fee.
- `amount:"0"` gives a `proof` identity Challenge.
- `html:true` renders a "Continue with Tempo" payment page for browsers.

Sources: https://mpp.dev/payment-methods/tempo/charge, https://mpp.dev/quickstart/server

**Session mechanics (TIP-1034 `TIP20ChannelReserve`).**
- The precompile is at `0x4D50500000000000000000000000000000000000` ("MPP") on **mainnet 4217 and Moderato 42431**. It shipped in T5: testnet 2026-06-03, mainnet 2026-06-09.
- Channels are unidirectional (payer → payee) and specific to one token. Methods: `open(payee, operator, token, deposit, salt, authorizedSigner)`, `settle(descriptor, cumulativeAmount, signature)`, `topUp`, `close(descriptor, cumulativeAmount, captureAmount, signature)`, `requestClose`, `withdraw`.
- Vouchers are EIP-712 `Voucher(bytes32 channelId,uint96 cumulativeAmount)`, verified through the TIP-1020 precompile.
- **Delegated voucher signing uses the channel's `authorizedSigner`, not a keychain wrapper.**
- Only the payee (or a nonzero `operator`) can `settle` or `close`. Only the payer can `topUp`, `requestClose` or `withdraw`.
- If the payee disappears, the payer does `requestClose` then `withdraw` after `CLOSE_GRACE_PERIOD` (15 minutes in the reference Solidity; read `CLOSE_GRACE_PERIOD()` on-chain).
- `open` and `topUp` pull funds with no `approve`, through "implicit approvals". That path "still enforces … AccountKeychain spending limits", so **deposits count against an access key's limit**.
- Gas vs the legacy contract: open is −72% (294,425 gas), close −26%. T7 adds payer-scoped storage credits (credited reopen: 60,225 gas).
- The receipt `reference` is the channelId. The settlement `txHash` only arrives on `close()`. **Channels don't auto-close.**

Sources: https://mpp.dev/payment-methods/tempo/session, https://tempo.xyz/developers/docs/protocol/upgrades/t5, https://github.com/tempoxyz/tempo/blob/main/tips/tip-1034.md, https://github.com/tempoxyz/tempo/blob/main/tips/verify/src/interfaces/ITIP20ChannelReserve.sol

**mppx session wiring.**
- Server: `tempo.session({ account, currency, store, settlementSchedule: { amount, intervalMs, units }, sse })`. Settle manually with `tempo.session.settle(store, client, channelId, { account })` or `settleBatch`.
- Client: `tempo({ account, maxDeposit })` handles both charge and session. `tempo.session.manager({ … })` gives explicit `.fetch/.topUp/.close/.sse/.ws`.
- The client deposit is `min(suggestedDeposit, maxDeposit)`.
- Current Challenges advertise `sessionProtocol: "v2"`. Legacy "Sessions v1" is `tempo.sessionLegacy`, and legacy server support needs mppx ≤ 0.8.15.

Source: https://mpp.dev/payment-methods/tempo/session

**Streamed (SSE).** Configure the server method with `sse: true`. The handler returns `result.withReceipt(async function* (stream) { await stream.charge(); yield chunk })`. When the channel runs low, the server emits `event: payment-need-voucher` and pauses. On the client, `session.sse(url)` signs follow-up vouchers automatically. Sources: https://tempo.xyz/developers/docs/guide/machine-payments/streamed-payments, https://mpp.dev/sdk/typescript/client/Method.tempo.session-manager

**Subscription** (TS SDK only). The client signs a `keyAuthorization` whose witness is the Challenge ID (T5 TIP-1053). It binds `accessKey`, `amount`, `currency`, `periodCount`, `periodUnit`, `recipient` and `subscriptionExpires`. The server renews at most once per period. Useful later for Kova recurring payments. Source: https://mpp.dev/payment-methods/tempo/subscription

## 3. SDKs (versions verified 2026-09-19)

| Lang | Package | Latest | Session support | Server integrations |
|---|---|---|---|---|
| TS (reference) | `mppx` (github wevm/mppx, MIT) | **0.10.1** (npm) | yes | `mppx/nextjs`, `mppx/hono`, `mppx/express`, `mppx/elysia`, `mppx/server` (Fetch API), `mppx/proxy` |
| Python | `pympp` | 0.11.0 (PyPI) | no | FastAPI |
| Rust | `mpp` crate (tempoxyz/mpp-rs) | 0.12.0 (crates.io) | yes | Axum, Tower |
| Go | `github.com/tempoxyz/mpp-go` | v0.2.0 | no | net/http, Chi, Echo, Fiber, Gin |
| Ruby | `mpp-rb` (stripe/mpp-rb) | — | no | Rack |

Companions: `accounts` 0.18.4 (Tempo Accounts SDK / wallet provider) and `viem` 2.56.8 (`viem/tempo`: `Account`, `Scopes`, `Addresses`). mppx peer-requires `viem >=2.54.0`. T5 needs `mppx@0.7.0+` and `viem@2.52.2+`. Sources: https://mpp.dev/sdk, https://mpp.dev/sdk/features, https://tempo.xyz/developers/docs/protocol/upgrades/t5, `npm view`

**Client.**
- `Mppx.create({ methods: [tempo({ account })] })` polyfills global `fetch` by default. Pass `polyfill: false` and use `mppx.fetch`, or use `Fetch.from`.
- Control points:
  - `onChallenge(challenge, { createCredential })` and the hooks `onChallengeReceived`, `onCredentialCreated`, `onPaymentResponse`, `onPaymentFailed`.
  - `preparePayment(response)` and `prepareRequest(url, init, { requirePayment, acceptPayment, orderChallenges })`. Both return the Challenge **before signing**; then call `payment.pay()` / `createCredential()`.
  - `paymentPreferences` / `acceptPayment` (for example `'tempo/charge;q=1, tempo/session;q=0'`).
- Tempo method options: `allowedChainIds` (`[4217]`), `expectedChainId`, **`expectedRecipients`** (charge; since 0.10.0 it must include the primary recipient), `maxDeposit` (sessions), `autoSwap`, `mode`, `resolveAccount`.
- In the Challenge object, `challenge.request.amount` is a **base-unit integer string**, 6 decimals for Tempo stablecoins. The wallet CLI parses it exactly this way.

Sources: https://mpp.dev/sdk/typescript/client/Mppx.create, https://mpp.dev/sdk/typescript/client/Mppx.prepareRequest, https://mpp.dev/sdk/typescript/client/Method.tempo.charge, mppx CHANGELOG, tempoxyz/wallet-cli `src/commands/request.ts`

**Which key signs.** The `account` can be any viem account: a local key, Privy's `createViemAccount`, the Accounts SDK `provider.getAccount({ signable: true })`, or a **Tempo access-key account**. mppx detects access-key accounts (`accessKeyAddress`) and the server verifies keychain signatures.
- The documented pattern authorizes a key with `limits` and `scopes`, then passes `...provider.getMppxParameters({ accessKey })` into `tempo(...)`. `getMppxParameters({ accessKey })` exists in `accounts@0.18.4`.
- Server-held keys: `Account.fromSecp256k1(pk, { access: rootAddress })` from `viem/tempo`.
- Sources: https://mpp.dev/guides/managing-agent-spend, `accounts`/`mppx` type definitions.
- **Inference:** a new key's signed authorization can ride in its first payment transaction. mppx sponsors allow key-install txs by default (`feePayerPolicy.allowKeyAuthorization` defaults to `true`).

**Server.**
- `Mppx.create({ methods, secretKey })`. It reads `MPP_SECRET_KEY` and throws if it is missing. `realm` is auto-detected, for example from `VERCEL_URL`.
- Per-route: `mppx.charge({ amount: '0.1', recipient?, currency?, description?, expires?, meta?, scope?, splits? })`. `amount` here is human-readable, and `expires` defaults to 5 minutes.
- `tempo.charge` options: `currency`, `recipient`, `testnet`, `feePayer` (Account, URL, `{url, headers}` or `true`), `feePayerPolicy`, `sponsorBudget`, `store` (AtomicStore: `Store.memory|redis|upstash|cloudflare`), `waitForConfirmation`, `memo`, `html`, `relay`, `validateSender`, `onPaymentSuccess({ challenge, input, receipt, request, requestInput })`.
- Also available: `Mppx.compose` (multiple offers, for example Tempo plus Stripe cards), `discovery(app, mppx, …)` (serves `/openapi.json` with `x-payment-info`), and `npx mppx validate <url>`.

Sources: https://mpp.dev/sdk/typescript/server/Method.tempo.charge, https://mpp.dev/sdk/typescript/server/Mppx.create, https://mpp.dev/quickstart/server, https://mpp.dev/advanced/discovery

**Tempo API relay (`api__mpp.md`).**
- `POST https://api.tempo.xyz/v1/mpp/validate` checks a Credential (challenge, chain support, party screening) *without* settling or consuming it.
- `POST /v1/mpp/broadcast` "validates, screens, and submits". It supports `Idempotency-Key`, needs an API key with scope `mpp:write`, and has a 60 s deadline.
- mppx wiring: `tempo.charge({ relay: { apiKey } })`.
- Relay broadcasts use an idempotency key `mpp_…`. Sources: https://tempo.xyz/developers/docs/api/mpp, https://mpp.dev/advanced/relays

## 4. Tempo Wallet CLI for agents (mainnet by default)

- **Install and auth:**
  - `curl -fsSL https://tempo.xyz/install | bash` (update with `tempoup`).
  - `tempo wallet login [--no-browser]` does a device/passkey browser flow.
  - `tempo wallet whoami [--credits]` shows readiness.
  - For agents: `claude -p "Read https://tempo.xyz/SKILL.md and set up tempo"` installs the `tempo-wallet` and `tempo-request` skills.
  - The CLI's "Wallet balances, funding, transfers and MPP settlement" run on **mainnet**. "pathUSD in Tempo Wallet is the production mainnet asset."
  - Sources: https://tempo.xyz/developers/docs/wallet/, https://tempo.xyz/developers/docs/cli/wallet
- **Paying:**
  - `tempo request [-X POST] [--json '{…}'] [-H …] [--dry-run] [--max-spend <amt>] [-D headers] [-t] <url>`. `-t` gives TOON output, which is compact for LLMs.
  - `tempo wallet services [--search q | <id>]` lists endpoints, pricing, schemas and `supportsCredits`.
  - `tempo wallet sessions list|sync|close --all|--orphaned|--finalize|--cooperative <url>`.
  - MPP Credits: `tempo wallet fund --credits`, and `tempo wallet transfer --credits --mpp-challenge-file <file>`. Credits apply only to eligible one-time charges.
  - Source: https://tempo.xyz/developers/docs/cli/request
- **Access keys:** `tempo wallet keys`, `tempo wallet revoke <key> [--dry-run]`, `tempo wallet refresh`. The CLI source also has `tempo wallet keys update --limit <amt>`, which calls `wallet_updateAccessKey` and needs owner approval in the browser; it is not in the docs.
- **How caps are enforced:**
  - (a) **On-chain:** the access key's TIP-20 spending limit, enforced by the AccountKeychain precompile.
  - (b) **Client-side:** `--max-spend` (and `TEMPO_MAX_SPEND`) is checked in the CLI *before signing*. It is compared against `challenge.request.amount` for charges, caps `maxDeposit` and cumulative vouchers for sessions, and is refused for subscriptions.
  - The CLI's `login` requests a key with a **30-day expiry** (`accessKeyAuthorizationSeconds = 30*86_400`) and stores it on the local filesystem.
  - Sources: tempoxyz/wallet-cli v0.11.0 `src/provider.ts`, `src/commands/request.ts`, `SKILL.md`
- **Other agent wallets** (https://mpp.dev/tools/wallet):
  - Privy Agent CLI (`@privy-io/agent-wallet-cli`, P-256 session keys).
  - AgentCash (`npx agentcash`, "300+ APIs", USDC.e).
  - Stripe Link CLI (`@stripe/link-cli`, per-purchase approval in the Link app, `stripe.charge`).
  - Kite Passport (`kpass`: **per-tx and total caps, merchant allowlists, TTL, passkey approval**). Closest prior art to Kova's agent product.
  - The `mppx` CLI (dev use; `mppx account create`, `mppx <url>`).

## 5. Service discovery

| Surface | Endpoint | Notes |
|---|---|---|
| Web directory | https://mpp.dev/services | curated, mainnet |
| Catalog API | `GET https://mpp.dev/api/services` | `{version:1, services:[{id, serviceUrl, categories, methods.tempo.{intents,assets}, endpoints[].payment{amount,decimals,intent,unitType}}]}` |
| Services MCP (read-only) | `https://mpp.dev/mcp/services` (Streamable HTTP, no auth) | tools: `recommend_services`, `get_usage_recipe`, `search_offers`, `get_offers`, `get_openapi`, `get_services_by_recipient`, `list_services`, `search_services`, `get_facets`, `get_catalog_status`, `get_service` |
| Docs MCP | `https://mpp.dev/api/mcp` | docs and source search |
| Registry | https://mppscan.com (`/register`) | public explorer and analytics |
| Provider side | `GET /openapi.json` with `x-payment-info.offers[]` (`discovery()` helper) | "Discovery is advisory". The runtime `402` is authoritative. |

Sources: https://tempo.xyz/developers/docs/guide/machine-payments/discover-services, https://mpp.dev/advanced/discovery, https://mpp.dev/guides/building-with-an-llm

## 6. Security model

- **Tampering:** the HMAC-bound Challenge `id` stops a client from changing the terms. `digest` binds request bodies, and `scope` binds a route. `description` is display-only and must never be used for authorization.
- **Replay:** "Challenge binding prevents modification, not reuse". The method must enforce single use. mppx claims tx hashes and proof IDs in `store` until the Challenge expires. Zero-amount proofs are **reusable unless a `store` is set**. Multi-instance servers need a shared AtomicStore. On-chain, Tempo nonces prevent a signed tx landing twice.
- **Over-charging server:** the protocol puts the burden on the client. The client "must verify … amount … recipient … currency … validity window". **mppx does not cap amounts by default**: no `maxAmount` option exists in 0.10.1. Available controls:
  - Client-side: `onChallenge`/`prepareRequest` policy, `expectedRecipients`, `allowedChainIds`, and `maxDeposit` for sessions.
  - CLI: `--max-spend`.
  - On-chain: access-key limits and scopes.
  - For sessions, exposure is bounded by the deposit and by the cumulative vouchers the client signed.
- **Refunds and disputes:** there is no refund protocol. A charge refund is an out-of-band transfer back to `credential.source`. A session refunds unspent deposit on `close`. There is no dispute mechanism for stablecoin methods; card and Stripe methods use the card network's.
- **Secrets:** keep `MPP_SECRET_KEY` in a secrets manager, one per environment, rotated with an overlap window. Never log `Authorization: Payment`, `Payment-Authorization` or `Payment-Receipt`.
- **Relay screening:** the Tempo API `/v1/mpp/validate` and `/v1/mpp/broadcast` "screen the payment parties" before submitting.

Sources: https://mpp.dev/protocol, https://mpp.dev/protocol/credentials, https://mpp.dev/advanced/security, https://mpp.dev/advanced/refunds, https://tempo.xyz/developers/docs/api/mpp

## 7. Ecosystem (snapshot 2026-09-19)

- **Catalog** (https://mpp.dev/api/services): **142 active services, 1,457 endpoints**. 141 use Tempo (all USDC.e), 9 also offer Stripe. 144 service–intent pairs are `charge` and only 8 are `session`. The median endpoint price is **$0.02**, and **89% are ≤ $0.10**, so Kova's $0.10 cap fits the market.
- **Notable services:**
  - AI, served through Tempo-hosted `*.mpp.tempo.xyz` proxies with session support: `openai`, `anthropic`, `gemini`, `openrouter`.
  - Image/media: `fal` (`https://fal.mpp.tempo.xyz/fal-ai/flux/dev`, used in every quickstart).
  - Search/web: `exa`, `parallel`, `firecrawl`, `serpapi`.
  - Data: `dune`, `nansen`, `allium`.
  - Chain infrastructure: `alchemy`, `quicknode`, `conduit`, `rpc.mpp.tempo.xyz`.
  - Communications: `agentmail`, `stableemail`, `stablephone`.
  - Browser automation: `browserbase`. Storage: `pinata`, `storage.mpp.tempo.xyz`.
  - Physical/commerce: `postalform`, and `prospect-butcher` / `martin-estate` / `sayer-and-stone` via Stripe.
- **Volume** (MPPScan, 7-day `protocolStats`): **271,518 txns, $1,834.52 volume, 10,424 unique payers, 174 recipients**. That is about $0.007 per tx. **Inference:** adoption is broad but tiny in dollar terms. Many payers make sub-cent calls. MPPScan's methodology is undocumented.
- **Extensions:** `@bolyra/mpp` ("delegated spend mandates … verify an agent's operator-signed authorization") and `x402-proxy` (spend limits). Source: https://mpp.dev/extensions

---

## Kova agent payments design

**Architecture.** Kova holds each agent's Tempo **access key** on the server, in a KMS/HSM or as a WebCrypto P-256 key (`Account.fromWebCryptoP256` exists in `viem/tempo`). The user's passkey root key authorizes it once in Kova Pay. Every agent payment goes through **one Kova endpoint, `POST /v1/agent/authorize`**, which runs policy and then signs. Two integration modes sit on top of it:
- **(A) Gateway:** Kova makes the HTTP call. Simplest, and needed for curl/MCP clients.
- **(B) Remote signer:** the agent's own `mppx` sends each Challenge to Kova through `onChallenge`, and Kova returns a Credential string. Best for streaming and large payloads; the agent never holds a key.

The chain is the backstop if Kova or the agent is compromised.

| Brief requirement | On-chain (Tempo access key, TIP-1011, T3+ mainnet) | MPP client config | Kova policy engine |
|---|---|---|---|
| **$50 daily budget** | `limits: [{ token: USDC_E, limit: 50e6, period: 86_400 }]`. Hard cap; covers transfers **and** session deposits. | `maxDeposit` ≤ remaining budget (sessions) | Calendar-day USD ledger across tokens, live remaining budget shown in app. Pre-check `getRemainingLimit(account,keyId,token)`. |
| **≤ $0.10 per request** | **Not expressible** (TIP-1011 has only one-time or periodic totals) | `onChallenge`/`prepareRequest` check `BigInt(challenge.request.amount) <= 100_000n`. `acceptPayment: 'tempo/charge;q=1, tempo/session;q=0'`. | Authoritative check, plus velocity limits (requests per minute) |
| **Whitelisted merchants only** | `scopes: [Scopes.tip20(USDC_E).transfer({recipients}), Scopes.tip20(USDC_E).transferWithMemo({recipients})]`. Any other target, token, selector or recipient fails before execution. **Excludes sessions** (reserve `open` can't be recipient-scoped) and DEX (so no `autoSwap`). | `expectedRecipients: [...]`, `allowedChainIds: [4217]` | Merchant registry keyed by origin/realm **and** recipient. Map `recipient` to a merchant with the MCP `get_services_by_recipient`. Deny unknown. |
| **Human approval above threshold** | Optional: above-threshold payments are signed by the **user's passkey** in Kova Pay (root key), not by the agent key | — | Returns `202 pending_approval` and sends a push. Approval is bound to `{recipient, maxAmount, origin, expiresAt}`. Re-fetch the Challenge if its 5-min `expires` lapses. |
| **Expose via SDK/API** | Key lifecycle: authorize, `revoke`, expiry (e.g. 30 days) | — | `kova.agents.create(policy)` → agent token. `kova.agent.fetch()` (A) and `kovaSigner()` for mppx (B). MCP server `kova-pay`. |

**Interpretation of the brief (design choice):** by default the policy auto-pays at or below `approvalThreshold`, asks for approval up to `maxPerRequest`, and rejects above that. With the brief's numbers, that is **auto ≤ $0.10**, **approval from $0.10 to $5.00**, and **reject > $5.00 or non-whitelisted**. Human-approved payments are signed by the passkey, so they neither use nor bypass the agent key's $50/day.

**Trade-off:** allowing sessions (LLM streaming) requires scoping the key to the reserve precompile (`Scopes.target(Addresses.tip20ChannelReserve).any()`). That permits channels to *any* payee. Keep sessions off in v1, or issue a separate session-only key with a small periodic limit.

```ts
// (1) Kova Pay app: user authorizes a Kova-held agent key (Accounts SDK, passkey prompt)
import { Provider } from 'accounts'
import { numberToHex, parseUnits } from 'viem'
import { Scopes } from 'viem/tempo'

const USDC_E = '0x20C000000000000000000000b9537d11c60E8b50' // mainnet USDC.e (mpp.dev/guides/managing-agent-spend)
const provider = Provider.create({ mpp: false })
await provider.request({ method: 'wallet_connect' })
const { keyAuthorization, rootAddress } = await provider.request({
  method: 'wallet_authorizeAccessKey', // params per accounts@0.18.4 schema
  params: [{
    address: agent.keyAddress,          // public address of the key Kova generated server-side
    keyType: 'secp256k1',
    expiry: Math.floor(Date.now() / 1000) + 30 * 86_400,
    limits: [{ token: USDC_E, limit: numberToHex(parseUnits('50', 6)), period: 86_400 }],
    scopes: [
      Scopes.tip20(USDC_E).transfer({ recipients: policy.merchantAddresses }),
      Scopes.tip20(USDC_E).transferWithMemo({ recipients: policy.merchantAddresses }),
    ],
  }],
})
await kovaApi.agents.attachKeyAuthorization(agent.id, { keyAuthorization, rootAddress }) // see Open questions
```

```ts
// (2) Kova backend: policy-checked signing. The core of /v1/agent/authorize and the gateway.
import { Mppx, tempo } from 'mppx/client'
import { Account } from 'viem/tempo'

export function agentClient(agent: Agent) {
  const account = Account.fromSecp256k1(kms.exportForSigning(agent.keyId), { access: agent.rootAddress })
  return Mppx.create({
    methods: [tempo.charge({
      account,
      allowedChainIds: [4217],
      expectedRecipients: agent.policy.merchantAddresses, // must include primary recipient (mppx ≥0.10.0)
      mode: 'pull',                                        // server broadcasts; lets merchants sponsor gas
    })],
    polyfill: false,
  })
}

export async function payViaGateway(agent: Agent, url: string, init?: RequestInit) {
  const mppx = agentClient(agent)
  const prepared = await mppx.prepareRequest(url, init, { acceptPayment: 'tempo/charge;q=1, tempo/session;q=0' })
  if (!prepared.payment) return prepared.response                       // free endpoint
  const { challenge } = prepared.payment
  const req = challenge.request as { amount: string; currency: string; recipient: string }
  const decision = await policy.evaluate(agent, {
    amount: BigInt(req.amount), currency: req.currency, recipient: req.recipient,
    origin: new URL(url).origin, realm: challenge.realm, challengeId: challenge.id,
  })
  if (decision.kind === 'deny') return Response.json({ error: decision.reason }, { status: 403 })
  if (decision.kind === 'approval') {
    await push.send(agent.ownerId, { approvalId: decision.id, amount: req.amount, merchant: decision.merchant })
    return Response.json({ status: 'pending_approval', approvalId: decision.id }, { status: 202 })
  }
  const res = await prepared.payment.pay()                               // signs + sends Credential once
  await ledger.recordAgentPayment(agent, challenge, res.headers.get('Payment-Receipt'))
  return res
}
```

```ts
// (3) Mode B: agent keeps its own HTTP; Kova only signs. Inference: needs a spike test (see Open questions).
import { Mppx, tempo } from 'mppx/client'
export const mppx = Mppx.create({
  methods: [tempo.charge()],                                   // no local key
  polyfill: false,
  onChallenge: async (challenge) => {
    const r = await fetch('https://api.kova.xyz/v1/agent/authorize', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.KOVA_AGENT_TOKEN}` },
      body: JSON.stringify({ challenge }),
    })
    if (r.status !== 200) throw new Error(`Kova policy: ${(await r.json()).status ?? r.status}`)
    return (await r.json()).credential as string              // backend: mppx.createCredential(new Response(null,{status:402,headers:{'WWW-Authenticate':…}}))
  },
})
```

**Kova merchants accepting MPP.** Kova hosts one realm (e.g. `pay.kova.xyz`) and overrides the recipient on each route with the merchant's address. Kova sponsors gas, so an agent needs only USDC.e. It records to the same `Payment` / `Transaction` tables as NFC and QR. It exposes three things:
- (i) **Pay a payment intent:** `GET /i/:intentId` issues a 402 for the intent's amount, so any MPP client (`tempo request`, AgentCash, Kite, mppx) can pay a Kova POS or QR order.
- (ii) **`@kova/mpp` middleware** for merchants' own APIs: a thin wrapper over `mppx/hono|express|nextjs`.
- (iii) **Hosted paywall/proxy** built on `mppx/proxy` plus `html: true` payment links.

```ts
import { Hono } from 'hono'
import { Mppx, discovery } from 'mppx/hono'
import { Store, tempo } from 'mppx/server'

const charge = tempo.charge({
  currency: USDC_E,
  feePayer: kovaSponsorAccount,                 // Kova pays gas (pull mode)
  feePayerPolicy: { allowKeyAuthorization: true }, // lets a new agent key install itself on its first payment
  store: Store.upstash(upstashClient),          // shared replay store (serverless-safe)
  html: true,                                   // browser "Continue with Tempo" page
  onPaymentSuccess: async ({ challenge, receipt, request }) =>
    ledger.markPaid({ challengeId: challenge?.id, txHash: receipt.reference, request }),
})
const mppx = Mppx.create({ methods: [charge], secretKey: process.env.MPP_SECRET_KEY! })
const app = new Hono()
app.get('/i/:intentId', async (c) => {
  const intent = await intents.getOpen(c.req.param('intentId'))        // 404/409 if paid: never double-charge
  const result = await mppx.charge({
    amount: intent.amount, recipient: intent.merchant.settlementAddress,
    description: `${intent.merchant.name} · ${intent.reference}`,
    meta: { intentId: intent.id }, scope: `intent:${intent.id}`,
    splits: intent.kovaFee ? [{ amount: intent.kovaFee, recipient: KOVA_TREASURY }] : undefined,
  })(c.req.raw)
  if (result.status === 402) return result.challenge
  return result.withReceipt(c.json({ status: 'paid', intentId: intent.id }))
})
discovery(app, mppx, { auto: true, info: { title: 'Kova Pay', version: '1.0.0' } })
```

**60-second demo moment ("Kova Agent Pass").**
1. **0–12 s:** In Kova Pay, create "Research Agent": $50/day, auto ≤ $0.10, approval to $5, merchants = {Kova Café, fal}. A passkey prompt authorizes the Tempo access key, and the dashboard shows the on-chain limit.
2. **12–30 s:** In a terminal, Claude Code using the Kova MCP/SDK pays `$0.02` to Kova Café's `pay.kova.xyz/i/…` and `$0.03` to fal. The Kova Terminal flips to **PAID**, the merchant feed and public metrics increment, and the "agent payments" counter ticks.
3. **30–45 s:** The agent tries a `$0.40` purchase. The phone buzzes, the user taps Approve, it's paid, and the audit log shows who approved.
4. **45–60 s:** The agent tries a non-whitelisted payee: Kova returns `403 not whitelisted`. Then run the raw key directly against a random address: the explorer shows the tx **reverted by Tempo's call scope**. Closing line: *"the chain, not just Kova, enforces the rules."*

For rehearsals, run the same flow on Moderato with `testnet: true`. Use mainnet for the recorded demo, because the catalog services are mainnet-only.

## Gotchas

1. The default mppx fetch polyfill pays **whatever amount the Challenge asks**. Always gate with `prepareRequest`/`onChallenge`, `expectedRecipients` and on-chain limits.
2. TIP-1011 limits are **per token and periodic from authorization time**: `periodEnd = authorize_time + period`, not calendar midnight. There is **no per-transaction cap**. `updateSpendingLimit` does not change `period`.
3. Recipient scoping only works on TIP-20 `transfer` (`0xa9059cbb`), `approve` and `transferWithMemo` (`0x95777d59`). Scope **both** transfer selectors. **Inference:** mppx may send an attribution memo, which means `transferWithMemo`.
4. `setAllowedCalls` is **root-key-only** (TIP-1011). Adding a merchant to the on-chain whitelist needs a passkey prompt or a fresh key. Keep the on-chain set small and stable, and let Kova policy handle the long tail.
5. Access-key spending limits apply to `transfer`/`transferWithMemo`/`approve` and to reserve deposits (T5 implicit approvals). They do **not** apply to `transferFrom` or native value transfers. Source: https://tempo.xyz/developers/docs/protocol/transactions/AccountKeychain
6. Channels don't auto-close; the deposit stays locked. The payer's escape route is `requestClose` → `withdraw` after the grace period (use `tempo wallet sessions close --orphaned`). Legacy (v1) and v2 session channels are not interchangeable.
7. **Docs drift:**
   - Tempo's streamed-payments page calls `tempo.session({…}).sse()`, while mpp.dev puts `.sse()` on `tempo.session.manager()`.
   - Tempo's pay-as-you-go server snippet omits `account` and `store`, which mpp.dev lists (`account` is required).
   - Trust mpp.dev plus the installed `.d.ts`, and pin `mppx@0.10.1`. 0.10.0 changed `expectedRecipients` semantics.
8. `Provider.create()` from `accounts` **enables MPP by default** (a global fetch polyfill). Use `Provider.create({ mpp: false })` when you also configure mppx, or 402s are handled twice.
9. `Store.memory()` is single-process only. On Vercel or multiple instances, use Upstash/Redis/Cloudflare for replay protection and sessions. Zero-amount proofs are replayable without a store.
10. Challenges from `tempo.charge` expire in **5 minutes** by default. Human approval must finish within that window, or re-fetch and re-validate against the approved terms.
11. `waitForConfirmation: false` returns receipts after simulation only. Don't use it for POS "PAID" screens.
12. The Tempo Wallet CLI works on **mainnet with real funds**. `--max-spend` is client-side only, and the login key lasts 30 days and sits on disk.
13. Browser polyfill: `acceptPaymentPolicy` defaults to same-origin. Cross-origin paid APIs need `{ origins: […] }`. **Inference:** servers must expose `WWW-Authenticate` and `Payment-Receipt` over CORS.

## Open questions

- Exact server-side plumbing when Kova holds the agent key. `wallet_authorizeAccessKey` returns a signed `keyAuthorization`. Is it attached to the key's first tx (through a `keyAuthorizationManager` on `Account.fromSecp256k1`), or submitted by the root key? Coordinate with the access-keys doc.
- Do transaction fees paid in a stablecoin by an access-key tx count against that key's spending limit? Kova sponsoring fees on its own merchants avoids this, but third-party servers may not sponsor.
- Can T6 **admin access keys** call `setAllowedCalls`? TIP-1011 says root-only. If admin keys can, Kova could update merchant whitelists without a passkey prompt (at a custody cost).
- Does the mppx Tempo charge client use `transfer` or `transferWithMemo`? Test on Moderato before shipping scopes.
- Does mode B (`onChallenge` returning a remote Credential, with `tempo.charge()` configured without an account) work end-to-end? Spike it.
- What are the USDC.e (or equivalent) test-token addresses on Moderato, and does the Tempo API relay (`/v1/mpp/*`) support testnet?
- Does wallet.tempo.xyz apply a default spending limit to CLI login keys? Is there a maximum number of recipients per `SelectorRule`? (Gas is 2 slots per recipient.)
- What is MPPScan's methodology (MPP only, or x402 too; charges only)? Which time window does "Volume" use on other tabs?

## Sources

- MPP docs (mpp.dev, fetched 2026-09-19 via `llms-full.txt`): `/overview`, `/governance`, `/faq`, `/protocol`, `/protocol/http-402`, `/protocol/challenges`, `/protocol/credentials`, `/protocol/receipts`, `/protocol/transports/http|mcp|websocket`, `/intents/charge|session|subscription`, `/payment-methods`, `/payment-methods/tempo`, `/payment-methods/tempo/charge|session|subscription`, `/payment-methods/stripe`, `/payment-methods/card`, `/sdk`, `/sdk/features`, `/sdk/typescript/client/Mppx.create|Mppx.preparePayment|Mppx.prepareRequest|Method.tempo|Method.tempo.charge|Method.tempo.session-manager`, `/sdk/typescript/server/Mppx.create|Method.tempo.charge|Method.tempo.session`, `/quickstart/server|client|agent`, `/guides/managing-agent-spend`, `/advanced/relays|discovery|refunds|security`, `/tools/wallet`, `/extensions`, `/guides/building-with-an-llm`
- Tempo docs: https://tempo.xyz/developers/docs/guide/machine-payments/ (+ `/agent`, `/discover-services`, `/pay-as-you-go`, `/streamed-payments`), `/wallet/`, `/wallet/use-with-agents`, `/wallet/reference`, `/wallet/recipes`, `/cli/wallet`, `/cli/request`, `/api/mpp`, `/api/rate-limits`, `/protocol/upgrades/t3`, `/protocol/upgrades/t5`, `/protocol/upgrades/t7`, `/protocol/tips/tip-1011`, `/protocol/transactions/AccountKeychain`, `/sdk/foundry/mpp`
- Specs and code: https://github.com/tempoxyz/tempo/blob/main/tips/tip-1034.md, `tips/verify/src/interfaces/ITIP20ChannelReserve.sol`, `tips/verify/src/TIP20ChannelReserve.sol`; https://github.com/tempoxyz/mpp-specs; https://paymentauth.org; https://datatracker.ietf.org/doc/draft-ryan-httpauth-payment/; https://github.com/tempoxyz/wallet-cli (v0.11.0: `src/provider.ts`, `src/commands/request.ts`, `src/commands/identity.ts`, `SKILL.md`); https://github.com/wevm/mppx (CHANGELOG 0.10.1)
- Packages (verified 2026-09-19): npm `mppx@0.10.1`, `accounts@0.18.4`, `viem@2.56.8`, `@privy-io/agent-wallet-cli@0.3.6`, `@stripe/link-cli@0.21.0`, `agentcash@0.17.1`; PyPI `pympp@0.11.0`; crates.io `mpp@0.12.0`; `tempoxyz/mpp-go` v0.2.0
- Ecosystem data: https://mpp.dev/api/services (catalog JSON, 2026-09-19); https://www.mppscan.com (7-day `protocolStats`, 2026-09-19)
