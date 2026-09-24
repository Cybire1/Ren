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
