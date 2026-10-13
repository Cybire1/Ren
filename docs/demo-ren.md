# Demo video: Ren on Tempo (under 3:00)

Colosseum asks for the live product, not slides or code. Every number on screen comes from a
transaction made during the take, on Tempo's Moderato testnet. The new part is the moat: keys,
and an AI agent paying a shop within a limit Tempo enforces.

## Setup (before recording)

- **Shop:** Chrome on the laptop at the live site → **Explore the demo shop**, so the till and
  its tape are on screen.
- **Ada (the customer):** a phone-sized Chrome window on the live site. Make her wallet
  beforehand, with **Add $5, free** done twice, so she has $10.
- **Lucía (a friend abroad):** a second browser profile with her own Ren wallet, currency EUR.
  Copy her Ren link (Request → Share).
- **Claude Code:** a terminal, already logged in. Hide anything personal on screen.
- **Explorer:** a tab at https://explore.moderato.tempo.xyz for one cut-away.
- **Recording:** 1080p, notifications off. Record the voiceover separately: calm and short.

## Script

| Time | Shot | Voiceover |
|---|---|---|
| 0:00–0:10 | Landing page, the receipt printing "Paid". | "Shops lose a cut of every card payment and wait days for the money. Ren turns any phone into the till, settled on Tempo in about a second." |
| 0:10–0:35 | Shop: **Charge** $4.50 "Flat white" → QR. Ada: **Pay** → Face ID → **Paid** with its time. The shop's tape prints. | "Ada pays the café with Face ID. No seed phrase, no gas token: Ren pays the fee. Paid in about a second." |
| 0:35–0:50 | Ada: **Send** → paste Lucía's link → $10 → "Lucía sees ≈ €…" → slide → **Sent**. | "Sending to a friend abroad is one sheet, in her currency." |
| 0:50–1:15 | Ada: **Send** → Lucía → $2 → switch **Send privately** → slide → **Sent privately**. Cut: the explorer, a deposit into the zone with an amount and no recipient. | "One switch makes it private. On Tempo, all anyone sees is two dollars going into a zone, not who they're for." |
| 1:15–1:40 | Ada: Home → **Keys** → "Your dollars, your rules" → **New agent key**: "Shopping agent", $20 a day, $5 a payment at most, ask me above $1 → slide → Face ID → token and the one-line `claude mcp add`. | "Here's what Ren is really about: who may spend your dollars. Ada gives her AI agent its own key: twenty dollars a day, five a payment, and it asks her above one. Tempo enforces the limit. Not even Ren can raise it." |
| 1:40–2:10 | Terminal: paste the `claude mcp add` line. Shop: **Charge** $3.00 "Croissant", copy its pay link. Claude Code: "Pay this for me: <link>". Claude calls `ren_pay_charge` → Paid. The shop's tape prints. | "She connects Claude in one line. Claude pays the café's charge itself, and the till turns to paid like any customer." |
| 2:10–2:30 | Claude: "Now pay this one" (a $4.00 charge, over $1). Ada's Home turns watermelon: "Shopping agent asks: Pay $4.00?" → **Approve** with Face ID → Paid. | "Above her line, it has to ask. Ada says yes on her phone." |
| 2:30–2:45 | Ada: the key → **Freeze this key**. Claude tries again → "Refused: this key is frozen". | "And one tap freezes it. Its limit on Tempo goes to zero." |
| 2:45–2:58 | The shop dashboard: today's takings, $0.00 in card fees. Text: the live URL. | "Ren: payments where you decide who can spend. Live on Tempo testnet." |

## Rules for the edit

- Real transactions only: no mockups. If a step is slow, cut it; don't speed it up.
- Keep the times Ren shows on screen; they are the proof.
- The explorer cut shows the transaction the viewer just watched happen.
- Under three minutes, captions on for numbers.
