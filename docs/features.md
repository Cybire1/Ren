# Kova features and integrations

What Kova does, what it will do next, and the problem each piece solves. Every feature ships the same
way: a real problem first, a finished flow on the phone and the web, real on-chain proof, and screenshots
checked before it is called done. Status as of 1 October 2026.

## Built and live

| Feature | Integration | The problem it solves |
|---|---|---|
| Passkey wallet: Face ID, no seed phrase | Mera (WebAuthn PRF) | People lose seed phrases, and crypto wallets scare them |
| The same wallet on iPhone and at mykova.app | Mera + iCloud Keychain | One account everywhere, with nothing to log in to |
| Encrypted backup of name, contacts, settings | Mera's second, passkey-derived key | A lost phone means lost details |
| Gas-free payments and sends | Kova's relayer on Monad (EIP-3009) | Nobody should have to buy MON before paying for coffee |
| Paid in about 1.5 s | Monad | A checkout line can't wait |
| Prices in your own currency | Reference rates (fixed table today) | People think in naira and euros, not dollars |
| Your shop inside your wallet: stall page, catalogue, till, orders, takings | Kova API | A small shop needs a till without buying hardware |
| Shop sign-in on the web with the same passkey | Sign-In with Ethereum (EIP-4361) | Shop owners juggle passwords and API keys |
| Guest checkout with email or Google | Privy embedded wallets | A customer without Kova can't pay at the counter |
| $5 of test dollars a day | Kova's testnet treasury | Agora's testnet faucet is empty |
| Kova Travel: flights and hotels in dollars | Duffel | Paying abroad in dollars is hard |
| Snap your menu | Claude / DeepSeek | Typing a whole menu into a till is slow |
| Spending insights | TypeSafe's Jev | Knowing where the money went |
| Link previews, a way out of in-app browsers | mykova.app | Shared links looked bare; passkeys fail inside X |

## Next, in build order

Each one: the problem, what done means, how it is proven.

### 1. Paid in under a second · done
- **Result (1 Oct):** server relay 384–520 ms (was 514–704); tap to paid measured from Lagos 0.91–1.05 s (was 1.3–1.6 s). One round-trip to check (estimate with fees and a locally counted nonce alongside), a local signature, one `eth_sendRawTransactionSync`. Test dollars share the same send path, so the nonce has one owner.
- **Problem:** Monad finalises in about 0.6 s, but Kova's receipts show 1.3 to 1.6 s. The rest is our own round-trips.
- **Done:** measure every step of a payment (sign, request, simulate, submit, receipt), remove what isn't needed, and show "Paid" as soon as the chain has the transaction. The receipt shows the real time.
- **Proof:** five payments on testnet, timed end to end, before and after.

### 2. Send in one sheet · done
- **Result (1 Oct):** on iOS, one form sheet over Home sized to each step (who, amount with their currency, review with Kovi flying the arc from your face to theirs, slide to send, Sent with the measured time); it settles low at the end so Home's balance shows behind it, counting down. The web has the same sheet over the web wallet's Home (keyboard: Enter on the knob sends). Real testnet sends: iPhone simulator $2.50 in 1.27 s and $1.00 in 1.29 s (the wallet's chain balance went 5.00 → 1.50); web, headless Chrome with a passkey, $2.50 in 1.03 s.
- **Problem:** sending money takes several full screens; it feels slow before it is slow.
- **Done:** on iOS, one sheet over Home: person, amount (with their currency), review (you, Kovi's arc, them, $0.00 fee), slide to send, and the same sheet turns into "Sent" with the measured time, while the balance behind it drops live. Then the same on the web.
- **Proof:** screenshots of every step on the simulator and the web, and a real send on testnet.

### 3. Private payment notes · done
- **Result (1 Oct):** each wallet publishes an X25519 note key derived from its passkey's vault secret and signed by the wallet (senders check the signature, so Kova can't swap keys). A note is sealed on the sender's device twice, for the receiver and for the sender, bound to the transfer (from, to, amount, EIP-3009 nonce), and stored by Kova as ciphertext only. The app opens notes without Face ID (the key can't move money); the web keeps the key in memory, so after a reload notes are sealed until the passkey opens them. Proven on testnet: web → phone ("Puff-puff for the road") and phone → web ("Thanks Ada!") both open on the other side; the ciphertext Kova returns opens for neither a third wallet nor a different transfer. `pnpm --filter @kova/web check:notes` checks app/web interop; API tests cover the key and note routes.
- **Problem (was):** a note on a send stayed on the sender's phone, so the receiver never saw it; sending it through Kova in the clear would have let Kova read it.
- **Done:** notes are encrypted with a key derived from the sender's passkey (Mera PRF) and shared with the receiver, so only the two of them can read them. Kova stores ciphertext only.
- **Proof:** the database row shows ciphertext; both wallets show the note; a third wallet can't.

### 4. From guest to Kova · done
- **Result (1 Oct):** after paying a charge with email or Google (Privy), the pay page stays put and offers "Keep your $0.50 in Kova": one passkey makes a Kova wallet, the email wallet signs one EIP-3009 transfer of everything left into it (Kova's relayer pays the gas), the email wallet is signed out, and "Open my Kova wallet" lands on Home with the dollars there. Proven on testnet with a localhost stand-in for Privy's embedded wallet (`/pay/<id>?guest=dev`, localhost only): paid $4.50 of $5, moved the $0.50 in 1.29 s, Home showed $0.50. Not yet run with a real Privy email sign-in.
- **Problem:** someone who paid once as a guest (Privy, email) has a leftover balance they'll forget.
- **Done:** after a guest payment, "Keep your dollars in Kova": create a passkey wallet in one step and move the guest balance into it, gas paid by Kova.
- **Proof:** a guest wallet's balance arrives in a new Kova wallet on testnet.

### 5. Live exchange rates · done
- **Result (1 Oct):** `KovaRates` deployed to Monad testnet at `0x004D499A661756E0eFB972b38d9BAb6C2a538f93` (tx `0x67875eb9…`); the CRE workflow fetched both sources, agreed on NGN 1,328.41, KES 129.72, EUR 0.8821, GBP 0.7549, MXN 18.075, and wrote them on-chain (report tx `0xe0ebff46d1e1517554ab956769ddd4a0a108b85c866831d7663f63029598c51c`). The API reads the contract (`source: chainlink`), and the app shows "1 USD ≈ 1,328 NGN, Chainlink rate from 3 min ago". Reports are published with `cre workflow simulate --broadcast` until Chainlink enables DON deploy access for the account (`cre account access`), after which it runs every 15 minutes on its own.
- **Problem:** local prices come from a fixed table, labelled "reference rate".
- **Done:** deploy `KovaRates` on Monad testnet; the Chainlink CRE workflow (`apps/rates`) publishes rates from two sources with consensus; the API reads the contract; the app says "Chainlink rate from 4 min ago".
- **Proof:** the contract address, a report transaction, and the app showing a live rate.

### 6. Bring dollars from another chain · built, waiting on mainnet
- **Built (1 Oct):** Aurora Intents Persistent Addresses: each wallet gets one permanent deposit address per kind of chain (all EVM chains share one; Solana, Tron, Bitcoin), and what lands there (USDC, USDT, ETH, SOL, TRX, BTC) arrives on Monad as AUSD. App: Add money → From another chain (chain picker, QR, copy, share, live "coming in" list). Web: /wallet/add/chain. API: `GET /v1/wallets/:address/deposit-sources`, `POST …/deposit-address`, `GET …/deposits`, with Aurora's key on the server; on testnet they answer "mainnet only" and the screens say so. Unit-tested against Aurora's documented responses.
- **To prove it:** Kova on Monad mainnet, an Aurora Studio key (`AURORA_INTENTS_KEY`), Aurora's approval for persistent addresses, and a real deposit of a few dollars. Check that AUSD on Monad is a supported destination once NEAR's token list is back up (it was down, 1 Oct); otherwise set `AURORA_DESTINATION_ASSET`.
- **Problem:** crypto users already hold dollars on Base, Ethereum or Solana, and moving them to Monad is a chore.
- **Done:** "Add money → From another chain" with Aurora Intents (NEAR Intents): pick a chain and token, send, and AUSD arrives in the Kova wallet on Monad.
- **Proof:** a real cross-chain deposit, with both transactions linked.

### 7. Card top-up
- **Problem:** there is no way to put money into Kova with a card or bank.
- **Done:** "Add money → Card or bank" with Ramp Network, buying AUSD on Monad straight into the Kova wallet.
- **Proof:** a sandbox purchase landing in a Kova wallet.
- **Needs from you:** a Ramp Network partner key.

### 8. Cash out
- **Problem:** there is no way to take money out of Kova.
- **Done:** "Cash out" with Ramp's off-ramp, from AUSD on Monad to a bank or card.
- **Proof:** a sandbox off-ramp from a Kova wallet.
- **Needs from you:** the same Ramp key.
