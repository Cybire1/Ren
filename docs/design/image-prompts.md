# Kova image prompts

Every illustration the app uses, as prompts for an image model. Generate each image with the
**style block** pasted in front of its prompt, so the whole set looks like one artist drew it.

## How to generate

- Paste the style block, then one image prompt.
- Generate the **Kovi character sheet (01) first**. Attach it as a reference image to every
  prompt that includes Kovi, so he looks the same everywhere.
- Export PNG with a **transparent background**. If the model can't do transparency, ask for a
  pure white `#FFFFFF` background and remove it afterwards (remove.bg, or Photoshop's Select Subject).
- **No text in any image.** Amounts, names and card numbers are drawn by the app on top.
- Save each file under `apps/mobile/assets/art/` with the filename given.

## Style block (paste before every prompt)

> Flat 2D cartoon illustration in a friendly, hand-drawn sticker style. Bold, even black ink
> outlines (#0D0D12) of about 6px at 1024px, with rounded line ends and corners. Flat fills only:
> no gradients, no textures, no 3D shading, no drop shadows, no glow. At most one small white
> highlight stroke on round shapes. Palette only: periwinkle #A7B6F7, light periwinkle #DCE2FB,
> orchid #E5A8F0, deep orchid #C77FD9, mustard #EAC45E, tangerine #F09A48, mint #6FD3A0,
> blush #F4A7A0, white #FFFFFF, ink #0D0D12. Simple, chunky, joyful shapes, like a modern
> fintech mascot sticker. Centered subject, generous empty margin, transparent background.
> No text, no letters, no numbers, no logos, no watermark.

## The mascot: Kovi

Kovi is a round gold coin with a face. Mustard body with a black outline, and a thin dotted
inner ring just inside the rim. Two tall oval black eyes, each with a tiny white shine dot.
Round blush cheeks. A small open smile. Thin black stick arms ending in small round mustard
hands, and short stick legs ending in black oval shoes. One short white highlight arc at the
top left of the coin. No symbol printed on his face.

---

## Kovi

| # | File | Size | Prompt |
|---|------|------|--------|
| 01 | `kovi-sheet.png` | 2048×1024 | Character reference sheet of Kovi (as described above): the same character shown front view, three-quarter view, and side view, standing in a neutral happy pose, evenly spaced on one row. Identical proportions in every view. |
| 02 | `kovi-wave.png` | 1024×1024 | Kovi standing and waving hello with his right hand raised high and two small motion lines beside the hand, left arm relaxed down, big friendly smile. |
| 03 | `kovi-cheer.png` | 1024×1024 | Kovi jumping for joy, both arms thrown straight up in celebration, feet slightly off the ground, open happy mouth, eyes squeezed into happy arcs. |
| 04 | `kovi-catch.png` | 1024×1024 | Kovi with both arms held out wide to the sides at shoulder height, hands open, ready to catch things falling from above, delighted expression looking upward. |
| 05 | `kovi-ride.png` | 1024×1024 | Kovi sitting on top of a paper plane and riding it, facing right. The plane is folded paper in orchid #E5A8F0 with a deep orchid #C77FD9 underside fold and a small white inner fold. Kovi holds on with one hand and points forward with the other, legs tucked, excited. The plane points to the right, flying level. |
| 06 | `kovi-key.png` | 1024×1024 | Kovi standing proudly holding up a big old-fashioned key in his right hand. The key has a round mustard bow with a periwinkle centre hole and a black shaft with two teeth. Calm, confident small smile. |
| 07 | `kovi-sleep.png` | 1024×1024 | Kovi lying on his tummy fast asleep, arms folded under his chin, legs out to the sides, eyes closed as gentle curved lines, tiny open mouth, two small black "z" shapes floating above him. |
| 08 | `kovi-oops.png` | 1024×1024 | Kovi looking apologetic and a little worried: one hand scratching the back of his head, the other hand open palm up, eyebrows tilted, small wobbly mouth, a single small sweat drop beside his head. Gentle, not sad. |
| 09 | `kovi-peek.png` | 1024×512 | Kovi peeking over a flat horizontal edge at the bottom of the image: only his top half is visible above the edge, both hands gripping the edge, curious happy eyes. The edge is a plain straight line the full width. |

## Scenes

| # | File | Size | Prompt |
|---|------|------|--------|
| 10 | `scene-welcome.png` | 1170×960 | A tiny round planet seen from above its curve, filling the bottom third of the frame: a big periwinkle #A7B6F7 dome with a black outline and two soft white cloud-shaped continents on it. On the left edge of the planet sits a small corner shop, tilted with the curve: white walls, tangerine-and-white striped awning, a periwinkle door and two mustard windows. On the right edge sits a small house: tangerine triangular roof with a mustard round window, white walls and an orchid door. A dotted black arc (a flight path) rises from the shop, peaks high in the middle and comes down to the house. Two small white clouds, three mustard four-point sparkles, one orchid sparkle and two small outline circles float in the sky. The middle of the arc is empty: a character is animated there separately. |
| 11 | `scene-send.png` | 1026×510 | Two small city skylines on the left and right edges, each four chunky rectangular buildings of different heights with rows of small white windows, standing on a black ground line. Left city in white, mustard and orchid. Right city in tangerine, white and mustard. A dotted black arc flies from the top of the left city, high across the middle, down to the right city. Small mustard, orchid and white sparkles in the sky. The middle of the arc is empty. |
| 12 | `scene-faceid.png` | 1080×900 | A large white circle with a black outline, like a camera viewfinder, with four thick black rounded corner brackets of a face-scan frame inside it. Kovi stands in the centre inside the frame holding up a big key (mustard bow, periwinkle hole, black shaft). Around the outside: a mustard sparkle top left, a white sparkle right, an orchid sparkle bottom right and a small outline circle bottom left. |
| 13 | `scene-paid-terminal.png` | 720×750 | A friendly card-payment terminal seen from the front: a rounded periwinkle body with a black outline, a black slot bar at the top, a white rounded screen showing two short black dashes, and a keypad of five white rounded keys and one mint key. A tall white paper receipt rises out of the top slot, with three short black text-like lines. The receipt has a blank area at the bottom for an amount the app adds. The top edge of the receipt is flat and empty, because Kovi stands on it. |
| 14 | `scene-coin-rain.png` | 1170×900 | Six mustard and white coins scattered down the frame at different heights and tilts, as if falling. Each coin has a black outline, a dotted inner ring and a small white highlight. Blank faces, no symbols. Lots of empty space between them. |

## Card

| # | File | Size | Prompt |
|---|------|------|--------|
| 15 | `card-active.png` | 1200×760 | A flat payment card facing forward, landscape, rounded corners, black outline. Periwinkle #A7B6F7 base. A curved orchid #E5A8F0 wave sweeps across the top right corner, outlined in black. A mustard chip with a black cross line at the left middle. A mustard circle with a smaller inner ring at the bottom right. Three small black contactless wave arcs at the top right. The top left and bottom left are empty for text the app adds. |
| 16 | `card-frozen.png` | 1200×900 | The same card, frozen: base in light periwinkle #DCE2FB, the top right wave in pale icy white-blue, the chip white instead of mustard, no circle at the bottom right. White frost blobs with black outlines stick to the top left and bottom right corners. Four black snowflake line icons float above the card. Kovi lies asleep on top of the card (as in kovi-sleep). |

## Small pieces

| # | File | Size | Prompt |
|---|------|------|--------|
| 17 | `plane.png` | 512×512 | A folded paper plane pointing to the right, flying slightly upward: orchid #E5A8F0 top wing, deep orchid #C77FD9 lower fold, small white inner fold, black outline. |
| 18 | `coin-usd.png` | 512×512 | A single mustard coin facing forward, black outline, dotted inner ring, small white highlight arc top left, and a bold black dollar sign in the centre. |
| 19 | `coin-eur.png` | 512×512 | The same coin with a bold black euro sign, on a white coin instead of mustard. |
| 20 | `coin-gbp.png` | 512×512 | The same coin with a bold black pound sign, on an orchid #E5A8F0 coin. |
| 21 | `coin-ngn.png` | 512×512 | The same coin with a bold black naira sign, on a mint #6FD3A0 coin. |
| 22 | `badge-shop.png` | 512×512 | A round mustard badge with a thick black outline, containing a small shop front: white walls, tangerine-and-white striped awning, periwinkle door, two mustard windows. |
| 23 | `badge-add.png` | 512×512 | A round mint #6FD3A0 badge with a thick black outline and a chunky black plus sign in the centre. |
| 24 | `sparkles.png` | 1024×256 | A row of six separate four-point star sparkles with gently curved sides and black outlines, in mustard, white, orchid and tangerine, of three different sizes, evenly spaced. |
| 25 | `snowflakes.png` | 1024×256 | A row of five simple black line snowflakes, each six-armed with rounded ends, three different sizes, evenly spaced. |

## People (avatars)

Each one is a round portrait badge: a coloured circle background with a black outline, head and
shoulders, simple dot eyes, a small smile, blush cheeks, an orchid shirt collar. Same drawing
style and size for all six, so they read as one family.

| # | File | Size | Prompt |
|---|------|------|--------|
| 26 | `avatar-1.png` | 512×512 | A woman with deep brown skin and a big round black afro puff. Orchid circle background. |
| 27 | `avatar-2.png` | 512×512 | A man with light tan skin and short neat black hair. Mustard circle background. |
| 28 | `avatar-3.png` | 512×512 | A woman with medium brown skin and a black bob with a fringe. Mint circle background. |
| 29 | `avatar-4.png` | 512×512 | A man with pale peach skin, short wavy black hair and round glasses. Tangerine circle background. |
| 30 | `avatar-5.png` | 512×512 | A woman with dark brown skin and long black braids falling behind her shoulders. Light periwinkle circle background. |
| 31 | `avatar-6.png` | 512×512 | A man with warm brown skin, a short black beard and a close-cropped haircut. Periwinkle circle background. |

## App icon and splash

| # | File | Size | Prompt |
|---|------|------|--------|
| 32 | `icon.png` | 1024×1024 | App icon. A solid periwinkle #A7B6F7 square background filling the whole image, with no rounded corners (the phone rounds them). Centered and filling about 60% of the square: Kovi's happy face only, the round mustard coin with the dotted ring, eyes, blush and smile, no arms or legs. Bold black outline. Not transparent. |
| 33 | `icon-foreground.png` | 1024×1024 | The same Kovi face alone on a transparent background, centred and filling about 45% of the square, for the Android adaptive icon. |
| 34 | `splash.png` | 1284×2778 | A solid orchid #E5A8F0 background filling the whole image, not transparent. In the exact centre, Kovi riding his paper plane (as in kovi-ride), about one third of the image width. Nothing else. |

## After generating

1. Check every Kovi against `kovi-sheet.png`: the same dotted ring, the same eye shape, no symbol on his face.
2. Trim the transparent edges, but keep each subject centred.
3. Drop the files into `apps/mobile/assets/art/` and tell me. I'll swap them in for the in-code
   drawings. The animations (flight path, coin rain, cheering hop) keep working, because they
   move whole images.
