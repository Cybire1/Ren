# Kova rates: a Chainlink CRE workflow on Monad

Kova settles every payment in dollars (AUSD on Monad) and shows prices in the money people think
in: naira, shillings, euros, pounds and pesos. This is where those reference rates come from.

Every 15 minutes, each node of a Chainlink DON:

1. fetches two independent sources ([open.er-api.com](https://open.er-api.com) and the
   [fawazahmed0 currency API](https://github.com/fawazahmed0/exchange-api)),
2. cross-checks them, dropping any currency where they disagree by more than 2%,
3. and the DON agrees on the median of what its nodes saw, field by field.

The agreed rates are signed into a report and written to [`KovaRates`](contracts/src/KovaRates.sol)
on Monad. Kova's API reads the contract (`GET /v1/rates`), the app and the web show local prices
with it, and Kova Travel prices fares with it. A currency the sources disagree on keeps its last
good rate, and an older report can never move a price backwards.

## Layout

- `kova-rates/main.ts`: the workflow (cron trigger, HTTP with consensus, report, EVM write).
- `contracts/`: `KovaRates`, its tests and a deploy script (Foundry).
- `project.yaml`: Monad testnet RPC for the CRE CLI.

## Run it

```bash
# Once: the CRE CLI and a Chainlink account (the CLI needs one even to simulate)
curl -sSL https://app.chain.link/cre/install.sh | bash
cre login

# Contract tests, and deploy (needs testnet MON on the deploying key)
cd contracts && forge install foundry-rs/forge-std --no-git && forge test
forge script script/Deploy.s.sol --rpc-url monad_testnet --private-key $CRE_ETH_PRIVATE_KEY --broadcast

# Put the deployed address in kova-rates/config.*.json as "receiver", then from apps/rates:
cd kova-rates && bun install && cd ..
cre workflow simulate kova-rates --target staging-settings --broadcast
```

`--broadcast` writes the report to Monad through CRE's simulation forwarder
(`0xB9F79d863261869B234c481D1f9A7af84AeAd192`, which the deploy script sets). For a DON
deployment, `setForwarder(0xF8344CFd5c43616a4366C34E3EEE75af79a74482)` moves delivery to Monad
testnet's production forwarder. `CRE_ETH_PRIVATE_KEY` goes in `apps/rates/.env` (gitignored).

Then set `KOVA_RATES_ADDRESS` on the API.
