# Meeting: Chainlink (Noel Wilamowski, Ash)

Kova × Chainlink CRE. Goal: deploy access for Kova's CRE workflow, and confirm it meets the
Metropolis "Best workflow with CRE" bounty.

## The ask, first

1. **Deploy access** for organization `org_njnCdgkw9TdYBeBy` (shaibuafeez@gmail.com), so the
   rates workflow runs on a DON every 15 minutes. Today it's published with
   `cre workflow simulate --broadcast` from a laptop.
2. **Monad testnet on a DON:** is it supported for deployment today? Is
   `0xF8344CFd5c43616a4366C34E3EEE75af79a74482` the right production forwarder there?

## Kova in one line

A dollar wallet with your shop inside it, on Monad. People pay and get paid in dollars (AUSD),
but think in naira, shillings, euros, pounds and pesos, so every local price needs a rate people
can trust. Those rates come from Chainlink CRE, on Monad.

## What we built (2 minutes)

- **Workflow** (`apps/rates/kova-rates/main.ts`, TypeScript SDK): cron trigger every 15 minutes;
  each node fetches two independent sources (open.er-api.com and the fawazahmed0 currency API);
  a currency is dropped where they disagree by more than 2%; the DON agrees on the median, field
  by field; the report is signed and written to Monad with the EVM write capability.
- **Contract** `KovaRates` (Foundry, 6 tests): accepts reports only from the forwarder; a currency
  the sources disagree on keeps its last good rate; an older report can never move a price back;
  the owner can move the forwarder (simulation → DON).
- **On Monad testnet:**
  - KovaRates: `0x004D499A661756E0eFB972b38d9BAb6C2a538f93`
  - Deploy: `0x67875eb9dd2a48cdfb866383236cd6caeed21d4a95bef697f5157b14ac3e42b5`
  - Report (NGN 1,328.41, KES 129.72, EUR 0.8821, GBP 0.7549, MXN 18.075):
    `0xe0ebff46d1e1517554ab956769ddd4a0a108b85c866831d7663f63029598c51c`
- **In the product:** Kova's API reads the contract (`GET /v1/rates` → `source: chainlink`), and
  the app and web label every local price "Chainlink rate from 3 min ago". A $20 send to someone
  in Lagos shows "≈ ₦26,568".

## Show on screen

1. Monadscan: the KovaRates contract and the latest report transaction (publish a fresh one just
   before the call).
2. The app: a send review with "1 USD ≈ 1,328 NGN, Chainlink rate from N min ago".
3. The workflow code, if they want to look: consensus and the 2% cross-check.

## Questions

1. **Bounty:** does a workflow published by simulation with `--broadcast` qualify, or must it be
   deployed to a DON? Anything the judges look for that we should show in the demo video?
2. **Design feedback:** median per field plus the two-source cross-check. Would you add a third
   source, or use a Chainlink Data Feed alongside, for the major pairs?
3. **Mainnet:** is CRE live on Monad mainnet, for when Kova moves there?
4. **Next:** we'd like to use CRE for more than rates: settling payouts and confirming card or
   bank top-ups. Is that a good fit, and who should we talk to?

## After the call

- If deploy access is granted: `cre workflow deploy`, then `setForwarder(0xF834…4482)` on
  KovaRates, and the rates refresh every 15 minutes on their own.
- Record what they said here, and update docs/metropolis.md (bounty row).
