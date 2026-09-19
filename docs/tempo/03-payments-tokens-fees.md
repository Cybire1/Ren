# Tempo: Payments, TIP-20 & Fees

Tempo mainnet (chain 4217) runs stablecoin payments on **TIP-20**, a precompile token standard. It extends ERC-20 with 32-byte memos, TIP-403 transfer policies, account-level receive policies (T6), and virtual deposit addresses (TIP-1022, T3). Fees are paid in USD stablecoins. Since T7 the base fee floats between 6×10⁸ and 1.2×10¹⁰ attodollars/gas. On 2026-09-19 mainnet sat at the floor: a real sponsored `transferWithMemo` cost **31 microdollars ($0.000031)** and would cost about **$0.0006 at the cap**. Blocks take about 0.55 s and finality is deterministic (Simplex BFT), so Kova can mark a PaymentIntent PAID one block after submission. TIP-20 transfers have no chargeback: a refund is a new merchant-to-customer transfer. Three findings shape Kova's design. First, since T6 a transfer the receiver's policy blocks still **succeeds** but credits `ReceivePolicyGuard`, so Kova must check the recipient in the logs, not only the receipt status. Second, virtual addresses let a plain-wallet QR payment be attributed without a memo. Third, the docs' Python/Go examples use a wrong `transferWithMemo` selector.

## What Kova needs from this

- **Payment primitive:** use `transferWithMemo(merchant, amount, memo)` on a USD TIP-20 token. Put a Kova-formatted PaymentIntent ID in the memo, or use a per-intent virtual address for plain-wallet QR payments.
- **Confirmation:** submit via `eth_sendRawTransactionSync` through Kova's own fee-payer relay. Verify the receipt logs (token, `to`, amount, memo, not redirected to the guard) and mark PAID. Expected latency is about 1 block (≈0.55 s) plus round trips.
- **Sponsorship:** Kova is the `feePayer` for every in-app, POS and refund transaction. Budget about $0.00003 per payment at today's floor and ≤ $0.0006 at the cap, plus a one-time 250k-gas cost the first time a merchant receives a given token.
- **Payment lane:** keep payment transactions to allow-listed TIP-20 calls only. A swap+pay batch falls into the general lane.
- **Parallelism:** use expiring nonces (`nonceKey = maxUint256`, `validBefore ≤ now+300 s`) for POS, relayed, and bulk refunds/payouts. A transaction that is not included by `validBefore` can never land, so POS retries are safe.
- **Compliance preflight:** check `paused()`, TIP-403 sender/recipient authorization, the receiver's receive policy, and virtual-address registration before asking a user to sign.
- **Refunds:** send a new `transferWithMemo` from the merchant wallet, with the memo referencing the original intent. The merchant signs it, or Kova signs with a scoped access key the merchant granted.
- **Zones (privacy):** testnet only. Not for the hackathon build.

---

## 1. TIP-20 essentials and addresses

- Every TIP-20 has `decimals() == 6` ("Always returns 6 for TIP-20 tokens"). 1 unit = 1 microdollar for USD tokens. Source: https://tempo.xyz/developers/docs/protocol/tip20/spec
- TIP-20 tokens live at addresses with the prefix `0x20c000000000000000000000`. A transfer to another TIP-20 address or to `address(0)` reverts `InvalidRecipient`. Source: same.
- Only tokens with `currency == "USD"` can pay fees or trade on the Stablecoin DEX. Source: https://tempo.xyz/developers/docs/protocol/tip20/overview

**Mainnet USD tokens relevant to Kova** (source: https://tempo.xyz/developers/docs/guide/bridge-layerzero and the live list at https://tokenlist.tempo.xyz/list/4217, fetched 2026-09-19):

| Token | Address | Observed on mainnet 2026-09-19 |
|---|---|---|
| pathUSD | `0x20c0000000000000000000000000000000000000` | `transferPolicyId()` = 2, a BLACKLIST policy |
| USDC.e (Stargate) | `0x20C000000000000000000000b9537d11c60E8b50` | policy 1 (always-allow), quoteToken = pathUSD |
| USDT0 | `0x20c00000000000000000000014f22ca97301eb73` | policy 3 (BLACKLIST), quoteToken = pathUSD |

On testnet (Moderato 42431) the faucet tokens are pathUSD `…0000`, AlphaUSD `…0001`, BetaUSD `…0002` and ThetaUSD `…0003`. Moderato validators expect AlphaUSD as their fee token. Sources: https://tempo.xyz/developers/docs/guide/payments/pay-fees-in-any-stablecoin, https://tempo.xyz/developers/docs/protocol/fees/spec-fee

**System precompiles** (source: https://tempo.xyz/developers/docs/quickstart/predeployed-contracts; the same values are in `Addresses` in viem 2.56.8):

| Name | Address |
|---|---|
| FeeManager / Fee AMM | `0xfeec000000000000000000000000000000000000` |
| Stablecoin DEX | `0xdec0000000000000000000000000000000000000` |
| TIP-403 Registry | `0x403c000000000000000000000000000000000000` |
| ReceivePolicyGuard | `0xB10C000000000000000000000000000000000000` |
| Address Registry (virtual addresses) | `0xFDC0000000000000000000000000000000000000` |
| TIP-20 Factory | `0x20fc000000000000000000000000000000000000` |
| TIP20ChannelReserve (MPP) | `0x4D50500000000000000000000000000000000000` |

---

## 2. Sending a payment

Available on mainnet and testnet since genesis. Sources: https://tempo.xyz/developers/docs/protocol/tip20/spec, https://tempo.xyz/developers/docs/guide/payments/send-a-payment

### Exact interface

```solidity
function transfer(address to, uint256 amount) external returns (bool);
function transferWithMemo(address to, uint256 amount, bytes32 memo) external;          // no return value
function transferFrom(address from, address to, uint256 amount) external returns (bool);
function transferFromWithMemo(address from, address to, uint256 amount, bytes32 memo) external returns (bool);

event Transfer(address indexed from, address indexed to, uint256 amount);
event TransferWithMemo(address indexed from, address indexed to, uint256 amount, bytes32 indexed memo);
```

| Item | Value | How verified |
|---|---|---|
| `transfer` selector | `0xa9059cbb` | docs + `cast sig` |
| `transferWithMemo` selector | **`0x95777d59`** | `cast sig`, viem `encodeFunctionData(Abis.tip20)`, and a live mainnet transaction (`0xf6c9f1aa…92ed`) |
| `transferFromWithMemo` selector | `0x929c2539` | `cast sig` |
| `Transfer` topic0 | `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` | `cast keccak`, matches mainnet logs |
| `TransferWithMemo` topic0 | `0x57bc7354aa85aed339e000bccffabbc529466af35f0772c8f8ee1145927de7f0` | `cast keccak`, matches mainnet logs |

> **Docs bug:** the Python and Go examples on *Send a payment* hard-code `TRANSFER_WITH_MEMO_SELECTOR = 76a8ee59`. That value is wrong. Use `0x95777d59`, or encode from the ABI.

`transferWithMemo` emits `Transfer` first and then `TransferWithMemo`. Both carry the same from, to and amount. The memo is **indexed** (topic3), so the log data holds only the amount. This is confirmed on mainnet.

### TypeScript (viem Tempo extension)

```ts
// viem.config.ts  (docs pattern; viem ≥ 2.56 ships the tempo chain + actions)
import { privateKeyToAccount } from 'viem/accounts'
import { createClient } from 'viem/tempo'
export const client = createClient({ account: privateKeyToAccount('0x...') })

// send.ts
import { parseUnits, pad, stringToHex } from 'viem'
const { receipt } = await client.token.transferSync({
  token: '0x20C000000000000000000000b9537d11c60E8b50', // USDC.e mainnet
  to: merchant,
  amount: parseUnits('12.50', 6),
  memo: pad(stringToHex('INV-12345'), { size: 32 }), // memo present → transferWithMemo
})
```

- `transferSync` sends the transaction and waits for its receipt. It returns the decoded `Transfer` args and `receipt` (viem types: `transferSync.ReturnValue`).
- Passing `memo` switches the call to `transferWithMemo`. Passing `from` switches it to `transferFrom` or `transferFromWithMemo`.
- `Actions.token.transfer.call({...})` returns a call object that can go into a batch.

Batch payments are atomic: all calls succeed or none do (source: send-a-payment):

```ts
import { encodeFunctionData } from 'viem'
import { Abis } from 'viem/tempo'
await client.sendTransaction({
  calls: payouts.map(({ to, amount, memo }) => ({
    to: token,
    data: encodeFunctionData({ abi: Abis.tip20, functionName: 'transferWithMemo', args: [to, amount, memo] }),
  })),
})
```

---

## 3. Accepting and verifying a payment

Sources: https://tempo.xyz/developers/docs/guide/payments/accept-a-payment, https://tempo.xyz/developers/docs/protocol/blockspace/consensus, https://tempo.xyz/developers/docs/api/rpc, https://tempo.xyz/developers/docs/guide/payments/configure-receive-policies

### Mechanisms

| Mechanism | Call | Use for |
|---|---|---|
| Synchronous submit | `eth_sendRawTransactionSync`, used by viem `*Sync` actions. It "submits a raw transaction and waits for it to be included, returning its receipt", or returns a timeout error. The receipt adds `feePayer` and `feeToken`. | Transactions Kova submits itself (in-app, POS, refunds): the lowest-latency path. |
| Push | `client.watchEvent`, `useWatchContractEvent`, `Actions.token.watchTransfer`, or WebSocket at `wss://rpc.tempo.xyz` | Payments Kova does not submit (QR from third-party wallets). |
| Pull / backfill | `getLogs` with indexed filters, e.g. `args: { memo }` or topic2 = recipient | Filling gaps after downtime, historical lookups, reconciliation. |
| Hosted | Tempo API `GET /v1/transfers?recipient=…&include=memo` and webhooks with `eventType: 'token:transfer'` (https://tempo.xyz/developers/docs/api/transfers, https://tempo.xyz/developers/docs/api/webhooks) | Secondary signal and dashboards. |
| Balance | `client.token.getBalance` | Sanity checks only. It cannot attribute a payment. |

Historical lookup by memo (docs):

```ts
import { parseAbiItem } from 'viem'
const logs = await client.getLogs({
  address: token,
  event: parseAbiItem('event TransferWithMemo(address indexed from, address indexed to, uint256 value, bytes32 indexed memo)'),
  args: { memo: kovaMemo },
  fromBlock, toBlock: 'finalized',
})
```

### Finality semantics

- Tempo uses Simplex BFT with **deterministic finality**. "Once a block is finalized, it cannot be reverted… There is no reorg risk after finality… Treat finalized blocks as irreversible for settlement purposes. No additional confirmations are needed after finality. Query finalized blocks using `eth_getBlockByNumber` with the `finalized` tag." Block production is about 600 ms. Source: the consensus page.
- The accept-a-payment guide says: "Wait for transaction finality (~1 second on Tempo) before processing." The machine-payments overview says "~500ms finality."
- **Observed** on `https://rpc.tempo.xyz` on 2026-09-19: `latest`, `safe` and `finalized` returned the same block on 8 consecutive samples. The average block interval over 1,000 blocks was **556.9 ms**.
- **Inference:** the public RPC only serves finalized blocks, so a receipt returned by it is already final. Kova should still compare `receipt.blockNumber` with the `finalized` block number (one cheap call, or a cached newHeads value). That keeps the check correct if Kova later uses a different RPC provider.

### Verification checklist (Kova-authored; each rule traces to the cited spec)

1. `receipt.status === 'success'` and `chainId === 4217`.
2. There is a `Transfer` log whose `address` is the expected token, `from` is the payer (when known), and `amount` equals the intent amount.
3. The recipient is correct:
   - Direct payment: `to === merchant`.
   - Virtual address: first `Transfer(payer → virtual)`, then `Transfer(virtual → master)` in the same transaction, with `master === merchant` (TIP-1022).
   - **If `to === 0xB10C…0000`** (ReceivePolicyGuard), the payment is **HELD**, not PAID (TIP-1028).
4. If a memo is expected, a `TransferWithMemo` log with the same from, to and amount carries `memo === expected`.
5. Ignore the fee log: a single `Transfer(feePayer → 0xfeec…0000, fee)` is emitted after execution. It is present on every receipt; mainnet example amount `0x1f` = 31 units. Source: https://tempo.xyz/developers/docs/protocol/fees/spec-fee-amm
6. The block is ≤ the finalized block. Deduplicate on `(txHash, logIndex)`.
7. Memos and virtual tags are **attribution hints, not authentication**. Anyone can send a transfer with any memo. Always check amount, token and recipient.

```ts
// Kova sketch (not from docs)
import { decodeEventLog, isAddressEqual as eq, type Address, type Hex, type TransactionReceipt } from 'viem'
import { Abis } from 'viem/tempo'
const GUARD = '0xB10C000000000000000000000000000000000000'

export function classify(rc: TransactionReceipt, pi: { token: Address; merchant: Address; payTo: Address; amount: bigint; memo?: Hex }) {
  if (rc.status !== 'success') return 'FAILED'
  const ev = rc.logs.filter(l => eq(l.address, pi.token))
    .map(l => { try { return decodeEventLog({ abi: Abis.tip20, data: l.data, topics: l.topics }) } catch { return undefined } })
    .filter(Boolean) as any[]
  const xfers = ev.filter(e => e.eventName === 'Transfer')
  if (xfers.some(e => eq(e.args.to, GUARD) && e.args.amount === pi.amount)) return 'HELD'
  const inbound = xfers.find(e => eq(e.args.to, pi.payTo) && e.args.amount === pi.amount)
  if (!inbound) return 'UNMATCHED'
  if (!eq(pi.payTo, pi.merchant)) { // virtual address: need the second hop
    const hop = xfers.find(e => eq(e.args.from, pi.payTo) && eq(e.args.to, pi.merchant) && e.args.amount === pi.amount)
    if (!hop) return 'UNMATCHED'
  }
  if (pi.memo && !ev.some(e => e.eventName === 'TransferWithMemo' && e.args.memo === pi.memo && e.args.amount === pi.amount)) return 'MEMO_MISMATCH'
  return 'PAID' // caller also checks blockNumber <= finalized
}
```

### Design implication: lowest-latency PAID

- **Kova-submitted transactions** (Kova Pay, POS, refunds): Kova's relay co-signs as fee payer and calls `eth_sendRawTransactionSync`. The same request returns the receipt. Kova runs `classify()` and marks PAID with no separate watcher. **Inference:** latency ≈ one block (~0.55 s) plus client↔relay↔RPC round trips, i.e. under about 1–1.5 s end to end.
- **Third-party-submitted transactions** (QR): keep a WebSocket log subscription filtered by accepted token addresses and `Transfer` topic2 ∈ {open virtual addresses / merchant wallets}. Back it with an every-block `eth_getLogs` poll up to `finalized`, using a persisted cursor.

---

## 4. Memos

Sources: https://tempo.xyz/developers/docs/guide/payments/transfer-memos, https://tempo.xyz/developers/docs/protocol/tip20/spec

- A memo is always exactly `bytes32`. "Callers should pack shorter strings or identifiers directly into this field, and use hashes or external references when the underlying payload exceeds 32 bytes."
- The memo is indexed, so an exact-match `getLogs` on it is cheap. It is public forever: **never put PII in it.**
- Docs best practice: use a consistent convention such as `INV-{n}`, `CUST-{id}` or `REFUND-{id}`.
- **Padding is inconsistent across the official examples.** This matters because indexed-topic lookups need byte-exact matches. Verified with viem 2.56.8:

| Encoder in docs | Result for `'INV-12345'` |
|---|---|
| `pad(stringToHex(s), { size: 32 })` | **left-padded** `0x000…494e562d3132333435` |
| `toHex(s, { size: 32 })` / `stringToHex(s, { size: 32 })` | **right-padded** `0x494e562d3132333435000…` |
| Python `b"INV-12345" + b"\x00"*23`, Go `copy(memo[:], …)`, `cast --format-bytes32-string` | right-padded |
| Rust `B256::left_padding_from` | left-padded |

- The docs' watcher decodes with `fromHex(memo,'string').replace(/\0/g,'')`, which tolerates both paddings. Exact lookups do not.
- **Recommended Kova memo layout (Inference/design):** a fixed binary layout, identical on every surface:

```
bytes 0..3   "KOVA" (0x4b4f5641)      magic, avoids collision with MPP/other memos
byte  4      version (0x01)
byte  5      kind: 0x01 payment, 0x02 refund, 0x03 payout/settlement
bytes 6..15  reserved / short merchant id (10 bytes, zero if unused)
bytes 16..31 PaymentIntent UUID (16 raw bytes, e.g. UUIDv7)
```

A refund carries `kind=0x02` and the **same intent UUID**, so `getLogs(args:{memo})` finds the payment and all its refunds by UUID prefix offchain.
- Mainnet already carries third-party memos, e.g. MPP memos starting `0xef1ed712…`. The Tempo API labels those as `attribution` (https://tempo.xyz/developers/docs/api/transfers). A magic prefix keeps Kova memos distinguishable.

---

## 5. Virtual addresses (TIP-1022)

Live on mainnet since T3 (Apr 27, 2026) and on Moderato since Apr 21, 2026 (https://tempo.xyz/developers/docs/guide/node/network-upgrades). **Observed:** `Actions.virtualAddress.resolve` against the mainnet registry returned a registered master on 2026-09-19. Sources: https://tempo.xyz/developers/docs/protocol/tip20/virtual-addresses, https://tempo.xyz/developers/docs/guide/payments/virtual-addresses, TIP-1022 (https://github.com/tempoxyz/tempo/blob/main/tips/tip-1022.md)

**How it works**

- **Layout:** `[4-byte masterId][10-byte 0xFDFDFDFDFDFDFDFDFDFD][6-byte userTag]`. The 48-bit userTag allows about 2.8×10¹⁴ addresses per master.
- **Resolution:** on `transfer`, `transferFrom`, `transferWithMemo`, `transferFromWithMemo`, `mint`, `mintWithMemo` and `systemTransferFrom`, the precompile resolves `to` to the master **inside the same call**. It then runs TIP-403 and receive-policy checks **against the master** and credits the master. `balanceOf(virtual)` stays 0.
- **Unregistered masterId:** reverts `VirtualAddressUnregistered`. This is the first recipient-induced TIP-20 revert.
- **Events:**
  - `transfer`: `Transfer(sender→virtual)`, then `Transfer(virtual→master)`.
  - `transferWithMemo`: `Transfer(sender→virtual)`, `TransferWithMemo(sender→virtual, memo)`, then `Transfer(virtual→master)`.
  - Treat the sequence as **one** deposit.
  - A self-send from the master emits both hops but has zero net effect.

**Registration** (one-time, per master wallet)

- `registerVirtualMaster(bytes32 salt) returns (bytes4 masterId)` on `0xFDC0…0000`, selector `0x5c559d20`.
- `registrationHash = keccak256(abi.encodePacked(msg.sender, salt))`. The first 4 bytes must be zero (32-bit PoW). `masterId = registrationHash[4:8]`.
- Errors: `ProofOfWorkFailed`, `MasterIdCollision`, `InvalidMasterAddress`.
- Event: `MasterRegistered(bytes4 indexed masterId, address indexed masterAddress)`, topic `0xb5c59136d5edcbb78af73e696fa65a73a2856c847f832a8d7be05cff85629015` (computed).
- A registration is **immutable**: there is no rotation. To keep keys rotatable, register a proxy or multisig as the master.
- Salt mining: `VirtualMaster.mineSaltAsync({ address })` from `ox/tempo` (WASM plus workers; "30+ seconds" in a browser). Submit with `Actions.virtualAddress.registerMaster(client, { salt })` or `registerMasterSync`.
- The salt is bound to `msg.sender`. **Kova can mine it on behalf of the merchant, but the merchant wallet must send the registration transaction.** Kova can sponsor its fee.

**Derivation and attribution (offchain)**

```ts
import { VirtualAddress } from 'ox/tempo'
const payTo = VirtualAddress.from({ masterId: merchant.masterId, userTag: intent.userTag }) // userTag: 6-byte hex
const { masterId, userTag } = VirtualAddress.parse(log.args.to)                              // on inbound log
```

Also available: the registry views `decodeVirtualAddress(address)`, `resolveRecipient(address)`, `getMaster(bytes4)`, and `isVirtualAddress(address)`.

**Cost**

- Forwarding adds "a single storage read (SLOAD)".
- New deposit addresses never create state, so the first transfer to a new virtual address avoids the 250,000-gas new-slot cost (TIP-1022 motivation). A new *plain* address would pay it.
- **Inference:** registration writes one new storage slot, so it costs roughly 250k+ gas: about $0.00016 at the floor, ≤ about $0.0035 at the cap. Plus offchain PoW.

**Evaluation for Kova QR payments**

| Option | Pros | Cons |
|---|---|---|
| **Per-PaymentIntent virtual address** (merchant master + random 48-bit userTag per intent) — **recommended** | Works from *any* wallet doing a plain TIP-20 `transfer` (no memo support needed). Exact attribution by `to`. `getLogs` with topic2 = virtual address gives a precise per-intent watch. Funds land directly in the merchant wallet, so Kova stays non-custodial. No per-address state or sweep. | Each merchant wallet must register once (PoW + transaction). Late or duplicate payments to an expired intent's address still reach the merchant and need an "unmatched" queue and a refund. Non-TIP-20 tokens sent there are **irrecoverable**. Wallets and explorers may show confusing two-hop transfers. |
| Per-merchant virtual address (one userTag per merchant or terminal) | Static printed QR codes. Attribution per terminal or location. | Cannot identify *which* intent without a memo or amount matching. No better than the merchant's own address plus memo. |
| No virtual address (merchant address + memo) | No registration. | Generic wallets often cannot set `transferWithMemo`. Amount-only matching is ambiguous. |

Operational notes:
- Configure policies on the **master**. TIP-403 membership calls reject virtual addresses.
- Never mint LP or DEX positions to a virtual address. For example, Fee AMM LP shares minted to a virtual address become unburnable.
- **Inference:** the userTag should be random, not sequential, so one intent's address does not reveal Kova's intent volume. Store a `userTag → intentId` map with a uniqueness constraint.

---

## 6. Receive policies and the TIP-403 policy registry

Receive policies are live since T6 (mainnet Jun 23, 2026, testnet Jun 18, 2026). TIP-403 has existed since genesis, and compound policies (TIP-1015) since T2. Sources: https://tempo.xyz/developers/docs/protocol/tip403/spec, https://tempo.xyz/developers/docs/protocol/tip403/receive-policies, https://tempo.xyz/developers/docs/guide/payments/configure-receive-policies, https://tempo.xyz/developers/docs/protocol/upgrades/t6, TIP-1028 (https://tips.sh/1028)

**Token-level TIP-403 (issuer controls)**

- The registry is at `0x403c…0000`. Built-in policy `0` rejects all and `1` allows all. Custom policies are WHITELIST or BLACKLIST, or (TIP-1015) COMPOUND with separate sender, recipient and mint-recipient sub-policies.
- Every token-moving call checks sender and recipient and **reverts `PolicyForbids`** on failure.
- Useful views: `isAuthorized(uint64,address)`, and since T2 `isAuthorizedSender(uint64,address)` and `isAuthorizedRecipient(uint64,address)`.
- **Observed:** mainnet pathUSD and USDT0 use BLACKLIST policies (ids 2 and 3). USDC.e uses policy 1.

**Account-level receive policy (the receiver's own choice, T6)**

- Set with `setReceivePolicy(uint64 senderPolicyId, uint64 tokenFilterId, address recoveryAuthority)` on the TIP-403 registry (selector `0xdda03d86`).
  - The policies must be built-in 0 or 1, or simple WHITELIST/BLACKLIST. COMPOUND is not allowed.
  - Token filters reuse TIP-403 policies whose members are token addresses.
- Views: `receivePolicy(address)` and `validateReceivePolicy(address token, address sender, address receiver) returns (bool authorized, BlockedReason)`. In viem: `Actions.receivePolicy.validate/get/set/claim/watchBlocked`.
- **A blocked transfer does *not* revert.** The TIP-20 call succeeds. `Transfer(from → 0xB10C…0000)` is emitted, then `TransferBlocked(address indexed token, address indexed receiver, uint64 indexed blockedNonce, uint256 amount, uint8 receiptVersion, bytes receipt)` (topic `0x361d86e46fd139dc3eac4148f16b53597f0f8ddd9aba772aae0034bda5531b1c`, computed).
- Receipts are **not enumerable onchain**. The claimer must supply the `receipt` bytes, so they must be indexed.
- Evaluation order: the token filter first (`TOKEN_FILTER`), then the sender policy (`RECEIVE_POLICY`).
- For `transferFrom`, the allowance is consumed even when delivery is blocked.
- **Recovery** via `claim(address to, bytes receipt)` on the guard (selector `0xbb1757cf`), full amount only:
  - `recoveryAuthority = address(0)`: only the **originator (payer)** can claim. This works as a self-service refund.
  - Nonzero authority: only that address can claim.
  - A "resume" claim (`to == receiver`) skips the receive-policy recheck. A "reroute" claim rechecks TIP-403 and the destination's receive policy.
  - An issuer holding `BURN_BLOCKED_ROLE` can `burnBlockedReceipt` when the policy subject is unauthorized.

**Should a merchant wallet set one? Recommendation (Inference):** no, not for the hackathon.
- A sender policy would block customers.
- A token filter turns a wrong-token payment into a "successful" transaction that the merchant never receives.
- Enforce accepted tokens in Kova's checkout UI and preflight instead.
- If a merchant opts in later (for example, to refuse junk tokens), use `recoveryAuthority = address(0)` so payers can reclaim mistaken sends. Kova must then index `TransferBlocked` for merchant addresses and show them as HELD.
- Customers' wallets may have policies too, which matters for refunds (§8).
- **Observed:** a random mainnet merchant-like address returned `hasReceivePolicy: false`. That is the default for every account.

---

## 7. Fees

Sources: https://tempo.xyz/developers/docs/protocol/fees, https://tempo.xyz/developers/docs/protocol/fees/spec-fee, https://tempo.xyz/developers/docs/protocol/upgrades/t7, TIP-1067 (https://tips.sh/1067), TIP-1010, TIP-1000

### How the fee is computed (mainnet)

- **Units:** gas prices are in **attodollars (10⁻¹⁸ USD) per gas**. The fee in token units (microdollars) is `ceil(base_fee × gas_used / 10¹²)`.
- **Base fee** (T7, TIP-1067; mainnet since Jul 9, 2026): EIP-1559-style, bounded to **[6×10⁸, 1.2×10¹⁰]** attodollars/gas.
  - Target 10,000,000 gas per block, max change 1/8 per block.
  - It decays from cap to floor in about 23 empty blocks (~12 s) and climbs back in about 14 busy blocks (~7 s).
  - This **supersedes TIP-1010's fixed `2×10¹⁰`** ($0.001 per transfer). Do not use the TIP-1010 figure.
- **TIP-1010 values still in force:** total block gas 500M, general (non-payment) gas limit 30M per block, shared (subblock) 50M, transaction cap 30M.
- **T11 (mainnet Sep 10, 2026):** precompile input charge is `30 × ceil(calldata_len/32)` gas (+120 gas for a `transferWithMemo`). Duplicate checks cost 20 gas per value.
- **State creation (TIP-1000):**
  - A new storage slot costs **+250,000 gas**. This includes a recipient's **first balance of a given token**.
  - Account creation adds **+250,000 gas** when the nonce first goes 0→1. A nonce-0 transaction must supply ≥ 271,000 gas.
  - "Transfers to new addresses cost ~300k gas."
- **Observed** on 2026-09-19: `baseFeePerGas = 600000000` (the floor), `eth_gasPrice = 0x23c34600` (6×10⁸), `eth_maxPriorityFeePerGas = 0x0`.

### Cost of one payment (measured gas from mainnet receipts, 2026-09-19)

| Transaction shape (all USDC.e, type `0x76`) | gasUsed (observed) | Floor 6×10⁸ | Cap 1.2×10¹⁰ |
|---|---|---|---|
| `transfer`, self-paid, sequential nonce | 31,118 | 19 µ$ = **$0.000019** | 374 µ$ = $0.00037 |
| `transferWithMemo`, self-paid, sequential nonce | 33,683 | 21 µ$ | 405 µ$ |
| `transferWithMemo`, self-paid, **expiring nonce** | 46,683 (+13,000 = TIP-1009 `EXPIRING_NONCE_GAS`) | 29 µ$ | 561 µ$ |
| `transferWithMemo`, **sponsored + expiring nonce** (Kova's default shape) | 51,471 | **31 µ$ = $0.000031** (fee log confirmed `0x1f`) | 618 µ$ = **$0.00062** |
| Extra: recipient's first balance in that token | +~250,000 (TIP-1000) | +150 µ$ | +3,000 µ$ ($0.003) |
| First tx from a new account, sequential nonce (`transfer`) | 283,554 | 171 µ$ | 3,403 µ$ |
| DEX `swapExactAmountIn` (single swap) | 96,341 | 58 µ$ | 1,157 µ$ |

The docs' rule of thumb is: "~50,000 gas transfer costs $0.0006 at the cap and $0.00003 at the floor."

**Observed:** the sender of the sponsored expiring-nonce transactions above has protocol nonce 0, yet paid no 250k account-creation charge. **Inference:** expiring-nonce transactions avoid the account-creation cost, since they never write the nonce (TIP-1009 E6). Verify on testnet.

### Paying fees in any stablecoin: fee token resolution order

Source: spec-fee. The first level that specifies a token wins. If that token fails the checks, **the transaction is invalid** and later levels are not tried.

1. The transaction's `fee_token` field (Tempo transaction). For sponsored transactions the sender signs a blank fee token and the **fee payer chooses**.
2. The account default via `FeeManager.setUserToken(token)` (viem `client.fee.setUserTokenSync`) for the `fee_payer`.
3. The TIP-20 being called, if the top-level call is `transfer`, `transferWithMemo` or `startReward`. For Tempo transactions, *all* calls must target the same TIP-20 **and** `fee_payer == tx.origin`.
4. The Stablecoin DEX `tokenIn`, for a single `swapExactAmountIn` or `swapExactAmountOut` call.
5. pathUSD as the fallback.

Checks at the chosen level: a USD TIP-20, enough balance for `gasLimit × gasPrice`, and enough Fee AMM liquidity. The protocol collects the max fee before execution and refunds the unused part after.

### Fee AMM

Sources: https://tempo.xyz/developers/docs/protocol/fees/fee-amm, spec-fee-amm

- It is used **only** when the fee token differs from the validator's token.
- The conversion is immediate, at a fixed **0.9970**: the validator receives 99.7% and LPs earn 0.3%.
- **Inference:** the payer or sponsor pays the same nominal fee either way. The 0.3% comes out of what the validator receives.
- If the direct pool lacks liquidity, one two-hop route through `userToken.quoteToken()` is tried (T5).
- Insufficient liquidity makes the transaction invalid.
- **Observed:** `FeeManager.validatorTokens(coinbase)` returned pathUSD for sampled mainnet proposers.
- **Inference:** a Kova sponsor paying in pathUSD avoids depending on AMM liquidity entirely.

### Sponsorship (fee payer)

Sources: https://tempo.xyz/developers/docs/guide/payments/sponsor-user-fees, https://tempo.xyz/developers/docs/api/fee-payer, https://tempo.xyz/developers/docs/server/relay-handler

- This is native: the transaction carries `fee_payer_signature`. No paymaster, bundler or EntryPoint is involved.
- Both signatures must be valid, and the fee payer must hold enough of the fee token.
- A fee payer signature is transaction-specific.
- Three ways to run it:
  - Viem with a local fee payer: `sendTransactionSync({ ..., feePayer: account })`.
  - Via a relay: `createClient({ transport: withRelay(http(), http(RELAY_URL)) })` plus `feePayer: true`.
  - **Hosted** at `https://api.tempo.xyz/rpc/sponsor?key=…`. It needs a Tempo Console API key and billing, and "Tempo Console signups are currently limited."
  - **Public testnet** at `https://sponsor.moderato.tempo.xyz` (no key).
  - **Self-hosted** with `Handler.relay({ feePayer: { account, validate } })` from `tapimo`. Without `validate` it sponsors everything.
- **Kova economics (Inference, using the measured 51,471 gas):**

| Volume | At floor | At cap |
|---|---|---|
| 1M sponsored payments/month | ≈ $31 | ≈ $618 |
| New-merchant or new-token first receipt, per (merchant, token) | +$0.00015 | +$0.003 |

- Kova must keep a funded fee-payer balance that covers `gasLimit × maxFeePerGas` for in-flight transactions.

### Payment lanes

Sources: https://tempo.xyz/developers/docs/protocol/blockspace/payment-lane-specification, TIP-1045 (https://tips.sh/1045, mainnet since T5, Jun 9, 2026)

- Non-payment transactions in the proposer lane are capped at `general_gas_limit` (30M per block). Payment transactions can use the rest.
- **A transaction is a payment only if:**
  - every call matches the allow-list,
  - `access_list` is empty,
  - `authorization_list` and `tempo_authorization_list` are empty, and
  - `key_authorization` is ≤ 1024 bytes RLP.
- **Allow-list:**
  - TIP-20 (`0x20C0…` prefix): `transfer`, `transferWithMemo`, `transferFrom`, `transferFromWithMemo`, `approve`, `mint`, `mintWithMemo`, `burn`, `burnWithMemo`.
  - TIP20ChannelReserve: `open`, `topUp`, `settle`, `close`, `requestClose`, `withdraw`.
- Static-signature calls must have **no trailing bytes**.
- Fee sponsorship and validity-window fields do not affect classification.
- **Implications for Kova:**
  - Payments, batched payouts and refunds: payment lane.
  - Swap+pay (DEX call) and virtual-master registration: general lane. That is fine, just not congestion-protected.

---

## 8. Refunds

Sources: https://tempo.xyz/developers/docs/guide/payments/transfer-memos, https://tempo.xyz/developers/docs/protocol/tip20/spec (Permit), TIP-1004, https://tempo.xyz/developers/docs/guide/tempo-transaction (Access Keys)

- **TIP-20 has no chargeback or reversal primitive.** The docs only offer memo conventions (`REFUND-{id}`, "refund address in memo"). The only "clawback-like" powers are issuer-level (`pause`, `burnBlocked` for policy-blocked addresses) and are not available to Kova.
- **Pattern:** the merchant wallet sends `transferWithMemo(customer, amount ≤ remaining, memo = KOVA{kind=REFUND, intentUUID})` in the **same token** as the original payment. Kova sponsors the fee. Kova stores `refund → original txHash` and enforces `Σ refunds ≤ paid`.
  - Alternative memo: the original payment's 32-byte transaction hash. It links directly, but loses the `kind` and intent fields.
- **Refund destination (Inference):**
  - The original `Transfer.from` is correct for Kova Pay and self-custody wallets.
  - It is **not** safe when the payer paid from an exchange or omnibus hot wallet (QR flow). Collect a refund address in that case.
- **Preflight:** `Actions.receivePolicy.validate({ token, sender: merchant, receiver: customer })`. If the customer's policy blocks it, the refund lands in the guard. With the customer's `recoveryAuthority = 0`, the originator (merchant) can claim it back.
- **Who signs, while staying non-custodial:**
  - (a) The merchant signs each refund from the dashboard, with a passkey or wallet.
  - (b) The merchant grants Kova an **access key** limited by spending limit and call scope to `transferWithMemo` on specific tokens (TIP-1011, T3). This is covered in the accounts doc.
  - (c) The merchant `approve`s a Kova operator for a capped allowance, and Kova calls `transferFromWithMemo(merchant, customer, amt, memo)`. `approve` and `transferFromWithMemo` are payment-lane calls.
- **Permit (TIP-1004, T2, mainnet Mar 31, 2026):**
  - Signature: `permit(owner, spender, value, deadline, v, r, s)` (selector `0xd505accf`).
  - EIP-712 domain: `{name: token.name(), version: "1", chainId, verifyingContract}`.
  - Typehash: `Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)`.
  - Only `v ∈ {27, 28}` is accepted.
  - No TIP-403 check and allowed while paused (like `approve`).
  - **Inference:** permit needs an ECDSA (secp256k1) owner signature, so passkey (P256/WebAuthn) wallets cannot produce one. Prefer access keys for passkey merchants.

---

## 9. Stablecoin DEX (only what Kova needs)

Sources: https://tempo.xyz/developers/docs/protocol/exchange, https://tempo.xyz/developers/docs/protocol/exchange/executing-swaps, https://tempo.xyz/developers/docs/guide/stablecoin-dex/executing-swaps, https://tempo.xyz/developers/docs/api/exchange

**Contract and functions**

- An orderbook precompile at `0xdec0…0000`. It covers USD TIP-20 pairs only, each token against its `quoteToken`. Multi-hop routing is automatic along the quote-token tree.
- Ticks are 0.1 bp, with orders every 1 bp. There is no separate taker fee in the spec; the cost is the spread.
- Functions:
  - `swapExactAmountIn(address tokenIn, address tokenOut, uint128 amountIn, uint128 minAmountOut) returns (uint128)`, selector `0xf8856c0f`
  - `swapExactAmountOut(address tokenIn, address tokenOut, uint128 amountOut, uint128 maxAmountIn) returns (uint128)`, selector `0xf0122b75`
  - Quotes: `quoteSwapExactAmountIn` and `quoteSwapExactAmountOut` (views; they revert on insufficient liquidity).
- Output goes to the caller. The input is taken from the caller's DEX internal balance first, then from the wallet.
- viem: `Actions.dex.buy` (exact out), `Actions.dex.sell` (exact in), and `getBuyQuote` / `getSellQuote`.
- **Observed quotes (mainnet, 2026-09-19):**
  - 10 USDC.e → 9.999 pathUSD (1 bp); the reverse is the same.
  - 10 USDT0 → 9.995 USDC.e (2 hops).
  - 10,000 USDC.e → 9,999 pathUSD.

**Atomic swap+pay: yes.** A Tempo transaction batch is all-or-nothing:

```ts
import { Actions, Addresses } from 'viem/tempo'
const need = parseUnits('25.00', 6)                          // merchant wants pathUSD
const quote = await Actions.dex.getBuyQuote(client, { tokenIn: USDCe, tokenOut: pathUSD, amountOut: need })
const maxAmountIn = quote * 1005n / 1000n                     // 0.5% slippage
await client.sendTransactionSync({
  feeToken: USDCe,                                            // or feePayer: true — MUST set; see gotcha 11
  calls: [
    Actions.token.approve.call({ token: USDCe, spender: Addresses.stablecoinDex, amount: maxAmountIn }),
    Actions.dex.buy.call({ tokenIn: USDCe, tokenOut: pathUSD, amountOut: need, maxAmountIn }),
    Actions.token.transfer.call({ token: pathUSD, to: merchant, amount: need, memo: kovaMemo }),
  ],
})
```

- The docs guide includes the `approve` call. The TIP-20 spec says the StablecoinDEX is on the T5 **implicit approval list**, so it can pull tokens without an allowance. Keep `approve` until testnet confirms otherwise.
- **Slippage:** guides use a 0.5% (UI) to 1% tolerance. The whole transaction reverts on `MAX_IN_EXCEEDED`, `INSUFFICIENT_OUTPUT` or `INSUFFICIENT_LIQUIDITY`, and nothing is paid.
- **Other routes:**
  - The `tapimo` relay's `autoSwap: { slippage }` prepends `approve` + `buy` automatically.
  - Tempo API `POST /v1/exchange/quotes` (`sourceToken`, `destinationToken`, `amount`, `mode`, `slippageBps`) plus `POST /v1/exchange/quotes/execute` returns unsigned `calls`.
- **Recommendation (Inference):** let merchants accept a set of USD stablecoins natively: USDC.e, pathUSD and USDT0 at 1–5 bp apart. Offer swap+pay only when a merchant insists on one token. Swap+pay costs about 2–3× the gas, runs in the general lane, and adds a revert risk.

---

## 10. Parallel transactions

Sources: https://tempo.xyz/developers/docs/guide/payments/send-parallel-transactions, https://tempo.xyz/developers/docs/guide/tempo-transaction, TIP-1009, TIP-1093

- **Expiring nonces:**
  - Fields: `nonceKey = maxUint256`, `nonce = 0`, `now < validBefore ≤ now + 300` s. The window was 30 s until T11 made it 5 minutes (mainnet Sep 10, 2026).
  - Replay protection is by transaction hash in a ring buffer (capacity 3,000,000 after TIP-1093).
  - Each transaction costs +13,000 gas. There is no permanent state, and transactions from one sender are independent in the same block.
  - viem and wagmi attach expiring nonces automatically for concurrent sends (`Promise.all([...transferSync()])`). You can also set them explicitly with `nonceKey: maxUint256, validBefore`.
- **2D nonces** (`nonceKey` 1…2²⁵⁶−2): sequential lanes. Using a **new nonce key costs +250,000 gas** once, because it creates storage (TIP-1000), so reuse a small fixed set of lanes.
- **Kova use:**
  - Expiring nonces for POS, Kova Pay and bulk refunds or payouts.
  - A hard expiry makes retries deterministic: after `validBefore`, a signed transaction can never be included.
  - Re-signing with a new `validBefore` produces a **new hash**. Never re-sign while the old one may still land.
  - A `validAfter`/`validBefore` pair also enables scheduled payouts.

---

## 11. Zones (privacy)

- Zones are "still in early development and available for testing purposes on Tempo Testnet only… Do not use this in production."
- T10 put the ZoneFactory (`0x5AF2…0000`) on mainnet, but "these protocol contracts do not imply production readiness."
- **For Kova:** not relevant for the Oct 12 build. Mention it as roadmap only (private merchant balances).
- Sources: https://tempo.xyz/developers/docs/protocol/zones, https://tempo.xyz/developers/docs/guide/private-zones, https://tempo.xyz/developers/docs/quickstart/predeployed-contracts

---

## 12. Compliance hooks: why a Kova payment can fail, and how to detect it first

Sources: TIP-20 spec, TIP-403 spec, TIP-1015, TIP-1022, TIP-1028, spec-fee

| Cause | Result | Preflight check |
|---|---|---|
| Token `paused()` (issuer's PAUSE_ROLE) | Revert `ContractPaused`. Fee collection in that token also fails (`transferFeePreTx` respects pause), so the transaction is invalid. | `token.paused()` |
| Payer or merchant not authorized by the token's TIP-403 policy (blacklist, whitelist, compound) | Revert `PolicyForbids` | `policyId = token.transferPolicyId()`, then `isAuthorizedSender(policyId, payer)` and `isAuthorizedRecipient(policyId, merchant)` |
| Merchant's receive policy rejects the token or sender | **Success, but funds HELD at `0xB10C…`** | `validateReceivePolicy(token, payer, merchant)` / `Actions.receivePolicy.validate` |
| Virtual address with an unregistered masterId | Revert `VirtualAddressUnregistered` | `registry.resolveRecipient(to)` |
| `to` is zero or a TIP-20 address | Revert `InvalidRecipient` | Kova-side validation |
| Insufficient balance or allowance | Revert `InsufficientBalance(...)` / `InsufficientAllowance` | `getBalance` / `getAllowance` |
| Fee token not USD, balance short, or Fee AMM liquidity short | Transaction **invalid** (rejected before inclusion) | Sponsor with a funded fee payer; estimate gas |
| Access-key limits or scope (card or POS keys) | Rejected or reverted | AccountKeychain state (see the accounts doc) |
| Trailing calldata bytes (T11, until T12) | Precompile rejects them | Use unmodified viem encoding, never `dataSuffix` |

- **One-shot simulation:** `Actions.simulate.simulateCalls(client, { account: payer, calls })` uses `tempo_simulateV1` and returns per-call results and logs. Scan the logs for a `Transfer` to `0xB10C…` to catch HELD outcomes, which a plain `eth_call` reports as success.
- `eth_estimateGas` catches reverts but not HELD outcomes. Source: viem 2.56.8 `tempo/actions/simulate`, https://tempo.xyz/developers/docs/api/rpc

---

## Kova payment flows on Tempo

Shared rules for every flow:
- Every PaymentIntent (PI) has `{id(UUIDv7), merchantWallet, token(s), amount (6-dec), memo = KOVA(kind=1, id), payTo, status}`.
- Status machine: `CREATED → SUBMITTED(txHash) → PAID | HELD | FAILED | EXPIRED`, then `PARTIALLY_REFUNDED | REFUNDED`.
- PAID requires `classify()` (§3) to return PAID and `blockNumber ≤ finalized`.

### (a) QR checkout from any Tempo wallet

1. **Merchant onboarding (once):**
   - Kova backend: `VirtualMaster.mineSaltAsync({ address: merchantWallet })`.
   - The merchant wallet sends `registerMasterSync({ salt })`, sponsored by Kova. Store `masterId`.
   - **Inference:** optionally pre-warm each accepted token's balance slot by sending dust, so customers' first payments do not pay the 250k new-slot gas.
2. **Create PI:** pick a random unused 6-byte `userTag`, set `payTo = VirtualAddress.from({ masterId, userTag })`, TTL about 10–15 min.
3. **Render the QR** with `payTo`, token, amount and chain 4217.
   - **Inference:** no Tempo payment-URI standard is documented. Use an EIP-681-style URI, e.g. `ethereum:<token>@4217/transfer?address=<payTo>&uint256=<amount>`, plus a human-readable fallback.
4. **Watch:**
   - WebSocket `eth_subscribe logs` with `address: [accepted tokens]` and `topics: [Transfer, null, payTo]`.
   - Plus a per-block `eth_getLogs` backfill to `finalized`.
   - Optionally a Tempo API `token:transfer` webhook as a third signal.
5. **On hit:** fetch the receipt, run `classify(rc, {payTo, merchant, amount, token})`, and require both hops. Then mark PAID, notify the merchant via Kova webhook, and update the POS or web UI.
6. **Edge cases:**
   - Underpayment: keep open and allow top-ups, or refund.
   - Overpayment: refund the difference.
   - A payment after expiry goes to the "unmatched funds" queue and then to a refund (the funds are already in the merchant wallet).
   - Wrong token: if it is a TIP-20, it still landed with the merchant, so refund it. If it is not a TIP-20, it is lost.
7. **Fallback without a registered master:** pay to the merchant address with the KOVA memo, for wallets that support memos. Match on memo, amount and token.
8. **Latency:** detection is about 1 block after the payer's wallet broadcasts it, plus watcher lag (tens of ms with WebSocket).

### (b) In-app Kova Pay checkout (sponsored)

1. The app fetches the PI. Kova's policy engine approves: per-user limits, merchant allowlist, and a preflight (§12) via `simulateCalls` on the backend.
2. The app signs a Tempo transaction with `calls: [transferWithMemo(merchant, amount, memo)]`, expiring nonce (`validBefore = now + 60`), `feePayer: true`, and no fee token (the sponsor chooses):

```ts
import { createClient, http, withRelay } from 'viem/tempo'
const client = createClient({ account: passkeyAccount, transport: withRelay(http(), http(KOVA_RELAY_URL)) })
const { receipt } = await client.token.transferSync({
  token: pi.token, to: pi.merchantWallet, amount: pi.amount, memo: pi.memo, feePayer: true,
})
```

3. Kova's relay is `tapimo` `Handler.relay` with `feePayer.validate`:
   - Accept only one allow-listed `transferWithMemo` to a registered merchant, with a KOVA memo of an open PI, amount = PI amount, and a `validBefore` window of 60 s or less.
   - It co-signs with `feeToken = pathUSD` (**Inference:** this avoids a Fee AMM hop) and forwards `eth_sendRawTransactionSync`.
4. The relay (or a wrapper around `handler.fetch`, **Inference**) inspects the returned receipt and runs `classify()`, then marks PAID **before** responding to the app. The app shows success from the same response.
5. This transaction is in the payment lane. Kova's cost is about $0.000031 now and ≤ $0.00062 at the cap.
6. **Latency:** about 1 block (~0.55 s) plus two network round trips. Target under 1 s p50 (**Inference**).
7. **Timeout handling:** if `eth_sendRawTransactionSync` times out, poll `eth_getTransactionReceipt(hash)` until `validBefore`. Only after that may a new transaction be signed.

### (c) Card tap at POS (Kova Terminal)

Card and key details are in the access-keys/accounts doc. This section covers only transaction construction and confirmation.

1. The Terminal creates a PI via the backend and receives `{merchantWallet, token, amount, memo}`.
2. The card's access key (an AccountKeychain key scoped by TIP-1011 limits and calls) signs:
   - a Tempo transaction with `calls: [transferWithMemo(merchant, amount, memo)]`,
   - `nonceKey = maxUint256`, `validBefore = now + 30…60 s` (a short window bounds replay and staleness),
   - fee-payer mode (the sender signs a blank fee token).
   - If this is the card's first use, a `key_authorization` rides along. It must stay **≤ 1024 bytes RLP** to remain in the payment lane.
3. The Terminal sends the signed payload to Kova's relay. The relay applies policy, co-signs as fee payer, calls `eth_sendRawTransactionSync`, and runs `classify()`.
4. The Terminal shows APPROVED when the relay returns PAID.
5. **If there is no answer:** the Terminal shows "pending" and polls by hash until `validBefore`. After that the tap is provably void, so it retries with a fresh signature. There is no double charge because a hash can land at most once and the old transaction is dead after `validBefore`.
6. **Latency:** tap-to-approve ≈ NFC read + about 1 block + round trips (**Inference:** about 1–1.5 s).

### (d) Refund

1. The merchant dashboard selects a PI and amount. Kova checks `Σ refunds + amount ≤ paid`.
2. Destination: the original payer (`Transfer.from` of the PAID transaction), or a collected refund address for QR or exchange payers.
3. Preflight: `receivePolicy.validate(token, merchant, customer)`, the TIP-403 checks, and `paused()`.
4. The merchant wallet signs `transferWithMemo(customer, amount, KOVA(kind=2, sameIntentUUID))`. Alternatively Kova signs with the merchant-granted scoped access key. Kova sponsors via its relay and uses an expiring nonce.
5. Confirm with the same `classify()` in reverse (from = merchant, to = customer):
   - PAID → REFUNDED or PARTIALLY_REFUNDED.
   - HELD → surface it. The merchant can `claim` the guard receipt back if the customer's `recoveryAuthority` is 0.
6. Bulk refunds use parallel expiring-nonce transactions or one batched transaction. A batch stays in the payment lane if it contains only `transferWithMemo` calls.

### (e) Reconciliation and settlement status

- **Settlement is the payment.** Funds move payer → merchant (or virtual → master) inside one finalized transaction. Kova never holds funds, so there is no payout batch. "Settled" = PAID + finalized.
- **Indexer (Kova-owned):**
  - A cursor over finalized blocks runs `eth_getLogs` for `Transfer` and `TransferWithMemo` on accepted tokens, where topic2 ∈ merchant wallets and virtual addresses.
  - It also reads `TransferBlocked` from `0xB10C…` where receiver ∈ merchant wallets.
  - Rows are idempotent on `(txHash, logIndex)`.
- **Matching:** by virtual `userTag`, then KOVA memo, then (as a last resort) the `(merchant, token, amount, time)` heuristic flagged for review. Anything unmatched goes to an "unapplied funds" queue.
- **Per-merchant daily statement:** gross inflows per token, refunds (kind=2 memos from the merchant), held amounts, unmatched items, and Kova's sponsorship cost (the sum of fee `Transfer`s to `0xfeec…` from the Kova fee payer, or `receipt.feePayer`/`feeToken` per transaction).
- **Cross-check** against Tempo API `GET /v1/transfers?recipient=<merchant>&include=memo&blockNumber.from=…` (https://tempo.xyz/developers/docs/api/transfers).
- **Status API to merchants:** PI status + `txHash` + `blockNumber` + explorer link `https://explore.tempo.xyz/tx/<hash>`.

---

## Gotchas

1. **Wrong selector in the docs:** the Python and Go examples use `0x76a8ee59` for `transferWithMemo`. The real selector is `0x95777d59`.
2. **Memo padding differs between official examples** (left vs right). Pick one encoder (Kova binary layout) and use it everywhere. Exact-match topic filters break otherwise.
3. **A receipt with `status: success` does not mean the merchant was paid.** A receive-policy block redirects the funds to `0xB10C…` (T6). Check the `to` field in the logs.
4. **Every receipt has an extra fee `Transfer` to `0xfeec…`.** If the payer pays fees in the same token, its balance falls by amount + fee. Never infer payments from balance deltas.
5. **Virtual-address deposits emit two `Transfer`s.** Count once. `balanceOf(virtual)` is always 0. Non-TIP-20 tokens sent to a virtual address are lost.
6. **The TIP-1010 fee figures ($0.001 per transfer, fixed base fee) are stale.** T7's dynamic fee is ≤ $0.0006 and currently about $0.00003.
7. **The first time an address receives a token it costs about +250k gas** (≈ 6× a normal transfer). **Inference:** a merchant who sweeps a token balance to exactly 0 re-incurs this on the next payment. Leave dust.
8. **T11 strict ABI (mainnet since Sep 10, 2026):** trailing calldata bytes (for example viem `dataSuffix` attribution) are rejected until T12. They also disqualify a transaction from the payment lane (TIP-1045).
9. **Expiring-nonce retries:** a new `validBefore` produces a new hash. Re-signing before the old one expires can double-pay.
10. **`eth_getBalance` returns a huge placeholder** (≈4.24e75). Never use native balance checks. `BALANCE` and `CALLVALUE` return 0.
11. **Swap+pay batches have no automatic fee token.** The TIP-20 fee-token rule needs *all* calls to target the same TIP-20, and the DEX rule needs a single call. Such a batch falls back to **pathUSD**. Set `feeToken` or sponsor it.
12. **`transferFrom` when blocked by a receive policy still consumes the allowance.**
13. **Blocked receipts are not enumerable onchain.** If `TransferBlocked` is not indexed, Kova cannot build a `claim`.
14. **Permit accepts only ECDSA `v ∈ {27, 28}`.** Passkey accounts need access keys or `approve` (**Inference**).
15. **The docs' example address `0x742d35Cc…f0bEbb` fails viem's checksum check.** Do not copy it into tests.
16. **Tempo transactions are type `0x76`** and carry `calls[]`, not `to`/`input`. Indexers that read `tx.input` miss them. Use receipt logs.
17. **pathUSD and USDT0 are policy-controlled** (BLACKLIST policies on mainnet). A payer or merchant on an issuer blacklist reverts with `PolicyForbids`.

## Open questions

1. What does `registerVirtualMaster` actually cost in gas on mainnet? Does it qualify for sponsorship via Kova's relay? It is general lane.
2. Are expiring-nonce transactions from nonce-0 accounts always exempt from TIP-1000's 250k account-creation charge (observed on one account)? Confirm on Moderato, because it affects Kova Pay onboarding cost.
3. Do T7 storage credits (TIP-1060) offset a TIP-20 balance slot re-created after going to zero?
4. Is `approve` still required before DEX swaps given T5 implicit approvals? Test on Moderato.
5. Can Kova get hosted Fee Payer API access (Console signups "currently limited"), and on what pricing? Otherwise self-host `tapimo` `Handler.relay` with a funded key.
6. What finality and latency does the Tempo API `token:transfer` webhook guarantee? Is it fired on finalized blocks, and how soon?
7. Which wallets can scan a payment QR and send a TIP-20 `transfer` or `transferWithMemo` on chain 4217 (Tempo Wallet, MetaMask, etc.)? No Tempo payment-URI standard is documented.
8. How deep is Fee AMM liquidity for USDC.e→pathUSD on mainnet (not measured)? Does `validatorTokens()` returning pathUSD reflect explicit choices or a default?
9. When does T12 (trailing-bytes relaxation) activate?

## Sources

All tempo.xyz pages were downloaded 2026-09-19. Mainnet observations used `https://rpc.tempo.xyz` on the same date.

**Payments guides**
- https://tempo.xyz/developers/docs/guide/payments/
- https://tempo.xyz/developers/docs/guide/payments/send-a-payment
- https://tempo.xyz/developers/docs/guide/payments/accept-a-payment
- https://tempo.xyz/developers/docs/guide/payments/transfer-memos
- https://tempo.xyz/developers/docs/guide/payments/virtual-addresses
- https://tempo.xyz/developers/docs/guide/payments/configure-receive-policies
- https://tempo.xyz/developers/docs/guide/payments/pay-fees-in-any-stablecoin
- https://tempo.xyz/developers/docs/guide/payments/sponsor-user-fees
- https://tempo.xyz/developers/docs/guide/payments/send-parallel-transactions

**TIP-20 and TIP-403**
- https://tempo.xyz/developers/docs/protocol/tip20/overview
- https://tempo.xyz/developers/docs/protocol/tip20/spec
- https://tempo.xyz/developers/docs/protocol/tip20/virtual-addresses
- https://tempo.xyz/developers/docs/protocol/tip403/overview
- https://tempo.xyz/developers/docs/protocol/tip403/spec
- https://tempo.xyz/developers/docs/protocol/tip403/receive-policies

**Fees**
- https://tempo.xyz/developers/docs/protocol/fees/
- https://tempo.xyz/developers/docs/protocol/fees/spec-fee
- https://tempo.xyz/developers/docs/protocol/fees/fee-amm/
- https://tempo.xyz/developers/docs/protocol/fees/spec-fee-amm

**Blockspace**
- https://tempo.xyz/developers/docs/protocol/blockspace/overview
- https://tempo.xyz/developers/docs/protocol/blockspace/payment-lane-specification
- https://tempo.xyz/developers/docs/protocol/blockspace/consensus

**Exchange**
- https://tempo.xyz/developers/docs/protocol/exchange/
- https://tempo.xyz/developers/docs/protocol/exchange/executing-swaps
- https://tempo.xyz/developers/docs/protocol/exchange/exchange-balance
- https://tempo.xyz/developers/docs/guide/stablecoin-dex/executing-swaps

**Transactions and upgrades**
- https://tempo.xyz/developers/docs/guide/tempo-transaction/
- https://tempo.xyz/developers/docs/protocol/upgrades/t6
- https://tempo.xyz/developers/docs/protocol/upgrades/t7
- https://tempo.xyz/developers/docs/protocol/upgrades/t11
- https://tempo.xyz/developers/docs/guide/node/network-upgrades

**Tempo API and server**
- https://tempo.xyz/developers/docs/api/rpc
- https://tempo.xyz/developers/docs/api/fee-payer
- https://tempo.xyz/developers/docs/api/transfers
- https://tempo.xyz/developers/docs/api/webhooks
- https://tempo.xyz/developers/docs/api/exchange
- https://tempo.xyz/developers/docs/server/relay-handler

**Quickstart and bridging**
- https://tempo.xyz/developers/docs/quickstart/connection-details
- https://tempo.xyz/developers/docs/quickstart/predeployed-contracts
- https://tempo.xyz/developers/docs/quickstart/evm-compatibility
- https://tempo.xyz/developers/docs/guide/bridge-layerzero

**Zones**
- https://tempo.xyz/developers/docs/protocol/zones/
- https://tempo.xyz/developers/docs/guide/private-zones/

**TIPs**
- TIP-1000, TIP-1004, TIP-1009, TIP-1010, TIP-1015, TIP-1022 (text via `llms-full.txt`)
- https://github.com/tempoxyz/tempo/blob/main/tips/tip-1028.md
- https://github.com/tempoxyz/tempo/blob/main/tips/tip-1045.md
- https://github.com/tempoxyz/tempo/blob/main/tips/tip-1067.md
- https://github.com/tempoxyz/tempo/blob/main/tips/tip-1093.md
- https://github.com/tempoxyz/tempo/blob/main/tips/tip-1100.md

**Token list, packages and chain data**
- Token list: https://tokenlist.tempo.xyz/list/4217
- npm `viem@2.56.8` (`viem/tempo` Abis, Addresses, actions `token`, `dex`, `receivePolicy`, `virtualAddress`, `simulate`) and `ox/tempo` `VirtualAddress`, `VirtualMaster` (checked in ox@1.7.5; also present in `ox@0.14.45`, the version viem pins, which Kova should use)
- Mainnet data: example sponsored `transferWithMemo` tx `0xf6c9f1aaf6845103e7e440b7457ebfdcb9f99c9dc8f68fe9f234a32850f492ed`; gas samples from USDC.e, pathUSD and USDT0 `Transfer` logs; DEX quotes via `quoteSwapExactAmountIn`; token `transferPolicyId()`; `FeeManager.validatorTokens`; `latest`/`finalized` block comparison.
