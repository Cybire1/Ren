# Tempo: Network, SDKs & Funding

Tempo is an EVM chain built for payments. It targets the Osaka EVM hard fork and uses Simplex BFT consensus with deterministic finality. Blocks come about every 0.55 s. Tempo mainnet (chain ID `4217`, `https://rpc.tempo.xyz`) has been live since 2026-03-18. The public testnet is Moderato (`42431`, `https://rpc.moderato.tempo.xyz`). On 2026-09-19 both networks run the **T11** upgrade (checked live with `tempo_forkSchedule`), and no T12 is scheduled. Tempo has **no native gas token**. Fees are priced in USD and paid in any USD-denominated TIP-20 stablecoin, and every TIP-20 token uses **6 decimals**. There is **no native USDC on Tempo mainnet**. The USDC asset is **USDC.e** (Stargate-bridged), at `0x20C000000000000000000000b9537d11c60E8b50`, with about 83.3M supply. The protocol's first stablecoin and DEX quote token is pathUSD (`0x20c0…0000`, about 49.6M supply). The main TypeScript tools are `viem/tempo` (viem 2.56.8), `wagmi/tempo` (wagmi 3.7.7) and the Tempo Accounts SDK (`accounts` 0.18.4), which ships React Native/Expo adapters. Funds reach mainnet through several routes: Stargate (1:1, 0 bps Ethereum↔Tempo), Relay, Across, Squid, Bungee, CCIP, Coinbase, Tempo Wallet's deposit flow, and the Tempo API "Routes" aggregator. Live Routes quotes arrived 2026-09-19 from Ethereum, Base, Solana, Tron, BNB and Polygon.

## What Kova needs from this

- **Map `currency: "USDC"` to USDC.e.** On mainnet that is `0x20C000000000000000000000b9537d11c60E8b50`, with 6 decimals and currency `USD`. No token with symbol `USDC` exists on Tempo: it is absent from the token list, from `/v1/verified-tokens`, and from viem's `usdc` definition. Either rename the API currency to `USDC.e` or treat `USDC` as an alias. Also accept **pathUSD**, the asset Tempo Wallet shows and the DEX quote token.
- **Make the token map network-aware.** The Moderato faucet funds only pathUSD, AlphaUSD, BetaUSD and ThetaUSD, each at 1M. It does **not** fund testnet USDC.e (`0x20c0…9e8d7eb59b783726`); this was checked live and the balance stayed 0. Use pathUSD or AlphaUSD as the testnet stand-in for "USDC".
- **Never use native balance, `msg.value`, `eth_getBalance` or `BALANCE`.** `eth_getBalance` returns a placeholder of about 4.24e75 on both networks. Read balances with TIP-20 `balanceOf` or `client.token.getBalance`.
- **Plan sponsored fees.** The hosted Fee Payer (`https://api.tempo.xyz/rpc/sponsor?key=…`) needs a Tempo API Console key, and **the Console is invite-only**. Production sponsorship also needs active billing. For the hackathon, test on `https://sponsor.moderato.tempo.xyz`; this worked live with a P-256 account and a memo transfer. On mainnet, run Kova's own fee payer (for example tapimo `Handler.relay` with a funded account) and fund it with USDC.e. Measured cost: a first transfer to a new address used 281,142 gas, which is about $0.00017 at the 6e8 attodollar/gas floor observed today and about $0.0034 at the cap.
- **Build Kova Pay on the Accounts SDK (`accounts`).** It has first-class Expo support: `accounts/mobileWebAuth`, `accounts/react-native/expo-web-browser` and `accounts/react-native/secure-mmkv`. It needs a **dev build, not Expo Go**, plus polyfills. It also exposes `wallet_deposit`, Tempo Wallet's embedded onramp and deposit UI, which is the lowest-effort consumer top-up.
- **The NFC card can be an external P-256 signer.** viem's `Account.from({ keyType: 'p256', publicKey, sign })` accepts a custom `sign`. Tempo's P256 signature format has a `pre_hash` flag: when it is true, the verifier computes `sha256(digest)`. **Inference:** this matches JavaCard `ALG_ECDSA_SHA_256`, which hashes its input, so the card can sign the 32-byte tx hash as a message. Validate on Moderato. Other constraints: T11 lets `validBefore` be up to 5 minutes ahead, which gives time between the tap and submission. Access keys **cannot deploy contracts** (T3). The access-key and card doc covers the rest.
- **Remove data suffixes from Kova's own calldata** until T12. T11 strict ABI decoding rejects trailing bytes on precompile calls, which includes TIP-20 `transfer`. Standard viem encoding is unaffected, but any attribution or `dataSuffix` bytes break transfers and `eth_call`.
- **Demo wallet funding (team):** the fastest path is USDC on Ethereum or Base, sent through Stargate (Tempo EID `30410`) or chosen from a Tempo Routes quote, which lands as USDC.e. Alternatively, run `tempo wallet fund` or bridge through Relay or Across. See §5.
- **Real consumer top-up:** use Accounts SDK `wallet_deposit` (Tempo Wallet UI). Next options are Tempo Routes reusable deposit addresses per user, which need an API key, or a partner onramp such as MoonPay or Mt Pelerin. Coinbase supports sending on the Tempo network.
- **Tooling:** use upstream Foundry (`foundryup`, v1.8.3; `tempo-foundry` is deprecated) with `forge init -n tempo` and verification at `https://contracts.tempo.xyz`. For local nodes, use `prool`'s `Instance.tempo()`. For AI agents, add the docs MCP `https://mcp.tempo.xyz`.
- **Doc snippets that pair `chainId 4217` with AlphaUSD (`0x20c0…0001`) are wrong for mainnet.** AlphaUSD has no code on mainnet (`eth_getCode` returns `0x`). This affects the Go, Python and wallet-guide examples.

---

## 1. Networks

### 1.1 Connection details

| | **Mainnet** | **Testnet (Moderato)** |
|---|---|---|
| Chain ID | `4217` (`0x1079`) | `42431` (`0xa5bf`) |
| HTTP RPC | `https://rpc.tempo.xyz` | `https://rpc.moderato.tempo.xyz` |
| WebSocket | `wss://rpc.tempo.xyz` | `wss://rpc.moderato.tempo.xyz` |
| Tempo API hosted RPC (best-effort, no SLA) | `https://api.tempo.xyz/rpc` | `https://api.tempo.xyz/rpc/testnet` |
| Explorer | `https://explore.tempo.xyz` | `https://explore.testnet.tempo.xyz` |
| Native currency symbol (for wallets) | `USD` (no native token) | `USD` |
| Faucet | none | `tempo_fundAddress` RPC, or `POST https://tempo.xyz/developers/api/faucet` |
| Public fee payer (no key) | none (Tempo API `https://api.tempo.xyz/rpc/sponsor`, needs a key) | `https://sponsor.moderato.tempo.xyz` |
| Token list | `https://tokenlist.tempo.xyz/list/4217` | `https://tokenlist.tempo.xyz/list/42431` |
| Tempo API `chainId` alias | `mainnet` (default) | `testnet` (the default for sandbox keys) |
| viem chain | `tempo` (`viem/chains`) = `tempoMainnet` (`viem/tempo/chains`) | `tempoModerato` (`viem/chains`) = `tempoTestnet` (`viem/tempo/chains`) |
| LayerZero endpoint ID | `30410` | not documented |

Both RPCs answered `eth_chainId` correctly on 2026-09-19. The Tempo API RPC also answered anonymously. The docs name the testnet both "Tempo Testnet (Moderato)" and "Moderato". Sources: https://tempo.xyz/developers/docs/quickstart/connection-details, https://tempo.xyz/developers/docs/protocol/rpc, https://tempo.xyz/developers/docs/api/json-rpc, https://tempo.xyz/developers/docs/api/conventions, https://tempo.xyz/developers/docs/quickstart/tokenlist, https://tempo.xyz/developers/docs/api/fee-payer

### 1.2 Consensus, block time, fees

- **Consensus:** Simplex BFT with a permissioned validator set at launch. Finality is deterministic, not probabilistic. Target block time is about 0.5 s. Source: https://tempo.xyz/developers/docs/quickstart/evm-compatibility
- **Measured over the last 1,000 blocks on 2026-09-19:** 0.556 s/block on mainnet and 0.599 s/block on testnet. Block `gasLimit` was `500,000,000` and `baseFeePerGas` was `600,000,000`. Headers also carry `timestampMillis` and `timestampMillisPart` (full ms = `timestamp*1000 + timestamp_millis_part`). Source for the field: https://tempo.xyz/developers/docs/protocol/transactions/spec-tempo-transaction
- **Fee units:** `max_fee_per_gas` and `base_fee_per_gas` are in **attodollars (10^-18 USD) per gas**. The dynamic base fee (T7) has a cap of `12,000,000,000` and a floor of `600,000,000`. A 50,000-gas transfer costs about $0.0006 at the cap and about $0.00003 at the floor. Per-transaction gas cap is 30M. Sources: https://tempo.xyz/developers/docs/protocol/fees/spec-fee, https://tempo.xyz/developers/docs/protocol/upgrades/t7
- **Launch dates differ between pages.** The network-upgrades page lists mainnet genesis (T0) as Jan 16, 2026. Every quickstart page says mainnet has been "live since March 18, 2026". **Inference:** genesis came first and public launch followed. Source: https://tempo.xyz/developers/docs/guide/node/network-upgrades

### 1.3 Network upgrade status (T2–T11), verified live via `tempo_forkSchedule` on 2026-09-19

`active: "T11"` on both networks. **All of T2–T11 are live on mainnet and testnet.** No T12 appears in the schedule. The T11 page links T12 only as a GitHub PR (#7598). UTC dates below are from the RPC.

| Fork | Testnet | Mainnet | What matters to an app developer |
|---|---|---|---|
| T2 | 2026-03-26 | 2026-03-31 | EIP-2612 `permit()` on all TIP-20s. Compound TIP-403 policies (sender, recipient and mint-recipient rules). |
| T3 | 2026-04-21 | 2026-04-27 | **Enhanced access keys** (periodic limits, call scoping). **The `authorizeKey` ABI changed**: legacy selector `0x54063a55` now fails with `LegacyAuthorizeKeySelectorChanged(newSelector: 0x980a6025)`. **Access keys can no longer create contracts.** Adds the Signature Verifier precompile and virtual addresses. Minimum SDKs: `viem@2.47.11`, `ox@0.14.13`, `tempo-alloy@1.5.1`, tempo-go `v0.4.0`, pytempo `0.5.0`, Foundry `v1.7.0`. |
| T4 | 2026-05-14 | 2026-05-18 | Consensus context in headers. Gas accounting and access-key scope-validation fixes. |
| T5 | 2026-06-03 | 2026-06-09 | `TIP20ChannelReserve` precompile (MPP sessions). Consensus-level payment-lane classification. Implicit approvals for listed precompiles. On-chain TIP-20 `logoURI`. `witness` in key authorizations. Multihop FeeAMM. |
| T6 | 2026-06-18 | 2026-06-23 | **Account-level receive policies**: blocked deposits are held in `ReceivePolicyGuard`. **Admin access keys**. |
| T7 | 2026-07-02 | 2026-07-09 | Dynamic base fee (lower fees). Storage credits. New TIP-20 rewards deprecated. |
| T8 | 2026-07-27 | 2026-07-30 | Committee state, FeeAMM policy exemptions, DEX V2Order storage. TIP-20 rewards fully shut down. |
| T9 | 2026-08-05 | 2026-08-06 | Each TIP-20's policy ID recorded in TIP-403, needed for zones. Relevant only to issuers and tooling. |
| T10 | 2026-08-20 | 2026-08-21 | Native `ZoneFactory`. Zones are still **testnet-only** for production use. |
| T11 | 2026-09-09 | 2026-09-10 | **Breaking:** strict ABI decoding on precompiles rejects trailing bytes. T12 is expected to re-allow trailing bytes. Precompile input cost rises from 6 to 30 gas per word. **Expiring-nonce `validBefore` goes up to 5 minutes** (was 30 s). Duplicate entries in key call-scopes or recipient lists are rejected. |

Sources: https://tempo.xyz/developers/docs/guide/node/network-upgrades, https://tempo.xyz/developers/docs/protocol/upgrades/t2 … /t11, https://tempo.xyz/developers/docs/changelog

### 1.4 How testnet differs

- **Faucet.** It funds pathUSD, AlphaUSD, BetaUSD and ThetaUSD with 1M each. `tempo_fundAddress` exists only on faucet-enabled testnet endpoints. The Tempo API faucet `POST /v1/orgs/{orgId}/faucet` is for signed-in org members. Source: https://tempo.xyz/developers/docs/quickstart/faucet, https://tempo.xyz/developers/docs/api/faucet
- **Testnet-only tokens.** AlphaUSD, BetaUSD and ThetaUSD exist only on testnet. The testnet also carries its own USDC.e, EURC.e and MACH at different addresses (§4.3).
- **Public fee payer.** `https://sponsor.moderato.tempo.xyz` needs no key. Mainnet sponsorship needs a Tempo API key or Kova's own fee payer. Source: https://tempo.xyz/developers/docs/guide/payments/sponsor-user-fees
- **Tempo Zones** (private chains) are testnet-only: "Do not use this in production". Source: https://tempo.xyz/developers/docs/quickstart/predeployed-contracts
- **Tempo Wallet and the `tempo wallet` CLI default to mainnet.** "pathUSD in Tempo Wallet is live mainnet pathUSD." Source: https://tempo.xyz/developers/docs/guide/getting-funds
- **Observation (not in docs):** testnet `eth_gasPrice` returned `0x13dfa04c75` (≈8.5e10), above the documented T7 cap, while mainnet returned `0x23c34600` (6e8, the floor). Do not hardcode fee caps from one network.

---

## 2. EVM differences that bite app developers

Source for this section unless noted: https://tempo.xyz/developers/docs/quickstart/evm-compatibility

- **No native gas token.** `BALANCE`, `SELFBALANCE` and `CALLVALUE` always return 0, and batch calls must use `value = 0`. `eth_getBalance` returns `0x9612084f0316e0ebd5182f398e5195a51b5ca47667d4c9b26c9b26c9b26c9b2` (about 4.24e75). This was confirmed on both mainnet and testnet, although the wallet-developers page says "in testnet". Hide native balance in every UI and remove "insufficient ETH" checks.
- **Fee token selection** follows five steps in order. (1) The transaction's `fee_token` (Tempo Transactions only). (2) The account preference set with `FeeManager.setUserToken`. (3) The token itself, if the top-level call is `transfer` or `transferWithMemo` on a USD TIP-20. (4) `tokenIn` for certain DEX swaps. (5) **pathUSD fallback**. The chosen token must be a **USD-currency** TIP-20, so EURC.e and EURAU cannot pay fees. The account must hold enough of it for `gasLimit × gasPrice`, and FeeAMM liquidity must exist. Consequence: a legacy EVM transaction to a non-TIP-20 contract needs pathUSD balance. Source: https://tempo.xyz/developers/docs/protocol/fees/spec-fee
- **Fees are paid on top of the transfer amount.** When fees are paid in the transferred token, the recipient gets the full `amount` and the sender pays amount + fee.
- **Tempo Transaction type `0x76`** (EIP-2718) is the native envelope. It adds `calls` batching, `feeToken`, `feePayer` sponsorship, 2D `nonceKey`, `validAfter`/`validBefore`, and P256 or WebAuthn signatures. Plain type-2 transactions also work. Source: https://tempo.xyz/developers/docs/quickstart/wallet-developers
- **State creation is expensive** (TIP-1000). A new storage slot costs 250,000 gas (Ethereum: 20,000), account creation costs 250,000 (Ethereum: 0), and contract bytecode costs 1,000 gas/byte (Ethereum: 200). A transfer to a new address costs about 300k gas; measured on Moderato it was 281,142, against 60,387 to an existing address. Deployments cost 5–10× Ethereum. **Do not hardcode `gas: 100000`**; the Go and Python doc examples do.
- **Contract-creation rules.** CREATE, CREATE2 or EIP-7702 delegation that would produce an address with the TIP-20 prefix `0x20C000000000000000000000` is rejected (TIP-1047). Access-key-signed transactions cannot create contracts in any form (T3); use a root key for `forge create`. A batch may contain at most one CREATE, and it must come first. Sources: https://tempo.xyz/developers/docs/protocol/tips/tip-1047, https://tempo.xyz/developers/docs/sdk/foundry
- **TIP-20 recipient guard.** Transfers to the zero address, or to any address with the TIP-20 prefix (another token contract), revert. The factory reserves the first 1,000 addresses (`lowerBytes < 1000`) for the protocol. Source: https://tempo.xyz/developers/docs/protocol/tip20/spec
- **System contracts are precompiles.** `eth_getCode` returns the 1-byte `0xef` at `0x20c0…`, `0xfeec…`, `0xdec0…`, `0xAAAAAAAA…` and similar addresses (observed). Code-size heuristics treat them as contracts, but no real bytecode exists to decode.
- **Osaka EVM.** Every Ethereum JSON-RPC method works. Tempo adds `tempo_forkSchedule`, `tempo_fundAddress` (testnet), `consensus_*` (validators only), and the `eth_sendRawTransactionSync` and `eth_fillTransaction` methods the SDKs use. Source: https://tempo.xyz/developers/docs/protocol/rpc, https://tempo.xyz/developers/docs/api/rpc
- **Wallet quirks.** Some injected wallets display the huge placeholder "balance". Set the currency symbol to `USD`. Wallets should use `0x76` transactions for fee-token choice. viem's chain objects declare `nativeCurrency: { symbol: 'USD', decimals: 6 }` (viem 2.56.8 source).
- **Virtual addresses (T3).** A deposit to a virtual address emits two `Transfer` events: to the virtual address, then to the master wallet. `balanceOf(virtual)` is always 0. Indexers must collapse the pair into one deposit. Source: https://tempo.xyz/developers/docs/protocol/upgrades/t3

---

## 3. Predeployed / system contract addresses

All are live on both networks unless noted. Precompiles hold code `0xef`.

| Contract | Address | Source |
|---|---|---|
| TIP-20 Factory | `0x20fc000000000000000000000000000000000000` | predeployed-contracts |
| pathUSD (first TIP-20) | `0x20c0000000000000000000000000000000000000` | predeployed-contracts |
| Fee Manager (fee AMM, `setUserToken`) | `0xfeec000000000000000000000000000000000000` | predeployed-contracts |
| Stablecoin DEX | `0xdec0000000000000000000000000000000000000` | predeployed-contracts |
| TIP-403 Registry (transfer policies) | `0x403c000000000000000000000000000000000000` | predeployed-contracts |
| Account Keychain (access keys) | `0xAAAAAAAA00000000000000000000000000000000` | protocol/transactions/AccountKeychain |
| Nonce Manager (2D nonces, ASCII "NONCE") | `0x4E4F4E4345000000000000000000000000000000` | protocol/transactions/spec-tempo-transaction |
| ReceivePolicyGuard (T6) | `0xB10C000000000000000000000000000000000000` | predeployed-contracts |
| Signature Verifier (secp256k1/P256/WebAuthn, T3) | `0x5165300000000000000000000000000000000000` | predeployed-contracts |
| Address Registry (virtual addresses, T3) | `0xFDC0000000000000000000000000000000000000` | predeployed-contracts |
| TIP20ChannelReserve (MPP sessions, ASCII "MPP", T5) | `0x4D50500000000000000000000000000000000000` | protocol/upgrades/t5 |
| StorageCredits (T7) | `0x1060000000000000000000000000000000000000` | changelog (T7) |
| ValidatorConfig V2 | `0xCCCCCCCC00000000000000000000000000000001` | guide/node/validator-keys |
| ZoneFactory / ZonePortal impl / Zone verifier / ZoneMessenger (**zones testnet-only**) | `0x5AF2000000000000000000000000000000000000` / `0x5AD1000000000000000000000000000000000000` / `0x5a56000000000000000000000000000000000000` / `0x5A4d000000000000000000000000000000000000` | predeployed-contracts, upgrades/t10 |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | predeployed-contracts |
| CreateX | `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` | predeployed-contracts |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` | predeployed-contracts |
| Arachnid Create2 Factory | `0x4e59b44847b379578588920cA78FbF26c0B4956C` | predeployed-contracts |
| Safe Singleton Deployer | `0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7` | predeployed-contracts |
| ERC-8004 Identity / Reputation Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` / `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | predeployed-contracts |
| LayerZero EndpointV2 / LZEndpointDollar | `0x20Bb7C2E2f4e5ca2B4c57060d1aE2615245dCc9C` / `0x0cEb237E109eE22374a567c6b09F373C73FA4cBb` | guide/bridge-layerzero |
| Stargate OFT: USDC.e / EURC.e; TokenMessaging | `0x8c76e2F6C5ceDA9AA7772e7efF30280226c44392` / `0x7753Dc8d4bd48Db599Da21E08b1Ab1D6FDFfdC71`; `0x19Ff94Fe4C93D546e4DB3E1FB124D45366B0b9F5` | guide/bridge-layerzero |
| Relay ERC20Router / ApprovalProxy | `0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f` / `0xccc88a9d1b4ed6b0eaba998850414b24f1c315be` | guide/bridge-relay |

ABIs ship in the SDK: `import { Abis, Addresses } from 'viem/tempo'` gives `Abis.tip20`, `Abis.tip20Factory`, `Abis.stablecoinDex`, `Abis.feeManager`, `Abis.feeAmm` and `Addresses.accountKeychain`. Solidity interfaces come from `tempo-std` (`forge install tempoxyz/tempo-std`). viem 2.56.8 also defines `accountImplementation 0x7702c0…`, `accountRegistrar 0x7702ac…` and `nativeMultisig 0xAACC…`. **All three have no code on mainnet today** and appear in no docs. **Inference:** they are planned; do not use them. Sources: https://tempo.xyz/developers/docs/quickstart/predeployed-contracts, https://tempo.xyz/developers/docs/protocol/transactions/AccountKeychain

---

## 4. Stablecoins on Tempo

### 4.1 Mainnet: the tokens Kova cares about

All values are verified against `tokenlist.tempo.xyz/list/4217` (v1.0.34, 2026-09-10) and `GET https://api.tempo.xyz/v1/verified-tokens?chainId=4217`. Supply is on-chain `totalSupply` on 2026-09-19.

| Symbol | Name | Address | Dec | Currency | Supply | How it gets to Tempo |
|---|---|---|---|---|---|---|
| **USDC.e** | Bridged USDC (Stargate) | `0x20C000000000000000000000b9537d11c60E8b50` | 6 | USD | ~83.33M | Stargate (LayerZero), backed 1:1 by USDC in Stargate pools |
| **pathUSD** | PathUSD | `0x20c0000000000000000000000000000000000000` | 6 | USD | ~49.56M | Native. First TIP-20, DEX quote token, and fee fallback. |
| **USDT0** | USDT0 | `0x20c00000000000000000000014f22ca97301eb73` | 6 | USD | ~10.13M | Tether OFT (LayerZero `send()`), plus Routes "USDT0 Legacy Mesh" from Tron |
| EURC.e | Bridged EURC (Stargate) | `0x20c0000000000000000000001621e21F71CF12fb` | 6 | EUR | ~1.46M | Stargate. **Cannot pay fees** (not USD). |
| frxUSD / cUSD / GUSD / rUSD | Frax / Cap / Generic / Reservoir | `…3554d28269e0f3c2` / `…0520792dcccccccc` / `…5c0bac7cef389a11` / `…7f7ba549dd0251b9` | 6 | USD | not checked | Issuer OFTs |
| USD1, USDe, SBC, USDB, DLUSD, goUSD, reUSD, iUSD, YLDS, wYLDS, MACH, senpathUSDE | various | see token list | 6 | USD | USD1 ≈1.1k and USDe ≈22 (thin) | various |
| EURAU / CHFAU / SEKAU / GBPA / BRLA / CADD | AllUnity, Agant, BRLA, CAD Digital | see token list | 6 | EUR/CHF/SEK/GBP/BRL/CAD | not checked | native issuers |
| cbBTC | Coinbase Wrapped BTC | `0x20c000000000000000000000c412ec89d0c08be5` | **6** | BTC | not checked | |

The verified-tokens API lists 34 tokens. `GET /v1/verified-tokens/currencies` returns `BRL, BTC, CAD, CHF, EUR, GBP, PRIME, SEK, USD, USDY, sUSDe, siUSD, stcUSD, syrupUSDC, wsrUSD`. Every TIP-20 uses **6 decimals**, cbBTC included. Full on-chain metadata for USDC.e reads `quoteToken = pathUSD`, `transferPolicyId = 1`, `paused = false`. USDT0 uses `transferPolicyId = 3`, which is issuer-specific, so some USDT0 transfers may be restricted. Sources: https://tempo.xyz/developers/docs/guide/bridge-layerzero, https://tempo.xyz/developers/docs/guide/bridge-bungee, https://tempo.xyz/developers/docs/api/verified-tokens

### 4.2 The USDC question

**No native (Circle-issued) USDC exists on Tempo mainnet as of 2026-09-19.** Five sources agree:
1. The token list has no `USDC`; its USDC entry is `USDC.e` "Bridged USDC (Stargate)".
2. The docs define USDC.e as "the bridged representation of USDC on Tempo", with the exit route "Tempo → Ethereum yields native USDC, 0 bps".
3. viem's `usdc` token definition has no chain `4217` address.
4. Tempo Routes `/v1/routes/chains` lists Tempo's token as `USDC.e`, and Tempo destinations default to USDC.e.
5. MPP "live mode uses USDC.e on Tempo mainnet", and Bungee recommends routing wallet funding to USDC.e.

The docs never mention CCTP or Circle-native USDC on Tempo. **Decision for Kova:** make `USDC` an alias for USDC.e in the API and UI. Label it "USDC (bridged)" if precision matters. Sources: https://tempo.xyz/developers/docs/guide/bridge-layerzero, https://tempo.xyz/developers/docs/api/routes/quotes, https://tempo.xyz/developers/docs/guide/bridge-bungee

### 4.3 Testnet (Moderato) tokens (`tokenlist.tempo.xyz/list/42431`, v1.0.7)

| Symbol | Address | Faucet? |
|---|---|---|
| pathUSD | `0x20c0000000000000000000000000000000000000` | yes, 1M |
| AlphaUSD | `0x20c0000000000000000000000000000000000001` | yes, 1M |
| BetaUSD | `0x20c0000000000000000000000000000000000002` | yes, 1M |
| ThetaUSD | `0x20c0000000000000000000000000000000000003` | yes, 1M |
| USDC.e (testnet) | `0x20c0000000000000000000009e8d7eb59b783726` | **no** (verified) |
| EURC.e (testnet) | `0x20c000000000000000000000d72572838bbee59c` | **no** |
| MACH | `0x20c000000000000000000000f37de3740adec032` | no |

### 4.4 Token registries

- **Token list** (Uniswap Token Lists format): `/list/{chain_id}`, `/asset/{chain_id}/{symbol|address}`, `/icon/{chain_id}`, and `/icon/{chain_id}/{address}` on `https://tokenlist.tempo.xyz`. Add a token by opening a PR to `tempoxyz/tempo-apps` (`apps/tokenlist/data/<chain_id>/tokenlist.json` plus an SVG icon). Source: https://tempo.xyz/developers/docs/quickstart/tokenlist
- **Verified tokens** (Tempo API): `GET /v1/verified-tokens`, `/v1/verified-tokens/currencies`, `/v1/verified-tokens/{address}` and `/v1/tokenlist`. They work anonymously. Note that `limit` is **not** accepted and returns `query_invalid`. Source: https://tempo.xyz/developers/docs/api/verified-tokens
- viem's `createClient` from `viem/tempo` loads `tokens.tempo` by default, so `token: 'USDC.e'` resolves by symbol. This was verified live.

---

## 5. Getting funds onto Tempo mainnet

### 5.1 Options

| Path | Lands as | Notes | Source |
|---|---|---|---|
| **Tempo Wallet** (`wallet.tempo.xyz`) "Add funds" | chosen token | Passkey web wallet. "Onramp with fiat or bridge from other chains." The onramp provider is not named. | guide/getting-funds |
| **`tempo wallet fund`** (CLI) | mainnet: opens funding options; `--crypto` opens direct crypto funding | Requires `tempo wallet login` | cli/wallet |
| **Accounts SDK `wallet_deposit`** / wagmi `Hooks.wallet.useDeposit()` | user-chosen | Opens Tempo Wallet's deposit UI inside Kova's app, which can pre-fill `amount` and `token` | accounts.tempo.xyz/docs/guides/deposits |
| **Stargate (LayerZero)** | USDC.e / EURC.e | **0 bps** Ethereum↔Tempo. Other routes carry fees. Tempo EID `30410`. Bridging *in* pays the LZ fee in source-chain gas. Bridging *out* needs a USDC.e→LZD wrap through LZEndpointDollar. | guide/bridge-layerzero |
| **USDT0 OFT** | USDT0 | Tether's OFT adapter `send()` | guide/bridge-layerzero |
| **Relay** | USDC.e (or pathUSD) | `https://api.relay.link/quote/v2`; Relay chain ID `4217` | guide/bridge-relay |
| **Bungee Deposit** | USDC.e recommended | `https://public-backend.bungee.exchange/api/v1/bungee/quote?...enableDepositAddress=true` | guide/bridge-bungee |
| **Across, Squid, Rhino.fi, Symbiosis, Chainlink CCIP** | varies | App or API | ecosystem/bridges, Routes providers |
| **Coinbase** (retail, iOS and Android) | exchange stablecoins | "select Tempo as the network when sending or receiving". Which assets is not stated. | ecosystem/bridges |
| **On-ramp partners**: MoonPay (widget/SDK/API), Mt Pelerin (card, Apple Pay, Google Pay, bank; Bridge Wallet app), Bridge (Stripe), Brale, Coins.ph (PHP), Hercle (EUR/GBP), UR, Wirex | varies | Business integrations; the docs don't say which Tempo tokens each supports | ecosystem/orchestration |

### 5.2 Tempo API "Routes" (live on mainnet)

A single API that aggregates bridge providers into Tempo. `GET /v1/routes/chains`, `GET /v1/routes/providers` and `GET /v1/routes/quotes` **work anonymously**, limited to 20 req/min per IP. Deposit addresses and transfers need an API key and an `idempotency-key` header.

- **Providers (live):** `across`, `relay`, `legacy-mesh` (USDT0 Legacy Mesh), `rhino`, `squid`, `stargate`, `symbiosis`.
- **Source chains (live):** Ethereum `eip155:1`, BNB `eip155:56`, Base `eip155:8453` and Polygon `eip155:137` (USDC and USDT on each). Solana `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` (USDC, USDT). Tron `tron:0x2b6653dc` (USDT). Tempo `eip155:4217` (USDC.e).
- **Quote examples** (10 USDC in, 2026-09-19; snapshot only). Base→USDC.e: stargate 10.000000, across 9.998709, squid 9.994370, rhino 9.982997, relay 9.978424. Solana→USDC.e: rhino 9.982998, relay 9.977174. Tron USDT→USDT0: legacy-mesh 9.997000. Base→pathUSD: relay only, 9.972027. Destination amounts are after provider deductions; source-chain gas is extra.

```bash
curl 'https://api.tempo.xyz/v1/routes/quotes?sourceChain=base&sourceToken=usdc&sourceAmount=1000000'   # destination defaults to Tempo / USDC.e
curl https://api.tempo.xyz/v1/routes/deposit-addresses -X POST \
  -H 'Authorization: Bearer tempo:sk:...' -H 'idempotency-key: <uuid>' -H 'Content-Type: application/json' \
  -d '{"amount":"1000000","destinationToken":"usdt0","recipient":"0x…","refundAddress":"T…","sourceChain":"tron","sourceToken":"usdt"}'
```

`POST /v1/routes/deposit-addresses` "creates or returns a reusable deposit address" on the source chain for a Tempo `recipient`. The `subsidize: true` flag guarantees normalized 1:1 delivery, but returns 403 unless the org is eligible. `POST /v1/routes/transfers` needs a `mode`, the side the amount fixes. Sources: https://tempo.xyz/developers/docs/api/routes/chains, https://tempo.xyz/developers/docs/api/routes/providers, https://tempo.xyz/developers/docs/api/routes/quotes, https://tempo.xyz/developers/docs/api/routes/deposit-addresses, https://tempo.xyz/developers/docs/api/routes/transfers, https://tempo.xyz/developers/docs/api/rate-limits

**Tempo API access.** Keys look like `tempo:sk:…` (production) or `tempo_sandbox:sk:…` (testnet-only). Send them as `Authorization: Bearer …` or `tempo-api-key`. The limit is 100 req/min per key and scope. Anonymous requests past quota can get `402` and pay per request with MPP. **Access to the Tempo API Console is invite-only** ("Contact us"). Source: https://tempo.xyz/developers/docs/api/console, https://tempo.xyz/developers/docs/api/rate-limits

### 5.3 Recommended paths for Kova

- **(a) Team demo wallet, today.** Hold USDC on Ethereum or Base and use the Stargate app (stargate.finance) or the §5.1 `cast` flow with destination EID `30410`. The result is USDC.e, 1:1 and 0 bps from Ethereum. From Base, the live quote was also 1:1, but the docs say only Ethereum↔Tempo is guaranteed fee-free. Relay and Across are faster intent fills at a few bps. Then fund two things. **First, Kova's fee-payer or sponsor account, in USDC.e:** any USD TIP-20 can pay fees, and a DEX or FeeAMM converts to the validator's token. **Second, a small pathUSD float**, for legacy (non-`0x76`) calls to non-TIP-20 contracts. **Inference:** acquire pathUSD by swapping USDC.e on the Stablecoin DEX, since pathUSD is USDC.e's quote token, or buy it through Relay (Base→pathUSD quote exists).
- **(b) Consumer top-up in Kova Pay.** Start with the Accounts SDK `wallet_deposit` flow (Tempo Wallet adapter, "embedded onramp"). It needs no Kova-side KYC or provider contracts, and the RN adapter exists. Next, if Kova gets Console access, create **per-user reusable Routes deposit addresses**. Users can then send USDC or USDT from Coinbase, Solana, Tron or Base and receive USDC.e or USDT0 in their Kova wallet. For card or Apple Pay fiat, integrate MoonPay or Mt Pelerin, and confirm they deliver on Tempo (open question). Receive policies (T6) can make a user's account accept only the tokens Kova supports.

---

## 6. SDKs & tooling

### 6.1 Package matrix (versions checked 2026-09-19 via `npm view`, GitHub, PyPI and crates.io)

| Tool | Package / import | Latest | Install | Notes |
|---|---|---|---|---|
| **Viem Tempo extension** | `viem`, importing `viem/tempo`, `viem/tempo/chains` and `viem/tempo/actions`; chains `tempo` and `tempoModerato` from `viem/chains` | **2.56.8** | `npm i viem` | There is **no separate `tempo.ts` import for the client**: use `viem/tempo`. The minimum for T3 is 2.47.11. viem pins `ox@0.14.45`; don't install `ox@latest` (1.7.5, a different major) alongside it. |
| **Wagmi** | `wagmi/tempo` (`Hooks`, `webAuthn`), `wagmi/connectors` (`tempoWallet`) | **3.7.7** | `npm i wagmi viem @tanstack/react-query` | |
| **Tempo Accounts SDK** | `accounts`, plus subpaths `./server`, `./react`, `./react/privy`, `./wagmi`, `./mobileWebAuth`, `./deviceCode`, `./react-native/{expo-web-browser,expo-secure-store,secure-mmkv,async-storage}` | **0.18.4** | `npm i accounts` | Repo `tempoxyz/accounts`; docs `https://accounts.tempo.xyz/docs`. Adapters: Tempo Wallet, WebAuthn, Turnkey, Privy, private key, custom. |
| Tempo API client and server handlers | `tapimo` (`Client`); `tapimo/server` (`Handler.relay`) | 0.15.1 | `npm i tapimo` | Typed REST+RPC client; fee-payer relay handler. The docs show `import { Handler } from 'tapimo'`, but in 0.15.1 `Handler` is exported only from `tapimo/server` (also from `accounts/server`). |
| MPP | `mppx` | 0.10.1 | `npm i mppx viem` | See 05-mpp-agent-payments.md |
| Local nodes | `prool` (`Instance.tempo()`) | 0.2.16 | `npm i prool` | **Inference from package source:** spawns the local `tempo` binary (`tempo node --chain dev`), so install the Tempo CLI first. Releases since v1.14.0 also publish a `tempo-localnet` container with faucet, fee liquidity and DEX. |
| `tempo.ts` | `tempo.ts` (repo `tempoxyz/tempo-ts`) | 0.14.2 | not in current docs | README lists only `tempo.ts/server`. **Inference:** legacy; use `viem/tempo` + `tapimo` instead. |
| Go | `github.com/tempoxyz/tempo-go` | **v0.5.0** (2026-07-13) | `go get github.com/tempoxyz/tempo-go@v0.5.0` | **The docs still say `@v0.3.0`, which is pre-T3.** v0.5.0 adds T5 witness, T6 admin keys and receive policies. Go ≥ 1.21. |
| Rust | `tempo-alloy` (Alloy network `TempoNetwork`) | **1.11.0** (crates.io) | Docs: `cargo add tempo-alloy --git https://github.com/tempoxyz/tempo --tag tempo-alloy@1.10.1` | |
| Python | `pytempo` (web3.py ≥7 extension) | **0.5.1** (PyPI) | `pip install pytempo` | Python ≥ 3.9 |
| Foundry | upstream `forge`, `cast`, `anvil`, `chisel` | **v1.8.3** | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` | **`tempo-foundry` and `foundryup -n tempo` are deprecated.** Scaffold with `forge init -n tempo`. The library is `tempoxyz/tempo-std`. Verify at `https://contracts.tempo.xyz` (Sourcify-compatible; use `--verifier-url`, not `[etherscan]`). |
| Tempo CLI | `tempo` (`wallet`, `request`, `node`, `download`) | node **v1.14.0** | `curl -fsSL https://tempo.xyz/install \| bash`, update with `tempoup` | `-t` gives TOON output, plus `--dry-run` and `--max-spend` |
| Docs MCP | `https://mcp.tempo.xyz` | | `claude mcp add --transport http tempo https://mcp.tempo.xyz` | Tools `search`, `find_pages`, `read_page`, `code`. Plugin: `claude plugin marketplace add tempoxyz/docs && claude plugin install docs@tempo`. Skill: `npx skills add tempoxyz/docs`. |
| API MCP | `POST https://api.tempo.xyz/mcp` | | streamable HTTP | Data domain plus `docs_*`; 100 req/min anonymous |

Sources: https://tempo.xyz/developers/docs/sdk/typescript, https://tempo.xyz/developers/docs/sdk/go, https://tempo.xyz/developers/docs/sdk/rust, https://tempo.xyz/developers/docs/sdk/python, https://tempo.xyz/developers/docs/sdk/foundry, https://tempo.xyz/developers/docs/sdk/typescript/prool/setup, https://tempo.xyz/developers/docs/cli, https://tempo.xyz/developers/docs/guide/using-tempo-with-ai, https://tempo.xyz/developers/docs/api/mcp, https://tempo.xyz/developers/docs/api/typed-client, https://github.com/tempoxyz/accounts

### 6.2 TypeScript: viem (all snippets run live on 2026-09-19 with viem 2.56.8)

```ts
// Mainnet read. createClient() defaults to chain `tempo` (4217) with an http() transport.
import { createClient } from 'viem/tempo'
const mainnet = createClient()
const USDCe = '0x20C000000000000000000000b9537d11c60E8b50'
const bal = await mainnet.token.getBalance({ account: '0x…', token: USDCe }) // or token: 'USDC.e'
// → { amount: 1n, decimals: 6, formatted: '0.000001' }
const meta = await mainnet.token.getMetadata({ token: USDCe })          // name, symbol, currency, decimals, quoteToken, totalSupply, transferPolicyId…
```

```ts
// Testnet end to end, from the docs (sdk/typescript): fund, read, transfer.
import { Account, createClient } from 'viem/tempo'
const account = Account.fromSecp256k1('0x…')
const client = createClient({ account, testnet: true })
await client.faucet.fundSync({ account })
const token = '0x20c0000000000000000000000000000000000000' // pathUSD
const balance = await client.token.getBalance({ token })
const { receipt } = await client.token.transferSync({ amount: { formatted: '1' }, to: '0x742d…', token })
```

```ts
// Mainnet payment with memo and sponsorship (adapted from guide/payments/send-a-payment and api/fee-payer).
// Verified on testnet with a P-256 account through https://sponsor.moderato.tempo.xyz: receipt.feePayer ≠ sender.
import { Account, createClient, http, withRelay } from 'viem/tempo'
import { pad, parseUnits, stringToHex } from 'viem'
const client = createClient({
  account: Account.fromP256('0x…'),                                             // or fromSecp256k1 / fromWebAuthnP256 / from({ keyType, publicKey, sign })
  transport: withRelay(http(), http('https://api.tempo.xyz/rpc/sponsor?key=tempo:sk:…')), // testnet: 'https://sponsor.moderato.tempo.xyz'
})
const { receipt } = await client.token.transferSync({
  amount: parseUnits('12.50', 6),
  to: '0xMerchant…',
  token: '0x20C000000000000000000000b9537d11c60E8b50',                          // USDC.e
  memo: pad(stringToHex('KOVA-INV-0001'), { size: 32 }),                        // bytes32
  feePayer: true,
})
```

- Plain viem also works: `createPublicClient({ chain: tempo, transport: http() })` with `import { tempo, tempoModerato } from 'viem/chains'`, then `readContract({ abi: Abis.tip20, … })`.
- Other Tempo transaction options on `viem/tempo` clients are `calls`, `feeToken`, `feePayer`, `nonceKey`, `validAfter` and `validBefore`. Source: https://tempo.xyz/developers/docs/sdk/typescript

### 6.3 Wagmi and the Accounts SDK (web)

```ts
import { createConfig, http } from 'wagmi'
import { tempo } from 'wagmi/chains'
import { tempoWallet } from 'wagmi/connectors'   // or: import { webAuthn } from 'wagmi/tempo'; webAuthn({ authUrl: '/auth' })
export const wagmiConfig = createConfig({ chains: [tempo], connectors: [tempoWallet()], transports: { [tempo.id]: http() } })
// Hooks: import { Hooks } from 'wagmi/tempo' → Hooks.token.useTransferSync, Hooks.wallet.useDeposit, …
```

The docs describe the **Tempo Wallet connector** as a "universal account … embedded onramp, access keys, and transaction orchestration". **WebAuthn** gives passkeys bound to Kova's own domain. Source: https://accounts.tempo.xyz/docs

### 6.4 React Native (Kova Pay): compatibility signals

- **Accounts SDK has an explicit RN guide.** The `accounts` package.json declares `react-native` export conditions and optional peers `expo-web-browser ^55`, `expo-secure-store ^55`, `react-native-mmkv ^4.3.1`, `react-native-nitro-modules`, and `@react-native-async-storage/async-storage ^3`.

```sh
npx expo install expo-web-browser expo-secure-store react-native-get-random-values react-native-mmkv react-native-nitro-modules
```
```ts
import { Provider } from 'accounts'
import { tempoWallet } from 'accounts/mobileWebAuth'
import { openAuthSession } from 'accounts/react-native/expo-web-browser'
import { secureMmkv } from 'accounts/react-native/secure-mmkv'
const provider = Provider.create({
  adapter: tempoWallet({ baseUrl: 'https://app.example', openAuthSession, redirectUri: 'com.example.app:/auth' }),
  storage: secureMmkv(),
})
```
- Setup requirements. Use an Expo **development build** (`expo run:ios`); Expo Go callback URLs are invalid. Publish the callback URI in the app's consumer discovery document. Import polyfills first: `react-native-get-random-values`, plus a `globalThis.MessageEvent` shim, because Hermes lacks it. Use `secureMmkv` when the provider manages access keys. Source: https://accounts.tempo.xyz/docs/guides/react-native
- **Inference:** `viem/tempo` itself is plain TypeScript and should run on Hermes with the usual `crypto.getRandomValues` polyfill. That is not documented, so test it. Privy is documented with `"caip2": "eip155:4217"` and has an Accounts SDK adapter. The adapter subpath `accounts/react/privy` targets `@privy-io/react-auth` (web), so RN Privy would go through Privy's own SDK.

### 6.5 Go, Rust, Python (minimal, from docs)

```go
c := client.New("https://rpc.tempo.xyz")                        // github.com/tempoxyz/tempo-go/pkg/client
s, _ := signer.NewSigner("0x…")                                  // pkg/signer
tx := transaction.NewBuilder(big.NewInt(4217)).SetNonce(nonce).SetGas(300000). // docs use 100000, too low for new recipients
  SetMaxFeePerGas(big.NewInt(20000000000)).SetMaxPriorityFeePerGas(big.NewInt(1000000000)).
  AddCall(usdce, big.NewInt(0), transferWithMemoCalldata).Build()
transaction.SignTransaction(tx, s); raw, _ := transaction.Serialize(tx, nil); hash, _ := c.SendRawTransaction(ctx, raw)
```
```rust
let provider = ProviderBuilder::new_with_network::<TempoNetwork>().connect("https://rpc.tempo.xyz").await?; // tempo_alloy::TempoNetwork
```
```python
from pytempo import TempoTransaction, Call
from pytempo.contracts import TIP20   # docs pass ALPHA_USD ("0x20c0…0001", testnet-only); on 4217 pass the USDC.e address (adapted, untested)
tx = TempoTransaction.create(chain_id=4217, gas_limit=300_000, max_fee_per_gas=…, max_priority_fee_per_gas=…,
     nonce=w3.eth.get_transaction_count(addr), calls=(TIP20("0x20C000000000000000000000b9537d11c60E8b50").transfer(to="0x…", amount=1_000_000),))
w3.eth.send_raw_transaction(tx.sign(pk).encode())
```

### 6.6 Foundry, Prool, CLI

```bash
foundryup && forge init -n tempo my-project        # template includes the Mail example; forge install tempoxyz/tempo-std for existing projects
# foundry.toml: [profile.default] tempo = true ; [rpc_endpoints] tempo="${TEMPO_RPC_URL}" moderato="${TEMPO_TESTNET_RPC_URL}"
cast rpc tempo_fundAddress <ADDR> --rpc-url https://rpc.moderato.tempo.xyz
forge create src/Mail.sol:Mail --rpc-url $TEMPO_RPC_URL --interactive --broadcast --verify \
  --verifier-url https://contracts.tempo.xyz --tempo.fee-token <FEE_TOKEN> --constructor-args 0x20c0…0001
```
```ts
import { Instance, Server } from 'prool'
const server = Server.create({ instance: Instance.tempo() }); await server.start() // http://localhost:8545/1, /2, …
```
```bash
curl -fsSL https://tempo.xyz/install | bash   # then: tempo wallet login | whoami | fund | transfer <amt> <token> <to> --dry-run
```

---

## 7. Ecosystem

The docs list more partners than below; this is the Kova-relevant subset. Sources: https://tempo.xyz/developers/docs/ecosystem/wallets, /ecosystem/node-infrastructure, /ecosystem/data-analytics, /ecosystem/block-explorers, /ecosystem/smart-contract-libraries, /ecosystem/security-compliance, /quickstart/developer-tools

- **Embedded wallets (Kova Pay onboarding):**
  - **Tempo Accounts SDK / Tempo Wallet.** First-party, with RN support; see §6.4.
  - **Privy.** Pass `caip2: "eip155:4217"`. It offers gas sponsorship and webhooks. There is a Tempo guide and a `privy-next-tempo` P2P example that uses memos.
  - **Turnkey.** Signs Tempo Transactions, with policy-based signing and a `with-tempo` example.
  - **Dynamic.** The docs say "Enable Tempo testnet" in its dashboard; mainnet status is unclear.
  - **Crossmint.** Wallets plus checkout.
  - **Para.** Docs say "adding Tempo chain support", so treat it as planned.
  - **Blockradar.** Fintech wallet API with gasless transfers.
- **Custodial and institutional:** BitGo, Coinbase (Prime custody plus retail sends), Cubist, DFNS, Fireblocks, Utila.
- **Self-custodial:** Bitget Wallet, Bridge Wallet (Mt Pelerin), Gem Wallet, OKX Wallet and Rabby. Safe is "coming soon".
- **Agentic:** Enact and Sponge.
- **Smart accounts:** Pimlico (4337 bundler and paymaster) and ZeroDev (4337 and 7702). Tempo Transactions natively cover batching, sponsorship and passkeys.
- **Node and RPC:** Alchemy, Blockdaemon, Chainstack, Conduit (Conduit is documented for testnet only), dRPC (free tier), Luganodes, Quicknode (`quicknode.com/docs/tempo`), SenseiNode and Validation Cloud. You can also self-host a node: `tempo download --chain mainnet --archive`, then `tempo node --follow --http`.
- **Indexers and data:**
  - **Tempo REST API:** `/v1/transfers`, `/v1/addresses/{a}/balances`, `/v1/addresses/{a}/activities` and webhooks.
  - **TIDX SQL:** `GET https://api.tempo.xyz/v1/indexer/query`. It returned a **402 MPP payment challenge** anonymously today. The docs also cite `https://indexer.tempo.xyz`, which returned 404 at `/`, and a self-host option at `ghcr.io/tempoxyz/tidx`.
  - **Third parties:** Goldsky (subgraphs, Mirror), Allium, Dune Sim, SQD, SonarX, Codex, Zerion, CoinGecko, Artemis, Range, Chainlink (CCIP and Data Streams), Chronicle and RedStone.
- **Explorers:** Tempo Explorer (`explore.tempo.xyz` and `explore.testnet.tempo.xyz`), Tenderly (tracing and simulation) and Range's `explorer.money`.
- **Compliance:** Blockaid, Chainalysis, Elliptic, TRES and TRM Labs.

---

## Gotchas

1. **The native balance is fake.** Wallet balance checks and "insufficient funds for gas" checks against `eth_getBalance` pass vacuously; the value is 4.24e75. `msg.value` is always 0, and payable flows don't exist.
2. **There is no "USDC".** Hardcoding a Circle USDC address or looking up the symbol `USDC` fails. Use USDC.e, and remember testnet USDC.e sits at a *different* address that the faucet doesn't fund.
3. **Everything uses 6 decimals, cbBTC included.** Code that assumes 18 for "native", or 8 for BTC, is wrong.
4. **Legacy (type-2) transactions to non-TIP-20 contracts pay fees in pathUSD by default.** A user holding only USDC.e sees `insufficient balance` unless you use a `0x76` transaction with `feeToken` or `feePayer`, or call `setUserToken`.
5. **Non-USD tokens (EURC.e, EURAU, …) can never pay fees.**
6. **Gas for first-time recipients is about 280k, not 21k or 65k.** Fixed `gas: 100000` limits from docs examples will fail for new recipients.
7. **T11 strict ABI** rejects trailing calldata bytes (attribution suffixes, `dataSuffix`) on precompile calls, including TIP-20 transfers and `eth_call` reads, until T12 ships.
8. **T3 `authorizeKey` ABI change.** Hand-encoded legacy calls fail with `LegacyAuthorizeKeySelectorChanged`. Access keys cannot `CREATE`.
9. **Precompiles show `0xef` as code.** Don't try to decode or verify their bytecode.
10. **Receive policies (T6).** A transfer to an account with a restrictive policy may be *held* in `ReceivePolicyGuard` rather than reverting. Check receipts and events, not just the tx status.
11. **Virtual-address deposits emit two `Transfer` events**, and `balanceOf(virtual) = 0`.
12. **Bridging *out* through LayerZero needs a USDC.e→LZD wrap**, because there is no `msg.value`.
13. **Docs examples mix networks.** Go, Python and the wallet guide use AlphaUSD (`0x20c0…0001`) with chain 4217, and AlphaUSD doesn't exist on mainnet.
14. **The Go docs install `tempo-go@v0.3.0`**, which is pre-T3 and older than the documented T3 minimum of v0.4.0; use v0.5.0. The Rust docs pin `tempo-alloy@1.10.1`; the latest is 1.11.0.
15. **Expo Go won't work** for Tempo Wallet mobile auth; a dev build is required. Hermes also needs the `MessageEvent` and `getRandomValues` polyfills.
16. **The Tempo API's hosted JSON-RPC (`api.tempo.xyz/rpc`) is best-effort** and outside the stable API contract; the docs give no availability or freshness guarantees. The Console (API keys, hosted fee payer, Routes deposit addresses) is invite-only; request access early.

## Open questions

- **Tempo API Console access.** How fast can Kova get an invite for the hosted fee payer (`/rpc/sponsor`), Routes deposit addresses, and higher rate limits? This could block mainnet sponsorship via Tempo's relay; the fallback is a self-run fee payer.
- **Onramp providers.** Which one does Tempo Wallet's "Add funds" use, and in which countries? Can `wallet_deposit` run fully inside an RN app?
- **Partner token delivery.** Which Tempo tokens do Coinbase retail, MoonPay and Mt Pelerin actually deliver: USDC.e, USDT0 or pathUSD?
- **Circle-native USDC or CCTP on Tempo.** Is either planned? That would change Kova's `USDC` alias.
- **Testnet USDC.e.** How do you obtain testnet USDC.e (`0x20c0…9e8d7eb59b783726`)? Is there DEX liquidity for AlphaUSD or pathUSD → USDC.e on Moderato?
- **P256 `pre_hash` with a JavaCard card.** Confirm that a JavaCard `ALG_ECDSA_SHA_256` signature over the raw tx hash, submitted with `pre_hash = true`, verifies, and that the signature meets the low-s rule. The Foundry example notes "low-s normalization required by the precompile". Also confirm how to set `pre_hash` through viem `Account.from` (`SignatureEnvelope` type `p256` options).
- **T12 timing.** When does T12 ship, re-allowing trailing calldata bytes?
- **Public RPC limits.** What are the rate limits and SLA of `rpc.tempo.xyz`? The docs say nothing. Plan a paid provider (Alchemy, Quicknode, dRPC) for real volume.
- **TIDX endpoint conflict.** The docs give both `https://indexer.tempo.xyz` and `api.tempo.xyz/v1/indexer/query`. Is anonymous indexer access paid-only (402)?
- **viem's `hardfork: 't5'`.** viem 2.56.8's `tempoModerato` definition pins it, and viem's hardfork list stops at `t6` although both networks run T11. Does this affect gas estimation or encoding? Upgrade viem regularly.
- **Explorer API.** Does the explorer offer an Etherscan-style API, or do Kova's dashboards need to use the Tempo API or an indexer?

## Sources

- https://tempo.xyz/developers/docs/quickstart/connection-details
- https://tempo.xyz/developers/docs/quickstart/evm-compatibility
- https://tempo.xyz/developers/docs/quickstart/faucet
- https://tempo.xyz/developers/docs/quickstart/integrate-tempo
- https://tempo.xyz/developers/docs/quickstart/predeployed-contracts
- https://tempo.xyz/developers/docs/quickstart/tokenlist
- https://tempo.xyz/developers/docs/quickstart/wallet-developers
- https://tempo.xyz/developers/docs/quickstart/verify-contracts
- https://tempo.xyz/developers/docs/quickstart/developer-tools
- https://tempo.xyz/developers/docs/guide/getting-funds
- https://tempo.xyz/developers/docs/guide/bridge-layerzero
- https://tempo.xyz/developers/docs/guide/bridge-bungee
- https://tempo.xyz/developers/docs/guide/bridge-relay
- https://tempo.xyz/developers/docs/guide/payments/send-a-payment
- https://tempo.xyz/developers/docs/guide/payments/sponsor-user-fees
- https://tempo.xyz/developers/docs/guide/using-tempo-with-ai
- https://tempo.xyz/developers/docs/guide/node/network-upgrades
- https://tempo.xyz/developers/docs/guide/node/rpc
- https://tempo.xyz/developers/docs/protocol/upgrades/t2 through https://tempo.xyz/developers/docs/protocol/upgrades/t11
- https://tempo.xyz/developers/docs/protocol/rpc
- https://tempo.xyz/developers/docs/protocol/fees/spec-fee
- https://tempo.xyz/developers/docs/protocol/tip20/spec
- https://tempo.xyz/developers/docs/protocol/tips/tip-1047
- https://tempo.xyz/developers/docs/protocol/transactions/spec-tempo-transaction
- https://tempo.xyz/developers/docs/protocol/transactions/AccountKeychain
- https://tempo.xyz/developers/docs/changelog
- https://tempo.xyz/developers/docs/sdk, /sdk/typescript, /sdk/typescript/prool/setup, /sdk/go, /sdk/rust, /sdk/python, /sdk/foundry
- https://tempo.xyz/developers/docs/cli, /cli/wallet, /cli/node, /cli/download
- https://tempo.xyz/developers/docs/wallet
- https://tempo.xyz/developers/docs/api, /api/conventions, /api/rate-limits, /api/console, /api/fee-payer, /api/json-rpc, /api/rpc, /api/mcp, /api/typed-client, /api/faucet, /api/verified-tokens, /api/indexer, /api/indexer-api
- https://tempo.xyz/developers/docs/api/routes/chains, /api/routes/providers, /api/routes/quotes, /api/routes/deposit-addresses, /api/routes/transfers
- https://tempo.xyz/developers/docs/server/relay-handler
- https://tempo.xyz/developers/docs/ecosystem/wallets, /ecosystem/bridges, /ecosystem/orchestration, /ecosystem/node-infrastructure, /ecosystem/data-analytics, /ecosystem/block-explorers, /ecosystem/smart-contract-libraries, /ecosystem/security-compliance
- https://accounts.tempo.xyz/docs, https://accounts.tempo.xyz/docs/guides/react-native, https://accounts.tempo.xyz/docs/guides/deposits, https://github.com/tempoxyz/accounts
- https://tokenlist.tempo.xyz/list/4217, https://tokenlist.tempo.xyz/list/42431 (fetched live)
- https://api.tempo.xyz/v1/routes/chains, /v1/routes/providers, /v1/routes/quotes, /v1/verified-tokens (queried live 2026-09-19)
- `tempo_forkSchedule`, `eth_getBalance`, `eth_getCode`, `eth_gasPrice` and block reads against `rpc.tempo.xyz` and `rpc.moderato.tempo.xyz` (live 2026-09-19)
- npm (`viem` 2.56.8, `wagmi` 3.7.7, `accounts` 0.18.4, `tapimo` 0.15.1, `mppx` 0.10.1, `prool` 0.2.16, `tempo.ts` 0.14.2, `ox` 1.7.5), GitHub releases (`tempoxyz/tempo` v1.14.0, `tempoxyz/tempo-go` v0.5.0, `foundry-rs/foundry` v1.8.3), PyPI (`pytempo` 0.5.1), crates.io (`tempo-alloy` 1.11.0)
- https://tempo.xyz/developers/docs/protocol/transactions/spec-tempo-transaction (P256 `pre_hash`) and the MPP docs (`mpp-llms-full.txt`: "Live mode uses USDC.e on Tempo mainnet")
