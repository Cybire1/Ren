# Ren × Kova: everything Kova has, rebuilt the Tempo way

Draft, 3 November 2026. Ren's last commit was 13 October. Since then, Kova (Monad) has added 259
commits. This plan brings every Kova feature to Ren on Tempo, in Ren's Soda look, on the web and the
iPhone together. Where Tempo has a better way to do something, Ren uses it instead of copying Monad's.

## How we'll port

- **Feature by feature, not a git merge.** A trial merge of Kova `main` into Ren gives 585 conflict
  hunks in 175 files. Two schemas also collide silently: `wallet_keys`, `key_payments` and
  `cash_outs` exist on both sides with different columns, and migrations 0015–0017 are numbered the
  same with different contents. About 180 of Kova's new files import Monad code directly. So each
  feature is rebuilt on Ren's chain kit (`apps/api/src/chains`, `packages/tempo`), reusing Kova's
  screens, copy and tests wherever they're chain-neutral.
- **Tempo-native over copied.** Kova needs a Solidity contract for splits, repeat payments, card
  limits, savings and stocks. Tempo does most of this in the protocol: batch calls, access keys
  with periods and scopes, 2D nonces, the stablecoin DEX, Earn vaults, Zones. Ren deploys **no new
  contracts** unless a feature truly needs one.
- **The moat leads.** Ren's edge is the key layer: who may spend a wallet's dollars, how much,
  where, and for whom, enforced on Tempo. Features that are "just another key" (subscriptions, a
  basic phone, a card, payroll, agents) come first, and the pitch frames them that way.
- **App first, both surfaces.** Each feature ships on the web wallet and the iPhone app at the
  same time, in light and dark. A feature is done only when all of these are true:
  1. Both screens are built in Soda, light and dark, with real copy and empty and error states.
  2. The API, a migration (numbered from **0018**) and unit tests are in.
  3. A live check on Moderato passes, and its transaction hash is in the README.
  4. Screenshots of both surfaces have been looked at.
  5. Typecheck and Biome are clean.
- **Commits** go straight to Ren `main` (`git push ren tempo:main`). Every commit date is real,
  with one conventional commit per step.

## What Tempo gives us today (checked 3 Nov)

- **Network:** mainnet 4217 and Moderato 42431 are both on hardfork T13. A transfer costs about
  $0.00003 in fees. Ren pins viem 2.56.8; the latest is 2.57.16. The new version adds `Relay`
  plugins (fee payer, auto-swap), `channel`, `earn`, the new `zone` actions and `Addresses.ousd`,
  and removes `Multisig`.
- **OUSD** is Tempo's recommended dollar: about $589M on mainnet, issued by Open Standard
  (Coinbase, Mastercard, Shopify, Stripe, Visa). Moderato's faucet hands out OUSD at the same
  address as mainnet.
- **Batch calls:** one transaction carries many calls, all or nothing, and can be sponsored.
- **Access keys:** a key gets a per-token limit with a period, scopes down to one function on one
  contract (and recipients for transfers), and an expiry. Freeze a key by setting its limit to 0,
  or revoke it for good. A server can hold a key to pull recurring payments; Tempo's own guide
  covers subscriptions this way.
- **2D nonces:** a transaction signed today can be sent days later by anyone, with any fee payer.
- **Stablecoin DEX:** swaps between USD stablecoins with no taker fee and no approve, sponsorable.
- **Earn** (beta): ERC-4626 vaults, with a test vault on Moderato.
- **Zones:** private balances. Tempo's docs now say direct transfers inside a zone work on the
  sandbox. Ren's `docs/zones.md` found they didn't, so this gets retested.
- **Partners on Tempo:**
  - Stripe Onramp delivers OUSD.
  - Stripe Issuing offers stablecoin cards with OUSD in 60+ countries.
  - Bridge virtual accounts can deliver to Tempo.
  - MoonPay offers USDC.e and pathUSD.
  - Relay, Across and Stargate bridge in.
  - Tempo Routes has 68 routes in, including **Monad USDC → OUSD**.
- **Not on Tempo:** no tokenized stocks, no Chainlink CRE writes, no NGN price feed (only EUR,
  CAD and BRL), no official name service (TempoID is a community project on mainnet only), and
  no native USDC (no CCTP).

## The plan, phase by phase

Sizes are rough and include web, iPhone, API and tests. Kova's code for each feature is the
starting point, so most of the screen work is adapting, not designing from nothing.

### Phase 0: foundations (about 1–2 days)

| Work | Why |
|---|---|
| Upgrade viem to 2.57.x, and upgrade tapimo and mppx; re-estimate gas after T12 | The newer APIs are used everywhere below |
| Settle in **OUSD** on testnet and mainnet (AlphaUSD stays readable in history) | It's the dollar Stripe, Coinbase and Visa use on Tempo, and what mainnet will hold |
| Fix what's half-built: the Card tab says "coming to Tempo" though Keys links cards; the USSD row shows but the server refuses it; private notes never reach the recipient | Nothing on screen should be broken |
| Remove Kova leftovers: the relay's `mykova.app` metadata, sign-in domain defaults, root `package.json`, the LICENSE mismatch (MIT vs Apache-2.0), README claims (the wallet is secp256k1 from the passkey's PRF, not P-256), the Reni description | Judges read the repo |
| CI (Kova's workflow, adapted), Biome clean, a Ren `AGENTS.md`, `.env.example` files listing every variable | So it can be checked |
| Persistent rate limits (sponsored sends, key changes, MPP replay) in Postgres, not in memory | Restarts reset them today |

### Phase 1: look and feel (about 3–4 days)

| Kova feature | Ren version |
|---|---|
| Dark mode and Appearance (web `data-theme`, a no-flash head script; iOS `DynamicColorIOS`, Android reloads on change) | A **dark Soda**: deep navy paper, mint money, watermelon pay. The hard ink shadow becomes a lit edge. Stills go to you before it's applied |
| Home Screen install (manifest, install prompt at the right moment, light and dark launch screens, Expo dark splash) | Same, with Reni and the R coin |
| Sign-in redesign: the matched pair of buttons, "Face ID / Touch ID / fingerprint" wording, never "passkey"; Google sign-in in the app (Privy) | Same, for Ren's bundle |
| Recovery words: save 24 words, check two, restore in the app | Ports directly: Ren's wallet is the same PRF-derived secp256k1 key |
| Plain-money copy on pay pages, links, till, shops and API messages | Same pass, in Ren's voice |
| Activity: arrival moments (coin rain, envelope), other-token arrival sheet, month card | Same |
| Shared shop links preview as the shop (name, line, cover) | Same |
| Terms and privacy (Quill Labs), landing refresh | Ren's own pages |

### Phase 2: the key layer, Ren's moat (about 6–8 days)

| Kova feature (Monad) | Ren on Tempo | What it shows |
|---|---|---|
| **Repeat payments** (KovaRepeat contract + permit + keeper) | Each plan is an **access key** scoped to `transferWithMemo` to one payee, limited to the plan's amount per period, expiring at the plan's end. Ren's keeper sends each payment when it's due, sponsored. Stopping a plan revokes the key on-chain. MPP's `subscription` intent comes in too, so agents and other apps can bill Ren wallets | Subscriptions with no contract, and the limit enforced by Tempo itself |
| **Splits** (KovaSplits clone per shop) | One **batch transaction** pays the shop and up to 5 shares together, all or nothing, sponsored. The watcher checks every leg. MPP `splits` for agent payers | One payment, everyone paid at once |
| **Kova for Business**: payroll, suppliers, team | **Payroll as one batch transaction**: 50 people paid in one Face ID, one transaction, under a cent in fees. Private payroll goes through Zone deposits (recipient encrypted). Suppliers are paid in their own currency. Team budgets are access keys | A whole payroll in a second |
| **Team keys** (budgets for staff) | Access keys with a weekly limit and a payee list, accepted on the person's own phone, like allowances | The same key layer as allowances |
| **Card tab** | Show the Ren Card (an access key) in the Card tab, with freeze and limit, matching Keys | Fixes the contradiction from Phase 0 |
| **Basic phone (USSD) pockets** (server key with its own balance) | **A basic phone is just another key.** Ren holds a sealed access key on the owner's wallet: $200 a day at most, payments only, unlocked by the phone's PIN. There's no separate pocket to fill: the phone spends from the wallet, within its limit. Cash-out by USSD goes to the one saved bank | The phone with no internet, on the moat |

### Phase 3: everyday money (about 6–8 days)

| Kova feature | Ren on Tempo |
|---|---|
| **Send by link** (`/c/<id>#key`): money waits at a one-time key; claim, take back, "Your links" | Same model. The link key holds the dollars; Ren sponsors the claim, which must move the link's full balance to the claimer, and the take-back |
| **Offline payments** (EIP-3009 signed with no signal, QR or `/o#code`, $100 cap, a week) | A **pre-signed Tempo transaction on its own 2D-nonce lane** (a random `nonceKey` per code, about $0.0002 to open), `validBefore` a week out, sponsorable by any fee payer. The receiver checks the signature offline; whoever gets signal first sends it. The phone reserves the amount, as on Kova |
| **Send to a phone number** + arrival text | Same: a held key for new numbers, an OTP to claim, return if unclaimed. Africa's Talking SMS |
| **Basic-phone web demo** (`/ussd`: a feature phone on the page drives the real menu) | Same, on Moderato, using the Phase 2 phone key |
| **Other tokens + "Turn into dollars"**, MON conversion | Show every USD stablecoin the wallet holds (USDC.e, USDT0, pathUSD, AlphaUSD…), and **turn any into OUSD with one sponsored DEX swap**. MON conversion is dropped: Tempo has no gas token, which is the point |
| **Names** (.nad) | **Ren handles** (`@ada`): the wallet signs a claim, so names work on testnet and mainnet. Also read TempoID `.tempo` names on mainnet, shown only when the name points back |
| **Private dollars**: Kova's router, sealed memos, "Send to any wallet", "Move to main wallet" | Ren already has Zones. Retest transfers inside Zone A; if they work, send privately inside the zone. Bring over Kova's arrival envelope, "Move to main wallet" under the amount, and sealed notes (ECIES in the zone deposit's encrypted memo) |
| **Private takings + accountant's view** (`/books`) | Ren has private takings in a zone; add the read-only accountant's view |
| **Cash-out redesign** (amount in naira, account number first, banks guessed by NUBAN, logos, 5 steps) | Same screens on Ren's Paystack cash-out |

### Phase 4: money in and out with partners on Tempo (about 6–10 days, gated on accounts)

| Kova feature (partner) | Ren on Tempo (partner) | Gate |
|---|---|---|
| Deposits from 53 networks (Relay) | Relay to Tempo, landing as OUSD. **Kova users can move dollars across: Monad USDC → Ren** | Relay key |
| Card or bank top-up (MoonPay) | **Stripe Onramp → OUSD on Tempo** (US/EU), and MoonPay (USDC.e, pathUSD) elsewhere | Stripe and/or MoonPay keys |
| US account number (Bridge, Request access on Kova) | **Bridge virtual account delivering straight to Tempo.** It's native here, unlike on Monad | Bridge key |
| Dollar card (Nuvion, prefunded pot) | **Stripe Issuing stablecoin card with OUSD on Tempo**, funded by an access key that can only pay the card's funding address, up to a daily limit. That's Tempo's card-program pattern, and the card becomes literally a key. The ID check and card screens come from Kova. Fallback: Nuvion's pot model | Stripe Issuing approval |
| Cash out to any country (Nuvion, 28 rails) | Same corridor engine and screens; pot refills by bridging OUSD → USDC on Base | Nuvion account for Ren |
| Savings (Setsuna vault + KovaSaver) | **Tempo Earn**: an ERC-4626 vault through `Actions.earn`, with a key scoped to the vault's deposit. Built against Moderato's test vault now; mainnet when Tempo opens a vault to Ren | Tempo Earn access |
| Stocks (xStocks) | **Not on Tempo.** Leave it out rather than fake it. If Tempo gets tokenized stocks, Kova's screens are ready | — |
| Rates (Chainlink CRE) | Chainlink feeds where Tempo has them (EUR, CAD, BRL on mainnet), Ren's two live sources for the rest, each labelled. CRE can't write to Tempo yet | — |

### Phase 5: proof and reach (about 3–4 days)

| Kova feature | Ren version |
|---|---|
| Public `/stats` (people, payments, money moved, cash-outs, sources) | Same. Money moved is read from Tempo's public indexer, and the demo and Ren's own wallets are left out |
| `/try` checklist and `?ref=` sources | Same, with Ren's demo shop |
| iOS waitlist, Android download page, Android tap to pay (HCE) and NFC tap sheet | Same, for Ren's build |
| App Review demo account, restocked | Restock from Tempo's faucet (`tempo_fundAddress`) |
| Developers page | Exists; add the MPP and subscription examples |
| README "Proof on Tempo" table | One live transaction per feature |

### Phase 6: Ren on Tempo mainnet (your call)

Railway env `tempo-mainnet` with its own Postgres. A fee payer is funded with a few dollars of OUSD
(fees are paid in stablecoins). The same code runs with `KOVA_NETWORK=mainnet`. This moves real
money, so it waits for your go.

## Decisions I need from you

1. **renpay.app is parked by Namecheap** for unverified WHOIS details. Verify the contact email at
   Namecheap. Until then, judges who open renpay.app see Namecheap's page.
2. **OUSD as Ren's dollar** (recommended), instead of AlphaUSD.
3. **The iPhone app's identity.** Ren's build shares Kova's EAS project and App Store Connect app
   (`6819066097`), so a Ren TestFlight upload would land on Kova's app. Give Ren its own app record
   (it keeps the bundle `xyz.kova.pay`)?
4. **Partner accounts for Ren:** Stripe (Onramp, Issuing), Bridge, MoonPay, Relay, Nuvion, Africa's
   Talking, Privy client for the Ren app. Which do you have or want to apply for? Each feature
   that needs one is built and shown as "Request access" until its key is set.
5. **Stocks:** leave them out (recommended; nothing to trade on Tempo).
6. **Dark Soda:** you approve the stills before it's applied.
7. **Deploys:** deploy Ren's API and web to Railway at the end of each phase, once verified?

## Order and size

Phase 0 → 1 → 2 → 3 → 4 → 5, with Phase 6 when you say. Roughly 25–35 working days in all. Phase 2
comes before Phase 3 because it is the moat. Each phase ends with:

- both surfaces checked in screenshots
- a live check on Moderato
- a short note to you of exactly what exists and what doesn't
