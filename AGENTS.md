# AGENTS.md

A map of Ren for AI agents and reviewers: what it is, where each part lives, where Tempo is
load-bearing, and how to check all of it. The story is in [README.md](README.md); decisions and
their reasons are in [DECISIONS.md](DECISIONS.md); what's coming is in
[docs/parity-plan.md](docs/parity-plan.md).

## Ren in five lines

- A dollar wallet and a shop till in one app, on **Tempo**. Balances and payments are a
  dollar stablecoin (AlphaUSD on testnet).
- **Payments are signatures.** The payer signs a TIP-20 `transferWithMemo`; Ren's fee payer adds
  its signature for the fee, so nobody holds a gas token. The memo names the charge.
- **Wallets are passkeys** (Face ID): the key comes from the passkey through WebAuthn PRF. No seed
  phrase.
- **Every key that spends** (an AI agent over MCP, a person's allowance, a Ren Card) is a Tempo
  access key on the owner's account, with a limit per period, a scope and an expiry that Tempo
  enforces. That key layer is Ren's edge.
- **Private dollars** live in a Tempo Zone (Tempo's testnet Zone A).

## Repo map

Internal names keep `kova` on purpose (`@kova/*` packages, `KOVA_*` variables, the
`Kova-Signature` webhook header): only what people see says Ren.

| Path | What it is |
|---|---|
| `apps/api` | The Ren API: Hono on Node 22, Postgres via Drizzle. Entry `src/index.ts`; one route file per area in `src/routes`. |
| `apps/api/src/chains` | The chain kit: `tempo.ts` (the default) and `monad.ts`, picked by `KOVA_CHAIN`. Tokens, transfer indexing, payment checks. |
| `apps/api/src/tempo` | Tempo only: the fee-payer relay (`relay.ts`, viem's `Relay`), what it pays for (`sponsorship.ts`), zone deposits, history. |
| `apps/api/src/services/keys.ts`, `agents.ts` | Keys: agents (sealed by Ren, used over MCP), allowances, cards; limits read from Tempo. |
| `apps/api/src/workers` | `watcher.ts` reads finalized blocks and settles charges by memo; `webhooks.ts` delivers merchant webhooks. |
| `apps/web` | Ren's site: Next.js 16, React 19. The web wallet (`src/components/wallet`), shop mode (`/dashboard`), pay pages (`/pay/:id`), stalls (`/s/:slug`). Every API call is made server-side. |
| `apps/mobile` | The iPhone app: Expo SDK 54, expo-router screens in `src/app`, UI in `src/ui`, logic in `src/lib`. Installs with **npm**, outside the pnpm workspace. |
| `packages/tempo` | Tempo logic shared by the API, web and app: networks, tokens, the 32-byte memo, payment checks, key terms. |
| `packages/db` | Drizzle schema (`src/schema.ts`) and SQL migrations (`drizzle/`), applied when the API starts. |
| `packages/monad`, `apps/card`, `apps/rates` | The Monad build Ren grew from (`KOVA_CHAIN=monad`). Ren on Tempo doesn't use them. |
| `docs` | Tempo research (`docs/tempo`), keys, zones, the brand, and the parity plan. |

## Where Tempo is load-bearing

1. **Payments with no gas token:** the payer signs, `apps/api/src/tempo/relay.ts` adds the fee
   payer's signature after `sponsorship.ts` checks it's exactly a Ren charge or a send.
2. **Settlement by memo:** `packages/tempo/src/memo.ts` and `payment.ts`; the watcher and
   `services/settle.ts` settle a charge from the on-chain `TransferWithMemo`, whoever sent it.
3. **Limits on every key:** `packages/tempo/src/keys.ts` (terms: limit, period, payees, expiry)
   and Tempo's Account Keychain; freezing sets a key's limit to zero, removing revokes it.
4. **Agents over MCP and MPP:** `apps/api/src/routes/mcp.ts` (`ren_pay`, `ren_pay_charge`, …) and
   `routes/mpp.ts` (Ren shops take payment from any MPP client).
5. **Private dollars:** Tempo Zones (`docs/zones.md`): sealed deposits, a private RPC per wallet.

## Check it

You need Node 22 (`.nvmrc`), pnpm 10 and PostgreSQL 16. CI (`.github/workflows/ci.yml`) runs
exactly this on every push:

```bash
pnpm install                         # also builds packages/*
pnpm typecheck                       # every workspace package
pnpm lint                            # Biome; `pnpm format` fixes formatting
pnpm --filter "./packages/*" test    # unit tests of the shared packages
DATABASE_URL=postgres://localhost:5432/ren_test pnpm --filter @kova/api test
NEXT_PUBLIC_KOVA_CHAIN=tempo pnpm --filter @kova/web build
(cd apps/mobile && npm ci && npx tsc --noEmit)
```

Live checks on Tempo testnet (they need a funded fee payer in `apps/api/.env.tempo`; `pnpm
--filter @kova/api setup:dev` makes one): `pnpm --filter @kova/api test:e2e` (payments through
the relay), and against a running API on :4400, `keys:e2e`, `agent-charge:e2e`, `private:e2e`,
`naira:e2e`.

## Conventions

- TypeScript, strict, everywhere. Biome formats (2 spaces, single quotes, no semicolons, 100
  columns) and lints with its recommended rules; every `biome-ignore` carries its reason.
- Money is integer base units: every TIP-20 has 6 decimals, so `1_000_000n` is $1.00. Never floats.
- Creating a charge takes an `Idempotency-Key`; a charge settles only from a transfer read on Tempo.
- Secrets are never committed. Each app's `.env.example` lists its variables; production values
  live in Railway.
- Copy says "dollars" and where money went, in plain words. Never "real dollars".

## What's live, and what isn't

- **Live on Tempo testnet:** payments and checkout, shops and tills, stalls with tables and stamp
  cards, sends and requests, Keys (agents over MCP, allowances, Ren Cards), MPP, private dollars on
  Zone A, private takings, naira through Paystack (test mode).
- **Coming, in [docs/parity-plan.md](docs/parity-plan.md):** OUSD, dark mode, subscriptions,
  splits, payroll, basic phones as keys, send by link, offline payments, partner on- and
  off-ramps, and mainnet.
