# Keys: who may spend a wallet's dollars

Ren's layer around the transfer is who may spend your dollars, how much, where and on whose
behalf. Keys make that a product. Every key that can spend a wallet short of the wallet itself is
a **Tempo access key on the owner's account**, so the chain itself enforces it:

- it can only call `transfer` or `transferWithMemo` on the one dollar (to listed payees, if any);
- it spends up to its limit each day or week, renewing on its own;
- it stops at its end date;
- freezing sets its limit to zero, and removing revokes it for good.

Ren never holds the owner's money or passkey, so it can't make a key or raise a limit. It can only
refuse to sign.

## Three kinds of key

| Kind | Who holds the key | What Ren adds |
|---|---|---|
| **Agent** (Claude, any AI agent) | Ren, sealed (AES-256-GCM under `KOVA_KEYS_MASTER_KEY`). The agent holds only a token. | A cap per payment, who it may pay, and asking the owner above a line. Every payment, refusal and question is logged. |
| **Allowance** (Mum, a staff member) | The person's own device: a non-extractable WebCrypto P-256 key in the browser, or a key in the iPhone's Keychain. | Only the invite: a one-time link. |
| **Ren Card** | The card's chip (Arx HaLo, secp256k1). | The till's lookup of whose wallet a card spends. |

## How an agent pays

1. **Create the key.** In Keys, "New agent key" sets the limit per day or week, the most one payment
   can be, the ask-first line, the end date and who it may pay. The passkey puts the key on Tempo
   through Ren's relay, at no cost. The agent's token is shown once.
2. **Connect it.** Claude Code needs one line:

   ```sh
   claude mcp add --transport http ren https://<api>/mcp --header "Authorization: Bearer ren_agent_…"
   ```

   The MCP tools are `ren_status`, `ren_pay`, `ren_pay_charge` (a Ren till's QR or pay link),
   `ren_fetch` (an API that charges over MPP), `ren_payment` and `ren_history`. The same actions
   are plain HTTP under `/v1/agent/*`.
3. **Paying.** Ren checks the rules before it signs with the key:
   - A payment over the ask-first line waits. The owner's Home turns watermelon ("Pay $1.50?"),
     and they approve or decline with their wallet's signature.
   - For MPP, Ren reads the price before paying anything. It only calls public `https` sites,
     never Ren's own network.

## Allowances

The owner makes an invite: who it's for, how much a week or day, and how long. It's a link
(`/a/<code>`) that opens the app if installed, and the web otherwise. The person accepts on their
own device, which makes the key there. The owner switches it on with their passkey. From then on
the person's Home shows "From Ada: $24 left", read straight from Tempo, and Send has
**From: Ada's allowance**. That spends the owner's dollars, signed by the person's key, with Ren
paying the fee.

## The Ren Card on Tempo

"Link a Ren Card" reads the chip and puts its key on Tempo with a daily limit. At a till, one NFC
tap does everything:
- reads the card;
- asks Ren whose wallet it spends (`GET /v1/key-cards/:id`);
- builds the payment from that wallet;
- has the chip sign the transaction's own digest.

The charge settles from its memo like any payment.

## Also on this branch

- **Naira** (`services/naira.ts`, Paystack):
  - Cash out to any Nigerian bank, from a quote at the market rate less a 1% spread. If the bank
    can't take it, the dollars come back.
  - Pay a shop in naira by card, bank transfer or USSD. The shop still gets dollars on Tempo.
  - On a Starter Paystack business, Paystack refuses payouts to other accounts, so cash-outs end
    refunded until the business is upgraded.
- **Private takings** (`services/private-pay.ts`): a customer pays into the shop's private
  balance on the zone, so Tempo doesn't show which shop. The zone drops the charge's memo, so the
  customer gives Ren the deposit's one-time sealing key. Ren opens that one deposit, checks it is
  for this shop and this amount, and settles the charge.

## Tests, on Tempo testnet

Run each against a local API on `:4400`:

```sh
pnpm --filter @kova/api keys:e2e     # agents (pay, cap, ask, MPP, MCP, freeze, revoke), allowances, card
pnpm --filter @kova/api naira:e2e    # rates, banks, account names, a cash-out, a naira checkout
pnpm --filter @kova/api private:e2e  # a private payment to a shop on Zone A, and the refusals
```
