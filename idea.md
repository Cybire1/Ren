# Kova Stalls and the pocket till

Ideas agreed on 24 September 2026. The goal: any local business, from a market table to a
corner shop, can list what it sells, check customers out, and get paid through Kova, with
nothing but a phone.

## The one-liner

A stall is a pocket shop: a link and a QR code with your items and prices. Anyone, anywhere
pays in dollars with Kova, and the money is in your own wallet a second later.

## Who it is for

- **Market and food traders.** A QR code on the table; the customer's phone is the till.
- **WhatsApp and Instagram sellers.** The stall link goes in the bio or a status.
- **Pop-ups and event vendors.** A stall for the weekend, like every stall at a fair.
- **Small shops without a barcode scanner or POS.** The phone's camera becomes both.
- **Diaspora buyers.** Paying a Lagos seller from London, which is painful today.

## What exists today, and the gap

| Option | What it does | Where it falls short |
| --- | --- | --- |
| Paystack Storefront | Free store link (`paystack.shop/yourstore`), cards, bank transfer, mobile money | Fees per sale, payouts take days, hard to pay from abroad |
| Flutterwave Store | Paystack's rival store builder, share a link and sell | Same card and bank rails |
| Bumpa | Full social-commerce kit for Nigerian sellers, with a POS | A business system to learn; card and bank rails |
| Selar | Digital products (ebooks, courses) | Not for physical goods or a market stall |
| Stripe and Shopify, USDC | Stablecoin checkout for Shopify merchants in 34 countries | Online stores on big platforms; pays out to a bank by default |
| Coinbase Commerce, BitPay, NOWPayments | Hosted crypto checkout | Built for websites, not a trader at a table |

The gap: nobody gives a small seller a stall link and a phone till that anyone, anywhere can
pay in dollars, settling into the seller's own wallet in about a second, with no card fees.

Sources: [Paystack Storefront](https://paystack.com/storefront),
[Bumpa on Paystack Storefront alternatives](https://www.getbumpa.com/blog/paystack-storefront-alternatives),
[Stripe and Shopify stablecoin payments](https://stripe.com/newsroom/news/shopify-stripe-stablecoin-payments),
[Finextra on Shopify, Coinbase and Stripe USDC](https://www.finextra.com/newsarticle/46152/shopify-coinbase-stripe-bring-usdc-stablecoin-payments-to-merchants),
[stablecoin gateways overview](https://eco.com/support/en/articles/15083176-stablecoin-payment-gateways-shopify).

## Why Kova wins

- **Dollars from anywhere.** Diaspora and tourists pay; the seller holds dollars, not a
  falling currency.
- **Paid in about a second, to your own wallet.** No payout delays, no frozen balances.
- **No card fees.** Kova pays the network fee.
- **Everyone sees their own money.** Naira, euros, pounds or dollars on the same price.
- **One app.** The seller's Kova Pay wallet is also their till and their stall.

## How it works

1. **Open a stall** in about a minute, from the Kova app or the web dashboard: name, items with
   prices and photos, open or closed.
2. **Share it.** A link for WhatsApp and Instagram, and a printable QR poster for the table.
3. **The buyer pays.** Open the link (no account needed), pick items, add a name and a note,
   tap Pay. Kova Pay with Face ID, or any Tempo wallet. Prices show in the buyer's currency.
4. **The order lands.** It prints on the seller's live tape with its items, the buyer's name
   and note. The seller taps Collected when it is handed over.

## Features

Agreed for the first version:

- **Stalls in the app and on the dashboard.** Any Kova user can open a stall from their phone;
  shops manage several from the web.
- **Item photos.**
- **Snap your menu.** Photograph a price board or menu and AI fills in the items and prices,
  converting naira, euros or pounds to dollars for the seller to check.
- **Pay for me.** A buyer builds a basket and sends the link to someone else to pay, like a
  relative abroad. The link stays payable for a day.
- **Table QR poster.** Printable and branded, ready to tape to a stall.
- **Orders: name, note, collected.** No inventory system to learn.

Added 24 September:

- **Barcode scanner till.** For shops without a scanner or POS, the phone's camera does it:
  - **Catalogue:** scan a product's barcode to add it. Kova looks the barcode up in open
    product databases to fill in the name and photo; the seller sets the price.
  - **Checkout:** scan items into a basket like a supermarket till, adjust quantities, and
    charge the total with a tap or a QR code.
  - **Pay:** the same Kova payment and receipt as everything else.

Later:

- Order status the buyer can follow live (preparing, ready).
- A directory of stalls at an event.
- Stock counts and low-stock alerts, built on the barcode catalogue.
- Delivery details and zones.

## One catalogue per shop

The stall page, the phone till, barcode scanning and AI menu import all read and write the
same list of items. Each item has a name, a price in dollars, an optional photo, an optional
barcode, and a sold-out switch. A stall shows the items the seller picks. Nothing is kept in
two places.

## Architecture notes

- **The server does the pricing.** A checkout sends item ids and quantities; the API looks up
  prices itself and never trusts prices from a web page.
- **Orders are their own records.** They link a stall, a payment and the buyer's name and
  note; the payment stays the source of truth for money.
- **Photos live in the database for now,** resized on the phone before upload, so no new
  storage account is needed. Move to object storage when it grows.
- **The AI menu import runs on the server** with the Anthropic API, so the key never ships in
  the app.
- **Pay for me** is a normal charge with a 24-hour expiry instead of 15 minutes.
- **Stall links** are `/s/<name>` on the Kova web app. Kova Pay's scanner opens them in the
  app; any other phone opens the web page.
- **Barcodes** use the camera module the app already has. Lookups go through the API, so the
  product database can change without an app update.

## Open questions

- A short domain for stall links (for example `kova.shop/ada`).
- Buyer protection without chargebacks: verified stalls, receipts, a report button.
- Which product database to use for barcode lookups, and what to do when a barcode is unknown.

---

# Kova Travel: fly or stay anywhere, pay in dollars

Agreed 24 Sept 2026: flights and hotels in the first version, with all four extras, and Jev
(TypeSafe's decision model) in four places across Kova.

## The one-liner

Search a flight or a hotel in Kova Pay, pay in dollars from your wallet with Face ID, and the
ticket or booking is in the app a moment later. Or send the fare to family abroad to pay, or
split the room with friends.

## How it works

- **Inventory: Duffel.** One API for 300+ airlines and 2M+ hotels (Stays), with seats, bags and
  hold orders. Test mode for the hackathon. Amadeus closed its self-service APIs on 17 July 2026.
- **Kova Travel is itself a Kova shop.** A booking is a payment (or several shares) to Kova
  Travel's settlement address, settled like any Kova charge. When every share is paid, Kova
  books with Duffel from its Duffel balance and the trip turns into a ticket or a voucher.
- **Prices in dollars.** Fares in other currencies are converted at Kova's reference rates
  (DECISIONS D-012), rounded up, and the original fare is always shown beside it.
- **Holding the price.** Flights that allow it are held at once (a Duffel hold order), so a
  pay-for-me link or a split has hours, not minutes. Otherwise the offer's own expiry applies
  and the screen counts it down. Hotel quotes carry their own expiry.
- **Privacy.** A trip is opened with a random token only the booking phone keeps; payers see only
  what they're paying for. Passenger details go to Duffel and are not kept beyond names.
- **Test mode honesty.** Duffel's test hotels live at one set of test coordinates, so in test
  mode every hotel search shows them, labelled as test hotels.

## Features

1. **Flights**: one-way or return, passengers, cabin; results with airline, times, stops and
   price; the itinerary, fare rules and bags included; passenger details; pay.
2. **Hotels**: city and dates; hotels with photos, stars and reviews; rooms and rates with board
   and cancellation terms; guest details; pay.
3. **Someone else pays**: the fare becomes a pay link for family abroad, exactly like
   pay-for-me on a stall.
4. **Trip in a sentence**: "Lagos to London next Friday, back Sunday" becomes the search
   (DeepSeek reads it; the form shows what it understood).
5. **Split the hotel**: each friend gets their share as a link; the room is booked once all
   are paid, before the quote expires.
6. **Seats and bags**: the seat map and extra bags, where the airline offers them.
7. **Your trips**: a boarding-pass style ticket with the booking reference; a hotel voucher.

## Jev in Kova

- **Spending categories**: each payment in Activity sorted into Food, Travel, Transport,
  Groceries and more, for a monthly picture.
- **Flag order notes**: allergy and dietary notes on stall tickets shown in coral.
- **Spot duplicate items**: before adding a scanned product, ask whether it's one the shop
  already sells.
- **Match offers to the ask**: from what you typed ("non-stop, arrive before 6pm"), mark the
  best-fitting flight or hotel. Kova pre-digests times and stops into words, since Jev is weak
  at arithmetic and time comparisons.

---

# Kova on Monad (Metropolis)

Agreed 24 Sept 2026: a separate Monad build of Kova for Metropolis (1 Sep to 13 Oct 2026), on
its own branch, while the Tempo build stays the Colosseum entry. Kova's first commit (19 Sep)
falls inside Metropolis's build window.

## Prizes we're going for

- **Consumer Products & Payments** track ($30k shared by three teams).
- **Agora: Best Cross-Border Payments App on Monad** ($10k). Settle in AUSD, Agora's dollar.
- **Mera (Monad Foundation)**: best Mera-powered UX, and "one passkey, many keys" ($2.5k each).
- **Chainlink: best workflow with CRE** ($3k). Live reference rates.
- **Mercuryo** (product credits for winners): add money with a card or a bank transfer.

## What changes on Monad

- **Money**: AUSD (testnet `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC`, faucet contract
  `0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C`; mainnet `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a`)
  and Circle's native USDC.
- **Payments without gas and with a reference**: Tempo has memo transfers and a native fee payer;
  Monad has neither. The payer signs an EIP-3009 transferWithAuthorization and Kova's relayer
  submits it, paying the MON gas. The authorization's 32-byte nonce is the Kova memo, so the
  AuthorizationUsed event ties the payment to its charge exactly as TransferWithMemo does on Tempo.
- **Wallet**: a Mera passkey account instead of a key in the Keychain. The same passkey derives the
  account on any phone, so losing the phone no longer loses the wallet. Needs mykova.app as the
  passkey's relying party (associated domains).
- **Rates**: a Chainlink CRE workflow publishes NGN, KES, EUR, GBP and MXN reference rates on
  Monad; the app and the API read them instead of the fixed table.
- **Add money**: the Mercuryo widget, to AUSD or USDC on Monad.

## Open questions

- Does the Agora prize require AUSD, and can one project also enter Colosseum? (rules are behind
  the hackathon login)
- Mercuryo sandbox credentials come from their integration team (ask in the hackathon Discord).
