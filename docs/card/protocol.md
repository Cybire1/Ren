# Kova Card: applet protocol

The Kova Card is a JavaCard (secure element) holding a P-256 key that Tempo knows as an
**access key** on the cardholder's account. The private key is generated on the chip and never
leaves it, so a card cannot be cloned by copying it — only by breaking the element.

This is the contract between the terminal (`react-native-nfc-manager`, ISO-DEP) and the applet.
It is the thing to implement first on real hardware, because everything above it is already
proven in software (`packages/tempo/src/card.ts`, exercised on testnet).

> Status: **specification**. No applet is written yet. Numbers here are choices, not findings;
> the Tempo-side facts they rest on are in `docs/tempo/02-transactions-accounts-keys.md`.

## Why the card does not just sign anything

A card that signs whatever it is handed is a card anyone with a reader can spend from, up to
its on-chain limit. Tempo's own protections (per-period spending limit, call scoping, expiry)
bound the damage but do not prevent it, and Kova refusing to pay the gas does not stop it
either: anyone can sponsor a signed Tempo transaction.

So the applet requires a **Kova approval** alongside every signing request: a P-256 signature
from Kova's approval key over the exact digest, bound to a counter the card keeps. The card
verifies it on-chip before signing (D-007).

What this buys:

- **Kova's policy cannot be bypassed.** A rogue terminal gets nothing without Kova's approval.
- **Freezing is instant and off-chain.** Kova stops approving. It needs no key over the user's
  account, so Kova stays non-custodial.
- **On-chain limits remain the backstop** if Kova's approval key is ever compromised.

The cost: the terminal must be online at tap time, which it must be anyway to broadcast.

## Identifiers

| | Value |
|---|---|
| AID | `F0 4B 4F 56 41 31` (`F0` proprietary prefix, then "KOVA1") |
| Curve | NIST P-256 (secp256r1) |
| On-card signing | `ALG_ECDSA_SHA_256` — the card SHA-256-hashes the input, then signs |
| Signature out | DER `30 L 02 Lr R 02 Ls S`, `s` not normalized |

The terminal must convert that DER to raw `r ‖ s`, normalize `s` to the low half, and set
`pre_hash = 1` in the Tempo envelope. `packages/tempo` does this in `normalizeCardSignature`.

## Commands

All commands are sent after `SELECT` by AID. `P1`/`P2` are `00` unless stated.

### `GET STATUS` — `80 10 00 00 00`

Returns card state, for provisioning and support.

```
Response: version(1) ‖ state(1) ‖ counter(4, big-endian) ‖ pinTriesLeft(1)
state: 0x00 uninitialized · 0x01 ready · 0x02 locked (PIN exhausted)
```

### `GENERATE KEY` — `80 20 00 00 00`

Generates the on-card P-256 keypair. Only valid while `state = uninitialized`, and only over a
provisioning session (see Provisioning). Returns the public key so Kova can register it as an
access key.

```
Response: 04 ‖ X(32) ‖ Y(32)
```

### `GET PUBLIC KEY` — `80 21 00 00 00`

```
Response: 04 ‖ X(32) ‖ Y(32)
```

### `SIGN` — `80 30 00 00 Lc [ digest(32) ‖ approval(64) ] 00`

The only command that produces a payment signature.

- `digest` — the keychain-v2 digest the cardholder's Tempo account expects:
  `keccak256(0x04 ‖ sigHash ‖ userAccount)`. The terminal never computes this itself; it comes
  from Kova, which built and checked the transaction.
- `approval` — Kova's P-256 signature (raw `r ‖ s`) over `digest ‖ counter`, where `counter` is
  the card's current counter as 4 big-endian bytes.

The applet:

1. verifies `approval` against the Kova approval public key stored at provisioning;
2. increments its counter (so an approval is single-use and cannot be replayed);
3. signs `digest` with `ALG_ECDSA_SHA_256`;
4. returns the DER signature.

```
Response: DER signature ‖ counter(4)
Errors: 6982 approval invalid · 6985 not ready · 6983 locked
```

### `VERIFY PIN` — `80 40 00 00 Lc [ pin(4–8 ASCII) ]`

Optional, for amounts over a threshold. Follows the chip-card convention: the PIN is checked on
the card, never sent to Kova, and three failures lock the card until a provisioning session
unlocks it. When the card is locked, `SIGN` refuses.

## Provisioning

Card personalization happens once, over a contact or contactless reader attached to a Mac
(`ACR1252U`), not at a terminal:

1. Change the card's GlobalPlatform keys from the supplier defaults. **A card left on default
   keys can be reprogrammed by anyone.**
2. Install the applet.
3. `GENERATE KEY`, and store Kova's approval public key on the card in the same session.
4. Register the returned public key as a Tempo access key on the cardholder's account, signed
   by their passkey: expiry, a per-period spending limit, and a scope of
   `transferWithMemo` on the settlement token.
5. Record the card in Kova's `credentials` table with its key id and the transaction that
   authorized it.

## What a tap looks like end to end

1. Terminal reads the card's public key and asks Kova to prepare a payment for the open charge.
2. Kova checks its policy, builds the Tempo transaction, derives the digest, signs the approval,
   and returns both.
3. Terminal sends `SIGN(digest, approval)`; the card returns DER.
4. Terminal returns the signature to Kova, which normalizes it, attaches the fee-payer
   signature, and broadcasts.
5. Receipt verified, charge marked paid, terminal shows PAID.

Two round trips to Kova and one card exchange. The card work itself is a few hundred
milliseconds; the rest is the ~1.1s payment path already measured.

## Open questions for real hardware

1. Does the target card support `ALG_ECDSA_SHA_256` **verification** on-chip for the approval
   check, and what does that add to tap latency?
2. Actual APDU round-trip time on a phone versus a dedicated reader.
3. Whether the supplier ships cards with known GlobalPlatform keys (unfused), which
   personalization requires.
4. Counter persistence guarantees across a torn tap (card removed mid-command).
