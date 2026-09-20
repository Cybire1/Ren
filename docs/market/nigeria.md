# Kova in Nigeria: market and regulatory context

Researched 2026-09-20. All URLs accessed 2026-09-20 unless stated. **This is research, not legal advice.** Nigerian crypto law changed materially three times in the last twelve months (ISA 2025 in March 2025, the SEC capital circular in January 2026, the Presidential Executive Order in July 2026 and the NRS tax guidelines in July/August 2026). Nothing here substitutes for a Nigerian lawyer — see [What needs a lawyer](#what-needs-a-lawyer).

**Method note.** The session's web-search budget was exhausted, so everything below came from direct page fetches plus Google News RSS as a search substitute. Some Nigerian regulator PDFs (CBN) and several news sites blocked automated fetches. Where a fact rests on a headline rather than an article body, or on a single source, it says so. Where sources conflict, both numbers are given rather than one picked.

## Bottom line

1. **Kova is legal to build and pilot today without a licence, in its non-custodial form.** Nigeria has never banned individuals or merchants from holding or transacting in crypto; the February 2021 restriction applied to *banks*, and the CBN reversed it on 22 December 2023. A merchant who accepts USDC.e and a wallet that never holds customer funds are not, on today's rules, a regulated activity in themselves.
2. **The moment Kova converts USDC to naira for anyone, it becomes a VASP** and needs SEC registration (proposed minimum capital ₦200m for the VASP category, ₦2bn for an exchange) plus, post-July-2026, CBN supervision of the payment leg. Do not build the off-ramp.
3. **The naira answer: don't offer "settle to naira" during the hackathon.** No off-ramp provider anywhere in this research accepts a Tempo deposit for cash-out — Fonbnk is the only one that touches Tempo at all, and its USDC.e pair is explicitly on-ramp-only. Point merchants at Paycrest/Noblocks or Bitnob as a separate, merchant-owned step, and show a live NGN reference rate in the app so pricing works.
4. **What Kova must avoid:** holding customer or merchant funds at any point; quoting or executing a USDC↔NGN rate as a Kova service; describing USDC.e as naira, as a deposit, or as an investment; and any language implying CBN or SEC approval.
5. **The honest wedge is not price.** A Nigerian bank transfer is free below ₦5,000 and instant. Kova cannot beat that on domestic cost. The defensible wedges are dollar-denominated settlement for merchants who want to hold USD, cross-border and diaspora payments into a local merchant, agent/API payments that NIP cannot express, and hard settlement finality where "debited but not credited" is a real and documented complaint.
6. **The biggest single risk is Flutterwave**, which is already live on Tempo, already holds every Nigerian merchant relationship Kova wants, and took strategic investment from both Circle and Ripple in mid-2026. "First on Tempo in Nigeria" is not available as a claim.

---

## Regulation

### The arc, in order

| Date | Instrument | What it did |
|---|---|---|
| 12 Jan 2017 | CBN circular FPR/DIR/GEN/CIR/06/010 | First warning to banks on virtual currencies |
| 5 Feb 2021 | CBN circular BSD/DIR/PUB/LAB/014/001 | Ordered banks to close accounts of crypto businesses. **Never criminalised holding or trading crypto** — it bound banks, not citizens |
| 22 Dec 2023 | CBN *Guidelines on Operations of Bank Accounts for Virtual Assets Service Providers* | Superseded both circulars above. Banks may open **designated** accounts for SEC-licensed VASPs. Banks remain "prohibited from holding, trading and/or transacting in virtual currencies on their own account". Senior-management sign-off and monthly reporting required ([Mariblock, 22 Dec 2023](https://mariblock.com/nigeria-authorizes-banks-to-open-accounts-for-crypto-companies/); [Reuters, 23 Dec 2023](https://news.google.com/rss/search?q=CBN+lifts+ban+on+crypto+trading)) |
| Mar–May 2024 | Enforcement episode | Binance's naira rails closed; a Binance compliance executive detained ~8 months from Feb 2024; Moniepoint and Paga froze crypto-linked accounts (May 2024) |
| 29 Mar 2025 | **Investments and Securities Act 2025** signed | Repealed ISA 2007. **Expressly designates virtual and digital assets as securities**; widens "securities exchange" to include Digital Asset Exchanges (DAX) and Digital Asset Offering Platforms (DAOP); criminalises Ponzi schemes; mandates Legal Entity Identifiers |
| 24–27 Oct 2025 | **FATF removed Nigeria from the grey list** | Confirmed by FATF, the Federal Ministry of Finance and 40+ outlets |
| 15–16 Jan 2026 | EU removed Nigeria from its AML/CFT high-risk list | |
| 16 Jan 2026 | SEC Circular 26-1 | Raised capital-market minimum capital across the board (broker-dealer ₦300m → ₦2bn), compliance deadline **30 June 2027** |
| 1 Jan 2026 | Nigeria Tax Act 2025 / Nigeria Tax Administration Act 2025 in force | Crypto transactions must be linked to **TIN and NIN**; VASPs must file returns with the Nigeria Revenue Service |
| 1 Apr 2026 | CBN **VASP AML supervisory pilot** | Cohort reported as cNGN, Flutterwave, Juicyway, KoinKoin, KuCoin, Paystack |
| **17 Jul 2026** | **Presidential Executive Order on Virtual Assets Coordination 2026** | See below — the most important instrument for Kova |
| 31 Jul 2026 | NRS **Information Circular No. 2026/21**, *Guidelines on the Taxation of Virtual Assets* | See tax section |
| 12–31 Aug 2026 | **CBN Regulatory Sandbox Cohort 2.0** applications open | VASP track explicitly covers stablecoin payments |
| 20–26 Aug 2026 | SEC exposure draft of new digital-asset rules | Registration fee ₦30m; capital ₦2bn (DAX/DAC), ₦500m (DAOP/DAPO/RATOP), **₦200m (VASP)** |
| 9 Sep 2026 | Yellow Card granted conditional SEC ARIP approval | |

### The July 2026 Executive Order — the sentence that matters

Signed 17 July 2026. It creates a **Virtual Asset Council** chaired by the **CBN**, with the **SEC** and the **Nigeria Revenue Service** as vice-chairs, plus the NFIU and the Office of the National Security Adviser; and a **Virtual Asset Office inside the CBN**. It explicitly "does not create a new regulator or transfer powers between agencies," and gave the Council 30 days to produce an implementation framework ([TheCable](https://www.thecable.ng/tinubu-signs-executive-order-on-virtual-assets/); [Premium Times, 17 Jul 2026](https://news.google.com/rss/search?q=Tinubu+Executive+Order+Virtual+Asset+Council)).

The operative jurisdictional split, per TheCable's summary of the order:

> **SEC regulates virtual assets classified as securities, while the CBN supervises payment and settlement services for non-security assets.**

**Analysis:** this is the best news in the whole document for Kova. It means a USDC.e payment from a customer to a merchant is a *payment and settlement* matter — CBN's lane — not a securities offering, even though ISA 2025 calls digital assets "securities" in the abstract. It also means Kova's regulatory destination is the **CBN Regulatory Sandbox**, not an SEC exchange licence. It does not mean the activity is unregulated; it means the right regulator is identified.

Caveat, from an independent legal analysis: Dr Iwa Salami (University of East London) notes the order leaves stablecoins "largely unaddressed", says nothing about agentic commerce, and — critically — "an executive order can be reversed by a future administration" ([The Conversation, 3 Aug 2026](https://theconversation.com/nigerias-new-digital-economy-rules-leave-gaps-in-crypto-regulation-financial-law-expert-explains-288413)).

### CBN Regulatory Sandbox Cohort 2.0 — Kova's actual door

Applications ran **12–31 August 2026** (so this window has closed; a Cohort 3 is the realistic target). The **VASP track** covers, in the CBN's own enumeration: *fiat-backed stablecoins, stablecoin issuance, **virtual asset payments**, **digital wallets**, custody solutions, token-based products, **fiat on-ramp/off-ramp services**, and **payment infrastructure*** ([Udo Udoma & Belo-Osagie via Mondaq, 27 Aug 2026](https://www.mondaq.com/nigeria/financial-services/1836036/cbn-regulatory-sandbox-cohort-20-a-new-pathway-for-virtual-asset-and-stablecoin-innovation-in-nigeria)).

Eligibility includes Nigerian-incorporated entities *and* foreign entities, and requires a working MVP, AML/CFT/CPF arrangements, consumer-protection and cybersecurity documentation, and NDPA-compliant data handling.

**Analysis:** the fact that "virtual asset payments" and "payment infrastructure" are listed as *sandbox* activities is a two-edged fact. It confirms the CBN considers them within its perimeter — i.e. at scale they will need supervision. It does not, by itself, make them unlawful outside the sandbox today.

### SEC: what registration actually costs

Two layers. **ARIP** (Accelerated Regulatory Incubation Programme) is the pre-registration on-ramp for VASPs and Digital Investment Service Providers. From the SEC's own page ([sec.gov.ng/fintech-and-innovation-hub-finport/finport-programs-ri-and-arip/](https://sec.gov.ng/fintech-and-innovation-hub-finport/finport-programs-ri-and-arip/)):

- ₦200,000 non-refundable initial assessment fee; **₦2,000,000 non-refundable processing fee**
- Must be incorporated in Nigeria, with a physical office and a CEO/MD **resident in Nigeria**
- Requires a "No Objection" letter from the sectoral regulator, **evidence of NFIU registration**, NIN and BVN for principal officers, audited accounts, a retained Nigerian solicitor, and shareholders' funds with a fidelity bond of ≥25%
- Outcome is an **Approval-in-Principle**, not a licence

The SEC's published register shows how few have got through: ARIP participants listed are **Busha Digital Limited** and **Quidax Technologies Limited** (both Digital Assets Exchange); the Regulatory Incubation sandbox listed **Trovotech, Wrapped CBDC Ltd (cNGN), HousingExchange.NG, DreamCity Capital and Blockvault Custodian**, all with test periods ending 28 Aug 2025 ([sec.gov.ng registered fintech operators](https://sec.gov.ng/fintech-and-innovation-hub-finport/registered-fintech-operators/)). Luno, GetEquity and Bitbarter received ARIP approvals-in-principle in July 2026; Yellow Card in September 2026. One law-firm guide notes the SEC "did not issue an approval in principle nor admit any VASP to the programme in 2025, despite pending applications."

The **August 2026 exposure draft** proposes: ₦30m registration fee across all digital-asset categories, ₦300k application fee, ₦100k processing fee; minimum capital **₦2bn** for Digital Asset Exchanges and Custodians, **₦500m** for offering/tokenisation platforms, **₦200m for the VASP category**; fidelity bond ≥25% of paid-up capital; supervisory charges of 0.015–0.025% of turnover ([Nairametrics, 22 Aug 2026](https://nairametrics.com/2026/08/22/sec-sets-n30-million-registration-fee-up-to-n2-billion-capital-for-crypto-firms)). Reporting from the same week says the SEC also wants crypto firms to share transaction data, and proposes retail caps of ₦1m per issuer and ₦10m annually — *headline-level only, not verified in the draft text.* Nigeria's blockchain industry body SiBAN publicly warned the combination "could kill indigenous crypto startups" (25 Aug 2026).

### Tax — the number that changes Kova's unit economics

NRS **Information Circular No. 2026/21**, issued **31 July 2026**, applying the Nigeria Tax Act 2025 (Ninth Schedule) and Nigeria Tax Administration Act 2025 (s.79, Fifth Schedule):

- **1.5% stamp duty on token-to-fiat and fiat-to-token conversions.** Borne by whoever receives the crypto; the platform deducts it *in crypto* before crediting the customer and remits to NRS twice monthly, by the 15th and 30th.
- **VAT does not apply to the crypto transfer itself**, but does apply to the platform's fee (exchange, custody, wallet, advisory). And: *"If someone pays for goods or services using crypto instead of cash, VAT still applies to that purchase."*
- Income tax at normal rates: individuals 0–25%, **companies 30%**. Gains on disposal taxed as income.
- Withholding tax **1%** of gross disposal proceeds on crypto/exchange/security tokens and NFTs; **10%** on passive income (staking, mining, airdrops, DeFi yield).
- Gains are **computed in dollars, not naira** — an unusual and consequential drafting choice.
- Scope covers anyone who buys, sells, swaps or deals in virtual assets, **receives income or payment in virtual assets**, or operates as a VASP or P2P marketplace.

Sources: [Tope Adebayo LP via Mondaq](https://www.mondaq.com/nigeria/sales-taxes-vat-gst/1836300/nigerias-new-crypto-tax-rules-what-virtual-asset-service-providers-need-to-know-and-the-legal-questions-that-remain); [Stren & Blan Partners via Mondaq](https://www.mondaq.com/nigeria/tax-authorities/1831926/nigerias-new-virtual-asset-va-tax-regime-legal-and-regulatory-implications-for-startups); [TechCabal, 3 Aug 2026](https://techcabal.com/2026/08/03/).

**Analysis, and it is the single most useful reading in this document:** the 1.5% duty attaches to **conversions between token and fiat**, not to token-to-token or wallet-to-wallet transfers. A Kova payment — USDC.e from a customer's Tempo account to a merchant's Tempo account — is not a conversion. On the face of the circular it therefore does not attract the 1.5% stamp duty. The duty bites at the *off-ramp*, which is exactly the leg Kova should not own. This is a structural argument for the non-custodial, no-off-ramp design, not merely a convenience. **A lawyer must confirm this reading before it appears in any Kova marketing.**

Merchants still owe income tax on revenue received in USDC.e (valued at the CBN/NAFEM rate) and VAT on the goods sold, exactly as with cash.

### AML/KYC and data protection

- **Money Laundering (Prevention and Prohibition) Act 2022** brings VASPs into the AML perimeter. The SEC's own ARIP checklist requires **evidence of NFIU registration** — practical proof that a VASP must register with the Nigerian Financial Intelligence Unit (and, in practice, SCUML) before the SEC will process it.
- CBN AML/CFT Regulations 2022 impose CDD and suspicious-transaction reporting on regulated institutions; the CBN issued a reminder circular with sanction warnings in **April 2025**.
- Nigeria **left the FATF grey list** in October 2025 and the EU high-risk list in January 2026 — the posture is now "keep it clean," and officials are already talking about the 2027 FATF mutual evaluation. **Analysis:** expect enforcement appetite to rise, not fall.
- **Nigeria Data Protection Act 2023**, plus the **General Application and Implementation Directive (GAID)** issued March 2025 and **effective 19 September 2025**. GAID sorts controllers into Ultra-High, Extra-High and Ordinary-High tiers with different registration and filing duties. The NDPC has fined Meta USD 32.8m, MultiChoice ₦766.2m and Fidelity Bank ₦555.8m. Kova will process NIN/BVN-adjacent identity data, merchant data and transaction data — **registration with the NDPC and a data-protection audit are likely obligations, and the fine history is real.**

### So what can a startup legally do today?

**Clearly permitted, no licence:**
- Publishing non-custodial wallet software. Funds move customer account → merchant account on Tempo; Kova never has custody or control.
- A merchant accepting stablecoin for goods. No instrument found in this research prohibits it. VAT and income tax apply normally, and NRS Circular 2026/21 contemplates it explicitly.
- An individual holding, sending or receiving crypto.
- An API, dashboard, NFC card and POS terminal that are software and hardware for the above.
- Bank accounts: a Nigerian company can bank normally, provided it is not itself a VASP whose account would need the designated-VASP treatment.

**Clearly needs a licence/registration:**
- Converting USDC↔NGN as a service, for Kova's own account or a merchant's (VASP; SEC registration, proposed ₦200m capital; CBN supervision of the payment leg).
- Custody of user funds or keys in a way that gives Kova control (Digital Asset Custodian, proposed ₦2bn).
- Operating an exchange or order book (DAX, ₦2bn).
- Issuing a stablecoin, including any naira-denominated token.
- Holding merchant float, even briefly, or operating an omnibus settlement account.

**Genuinely grey — flag these, don't guess:**
- **Non-custodial payment infrastructure at scale.** The CBN sandbox lists "virtual asset payments" and "payment infrastructure" as VASP-track activities. Does that make a non-custodial payment app a VASP? The FATF definition turns on transfer or safekeeping *on behalf of another*, which arguably excludes pure software — but no Nigerian instrument found says so explicitly.
- **Sponsoring gas fees.** Kova's fee payer pays transaction fees for users in USDC.e. Is that "conducting a transaction on behalf of another"? Unresolved.
- **Whether a merchant "accepting crypto" is a P2P marketplace** for NRS purposes and thus has VASP filing duties.
- **The TIN/NIN linkage rule from 1 Jan 2026.** Reported as applying to "all crypto transactions" — whether it reaches a self-custodial wallet with no Nigerian intermediary is unclear. Single-source (Tribune, 1 Feb 2026).
- **Whether the Executive Order survives** a change of administration, since it is not a statute.
- **cNGN.** Nigeria's regulated naira stablecoin, issued by the Africa Stablecoin Consortium via **Wrapped CBDC Ltd**, which the SEC's own register shows in its Regulatory Incubation sandbox (Aug 2024 – Aug 2025). Launched Feb 2025; listed by Busha, Quidax and Roqqu; deployed on Celo in Aug 2026; supported by Paycrest. Adoption has been repeatedly reported as slow. **Analysis:** cNGN is the only naira-denominated token Kova could touch without issuing anything — but it is not on Tempo, and a Tempo↔Celo/other hop is required.
- **eNaira.** The CBN's CBDC. Reported in October 2025 under the headline "Is Nigeria's eNaira Dead? CBN Forms New Task Force for Official Stablecoin" (Cryptonews). **Treat the eNaira as effectively dormant and irrelevant to Kova; this is headline-level evidence only and not independently confirmed.**

### What needs a lawyer

A Nigerian fintech/securities lawyer must confirm, before Kova onboards a merchant at any scale:

1. **Is non-custodial payment software a "VASP" under the Nigerian implementation of the FATF definition?** This is the whole question. Get it in writing.
2. **Does the 1.5% NRS stamp duty attach to a wallet-to-wallet stablecoin payment, or only to a token↔fiat conversion?** Kova's pricing story depends on the answer.
3. **Does sponsoring gas fees on a user's behalf create regulated activity or custody?**
4. **What exactly must a Nigerian merchant do to accept stablecoins lawfully** — TIN, VAT registration, NRS returns, record-keeping — so Kova can hand each merchant a one-page compliance note rather than expose them.
5. **Does the 1 Jan 2026 TIN/NIN linkage requirement reach a self-custodial wallet with no Nigerian intermediary?**
6. **NDPA/GAID:** which controller tier does Kova fall into, and must it register with the NDPC and appoint a DPO before the pilot?
7. **Corporate form:** does Kova need a Nigerian entity with a resident MD now, or only at CBN-sandbox/SEC-registration time?
8. **Marketing constraints:** what may Kova say publicly, given the SEC's aggressive posture on unregistered offerings and the CBEX enforcement episode of April 2025?
9. **Whether the CBN sandbox Cohort 3 is the right target**, and whether operating a pilot before admission creates exposure.
10. **AML programme minimum:** must Kova register with NFIU/SCUML at pilot scale, and what sanctions-screening obligations attach?

---

## Getting naira out

The hard finding first: **no off-ramp provider found in this research will take a Tempo deposit and pay out naira.** Fonbnk is the only provider anywhere that lists Tempo at all — it supports pathUSD and USDC.e on Tempo — and its own documentation flags that pair as **on-ramp only, "cannot be sold."** Yellow Card, Bitnob, Busha and Paycrest documentation contains no mention of Tempo.

### Provider comparison

| Provider | Operating? | Chains / assets | USDC→NGN fee | Settlement | Self-serve API? | KYC/KYB | Nigerian licence | Tempo? |
|---|---|---|---|---|---|---|---|---|
| **Paycrest / Noblocks** | Yes, docs current | Ethereum, Base, Arbitrum, Polygon, BNB, Lisk, Celo, Starknet, Tron. USDT, USDC, **cNGN** | "Zero sender fees"; a 0.5% aggregator fee sits inside the LP rate. **Effective % not published** | **<30s for most NGN orders**, ~98.7% reliability claimed | **Yes** — public Sender API v2, no sales gate | Identity verification for senders and providers | Routing protocol connecting to licensed LPs; holds no VASP licence itself | No |
| **Bitnob** | Yes | Tron, Polygon, Solana, Ethereum (USDT/USDC), BTC/Lightning | Not disclosed | "Real-time"; bank leg varies | **Yes** — instant sandbox signup, test keys immediately | Standard KYB for production | "Not a bank; services may be provided by licensed FIs" | No |
| **Cashramp** (Rockets) | Yes | Not itemised in docs reached | Not disclosed | <15 min (agent P2P) | **Yes** — Hosted / Direct / Onchain Ramp | 18+, government ID | Not stated | Unknown |
| **Yellow Card** | Yes; raised $33m Oct 2024 | USDT/USDC/PYUSD on Ethereum, Solana, Stellar, Celo, Base ("30+ chains" claimed) | Not published. Docs' 0.25%+flat example is for **South Africa** | NG bank transfer "instant" | **No** — discovery call → KYB → legal agreement → sandbox keys | Full KYB | **SEC ARIP conditional approval, 9 Sep 2026** (not a full licence); CASP licence in South Africa | No |
| **Busha** | Yes | USDT/USDC; full list not obtained | Not published | "Settle in minutes" | Partially — API keys offered alongside enterprise track | SEC-licensed compliance implied | **SEC-licensed**; ARIP participant on SEC register | No |
| **Quidax** | Ambiguous — site blocked all fetches; **reported to have pulled P2P trading Jan 2026** | Unverified | Unverified | Unverified | Unverified | Unverified | ARIP participant on SEC register | Unknown |
| **Fonbnk** | Yes | 14 chains incl. **Tempo** (pathUSD, USDC.e), Base, Solana, Polygon, Celo, Stellar, Tron | Not disclosed | "<30s" claimed | **Yes** — self-serve, REST + widget | Per-country KYC | Not stated | **Yes, but on-ramp only** |
| **Onafriq** (ex-MFS Africa) | Yes, very active (Circle Apr 2025, Conduit Feb 2026, Privy Jul 2026) | Not itemised | Unverified | Unverified | **No** — wholesale/enterprise | Unverified | Operates via licensed local partners | No |
| **Juicyway** | Yes | USDC, USDT; chains not itemised | "Low fees"; no % published | Not detailed | Dev API referenced, not verified | PCI-DSS L1, SOC2 (certs, not licences) | Not stated; named in CBN VASP AML pilot | Unknown |
| **Kotani Pay** | Yes | Polygon, Celo, Optimism, Stellar, Arbitrum, Avalanche, Cardano, Lisk, Lightning (15+) | Not disclosed | Not disclosed | **No** — sales-gated | Not detailed | FSCA licence in South Africa; **Nigeria not named on site** | No |
| **Flutterwave** | Yes, dominant | Polygon (default), **Tempo (since Jun 2026)**, Ethereum, Solana, Base; USDC/USDT/RLUSD | Not disclosed | Not disclosed | Enterprise | Full | CBN VASP AML pilot participant; CBN sandbox applicant | **Yes** |
| **Fincra** | Presumed yes; site unreachable all attempts | Could not verify | Could not verify | Could not verify | Could not verify | Could not verify | Could not verify | Unknown |
| **Paystack** | Yes, fiat only | No crypto evidence found | — | — | — | — | Named in CBN VASP AML pilot | No |
| **MoonPay** | Yes globally | — | — | — | — | — | **Nigeria explicitly listed as unsupported** in MoonPay's own docs | No |
| **Transak** | Could not verify (403) | — | — | — | — | — | — | Unknown |
| **Onramp.money** | Yes; Nigeria listed in "75+ countries" | Ethereum, Polygon, BSC, Solana, NEAR, Optimism, Arbitrum, Tron | Not NGN-specific | Not detailed | Yes — widget/white-label | Not detailed | Not stated | No |
| **Chipper Cash** | Under stress — **CBN revoked its microfinance banking licence, 3 Jul 2026**; reportedly seeking a buyer | Consumer P2P, not an off-ramp API | — | — | — | — | Licence revoked | No |
| **Lazerpay** | **Dead — shut down April 2023**, 8+ outlets; site is a stuck loading screen | — | — | — | — | — | — | — |
| **Scalex** | **Likely defunct** — scalex.africa 301-redirects to an unrelated restaurant site | — | — | — | — | — | — | — |
| **Grey, LemFi, Klasha, Bani** | Operating, but **fiat-only** — not crypto off-ramps. Exclude from the shortlist | — | — | — | — | — | — | — |

Two important flags. First, **Flutterwave's Tempo status is contested between sources in this research**: one stream reports Flutterwave live on Tempo since June 2026 as part of a multi-chain orchestration layer; another, reading the July 2026 Circle Ventures announcement, concludes USDC merchant settlement is "coming, not yet usable." Verify directly before relying on either. Second, **no published USDC→NGN percentage fee could be obtained from any provider** — every one of them quotes on request or embeds the margin in the rate. Any fee number in a Kova pitch must come from a live quote, not from this table.

### The bridge problem

Tempo's own docs (and `docs/tempo/01-network-sdks-funding.md`) confirm the exits: **Stargate/LayerZero at 0 bps Tempo↔Ethereum**, plus Relay, Across, Squid, Rhino, Symbiosis and Bungee, aggregated behind the Tempo **Routes** API. Live Routes quotes on 2026-09-19 showed Base→USDC.e at 1:1 via Stargate. Bridging *out* through LayerZero needs a USDC.e→LZD wrap because Tempo has no native gas token.

So the realistic merchant cash-out chain today is:

**USDC.e on Tempo → bridge to Base or Ethereum (Stargate 0 bps to Ethereum; Relay/Across a few bps) → off-ramp on that chain via Paycrest/Bitnob/Yellow Card → NGN in a Nigerian bank account.**

That is three parties, two of which Kova does not control, and the 1.5% NRS stamp duty lands on the final leg. **Analysis: this is not a product Kova can ship by 12 October, and it should not try.**

### Recommendation

**Do not offer "settle to naira" during the hackathon.** Instead:

1. **Show the naira number without touching naira.** Display every amount dually — "₦12,500 · 7.52 USDC" — using a public NGN/USD reference rate refreshed in-app. This solves the actual merchant problem (they price in naira) without Kova quoting or executing an FX rate. Label the rate source and mark it indicative.
2. **Hand the merchant a cash-out sheet, not a button.** One page: how to bridge USDC.e to Base with Tempo Routes, then Paycrest/Noblocks or Bitnob to their bank. Kova documents it; the merchant executes it; Kova never holds or converts. This is the difference between "software" and "VASP."
3. **For the pilot, the founder can bridge and settle manually** for a handful of merchants as a goodwill operation, disclosed as such — but never as an advertised Kova feature, and never by taking merchant funds into a Kova account.
4. **Post-hackathon:** open a conversation with **Paycrest** (only genuinely self-serve, public API, no sales gate) and **Fonbnk** (only provider that touches Tempo at all — ask directly whether Tempo USDC.e sell-side is on their roadmap). A Tempo→NGN sell path at Fonbnk would be the single highest-leverage partnership available to Kova.

---

## Funding a wallet

**How a Nigerian gets USDC today, ranked by what actually works:**

1. **P2P on a global exchange.** Binance ended official naira rails around March 2024 after the crackdown, and the FIRS tax case was still in settlement talks as of 9 July 2026 — but Nigerians still use Binance P2P in a peer-to-peer capacity, and 2026 consumer guides are still written about it. **OKX restored P2P and full access in Nigeria on ~9 July 2026.** KuCoin suspended NGN P2P in May 2024 and is now the **only global exchange in the CBN Virtual Asset Supervisory Pilot** (reported 13 Sep 2026). Bybit is widely referenced as a working alternative but no formal restriction/restore event was found.
2. **Local exchanges.** Busha (SEC-licensed), Roqqu (expanding hard; lists cNGN), Luno Nigeria (ARIP approval-in-principle July 2026), Quidax (active brand, P2P reportedly paused Jan 2026).
3. **Direct on-ramps with an NGN bank-transfer rail.** **Fonbnk** is the standout: self-serve, widget or API, <30s claimed, confirmed NGN bank transfer, and — uniquely — it can deliver **USDC.e or pathUSD directly on Tempo.** Yellow Card's consumer app also works in Nigeria. Onramp.money lists Nigeria but its actual NGN rail is unconfirmed. **MoonPay excludes Nigeria outright.** Transak unverified.
4. **Tempo's own routes.** The Accounts SDK's `wallet_deposit` opens Tempo Wallet's embedded onramp; Tempo Routes can mint reusable per-user deposit addresses from Base, Solana, Tron, BNB, Polygon and Ethereum. Both are documented in `docs/tempo/01-network-sdks-funding.md`; the Routes deposit-address endpoint needs an invite-only Console key.

**The FX spread, mid-September 2026** — and this is much better news than it would have been two years ago:

| Date | Official / CBN-linked | Parallel ("street") | Spread |
|---|---|---|---|
| 11–18 Sep 2026 | ≈ ₦1,329–1,332/$ | ≈ ₦1,370–1,390/$ | **₦46–60, ~3.5–4.5%** |

Arbiterz reported the gap narrowing to ₦46/$ on 15 Sep 2026. For context, the naira went from ~₦600/$ at the June 2023 float, to a ₦1,717.50 all-time low in November 2024, back to ~₦1,330 by September 2026 — TradingEconomics has it **strengthening 10.9% year on year**. Inflation has fallen from a 34.80% peak (Dec 2024) to **15.39% (Aug 2026)**, though the January 2025 CPI rebasing means the series is not continuous.

**Analysis:** a 3.5–4.5% official-parallel spread is narrow by Nigerian standards and removes some of the old "stablecoins as FX arbitrage" pull. But it also means **on/off-ramp slippage is now a manageable few percent rather than a 40% gulf**, which makes a stablecoin payment loop economically coherent for the first time. Budget 2–5% spread plus the provider's undisclosed fee plus the 1.5% stamp duty on the fiat leg — call it **4–8% round trip**, and be honest about it internally.

**Per-provider NGN deposit and transaction limits could not be verified for any provider.** Assume tiered KYC caps and check before the demo.

---

## Market and competition

### The rails Kova is competing with

| Metric | Value | Date / source |
|---|---|---|
| NIBSS instant payment (NIP) value, 2024 | **₦1.07–1.078 quadrillion**, +78% YoY (2023: ₦600.36trn; 2022: ₦387trn) | NIBSS via Vanguard, Jan 2025. **One source using a different classification puts 2024 NIP at ₦105trn — unreconciled, flagged** |
| PoS transactions, 2024 | 1.38bn transactions, **₦18.32 trillion** | NIBSS |
| PoS, Q1 2025 | 776.93m transactions, ₦10.51trn (+207% volume YoY) | NIBSS |
| PoS terminals | 8.355m registered / 5.9m active, end-March 2025 — **1 terminal per 41 people**, from 1-per-89 a year earlier | NIBSS |
| PoS agents | ~1.9 million mandated to register | CBN/CAC via TechCabal, May 2024 |
| Licensed payment providers | 84 (8 MMOs, 10 super agents, 7 switching, 31 PSSPs) | CBN, end-2025 |
| Cash outside banks | ₦4.8trn of ₦5.73trn currency in circulation — **89.2%** | July 2026 |
| Financial inclusion | 74% (CBN, H1 2025); EFInA puts exclusion at 21% but finds **61% of adults in severe liquidity distress** | 2025–2026 |
| NQR (NIBSS QR) | **No published volume or value figure exists.** Industry bodies were still holding adoption-advocacy meetings in June–July 2026, five years after launch | — |

### Merchant fee comparison — what Kova is actually being compared against

| Rail | Merchant pays | Settlement | Notes |
|---|---|---|---|
| **Consumer bank transfer (NIP)** | **₦0** — the customer pays ₦0 under ₦5,000, ₦10 for ₦5,001–50,000, ₦50 above | **Instant** | Per the CBN Guide to Bank Charges effective 1 May 2026. The free-under-₦5,000 tier is new in 2026. **This is the thing to beat.** |
| Paystack — local card/transfer/USSD | 1.5% + ₦100, **capped at ₦2,000** (₦100 waived under ₦2,500) | T+1 | [paystack.com/pricing](https://paystack.com/pricing), confirmed live |
| Paystack — international card | 3.9% + ₦100 (virtual) / 4.5% + ₦100 (terminal) | Varies | |
| Flutterwave — local, all methods | **2.0% flat** (1.4% txn + 0.6% platform) | T+1 | [flutterwave.com/ng/pricing](https://flutterwave.com/ng/pricing) |
| Flutterwave — international card | **4.8%** | Varies | +7.5% VAT on fees |
| Moniepoint POS — withdrawal | 0.5% under ₦20,000; flat ₦100 above | "Instant" | **No official fee schedule published**; from a third-party review |
| OPay / PalmPay POS — withdrawal | 0.5%, **capped at ₦100** | Instant | Same caveat — no primary source |
| CBN POS merchant service charge cap | **0.5%, capped at ₦10,000**; free to the customer | — | Guide to Bank Charges, effective 1 May 2026 |
| EMTL (electronic money transfer levy) | **₦50** on transfers ≥ ₦10,000 | — | Reframed as stamp duty under the Nigeria Tax Act 2025 from 1 Jan 2026; liability moved to the sender |
| VAT on transfer/USSD fees | **7.5% on the fee** (not the principal), from 19 Jan 2026 | — | Caused visible public backlash |
| **Kova (proposed)** | Tempo network fee ≈ **$0.00003–0.0006** per transfer; ~281k gas for a first-time recipient ≈ $0.00017–0.0034 | **~0.55s, deterministic finality** | From `docs/tempo/01-network-sdks-funding.md`, measured 2026-09-19 |

**Analysis:** Kova's on-chain cost is effectively zero and its finality is sub-second and deterministic. Against a card at 1.5–2%, that is a real win. **Against a free instant bank transfer, it is not a win at all.** Any pitch built on "cheaper than a bank transfer" is false in Nigeria and a Nigerian judge or merchant will know it instantly.

### Crypto adoption — the demand side

- **Chainalysis Global Crypto Adoption Index:** Nigeria #2 globally in 2023 and 2024, **#6 in 2025** (published 2 Sep 2025). The methodology changed between editions — the 2023 index had a P2P sub-index Nigeria led, which later editions dropped — so the drop is partly an artefact.
- **Value received:** ~$59bn (Jul 2023–Jun 2024) and **$92.1bn (Jul 2024–Jun 2025)** appear in reporting, from different sources and windows. Not a clean trend line. ~85% of transactions were under $1m, i.e. retail and SME.
- **Stablecoin share of Nigerian/SSA volume: reported variously at 40%, 43% and "over 65%"** depending on source and window. Cite a range.
- **Nigeria is ~60% of all sub-Saharan African stablecoin inflows** — this one figure is corroborated independently by IMF-cited and Chainalysis-cited reporting. ~**$22bn** in stablecoin transactions Jul 2023–Jun 2024, #1 in Africa.
- **Users: ~25.9 million stablecoin users, 11.9% penetration, #1 globally** (Yellow Card's 2025 Africa report). A separate uncited "~40% of Nigerians" claim is four times higher and should not be used.
- The IMF told Nigeria in June 2026 to tighten stablecoin rules over monetary-sovereignty risk.

### Competition

| Company | What it does | Chains | Merchant fee | Live in Nigeria? |
|---|---|---|---|---|
| **Flutterwave** | Stablecoins as an invisible settlement rail under existing merchant relationships; merchant stablecoin balances via Turnkey | **Polygon (default), Tempo, Ethereum, Solana, Base** | Not disclosed | **Yes — the incumbent.** $3.25bn valuation, Ripple strategic investment, **Circle Ventures investment July 2026**, CBN AML pilot participant, CBN sandbox applicant |
| **Yellow Card** | Pan-African stablecoin infra, treasury portal, API | 30+ claimed | Not disclosed | Yes, but **ARIP conditional only** (9 Sep 2026) |
| **Onboard (Nestcoin)** | B2B cross-border payments; **P2P engine inside Coinbase's Base app for Nigerian users** | Base implied | **Rare disclosed pricing: stablecoin withdrawals 0.1%**, USD transfers 0.5% | Yes |
| **Paycrest / Noblocks** | Open routing protocol + reference app | 9 chains, USDT/USDC/cNGN | "Zero sender fees" | Yes (NGN and cNGN) |
| **Fonbnk** | Mobile-money↔stablecoin, no-code widget | 14 chains **incl. Tempo** | Not disclosed | Yes |
| **Bitget Wallet** | **USDC-funded physical Mastercard, tap-to-pay** | Multi-chain | Not disclosed | **Yes — launched April 2026** in Nigeria, South Africa, Ghana, Kenya |
| **Quidax** | SEC-licensed exchange, stablecoin infra in 21+ countries | Multi-chain | Not disclosed | Yes |
| **cNGN** | Regulated naira stablecoin (Africa Stablecoin Consortium) | Celo and others | n/a | Yes; in CBN AML pilot |
| **Cashramp / Accrue** (Rockets) | Agent-network stablecoin ramps and business banking | Not itemised | Agent spread | Yes |
| **Moniepoint, OPay, PalmPay, Interswitch** | Agent banking / POS / switching | — | — | **No stablecoin activity found** despite extensive searching |
| **Stripe/Bridge, Rain, Mural, Conduit, Zar, Sling, Felix** | Stablecoin infra | — | — | **No Nigeria/Africa activity found** — all LatAm/EU-focused |
| **MoonPay** | On/off-ramp | — | — | **Excludes Nigeria** |

### The graveyard — read this before pitching

- **Lazerpay** (Nigeria, crypto merchant-payments API). Onboarded 3,000+ merchants in 17 months. **Shut down April 2023.** Lead investor withdrew; reportedly refused to move off a $15m valuation while doing only ~$80k in payment volume; FTX's collapse froze African crypto VC. 8+ outlets confirm.
- **Fluidcoins** (Nigeria, crypto payments). Raised $180k in 18 months; **distress-sold to Bitfinex, Feb 2023.**
- **Bundle Africa** (Nigeria). Peak 50,000 MAU, $50m monthly volume; **exchange arm shut 21 July 2023.**
- **Patricia** (Nigeria). $2m hack Jan 2022 undisclosed until May 2023; bank run exposed a 75 BTC deficit; converted customer balances into a proprietary token without consent. No reporting after Nov 2023.
- **Chipper Cash.** CBN **revoked its microfinance banking licence on 3 July 2026**; reportedly seeking a buyer.

**Analysis: the failure mode is not technical.** Lazerpay's product worked and it had 3,000 merchants. It died because merchant crypto-payment volume in Nigeria was thin relative to what the company cost to run. Kova's pilot should be designed to measure exactly that — real repeat volume per merchant — not to demonstrate that the rail functions.

### The honest wedge

Kova does **not** beat a free instant bank transfer on domestic price or speed. What it can beat it on:

1. **Dollars.** NIP moves naira. A merchant who wants to hold USD — importers, freelancers, anyone hedging — cannot get that from NIP at all, and 25.9 million Nigerians already hold stablecoins. This is the strongest wedge and it is a *store-of-value* wedge dressed as a payments product.
2. **Cross-border in.** A diaspora customer or a foreign buyer paying a Lagos merchant directly, with no correspondent bank, no 4.8% international card fee, and no 3–7 day wait. Nigeria is ~60% of sub-Saharan African stablecoin inflows — the money is already arriving this way, it just does not reach merchants.
3. **Finality.** ~0.55s deterministic finality, no reversal, no chargeback. Against a documented Nigerian pattern of "debit alert, no credit," "over 60% of complaints relate to non-reversal of failed transactions," and 24-hour/5-working-day mandated reversal windows, "the money is either there or it isn't, in half a second" is a genuine product claim.
4. **Agent and API payments.** NIP has no expression for a machine-initiated, policy-scoped, sub-cent payment. Tempo's access keys with periodic limits and call scoping do. Nobody in Nigeria is competing here yet.
5. **Zero merchant discount rate.** Against Paystack at 1.5%+₦100 and Flutterwave at 2%, a near-zero-fee card-present rail is real — but only for merchants currently paying card fees, which is a minority of informal Nigerian merchants.

Wedges Kova should **not** claim: cheaper than bank transfer, faster than bank transfer, first on Tempo in Nigeria, or regulatory approval of any kind.

---

## Practical realities

### Devices

- ~189–200m active mobile lines; teledensity ~90% (NCC via Guardian Nigeria, 11 Sep 2026). DataReportal Digital 2026 gives 165m cellular connections (69.2% of a 239m population), 69% of them broadband, and 109m internet users.
- **Android 81.96% / iOS 17.93%** (StatCounter, Nigeria, August 2026). Vendors: Apple 17.92%, Tecno 17.34%, Samsung 16.28%, Infinix 15.08%, Xiaomi 7.65%, Unknown 11.62%.
- Android versions in use: 13 (17.75%), 12 (16.28%), 11 (13.5%), 14 (12.11%), 15 (11.78%), 10 (9.48%). **All support Host Card Emulation** — Android version is not the NFC constraint.

### NFC — the make-or-break assumption

**No published statistic exists for "% of Nigerian phones with NFC."** It is not a tracked metric. What *is* verifiable is model-level spec data (GSMArena, checked live):

| No NFC | Has NFC |
|---|---|
| itel A100Cs, itel Power 80, itel Zeno 100 (all 2026, ~€60) | Tecno Camon Slim 4G/5G, Tecno Spark 50 4G |
| Tecno Spark Go 3 Pro (~€140), Tecno Pop X 4G (~€80) | Infinix Note 60, Infinix Hot 70, Infinix Smart 20 |
| | Infinix Smart 10 (~€60) — **"NFC: Yes (data transfer only; not for payments — market/region dependent)"** |

**The pattern: NFC tracks price tier, not brand.** itel — the true bottom of the Nigerian market — omits NFC across every recent model checked. Tecno's cheapest lines (Pop, Spark Go) omit it; its mainline Spark and Camon include it. Infinix includes it even at €60, but at least one model's chip is flagged as **data-transfer-only, not payments, and region-dependent**.

**Analysis and product consequence:** NFC availability correlates inversely with exactly the income segment Kova targets. **Phone-based tap cannot be the primary consumer path.** The physical NFC card is not a nice-to-have — it is the load-bearing consumer interface, and it shifts the NFC requirement onto Kova's own POS terminal, which Kova controls.

There is a sobering precedent: **Nigeria reportedly has over 70 million contactless cards that go unused**, attributed to trust concerns and — per Lendsqr's CEO — merchant acceptance: *"It's one thing to have a contactless card; it's another thing to have places you can use them."* The CBN contactless limits (₦15,000 per transaction, ₦50,000 daily) have not been indexed to inflation and now sit below one month's ₦70,000 minimum wage. AfriGO, PalmPay, Moniepoint, Access Bank and Visa were all pushing 5-million-card contactless rollouts through 2025. *(The 70m figure is single-sourced at headline level; methodology unverified.)*

### Connectivity and power

- Median mobile download speed: **44.96 Mbps** (DataReportal/Ookla, Aug 2025) vs **14.7 Mbps** (nPerf, Q4 2025). Unreconciled; different methodologies. Nigeria ranked 85th globally, Feb 2026.
- **NCC approved a 50% telecom tariff hike on 20 January 2025** — the first in 12 years; a legal challenge was struck out in April 2026. Consumers paid ~65% more per GB by March 2025. Current NGN/GB not verified.
- **Offline store-and-forward is already the norm** for African POS: the terminal saves the transaction locally and syncs when connectivity returns, with SMS confirmation as the trust mechanism. Sub-Saharan Africa saw 190 internet shutdowns 2014–2024; 78% of the population is not on mobile internet.
- **Grid:** ~9–10 national grid collapses in 2024; at least 3 by September 2025; two in January 2026 alone (23rd and 27th). "Over 25 grid collapses" cited under the current power minister as of April 2026. Band A customers are promised 20h/day at ₦206.80/kWh but NERC ordered **20% compensation for Band A shortfalls in May–June 2026** — even the premium tier misses. Small merchants are visibly shifting to solar and battery.

**Analysis:** the POS terminal needs multi-*day* standby, USB-C charging from a solar power bank, and an offline queue that syncs on reconnect. Mains power at the counter cannot be assumed. Sub-second on-chain finality is worthless if the terminal cannot reach the RPC — so the terminal must be able to capture a signed intent offline and broadcast later. Tempo's T11 `validBefore` window of **up to 5 minutes** helps here but is not long enough for a real outage; design accordingly.

### Would a Nigerian consumer tap a card for a stablecoin payment?

Mixed. **For:** 25.9m Nigerians already hold stablecoins; 73% of Nigerian respondents in one 2024 survey claimed crypto ownership (self-reported, directional only); one report found 67% save and invest rather than speculate. **Against:** the 70m dormant contactless cards; ₦25.85bn of bank fraud losses in 2025 (down 51% from ₦52.26bn) and ₦134–162bn over six years; and a culture of well-founded scam wariness. **Analysis: trust, not technology, is the adoption constraint, and the card must visibly prove the payment happened** — an on-screen confirmation plus an SMS or in-app receipt to both parties, in the pattern Nigerian POS already trained people to expect.

### USSD and QR, for context

USSD remains deeply embedded — a ₦300bn USSD fee dispute between banks and telcos took four years and was only settled in February 2026. QR (NQR) has been live since 2021 with no published volume figures and industry bodies still lobbying for adoption in mid-2026. **Analysis: do not build a QR-first flow for Nigeria. Nigerians transfer, they do not scan.**

---

## What this means for Kova

### Product decisions

1. **Stay non-custodial, and make it the headline, not a footnote.** "Kova never holds your money — it moves from your customer's account to yours" is simultaneously the legal argument, the trust argument in a market with 70m dormant contactless cards, and the differentiator against every failed predecessor that held float.
2. **Price at zero merchant discount rate for the pilot.** Kova's on-chain cost is ~$0.0002–0.003 per payment. Charge merchants nothing, absorb gas via the fee payer, and say so. Monetise later on the API, the terminal, and business features — never by taking a spread on FX, which is both the regulated activity and the taxed one.
3. **Do not ship "settle to naira."** Ship a naira *display* (dual-currency amounts from a public reference rate, labelled indicative) and a documented, merchant-executed cash-out path. Revisit only after a lawyer answers questions 1 and 2 in the list above.
4. **The card carries the consumer, not the phone.** Low-end Nigerian Android does not reliably have payment-capable NFC. Kova Pay on the phone is for balance, history and receipts; the card and Kova's own POS terminal are the tap surface.
5. **Terminal spec: multi-day battery, USB-C, offline queue.** Assume no mains and intermittent data. Store-and-forward is what Nigerian merchants already expect from POS; matching it is table stakes.
6. **Receipts as trust infrastructure.** Immediate on-terminal confirmation, plus a receipt to both customer and merchant. The market's scar tissue is "debited but not credited"; Kova's sub-second deterministic finality is the cure, but only if it is *visible*.
7. **Compliance hygiene from day one, cheaply:** a Nigerian entity with a resident director, NDPC registration, a written AML/KYC policy, sanctions screening on merchant onboarding, and a one-page tax note for each merchant (income tax on USDC.e revenue at the NAFEM rate, VAT on the goods as normal). None of this requires a licence; all of it is what a CBN sandbox application will ask for.

### Which merchants to target first

Rank by "already wants dollars," not by transaction count:

1. **Merchants with foreign-currency costs** — importers, electronics and phone dealers, anyone buying stock abroad. They are already converting naira to dollars; Kova lets them skip a leg.
2. **Merchants serving diaspora or foreign customers** — short-let apartments, tour operators, logistics/agency businesses, crypto-native service providers. Cross-border is where a stablecoin rail is unambiguously better.
3. **Merchants who already hold USDT/USDC personally.** There are ~25.9 million such Nigerians. A merchant who already has a wallet needs no conversion story at all.
4. **Tech-adjacent Lagos businesses** — coffee shops, co-working, barbers near tech hubs. Not because the economics are best, but because the demo works and the feedback loop is fast.

Explicitly **not** first: food and market traders doing ₦500 tickets, where free instant NIP is unbeatable and the ticket cannot absorb any friction.

### What to demo on 12 October

- **A real Nigerian merchant, on camera, taking a real payment** — customer taps a Kova card on the Android terminal, merchant's balance updates, both get receipts, sub-second. Nigerian storefront, Nigerian merchant, real USDC.e on Tempo mainnet.
- **The naira frame:** the terminal shows ₦, the chain moves USDC.e. Say out loud that Kova does not convert and does not hold.
- **An agent payment** in the same session — an AI agent paying the same merchant through the same rail with a scoped access key. This is the thing no Nigerian competitor has and the thing Tempo is explicitly built for.
- **One honest slide on the wedge:** "A bank transfer in Nigeria is free and instant. Here is what it cannot do" → dollars, cross-border, agents, finality.
- **One honest slide on regulation:** the July 2026 Executive Order line putting non-security stablecoin payments under CBN, Kova's non-custodial design, and the CBN sandbox as the named next step. Judges reward a team that knows the regime better than they do.

### Why Nigeria beats a US pilot for judges

1. **Tempo's own positioning.** Tempo describes itself as a payments-first L1 incubated by Stripe and Paradigm, and names remittances, global payouts, microtransactions and agentic commerce as its use cases. A Nigerian merchant pilot demonstrates three of those four; a US coffee-shop demo demonstrates none of them credibly, because US merchants already have cheap instant card rails.
2. **The money is already moving there.** Nigeria is ~60% of sub-Saharan African stablecoin inflows, ~$22bn in stablecoin volume in one year, ~25.9m stablecoin users, #1 globally by stablecoin penetration. This is not a hypothetical market.
3. **The smart money agrees.** Circle Ventures invested in Flutterwave in July 2026 specifically to expand USDC settlement across Africa; Ripple invested within weeks; Tether invested in LemFi; Coinbase's Base app uses a Nigerian P2P engine. Every serious stablecoin player has an Africa position.
4. **Real merchants, real volume, real constraints.** A US demo is a simulation. A Lagos demo has to survive a grid collapse, a 15 Mbps cell connection, and a merchant who will stop using it on day two if it is worse than a bank transfer. That is a far stronger proof.
5. **The honesty is itself the differentiator.** Most hackathon stablecoin pitches claim to beat rails they have never measured. Kova can stand up and say "bank transfer is free and instant here, so here is the narrower thing we actually beat" — and be the only team in the room with a defensible claim.

### Open risks, ranked

1. **Flutterwave.** Already on Tempo, already holds the merchants, better capitalised, better regulatory standing. Kova's answer must be a segment Flutterwave's infrastructure-first model does not serve — the merchant who *wants to see and hold dollars*, and the agent payment.
2. **No Tempo off-ramp exists.** Until Fonbnk or Paycrest adds Tempo sell-side, every naira exit is a bridge plus a third party.
3. **NFC hardware on low-end Android**, and 70m dormant contactless cards as a cautionary precedent.
4. **The 1.5% conversion stamp duty**, if a lawyer reads it as catching more than token↔fiat.
5. **Regulatory drift.** An Executive Order is reversible; the SEC's August 2026 draft is aggressive; Nigeria's post-FATF-exit enforcement appetite is rising.
6. **The Lazerpay question.** 3,000 merchants and a working product were not enough. Measure repeat volume per merchant, not merchant count.

---

## Sources

All accessed 2026-09-20.

**Regulators and primary**
- SEC Nigeria, FinPort RI and ARIP programmes — https://sec.gov.ng/fintech-and-innovation-hub-finport/finport-programs-ri-and-arip/
- SEC Nigeria, registered fintech operators / RI and ARIP participants — https://sec.gov.ng/fintech-and-innovation-hub-finport/registered-fintech-operators/
- SEC Nigeria homepage (ISA 2025 assent notice) — https://sec.gov.ng/
- CBN circulars index — https://www.cbn.gov.ng/Documents/circulars.html *(CBN PDFs returned HTTP 403; circular contents below are from secondary reporting)*

**Law-firm and practice-guide analysis**
- Udo Udoma & Belo-Osagie, "CBN Regulatory Sandbox Cohort 2.0" (27 Aug 2026) — https://www.mondaq.com/nigeria/financial-services/1836036/
- Tope Adebayo LP, "Nigeria's New Crypto Tax Rules" — https://www.mondaq.com/nigeria/sales-taxes-vat-gst/1836300/
- Stren & Blan Partners, "Nigeria's New Virtual Asset (VA) Tax Regime" — https://www.mondaq.com/nigeria/tax-authorities/1831926/
- Chambers Fintech 2026, Nigeria chapter — https://practiceguides.chambers.com/practice-guides/fintech-2026/nigeria
- Iwa Salami, "Nigeria's new digital economy rules leave gaps in crypto regulation" (3 Aug 2026) — https://theconversation.com/nigerias-new-digital-economy-rules-leave-gaps-in-crypto-regulation-financial-law-expert-explains-288413

**Reporting**
- TheCable, Executive Order on Virtual Assets — https://www.thecable.ng/tinubu-signs-executive-order-on-virtual-assets/
- Mariblock, "Nigeria authorizes banks to open accounts for crypto companies" (22 Dec 2023) — https://mariblock.com/nigeria-authorizes-banks-to-open-accounts-for-crypto-companies/
- Nairametrics, "SEC sets N30 million registration fee, up to N2 billion capital for crypto firms" (22 Aug 2026)
- TechCabal, "Nigeria issues virtual asset tax guidelines" (3 Aug 2026) — https://techcabal.com/2026/08/03/
- TechCabal, "Flutterwave and stablecoins" (14 Sep 2026) — https://techcabal.com/2026/09/14/flutterwave-and-stablecoins/
- TechCabal, Lazerpay shutdown (13 Apr 2023) — https://techcabal.com/2023/04/13/crypto-and-web3-startup-lazerpay-shuts-down/ and (8 May 2023) https://techcabal.com/2023/05/08/inside-the-shutdown-of-lazerpay-the-web3-startup-that-was-high-on-hope-but-short-on-capital/
- TechCabal, Bundle Africa (21 Jul 2023) — https://techcabal.com/2023/07/21/bundle-africa-shuts-down/ ; Fluidcoins (17 Apr 2023) — https://techcabal.com/2023/04/17/fluidcoins-investors-get-return/
- Techpoint Africa, contactless payments adoption — https://techpoint.africa/insight/contactless-payments-adoption-challenges/
- WeeTracker, offline POS in Africa (5 Nov 2025) — https://weetracker.com/2025/11/05/how-offline-pos-works-africa-avadapay/
- Google News RSS aggregation (Reuters, Premium Times, Punch, Vanguard, TheCable, Nairametrics, Mariblock, BitKE, Techpoint, TechCabal, The Guardian Nigeria, LEADERSHIP, Daily Trust, Channels TV, Al Jazeera, africanews) for: the July 2026 Executive Order cluster (17–24 Jul 2026), FATF grey-list exit (24–27 Oct 2025), EU delisting (15–16 Jan 2026), SEC capital increases (16 Jan 2026), NRS tax guidelines (31 Jul–8 Aug 2026), CBN sandbox Cohort 2.0 (12 Aug 2026), Yellow Card ARIP (9 Sep 2026), Luno ARIP (3 Jul 2026), KuCoin CBN pilot (13 Sep 2026), OKX P2P restoration (9 Jul 2026), Binance/Nigeria case (to 9 Jul 2026), cNGN launch and listings (Feb 2025 – Aug 2026), eNaira task force (22 Oct 2025)

**Pricing and provider docs**
- https://paystack.com/pricing · https://flutterwave.com/ng/pricing · https://kuda.com/pricing
- https://docs.paycrest.io · https://noblocks.xyz · https://bitnob.dev · https://docs.cashramp.co · https://docs.fonbnk.com · https://docs.yellowcard.engineering · https://busha.io/business · https://kotanipay.com · https://onboard.xyz · https://onramp.money
- https://support.moonpay.com/customers/docs/moonpays-supported-countries (Nigeria unsupported)

**Data**
- StatCounter Nigeria: https://gs.statcounter.com/os-market-share/mobile/nigeria · /vendor-market-share/mobile/nigeria · /android-version-market-share/mobile/nigeria
- DataReportal, Digital 2026 Nigeria — https://datareportal.com/reports/digital-2026-nigeria
- NCC statistics — https://www.ncc.gov.ng/statistics-reports/subscriber-data
- Chainalysis Global Crypto Adoption Index 2023 / 2024 / 2025 — https://www.chainalysis.com/blog/2025-global-crypto-adoption-index/
- GSMArena model spec pages (Tecno, Infinix, itel — NFC verification)
- https://tempo.xyz and `docs/tempo/01-network-sdks-funding.md` (Tempo fees, finality, bridges, Routes)

### Could not verify

Published USDC→NGN percentage fees for any provider; per-provider NGN deposit/transaction limits; whether Flutterwave's Tempo USDC merchant settlement is live or announced-only; official Moniepoint/OPay/PalmPay merchant fee schedules (none publish one); Quidax's and Fincra's current crypto capability (sites blocked); the SEC August 2026 draft's retail caps and comment deadline in the draft text itself; the CBN 2021 and 2023 circulars in primary PDF form; NQR transaction volume (no published figure exists); any aggregate "% of Nigerian phones with NFC" statistic (no such metric is published); current NGN price per GB of data; the methodology behind the "70 million unused contactless cards" figure; USDT-vs-USDC split in Nigeria; final resolution of the Binance–Nigeria tax case; the eNaira's formal status beyond a single October 2025 headline.
