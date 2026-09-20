# Decisions

This is the running log required by the brief (§17). Newest entries go at the top.

**Status values:**
- **Decided**: final.
- **Proposed**: the default, but open to challenge.
- **Needs owner**: needs a money, legal or product call.

---

## 2026-09-19

### D-009 · The Kova payment path is proven on Moderato testnet (Decided)
**What ran** (`packages/tempo/test/e2e/payment.e2e.test.ts`, live on chain 42431):
- A sponsored `transferWithMemo` settled and passed `verifyPayment`: **304,795 gas**, about 4.2 s end to end. The gas includes the one-off cost of a merchant's first balance in a token; the latency includes testnet relay round trips.
- A **simulated card** (P-256, SHA-256-then-ECDSA, DER out, exactly what a JavaCard produces) was authorized as an access key with a $50/day limit scoped to `transferWithMemo`, and paid: **83,782 gas**, matching the 81,618 the research measured.
- A **freeze** (spending limit set to 0) blocked the next tap.

**Why it matters:** the card design, fee sponsorship, memo reconciliation and receipt verification are no longer theory. Remaining unknown: real JavaCard hardware.

## 2026-09-20

### D-010 · No GrapheneOS. Stock Android is the target (Decided)
**Decision:** Kova Terminal and Kova Pay target stock Android. GrapheneOS is dropped.

**Why:** it was only ever there to make the stack open-source down to the OS. It changes nothing technically (stock Android already gives our app the NFC access we need), the open-source judging criterion is met by our own public code, and installing it wipes the device, which rules out borrowed phones. Revisit only if "runs on a de-Googled phone" becomes a real merchant-facing selling point.

**Consequence:** any Android phone with NFC will do, so a used ₦120–200k device is enough. No need for a Pixel specifically.

### D-008 · Terminal: SUNMI V3 (NFC SKU), with a GrapheneOS Pixel as fallback (Proposed, needs a purchase decision)
**Decision:** buy one SUNMI V3 in an **NFC part number** (e.g. P06100058 UK, P06100077 EU; US: V3 Plus with the +$50 NFC option). SUNMI's docs say the V3's NFC is the *native Android NFC module*, so `react-native-nfc-manager` with `IsoDep` can talk to the Kova Card without a vendor SDK. It has a 58 mm printer with a maintained React Native wrapper.

**Rejected:** every PCI/EMV terminal (PAX A920, SUNMI P-series, Nexgo, Newland, Castles). They refuse unsigned apps, and their contactless reader is locked behind a secure-processor SDK that only speaks to bank cards.

**Fully-open alternative:** a carrier-unlocked Pixel on GrapheneOS plus a Bluetooth ESC/POS printer. It's the fallback and the second terminal, since the team has no Android device at all. A Raspberry Pi build is documented but is a post-hackathon project.

**Risks:** NFC is a **paid option**, so order by part number, never model name. SUNMI can restrict installing your own apps on channel-bound units, so buy new, get written confirmation, and run the on-arrival test in `docs/hardware/pos-terminal.md` within the first hour.

### D-007 · Card signing requires Kova approval inside the applet (Proposed)
**Decision:** The Kova Card applet signs a payment digest only when it comes with a valid Kova approval signature over `digest ‖ counter`.

**Why:** Tempo's fee-payer co-signature doesn't restrict what the card signs (docs/tempo/02). Without this check, anyone who can get a signature from the card could spend within the key's on-chain limits. With it:
- Kova's policy can't be bypassed.
- Kova can freeze a card instantly, off-chain, without holding the user's admin key, so Kova stays non-custodial.
- Merchant allowlists don't have to live on-chain.

**Cost:** The POS makes one extra API round trip before the tap.

**Still to check:** a real JCOP card must verify P-256 inside the applet.

### D-006 · Agents use Kova-held access keys behind a policy gate, paying over MPP (Proposed)
**Decision:** Each agent gets a Tempo access key that the user authorizes with their passkey.
- **On-chain limits:** a per-period cap on USDC.e, with calls scoped to `transfer`/`transferWithMemo`.
- **Kova policy (before any `mppx` signing):** the per-request cap, the whitelist and human approval.
- **Merchants:** they accept agent payments through a Kova-hosted `mppx` server.

See docs/tempo/05.

### D-005 · Confirm payments from the synchronous receipt, plus a WebSocket watcher (Decided)
**Decision:**
- **Payments Kova submits:** send with `eth_sendRawTransactionSync`. The receipt is final. Check its logs for token, recipient, amount and memo, and confirm the funds were not redirected by the recipient's receive policy.
- **Payments from outside wallets:** a WebSocket log watcher, with `eth_getLogs` to catch up after gaps.
- **Reconciliation:** check against `GET /v1/transfers`.

**Why:** Tempo webhooks need Console access (invite-only) and scopes that aren't self-serve, and they have no backfill. They get added later as a backup channel.

### D-004 · Every payment is `transferWithMemo` with the fixed Kova memo; QR uses virtual addresses (Decided)
**Decision:** The 32-byte memo is laid out as `"KOVA" | ver | kind | merchant | PaymentIntent UUID` (docs/tempo/03 §4). QR checkout from outside wallets pays to a virtual address created for that PaymentIntent. Refunds are new `transferWithMemo` payments that carry the same intent UUID.

### D-003 · Kova pays every user's gas from its own fee payer (Decided)
**Decision:** Kova runs a self-hosted relay (`tapimo/server` `Handler.relay` or a viem `feePayer` account) with a secp256k1 key held in secret storage.
- It co-signs only allowed transfers to registered merchants.
- It simulates each payment before co-signing, because the fee payer is still charged when a transaction reverts.

**Why:** It's about $0.00003 per payment, and we don't have to wait for Console access. Testnet uses `sponsor.moderato.tempo.xyz`.

### D-002 · Settle in USDC.e and accept pathUSD (Decided)
**Decision:** The API's `currency: "USDC"` maps to USDC.e (`0x20C0…8b50`), because Tempo mainnet has no native USDC. Token addresses are configured per network. On testnet, pathUSD or AlphaUSD stands in for USDC.e, because the faucet doesn't hand out USDC.e.

### D-001 · Build on Tempo mainnet, entering the Crypto World's Fair Tempo track (Decided)
**Decision:** The chain is Tempo (mainnet 4217, testnet Moderato 42431). This follows the brief.

**Why:** Colosseum's Crypto World's Fair runs across several chains and has a $100k Tempo track. Tempo's mainnet is live, its transactions finalize in under a second, fees are paid in stablecoins, and it has access keys, memos and MPP, which cover Kova's needs natively. The submission deadline is 2026-10-12 11:59pm PT.
