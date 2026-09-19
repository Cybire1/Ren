# Kova Terminal: POS hardware buying guide

Researched **2026-09-19** for a purchase this week; hackathon submission **2026-10-12**. Sources are
vendor developer docs, decompiled/inspected SDK binaries, npm and Maven metadata, GitHub source, and
live seller pages (§Sources). Prices were read off a live page on 2026-09-19 unless marked
**snippet** (search-result text only) or **Unconfirmed**.

## Bottom line

- **Terminal: SUNMI V3 in an NFC SKU** — ask for part number **P06100058** (GMS, no scanner, NFC, UK)
  or **P06100077** (GMS, 2D scanner, NFC, EU), ~**£266 ex VAT / €384**, hundreds in stock at ERS (UK)
  and Shop NFC (IT); in the US, All-Star Terminals has the **V3 Plus 3+32 with the +$50 NFC option
  ($449)** or a **V2s 2+16 NFC ($449)**. SUNMI's own V3 developer page says the NFC is the *native
  Android NFC module*, so `react-native-nfc-manager` + `IsoDep` works with no vendor SDK.
- **Open/unlocked twin, buy it at the same time: a carrier-unlocked Pixel 9a/10a on GrapheneOS plus a
  $25–40 Bluetooth 58 mm ESC/POS printer** (~$325–465). Fully open OS, re-lockable bootloader,
  unmodified AOSP NFC stack, same app code. We own **no Android device at all** today, so this is the
  de-risking buy, not a luxury.
- **Fallback if the V3 slips: Telpo TPS900 or a ZCS/Ciontek-class "bitcoin POS"** — those are the only
  terminals with *published, shipping third-party code* doing React Native + `IsoDep.transceive()` of
  custom APDUs. Prices/lead times are unconfirmed, so they are a plan B, not a plan A.
- **Do not buy a PCI/EMV payment terminal** (SUNMI P-series, PAX A920, Nexgo, Newland, Castles):
  production units refuse unsigned APKs and the contactless field lives behind a secure processor.
- **The biggest risk is ADB, not NFC.** SUNMI and iMin both let the reseller *channel* gate USB
  debugging and third-party installs; SUNMI's `com.woyou.udh` decides it from a cloud check. Buy from a
  seller who confirms it in writing and test `adb install` + an ISO-DEP read within an hour of unboxing.

---

## Comparison table

| Model / SKU | Android | Sideload our own APK? | Raw APDU to our JavaCard | Printer + SDK | Scanner | Price (2026-09-19) | Where |
|---|---|---|---|---|---|---|---|
| **SUNMI V3** `P06100058` (GMS/NFC/UK) · `P06100077` (GMS/2D/NFC/EU) · `P06100035` (non-GMS/NFC/EU) | 13 (SUNMI OS 4.0) | Yes by default; **channel can gate it** | **`android.nfc`** — vendor doc: "use the native Android NFC module" | 58 mm; `com.sunmi:printerx` / `printerlibrary`; 3 RN wrappers updated 2025-26 | 5/8 MP cam; 2D engine optional | £265.72 ex VAT (ERS, 832 in stock) · €384 non-GMS (Shop NFC) | ERS UK · Shop NFC IT · RMS UK |
| **SUNMI V3H** (GMS-EDLA, NFC, fingerprint) | 13 | same | same doc line as V3 | 58 mm, same SDK | 2D optional | $570 (All-Star US) · €447–495 (Shop NFC) · £292–324 ex VAT (RMS) | US/UK/EU |
| **SUNMI V3 Plus / V3e** | 13 / 11 | same | V3 Plus: same doc line · V3e: NFC optional, no scanner | 58 mm (+80 mm on Plus) | camera | V3 Plus $399 (no NFC) / **$449 (NFC)** / $549 (4+64 NFC) | All-Star US |
| **SUNMI V2s** (EOL in EU) | 11 | same | no per-model doc line, but non-payment stack; RN NFC reported working on the V2 line | 58 mm, same SDK | 2D optional | $449 (All-Star, 2+16 NFC) | US |
| **SUNMI V2 PRO** (legacy) | 7.1 | same | as above | 58 mm | 2D | ~$87–145 used (**snippet**) | eBay / AliExpress |
| **SUNMI P2 / P3 / P3H** | 11–13 | yes (same debug guide) | **No `android.nfc`**; card path is SunmiPayHardwareService (PayLib `transmitApdu`) | 58/80 mm | 2D | $615–755 (All-Star) | avoid |
| **iMin Swift 2 Pro** `IM-SWIFT2PRONFC` / `I23M02-NFC` / IMI054 | 13, 64-bit, 4+32, GMS | **Yes — docs: third-party installs allowed by default** | **`android.nfc`** — iMin's own RN plugin uses `NfcAdapter` + `IsoDep` tech filter | 58 mm 100 mm/s; official `react-native-printer-imin` | 5 MP camera only | €367.13 inc VAT in stock (Satomar) · £306 inc VAT (UK) · $359 US **sold out** · R4,009 (Chavda ZA) | EU/UK/ZA |
| **iMin Swift 2** IMI058 | 13, **32-bit**, 2+16 | same | same | 58 mm | camera | €307.60 inc VAT, in stock (Satomar) | EU |
| **iMin Swift 2 Ultra** | 13, 4+64 | same | same; **NFC standard-fit** | 58 mm + label | optional Zebra engine | €396.88 ex / €480.22 inc (Satomar) | EU |
| **Telpo TPS900** | up to 14 | **Unconfirmed / conflicting**: no signature gate documented, but Telpo's own Q&A shows production units refusing installs while "developer version" units accept them | **`android.nfc` + `IsoDep.transceive()` proven in shipped RN code**; vendor SDK `Nfc.transmit` / `Picc.command` as backup | yes, `com.telpo…UsbThermalPrinter`; RN/Flutter/Cordova wrappers exist | yes | **Unconfirmed** (distributor) | distributor only |
| **Ciontek CS-series / ZCS Z92 class** ("bitcoin POS") | 13–14 | Yes — sold bare | Stock `NfcAdapter` used by shipped apps (NDEF proven; `IsoDep` **Unconfirmed**); SDK has `PiccCommand` / `PiccApduCmd` | yes, `com.ctk.sdk.PosApiHelper`; RN printer modules exist | camera | €363 inc VAT (bitcoinbazis, Android 14 4G) · Bitcoinize POS v2.1 ~$221 **out of stock** · $99–130/pc Alibaba (**snippet**) | EU shop / Alibaba |
| **Urovo i9100 / i9000s** | **Unconfirmed** | **Unconfirmed** | Vendor SDK only: `PiccManager.apduTransmit` / `RFCardHandlerImpl.exchangeApdu` (public samples on GitHub) | yes | yes | **Unconfirmed** | AliExpress/distributor |
| **PAX A920 Pro** | PayDroid 8.1 | **Live units: no** — "APKs cannot be installed directly on live devices"; needs a **DEBUG** unit (~$486, availability unclear) | Vendor SDK only: `IPicc.isoCommand` / `cmdExchange`; proven against a non-EMV ID card | yes, vendor SDK | yes | debug unit ~$486 (**conflicting stock**) | Visa/Cybersource, PAX distributors |
| **PAX A35 / A77** | 10 / 8.1 | same | same | **no printer** | yes | — | ruled out |
| **Nexgo N86 / N92** | 9 / 13 | Reported impossible without signing (**Unconfirmed**) | SDK `CPUCardHandler.exchangeAPDUCmd` (+ `TYPE_A_CPU`), but SDK is private/DMCA-protected | yes | yes | **Unconfirmed** | avoid |
| **Newland N910 Pro / N950** | 10 / 12 | **Unconfirmed**; signature verification is a per-customer option | SDK `CPUContactlessCard.performAPDU`; SDK via `pos@newlandnpt.com` | 58 mm | yes | **Unconfirmed** | avoid |
| **Castles S1F4 / S1F4 Pro** | 13 | APKs must be CAPGen-signed + ULD-loaded | nothing public | 57/58 mm | optional | **Unconfirmed** | avoid |
| **Generic MTK (ZCS Z92, Senraise H10P, Hosoton, "DTL Android 13 POS")** | 12–14 | usually yes | protocol lists imply ordinary NFC; **Unconfirmed** | AIDL SDK, **no RN bridge on npm** (except the Ciontek/ZCS ones) | camera | ₦225k–250k Lagos · $99–130 Alibaba (**snippet**) | buy in person |
| **Open: Pixel 9a/10a + GrapheneOS + BT 58 mm ESC/POS** | 16 (AOSP) | **Yes**, plus unlock/**re-lock with our own key** | **Stock AOSP NFC stack** | external BT printer; `@vardrz/…escpos-printer`, `@haroldtran/react-native-thermal-printer` | phone camera | $299 used 9a / $424 10a (**article**) + $25–40 printer | anywhere |
| **Open: Raspberry Pi 5 + ACR1252U + USB ESC/POS** | n/a (Linux) | fully open | **PC/SC `SCardTransmit`** — reader does ISO 14443-1..4 in firmware | USB ESC/POS, `python-escpos` / `node-thermal-printer` | Pi Camera 3 or USB scanner | **≈$378** parts | PiShop/Amazon |

"Sideload" = install our own debug-signed APK (`expo run:android` / `adb install`) with no vendor approval.

---

## Buy-now shortlist by region

| Region | First choice | Price | Stock / lead time |
|---|---|---|---|
| UK | SUNMI V3 **P06100058** (8 MP, GMS, no scanner, **NFC**, UK) — ERS Online | £265.72 ex / £318.86 inc VAT | "832 In stock", ready to dispatch |
| EU | SUNMI V3 **P06100077** (GMS, 2D, NFC, EU) — ERS £309.32 ex VAT; or Shop NFC V3 non-GMS €384 | £309 ex VAT / €384 | 793 in stock / in stock |
| EU (cheapest GMS+NFC+printer) | iMin **Swift 2 Pro** IMI054 — Satomar (CZ) | €367.13 inc VAT | ">5 ks" in stock |
| US | SUNMI **V3 Plus 3+32 + the $50 NFC option** ($449) or **V2s 2+16 NFC** ($449) — All-Star Terminals (TX) | $449 | in stock; ships same day before 2 pm CST, 3–5 business days |
| US (Play-certified) | SUNMI **V3H** GMS-EDLA + NFC + fingerprint — All-Star | $570 | in stock |
| South Africa | iMin **Swift 2 Pro 5" NFC** — Chavda International (Sandton) | R4,009 | free delivery >R2,000, ~7 days |
| Nigeria / Kenya | **Buy locally and inspect in person** (Jiji Lagos: Android 13/14 POS with NFC ₦225k–250k). Do the phone+printer build in parallel. Avoid bank-issued Opay/Moniepoint units — locked firmware. | ₦225k–300k | same-day pickup |
| Anywhere (open) | Pixel 9a/10a + GOOJPRT PT-210 (~$25–32) or NETUM NT-1809 ($38.99) | ~$325–465 | phone bought locally same day |

Every AliExpress/Alibaba listing I could read stated **no delivery date**. Do not put the Oct 12 demo
on a China-direct order; AliExpress is fine for the $25 Bluetooth printer.

---

## The four questions, answered

1. **Can we install our own APK?** Yes on SUNMI V-series, iMin, and the generic/ZCS-class terminals —
   with the caveat that both SUNMI and iMin let the *reseller channel* turn on "app-market-only
   installs" and "debugging permission control". No on production PAX (and, reportedly, Nexgo);
   Castles requires CAPGen signing; Telpo sells separate "developer version" units.
2. **Can our app send raw APDUs to a non-EMV ISO-DEP card?** Yes via `android.nfc`/`IsoDep` on the
   SUNMI V3 family (vendor doc), iMin (vendor's own plugin uses `NfcAdapter` + `IsoDep`), Telpo
   TPS-series (shipped third-party RN code) and — NDEF-proven, IsoDep unverified — the ZCS/Ciontek
   class. On PCI terminals it is vendor-SDK only: PAX `IPicc.isoCommand`/`cmdExchange`, Nexgo
   `CPUCardHandler.exchangeAPDUCmd`, Newland `CPUContactlessCard.performAPDU`, Urovo
   `PiccManager.apduTransmit`, Ciontek `PiccCommand`, Telpo `Nfc.transmit`, SUNMI P-series
   `ReadCardOptV2.transmitApdu`. Those all exist and would work in principle, but each needs a custom
   native module vendoring a JAR/AAR into the Expo dev build.
3. **Printer SDK + React Native?** SUNMI: `com.sunmi:printerx:1.0.20` / `printerlibrary:1.0.24` with
   `@mitsuharu/react-native-sunmi-printer-library@3.0.0` (2026-09-07, documents the Expo dev-build
   flow). iMin: official `react-native-printer-imin@0.10.12` (2026-04-30, has a packaging bug — see
   integration notes). Both devices also expose the built-in printer as a **virtual Bluetooth ESC/POS
   printer** (`InnerPrinter` on SUNMI, `BluetoothPrinter` on iMin), so a generic ESC/POS library gives
   one printing path for terminal *and* phone.
4. **Android version / GMS / camera?** Expo SDK 57 is React Native 0.86 with `minSdkVersion 24`, so
   anything from Android 8 up is fine; the V3 and Swift 2 Pro are Android 13. GMS is optional on the
   V3 (order a GMS SKU if we want Play/OTA; the app itself does not need it) and standard on iMin
   Swift. QR scanning runs off the 5/8 MP autofocus rear camera with `expo-camera`; a 2D scan engine
   is an unnecessary paid option.

---

## Open / unlocked options

The brief changed mid-research to "unlocked, open-source". Honest answer: **no Android POS terminal is
open in any meaningful sense.** None publishes an AOSP tree, none ships an unlockable bootloader, none
offers official root images, and neither LineageOS nor postmarketOS has ever had a POS port. The
ladder tops out at "GPL kernel source on written request" plus "buy a debug SKU". If open source is a
hard requirement, the open device is a Pixel on GrapheneOS, or a Raspberry Pi we build ourselves.

### A. Best fully-open option: Pixel + GrapheneOS + Bluetooth ESC/POS printer

- GrapheneOS keeps the stock AOSP NFC stack. GrapheneOS staff: *"NFC is fully supported on
  GrapheneOS… There are multiple tap-to-pay implementations which support GrapheneOS."* Only
  Google-Wallet-style card **emulation** is blocked by Google's attestation policy — Kova is the
  **reader**, so it does not affect us.
- Bootloader unlock is official and you can **re-lock with your own verified-boot key** after the
  ~30-minute web install from a Mac. ADB and sideloading behave like stock AOSP.
- Supported: Pixel 6 → 10a (21 devices; release 2026091700 on 2026-09-17). **Do not buy a Pixel 11** —
  support is undecided as of Sep 2026. Buy a **carrier-unlocked** unit: carrier Pixels have a carrier
  id flashed that disables bootloader unlocking.
- Gotcha: GrapheneOS **ships NFC disabled by default** (optional features off by default, by design).
  One toggle, but it will waste 20 minutes if nobody remembers.
- Cost: Pixel 10a $424 (Amazon, article-derived) or used 9a ~$299, plus a $25–40 58 mm BT printer.
- Trade-off: it does not look like a merchant terminal on camera. For a pilot merchant a phone + belt
  printer is a normal mPOS setup, but the V3 demos better.

Runner-up: **Fairphone (Gen. 6)/FP5** with official LineageOS 23.2 or /e/OS (bootloader lockable;
unlock code no longer required since firmware FP6.QREL.16.69). ~€599–699, ships only to
Murena/Fairphone's listed countries, and there are credible owner reports of flaky, self-disabling NFC
on Gen. 6 — bad risk profile for a one-shot demo.

### B. How open is each POS vendor, really?

| Vendor | Kernel/GPL source | Bootloader unlock | Official dev/root image | ADB reality |
|---|---|---|---|---|
| PAX | GPL source on request (acknowledged in writing; "several weeks" to isolate proprietary code) | No | **Yes — DEBUG-watermarked terminals**: *"On a Debug device, a DEBUG only Not for COMMERCIAL watermark is shown…"*; *"With Live devices… it is impossible to sideload an APK."* | fine on debug units |
| Telpo | none found | No | **Yes — "developer version" units**; a customer reports production units answer "App not installed" and Telpo replies with a key-generation guide + "contact our sales man" | fine on dev units |
| iMin | none | No | No | *"iMin devices allow third-party applications to be installed by default"*; partner-bound units need an e-mailed debug code (30 min, closes on reboot) |
| SUNMI | none (their GitHub org has no kernel/device trees) | No official unlock; V2 PRO has no working fastboot (EDL + testpoints) | No — FAQ: *"Can your device obtain root permission? Answer: No."* | Debugging works by default, **but** `com.woyou.udh` hijacks the ADB authorization dialog, calls `allowUsbDebugging(false, …)` and decides allow/deny from a **cloud check of the reseller channel** |
| Zebra | GPL source on written request | Refused in writing by Zebra staff | No | — |
| Nexgo | none (public SDK clone DMCA'd in Nov 2024) | No | No | reported "ZERO way of sideloading… it HAS to be signed" (**Unconfirmed**, forum) |
| Newland / Castles / Urovo / Ciontek / Hosoton / Senraise | nothing published | No | Castles: CAPGen-signed APKs via ULD loader | Urovo publishes SDK samples on GitHub with no registration |

Community artefacts only: TWRP trees, EDL/Magisk recipes for old SUNMI V1s/V2/M2, a SUNMI V3
debloat/"liberation" kit for ex-fleet units, and `sunmi-udh-proxy`, a 25 KB APK that fakes the UDH
cloud responses so ADB authorisation survives.

### C. The community "bitcoin POS" terminals (the most open thing you can actually buy)

The Lightning ecosystem buys bare ZCS/Ciontek-class Android handhelds and installs its own apps:

- **Bitcoinize POS v2.1** — *"Android 14, 64-bit (deGoogled)"*, 58 mm thermal printer, NFC reader,
  6400 mAh, dual SIM 4G, *"install any APK you want"*, ~$221 retail — but **out of stock** today,
  dispatch "within 10 days after payment (DAP)".
- **bitcoinbazis.hu "Android 14 4G Bitcoin POS Terminal"**, €363 incl VAT, *"ISO/IEC 14443 and 15693 –
  Type A/B cards, Mifare, Felica support"*, 58 mm printer at 80 mm/s, ships with no vendor app.
- These are the same hardware class LaWallet and Bolt Card PoS target, and those projects use the
  **stock `NfcAdapter`** (Bolt Card PoS is literally React Native with `react-native-nfc-manager`,
  using the Ciontek SDK only for printing). That is encouraging, but their tag traffic is **NDEF**, so
  `IsoDep.transceive()` on these units is still **Unconfirmed**.

Worth one e-mail to Bitcoinize asking "does `IsoDep` work for a custom AID?", not worth blocking on.

### D. DIY fully-open terminal: Raspberry Pi 5 + PC/SC reader + ESC/POS printer

**Verdict: build it after Oct 12, not before.** It is the only option that is open from kernel to
kiosk, and the PC/SC daemon would be a genuinely novel open-source contribution — but it throws away
the React Native app.

One constraint decides the architecture: **Web NFC is NDEF-only by spec** — *"Low-level I/O operations
(e.g. ISO-DEP, NFC-A/B, NFC-F) and Host-based Card Emulation (HCE) are not supported within the
current scope."* So no browser-based POS can carry Kova's APDU exchange; a native local daemon
(PC/SC) must sit behind the UI over WebSocket.

Reader choice is the whole ballgame:

- **ACS ACR1252U (~$45–65)** — handles ISO 14443 parts 1–4 in firmware, so our SELECT + sign is one
  `SCardTransmit`. It is the reader Coinkite ships for cards that do on-chip ECDSA.
- **Do not buy the ACR122U.** The CCID maintainer's unsupported list flags *"No extended APDU"* and
  *"Time extension requests are not supported"*, and it resets on long card operations — exactly our
  100–500 ms signing call.
- Spares of different silicon: Identiv uTrust 3700F ($67.79) or ACR1552U ($59).
- Skip PN532 (libnfc 1.8.0 is from 2020; a known Adafruit issue times out on >23-byte APDUs to JCOP),
  PN7150/PN7160 (NXP's Linux NCI stack needs a Pi 5 GPIO port) and ST25R3916 (companion board obsolete).
- Skip Android-on-Pi: LineageOS for Pi is non-commercial-licensed, and `android.nfc` never sees a USB
  CCID reader anyway — you would need ACS's proprietary Android library.

Parts list (US prices seen 2026-09-19):

| # | Part | Price |
|---|---|---|
| 1 | Raspberry Pi 5 **2 GB** (4 GB $110 / 8 GB $175 after the 2026 DRAM price rises) | $65.00 |
| 2 | Raspberry Pi Touch Display 2, 7" | $81.95 |
| 3 | SmartiPi Touch Pro 3 – Large | $39.95 |
| 4 | SmartiPi Touch Pro 3 – Display Power Kit | $7.95 |
| 5 | Official 27 W USB-C PSU | $12.95 |
| 6 | Active Cooler | $10.95 |
| 7 | microSD 32 GB | $14.95 |
| 8 | **ACS ACR1252U** PC/SC reader | $64.99 |
| 9 | 58 mm USB ESC/POS desktop printer (own AC adapter) | $45.99 |
| 10 | Camera Module 3 + Pi 5 camera cable | $29.25 + $3.95 |
| | **Total** | **≈ $378** (budget variant with a 5" display and USB QR scanner ≈ $270) |

Software: Raspberry Pi OS → `pcscd` + `libccid` (PCSC 2.5.2 released 2026-09-19, CCID 1.8.3
2026-08-29) → `pyscard` 2.3.1 (or Node `pcsc-mini`, which ships prebuilt aarch64 binaries) → WebSocket
→ Chromium `--kiosk`. Avoid `nfc-pcsc` (last published 2022; its auto-processing sends its own SELECT
to ISO 14443-4 cards — set `autoProcessing = false` if you use it at all).

Effort: **≈18–30 h** (3–4 focused days) plus shipping. Reliability risks: never power the thermal
printer from the Pi (brown-outs → USB resets → reader vanishes mid-transaction → SD corruption); the
Pi 5 wants the 27 W supply; cheap ESC/POS clones vary in `GS ( k` QR support, so keep a raster QR
fallback.

### E. Open-source projects to cite or reuse

- **Architectural precedents (the right ones to cite):** **Status Keycard** — JavaCard applet,
  Apache-2.0, *"Communication with the Keycard happens through a simple APDU interface… compatible
  with any Android phone equipped with NFC, and all USB Smartcard readers"*; **Satochip/Seedkeeper**
  (AGPL applets + `pysatochip` over pyscard/PC/SC); **Coinkite `coinkite-tap-proto`** (NFC cards that
  sign with ECDSA, driven over PC/SC, with the vetted reader list above).
- **POS UX to borrow, not code:** LNbits **TPoS** (MIT, active), **BTCPay Server** Point-of-Sale
  (MIT), **Coinos** (AGPL). All three use Web NFC `NDEFReader`, i.e. NDEF only.
- **Bolt Card** (NTAG424 → LNURLw) is *not* an APDU protocol precedent — a Bolt Card tap is a URL
  read. Its POS app is, however, a working React Native + `react-native-nfc-manager` + Ciontek-printer
  app worth reading.
- **Buyable open hardware:** LNbits shop sells an **LNPoS kit (£30, metal case £45)** and a **TPoS
  thermal receipt printer kit (£35, assembled £50)** — ESP32 devices, no ISO-DEP, but good precedent
  for a companion receipt printer.

---

## Per-candidate notes

### SUNMI V3 family — the pick

- The V3, V3H, V3 PLUS, V3 MIX and P3 MIX developer pages all carry the same line: *"Use the native
  Android NFC module, and if an integration is required, please refer to the document on Native
  Android NFC API of Google."* That single sentence is why the V3 is the pick: `IsoDep.transceive()`
  is the supported path, no vendor SDK in between.
- V3 (model **T5F1A**): SUNMI OS 4.0 on **Android 13**, Qualcomm hexa-core, 3 GB + 32 GB, 6.75"
  720×1600, **58 mm printer at 80 mm/s, receipt + label**, rear 5 MP AF (8 MP optional) with 1D/2D
  reading, **Scanner: Optional**, **NFC: Optional**, **GMS: Optional**, 4G + dual nano-SIM + 2 PSAM,
  dual-band Wi-Fi, BT 5.0, removable 3100 mAh, 419 g.
- NFC module (V3 MIX page, same family): *"Type A&B card, Mifare card, FeLica card / ISO/IEC 14443 and
  ISO 15693 compliant"*, family certified **EMVCo PCD L1 + CPoC** for SoftPOS. EMVCo L1 is an
  ISO 14443-4 conformance test — a good sign for a JCOP4 card.
- **NFC and the scanner are paid options.** ERS lists 5 MP V3 SKUs explicitly as "Non-NFC"; All-Star
  charges +$50 for NFC on the V3 Plus. Order by part number, never by model name.
- Debugging: *"By default, Sunmi devices can be debugged by simply connecting them via USB and enabling
  debug mode through the Settings menu."* But *"SUNMI offers device debugging permission control. Once
  a partner enables this feature in the backend… debugging requires permission obtained via email or
  phone number… Debugging permission control only takes effect for devices that are bound to a partner
  account."* And on the store side: *"If the partner has not opened 'Allow third party App
  installation', its own default users can only install App for the device via the Sunmi App market."*
  Add the reverse-engineered `com.woyou.udh` cloud check and you get the real risk: **a channel-bound
  unit can silently stop authorising ADB**.
- Printer SDKs are public on Maven Central: `com.sunmi:printerx:1.0.20` (new SUNMI Printing SDK,
  updated 2026-06-24) and `com.sunmi:printerlibrary:1.0.24` (AIDL `woyou.aidlservice.jiuiv5`;
  Android 11+ needs a `<queries>` entry).
- Escape hatch: *"In every Bluetooth list of Sunmi devices with print, there will be a Bluetooth signal
  named 'InnerPrinter', which is not different from ordinary Bluetooth as for business App"* — so one
  ESC/POS code path can serve both the V3 and the phone fallback.

### SUNMI V2s / V2 PRO (legacy)

Android 11 / 7.1; flagged **EOL** by Shop NFC in the EU, still sold in the US ($449 for 2+16 NFC at
All-Star) and cheap used (many used listings say "NO NFC" in the title). The V2s developer page has no
NFC section, so the "native Android NFC" wording is not on record for it — though a
`react-native-nfc-manager` issue from a developer running on a "Sunmi V2 Android POS" shows the
library sees the adapter there. Fine as a cheap spare; not the 2026 primary buy.

### SUNMI P2 / P3 / P2 PRO / P3H — avoid

Every P-series developer page routes card handling to **SunmiPayHardwareService** and, unlike the V3
pages, carries **no "native Android NFC" line** (P3 MIX is the exception and documents both). PayLib is
public (`com.sunmi:PayLib-release:2.0.42`); decompiling it shows `ReadCardOptV2` exposes `checkCard`,
`apduCommand`, `smartCardExchange`, `transmitApdu`, `transmitApduEx`, `transmitApduExtended`,
`transmitMultiApdus` — so raw APDU to a non-EMV card is *probably* possible. But it means a custom
native module and a locked-down payment device, when the V3 gives us `android.nfc` for less money.

### iMin Swift 2 / 2 Pro / 2 Ultra — the alternate pick

- **Best sideload policy in the market**: *"iMin devices allow third-party applications to be installed
  by default, and you can also restrict installation permissions through partners."* Developer mode is
  "tap Version 5 times"; USB and wireless ADB are both documented. Partner-bound units can require an
  e-mailed code, and in that mode USB debugging closes on reboot.
- **NFC is the stock Android stack**: iMin publishes no NFC SDK at all (their docs' NFC page is an
  antenna picture), and iMin's own RN plugin `react-native-imin-hardware@0.2.2` implements NFC with
  `android.nfc.NfcAdapter`, `enableForegroundDispatch` and a tech filter of `"android.nfc.tech.IsoDep"`
  — header comment *"Uses Android native NFC API"*. That plugin returns only UID/NDEF/tech, so we still
  use `react-native-nfc-manager` for the APDU exchange; it just proves the stack is there.
- Swift 2 Pro: Android 13 64-bit, 4 GB + 32 GB, GMS, 58 mm at 100 mm/s, 5 MP camera, 3350 mAh.
  **NFC is optional** — the memory row reads *"4GB RAM + 32GB ROM, 4GB RAM + 32GB ROM (NFC)"*. Swift 2
  is 32-bit with 2 GB RAM (thin for an Expo dev build); Swift 2 Ultra has NFC standard-fit.
- No EMV kernel on board (payments are SoftPOS or an external Ingenico/Stripe reader), so the
  contactless field is not captured by a payment SDK.
- Availability is the weakness: the cheap US ($359) and UK (£232) listings are **sold out**; in stock
  are Satomar EU (€307.60 / €367.13 incl VAT) and Chavda ZA (R4,009).
- No public report exists of anyone doing `IsoDep.transceive()` on an iMin device — hence the seller
  test in the checklist below.

### Telpo TPS900 — best-evidenced NFC path, worst-evidenced purchase path

`react-native-calypso-pos` (an npm library that reads Calypso transit smartcards — ISO 14443-4,
non-EMV) detects Telpo with `Build.MODEL.startsWith("TPS")` and drives the card through the **stock
Android stack**: `NfcAdapter.getDefaultAdapter(activity)`, `enableForegroundDispatch(…, arrayOf(arrayOf(IsoDep::class.java.name)))`,
`isoDep.timeout = 5000`, `isoDep.transceive(apdu)` — using the Telpo SDK only for the SAM slots and the
printer. That is the closest published precedent to exactly what Kova needs. The vendor SDK also offers
`com.common.sdk.nfc.Nfc.transmit()` and the older `Picc.command()` as a fallback, and RN/Flutter/Cordova
wrappers exist. Blockers: price and single-unit availability are **Unconfirmed** (distributor channel),
and the sideloading picture is contradictory — no signature gate is documented, yet Telpo's own Q&A has
a customer whose production devices answer "App not installed" while their "debugging device, with
developer mode" installs fine. Keep as plan B; if we ever buy a second terminal, ask Telpo for a
developer unit.

### Ciontek / ZCS Z92 class ("bitcoin POS") — the open-ish wildcard

Non-PCI, sold bare to individuals, cheap, and the Lightning ecosystem has been shipping React Native
and Flutter apps on them for years: Bolt Card PoS uses `react-native-nfc-manager` for the tag and the
Ciontek `PosApiHelper` only for printing; LaWallet's native contract documents plain `NfcAdapter`
foreground dispatch on "Ciontek CS30Pro and ZCS Z92 terminals". The Ciontek SDK itself documents
`PiccCommand(byte[] apduSend, byte[] apduResp)` — *"Handle the APDU card command"* — and
`PiccApduCmd`, with the gotcha *"If both LC and LE exist, you should set LC = X; LE = 0x01"*. All the
public code targets CS10/CS30Pro/CS50, not the CS20/CM30 in our candidate list, and all of it does
**NDEF**, not ISO-DEP — so `IsoDep` here is plausible but unproven.

### PAX / Nexgo / Newland / Castles / Urovo — avoid for this build

- **PAX**: the APDU path genuinely works (`IPicc.isoCommand(cid, send)` — *"send data of APDU format to
  card and receive response"* — and `cmdExchange`, with a working precedent: an Italian electronic-ID
  reader app that calls `reader.cmdExchange(apdu, 0)` against a non-payment ISO-DEP card). But
  *"For security reasons, APKs cannot be installed directly on live devices"*, debug terminals are
  ordered through Visa/Cybersource (~$486, stock conflicting), the NeptuneLite SDK needs
  developer.pax.us registration, and anything live must be PAXSTORE-signed. Three weeks is not enough.
- **Nexgo**: SDK is capable (`CPUCardHandler.exchangeAPDUCmd`, card type `TYPE_A_CPU`) but the Android
  SDK repo is private and Nexgo DMCA'd a public clone in Nov 2024; retail N86 units reportedly reject
  unsigned APKs.
- **Newland**: `CPUContactlessCard.performAPDU(byte[])` is exactly the right API, but the SDK comes via
  `pos@newlandnpt.com` and N910 Pro marketing advertises customisable signature verification.
- **Urovo**: the best-documented of the PCI group — `android.device.PiccManager.apduTransmit(...)` and
  the newer `RFCardHandlerImpl.exchangeApdu(...)` with runnable samples on GitHub, no registration. But
  sideloading, Android version, GMS and price are all unverified, and the same app ecosystem suggests
  `android.nfc` is *not* the path there.
- **Castles**: nothing public at all — no SDK, no developer site (`developer.castlestech.com` does not
  resolve), APKs must be CAPGen-signed and loaded through the ULD key system.
- Buying a used PCI terminal on eBay is a trap: they are routinely locked to a processor and a live PAX
  can only be updated through its marketplace owner's PAXSTORE.

### Fallback: NFC Android phone + Bluetooth 58 mm printer

- Phone: Pixel 10a $424 (Amazon, article-derived), used Pixel 9a ~$299, or Galaxy A17 5G $249.99.
  **Check NFC on the exact model code** — GSMArena lists A17 NFC as *"Yes (market/region dependent)"*
  and some A-series variants ship without it. Pixels are safest for JavaCard work.
- Printer: GOOJPRT PT-210 ~$25–32 (AliExpress), NETUM NT-1809 $38.99 MSRP, MUNBYN/Rongta $30–60.
  Insist on **ESC/POS over Bluetooth Classic/SPP** ("works with Android, not iOS/Square" is the tell);
  avoid BLE-only "cat" printers (Phomemo M02 class).
- RN libraries with 2026 releases: `@vardrz/react-native-bluetooth-escpos-printer` 0.1.2 (2026-01-23,
  MIT) and `@haroldtran/react-native-thermal-printer` 1.2.0 (2026-03-04). The classic
  `react-native-bluetooth-escpos-printer` is dead (2019).
- Known phone-side issues to code around: Android 12+ throws `SecurityException: Tag is out of date`
  when the card leaves the field mid-exchange; long JavaCard crypto causes `TagLostException` unless
  `IsoDep.setTimeout()` is raised; `getMaxTransceiveLength()` is commonly ~261 bytes, so chunk to ≤255
  data bytes (Yubico shipped exactly this guard); magnetic card-holder cases break NFC.

---

## Questions to ask the seller before paying

Send this verbatim. A seller who cannot answer 1–4 is the wrong seller.

1. **Exact part number** — e.g. SUNMI V3 `P06100058` / `P06100077`, or iMin `IM-SWIFT2PRONFC` /
   `I23M02-NFC`. "V3" or "Swift 2 Pro" alone is not an answer: **NFC is a paid hardware option on both
   lines**.
2. **"Does this unit physically have the NFC reader fitted?"** Ask for a photo of *Settings → Connected
   devices → NFC* on the actual unit.
3. **"Please install the free 'NFC TagInfo by NXP' app on the unit and send a screenshot of it reading
   any contactless bank card, showing the `IsoDep` / ISO 14443-4 line."** This proves the reader is
   exposed to the standard Android NFC API and not behind a payment SDK — the single most valuable
   pre-purchase test.
4. **"Is the device bound to a partner/reseller channel with USB-debugging permission control or
   'app-market-only installation' enabled?"** We must be able to enable Developer options, run
   `adb install` of our own debug-signed APK, and keep that authorisation after a reboot.
5. **"Is this the non-PCI / non-EMV version?"** (SUNMI: V-series not P-series. Any other vendor:
   confirm the contactless antenna is wired to the Android NFC controller, not to a secure payment
   processor.)
6. **"Is it new or ex-fleet?"** Refuse ex-merchant-fleet units: they carry a Device Owner MDM and lease
   locks that cannot be removed without a reflash.
7. **Android version, firmware build, and GMS or non-GMS.** (Non-GMS is fine for our app; GMS is nicer
   for Play testing and OTA install.)
8. **Region firmware, LTE bands for our country, and which power adapter** (UK/EU/US) is in the box.
9. **Printer**: 58 mm, paper roll diameter (40 vs 50 mm), and please include 5–10 rolls.
10. **Delivery**: courier, tracking, landed date, duties/VAT prepaid (DDP)? We need it in hand by
    **2026-09-30** to leave two weeks of integration.
11. **Returns**: is there a return window if the reader cannot read our ISO 14443-4 card? (All-Star
    charges 25% restocking on opened terminals; RMS marks some SKUs non-returnable.)
12. If it is a payment-terminal vendor (PAX/Telpo/Nexgo/Newland/Castles/Urovo): **"Is this a
    developer/debug unit that accepts unsigned APKs, or a production unit that only installs from your
    store?"**, **"Is the contactless SDK publicly downloadable without an NDA?"**, and **"Can it send
    arbitrary ISO 14443-4 APDUs to a non-EMV AID (our own applet, not a payment applet)?"**
13. For a phone: **"Is it carrier-unlocked (not a Verizon/carrier SKU)?"** and **"Does this exact model
    code have NFC?"**

---

## If we pick the SUNMI V3: integration notes

**NFC (the part that must work)**

- Stack: `react-native-nfc-manager@3.17.2` (MIT, published 2025-11-28). It ships an Expo config plugin
  (`app.plugin.js`), so it works in an Expo **dev build** (not Expo Go).
- Use reader mode, not foreground dispatch. `requestTechnology` forwards its options to
  `registerTagEvent`, and the defaults are `isReaderModeEnabled: false`, so set it explicitly:

  ```ts
  await NfcManager.requestTechnology(NfcTech.IsoDep, {
    isReaderModeEnabled: true,
    readerModeFlags:
      NfcAdapter.FLAG_READER_NFC_A |            // 0x1
      NfcAdapter.FLAG_READER_NFC_B |            // 0x2
      NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK |  // 0x80
      NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS,// 0x100
    readerModeDelay: 250,
  });
  await NfcManager.isoDepHandler.setTimeout(5000);
  ```

  `SKIP_NDEF_CHECK` stops the platform probing for NDEF before we talk to the applet;
  `NO_PLATFORM_SOUNDS` lets us play our own "tap accepted" sound at the right moment.
- **Raise the timeout before the first `transceive`.** AOSP's default ISO-DEP transceive timeout is
  **618 ms** (`packages/apps/Nfc`, `nci/jni/NfcTag.cpp`), and a JCOP4 applet that verifies a P-256
  approval signature and then signs can exceed it.
- Log `getMaxTransceiveLength()` once. Our SELECT + ~100-byte sign command are short APDUs, well under
  the ~255-byte data limit, so extended APDUs are never needed — but a small reported maximum is a red
  flag worth catching on day one.
- Handle `61xx` (GET RESPONSE) and `6Cxx` even though a T=CL applet normally returns data directly, and
  treat `TagLostException` / "Tag is out of date" as "hold the card still", not as a payment failure.
- Signature handling is already specified in `docs/tempo/02`: the card gets
  `keccak256(0x04 ‖ sigHash ‖ userAccount)` (the V2 keychain digest, **not** the raw tx hash); its DER
  output is converted to raw `r‖s`, **normalised to low-s**, and sent with `pre_hash = 1`.
- Keep the tap short: fetch the Kova approval signature *before* the customer taps, so the card session
  is one SELECT + one sign.

**Printer**

- Option 1 (native SDK): `@mitsuharu/react-native-sunmi-printer-library@3.0.0` (MIT, 2026-09-07). It
  wraps `com.sunmi:printerlibrary:1.0.24`, already declares
  `<queries><package android:name="woyou.aidlservice.jiuiv5"/></queries>` for Android 11+, documents
  the Expo dev-build flow (`expo install expo-dev-client …`, `expo prebuild`, `expo run:android`) and
  exposes `printText`, `printImage`, `printQRCode` and layout APIs. Verified by its author on V2 PRO
  and V2s; V3 is **Unconfirmed** but uses the same AIDL service.
- Option 2 (one code path for everything): ESC/POS over Bluetooth to the virtual **`InnerPrinter`**
  device on the V3 and to the external printer on the phone, via
  `@vardrz/react-native-bluetooth-escpos-printer`. Less pretty, zero extra code for the fallback rig.
- Receipt: amount, merchant, timestamp, short Tempo tx hash, and a QR of the explorer URL. The 58 mm
  head is 384 px wide.

**QR**

- Scanning: `expo-camera` 57.0.5 (`CameraView` + `barcodeScannerSettings`) on the autofocus rear
  camera. A 2D scan-engine SKU would need SUNMI's scanner SDK (broadcast/intent based) — extra work,
  not needed.
- Showing: render on screen for wallet-to-merchant payments, and print on the receipt for the
  pay-later/refund flow.

**Build / first hour**

- Expo SDK 57 → React Native 0.86, `minSdkVersion` 24. Most printer/NFC modules here are
  old-architecture bridge modules; if a New Architecture build misbehaves, set `newArchEnabled=false`
  in the dev build.
- On-arrival checklist, all five within the first hour: Developer options → USB debugging → `adb
  devices` sees it → `adb install` a hello-world APK → NFC toggle exists → NXP TagInfo reads a bank
  card as `IsoDep` → test receipt prints. If any step fails, start the return conversation immediately,
  not in October.

**Known pitfalls**

- NFC and the scanner are optional SKUs — a "V3" without NFC is an expensive receipt printer.
- Channel-bound units can lose ADB after they phone home (`com.woyou.udh`); a factory reset *before*
  the first Wi-Fi connection leaves the channel at the default "sunmi" value, which auto-allows.
- SUNMI OS cleans up background apps aggressively (their docs have a page on avoiding app data being
  cleared). Pin the app and disable battery optimisation before the demo.
- No root on any SUNMI device (their FAQ says so) — do not plan anything that needs it.
- If we pick **iMin** instead: `react-native-printer-imin@0.10.12` has a broken Gradle line —
  `implementation files('libs\\iminPrinterSDK-15_V1.3.2_2505261539.jar')` (a Windows path that will not
  resolve on macOS/Linux) next to `com.github.iminsoftware:IminPrinterLibrary:V2.0.0.18`, which needs
  the **JitPack** repository added. Budget an hour and a `patch-package` fix.

---

## What to order this week

| # | Item | Why | Cost |
|---|---|---|---|
| 1 | SUNMI V3 NFC SKU (`P06100058` UK / `P06100077` EU; V3 Plus +NFC or V2s NFC in the US) | the demo terminal | £266 ex VAT / $449 |
| 2 | Carrier-unlocked Pixel 9a or 10a (then flash GrapheneOS) | the open, guaranteed-working NFC device; we own no Android today | $299–424 |
| 3 | 58 mm Bluetooth ESC/POS printer (GOOJPRT PT-210 / NETUM NT-1809) | fallback receipts + the phone-mPOS demo | $25–40 |
| 4 | 10× 58 mm × 40 mm thermal rolls, USB-C cables, power bank | consumables | ~$25 |
| 5 | (optional, post-hackathon) Pi 5 + ACR1252U kit | the fully-open terminal and an open-source PC/SC daemon to publish | ~$378 |

Hardware total for the demo path: **≈ $800–950**, and we keep a working terminal plus a working
open-source handheld afterwards.

---

## Sources

**SUNMI developer documentation** (docs.sunmi.com is a Next.js app; content lives in the RSC payload —
these are the canonical article URLs)

- V3 (Android 13 specs; "Use the native Android NFC module…"): https://docs.sunmi.com/en-US/ceghjk502/xqdxeghjk491
- V3H https://docs.sunmi.com/en-US/ceghjk502/xmmieghjk579 · V3 PLUS https://docs.sunmi.com/en-US/ceghjk502/xmmzeghjk557 · V3e https://docs.sunmi.com/en-US/ceghjk502/xmmmeghjk546
- V3 MIX (NFC protocol list; EMVCo PCD L1 & CPoC): https://docs.sunmi.com/en-US/ceghjk502/idaeghjk480 · P3 MIX (both native NFC and PayHardwareService): https://docs.sunmi.com/en-US/ceghjk502/iireghjk568
- P2 / P2 PRO / P3 / P3H (PayHardwareService only, no NFC section): https://docs.sunmi.com/en-US/ceghjk502/qcceghjk502 · .../qcxeghjk491 · .../xcqreghjk568 · .../xdqqeghjk513
- V2s / V2s PLUS / V2 PRO: https://docs.sunmi.com/en-US/ceghjk502/fxdeghjk524 · .../fxceghjk502 · .../czceghjk502
- USB Debugging Management (default debugging; partner permission control): https://docs.sunmi.com/en-US/cdixeghjk491/xdrzeghjk557
- Integration FAQ (no root; app-market-only installs; "InnerPrinter"): https://docs.sunmi.com/en-US/cdixeghjk491/xfiieghjk579 · App release ("Allow third party App installation"): https://docs.sunmi.com/en/appstore/app-release/
- Printing SDK overview (`printerx:1.0.20`): https://docs.sunmi.com/en-US/cdixeghjk491/xdzceghjk502 · built-in printer SDK versions (`printerlibrary:1.0.24`, `<queries>`): https://docs.sunmi.com/en-US/cdixeghjk491/xdifeghjk535
- Payment SDK for P-series ("financial SDK based on SP (secure processor)… check card, APDU exchange"): https://docs.sunmi.com/en-US/cdixeghjk491/xfdqeghjk513
- Maven Central: https://repo1.maven.org/maven2/com/sunmi/ — `PayLib-release` 2.0.42 (2026-06-12), `printerx` 1.0.20 (2026-06-24), `printerlibrary` 1.0.24 (2025-05-06). `ReadCardOptV2` method names read out of the 2.0.42 AAR locally.

**iMin developer documentation**

- NFC section (antenna picture only — no NFC SDK exists): https://oss-sg.imin.sg/docs/en/GeneralFunctionModules.html#nfc · hardware SDK API (no contactless APIs; PSAM only): https://oss-sg.imin.sg/docs/en/SDK.html
- Docking & debugging ("allow third-party applications… by default"; partner debug control): https://oss-sg.imin.sg/docs/en/DockingDebugging.html · app store toggle: https://oss-sg.imin.sg/docs/en/AppStore.html · Q&A (no root; `BluetoothPrinter`): https://oss-sg.imin.sg/docs/en/Q%26A.html · printer SDK v1 vs v2: https://oss-sg.imin.sg/docs/en/Printer.html
- Spec pages: https://www.imin.com/product/swift-2-pro/ · /swift-2/ · /swift-2-ultra/ · /swift-1-pro/ · security-patch policy https://www.imin.com/android-security-patch-policy/
- `react-native-imin-hardware@0.2.2` (`NfcHandler.java` = `NfcAdapter` + `"android.nfc.tech.IsoDep"`): https://www.npmjs.com/package/react-native-imin-hardware (repo https://github.com/iminsoftware/ReactNativeApiTest) · `react-native-printer-imin@0.10.12`: https://github.com/iminsoftware/react-native-printer-imin

**Other vendors**

- PAX debug vs live units + debug-unit ordering: https://developer.cybersource.com/docs/cybs/en-us/pax-a920pro/activation/all/pax-a920pro/pax-a920pro.html · https://payworks.mpymnt.com/pax-a920-faq.html · PAXSTORE signing: https://faqs.pax.us/wp-content/uploads/2021/05/PAXSTORE-Developer-Guide-V2.10-05-17-2021-2.pdf · NeptuneLite `IPicc` javadoc: https://github.com/Theta-Travel/pax-neptunelite-api · non-EMV ISO-DEP precedent: https://github.com/tdiego95/CIEReader · GPL correspondence https://git.lsd.cat/g/pax-pwn · root CVEs https://blog.stmcyber.com/pax-pos-cves-2023/
- Telpo: RN + `IsoDep.transceive` on TPS-series https://github.com/genesisxyz/react-native-calypso-pos · vendor NFC SDK demo https://github.com/patricklobo/com-patricklobo-tps900 · developer-version units / signing https://www.telpo.vip/index.php?qa=283 · https://www.telpo.vip/index.php?qa=908 · TPS900 specs https://www.telpo.com.cn/uploadfiles/2021/10/Telpo-TPS900-Specifications.pdf
- Ciontek/ZCS: SDK `PosApiHelper` with `PiccCommand`/`PiccApduCmd` https://github.com/boltcard/bolt-card-pos · LaWallet native contract (stock `NfcAdapter` on CS30Pro / Z92) https://github.com/lawalletio/flutter-pos · hardware-class overview https://github.com/guggero/awesome-bitcoin-nfc
- Nexgo SDK DMCA takedown: https://github.com/github/dmca/blob/master/2024/11/2024-11-04-nexgo.md · SDK classes read from `nexgo-smartpos-sdk-v3.0.3.aar` in https://github.com/SnorSnor9998/Nexgo-EMV-example · N92 https://www.nexgoglobal.com/smart-pos/n92.html
- Newland NSDK javadoc (`CPUContactlessCard.performAPDU`): https://github.com/bruno-pinto-git/tessera (`docs/nsdk-api/`) · N910 Pro https://www.cn.newlandnpt.com/product/znzd/wlb/2024/10/n910pro.htm · N950 https://www.newlandnpt.com/products/smartpos/146771.html
- Urovo SDK samples + `PiccManager` javadoc: https://github.com/urovosamples/SDK_ReleaseforAndroid · `exchangeApdu` sample https://github.com/sergi-s/UROVO-POS-NFC
- Castles S1F4 / S1F4 PRO: https://www.castlestech.com/products/s1f4/ · https://www.castlestech.com/products/s1f4-pro/
- Zebra open-source/GPL: https://www.zebra.com/us/en/about-zebra/company-information/legal/open-source-usage.html · Zebra refusing bootloader unlock: https://developer.zebra.com/content/tc520k-bootloader-unlock-possibility-or-pipe-dream

**Open / unlocked**

- GrapheneOS: NFC fully supported https://discuss.grapheneos.org/d/27904-nfc-on-grapheneos-totally-impossible · features (optional features off by default) https://grapheneos.org/features · supported devices + carrier-lock warning https://grapheneos.org/faq · web install / re-lock with own key https://grapheneos.org/install/web · releases https://grapheneos.org/releases · Pixel 11 uncertainty https://www.privacyguides.org/news/2026/09/01/pixel-11-has-hardware-mte-support-may-still-be-usable-for-grapheneos/ · Pixel device trees removed from AOSP https://discuss.grapheneos.org/d/25099-pixel-10-support-for-grapheneos-is-now-available
- LineageOS device list (no POS vendor; Fairphone + SHIFT present): https://wiki.lineageos.org/devices/ · /e/OS FP6 (bootloader lockable): https://doc.e.foundation/devices/FP6/ · Murena/Fairphone shops https://murena.com/america/shop/smartphones/brand-new/murena-fairphone-6/ · https://us.fairphone.com/
- SUNMI ADB gating reverse-engineered (`com.woyou.udh`, cloud channel check): https://github.com/frappy21/sunmi-udh-proxy · ex-fleet V3 MDM/lease lock https://github.com/simone199615-stack/sunmi-v3-liberation · V2 PRO EDL rooting https://github.com/gzalo/sunmi-v2-pro
- Web NFC scope (NDEF only; no ISO-DEP): https://w3c-cg.github.io/web-nfc/
- Readers: ACR122U limitations on the CCID unsupported list https://ccid.apdu.fr/ccid/unsupported.html · ACR1252U API ("ACR1252U will handle the ISO 14443 Parts 1-4 Protocols internally") https://acs.comitex.net/wp-content/uploads/2016/07/API-ACR1252U-1.08.pdf · Coinkite's tested-reader list https://github.com/coinkite/coinkite-tap-proto · CCID should-work list https://ccid.apdu.fr/ccid/shouldwork.html
- JavaCard-over-ISO-DEP precedents: Status Keycard https://github.com/keycard-tech/status-keycard · Satochip applet + `pysatochip` https://github.com/Toporin/SatochipApplet
- Open POS projects: LNbits TPoS https://github.com/lnbits/tpos · BTCPay Server https://github.com/btcpayserver/btcpayserver · Bolt Card https://github.com/boltcard/boltcard · LNPoS + LNbits shop kits https://github.com/lnbits/lnpos , https://shop.lnbits.com/product-category/hardware/point-of-sale-devices
- Community terminals: Bitcoinize POS v2.1 (Android 14 deGoogled, "install any APK you want", out of stock) https://bitcoinize.com/product/bitcoinize-point-of-sale-machine/ · bitcoinbazis Android 14 4G POS €363 https://shop.bitcoinbazis.hu/en/termek/bitcoin-android-14-4g-pos-terminal/
- DIY parts: https://www.pishop.us/product/raspberry-pi-5-2gb/ · /raspberry-pi-touch-display-2/ · /smartipi-touch-pro-3-large/ · ACR1252U https://www.amazon.com/dp/B01KIKBYAG · Pi 5 power requirements https://www.raspberrypi.com/documentation/computers/raspberry-pi.html · 2026 Pi price rises https://www.raspberrypi.com/news/more-memory-driven-price-rises/

**React Native / Expo / AOSP**

- `react-native-nfc-manager@3.17.2` (IsoDep transceive/setTimeout/getMaxTransceiveLength; reader-mode flags; Expo plugin): https://github.com/whitedogg13/react-native-nfc-manager · developer running it on a "Sunmi V2 Android POS": https://github.com/revtel/react-native-nfc-manager/issues/776
- `@mitsuharu/react-native-sunmi-printer-library@3.0.0`: https://github.com/mitsuharu/react-native-sunmi-printer-library · `@vardrz/react-native-bluetooth-escpos-printer@0.1.2` · `@haroldtran/react-native-thermal-printer@1.2.0` · `expo-camera@57.0.5` (all npm, checked 2026-09-19)
- AOSP default ISO-DEP transceive timeout = 618 ms: https://android.googlesource.com/platform/packages/apps/Nfc/+/refs/heads/android14-release/nci/jni/NfcTag.cpp (`nci/jni/NfcTag.cpp`)
- Expo SDK 57.0.24 → React Native 0.86.3; `expo-modules-core` default `minSdkVersion 24`; RN 0.87 `gradle/libs.versions.toml` minSdk 24 / targetSdk 36 (npm, 2026-09-19)

**Sellers (all seen 2026-09-19)**

- ERS Online (UK) V3 SKU table with stock counts: https://www.ers-online.co.uk/p14055/sunmi-v3-smart-mobile-terminal-with-integrated-printer · RMS EPoS https://rmspos.co.uk/product/sunmi-v3-handheld-pos-terminal/
- Shop NFC (IT): V3 non-GMS €384 https://www.shopnfc.com/en/payments-and-ticketing/670-sunmi-v3-smart-pos-terminal-with-nfc.html · V2s/V2s Plus EOL https://shopnfc.com/en/80-sunmi
- All-Star Terminals (US): V2s $449 https://allstarterminals.com/products/sunmi-v2s-all-in-one-pos · V3 Plus (+$50 NFC) https://allstarterminals.com/products/sunmi-v3-plus-all-in-one-pos · V3H $570 https://allstarterminals.com/products/sunmi-v3h-mobile-pos-printer
- Satomar (CZ) iMin Swift 2 €307.60 / Swift 2 Pro €367.13 incl VAT, in stock: https://www.satomar.shop/en/imin-swift-2/ · Chavda (ZA) Swift 2 Pro NFC R4,009 https://chavda.com/products/imin-swift-2-pro-5-android-13-core-8-2-0-4gb-32gb-nfc-pos-mobile · Smartcommerce (US) $359 **sold out** https://store.smartcosta.com/products/swift-2-pro-nfc-gms-original-imin-product-smartphone-with-nfc-technology-and-gms-high-speed-device-advanced-android-operating-system
- Jiji Nigeria (Lagos, in person): https://jiji.ng/search?query=android%20pos%20nfc%20printer
- Phones/printers: Pixel 10a $424 https://www.androidauthority.com/google-pixel-10a-deal-amazon-3712513/ · Galaxy A17 5G $249.99 https://www.samsung.com/us/smartphones/galaxy-a17-5g/buy/ · A17 NFC "market/region dependent" https://www.gsmarena.com/samsung_galaxy_a17_5g-14041.php · NETUM NT-1809 $38.99 https://netum.net/products/netum-portable-58mm-bluetooth-thermal-printer-nt-1809 · GOOJPRT PT-210 ~$25–32 https://www.aliexpress.com/w/wholesale-goojprt-pt-210.html

**Unconfirmed / conflicting — read before spending**

- Nobody has publicly reported `IsoDep.transceive()` on an **iMin** device, and SUNMI's "native Android
  NFC" wording is published for the **V3 family**, not the V2s. Both are strong inferences, not proof —
  hence question 3 in the seller checklist.
- **Telpo sideloading** is contradictory: no signature gate is documented, but Telpo's own Q&A shows
  production units refusing installs while "developer version" units accept them.
- **Ciontek/ZCS** evidence is NDEF-only and targets CS10/CS30Pro/CS50, not the CS20/CM30 in the brief.
- Amazon, eBay, Walmart, Rosper, barcodesinc and Takealot block automated fetching; every price
  attributed to them is search-snippet text and must be re-checked in a browser. Shop NFC does not say
  whether its prices include Italian VAT. The PAX debug-unit page returned "Sold out" in HTML while its
  JSON said available.
- Whether SUNMI P-series `transmitApdu`, PAX `isoCommand`, Newland `performAPDU`, Nexgo
  `exchangeAPDUCmd` or Urovo `apduTransmit` behave correctly against *our* AID was not tested by anyone
  we could find (the PAX CIE-reader app is the closest: a non-payment ISO-DEP card over
  `cmdExchange`).
- No vendor document states that the ACR1252U relays S(WTX) during a ~500 ms card operation; the
  evidence is indirect (Coinkite ships it for cards that sign on-chip). Bench-test it before relying
  on it.
