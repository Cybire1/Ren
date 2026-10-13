# Demo video: Ren on Tempo (2:45)

The product in actual operation on the live site, on Tempo's Moderato testnet: every number on
screen comes from a transaction made during the take, and the key moments cut to Tempo's
explorer. Each scene names what it proves.

## Setup (before recording)

- **Shop:** Chrome on the laptop at https://web-production-acdb.up.railway.app, **Explore the demo
  shop**, so the dashboard and its tape are on screen.
- **Ada (the customer):** a phone browser at the same site, or a phone-sized Chrome window. Create
  the wallet on camera, or have it ready with **Add $5, free** done twice.
- **Lucía (the friend):** a second browser profile with her own Ren wallet, currency EUR. Copy her
  Ren link (Request → Share) so Ada can paste it.
- **Explorer:** a tab at https://explore.moderato.tempo.xyz for the cut-aways.
- **Recording:** 1080p screen recordings of each window, notifications off. Record the voiceover
  separately, calm and short.

## Script

| Time | Shot | Voiceover | Proves |
|---|---|---|---|
| 0:00–0:12 | Landing page hero, the receipt printing "Paid". | "Shops lose a cut of every card payment and wait days for the money. Ren turns any phone into the till, and it settles on Tempo in about a second." | Problem, track fit |
| 0:12–0:32 | Ada: Create my wallet → name → Face ID → Home. **Add $5, free**: the balance rolls up. | "Ada makes a wallet with Face ID. The passkey is the wallet: no seed phrase, and no gas token, ever." | Passkey wallet (P-256/WebAuthn), product quality |
| 0:32–1:02 | Shop: **Charge** $4.50 "Flat white" → QR. Ada: **Pay** → scan (or open the pay link) → Face ID → **Paid** with its time. Shop: the tape prints. Cut: explorer, the TIP-20 `transferWithMemo` with the charge's memo, the fee paid by Ren's fee payer. | "She pays the café. Paid in about a second. The memo ties the payment to the charge, so nobody holds the money in between, and Ren sponsors the fee." | TIP-20 memos, fee sponsorship, ~1 s finality |
| 1:02–1:22 | Ada: **Send** → paste Lucía's link → $20 → "Lucía sees ≈ €…" → slide to send → **Sent** with its time. | "Sending to a friend abroad is one sheet, in her own currency." | Cross-border dollars |
| 1:22–1:45 | Ada: Home → the dark **Private** card → **Show with passkey** → **Move in** $5 → "Out of sight". | "Some payments shouldn't be public. Ren keeps a private balance on a Tempo Zone, which Tempo's explorer can't see." | Tempo Zones |
| 1:45–2:15 | Ada: **Send** → Lucía → $2 → switch **Send privately** on → review ("Who knows: you and Lucía", "Tempo sees: $2.00 going in") → slide → **Sent privately**. Lucía: **Private** → "Arrived privately +$2.00". Cut: explorer, the deposit into Zone A's portal: an amount, no recipient. | "One switch makes it private. Lucía has it in her private balance. On Tempo, all anyone sees is two dollars going into the zone, not who they're for." | Encrypted deposits, private RPC |
| 2:15–2:30 | Ada: **Move out** $1 → "On its way back" → the balance chip "+$1.00 from Private". | "And it moves back to her balance in seconds." | Withdrawals settled on Tempo |
| 2:30–2:45 | Shop dashboard, today's takings with $0.00 in card fees. Text: the live URL. | "Ren. Tap, paid, anywhere. Try it live on Tempo testnet." | Close |

## Rules for the edit

- Real transactions only: no mockups, no slides. If a step is slow, cut it; don't speed it up.
- Keep the times Ren shows on screen; they are the proof.
- Every cut to the explorer shows the transaction the viewer just watched happen.
- Private needs the passkey once per visit to show the balance: keep that tap in, it's the point.
- Under three minutes, captions on for numbers.
