# Tempo: Transactions, Accounts & Access Keys

Every Kova payment is a **Tempo Transaction**, EIP-2718 type **`0x76`**. It carries an atomic `calls[]` batch, 2D or **expiring nonces** (`nonceKey = 2²⁵⁶−1`, `validBefore ≤ now+300 s` since T11), a `validAfter`/`validBefore` window, a fee-token field, an optional **fee-payer co-signature** (secp256k1 only, domain byte `0x78`), and an optional inline `key_authorization`. The sender can sign with secp256k1, **raw P-256** (`0x01`, with a `pre_hash` flag), or **WebAuthn** (`0x02`). An **access key** signs through a **Keychain V2** envelope (`0x04`), which is mandatory since T1C. The inner signature covers `keccak256(0x04 ‖ sigHash ‖ rootAccount)`, not the tx hash itself. Access keys live in the **AccountKeychain precompile** (`0xAAAAAAAA00000000000000000000000000000000`) and support expiry, per-token one-time or periodic limits, and call scopes down to `(token, selector, recipient allowlist)`. Revocation is permanent. **Verdict: the proposed JavaCard design works on Tempo mainnet today, provided the POS does three things:** send the card the V2 keychain digest (not the raw tx hash), convert DER to raw `r‖s` and **normalize to low-s**, and set `pre_hash = 1`. I verified this end-to-end on Moderato on 2026-09-19 with a JavaCard-equivalent signer (node `crypto.sign('sha256')`, which outputs DER with random s) and a passkey-type root account. The card was authorized and paid via transferWithMemo, the payment was sponsored by a separate secp256k1 key, and the card was revoked. High-s and `pre_hash = 0` signatures were rejected. **The biggest design finding is not about encoding. It is about trust.** The card is a blind signer. The sender signature does not commit to *who* sponsors, so Kova's co-signature is **not** an enforcement point. Security rests entirely on the on-chain scope, limits and expiry, plus any policy Kova builds into the card applet.

Verified against: tempo.xyz docs (downloaded 2026-09-19), `tempoxyz/tempo@5d53ec1` (2026-09-19), `viem@2.56.8` / `ox@0.14.45` (the ox version viem pins), `accounts@0.18.4`, `tapimo@0.15.1`, and live Moderato (42431) transactions (§Sources). All features below are **active on both mainnet (4217) and Moderato**: T1C Mar 12, T3 Apr 27, T6 Jun 23, and T11 Sep 10 2026 on mainnet [UPG][T3][T6][T11]. Exceptions are noted where they apply.

## What Kova needs from this

- **The card key is a Tempo access key of type P256 (`1`)**, `keyId = last20(keccak256(X ‖ Y))`. Do **not** register it as WebAuthn (`2`). The inner signature type must match the stored type (`SignatureTypeMismatch`) [KC][FOUNDRY].
- **The POS must send this to the card:** `D = keccak256(0x04 ‖ sigHash ‖ userAccount)`. The raw tx signing hash is wrong: V1 keychain signatures have been invalid since T1C [RS-SIG][UPG]. In ox this is `TxEnvelopeTempo.getSignPayload(tx, { from: userAccount })`.
- **Card output → Tempo:** DER → 32-byte `r`, 32-byte `s`, then `if s > n/2: s = n − s`, then set `pre_hash = 1`. Skipping the low-s step makes **~50% of taps fail**, and a wrong `pre_hash` or a non-V2 digest makes **every** tap fail, I verified the high-s and `pre_hash` failures live ("invalid transaction signature"). The V1 rejection comes from `validate_version` in [RS-SIG].
- **Use expiring nonces** (`nonceKey = maxUint256`, `nonce = 0`, `validBefore ≤ now+300`) so card, app and refund transactions never contend for a sequential nonce. The fee payer consumes **no** nonce.
- **Sponsor from a Kova secp256k1 key** (fee payers must be secp256k1). That key signs `keccak256(0x78 ‖ rlp(…, feeToken, sender, …))`. It works for card-signed transactions (verified). **Simulate before co-signing:** scope and limit violations are *included and reverted*, so the sponsor pays for them (verified).
- **Freezing:** `revokeKey` is permanent; that keyId can never be re-authorized. For a reversible freeze use `updateSpendingLimit(key, token, 0)` and restore later (verified), or `removeAllowedCalls`. Every mutation needs the **root passkey or an admin key**. Kova's backend cannot freeze a card on its own unless it holds an admin key. Holding one would effectively make Kova custodial (see Gotchas).
- **The card can be scoped to `transferWithMemo` (`0x95777d59`) on one token, with a merchant recipient allowlist.** There is **no native per-transaction cap**, only per-token lifetime or per-period caps. Enforce a per-transaction cap in the applet or in Kova's policy.
- **Plan the SDK around `viem/tempo` + `ox/tempo`.** Pin `ox` to viem's version (0.14.x); ox 1.x has a different API and broke my script. The Accounts SDK (`accounts`) supports passkeys and Expo.

---

## 1. Tempo Transaction (type `0x76`)

Sources: [SPEC], [GUIDE], [RS-TX], [RS-SIGNED], [RS-HANDLER], [TIP1009], [TIP1093], [T11], [TIP1000].

### 1.1 Fields and envelope

```
0x76 || rlp([
  chain_id, max_priority_fee_per_gas, max_fee_per_gas, gas_limit,
  calls,                  // [[to, value, input], ...]  — non-empty list
  access_list,            // EIP-2930
  nonce_key,              // U256: 0 = protocol nonce, 1..2²⁵⁶−2 = 2D keys, 2²⁵⁶−1 = expiring
  nonce,                  // u64
  valid_before,           // u64 seconds, 0x80 if None
  valid_after,            // u64 seconds, 0x80 if None
  fee_token,              // address, 0x80 if None
  fee_payer_signature,    // 0x80 if None, else rlp list [v, r, s] (secp256k1)
  aa_authorization_list,  // EIP-7702-style auths, any Tempo signature type
  key_authorization?,     // ONLY encoded when present (no placeholder byte)
  sender_signature        // TempoSignature bytes (§2)
])
```
This is quoted from [SPEC] "RLP Encoding" and matches `rlp_encode_fields` in [RS-TX].

- **Validation rules** from [RS-TX] `validate_calls` / `validate` and [RS-HANDLER]:
  - `calls` must be non-empty.
  - Only the *first* call may be CREATE, and none may be CREATE if `aa_authorization_list` is non-empty.
  - `valid_before > valid_after` when both are set.
  - **Every `call.value` must be 0** (`ValueTransferNotAllowedInAATx`). Tempo has no native token.
- **Atomicity:** `calls: Vec<Call> // Batch of calls to execute atomically` [SPEC]. One failing call reverts the whole batch. The fee is still charged.
- **Scheduling:** the tx can only be included when `block.timestamp >= valid_after` and `block.timestamp < valid_before` [RS-TX doc comments]. For a signed-now, execute-later tx, see [GUIDE §Scheduled Transactions].
- **Fee token:** fees are paid in a USD TIP-20. The token is resolved in this order: tx `fee_token` > fee payer's `setUserToken` preference > the called TIP-20 (only when *all* calls are `transfer`/`transferWithMemo`/`startReward` on the same token and fee payer == sender) > pathUSD [FEES]. Under sponsorship the **fee payer** chooses (§4).

### 1.2 Signing hash (what the sender signs)

The code is authoritative here: `encode_for_signing` in [RS-TX], mirrored by `TxEnvelopeTempo.getSignPayload` in ox.
```
sigHash = keccak256( 0x76 || rlp([
  chain_id, max_priority_fee_per_gas, max_fee_per_gas, gas_limit, calls, access_list,
  nonce_key, nonce, valid_before|0x80, valid_after|0x80,
  sponsored ? 0x80 : (fee_token|0x80),     // sender does NOT sign fee_token when sponsored
  sponsored ? 0x00 : 0x80,                 // single byte 0x00 = "a fee payer will sign"
  aa_authorization_list,
  key_authorization?                       // included if present
]))
```
- ⚠️ The [SPEC] pseudo-code for `sender_hash` omits `aa_authorization_list` and `key_authorization`. The code includes both.
- ⚠️ The [GUIDE] fee-sponsorship "RLP" block uses `0x77` for the user envelope and `0x76` for the fee-payer envelope. **That is wrong or outdated.** The code uses `0x76` (sender) and `0x78` (fee payer) (`TEMPO_TX_TYPE_ID`, `FEE_PAYER_SIGNATURE_MAGIC_BYTE` in [RS-TX]).
- The access-key digest is layered on top of `sigHash`: see §2.2.

### 1.3 Nonces

| Mode | Fields | Intrinsic nonce gas (code) | Notes |
|---|---|---|---|
| Protocol | `nonce_key = 0` | 0 (**+250,000** if `nonce == 0`, i.e. account's first tx — TIP-1000) | Sequential, in account state |
| 2D | `nonce_key ∈ [1, 2²⁵⁶−2]` | +5,000 existing key; **+250,000 when `nonce == 0` (new key)** | Stored in Nonce precompile `0x4E4F4E4345000000000000000000000000000000`, `getNonce(account, key)`; keys with top byte `0x5b` reserved |
| Expiring | `nonce_key = 2²⁵⁶−1`, `nonce = 0`, `valid_before` required | **+13,000** | Replay protection via ring buffer; no nonce state |

Sources: [SPEC] §Parallelizable Nonces, [TIP1009], [TIP1000], and `validate_aa_initial_tx_gas` in [RS-HANDLER]. The [SPEC] table value of "22,100 for new key" is superseded by TIP-1000's 250,000.

- **Expiring window:** TIP-1009 rules plus T11/TIP-1093: `now < validBefore ≤ now + 300`, where `now` is the block timestamp. Before T11 the limit was 30 s. The buffer holds 3,000,000 entries. The Foundry doc still says "max 30s", which is stale [FOUNDRY].
- **Replay ID:** `keccak256(encode_for_signing ‖ sender)` [RS-SIGNED]. It is invariant to the fee-payer signature and to signature malleability. **Two taps that produce byte-identical payloads dedupe**, so vary the memo or `validBefore`.
- **TIP-1106** (expiring-nonce discriminators via `nonce`, T12) is **Draft**, and T12 is not scheduled.

### 1.4 Gas (intrinsic, from `calculate_aa_batch_intrinsic_gas` in [RS-HANDLER] and the [SPEC] tables)

Components:
- 21,000 base.
- Signature: +0 secp256k1, **+5,000 P256**, +5,000 + calldata-cost(webauthn_data) WebAuthn, **+3,000 Keychain wrapper**.
- Nonce mode, per §1.3.
- +2,600 cold-access per extra call.
- Calldata tokens.
- Key authorization (§3.6).

Any new storage slot, such as a recipient's first balance, costs ~250,000 (TIP-1000).

**Measured on Moderato** (keychain-P256 card payment, sponsored, expiring nonce):
- 81,618 gas when paying a merchant who already has a balance.
- 330,930 gas for the first payment to a fresh merchant address.

At the 6×10⁸ attodollar/gas base fee seen on both networks today, that is about **$0.00005** and **$0.0002**.

---

## 2. Signature types

Sources: [SPEC] §Signature Types/Address Derivation/Gas, [RS-SIG], [TIP1020], ox `SignatureEnvelope`.

### 2.1 Wire formats (exact, `PrimitiveSignature::encode_bytes_into` / `TempoSignature::from_bytes`)

| Type | Wire bytes | Length |
|---|---|---|
| secp256k1 | `r(32) ‖ s(32) ‖ v(1)` — **no prefix** | exactly 65 (length is the discriminator) |
| P256 | `0x01 ‖ r(32) ‖ s(32) ‖ pubX(32) ‖ pubY(32) ‖ pre_hash(1)` | exactly 130 |
| WebAuthn | `0x02 ‖ authenticatorData ‖ clientDataJSON ‖ r(32) ‖ s(32) ‖ pubX(32) ‖ pubY(32)` | 129–2049 (parse last 128 bytes backwards) |
| Keychain V1 | `0x03 ‖ userAddress(20) ‖ inner` | **rejected since T1C** |
| Keychain V2 | `0x04 ‖ userAddress(20) ‖ inner primitive sig` | P256 inner → 151 bytes |

- `r` and `s` are **raw 32-byte big-endian scalars, not DER**. The verifier concatenates `r‖s` into a 64-byte fixed signature (`ECDSA_P256_SHA256_FIXED` / `p256::Signature::from_slice`) [RS-SIG].
- `pre_hash` encodes as `0x01` / `0x00`. Any non-zero byte decodes as true.
- A keychain inner signature cannot itself be a keychain signature.

### 2.2 What is verified

- **P256.** `message = pre_hash ? sha256(sigHash) : sigHash`, then P-256 verify of `(r, s)` against `(pubX, pubY)` over that 32-byte **digest, with no further hashing** [RS-SIG]:
  > "Tempo verifies already-computed 32-byte message digests."

  The address is `derive_p256_address(pubX, pubY)`.
- **Pre-hash flag.** From [SPEC]:
  > "If `pre_hash` is set to `true`, then before verification: `digest = sha256(digest)`."

  This is exactly how viem's WebCrypto accounts work: `fromWebCryptoP256` serializes with `prehash: true`, because WebCrypto hashes with SHA-256 before signing (viem `tempo/Account.ts`).
- **Low-s is mandatory. High-s is rejected, not normalized** [RS-SIG `verify_p256_signature_internal`]:
  > `if U256::from_be_slice(s) > P256N_HALF { return Err("P256 signature has high s value"); }`

  `n = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551`. The same applies to WebAuthn and to the SignatureVerifier precompile (TIP-1020 invariant SV2). Signers must normalize: `normalize_p256_s` in [RS-SIG] says the p256 crate "does not guarantee low-s". ox's `WebCryptoP256.sign` does the flip itself. **ox `SignatureEnvelope.serialize` does not**, so Kova must.
- **WebAuthn.** The verifier requires:
  - authenticatorData of **exactly 37 bytes**;
  - UP *or* UV set, AT not set, ED not set;
  - `clientDataJSON.type == "webauthn.get"`;
  - `challenge == base64url(sigHash)`, unpadded.

  It then computes `messageHash = sha256(authData ‖ sha256(clientDataJSON))`. It does **not** check origin, rpId hash, signCount or backup flags [RS-SIG][SPEC].
- **Keychain V2.** The inner signature is verified over `keccak256(0x04 ‖ sigHash ‖ userAddress)` (a 53-byte preimage) [RS-SIG `KeychainSignature::signing_hash`]. For P256 inner signatures, `pre_hash` applies on top of that digest. The handler then requires `userAddress == tx.caller`, loads the key, and checks: not revoked, `now < expiry`, and signature type equals the stored type [RS-HANDLER].

### 2.3 Address derivation

- **secp256k1:** standard Ethereum.
- **P256 and WebAuthn:** `address(uint160(uint256(keccak256(abi.encodePacked(pubX, pubY)))))` [SPEC]. This is identical to `derive_p256_address` in [RS-SIG].
- A passkey account's address is therefore a pure function of its public key. There is no deployment and no factory. **Inference:** the root key can never be rotated, because root means "address matches account address" [SPEC]. Recovery has to come from admin keys (§3.5).

### 2.4 Gas by signature type

| Type | Tx-signature gas | Key-authorization signature gas |
|---|---|---|
| secp256k1 | 21,000 (incl. ecrecover) | 3,000 |
| P256 | 26,000 | 8,000 |
| WebAuthn | 26,000 + calldata(webauthn_data) | 8,000 + calldata |
| Keychain | inner + 3,000 | — |

Source: [SPEC] §Gas Costs.

---

## 3. Account Keychain precompile

Sources: [KC], [SPEC] §Access Keys, [TIP1011], [TIP1049], [TIP1053], [T3], [T6], [RS-ABI], [RS-KA], [RS-HANDLER], [RS-POOL].

**Address:** `0xAAAAAAAA00000000000000000000000000000000`. This is the checksummed form; viem's `Addresses.accountKeychain` is `0xaAAAaaAA00000000000000000000000000000000`, and viem rejects the all-caps string as a bad checksum.

### 3.1 Interface

Full ABI in [KC]. The items below include extras found only in [RS-ABI].

- **Mutators.** Only the root or an active admin key may call these; everyone else gets `UnauthorizedCaller`. Each also requires `msg.sender == tx.origin`.
  - `authorizeKey(address keyId, uint8 signatureType, (uint64 expiry, bool enforceLimits, (address token,uint256 amount,uint64 period)[] limits, bool allowAnyCalls, (address target,(bytes4 selector,address[] recipients)[] selectorRules)[] allowedCalls))`. Selector **`0x980a6025`**. The pre-T3 `0x54063a55` reverts with `LegacyAuthorizeKeySelectorChanged`.
  - `authorizeKey(…, KeyRestrictions, bytes32 witness)`.
  - `authorizeAdminKey(address keyId, uint8 signatureType, bytes32 witness)`.
  - `revokeKey(address keyId)` (`0x5ae7ab32`).
  - `updateSpendingLimit(address keyId, address token, uint256 newLimit)`.
  - `setAllowedCalls(address keyId, CallScope[] scopes)`.
  - `removeAllowedCalls(address keyId, address target)`.
  - `burnKeyAuthorizationWitness(bytes32)`.
- **Views:**
  - `getKey(account, keyId) → (signatureType, keyId, expiry, enforceLimits, isRevoked)`
  - `getRemainingLimitWithPeriod(account, keyId, token) → (remaining, periodEnd)` (reflects rollover)
  - legacy `getRemainingLimit(…) → remaining`
  - `getAllowedCalls(account, keyId) → (isScoped, scopes)`
  - `isAdminKey`
  - `isKeyAuthorizationWitnessBurned`
  - `getTransactionKey()` (`address(0)` = root)
- **Events:**
  - `KeyAuthorized(account indexed, publicKey indexed, uint8 signatureType, uint64 expiry)`
  - `AdminKeyAuthorized`
  - `KeyRevoked(account, publicKey)`
  - `SpendingLimitUpdated(account, publicKey, token, newLimit)`
  - `AccessKeySpend(account, publicKey, token, amount, remainingLimit)`
  - `KeyAuthorizationWitness` / `…Burned`
- **Errors:**
  - `KeyAlreadyExists`, `KeyAlreadyRevoked`, `KeyNotFound`, `KeyExpired`, `ExpiryInPast`
  - `SpendingLimitExceeded`, `InvalidSpendingLimit`
  - `CallNotAllowed`, `InvalidCallScope`
  - `SignatureTypeMismatch(expected, actual)`, `InvalidKeyId`, `ZeroPublicKey`

### 3.2 Two ways to authorize

- **(a) Inline `key_authorization` on any Tempo tx.** The root or an admin key signs `keccak256(rlp([chain_id, key_type, key_id, expiry?, limits?, allowed_calls?, witness?, is_admin?, account?]))`. The fields use RLP trailing-optional semantics:
  - `TokenLimit` is `[token, limit]` when `period == 0`, otherwise `[token, limit, period]`.
  - `CallScope` is `[target, [[selector, [recipients…]], …]]`.

  The new key **may sign the same tx** ("authorize and use"). Since T1C, `chain_id` must equal the current chain; the spec's "0 = any chain" wildcard is gone [RS-KA `validate_chain_id`]. This is what viem's `Actions.accessKey.authorize{,Sync}` does: it sends a tx with only `keyAuthorization` attached.
- **(b) Direct `authorizeKey(...)` call** from a root- or admin-signed tx, as in the Python and Go examples [GUIDE]. Here a non-expiring key needs `expiry = u64::MAX`, and `0` is rejected. In RLP, omitting `expiry` means "never expires" [KC].
- **Allowed key types:** `0` secp256k1, `1` **P256**, `2` WebAuthn [KC]. A raw-P256 card must be registered as `1`. WebAuthn (`2`) is for passkey-backed keys [FOUNDRY].

### 3.3 Limits and scopes

| Control | Semantics |
|---|---|
| Expiry | `now >= expiry` ⇒ expired; checked at pool admission **and** execution; pool evicts txs of expired keys [KC][RS-POOL] |
| Spending limit | Per TIP-20 token. `period = 0`: cap over the key's lifetime. `period > 0`: `remaining` resets to `max` when `now >= periodEnd`, and `periodEnd` advances by whole periods (no carry-over) [TIP1011]. Tracks only direct (`msg.sender == tx.origin`) `transfer`, `transferWithMemo`, `approve` (increase only), `startReward`. `transferFrom` via contracts is not tracked [SPEC] |
| Fees vs limit | With a sponsor (`fee_payer ≠ sender`) the gas fee is **not** debited from the key's limit. Verified: after a sponsored 1.00 payment, remaining went from 5.00 to exactly 4.00. Self-paid keychain txs debit the fee-token limit [RS-HANDLER] |
| Call scope | `allowed_calls = None`: unrestricted. `Some([])`: deny-all. Otherwise a list of `{target, selectorRules}`: an empty `selectorRules` allows any selector on that target, and each rule may carry a `recipients` allowlist on **arg 0**. Recipient rules are only valid on a TIP-20 target with `transfer 0xa9059cbb`, `approve 0x095ea7b3` or `transferWithMemo 0x95777d59` [TIP1011]. Checked for every top-level call before the batch runs. **A violation is an execution failure (reverted, fee charged), not a pool rejection** [TIP1011, verified live] |
| No per-tx cap | Not in the model. **Inference:** emulate it with a short-period limit (e.g. $50 per 60 s) plus off-chain policy |

Changing limits and scopes later:
- `updateSpendingLimit` sets `remaining = max = newLimit` and keeps `period`/`periodEnd`. Changing `period` means re-authorizing.
- `setAllowedCalls` creates or replaces the scope for each target. `removeAllowedCalls(key, target)` disables that target.
- Duplicates are rejected everywhere, and since T11 each duplicate check costs 20 gas per value [T11].

### 3.4 Revocation

- `revokeKey` sets `isRevoked = true` and `expiry = 0`. The **keyId can never be re-authorized on that account** (`KeyAlreadyRevoked`), so a card whose key was revoked needs a **new on-card keypair** [KC].
- **Latency.** State is checked at execution, so the key is dead for every tx ordered after the revoke tx. That is the next ~0.5 s block, with deterministic finality [EVM]. Pool maintenance also drops pending txs signed by revoked keys [RS-POOL].
- **Verified:** a card tx submitted right after the revoke receipt was rejected at the RPC with `keychain validation failed: … KeyAlreadyRevoked`.
- **Inference:** a card tx that lands in the same block *before* the revoke still succeeds.

### 3.5 Admin keys (T6)

- Created with `authorizeAdminKey` or `is_admin = true` in a key authorization. Admin keys **cannot** carry expiry, limits or scopes.
- They can authorize and revoke keys, including other admin keys, and can update limits and scopes.
- An admin-signed key authorization must set `account` [TIP1049][T6].
- `isAdminKey(account, account)` returns true for the root.

### 3.6 Key-authorization cost

This is intrinsic gas, charged before execution [RS-HANDLER `calculate_key_authorization_gas`]:
- Signature verification.
- 1 SLOAD.
- ~250,000 per new slot. The slots are: 1 for the key, **2 per token limit** (T3+), and `1 + 3·targets + 3·selectorRules + constrainedRules + 2·recipients` for scopes.
- Plus `5,000 + 7,000·S + 7,000·K + 5,000·W` of scope overhead (T4).

The [SPEC]'s "22,000 per slot" table is stale. **Measured:** P256 card key, 1 limit, 1 target, 1 selector, 1 recipient, plus the WebAuthn root's first-tx account creation: **3,567,348 gas** (≈$0.002 at the floor, ≈$0.043 at the 1.2×10¹⁰ cap). **Inference:** each extra recipient adds ~0.5 M gas, so with the 30 M per-tx gas cap one authorization fits roughly 50 merchants.

### 3.7 What an access key cannot do

- Call any keychain mutator (`UnauthorizedCaller`). This includes revoking itself or raising its own limits.
- Create contracts at transaction level. T3 docs say "including factory CREATE/CREATE2"; TIP-1011 says the ban is tx-level only. The difference doesn't matter for Kova.
- Spend beyond its limits or outside its scopes.
- Be re-authorized once revoked.
- Pay fees as a fee payer (fee payers are secp256k1).
- Move funds of a different root account (V2 binds `userAddress`).

---

## 4. Fee sponsorship

Sources: [SPEC] §Fee Payer Signature Details, [SPONSOR], [RELAY], [FPAPI], [BILLING], [RATE], [FEES], [RS-TX], ox `TxEnvelopeTempo`.

- **What the sponsor signs:**
  ```
  keccak256(0x78 || rlp([chain_id, max_priority_fee_per_gas, max_fee_per_gas, gas_limit, calls, access_list,
                         nonce_key, nonce, valid_before, valid_after, fee_token /*always*/,
                         sender_address, aa_authorization_list, key_authorization?]))
  ```
  Sources: `fee_payer_signature_hash` in [RS-TX] and ox `getFeePayerSignPayload(tx, { sender })`. The `0x78` domain byte separates it from the sender's `0x76`. The sponsor commits to the sender and the fee token. It must be **secp256k1** and is recovered with `ecrecover`. It is attached as the `[v, r, s]` list in field 12.
- **The sender commits only to "some fee payer"** (the `0x00` marker). It does not commit to *which* one [SPEC Key Properties]. Anyone holding a sender-signed sponsored envelope can sponsor it.
- **Kova server key as sponsor for a card access key: ✅ verified live.** `receipt.feePayer` was the Kova key, and the card's limit was untouched.
- **Sponsor balance:** the sponsor must hold `gas_limit × max_fee_per_gas` of the fee token up front; the unused part is refunded [FEES]. It also **pays for reverted txs**.
- **Self-hosted relay: `Handler.relay`** [RELAY]. Options: `feePayer: { account, feeToken?, validate?, onSponsored?, name?, url? }`, `features: 'all'`, `autoSwap`, `resolveTokens`, `getClient`, `cache`, `path`, `onRequest`.
  - It enriches `eth_fillTransaction`.
  - It also sponsors approved `eth_signRawTransaction` / `eth_sendRawTransaction{,Sync}`.
  - Without `validate` it sponsors everything.
  - Named refusal reasons: `billing_past_due`, `billing_required`, `fee_token_unsupported`, `spend_limit_exceeded`, `tx_fee_limit_exceeded`.
  - ⚠️ The docs say `import { Handler } from 'tapimo'`, but `tapimo@0.15.1` root exports only `Client`. `Handler` (`relay`, `compose`, `from`) lives at **`tapimo/server`**, and also at **`accounts/server`** (which adds `webAuthn`, `auth`, `exchange`, …). Checked via import.
- **Hosted Fee Payer API** [FPAPI][BILLING][RATE]:
  - Endpoint: `https://api.tempo.xyz/rpc/sponsor?key=<API key>`, used with viem `withRelay(http(), http(url))` and `feePayer: true`.
  - Sandbox keys (`tempo_sandbox:sk:…`) map to testnet 42431; production keys (`tempo:sk:…`) to mainnet. Production needs **active Stripe billing**.
  - Controls: an org monthly spend limit and a per-tx "Sponsorship limit" (`txFeeLimit`, which defaults to a platform value). Default rate limit: 100 req/min per key per scope.
  - Console signups are "currently limited".
  - Pricing or markup beyond "committed fees" is **unconfirmed**.
- **Public testnet sponsor:** `https://sponsor.moderato.tempo.xyz`. No key needed; Moderato only.
- **Recommendation for Kova:** run its own sponsor key in the backend, in-process or via `Handler.relay` with `validate`, funded with USDC.e (`0x20C000000000000000000000b9537d11c60E8b50`, see 03). Before co-signing:
  1. rebuild the tx from fields;
  2. verify the card signature;
  3. `eth_call`-simulate;
  4. apply policy.

---

## 5. Passkey (WebAuthn) accounts and the consumer app

Sources: [SPEC], [KC], [SPONSOR], [TS], [WALLET], viem `tempo/Account.ts`, `accounts@0.18.4` source (accounts.tempo.xyz/docs was not in the downloaded set).

- **From passkey to Tempo account:**
  1. Create a P-256 WebAuthn credential.
  2. Store its public key: assertions don't return it, and the address needs it.
  3. `address = last20(keccak256(X ‖ Y))`.

  There is no on-chain setup; the first tx (protocol nonce 0) pays the +250k account-creation gas. In viem, `Account.fromWebAuthnP256({ id, publicKey })` signs with `WebAuthnP256.sign`, using the challenge described in §2.2.
- **wagmi:** `webAuthn({ authUrl: '/auth' })` from `wagmi/tempo` uses domain-bound passkeys; the server ceremony is `accounts/server` `Handler.webAuthn`. `tempoWallet()` from `wagmi/connectors` uses Tempo Wallet's passkeys at wallet.tempo.xyz. Combine with `withRelay(...)` for sponsorship [SPONSOR].
- **Issuing the card key from the app:** `Actions.accessKey.authorizeSync(client, { accessKey: { publicKey, type: 'p256' }, … })` takes the card's public key directly. **The private key never has to exist off-card.** Verified.
- **React Native / Expo** (from package source; *Inference* where marked):
  - `accounts` exports `accounts/mobileWebAuth` (a `tempoWallet` adapter). It opens `wallet.tempo.xyz` in an auth session (`accounts/react-native/expo-web-browser`), returns through a deep-link callback, and keeps an **app-side pure-JS P-256 access key**, persisted with `expo-secure-store` or `react-native-mmkv`.
  - The passkey then belongs to Tempo Wallet's domain, not Kova's.
  - **Inference:** for a Kova-domain passkey inside the native app, use a native passkey module with associated domains (iOS) / Digital Asset Links (Android). Wrap it as `Account.from({ keyType: 'webAuthn', publicKey, sign })` and serialize `{ authenticatorData, clientDataJSON }` into the `0x02` envelope. Tempo ignores origin and rpId, but enforces 37-byte authData with no AT/ED flags.
  - **Inference:** a Secure Enclave or Android Keystore P-256 key has the same properties as the card (SHA-256-then-ECDSA, DER) and works as an app access key using the §Verdict transformations.

---

## 6. Parallelism and throughput

Sources: [GUIDE] §Concurrent/Expiring/2D Nonces, [PAR], [TIP1009], [TIP1093], [RS-SIGNED].

- **Expiring nonces are the default for concurrency.** viem and wagmi attach them automatically; verified, since viem set `nonceKey = 2²⁵⁶−1` on a plain `sendTransactionSync`. `Promise.all` of N sends from one account works [PAR].
  - Each tx must have a distinct payload; identical payload plus identical `validBefore` dedupes.
  - The window is ≤ 300 s.
  - There is no nonce state and the overhead is 13k gas.
- **2D nonces** give ordered lanes: `nonceKey: 1n, 2n, …`. Reuse a small set of keys, because each new key costs 250k gas [GUIDE warning][TIP1000].
- **Merchant refunds:** send from the merchant account, or from a merchant access key scoped to `transfer`/`transferWithMemo`, with expiring nonces and one unique memo per refund.
- **Kova's fee payer is never the bottleneck** (**Inference** from the tx structure): it consumes no nonce, so sponsored throughput is bounded only by the sponsor's balance and RPC or hosted rate limits.
- **Replay capacity:** the ring buffer is sized for 10k expiring txs per second chain-wide [TIP1093].

---

## 7. Signature Verification precompile (TIP-1020)

Sources: [TIP1020], [TIP1049], [T6], [SVF], [PRE], [RS-SV].

- **Address:** `0x5165300000000000000000000000000000000000`. Live on both networks since T3.
- **Calls:**
  - `recover(bytes32 hash, bytes sig) → address`
  - `verify(address signer, bytes32 hash, bytes sig) → bool`
  - T6 adds `verifyKeychain(account, digest, sig)` and `verifyKeychainAdmin(account, digest, sig)`, which take **V2 keychain signatures only**.
- **Behavior:**
  - Uses the same wire formats and verification as transactions, **including `pre_hash` and the low-s rule**. It parses with `PrimitiveSignature::from_bytes`.
  - Reverts on invalid input.
  - Rejects keychain prefixes in `recover`/`verify`.
  - Gas: 3k (secp256k1) or 8k (P256/WebAuthn) plus input charge. Since T11 the input charge is 30 gas per word [T11].
- **`verifyKeychain` limits:** it checks that the key is active for the account. It does **not** check the stored key type, scopes or limits.
- **Uses for Kova:**
  - *Off-chain*, the backend doesn't need it: ox `SignatureEnvelope.verify` or node `crypto.verify` suffices.
  - *On-chain*, a Kova contract could accept card-signed intents, such as refund authorizations or escrow release, through `verifyKeychain(user, digest, 0x04‖user‖p256sig)`. The card would sign `keccak256(0x04 ‖ digest ‖ user)`. Put chain ID, contract address and account into `digest` [T6].
- ⚠️ The [SVF] P256 test builds `abi.encodePacked(pubX, pubY, r, s)` (128 bytes). That contradicts TIP-1020's 130-byte `0x01…prehash` format, which the code enforces. Trust TIP-1020.

## 8. Relation to 4337 / 7702 (short)

- Tempo Transactions provide natively what 4337 needs contracts and infrastructure for: sponsorship (no paymaster or bundler), batching (`calls`), and P256/WebAuthn signatures (no verifier contracts) [4337].
- `aa_authorization_list` gives 7702 delegation signable by any Tempo signature type; any CREATE call is then disallowed [7702][SPEC].
- A 4337 EntryPoint is deployed for compatibility [4337], and Pimlico and ZeroDev support Tempo [ECO].
- **Kova needs neither:** access keys replace 4337-style session keys, and fee payers replace paymasters.

---

## Kova Card signing: verdict

**✅ Supported, with required transformations.** The design is sound at the protocol level and was exercised end-to-end on Moderato. Mainnet runs the same T11 rules.

| # | Step | Status | Evidence / requirement |
|---|---|---|---|
| 1 | Card generates a P-256 keypair on-chip; exports `0x04‖X‖Y` | ✅ | Only X and Y are needed (`keyId = last20(keccak256(X‖Y))`) [SPEC] |
| 2 | Register as access key with expiry, limits, scopes via passkey root | ✅ | `key_type = 1`. Authorized from a WebAuthn root on testnet; `getKey` → `signatureType: 1, enforceLimits: true` |
| 3 | "Transfers only", specific tokens | ✅ | Scope `{target: USDC.e, selectorRules:[{0x95777d59, recipients}]}` [TIP1011] |
| 3b | Merchant allowlist | ⚠️ | Supported through `recipients`, but the list is fixed per key. Adding merchants needs a root/admin `setAllowedCalls` (passkey prompt) and costs ~0.5 M gas each; practical ceiling ~50 per authorization (Inference) |
| 3c | Per-tx limit | ❌ | Not native. Only per-token lifetime or periodic limits. Emulate (short period) or enforce in applet or policy |
| 4 | POS builds a `transferWithMemo` Tempo tx | ✅ | Expiring nonce, `validBefore ≤ now+300`, `feePayerSignature: null` marker, `value = 0` |
| 5 | POS sends "the 32-byte signing hash" | ⚠️ | Must be **`D = keccak256(0x04 ‖ sigHash ‖ userAccount)`**. The raw `sigHash` is rejected (V1 dead since T1C) [RS-SIG][UPG] |
| 6 | Card `ALG_ECDSA_SHA_256` over D | ✅ | Equals ECDSA over `sha256(D)`, which is what `pre_hash = 1` verifies. Verified with an equivalent signer |
| 7 | DER, random s | ⚠️ | Must convert to raw 32+32 and **normalize to low-s**. An un-normalized high-s tx was rejected live |
| 8 | Backend attaches fee-payer signature and broadcasts | ✅ | Verified. Simulate first: reverts are paid by the sponsor |
| 9 | Freeze = revoke key | ✅ / ⚠️ | Effective from the next block (verified) but **permanent**: re-issuing needs a new key. Needs the root passkey or an admin key. For a reversible freeze use `updateSpendingLimit(…, 0)` (verified) |
| 10 | Root = passkey in app | ✅ | WebAuthn root verified (headless). On React Native, see §5 |

**Byte-level contract between the POS and the card:**
1. `sigHash = keccak256(0x76 ‖ rlp(fields with fee_token → 0x80 and fee-payer marker 0x00))` (§1.2).
2. `D = keccak256(0x04 ‖ sigHash[32] ‖ userAccount[20])`.
3. APDU `SIGN(D)` returns `30 L 02 Lr R 02 Ls S`.
4. `R` and `S` → unsigned big-endian. Strip a leading `0x00`, left-pad to 32 bytes, and reject anything longer than 32 bytes.
5. `if S > n/2: S = n − S`. No recovery id is needed because the public key is embedded.
6. `inner = 0x01 ‖ R ‖ S ‖ X ‖ Y ‖ 0x01` (130 bytes).
7. `senderSig = 0x04 ‖ userAccount ‖ inner` (151 bytes).
8. The backend computes the §4 fee-payer hash with `sender = userAccount` and `fee_token` set, signs with secp256k1, and serializes `0x76 ‖ rlp([... fee_token, [v,r,s], aa_list, senderSig])`.

**Inference:** JavaCard 3.0.5+ also offers `signPreComputedHash`, which would allow `pre_hash = 0`. It isn't needed.

**Security model** (**Inference**, derived from the verified semantics):
- **The card signs blindly.** Most JavaCards have no Keccak-256; SHA3-256 uses different padding. Anyone who can send an APDU, such as a rogue terminal or a relay attack, gets a valid signature *for any tx within the key's scope and limits*.
- **Anyone can then sponsor that tx**, because the sender does not commit to the fee payer. Kova refusing to co-sign does not stop it.
- **Mitigations:**
  - Keep scopes tight (token + `transferWithMemo` + merchant allowlist).
  - Use a small periodic limit.
  - Keep expiry at or below the card's validity.
  - **Optionally make Kova a mandatory co-authorizer inside the applet.** The backend rebuilds the tx from fields, applies policy, and signs D with a Kova P-256 "auth" key. The card verifies that signature (`ALG_ECDSA_SHA_256` verify with a stored Kova pubkey) before signing. This gives per-tx caps and instant server-side freeze, at the cost of requiring the terminal to be online.

**TypeScript sketch.** Parts (a)–(d) mirror the live-tested script. Pin `ox` to the version viem uses (0.14.x).

```ts
import { encodeFunctionData, maxUint256, pad, parseUnits } from 'viem'
import { tempo } from 'viem/chains'
import { Abis, Account, Actions, createClient } from 'viem/tempo'
import { PublicKey, Secp256k1 } from 'ox'
import { SignatureEnvelope, TxEnvelopeTempo } from 'ox/tempo'

const USDCe = '0x20C000000000000000000000b9537d11c60E8b50' // mainnet USDC.e (see 03)
const N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551n

// (a) Kova Pay app: passkey root authorizes the card's P-256 key (one passkey prompt)
const root = Account.fromWebAuthnP256({ id: credId, publicKey: passkeyPubHex })
const app = createClient({ account: root, chain: tempo, feeToken: USDCe })
const cardPub = PublicKey.fromHex(cardPubHex)          // 0x04||X||Y read from card via APDU
await Actions.accessKey.authorizeSync(app, {
  accessKey: { publicKey: cardPubHex, type: 'p256' },  // key_type 1; keyId = last20(keccak(X||Y))
  expiry: cardExpiryUnix,
  limits: [{ token: USDCe, limit: parseUnits('200', 6), period: 86_400 }],   // $200/day, resets
  scopes: [{ address: USDCe, selector: 'transferWithMemo(address,uint256,bytes32)',
             recipients: merchantAllowlist }],          // omit recipients = any merchant
})

// (b) Kova Terminal: build tx and the digest the card must sign
const tx = TxEnvelopeTempo.from({
  chainId: tempo.id,
  calls: [{ to: USDCe, data: encodeFunctionData({ abi: Abis.tip20, functionName: 'transferWithMemo',
            args: [merchant, amount, memo32] }) }],
  gas: 400_000n,                           // ~82k typical; ~331k if merchant has no balance yet
  maxFeePerGas: 2n * baseFee, maxPriorityFeePerGas: 0n, // baseFee from getBlock(); sponsor must hold gas*maxFee
  nonceKey: maxUint256, nonce: 0n,         // expiring nonce
  validBefore: Math.floor(Date.now() / 1000) + 120,   // ≤ 300 s (T11)
  feePayerSignature: null,                 // sponsored: sender skips fee_token, signs 0x00 marker
})
const D = TxEnvelopeTempo.getSignPayload(tx, { from: userAccount })  // keccak256(0x04||sigHash||user)

// (c) card signs D; POS converts; Kova backend verifies, simulates, co-signs, broadcasts
// Kova helpers: nfcSign(D) = APDU round-trip; derToRS parses 30 L 02 Lr R 02 Ls S -> bigints
const lowS = ({ r, s }: { r: bigint; s: bigint }) => ({ r, s: s > N / 2n ? N - s : s }) // REQUIRED
const { r, s } = lowS(derToRS(await nfcSign(D)))    // ALG_ECDSA_SHA_256(D): DER, random s
const signature = SignatureEnvelope.from({ type: 'keychain', version: 'v2', userAddress: userAccount,
  inner: SignatureEnvelope.from({ type: 'p256', signature: { r, s }, publicKey: cardPub, prehash: true }) })
// --- backend ---
const sponsored = { ...tx, feeToken: USDCe }        // sponsor picks & commits to fee token
const fpSig = Secp256k1.sign({ payload: TxEnvelopeTempo.getFeePayerSignPayload(sponsored,
                { sender: userAccount }), privateKey: KOVA_FEE_PAYER_KEY })
const raw = TxEnvelopeTempo.serialize({ ...sponsored, feePayerSignature: fpSig }, { signature })
const hash = await rpc.request({ method: 'eth_sendRawTransaction', params: [raw] })

// Alternative (also verified): viem does the V2 digest + envelope for you
const card = Account.from({ access: userAccount, keyType: 'p256', publicKey: cardPub,
  sign: async ({ hash }) => SignatureEnvelope.serialize({ type: 'p256', publicKey: cardPub,
    prehash: true, signature: lowS(derToRS(await nfcSign(hash))) }) })
await createClient({ account: card, chain: tempo, feeToken: USDCe })
  .sendTransactionSync({ calls, feePayer: kovaFeePayerAccount })  // or feePayer: true + withRelay

// (d) freeze
await Actions.accessKey.revokeSync(app, { accessKey: cardKeyId })          // permanent
await Actions.accessKey.updateLimitSync(app, { accessKey: cardKeyId, token: USDCe, limit: 0n }) // reversible
```

---

## Gotchas

- **Do not hand the raw tx hash to the card.** V1 keychain signatures are invalid since T1C, and some spec examples still show V1-style signing [SPEC Access Keys example][UPG].
- **High-s gives "invalid transaction signature"** for about half of un-normalized card signatures. ox serialize does not normalize.
- **Wrong `pre_hash` is rejected.** Use `1` for `ALG_ECDSA_SHA_256`, and `0` only when the card signs the digest raw.
- **Sponsor pays for reverts.** Scope and limit failures are included as reverted txs (live cost ≈ 55–60k gas each). Simulate before co-signing, and rate-limit per card and per terminal.
- **Revocation is forever per keyId.** Build key rotation into the applet (on-card regenerate APDU) and into the backend's card registry. Index `KeyAuthorized` / `KeyRevoked`.
- **Kova cannot freeze without root/admin authority.** Giving Kova's backend an admin key lets it authorize arbitrary new keys on user accounts (**custodial risk**). Prefer passkey-prompted actions or an admin key on the user's second device.
- **Stale docs:**
  - The [GUIDE] fee-payer RLP uses `0x77`/`0x76`; the real values are `0x76`/`0x78`.
  - [SPEC] sender-hash pseudo-code omits `aa_authorization_list` and `key_authorization`.
  - [SPEC] "chain_id 0 = any chain" is rejected since T1C.
  - [SPEC] key-authorization gas table (22k per slot) is stale; slots now cost ~250k.
  - [SPEC] new-nonce-key cost 22,100 is now 250k.
  - Foundry's "max 30s" expiring nonce is stale; T11 allows 300 s.
  - `import { Handler } from 'tapimo'` should be `tapimo/server`.
  - The [SVF] P256 example encoding is wrong.
- **Pin ox to viem's version.** `ox@1.x` (the `latest` tag) broke `PublicKey.from` in my script, while viem 2.56.8 pins `ox@0.14.45`.
- **Use the checksummed keychain address**, or `Addresses.accountKeychain`. The all-caps `0xAAAA…` fails viem's checksum.
- **Testnet fee estimates.** `estimateFeesPerGas()` on Moderato returned priority ≈ 8.5×10¹⁰, which is ~140× the base fee. Set `maxPriorityFeePerGas` explicitly (mainnet returned 0).
- **No trailing calldata bytes** (T11 strict ABI decoding) until T12. Don't use viem `dataSuffix`.
- **`call.value` must be 0.** A first payment to a fresh address costs ~250k extra gas (new balance slot).
- **Same-payload dedupe.** A repeated identical tap within the window is dropped as a replay. Include a unique memo such as the POS order ID.
- **A passkey root cannot be rotated** because the address is derived from it. Plan device recovery through synced passkeys and admin keys (T6).

## Open questions

1. Does the hosted Fee Payer API or `Handler.relay` accept a **keychain-P256-signed** handoff envelope (ox `serialize(tx, { format: 'feePayer', signature })`, `0x78…`) for `eth_sendRawTransactionSync`? Untested; Kova's in-process co-signing is verified.
2. Hosted sponsorship pricing, markup and platform default `txFeeLimit` are **unconfirmed**. Console access is invite-only.
3. JCOP/JavaCard specifics are outside Tempo docs and **unconfirmed**: `ALG_ECDSA_SHA_256` on P-256 with `KeyBuilder`/named-curve setup, `signPreComputedHash` availability, and APDU latency. Validate on real hardware.
4. What is the exact maximum merchant allowlist per key, and does `setAllowedCalls` re-charge existing recipient slots? My ~50 figure is an inference from the gas formula and the 30 M cap.
5. Offline or store-and-forward POS: expiring nonces cap the delay at 300 s. A 2D-nonce path needs the current nonce, which could be a card-side counter (Inference). Not designed.
6. Are TIP-1106 and T12 (expiring-nonce discriminators, trailing-bytes fix) on any mainnet schedule? Not scheduled per docs.
7. Contract-creation ban scope for access keys (T3 page vs TIP-1011). This doesn't matter for Kova.

## Sources

Docs (downloaded 2026-09-19):
- [SPEC] https://tempo.xyz/developers/docs/protocol/transactions/spec-tempo-transaction
- [KC] https://tempo.xyz/developers/docs/protocol/transactions/AccountKeychain
- [GUIDE] https://tempo.xyz/developers/docs/guide/tempo-transaction (same body as /protocol/transactions)
- [SPONSOR] https://tempo.xyz/developers/docs/guide/payments/sponsor-user-fees
- [PAR] https://tempo.xyz/developers/docs/guide/payments/send-parallel-transactions
- [RELAY] https://tempo.xyz/developers/docs/server/relay-handler
- [FPAPI] https://tempo.xyz/developers/docs/api/fee-payer
- [BILLING] https://tempo.xyz/developers/docs/api/console/usage-and-billing
- [RATE] https://tempo.xyz/developers/docs/api/rate-limits
- [FEES] https://tempo.xyz/developers/docs/protocol/fees/spec-fee and /protocol/fees
- [TS] https://tempo.xyz/developers/docs/sdk/typescript
- [WALLET] https://tempo.xyz/developers/docs/quickstart/wallet-developers
- [FOUNDRY] https://tempo.xyz/developers/docs/sdk/foundry
- [SVF] https://tempo.xyz/developers/docs/sdk/foundry/signature-verifier
- [PRE] https://tempo.xyz/developers/docs/quickstart/predeployed-contracts
- [EVM] https://tempo.xyz/developers/docs/quickstart/evm-compatibility
- [4337] https://tempo.xyz/developers/docs/protocol/transactions/eip-4337
- [ECO] https://tempo.xyz/developers/docs/ecosystem/smart-contract-libraries
- [7702] https://tempo.xyz/developers/docs/protocol/transactions/eip-7702
- [T3] https://tempo.xyz/developers/docs/protocol/upgrades/t3
- [T6] https://tempo.xyz/developers/docs/protocol/upgrades/t6
- [T11] https://tempo.xyz/developers/docs/protocol/upgrades/t11
- [UPG] https://tempo.xyz/developers/docs/guide/node/network-upgrades

TIPs (github.com/tempoxyz/tempo/tree/main/tips, = tips.sh/<n>):
- [TIP1000] tip-1000.md
- [TIP1009] tip-1009.md
- [TIP1011] tip-1011.md
- [TIP1020] tip-1020.md
- [TIP1049] tip-1049.md
- [TIP1053] tip-1053.md
- [TIP1093] tip-1093.md
- TIP-1106 (Draft)

Code (`tempoxyz/tempo@5d53ec16`, 2026-09-19):
- [RS-SIG] crates/primitives/src/transaction/tt_signature.rs
- [RS-TX] crates/primitives/src/transaction/tempo_transaction.rs
- [RS-KA] crates/primitives/src/transaction/key_authorization.rs
- [RS-SIGNED] crates/primitives/src/transaction/tt_signed.rs
- [RS-HANDLER] crates/revm/src/handler.rs
- [RS-POOL] crates/transaction-pool/src/maintain.rs
- [RS-ABI] crates/contracts/src/precompiles/account_keychain.rs
- [RS-SV] crates/precompiles/src/signature_verifier/mod.rs

Packages (npm, 2026-09-19):
- `viem@2.56.8` (tempo/Account.ts, Transaction.ts, actions/accessKey.ts)
- `ox@0.14.45` (tempo/TxEnvelopeTempo.ts, SignatureEnvelope.ts, core/WebCryptoP256.ts)
- `accounts@0.18.4`
- `tapimo@0.15.1`

Live Moderato validation (2026-09-19). The card was simulated with node `crypto.sign('sha256')` (DER, random s); the root was a headless-WebAuthn P-256 account.
- Authorization: `0xbd1ce4b7…5c672` (3,567,348 gas).
- Card payment: `0xc976e28f…01c0f` (330,930 gas), plus repeat payments at 81,618 gas.
- Out-of-scope recipient reverted: `0x96645a0b…0cb5`.
- Over-limit reverted: `0xf5a97d6d…ff380`.
- Revoke: `0x5a48e643…01f18`, then a card tx was rejected with `KeyAlreadyRevoked`.
- Limit→0 soft-freeze reverted: `0xafae6505…b032`; the restored payment succeeded: `0xc051a22f…74e2`.
- viem-native card account sponsored transfer: `0x844fef79…f529`.
- High-s and `pre_hash = 0` signatures were rejected at the RPC ("invalid transaction signature").
- Scripts: scratchpad `npmprobe/cardflow.mjs`, `softfreeze.mjs`, `viemnative.mjs`.
