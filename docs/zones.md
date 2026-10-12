# Private dollars on a Tempo Zone

Ren's wallet can keep a **private balance** on a [Tempo Zone](https://tempo.xyz/docs/protocol/zones):
a private chain anchored to Tempo, run by an operator, where balances and payments don't show on
Tempo's public explorer.

| | |
|---|---|
| **Move in** | An encrypted deposit from your Tempo balance into your private balance. |
| **Send privately** | The same deposit, addressed to someone else's private balance. |
| **Move out** | A withdrawal from your private balance back to your Tempo balance. |

**What stays private:** your private balance, and who you pay privately. The zone's private RPC
answers a wallet only about itself, after the wallet signs a token; a deposit's recipient is
encrypted to the zone's sequencer, so Tempo sees dollars going into the zone, and how many, not
who they are for.

**What doesn't:** the amounts moving into and out of the zone show on Tempo, and the zone's
operator can see inside it, like a bank. The wallet says so on the Private screen.

## How it works

The wallet side is [`apps/web/src/lib/wallet/zone.ts`](../apps/web/src/lib/wallet/zone.ts), on viem's
own zone actions (`viem/tempo`):

- **Deposits** are one Tempo transaction: `approve(portal, amount)` and
  `portal.depositEncrypted(token, amount, keyIndex, encrypted, refundTo)`. The recipient (and a memo)
  are encrypted with ECIES to the sequencer's key, which the portal publishes. Ren's fee payer
  sponsors exactly this pair, for the configured portal and an accepted dollar, with any bounce
  refunded to the sender ([`zone-deposit.ts`](../apps/api/src/tempo/zone-deposit.ts), tested in
  [`zone-deposit.test.ts`](../apps/api/test/zone-deposit.test.ts)).
- **Reading** goes through the zone's redacted RPC with an `X-Authorization-Token` the wallet signs
  (zone id, chain id, issued and expiry times). The token lives in memory, so after a reload the
  private balance is locked until the passkey opens it. The browser reaches the zone through
  `/api/zone`, which keeps the zone's address and any operator key on the server.
- **Withdrawals** are one zone transaction: `approve(outbox, amount)` and
  `outbox.requestWithdrawal(...)`. Gas in a zone is free. The sequencer settles them on Tempo in
  its next batch, a few seconds later.
- During Tempo's permissioned zone phase, transfers *inside* a zone are disabled, which is why a
  private payment is a deposit to the other person rather than a transfer between private balances.

## Status

Built, and tested end to end against a real zone node (below): a passkey wallet in Chrome moved
$5 in, sent $2 privately, and moved $1 back out, which landed on Tempo in about two seconds.

**It is off on the live site** until a testnet zone is open to Ren's users:

- Only the ZoneFactory's owner (Tempo) can create a zone on Moderato.
- Tempo's current preview zone accepts allowlisted accounts only (`AccountNotAllowed`).
- The older sandbox zones (A and B) use earlier portal interfaces and need an operator key.

The ask to Tempo: create a zone for Ren with access mode off and AlphaUSD enabled, with admin
`0xFb0B74E4d0890b16DD2FA07185acD6C03D3d34AE` and sequencer
`0x64461428cBaB83f51c348e9E7773D371CCE6f0e1`. Ren then runs it (below), or uses one Tempo runs.

That call is ready as an unsigned Safe Transaction Builder proposal for the factory's owner Safe
(`0x5FEDB95CDB5C512Fe93baf4D4F8c1b77f7767401`), written and simulated by
`tempo-xtask create-zone --safe-address … --safe-output …`. Simulated on 2026-10-12, it created
zone 4 with portal `0x5Ad0000000000000000000000000000000000004` (the id moves up if another zone
is created first).

## Switching it on

**Web** (the switch: unset, there is no Private card):

```bash
KOVA_ZONE_ID=…             # the zone's id
KOVA_ZONE_CHAIN_ID=…       # its chain id (1424310000 + id on Moderato)
KOVA_ZONE_PORTAL=0x5ad0…   # its portal on Tempo
KOVA_ZONE_RPC_URL=…        # its redacted RPC
KOVA_ZONE_RPC_AUTHORIZATION=…  # only if the operator requires a key
KOVA_ZONE_OPERATOR=Ren     # who runs it, as the wallet names them
```

**API:** `KOVA_ZONE_PORTAL` set to the same portal, so the fee payer sponsors deposits into it.

## Going live, once Tempo has created Ren's zone

With the Safe's execution transaction hash. The keys are in `~/.ren-zone/keys.env`.

1. **Genesis**, from the creation transaction (it reads Tempo's fork schedule, so it runs against
   Moderato, not Anvil):

   ```bash
   cd ~/tempo-zones && ./target/debug/tempo-xtask create-zone \
     --initial-token 0x20c0000000000000000000000000000000000001 \
     --sequencer 0x64461428cBaB83f51c348e9E7773D371CCE6f0e1 \
     --admin 0xFb0B74E4d0890b16DD2FA07185acD6C03D3d34AE \
     --output ~/.ren-zone/zone --creation-tx <EXECUTION_TX_HASH>
   cp ~/.ren-zone/zone/genesis.json ~/kova-tempo/infra/zone/
   ```

2. **The sequencer's encryption key**, without which deposits revert:

   ```bash
   set -a; source ~/.ren-zone/keys.env; set +a
   PORTAL=$(jq -r .portal ~/.ren-zone/zone/zone.json)
   ./target/debug/tempo-xtask set-encryption-key --l1-rpc-url https://rpc.moderato.tempo.xyz \
     --portal "$PORTAL" --private-key "$SEQUENCER_KEY"
   ```

3. **The node**, as a Railway service `zone` built from [`infra/zone`](../infra/zone), with a volume
   at `/data` (the only copy of the zone's ledger), variables `ZONE_SEQUENCER_KEY`, `ZONE_PORTAL`
   and `L1_RPC_URL=wss://rpc.moderato.tempo.xyz`, and a generated domain. Only the redacted RPC
   is exposed; the node's own RPC listens on localhost. The sequencer needs a little pathUSD on
   Moderato for batch fees (the faucet's is plenty).

4. **The switch**: the web variables above (`KOVA_ZONE_RPC_URL` is the zone service's domain,
   `KOVA_ZONE_CHAIN_ID` is `zone.json`'s `chainId`) and the API's `KOVA_ZONE_PORTAL`.

5. **Check** with `scripts/zone-e2e.ts` against Moderato and the zone (`ZONE_L1_RPC`, `ZONE_RPC`,
   `ZONE_ID`, `ZONE_CHAIN_ID`, `ZONE_PORTAL`, `ZONE_PARENT=42431`, and a `ZONE_FUNDER_KEY` holding
   AlphaUSD and pathUSD there), then in the wallet.

Rehearsed on 2026-10-12 against a local Tempo: the proposal's calldata created the zone from the
factory owner, and a node started with `infra/zone/start.sh`'s flags passed `zone-e2e.ts`, with
the operator RPC on `127.0.0.1` only and the redacted RPC the one public port.

## Running it locally

A local Tempo (Anvil in Tempo mode) with a zone Ren operates, from
[tempoxyz/zones](https://github.com/tempoxyz/zones) at `700069eb`. Needs Rust 1.95, `just`, and
Foundry 1.8 or newer.

```bash
git clone https://github.com/tempoxyz/zones ~/tempo-zones && cd ~/tempo-zones
git submodule update --init --recursive crates/contracts
cargo build -p tempo-xtask -p tempo-zone
(cd crates/contracts && forge build --skip test)

# A Tempo dev genesis whose ZoneFactory the Anvil dev key owns, seeded into Anvil's state.
mkdir -p .amp/deps .amp/state
./target/debug/tempo-xtask install-reference-zone-factory \
  --genesis ~/.cargo/git/checkouts/tempo-*/446e948/crates/chainspec/src/genesis/dev.json \
  --output .amp/deps/l1-genesis.json --owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
node .amp/runtime.mjs seed-l1
anvil --network tempo --hardfork t12 --chain-id 1337 --port 8545 --block-time 1 \
  --slots-in-an-epoch 1 --state .amp/state/l1.json --preserve-historical-states

# Anvil doesn't keep EIP-2935 block-hash history, which a zone needs to settle batches.
node ~/kova-tempo/apps/web/scripts/anvil-block-history.mjs

# The zone: AlphaUSD, open access, redacted RPC on 8544.
./target/debug/tempo-zone dev --l1.rpc-url ws://127.0.0.1:8545 --datadir .amp/state/zone \
  --dev.token 0x20c0000000000000000000000000000000000001
```

Then the protocol test, with two fresh wallets:

```bash
cd ~/kova-tempo/apps/web && pnpm exec tsx scripts/zone-e2e.ts
```

And the wallet itself, pointed at the local zone and its local Tempo:

```bash
KOVA_ZONE_ID=1 KOVA_ZONE_CHAIN_ID=$(jq .chainId ~/tempo-zones/.amp/state/zone/zone.json) \
KOVA_ZONE_PORTAL=0x5ad0000000000000000000000000000000000001 \
KOVA_ZONE_RPC_URL=http://127.0.0.1:8544 \
KOVA_ZONE_PARENT_RPC=http://127.0.0.1:8545 KOVA_ZONE_PARENT_CHAIN_ID=1337 \
pnpm exec next dev -p 3005
```

With `KOVA_ZONE_PARENT_RPC` set, deposits go to that chain directly and the wallet pays its own fee,
so fund the test wallet there (AlphaUSD to move, pathUSD for fees).
