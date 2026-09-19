# Kova — Product Build Brief

## 1. Mission

Build **Kova**, a stablecoin-native payment network for real-world and online commerce.

Kova should feel like a real fintech product, not a hackathon demo.

Core idea:

> **One network. Every way to pay.**

Kova combines:
- Consumer payment app
- Merchant app/dashboard
- NFC card
- Android POS / tap-to-pay
- QR payments
- Stablecoin settlement on Tempo
- Merchant API/SDK
- Programmable payment permissions
- Agent/machine payments
- Analytics and reconciliation

The physical card and POS are interfaces into the same payment network.

---

## 2. Hackathon Goal

Ship a polished, working product that:
1. Processes real payments on Tempo
2. Works with a physical NFC card and Android POS
3. Supports software/mobile payments
4. Exposes an API/SDK for external apps
5. Demonstrates programmable payment permissions
6. Tracks real usage and transaction volume
7. Can continue as a real company after the hackathon

Optimize for:
- Real users
- Real merchants
- Real transaction volume
- Repeat usage
- External developers integrating the API

---

## 3. Product Surfaces

### A. Kova Pay — Consumer App

Required:
- Sign up / wallet creation
- Stablecoin balance
- Send / receive
- QR pay
- Tap-to-pay
- Transaction history
- Card management
- Spending limits
- Freeze/unfreeze card
- Payment notifications

Nice to have:
- Passkeys
- Contacts
- Recurring payments
- Multi-stablecoin balances
- Merchant offers/rewards

---

### B. Kova Merchant

Required:
- Merchant onboarding
- Accept payment
- QR checkout
- POS checkout
- Transaction feed
- Refund flow
- Settlement status
- Revenue analytics
- Download/export transactions
- Payment receipt

Nice to have:
- Multiple staff accounts
- Multiple locations
- Inventory/payment links
- Customer insights
- Webhooks

---

### C. Kova Card

Physical NFC card used as a payment credential.

Requirements:
- CR80 card format
- Secure card identifier / cryptographic credential
- Card linked to a Kova account
- Tap on compatible POS
- Card can be frozen/unfrozen
- Per-card limits
- Card should never expose a raw private key

Research:
- Best secure NFC card/chip for prototype
- Anti-cloning options
- Secure-element cards vs basic NFC tags
- Android NFC support
- Card provisioning workflow

Do NOT rely on a cheap clonable NFC UID as the sole authorization mechanism.

---

### D. Kova Terminal

Android POS app, initially targeting an unlocked Android NFC POS.

Required:
- Merchant login
- Enter amount
- Select asset/currency if needed
- Tap NFC card
- Authorize payment
- Show instant success/failure
- Generate receipt
- Show Tempo transaction reference
- QR fallback
- Transaction history

Hardware target:
- Research current unlocked Android POS devices with:
  - NFC
  - Android SDK access
  - Printer
  - Camera/scanner
  - Developer-friendly deployment

Start with **one terminal**.

---

### E. Kova Infrastructure

This is the strategic core.

Build a reusable payments API/SDK.

Core capabilities:
- Create payment intent
- Authorize payment
- Execute payment
- Query transaction
- Refund
- Webhooks
- Merchant API keys
- Idempotency
- Payment metadata
- Reconciliation

Example desired developer experience:

```ts
const payment = await kova.payments.create({
  amount: "25.00",
  currency: "USDC",
  merchantId: "merchant_123",
  reference: "order_456"
});
```

Research Tempo's current official SDKs and payment primitives before implementation.

---

## 4. Programmable Payment Permissions

Kova should support payment policies.

Examples:
- Maximum daily spend
- Maximum amount per transaction
- Approved merchants only
- Approved categories
- Human approval above threshold
- Recurring/subscription limits
- Agent/API spending budgets
- Temporary cards/permissions
- Time-based restrictions

Goal:

> Kova becomes an authorization layer for programmable money.

---

## 5. Agent Payments

Support AI agents and software services as first-class payment users.

Examples:
- Agent gets a $50 daily budget
- Agent can pay approved APIs
- Agent cannot exceed $0.10 per request
- Agent can only pay whitelisted merchants
- Human approval required above threshold

Expose this through the SDK/API.

---

## 6. Tempo Integration

Tempo is the settlement rail.

The agent must research the **latest official Tempo documentation** before coding.

Investigate and use where appropriate:
- Stablecoin-native payments
- Tempo token/payment standards
- Fee sponsorship
- Batching
- Payment metadata / memos
- Scheduled payments
- Passkeys / account abstraction features
- Fast settlement/finality
- Machine payment primitives
- Current SDKs
- Current testnet/mainnet status
- Faucet and developer tooling

Do not assume old documentation is current.

Prefer official Tempo documentation and repositories.

---

## 7. Suggested Architecture

```text
Consumer App
Merchant App
POS App
External Apps / Agents
        |
        v
      Kova API
        |
  -----------------
  Auth / Policies
  Payment Intents
  Risk / Limits
  Webhooks
  Reconciliation
  Analytics
  -----------------
        |
        v
      Tempo
```

Suggested stack:
- Frontend: Next.js / React / TypeScript
- Mobile: choose React Native or PWA after research
- POS: native Android or React Native depending NFC SDK requirements
- Backend: TypeScript
- Database: PostgreSQL / Supabase
- Contracts: Solidity only if contracts are actually required
- Queue/jobs: choose lightweight reliable system
- Observability: logs + error tracking + transaction tracing
- Analytics: internal dashboard + public hackathon metrics page

Agent may change stack where technically justified.

---

## 8. Payment Flow

### NFC Card Flow

```text
Merchant enters amount
        ↓
Customer taps Kova Card
        ↓
POS reads secure credential
        ↓
Kova backend verifies card + policy
        ↓
User/account authorization
        ↓
Tempo transaction submitted
        ↓
Settlement confirmed
        ↓
Merchant sees PAID
        ↓
Receipt + analytics + reconciliation
```

Design for a fast perceived checkout.

---

## 9. Security Rules

Non-negotiable:
- Never store raw user private keys in plaintext
- Never use NFC UID alone as payment authorization
- Use strong API authentication
- Rate limit sensitive endpoints
- Idempotency for payments
- Signed webhooks
- Separate test and production credentials
- Audit important actions
- Merchant permissions/roles
- Card freeze/revoke
- Transaction limits
- Secure secrets management

For hackathon deployment, prefer non-custodial or minimally custodial architecture.

Research regulatory implications before enabling public production use.

---

## 10. Core Database Objects

At minimum:

- User
- Wallet
- Merchant
- MerchantLocation
- Terminal
- Card
- PaymentIntent
- Payment
- Refund
- Settlement
- Transaction
- SpendingPolicy
- APIKey
- WebhookEndpoint
- AgentAccount
- AuditLog

---

## 11. MVP Priority

### P0 — Must work
- Consumer wallet
- Merchant account
- Payment intent
- Tempo payment
- QR payment
- POS payment
- NFC card tap
- Transaction history
- Merchant dashboard
- Basic API
- Live analytics

### P1 — Strong differentiators
- Programmable spending rules
- Agent payments
- Fee sponsorship
- Refunds
- Webhooks
- Multi-merchant support
- Public metrics dashboard

### P2 — Only if time remains
- Recurring payments
- Advanced fraud/risk
- Merchant staff roles
- Loyalty/rewards
- Multi-currency routing
- Offline capped payments

Do not sacrifice P0 polish for too many P2 features.

---

## 12. Demo Story

The demo should be understandable in under 60 seconds.

1. Merchant opens Kova Terminal
2. Enters payment amount
3. Customer taps physical Kova Card
4. Payment authorizes
5. Tempo settles
6. POS displays success
7. Merchant dashboard updates instantly
8. Public metrics dashboard increments volume
9. Show same infrastructure being called through Kova API by an external app/AI agent

Message:

> **Kova is a stablecoin-native payment network for consumers, merchants, developers, and autonomous agents.**

---

## 13. Hackathon Metrics

Track from day one:

- Total payment volume
- Number of successful transactions
- Unique users
- Unique merchants
- Repeat users
- Average transaction value
- Number of physical NFC transactions
- Number of QR/software transactions
- External API integrations
- Agent payments
- Refund rate
- Payment success rate

All metrics must be genuine and clearly distinguish test/demo activity from real user activity.

---

## 14. Distribution During Hackathon

Build publicly.

Create:
- Kova X account
- Landing page
- GitHub organization/repository
- Colosseum project profile
- Public metrics page

Post milestones:
- First successful payment
- First physical tap
- First merchant
- First 100 transactions
- First $1k / $10k / etc. volume
- API integration
- Product videos
- Merchant testimonials

Do not position Kova as "a hackathon project."
Position it as a company being launched during the hackathon.

---

## 15. Brand

Master brand: **Kova**

Product naming:
- Kova Pay
- Kova Card
- Kova Terminal
- Kova API

Desired brand qualities:
- Premium
- Trustworthy
- Global
- Minimal
- Technical without looking "crypto"
- Suitable for real merchants

Avoid:
- Neon crypto aesthetics
- Generic blockchain imagery
- Meme branding
- Overloaded interfaces

---

## 16. Hardware Procurement Research

Before ordering, research and provide:
1. Best Android POS models available locally
2. Whether device is unlocked
3. NFC SDK availability
4. Developer mode / APK sideloading
5. Printer SDK
6. Local price
7. Delivery time
8. Card/chip compatibility

Initial purchase target:
- 1 Android NFC POS
- 20–50 secure NFC cards
- Receipt rolls
- Power bank/charging accessories
- NFC reader/writer only if provisioning requires one

---

## 17. Agent Working Instructions

You are expected to research aggressively.

For every major technical decision:
1. Check current official documentation
2. Prefer official repositories/specifications
3. Verify APIs are still active
4. Build the smallest working vertical slice first
5. Keep architecture production-upgradable
6. Document assumptions
7. Do not block progress waiting for perfect architecture
8. Maintain a running `DECISIONS.md`
9. Maintain a `TODO.md`
10. Maintain setup instructions in `README.md`

When uncertain:
- research
- choose the best practical option
- document why
- continue building

Only escalate decisions that:
- require money
- create legal/regulatory exposure
- materially change product direction
- require production credentials/secrets

---

## 18. First Build Milestone

Before building the full UI, prove this:

> **A real user can trigger a payment, settle it on Tempo, and have a merchant see verified payment confirmation.**

Then:

> **Make the same flow work from the Android POS.**

Then:

> **Make the same flow work from the physical NFC card.**

Everything else builds on those three proofs.

---

## 19. Definition of Success

By submission, Kova should look and behave like a startup that happens to be competing in a hackathon.

Success means:
- Product works
- Physical tap works
- Real merchants have tried it
- Transactions are happening
- API exists
- Infrastructure is reusable
- Metrics are measurable
- Demo is beautiful
- Product has a credible path beyond the hackathon
