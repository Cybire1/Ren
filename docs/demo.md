# Demo video: Kova on Monad (2:55)

Rules (§4, §9): 3 minutes at most, public (YouTube, Loom or Vimeo), the product in actual
operation, not mockups or slides, and showing Monad interactions. Every number on screen comes
from a transaction made during the take, and every key moment cuts to Monadscan.

Judges score product quality, technical excellence, Monad integration, track fit and impact; the
bounties we enter want cross-border payments in AUSD (Agora), Privy sign-in and payment, and a
CRE workflow (Chainlink). Each scene below names what it proves.

## Setup (the day before)

- **Phone:** the Kova iOS app. A real iPhone is best (Face ID, camera scanning). On the Simulator,
  scan scenes become a pay link and Face ID becomes the dev wallet: still the real app.
- **Laptop:** Chrome at mykova.app, signed in as the shop (Blue Door Coffee) in one window and as
  the friend abroad (Lucía, EUR) in another.
- **Fresh state:** a new wallet for Ada (NGN), Lucía's web wallet with a published note key, the
  café with a catalogue (flat white $4.50, croissant $3.00).
- **Rates:** publish a fresh Chainlink report within the hour before recording, so the label reads
  "Chainlink rate from a few min ago" (`cre workflow simulate kova-rates --target
  staging-settings --broadcast` from `apps/rates`).
- **Recording:** iPhone screen recording (or QuickTime on the Simulator) plus QuickTime on the
  laptop; 1080p, notifications off, battery full, Wi-Fi only. Voiceover recorded separately,
  calm and short.

## Script

| Time | Shot | Voiceover | Proves |
|---|---|---|---|
| 0:00–0:10 | Phone, Home. Thumb hovers over the balance. | "This is Kova: a dollar wallet with your shop inside it. No seed phrase, no gas token, and it settles on Monad in about a second." | Track fit |
| 0:10–0:28 | Delete-and-create: Welcome → name "Ada" → Face ID → Home. Add money → test dollars → coins rain, balance counts up to $5.00. | "Ada makes a wallet with Face ID. The passkey is the wallet: same passkey, same wallet, on the phone and the web." | Passkey wallet (Mera PRF), product quality |
| 0:28–0:55 | Laptop: café till, tap Flat white, QR appears. Phone: scan, Face ID, Paid: "0.9 s". Cut: Monadscan tx, fee paid by Kova's relayer. Till shows Paid, takings update. | "She pays the café: one tap, Face ID, paid in under a second. Monad finalises that fast, and gas is cheap enough for Kova to pay it for everyone." | Monad integration, sponsored gas, EIP-3009 |
| 0:55–1:30 | Phone: Send → Lucía → $20 → "Lucía sees ≈ €17.64" → review: Kovi's arc, "Chainlink rate from 4 min ago", note "Rent share 🏠" sealed → slide to send → sheet drops to Sent "1.02 s", balance behind counts down. | "Sending abroad is one sheet. Lucía thinks in euros, so Kova shows euros, at a rate Chainlink publishes on Monad. The note is sealed for the two of them." | Cross-border in AUSD (Agora), Chainlink CRE, private notes |
| 1:30–1:45 | Laptop: Lucía's web wallet. Activity shows +$20.00 with the lock; receipt shows "Rent share 🏠, sealed: only the two of you can read it". Cut: Monadscan, the same tx. | "It's there on her side, with the note. Kova only ever stored ciphertext." | Real-time, end-to-end encryption |
| 1:45–2:10 | Phone: Home → Open a shop → stall page → till keypad $3.00 → QR. Laptop: guest opens the pay link → Email (Privy) → paid. Page offers "Keep your $2.00 in Kova" → passkey → "$2.00 is in Kova, 1.3 s". | "Any wallet can be a shop. A customer without Kova pays with their email, then keeps their change in a Kova wallet of their own, in one step." | Shop in wallet, Privy, guest to Kova |
| 2:10–2:30 | Phone: shop takings for today, live. Then Add money → From another chain: EVM, Solana, Tron, Bitcoin. | "Takings land in the same wallet, live. And dollars from any chain arrive through Aurora Intents as Kova moves to mainnet." | Completeness, roadmap (Aurora) |
| 2:30–2:45 | Monadscan: KovaRates contract with the Chainlink report; the relayer's transactions. | "Everything you saw is on Monad: the payments, the sends, and the exchange rates." | Monad integration, CRE |
| 2:45–2:55 | Phone, Home, Kovi waves. Text: mykova.app. | "Kova. Tap, paid, anywhere. Try it at mykova.app." | Close |

## Rules for the edit

- No fake numbers: the times and amounts are whatever the take produced. If a send takes 1.4 s,
  say "about a second".
- Show the explorer at least three times (pay, send, rates).
- Keep each scene's cut on the moment money moves: the slide, the Face ID, the Paid.
- Captions for the key numbers ("0.9 s", "$0.00 fee", "€17.64"), large, in Kova's ink on paper.
- Export 1080p, under 3:00 including titles; upload public on YouTube; link it in the README and
  the submission.
