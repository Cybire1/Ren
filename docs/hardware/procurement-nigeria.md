# Buying Kova hardware in Nigeria

Researched **2026-09-20** for a purchase today; hackathon submission **2026-10-12**. Companion to
`docs/hardware/pos-terminal.md`, which decides *what* to buy; this decides *where to buy it in
Nigeria*. Every price was read off a live vendor page on **2026-09-20** unless marked otherwise.
Where stock or price could not be confirmed it is marked **Unconfirmed** rather than guessed.

FX used throughout: **$1 = ₦1,331.83** (xe.com, 2026-09-20 01:48 UTC; open.er-api.com gave ₦1,335.69
at 00:02 UTC the same day). Derived: **€1 ≈ ₦1,530**, **£1 ≈ ₦1,784**.

## Bottom line

1. **There is no SUNMI V3 and no iMin anywhere in Nigeria.** Jiji, Jumia and Konga return zero
   V-series and zero iMin listings; the only SUNMI in the country is the **P3**, which is the locked
   PCI series we already ruled out. SUNMI publishes no African office and iMin's `/where-to-buy/` is a 404.
2. **Order today, locally:** a **DTL Android 13 POS + 4G + NFC at ₦225,000** from **DaziTech Ltd,
   3 Otigba Street, Computer Village, Ikeja** — go in person and run the five-minute test in
   §Seller checklist *before* paying — plus a **Pixel 6a (new) ₦349,999** and a **58 mm Bluetooth
   ESC/POS printer + 5 rolls ₦35,000**.
3. **Order today, imported:** an **ACS ACR1252U** from Shop NFC (Italy), €48.30 + €19.90 express
   ≈ **₦104,350** landed pre-duty, 3–5 days. Do **not** buy the ACR122U units sitting in Lagos at
   ₦100,000–₦169,900 except as a same-day stopgap — `pos-terminal.md` rules it out for our ~500 ms
   signing call.
4. **JavaCards are the one thing Nigeria does not sell at all.** No JCOP, no JavaCard, no blank
   secure-element cards on any Nigerian marketplace or access-control supplier — only Mifare. The
   only confirmed route is **AliExpress J3R180 unfused JCOP4 at ₦5,145–₦10,486/card**, which ships
   to Nigeria but publishes **no delivery date**. Smartcard Focus (UK), the obvious express
   alternative, says in writing: *"There are currently supply issues with this product. You will not
   be able to order the product."*
5. **Total to order today: ≈ ₦766,000 (~$575)**, rising to **≈ ₦921,000 (~$692)** with a duty
   contingency and the optional local ACR122U stopgap. Everything except the JavaCards is **in hand
   by ~2026-09-29**.
   The cards are the only item that can miss Oct 12 — and §What to do if the cards arrive late shows
   why that does not block the demo.

---

## 1. Android POS terminal

### What is actually on sale in Nigeria

| Option | Vendor | Price NGN | Delivery | Risk |
|---|---|---|---|---|
| **DTL Android 13 POS + 4G + NFC** *(pick)* | **DaziTech Ltd.**, 3 Otigba St, Computer Village, Ikeja (+ Shop A02/B02, 172 Joy Plaza, Dopemu, Agege). Enterprise seller, 8+ yrs, 98 feedback, Mon–Sat 08:00–18:00. [Jiji](https://jiji.ng/ikeja/store-equipments/dtl-android-13-pos-4g-nfc-cYia03duIuaJMHOiUFcT8rrC.html) | **225,000** | same-day pickup in Ikeja | Generic MTK class. `android.nfc` exposure **Unconfirmed** until tested. RAM/ROM not stated — ask. |
| DTL Handheld Android 13 POS + NFC | Enterprise seller, Lagos Ikeja. [Jiji](https://jiji.ng/ikeja/store-equipments/dtl-handheld-android-13-pos-nfc-zvtMhb6jjaYnl2778Eh3bJo8.html) | 238,000 | same-day | same |
| DTL Handheld Android 14 POS NFC **3/32 GB** | Enterprise seller, Lagos Ikeja (Jiji search) | 250,000 | same-day | Best specs of the DTL set — 3 GB RAM is the comfortable floor for an Expo dev build |
| Handheld Smart Android 13.0 POS Terminal with NFC | **BINARYBLITZ TECHNOLOGIES LTD**, 7 Akinremi St, Anifowose, Ikeja. 6", **2 GB/32 GB**, "barcode scanner, receipt printer and nfc tag reader". [Jiji](https://www.jiji.ng/ikeja/store-equipments/handheld-smart-android-13-0-pos-terminal-with-nfc-eZxZxjmoZgtAzSpYR6Vh2ERZ.html) | 245,000 | same-day | **2 GB RAM is thin** for an Expo dev build. "nfc *tag* reader" wording is a mild worry — confirm ISO-DEP, not just NDEF |
| Z90 Android 12 POS, NFC + fingerprint + card | DaziTech Ltd. (same shop as the pick). [Jiji](https://jiji.ng/ikeja/store-equipments/z90-android-12-pos-with-nfc-fingerprint-and-card-dNeFdBc9xTwHxpIgu5KYlayX.html) | 315,000 | same-day | "Z90" is the ZCS/Ciontek-class family `pos-terminal.md` calls the open-ish wildcard — but the published evidence there is **NDEF-only**, and the fingerprint + card-slot build smells like a payment SKU |
| Generic Handheld POS Receipt Printer Android PDA Terminal — 2 GB/16 GB, Android, 5", 58 mm @ 50 mm/s, 1D/2D, 6000 mAh | Jumia, seller "kamk wig tools" (70% seller score). [Jumia](https://www.jumia.com.ng/generic-handheld-pos-receipt-printer-android-pda-terminal-418252371.html) | 225,000 | pickup ₦750 / door ₦1,550, **25–28 Sept** | **NFC is not in the spec sheet.** Two sibling listings at ₦229,000. Upside: Jumia gives **free returns within 7 days** — the only real return path in this market |
| **Moniepoint / OPay / Kolomoni PSP terminals** | Jiji, everywhere | 22,500 – 31,200 | same-day | **Do not buy.** Locked firmware, PSP Device Owner, tied to the PSP's switch. This is the Nigeria-specific trap the brief warns about, and it is the overwhelming majority of the local market by volume |
| SUNMI **P3** with ATM card slot | Enterprise sellers, Lagos Ikeja | 255,000 / 300,000 | same-day | **Do not buy.** P-series routes card handling through SunmiPayHardwareService, not `android.nfc` (see `pos-terminal.md`) |
| SUNMI **V3** / iMin Swift 2 Pro | — | — | — | **Not sold in Nigeria.** Jiji returns no SUNMI V-series (its search even stems "sunmi" → "senci" generators); Jumia and Konga return none |

### Official distributors

- **SUNMI**: no Nigerian or African office or distributor is published. `sunmi.com` lists only a
  China customer-service line (400-6666-509) and a generic lead form at
  `https://www.sunmi.com/en/leads`. The `/en/contact/` path 404s. If you want a V3 you are importing it.
- **iMin**: `https://www.imin.com/where-to-buy/` returns **404**. No Nigerian reseller found.
- **Telpo / PAX / Nexgo / Newland**: Jiji returns nothing for "telpo pos". PAX and Nexgo units reach
  Nigeria through PSP fleets, not retail — which means any you find are ex-fleet and locked.

**Read of the market:** Nigeria has exactly one buyable class of terminal for us — the **generic
Chinese MTK "DTL"-badged Android 13/14 handhelds sold out of Computer Village at ₦225k–250k**.
`pos-terminal.md` already anticipated this ("Nigeria/Kenya: buy locally and inspect in person,
₦225k–250k") and the live market matches that to the naira. These are sold bare, with no PSP binding
and no PCI kernel, which is exactly why they are the right buy — but `android.nfc`/`IsoDep` exposure
is **Unconfirmed on paper** and must be proved on the counter before money changes hands.

---

## 2. Secure-element JavaCards (JCOP4 / J3R180 / J3H145)

| Option | Vendor | Price NGN | Delivery | Risk |
|---|---|---|---|---|
| **J3R180 Unfused JAVA Card JCOP4** *(pick — order 5–10)* | [AliExpress](https://www.aliexpress.com/w/wholesale-javacard-jcop4-j3r180.html), 461 sold, "Top selling on AliExpress" | **5,145** ea | ships to Nigeria (site prices in ₦); **no delivery date published** | The whole risk. AliExpress → Lagos is typically weeks, and `pos-terminal.md` already warns: *"Every AliExpress/Alibaba listing I could read stated no delivery date. Do not put the Oct 12 demo on a China-direct order."* |
| 1PCS Unfused JAVA Card, **J3R150/J3R180/J3R200** JCOP | AliExpress, 464 sold | 10,486 ea | as above | Mixed-SKU listing — you may get a J3R150. Specify J3R180 in the order note |
| Unfused JAVA Card JCOP4 J3R110 / J3R150 / **J3R180** | AliExpress, 165 sold, *"Free shipping over ₦15,044.03"* | 7,206 ea | as above | A 5-card order (₦36,030) clears the free-shipping threshold |
| J3R180 JCOP4 180K + 2-track HICO magstripe | AliExpress, 91 sold | 24,281 ea | as above | You are paying for a magstripe we do not use |
| **NXP J3H145 dual-interface 144k** | [Smartcard Focus (UK)](https://www.smartcardfocus.com/shop/ilp/id~879/nxp-j3h145-dual-interface-java-card-144k/p/index.shtml) | £16.25 (≈29,000) / £15.28 at 10+ | — | **CANNOT ORDER.** Page states verbatim: *"There are currently supply issues with this product. You will not be able to order the product."* No basket button. Rules out the obvious UK express route |
| Anything JCOP in Nigeria | — | — | — | **Does not exist.** See below |

### Are JavaCards available in Nigeria at all? No.

Checked and confirmed empty on 2026-09-20:

- Jiji `javacard` → *"We couldn't find ads matching 'javacard'"*
- Jiji `blank nfc smart card` → *"We couldn't find ads matching…"*
- Jumia `rfid card blank` → 386 hits, **all RFID-*blocking* phone cases**, zero blank cards
- Jumia `nfc card reader` → *"There are no results"*

Nigeria **does** have a real card-supply industry, but it is Mifare-only — fixed-function memory
cards, not a programmable secure element. From Jiji, all Lagos, all verified sellers:

| Local card product | Price NGN | Use to us |
|---|---|---|
| Mifare Cards 13.56 MHz, single | 300 ea (Ikeja; Lagos Island) | **None for the applet.** Mifare Classic/DESFire cannot host a JavaCard applet and cannot do on-card P-256 |
| Mifare Access Control Card, box of 200 | 65,000 | ditto |
| Mifare Cards 13.56 MHz, 200-pack | 140,000 (Ajah) / 160,000 (Gbagada) | ditto |
| "Printing on Mifare Cards, RFID Cards in Nigeria" (Mushin, Premium seller) | contact | Useful later for **printing Kova branding onto cards we import** |
| 50 pcs blank PVC magstripe | 85,000 (Agege) | no |

**Verdict:** buy the chips abroad, print them locally if we ever want branded cards.

### NTAG 424 DNA (the weaker fallback)

- **Not sold in Nigeria.** Jumia's closest is **NTAG216 stickers, 100 pcs for ₦2,874** — wrong chip
  (NTAG216 has no CMAC/SDM secure messaging).
- **AliExpress ships NTAG 424 DNA to Nigeria**, priced in naira: 5 pcs **₦9,958**, 10 pcs
  **₦15,586–19,758**, 25 mm singles **₦1,029–2,119 ea**, 100 pcs **₦128,543**, 1000-pc chip lot
  ₦786,540. Same no-delivery-date problem.
- Worth adding **10 pcs (₦15,586)** to the same AliExpress order as a comparison artefact — it costs
  ~₦16k and lets us demo the "why a real secure element beats a Bolt-Card-style tag" argument with
  both cards on the table.

---

## 3. PC/SC contactless reader

| Option | Vendor | Price NGN | Delivery | Risk |
|---|---|---|---|---|
| **ACS ACR1252U** *(pick)* | [Shop NFC (IT)](https://www.shopnfc.com/en/38-javacard) — **€48.30**, marked down 30% from €69.00 | **≈ 73,900** + express **€19.90 ≈ 30,450** = **≈ 104,350** pre-duty | Shop NFC "Rest of World": **express 3–5 days** (DHL/UPS/FedEx) or free standard 8–16 days | Customs fees explicitly the recipient's. Shop NFC does not name Nigeria in its zone list — **Unconfirmed** that checkout accepts a Lagos address; verify before relying on it |
| Original ACS **ACR1252U** | AliExpress, "purchasable with shipping to Nigeria", 1 sold | 180,694 | no date published | 74% more than Shop NFC and slower. Several cheaper AliExpress hits (₦98,760 / ₦106,813 / ₦145,946) are the **ACM1252U-Y3 *module***, a bare OEM board, **not** the boxed ACR1252U reader — easy and expensive mistake |
| **ACR122U** — "Kkmoon NFC ACR122U RFID Contactless Smart Reader/Writer", **London used** | TOKUNBO GADGETS (Enterprise, 5+ yrs), Lagos, Ojo. [Jiji](https://jiji.ng/ojo/computer-accessories/kkmoon-nfc-acr122u-rfid-contactless-smart-reader-writer-C6207ej3xN3fkfcQwQGltTmk.html), posted today | 100,000 | same-day Lagos | **Stopgap only.** `pos-terminal.md`: the CCID maintainer lists the ACR122U as *"No extended APDU"* and *"Time extension requests are not supported"*; it resets on long card operations — i.e. on our ~100–500 ms sign. Also used, ex-UK |
| ACR122U (new) — "USB Smart Card Reader Writer RFID Reader Access Control"; description names ACR122U, ISO 14443 A/B, Mifare, FeliCa, ISO/IEC 18092, 424 kbps | **Gatenet Africa Ltd** (business, 8+ yrs), Lagos, Magodo. [Jiji](https://jiji.ng/magodo/accessories-and-supplies-for-electronics/usb-smart-card-reader-writer-rfid-reader-access-control-zd9c8Q0ZyUxnbbxIBMSGKbvR.html) | 169,900 | same-day Lagos | Same technical objection, at ₦170k. Skip |
| Contact-only USB smart card reader ("Bank Tax DNIE ATM CAC IC ID Card Reader, Mac/Windows/Linux") | Jumia | 20,500 | standard | **Contact interface only** — cannot talk to a contactless card. Wrong tool |

**ACR1252U is not sold in Nigeria** (Jiji "acr1252u" → no results; Jumia "acr122u" → no results;
Jumia "nfc card reader" → no results). It must be imported.

---

## 4. Thermal printer + rolls

| Option | Vendor | Price NGN | Delivery | Risk |
|---|---|---|---|---|
| **XPrinter 58 mm Thermal Receipt POS Printer + 5 rolls** *(pick)* | Jumia, 4.3★ (3 reviews) | **35,000** | standard Lagos/Abuja | Confirm it is **Bluetooth Classic/SPP ESC/POS**, not BLE-only. Rolls included solves consumables |
| Mini Thermal Printer Wireless Bluetooth 58 mm | Jumia, 3.9★ (268 reviews), was ₦71,986 | **26,402** | standard | Cheapest credible unit; 268 reviews is the best social proof in this category |
| Mini Thermal Printer Wireless Bluetooth 58 mm (alt listings) | Jumia | 26,400 / 26,500 / 27,000 / 27,500 | standard | Same commodity device under different sellers |
| Mini Bluetooth Thermal Mobile Portable Printer 58 mm | Jumia | 34,500 | standard | — |
| XPrinter 58 mm + 5 rolls (other sellers) | Jumia | 38,000 / 54,999 | standard | Overpriced vs the ₦35,000 listing |
| XPrinter **USB** 58 mm + 5 rolls | Jumia | 75,500 | standard | USB-only — no use with a phone |

Standalone 58 mm roll packs barely exist on Jumia; every printer listing bundles 5 rolls. Buy two
printers-with-rolls or source rolls from any Computer Village stationery stall while you are there.

---

## 5. Android phone with NFC

| Option | Vendor | Price NGN | Delivery | Risk |
|---|---|---|---|---|
| **Google Pixel 6a, 128 GB, brand new** *(pick)* | Jiji, Lagos, Ikeja | **349,999** | same-day Lagos | GrapheneOS-supported (Pixel 6 → 10a per `pos-terminal.md`); unmodified AOSP NFC stack; bootloader unlock + re-lock with our own key. **Verify it is carrier-unlocked** — a carrier SKU cannot unlock its bootloader |
| Google Pixel 6, 256 GB, open box | Jiji, Abuja, Wuse 2 | 320,000 | Abuja | Cheapest GrapheneOS-capable unit found. Open box — inspect |
| Google Pixel 7a, 128 GB, new | Jiji, Lagos, Ikeja | 400,000 | same-day | Newer SoC, longer support runway |
| Google Pixel 7 / 7 Pro / 8 | Jiji | 650,000 / 735,000 / 1,090,000 | — | Unnecessary spend |
| AGM H6 Leather Lite — 6.6", 4 GB/128 GB, **Android 13, NFC** | Jumia | 142,320 | standard | Cheapest *stated*-NFC Android. **No GrapheneOS.** Chinese rugged brands sometimes ship regional variants without NFC — confirm on the exact model code |
| OUKITEL WP23S — 16 GB/64 GB, Android 15, IP68/NFC | Jumia | 138,321 | standard | same caveat |
| ZEE KER A10 — 4 GB/64 GB rugged, NFC | Jumia | 115,000 | standard | Cheapest NFC phone found; brand unknown, NFC claim unverified |
| Doogee Note56X Pro — 32 GB/128 GB, Android 16, NFC | Jumia | 163,449 | standard | same caveat |

**Is a Pixel realistically obtainable in Nigeria? Yes** — brand-new Pixel 6a at ₦349,999 in Ikeja and
an open-box Pixel 6 at ₦320,000 in Abuja, both listed today, both in the GrapheneOS-supported range.
This is the single most de-risking purchase on the list: it is the only device here whose NFC stack
we *know* is stock AOSP, and it doubles as the software card (§What to do if the cards arrive late).

---

## Seller checklist

Nigeria-specific, on top of the 13 questions in `pos-terminal.md` §"Questions to ask the seller".

### Before you leave the house

1. **Never buy a POS terminal sight-unseen on Jiji.** Jiji has no escrow. Computer Village is a
   30-minute trip and every seller above has a physical shop address — DaziTech at 3 Otigba Street,
   BinaryBlitz at 7 Akinremi Street, both Ikeja. Go, test, then pay.
2. **Take the test kit with you**: your Mac, a USB-C/USB-A cable, a hello-world debug APK and the
   `NFC TagInfo by NXP` APK on a USB stick (many grey-import units are non-GMS with no Play Store),
   and any contactless bank card.

### The five-minute counter test — do all five before paying

3. **`adb devices` sees it.** Settings → About → tap Build number ×7 → Developer options → USB
   debugging → plug into the Mac → accept the authorisation dialog.
4. **`adb install` your hello-world APK succeeds.** If it answers *"App not installed"* or the
   install is silently refused, walk away — that is the signature gate.
5. **Reboot, then `adb devices` again.** Channel-locked units authorise once and lose it on reboot.
6. **NFC TagInfo reads a contactless bank card and shows the `IsoDep` / ISO 14443-4 line.** This is
   the single most valuable test: it proves the antenna is wired to the Android NFC controller and
   exposed to `android.nfc`, not captured behind a payment SDK.
7. **Print a test receipt** from the vendor's own demo app.

### Spotting an ex-fleet or PSP-locked unit

8. **Look at the shell, the boot animation and the wallpaper.** Moniepoint, OPay, PalmPay, Paystack,
   Flutterwave, Baxi and Kuda all brand their fleet hardware. Any branding at all = refuse.
9. **Settings → Apps → look for an undeletable PSP app**, and Settings → Security → check for a
   **Device Owner / MDM profile**. An ex-fleet unit carries a Device Owner and lease locks that
   cannot be removed without a full reflash.
10. **Settings → "Install unknown apps" must be toggleable.** If it is greyed out, or if the only
    install route is a vendor "App Market" app, the unit is channel-locked.
11. **Ask outright: "Is this ex-bank, ex-Moniepoint, ex-OPay, or new stock from the importer?"**
    and **"Was this ever deployed with an agent?"** The ₦22,500–₦31,200 listings flooding Jiji are
    precisely these recovered PSP units — the price tells you what they are.
12. **Refuse anything boxed PAX, Nexgo, Newland, Castles, Verifone, Ingenico or SUNMI P-series.**
    Those are PCI payment terminals; they will not run our APK.
13. **"UK used" / "London used" / "Tokunbo"** means refurbished import. Fine for a reader, not for
    the demo terminal.

### Commercial terms

14. **Ask for RAM/ROM in writing.** The DTL listings mostly omit it; 2 GB is thin for an Expo dev
    build, 3 GB/32 GB is the comfortable floor. Prefer the Android 14 3/32 GB SKU at ₦250,000 over
    the 2 GB units.
15. **Ask whether it is GMS or non-GMS**, and get the Android build number.
16. **Get a written 7-day return** for "the reader cannot read our ISO 14443-4 card". Jiji sellers
    rarely give one; **Jumia's free 7-day returns are the only enforceable return path in this
    market** — which is a real argument for the ₦225,000 Jumia unit as a *second* terminal even
    though its spec sheet omits NFC.
17. **Pay by transfer with a receipt naming the model**, not cash, so a chargeback conversation is
    possible.
18. **Ask for an NCC type-approval sticker** on the box. Its absence is not fatal for one unit, but
    its presence tells you the importer is a formal channel rather than a suitcase trader.

---

## Import route if local stock fails

### Does anyone ship to Nigeria?

| Vendor | Item | Ships to Nigeria? |
|---|---|---|
| **Shop NFC (IT)** | ACR1252U €48.30; SUNMI V3 non-GMS €384 | **Likely yes** — publishes a "Rest of World" zone: free standard 8–16 days, **express €19.90+ 3–5 days**, via DHL/UPS/FedEx; customs at recipient's cost. Nigeria is not named explicitly — **Unconfirmed** until checkout accepts a Lagos address |
| **AliExpress** | J3R180 JavaCards, NTAG 424 DNA, ACR1252U | **Yes, confirmed** — listings render prices in ₦ and state "purchasable with shipping to Nigeria". **No delivery dates published on any listing** |
| **Smartcard Focus (UK)** | J3H145 JavaCard | Publishes UK-mainland shipping only ("next day UK, 3–5 days US"); no international policy page (their delivery URLs 404). And the J3H145 **cannot be ordered at all** right now |
| **ERS Online (UK)** | SUNMI V3 `P06100058` £265.72 ex VAT ≈ ₦474,000 | **Unconfirmed** — their delivery pages 404. Email before ordering |
| **Satomar (CZ)** | iMin Swift 2 Pro €367.13 ≈ ₦561,700 | **Unconfirmed** |
| **All-Star Terminals (US)** | SUNMI V3 Plus +NFC $449 ≈ ₦598,000 | **Unconfirmed**; US sellers of POS hardware commonly refuse Africa |

**Practical import plan if the Computer Village unit fails its counter test:** order a **SUNMI V3
non-GMS (€384 ≈ ₦587,500) from Shop NFC with €19.90 express**, because Shop NFC is the only vendor in
the `pos-terminal.md` shortlist with a published Rest-of-World express lane. Landed pre-duty
≈ **₦618,000**; budget **₦800,000–₦900,000** all-in after duty and VAT. Ordered 2026-09-20, that is a
realistic **2026-09-25 to 2026-10-02** arrival — tight but inside the deadline. Anything ordered
after ~Sept 30 will not make Oct 12.

### Duties and taxes

Confirmed:

- **VAT: 7.5%** standard rate (PwC Worldwide Tax Summaries, Nigeria, *last reviewed 29 May 2026*).
- **Customs duty: "typically from 5% to 35%"**, ad valorem on the **CIF** value, assessed against the
  HS code, payable in naira on entry (PwC; trade.gov *Nigeria — Customs Regulations*, 2025-09-05).
- Nigeria applies the **ECOWAS Common External Tariff** five-band structure (trade.gov *Nigeria —
  Import Tariffs*, 2025-09-05). The same page notes effective rates above 50% on 80+ tariff lines,
  but the examples are agriculture, vehicles, alcohol and cement — **not electronics**.
- **All imported goods must be insured by a Nigeria-registered insurer** (trade.gov, Customs
  Regulations). In practice express couriers handle this for low-value parcels; **Unconfirmed** how
  it is applied to a personal express import.
- Clearance runs through **PAAR** (Pre-Arrival Assessment Report) and the **Single Window Portal**.

**Unconfirmed — do not quote these as fact:** the exact CET band for POS terminals (HS 8470/8471),
smart cards (HS 8523.52) and card readers (HS 8471.60/8543.70); and the commonly cited surcharges
(**7% surcharge on duty, 1% CISS, 0.5% ECOWAS levy**). I could not reach a live Nigeria Customs
tariff lookup — `customs.gov.ng` serves only a header/logo shell to a fetcher, and
`nigeriatradeportal.gov.ng` and `trade.gov.ng` do not resolve. **Planning number: budget 30–45% of
CIF as landed tax on top of the invoice**, and confirm with the courier's broker before ordering.

### Restrictions, CBN and NCC

- **POS terminals, electronics, smart cards and telecom/payment equipment are NOT on Nigeria's
  prohibited or restricted import list** (trade.gov *Nigeria — Prohibited and Restricted Imports*,
  last updated 2023-06-06). No import ban applies to anything on our list.
- **NCC type approval is the real regulatory flag.** The NCC states it sets standards for *"all
  telecommunications equipment in operation in the Federal Republic of Nigeria"*, including
  *"customer devices such as mobile phones and wireless adapters"*, and that *"All equipment
  manufacturers, vendors and operators … must therefore ensure that their equipment conform to the
  applicable standards as mandated by the Commission before bringing them into Nigeria."* The page
  references a fees schedule but publishes no amounts, and **states no exemption for personal or
  sample imports — Unconfirmed whether a one- or two-unit import is enforced in practice.** The
  exposure is highest for a **4G-equipped** POS terminal and a phone; it is negligible for the
  reader, the printer and the cards. **Mitigation: buy the terminal and phone locally** (both are
  available, per §1 and §5) and import only the reader and cards.
- **CBN**: no evidence found of a CBN restriction on importing POS *hardware*. CBN's PTSP/PTSA
  framework governs terminals **deployed for card acquiring on the Nigerian switch** — which Kova is
  not doing; our terminal reads our own JavaCard over a custom AID and settles in stablecoin. **This
  reading is reasoning, not a cited rule — Unconfirmed.** The reason Nigerian POS terminals are
  locked is commercial (PSPs subsidise the hardware and lock it to their switch), not regulatory.

### Realistic express timing, Lagos/Abuja

Shop NFC's own published Rest-of-World express figure is **3–5 days** transit. Nigerian customs
clearance on an express parcel is the variable, not the flight. **Plan on 5–9 days door-to-door from
Europe** and treat anything China-direct as **2–6 weeks with no committed date**. Specific DHL
Nigeria rate cards could not be retrieved (dhl.com pages timed out; `mydhl.dhl.com` does not
resolve) — **shipping cost beyond Shop NFC's €19.90 is Unconfirmed**.

---

## Total realistic cost and the order-today list

### Order today

| # | Item | Vendor | NGN | In hand |
|---|---|---|---|---|
| 1 | **DTL Android 13 POS + 4G + NFC** — *test at the counter first* | DaziTech Ltd, 3 Otigba St, Computer Village, Ikeja · [listing](https://jiji.ng/ikeja/store-equipments/dtl-android-13-pos-4g-nfc-cYia03duIuaJMHOiUFcT8rrC.html) | 225,000 | today |
| 2 | **Google Pixel 6a 128 GB, new** (→ GrapheneOS; the guaranteed-AOSP NFC device and our software card) | Jiji, Lagos Ikeja | 349,999 | today |
| 3 | **XPrinter 58 mm Bluetooth ESC/POS + 5 rolls** | [Jumia](https://www.jumia.com.ng/catalog/?q=thermal+paper+roll+58mm) | 35,000 | ~23 Sep |
| 4 | **ACS ACR1252U** + Rest-of-World express | [Shop NFC (IT)](https://www.shopnfc.com/en/38-javacard) €48.30 + €19.90 | ≈ 104,350 | ~25–29 Sep |
| 5 | **5 × J3R180 unfused JCOP4 JavaCards** | [AliExpress](https://www.aliexpress.com/w/wholesale-javacard-jcop4-j3r180.html) @ ₦7,206 (clears the ₦15,044 free-shipping threshold) | 36,030 | **no date — 2–6 wks** |
| 6 | **10 × NTAG 424 DNA cards** (fallback/comparison) | AliExpress | 15,586 | same parcel |
| | **Core subtotal** | | **765,965** | |
| 7 | Duty/VAT contingency on items 4–6 (~35% of CIF) | NCS | ≈ 55,000 | on delivery |
| 8 | *Optional:* local ACR122U as a same-day stopgap | TOKUNBO GADGETS, Lagos Ojo · [listing](https://jiji.ng/ojo/computer-accessories/kkmoon-nfc-acr122u-rfid-contactless-smart-reader-writer-C6207ej3xN3fkfcQwQGltTmk.html) | 100,000 | today |
| | **All-in with contingency + stopgap** | | **≈ 920,965** | |

**≈ ₦766,000 core (~$575), ≈ ₦921,000 worst case (~$692).** That is meaningfully cheaper than the
$800–950 the international plan in `pos-terminal.md` costs, because the terminal and phone are bought
locally at Nigerian prices instead of imported.

### Cheaper variant

Swap the Pixel 6a for the **AGM H6 Leather Lite at ₦142,320** (Android 13, NFC claimed) and skip the
NTAG cards: **≈ ₦542,700**. The cost is real — no GrapheneOS, unverified NFC on the exact model
code, and no re-lockable bootloader — so only do this if the budget is binding.

### Order sequence today

1. **Morning: Computer Village.** DaziTech (3 Otigba St) for the terminal; run the five-minute test
   on the counter. If it fails, walk 5 minutes to BinaryBlitz (7 Akinremi St) and test theirs. If
   both fail, buy nothing and trigger the Shop NFC V3 import the same afternoon — Sept 20 is the
   last comfortable day to start that.
2. **Same trip:** the Pixel 6a (Ikeja) — check carrier-unlocked, check NFC in Settings.
3. **Same hour, from your phone:** place the **AliExpress card order first** (longest lead time,
   order it before anything else), then the **Shop NFC ACR1252U express**, then the Jumia printer.

---

## What to do if the cards arrive late

**Hardware is not on the critical path, and the JavaCards least of all.** If the AliExpress parcel is
still in transit on Oct 12, the demo still works end to end:

1. **A software card via Android HCE.** Host-based Card Emulation is stock AOSP and works on
   GrapheneOS. Put an HCE service on the **Pixel 6a** that registers our AID and answers exactly the
   APDUs the applet answers — SELECT, then sign `keccak256(0x04 ‖ sigHash ‖ userAccount)` with a
   P-256 key held in the **Android Keystore** (StrongBox-backed on a Pixel, so it is a real hardware
   secure element, not a mock). Tap the Pixel on the terminal and the terminal cannot tell the
   difference: same ISO-DEP transport, same APDUs, same DER→`r‖s` low-s normalisation. This is the
   phone-tap payment path the brief already wants built, so it is not throwaway work.
2. **A pure-software card for unit tests.** `jCardSim` runs the real applet bytecode in the JVM, and
   `vsmartcard`/`vpcd` presents it to PC/SC as a virtual reader — so the provisioning tooling can be
   written and tested on the Mac with no card and no reader at all.
3. **The card is the last integration, not the first.** The applet's APDU interface is already
   specified in `docs/tempo/02`. Freeze that interface today and every other component — terminal
   app, reader-mode NFC, printer, QR, settlement — can be built and demoed against the HCE card.
   When the JCOP cards land, loading the applet over GlobalPlatform and swapping the transport is a
   few hours of work, not a redesign. The J3R180 cards being **"unfused"** matters here: unfused
   means the ISD keys are still at GlobalPlatform defaults, so we can load our own applet the day
   they arrive with no key ceremony.
4. **Order the physical cards anyway, today.** They cost ₦36,030 and they are the artefact that makes
   the pitch physical. Just do not let the schedule depend on them.

The genuine critical-path item is the **terminal**, because it is the one thing that must be proved
to expose `android.nfc`/`IsoDep`. That is why the counter test in §Seller checklist happens before
payment, and why the Pixel is bought on day one as the guaranteed-working twin.

---

## Sources

All accessed **2026-09-20** unless stated.

**Nigerian marketplaces — POS terminals**
- Jiji "android pos nfc" (19 listings, incl. DTL ₦225k–250k, Z90 ₦315k, SUNMI P3 ₦255k, Moniepoint/OPay ₦22.5k–31.2k): https://jiji.ng/search?query=android%20pos%20nfc
- DTL Android 13 POS + 4G + NFC ₦225,000 — DaziTech Ltd, 3 Otigba St, Computer Village Ikeja: https://jiji.ng/ikeja/store-equipments/dtl-android-13-pos-4g-nfc-cYia03duIuaJMHOiUFcT8rrC.html
- DTL Handheld Android 13 POS + NFC ₦238,000: https://jiji.ng/ikeja/store-equipments/dtl-handheld-android-13-pos-nfc-zvtMhb6jjaYnl2778Eh3bJo8.html
- Handheld Smart Android 13.0 POS + NFC ₦245,000 — BINARYBLITZ TECHNOLOGIES LTD, 7 Akinremi St, Anifowose Ikeja; 6", 2 GB/32 GB: https://www.jiji.ng/ikeja/store-equipments/handheld-smart-android-13-0-pos-terminal-with-nfc-eZxZxjmoZgtAzSpYR6Vh2ERZ.html
- Z90 Android 12 POS, NFC + fingerprint ₦315,000 — DaziTech Ltd: https://jiji.ng/ikeja/store-equipments/z90-android-12-pos-with-nfc-fingerprint-and-card-dNeFdBc9xTwHxpIgu5KYlayX.html
- Jiji "sunmi pos" (only SUNMI P3, ₦255k / ₦300k): https://jiji.ng/search?query=sunmi%20pos
- Jiji "sunmi" → returns Senci generators, no SUNMI: https://jiji.ng/search?query=sunmi
- Jiji "imin pos" → no iMin devices: https://jiji.ng/search?query=imin%20pos
- Jiji "telpo pos" → *"We couldn't find ads matching 'telpo pos'"*: https://jiji.ng/search?query=telpo%20pos
- Jumia "pos terminal android" (3 generic listings, ₦225k–229k): https://www.jumia.com.ng/catalog/?q=pos+terminal+android
- Jumia generic Android PDA terminal ₦225,000, 2 GB/16 GB, 58 mm @50 mm/s, delivery 25–28 Sept, free 7-day returns: https://www.jumia.com.ng/generic-handheld-pos-receipt-printer-android-pda-terminal-418252371.html
- Konga "pos terminal" — search page returned no product data to a fetcher (**Unconfirmed**): https://www.konga.com/search?search=pos%20terminal

**Vendor distributor pages**
- SUNMI home / contact (200+ countries, China CS line 400-6666-509, no Africa office; `/en/contact/` 404s): http://www.sunmi.com/en/ and https://www.sunmi.com/en/leads
- iMin "where to buy" — **HTTP 404**: https://www.imin.com/where-to-buy/

**Cards**
- AliExpress J3R180 / JCOP4 JavaCards, prices in ₦, 461–464 sold, "Free shipping over ₦15,044.03": https://www.aliexpress.com/w/wholesale-javacard-jcop4-j3r180.html and https://www.aliexpress.com/w/wholesale-J3R180-javacard.html
- AliExpress NTAG 424 DNA cards, prices in ₦ (5 pcs ₦9,958; 10 pcs ₦15,586; 100 pcs ₦128,543): https://www.aliexpress.com/w/wholesale-NTAG424-DNA-card.html
- Smartcard Focus NXP J3H145 144k — SmartMX2 SECID P60D144, Java Card 3.0.4 (JCOP v3) + GP 2.2.1, ECC 160–521 bits, *"SCP03 with default Global Platform keys"*, £16.25/£15.28/£14.46 — but *"There are currently supply issues with this product. You will not be able to order the product."*: https://www.smartcardfocus.com/shop/ilp/id~879/nxp-j3h145-dual-interface-java-card-144k/p/index.shtml
- Smartcard Focus NXP JCOP category: https://www.smartcardfocus.com/shop/ilp/se~165/nxp-jcop-java-cards/p/index.shtml
- Jiji "javacard" → no results: https://jiji.ng/search?query=javacard
- Jiji "blank nfc smart card" → no results: https://jiji.ng/search?query=blank%20nfc%20smart%20card
- Jiji Mifare/PVC card suppliers (Mifare ₦300 ea; box of 200 ₦65,000; 200-pack ₦140k–160k; card printing in Mushin): https://jiji.ng/search?query=access%20control%20pvc%20card%20printer
- Jumia "rfid card blank" → 386 hits, all RFID-*blocking* phone cases: https://www.jumia.com.ng/catalog/?q=rfid+card+blank
- Jumia "nfc tag ntag" → NTAG216 100 pcs ₦2,874; **no NTAG 424 DNA**: https://www.jumia.com.ng/catalog/?q=nfc+tag+ntag

**Readers**
- Shop NFC reader listing — **ACR1252U €48.30** (was €69.00, −30%), plus ACR1281U-C2 €55, ACR1251T €49, ACR1222L €99.90, ACR123U €159, ACM1252U-Z2 €59, ACR1581U-C1 €59: https://www.shopnfc.com/en/38-javacard
- Shop NFC delivery zones — Rest of World free standard 8–16 days / **express €19.90+ 3–5 days**, DHL/UPS/FedEx, customs at recipient's cost: https://www.shopnfc.com/en/content/1-delivery
- AliExpress ACR1252U — "Original ACS ACR1252U" ₦180,694; cheaper hits are the ACM1252U-Y3 *module* ₦98,760–₦187,846: https://www.aliexpress.com/w/wholesale-ACR1252U.html
- Jiji ACR122U ₦100,000 (London used, TOKUNBO GADGETS, Lagos Ojo): https://jiji.ng/ojo/computer-accessories/kkmoon-nfc-acr122u-rfid-contactless-smart-reader-writer-C6207ej3xN3fkfcQwQGltTmk.html
- Jiji ACR122U ₦169,900 (Gatenet Africa Ltd, Lagos Magodo; ISO 14443 A/B, Mifare, FeliCa, ISO/IEC 18092): https://jiji.ng/magodo/accessories-and-supplies-for-electronics/usb-smart-card-reader-writer-rfid-reader-access-control-zd9c8Q0ZyUxnbbxIBMSGKbvR.html
- Jiji "acr1252u" → *"We couldn't find ads matching 'acr1252u'"*: https://jiji.ng/search?query=acr1252u
- Jumia "acr122u" → *"There are no results"*: https://www.jumia.com.ng/catalog/?q=acr122u
- Jumia "nfc card reader" → *"There are no results"*: https://www.jumia.com.ng/catalog/?q=nfc+card+reader
- Jumia "smart card reader" → contact-only USB reader ₦20,500; no contactless PC/SC: https://www.jumia.com.ng/catalog/?q=smart+card+reader

**Printers and phones**
- Jumia 58 mm Bluetooth thermal printers ₦26,402–₦34,500: https://www.jumia.com.ng/catalog/?q=bluetooth+thermal+printer+58mm
- Jumia XPrinter 58 mm + 5 rolls ₦35,000 / ₦38,000 / ₦54,999; USB version ₦75,500: https://www.jumia.com.ng/catalog/?q=thermal+paper+roll+58mm
- Jiji Google Pixel listings — Pixel 6 ₦320,000 (open box, Abuja), Pixel 6a ₦349,999 (new, Lagos Ikeja), Pixel 7a ₦400,000, Pixel 7 ₦650,000, Pixel 7 Pro ₦735,000, Pixel 8 ₦1,090,000: https://jiji.ng/search?query=google%20pixel
- Jumia NFC Android phones — ZEE KER A10 ₦115,000, OUKITEL WP23S ₦138,321, AGM H6 Leather Lite ₦142,320, Doogee Note56X Pro ₦163,449: https://www.jumia.com.ng/catalog/?q=android+phone+nfc

**Customs, tax and regulation**
- PwC Worldwide Tax Summaries, Nigeria — Other taxes (**VAT 7.5%**; customs duties **5%–35%** by HS code), *last reviewed 29 May 2026*: https://taxsummaries.pwc.com/nigeria/corporate/other-taxes
- trade.gov, *Nigeria — Import Tariffs* (ECOWAS CET five-band; effective rates >50% on 80+ lines, none electronics), published 2025-09-05: https://www.trade.gov/country-commercial-guides/nigeria-import-tariffs
- trade.gov, *Nigeria — Customs Regulations* (ad valorem on CIF, payable in naira on entry; PAAR + Single Window; Nigerian-registered insurance required), 2025-09-05: https://www.trade.gov/country-commercial-guides/nigeria-customs-regulations
- trade.gov, *Nigeria — Prohibited and Restricted Imports* (**POS terminals, electronics, smart cards and telecom/payment equipment are not listed**), updated 2023-06-06: https://www.trade.gov/country-commercial-guides/nigeria-prohibited-and-restricted-imports
- trade.gov, *Nigeria — Import Requirements and Documentation*, 2025-09-05: https://www.trade.gov/country-commercial-guides/nigeria-import-requirements-and-documentation
- NCC Type Approval (*"all telecommunications equipment in operation in the Federal Republic of Nigeria"*; *"manufacturers, vendors and operators … before bringing them into Nigeria"*; fee amounts not published, no stated personal-import exemption): https://ncc.gov.ng/industry/numbering-type-approval/type-approval
- FX: https://www.xe.com/currencyconverter/convert/?Amount=1&From=USD&To=NGN (1 USD = 1,331.8344 NGN, 01:48 UTC 2026-09-20) and https://open.er-api.com/v6/latest/USD (1,335.69, 00:02 UTC 2026-09-20)

**Could not be reached — gaps in this research**
- `customs.gov.ng` (and `/tariff/`, `?page_id=3079`) serves only a header/logo shell to a fetcher — **no live Nigerian tariff lookup obtained**.
- `nigeriatradeportal.gov.ng` and `trade.gov.ng` do not resolve; `nigeriatradehub.gov.ng` serves an empty directory index.
- `dhl.com` Nigeria pages timed out and `mydhl.dhl.com` does not resolve — **no DHL rate card or committed transit time for Nigeria**.
- ERS Online (UK) delivery pages 404; Satomar (CZ) and All-Star (US) international-shipping policies not checked — **all three are Unconfirmed for Nigeria**.
- `santandertrade.com` and `acs.com.hk/en/distributor/` (403) unreachable — **no confirmed ACS distributor list for West Africa**.
- Konga returned no product data to an automated fetch.
- **WebSearch was unavailable for this research** (session budget exhausted), so everything above comes from direct vendor and marketplace page fetches rather than search results. There may be Nigerian importers with no marketplace presence — a phone round of Computer Village dealers would be the way to find them.
