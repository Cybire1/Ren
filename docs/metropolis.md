# Monad Metropolis: what the judges want, and where Kova stands

From the Metropolis Hackathon Rules & Guidelines (version 3.0, 3 September 2026) and the hackathon
dashboard, copied on 28 September 2026. Times are Nigeria time (WAT, GMT+1) unless marked.
The rules can change: check the dashboard before submitting.

## Dates

| What | When |
|---|---|
| Build window | 1 Sep to 14 Oct 2026 |
| Submissions open | 2 Oct 2026, 04:59 WAT |
| **Deadline** | **13 Oct 2026, 11:59 PM ET = 14 Oct 2026, 04:59 WAT.** Late submissions are rejected. A submission can be edited until the deadline; the version recorded at the deadline is the one judged. |
| Judging | 14 to 27 Oct (the dashboard shows 14 Oct to 3 Nov) |
| Winners | 3 Nov (the dashboard shows "from 4 Nov" in WAT) |

## Prizes

- **Overall winner: $25,000**, the most standout project across all tracks.
- **Track prizes: $30,000 per track**, $10,000 to each of the top three projects in the track.
- **Sponsor bounties** on top, each with its own terms (see below). The website quotes a $250,000+
  pool including bounties; the rules count $145,000 for the main prizes.
- One project per participant, entered in **one track only**. A project can't win more than one
  main track prize. The rules don't say whether the overall prize stacks with a track prize: ask.
- Paid in USDC to the team's designated contact's wallet, within 30 days. KYC may be required.
  Taxes are ours.

## Our track: Track 02, Consumer Products & Payments

> Products whose primary user is a consumer who may not identify as a crypto user, and whose core
> value is a financial experience rather than a trading or market making product.

Kova fits it closely: a dollar wallet opened with a passkey, no seed phrase, gas paid by Kova,
payments in about 1.5 seconds, and a shop inside the wallet. The user never sees "crypto".

## How we're judged

**All tracks, 20% each:**

| Criterion | What it means for Kova | How we show it |
|---|---|---|
| Product quality & completeness | Every flow works end to end, on the phone and the web | Real-device demo: create wallet, add money, pay, send, open a shop, sell, see takings |
| Technical excellence | Clean architecture, tests, security | Signed payments (EIP-3009), sponsored gas, passkey-derived keys, EIP-4361 sign-in, API tests including on-chain end-to-end |
| Monad integration | Monad is load-bearing, not decoration | Payments settle on Monad in ~1.5 s, sponsored gas is affordable because Monad is cheap, KovaRates written by Chainlink CRE on Monad; contract addresses and tx hashes in the README |
| Track fit & problem relevance | A consumer who doesn't think of it as crypto | No seed phrase, no gas token, prices in local currency, cross-border in seconds |
| Innovation & impact | Why this matters beyond the demo | One passkey for wallet and shop; cross-border dollars for people and small merchants |

**Sponsor bounties:** adherence to the bounty's published requirements 40%, technical
implementation 30%, Monad integration 20%, innovation 10%.

## Submission checklist (mandatory)

Status as of 28 Sep 2026.

| # | Requirement (rules §4, §9) | Kova today | To do |
|---|---|---|---|
| 1 | **Public GitHub repository**, and public "throughout and after the Hackathon" | `github.com/Cybire1/kova` is **private**; the `monad` branch isn't pushed | Scan the history for secrets, push `monad`, make the repo public |
| 2 | Complete source code | In the repo | Commit everything (work is uncommitted right now) |
| 3 | README with setup instructions | Root README describes the **Tempo** build | Rewrite for Monad (see §Documentation) |
| 4 | Open source licence (MIT, Apache 2.0, GPL, BSD) | **None** | Add a `LICENSE` (MIT suggested) |
| 5 | Clear attribution of external code and libraries | Not written | Add an attributions section (Mera, viem, Expo, Next.js, Hono, Drizzle, Privy, Remotion, Kovi art, ...) |
| 6 | Commit history covering the build window | First commit 19 Sep 2026, inside the window | Keep committing through to the deadline |
| 7 | Pre-existing components identified in the README | Kova started as a Tempo build for Colosseum (branch `main`) | Say so, and list what the Monad build added |
| 8 | **AI coding tools disclosed in the README** | Not written | Disclose that Kova was built with Claude Code |
| 9 | **Demo video, 3 minutes max**, public (YouTube, Loom, Vimeo), the product in actual operation (not mockups or slides), showing Monad interactions | The 40 s teaser is animated from screenshots: fine for X, not the demo | Record a real-device demo, under 3:00, with the explorer showing the transactions |
| 10 | Monad integration explained, **contract addresses or tx hashes**, deployed to Monad testnet or mainnet, why Monad | Live on testnet; addresses and hashes known (below) | Write it up in the README |
| 11 | Documentation: project description, architecture overview, tech stack, setup/deployment instructions | Partial | Write it |
| 12 | Code a third party can run by following the README | Fresh clone from GitHub tested 1 Oct: install, API (setup, start, 31 tests), web (pages load), iOS (install, typecheck); fixed the missing package build | Re-run before submitting |
| 13 | Problem statement and intended user | Not written for Monad | Write it |
| 14 | Submit through the hackathon website; pick the track and bounties | Dashboard: 3 of 5 steps done; "Select tracks & bounties" is next | Select Track 02 and the bounties below; submit when submissions open (2 Oct) |

## Monad integration: what to cite

| What | Address or hash (Monad testnet, chain 10143) |
|---|---|
| AUSD (Agora), every payment's token | `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` |
| Kova relayer (pays everyone's gas) | `0x5868C3C3D1316AF8a78D2e47ee9F385272771940` |
| KovaRates (Chainlink CRE writes FX rates) | `0x004D499A661756E0eFB972b38d9BAb6C2a538f93`; report `0xe0ebff46d1e1517554ab956769ddd4a0a108b85c866831d7663f63029598c51c` |
| A coffee, $4.50, paid in 1.6 s, fee $0.00 | `0x6a52a3cfc7ecdf6400d7d09888e6ef2cf06bd38c2121619a5007d62eda34e005` |
| $20 to a friend, arrives as €18.40 | `0xa92a17331a4804556b08779949819220b56aef075c7ada8b5e4c3136b61e0437` |
| A bakery sale, $6.50 | `0x152be347b25c3b89a1e70607d7e8d3cb3cd1721adcc3931ac31e784e1f151265` |

Explorer: `https://testnet.monadscan.com/tx/<hash>`. Why Monad: payments land in about a second,
and gas is cheap enough for Kova to pay it for every user, which is what makes a consumer product
with no gas token possible.

## Sponsor bounties to enter

Each bounty has its own requirements on the hackathon site. Read them, since adherence is 40% of
the bounty score.

| Bounty | Prize | Fit | To do |
|---|---|---|---|
| Agora: Best Cross-Border Payments App | $10,000 | Strong: everything settles in AUSD; a $20 send arrives as €18.40 | Show cross-border in the demo; testnet AUSD asked of Drake Evans |
| Privy | $5,000 | Email and Google sign-in and payment on the web | Show it in the demo |
| Chainlink: Best workflow with CRE | $3,000 | `apps/rates` CRE workflow writes FX rates to `KovaRates` on Monad testnet; the live API reads them and the app labels them | Request DON deploy access (`cre account access`) so it runs every 15 minutes |
| Mercuryo | not published | Only MON on Monad; no AUSD or USDC there yet | Question sent to Arthur (CBO); decide on the ramp after his answer |

## Keep out of the submission (rules §5.3)

Submissions are **non-confidential**. Judges and mentors include investors and builders who may
build or fund similar products, and owe us nothing for it.

- No private keys, credentials or `.env` files. They're gitignored; scan the history before making
  the repo public.
- No real personal data. The demo people (Ada, Tomás, Blue Door Coffee) are fictional.

## Grounds for disqualification to avoid

- Submitting late, or missing any mandatory component.
- Copying code without attribution, or forks without substantial original work.
- False or misleading information. Every number in our demo must come from a real transaction.
- Malicious code, exploits or backdoors.

## Questions for the organizers

- Does the overall prize stack with a track prize, and do sponsor bounties stack with both?
- Kova is also entered in Colosseum (Tempo build). The rules don't forbid it; confirm, and disclose it.
