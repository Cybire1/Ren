# Kova on Tempo: research index

Researched **2026-09-19** from:
- the official docs (`tempo.xyz/developers`, `mpp.dev`);
- the published SDK source (`viem`, `ox`, `accounts`, `tapimo`, `mppx`) and `tempoxyz/tempo`;
- live checks against mainnet and the Moderato testnet.

The card signing flow in 02 was run end-to-end on Moderato, using a software key that behaves like the card.

> **Tempo moves fast.** It shipped 10 network upgrades (T2–T11) in six months, and its own docs are already stale in places (see [Stale docs](#stale-docs-trust-these-files-over-the-tempo-docs)). Re-verify anything here before relying on it after about October 2026.

| File | Covers |
|---|---|
| [01-network-sdks-funding.md](01-network-sdks-funding.md) | Networks, RPCs, upgrade status, differences from Ethereum, system addresses, which stablecoins exist, funding and bridges, SDK versions, React Native support |
| [02-transactions-accounts-keys.md](02-transactions-accounts-keys.md) | Tempo Transaction (type `0x76`), signature encodings, Account Keychain / access keys, fee sponsorship, passkeys, **whether the Kova Card design works** |
| [03-payments-tokens-fees.md](03-payments-tokens-fees.md) | TIP-20, memos, virtual addresses, receive policies, fees, refunds, DEX, compliance, **Kova payment flows** |
| [04-api-platform-data.md](04-api-platform-data.md) | Tempo API (invite-only), webhooks, indexer, hosted vs self-hosted fee payer, RPC, Routes, **recommended backend integration** |
| [05-mpp-agent-payments.md](05-mpp-agent-payments.md) | Machine Payments Protocol, `mppx`, the Tempo Wallet CLI, **Kova agent-payments design** |

---

## Key facts

| | Value | Where |
|---|---|---|
| Mainnet | chain `4217`, `https://rpc.tempo.xyz`, `wss://rpc.tempo.xyz`, explorer `https://explore.tempo.xyz` | 01 §1 |
| Testnet (Moderato) | chain `42431`, `https://rpc.moderato.tempo.xyz`, free fee sponsor `https://sponsor.moderato.tempo.xyz` | 01 §1 |
| Speed | ~0.56 s blocks, deterministic finality: a receipt is final | 01 §1.2, 03 §3 |
| Gas token | **None.** Fees are paid in USD stablecoins. `eth_getBalance` returns a meaningless huge number, so never use it | 01 §2 |
| "USDC" | **USDC.e** `0x20C000000000000000000000b9537d11c60E8b50` (Stargate-bridged, 6 dp). There is no native USDC. Every MPP service accepts it | 01 §4 |
| Other USD tokens | pathUSD `0x20c0000000000000000000000000000000000000`, USDT0 `0x20c00000000000000000000014f22ca97301eb73` | 01 §4 |
| Testnet tokens | The faucet gives pathUSD / AlphaUSD / BetaUSD / ThetaUSD, **not** USDC.e, so the token map has to change per network | 01 §4.3 |
| Cost per payment | Memo transfer ≈ **$0.00003**. Card payment 81.6k gas ≈ **$0.00005**. At the fee cap it's up to 20× more (~$0.0006–0.001). A merchant's first receipt of a token adds ~250k gas | 03 §7, 02 |
| Payment primitive | TIP-20 `transferWithMemo(to, amount, bytes32 memo)`, selector `0x95777d59` | 03 §2 |
| Access keys | P-256 keys are allowed. Limits are per token, either lifetime or per period. Keys can be scoped to specific calls and recipients. **No per-transaction cap. Revoking is permanent.** A limit of 0 acts as a reversible freeze | 02 §3 |
| Fee payer | Must be a **secp256k1** key. Uses no nonce. **Pays for reverted transactions**, so simulate before co-signing | 02 §4 |
| Receipt ≠ paid | Since T6, a merchant's receive policy can redirect funds to `0xB10C…` while the tx still succeeds. Always check the recipient in the logs. Ignore the fee `Transfer` to `0xfeec…` | 03 §3, §6 |
| Tempo API | `https://api.tempo.xyz`. The **Console is invite-only**, and webhook and deposit-address scopes aren't self-serve | 04 §1 |
| SDKs | `viem@2.56.8` (`viem/tempo`), **`ox` pinned to 0.14.45** (don't use 1.x), `accounts@0.18.4` (Expo **dev build**), `tapimo@0.15.1` (`tapimo/server`), `mppx@0.10.1` | 01 §6 |
| T11 rule | System contracts reject calldata with extra bytes appended. No `dataSuffix` or attribution bytes on transfers | 01 |

---

## How Kova uses Tempo (recommended)

1. **Settle in USDC.e on mainnet** and accept pathUSD too. The API keeps `currency: "USDC"` as an alias for USDC.e. On testnet, use pathUSD or AlphaUSD as the stand-in.
2. **Non-custodial.** Each user has a Tempo account whose root key is a passkey (Accounts SDK in Kova Pay). Each merchant receives into their own account, and Kova never holds either one's funds. This keeps most money-transmission exposure out of the hackathon build.
3. **Kova pays all gas.** Run a self-hosted fee payer (`tapimo/server` `Handler.relay`, or a viem `feePayer` account). Its key is a secp256k1 key kept in secret storage. The relay only co-signs allowed `transferWithMemo` calls to registered merchants, and only after simulating them. Budget: 1M payments/month ≈ $31 at today's fee, ≈ $620 at the cap. The hosted Fee Payer API is an upgrade for later.
4. **Every payment is a `transferWithMemo`** with the fixed 32-byte Kova memo:
   ```
   "KOVA" | version | kind | merchant id | PaymentIntent UUID
   ```
   See 03 §4. QR checkout from outside wallets uses a **virtual address per PaymentIntent** (live on mainnet), so a plain transfer is matched to its intent with no memo needed.
5. **Confirmation:**
   - For transactions Kova submits (app, card, refunds), `eth_sendRawTransactionSync` returns a final receipt in about 1 block. Verify token, recipient, amount and memo, then mark PAID.
   - For outside-wallet payments, a WebSocket log watcher catches them, with `eth_getLogs` to catch up after gaps.
   - Reconcile against `GET /v1/transfers`. Add Tempo webhooks once access is granted.
6. **Every card, app and refund transaction uses expiring nonces** (`validBefore ≤ now+300s`). They never fight over a sequential nonce, and a transaction not included by its expiry can never land, which makes POS retries safe.
7. **Agents:** Kova holds each agent's access key, which the user authorizes once with their passkey. The key carries on-chain limits: a daily cap on USDC.e, scoped to `transfer`/`transferWithMemo`. Kova's policy gate sits in front of `mppx` and adds the $0.10-per-request cap, the recipient whitelist and push-to-approve. Kova merchants accept agent payments through a Kova-hosted `mppx` server (05).

## Kova Card: it works, with one design decision to make

**Verified on Moderato (02):** a P-256 key registered as an access key under a passkey root signed a card-style `transferWithMemo`. A separate Kova key paid the fee, and the card was then frozen and revoked. The signer was Node `crypto.sign('sha256')`, which gives the same output as JavaCard `ALG_ECDSA_SHA_256`. **No real JCOP card has been tested yet.** The POS/backend must:

1. Send the card `D = keccak256(0x04 ‖ sigHash ‖ userAccount)`, from `TxEnvelopeTempo.getSignPayload(tx, { from })`, not the raw transaction hash.
2. Convert the card's DER signature to raw `r ‖ s` and set `s = n − s` when `s > n/2`. Without this, about half of all taps fail.
3. Set `pre_hash = 1` and register the key as type **P256 (1)**, not WebAuthn.

**The finding that matters:** the card signs whatever digest it's handed, and Kova's fee-payer co-signature doesn't restrict it. Anyone who gets a card signature can pay the fee and broadcast it themselves. Without more, the only hard protection is the key's on-chain limits and scope.

**Recommendation: Kova-approved signing in the card applet** (proposed; see [DECISIONS.md](../../DECISIONS.md)):

1. At provisioning, the applet stores Kova's approval public key.
2. At checkout, the POS asks the Kova API for approval. Kova runs policy and simulation, then returns `D` plus a Kova signature over `D ‖ card counter`.
3. The card signs `D` only if that approval verifies.

What this gives us:
- **Kova's policy can't be bypassed.** A skimmer can't get a usable signature.
- **Kova can freeze a card instantly without being custodial.** It simply refuses approvals, and needs no admin key over the user's account.
- **On-chain backstops stay in place.** The per-period limit plus expiry still cap losses if Kova itself is compromised, and the user can still freeze on-chain (limit = 0) or revoke from the app with their passkey.
- **No on-chain merchant allowlist is needed**, which sidesteps its estimated ~50-merchant-per-key ceiling.

The cost is one extra round-trip before the tap. The POS has to be online to broadcast anyway. **Inference:** JCOP cards support P-256 ECDSA verification (`ALG_ECDSA_SHA_256`), so the applet check should be feasible. Confirm on real cards.

---

## Test first on Moderato

These are the open questions across all five files, in the order that matters for the build:

1. **A real JCOP card signing a V2 digest with `pre_hash = 1`.** Only a software stand-in has been tested so far. This is the riskiest assumption.
2. The Accounts SDK in an **Expo dev build on Android**: creating a passkey account, adding an access key, and `wallet_deposit`.
3. Whether **gas fees count against an access key's spending limit**.
4. Whether `mppx` charges send `transfer` or `transferWithMemo`, which decides how agent keys are scoped.
5. The gas cost and proof-of-work time for **registering a virtual-address master**, plus derivation per intent.
6. Webhook latency and finality semantics, once Console access arrives.
7. Whether Tempo's hosted fee payer accepts card-signed transactions. This doesn't matter while we self-host.

## Action items for people (not code)

- **Request Tempo API Console access** at https://tempo.xyz/contact/. Ask for `webhooks:read`/`webhooks:write` and `routes:write`, plus a higher `data:read` limit.
- **Fund mainnet:** bridge USDC from Base or Ethereum (Stargate/Relay/Across) so it arrives as USDC.e. About $5 funds the fee payer for 100k+ payments; the rest goes to demo wallets.
- **Order about 5 JCOP4 JavaCard cards** (P-256 ECDSA) and a PC/SC USB reader to prove the card on testnet before ordering 20–50.

## Hackathon: Tempo track

- Colosseum **Crypto World's Fair**, Sept 14 – **Oct 12 2026, 11:59pm PT**. Winners are announced by Dec 5.
- **Tempo track:** $100k across the 10 best products that integrate with Tempo.
- Kova can also compete for the overall awards: Grand Champion $30k, plus $15k each for the next 20 teams.
- Judging criteria: **functionality and code quality, potential impact, novelty, UX, open-source and composability, business plan.**
- Every team member must register on colosseum.com. One team, one submission. Everything must be in English.
- Source: official rules PDF (https://colosseum.com/legal/Crypto%20World's%20Fair%20Hackathon%20Rules.pdf).

## Stale docs: trust these files over the Tempo docs

- `import { Handler } from 'tapimo'` → it's actually `tapimo/server` (or `accounts/server`) in 0.15.1.
- The Python and Go examples use the wrong `transferWithMemo` selector. The correct one is `0x95777d59`.
- Examples that pair chain `4217` with AlphaUSD are wrong: AlphaUSD doesn't exist on mainnet.
- Hardcoded `gas: 100000` isn't enough for a first transfer to a new address (~281k gas).
- TIP-1010's "$0.001 per transfer" predates the T7 dynamic base fee.
- Official examples disagree on memo padding. Use the fixed Kova layout.
- The Go SDK docs say v0.3.0, which predates T3; use v0.5.0.
- `tempo-foundry` is deprecated; use upstream Foundry with `forge init -n tempo`.
- The MPP streaming and pay-as-you-go examples on tempo.xyz lag behind mpp.dev. Trust mpp.dev and `mppx@0.10.1` types.
