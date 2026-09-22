# Kova

Stablecoin payments for real shops. One network behind a card, a terminal, an app and an API —
settling on [Tempo](https://tempo.xyz) in about a second, for a fee of roughly $0.00003.

Kova is non-custodial: money moves from the customer's account to the merchant's, and Kova
never holds it. What Kova provides is the authorization layer — who may spend, how much, where,
and on whose behalf — plus the gas, so nobody needs a gas token to pay for lunch.

> Built for Colosseum's Crypto World's Fair (Tempo track). Pilot market: Nigeria.

## Why it exists

Nigerian bank transfers are instant and free, so Kova is not pitched as cheaper or faster money.
It is for the things naira rails cannot do:

- **Holding dollars.** 25.9m Nigerians already hold stablecoins; a bank transfer cannot.
- **Money arriving from abroad**, where Nigeria is around 60% of sub-Saharan stablecoin inflows.
- **No merchant fee**, against 1.5% + ₦100 on card rails.
- **Payments by software.** An AI agent gets the same kind of spending credential as a person:
  a limited key with a budget, a merchant allowlist, and approval above a threshold.

## How a payment works

```
customer taps card / scans QR / an agent calls the API
        │
        ▼
Kova checks its policy, builds the transfer, sponsors the fee
        │
        ▼
Tempo settles it (TIP-20 transferWithMemo, ~0.56s blocks, deterministic finality)
        │
        ▼
Kova verifies the receipt, marks the charge paid, the merchant's screen flips to PAID
```

Every payment carries a 32-byte memo holding the charge's id, which is how an on-chain
transfer is matched to an order without Kova sitting in the middle of the money.

**A card, a phone and an agent are the same thing here:** a P-256 key registered as a Tempo
access key on the user's account, with an expiry, a spending limit and a scope.

## What is in the repo

| Path | What it is |
|---|---|
| `packages/tempo` | Tempo primitives: networks, tokens, the Kova memo, receipt verification, card signatures |
| `packages/db` | Postgres schema, migrations, client |
| `apps/api` | Payment intents, the sponsored relay, settlement, the chain watcher |
| `apps/web` | Merchant dashboard, charge screen, customer pay page |
| `apps/mobile` | Kova Pay and Kova Terminal (Expo) |
| `docs/tempo` | Research the build rests on, measured against live Tempo |
| `docs/card` | The card applet protocol |
| `docs/market` | Nigeria: regulation, naira, competition |
| `DECISIONS.md` | Why things are the way they are |

## Running it

Needs Node 22+, pnpm and a local Postgres.

```bash
pnpm install
createdb kova_dev
pnpm --filter @kova/db migrate

# a testnet fee payer, funded from the faucet, plus a demo merchant and an API key
pnpm --filter @kova/api setup:dev

pnpm --filter @kova/api dev     # :4000
pnpm --filter @kova/web dev     # :3000
```

Then open the dashboard, start a charge, and pay it:

```bash
pnpm --filter @kova/api pay:open
```

The charge screen flips to PAID on its own.

## Tests

```bash
pnpm test
```

Unit tests cover the memo format, amount parsing, receipt verification and card signature
handling. The end-to-end tests run against Tempo's Moderato testnet using its public faucet and
sponsor, and prove the real path: a sponsored payment settles and verifies, a card access key
with a daily limit pays, freezing it blocks the next tap, and a payment Kova never submitted is
still picked up by the watcher.

```bash
pnpm --filter @kova/tempo test:e2e
pnpm --filter @kova/api test
```

## Measured, not estimated

On Moderato, 2026-09-22:

| | |
|---|---|
| Payment, end to end through Kova's relay | 1.07–1.18s |
| Gas for a payment | 51,495 (≈ $0.00003 on mainnet) |
| Gas for a merchant's first ever payment | 300,795 (≈ $0.0002) |
| Card-signed payment | 83,782 gas |

## License

Apache-2.0.
