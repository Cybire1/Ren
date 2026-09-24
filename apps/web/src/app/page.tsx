import type { Metadata } from 'next'
import Link from 'next/link'
import { Art, Brand, Icon, Pill } from '@/components/brand'
import { PaidCoin, ReceiptHero } from '@/components/receipt-hero'
import { getSession } from '@/lib/session'
import { signInDemo } from './actions'

export const metadata: Metadata = {
  title: { absolute: 'Kova · Tap. Paid. Anywhere.' },
  description: 'Turn any phone into a till for digital dollars. Customers tap or scan, and it settles on Tempo in about a second, straight to your own wallet.',
}

/** A full stop drawn as the brand's coin, the same as the o in the wordmark. */
const Coin = () => <span className="lp-coin" aria-hidden="true" />

export default async function Landing() {
  const signedIn = Boolean(await getSession())
  return (
    <div className="lp">
      <header className="lp-nav">
        <Brand />
        <nav aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#shops">For shops</a>
          <a href="#people">For people</a>
          <a href="#developers">Developers</a>
        </nav>
        <div className="lp-nav-actions">
          {signedIn ? (
            <Pill href="/dashboard" icon="arrow">
              Dashboard
            </Pill>
          ) : (
            <>
              <Link href="/signin" className="lp-signin">
                Sign in
              </Link>
              <Pill href="/signup" icon="arrow">
                Open a shop
              </Pill>
            </>
          )}
        </div>
      </header>

      {/* Hero ------------------------------------------------------------------------------ */}
      <section className="lp-hero">
        <div className="lp-hero-copy">
          <h1 className="lp-title" aria-label="Tap. Paid. Anywhere.">
            <span className="lp-word" style={{ '--i': 0 } as React.CSSProperties}>
              Tap
              <Coin />
            </span>
            <span className="lp-word" style={{ '--i': 1 } as React.CSSProperties}>
              Paid
              <PaidCoin />
            </span>
            <span className="lp-word" style={{ '--i': 2 } as React.CSSProperties}>
              Anywhere
              <Coin />
            </span>
          </h1>
          <p className="lp-lead">
            Kova turns any phone into a till for digital dollars. Your customer taps or scans, and the money settles on Tempo in about a second, straight to your own
            wallet. No card machine, no card fees, no waiting days to get paid.
          </p>
          <div className="lp-ctas">
            <Pill href="/signup" icon="arrow" tone="coral">
              Open a shop, free
            </Pill>
            <form action={signInDemo}>
              <Pill type="submit" icon="tap" tone="light">
                Explore the demo shop
              </Pill>
            </form>
          </div>
          <p className="lp-fine">Live on Tempo’s test network. Test dollars, real speed.</p>
        </div>

        <div className="lp-hero-stage">
          <ReceiptHero />
        </div>
      </section>

      {/* Facts ----------------------------------------------------------------------------- */}
      <section className="lp-facts" aria-label="Kova in numbers">
        <div>
          <strong>≈1s</strong>
          <span>from tap to settled, final on Tempo</span>
        </div>
        <div>
          <strong>$0.00</strong>
          <span>in fees for your customer. Kova pays the network</span>
        </div>
        <div>
          <strong>0</strong>
          <span>machines to buy. The phone in your pocket is the terminal</span>
        </div>
        <div>
          <strong>24/7</strong>
          <span>settlement, weekends too. It’s yours the second it lands</span>
        </div>
      </section>

      {/* How it works ---------------------------------------------------------------------- */}
      <section className="lp-section" id="how">
        <h2 className="lp-h2">Three moves, and it’s paid</h2>
        <ol className="lp-steps">
          <li>
            <div className="lp-step-art lp-tint-teal">
              <Art name="badge-shop" size={120} />
              <span className="lp-price">$12.50</span>
            </div>
            <h3>Type the price</h3>
            <p>On Kova Terminal, on any phone. Add what it’s for if you like: “Two flat whites”.</p>
          </li>
          <li>
            <div className="lp-step-art lp-tint-coral">
              <Art name="scene-faceid" size={220} />
            </div>
            <h3>They tap or scan</h3>
            <p>With Kova Pay it’s one tap and Face ID. Any other Tempo wallet can scan the code and pay too.</p>
          </li>
          <li>
            <div className="lp-step-art lp-tint-paper">
              <Art name="kovi-catch" size={210} />
            </div>
            <h3>It lands, in about a second</h3>
            <p>Your till shows Paid, your dashboard updates, and the dollars are already in your wallet.</p>
          </li>
        </ol>
      </section>

      {/* Two sides --------------------------------------------------------------------------- */}
      <section className="lp-duo">
        <article className="lp-panel lp-panel-teal" id="shops">
          <p className="lp-panel-kicker">Kova Terminal, for shops</p>
          <h2>Your phone is the card machine</h2>
          <ul>
            <li>
              <Icon name="terminal" size={18} /> Pair any phone with a one-time code. Staff phones get a key that can only take payments.
            </li>
            <li>
              <Icon name="list" size={18} /> Every payment lands live on your dashboard, with the on-chain proof one click away.
            </li>
            <li>
              <Icon name="shield" size={18} /> Money settles to your own address. Kova never holds it, so there’s nothing to withdraw.
            </li>
          </ul>
          <Art name="scene-paid-terminal" size={290} className="lp-panel-art" />
        </article>
        <article className="lp-panel lp-panel-coral" id="people">
          <p className="lp-panel-kicker">Kova Pay, for people</p>
          <h2>Pay a shop in Lagos with dollars from London</h2>
          <ul>
            <li>
              <Icon name="tap" size={18} /> Tap to pay at the counter, confirmed with Face ID. Your key never leaves your phone.
            </li>
            <li>
              <Icon name="send" size={18} /> Send money to anyone, anywhere, in seconds, for a fraction of a cent.
            </li>
            <li>
              <Icon name="globe" size={18} /> See every amount in your own currency: dollars, euros, pounds or naira.
            </li>
          </ul>
          <div className="lp-flight">
            <Art name="scene-send" size={352} />
            <Art name="kovi-ride" size={104} className="lp-flight-kovi" />
          </div>
        </article>
      </section>

      {/* Currencies -------------------------------------------------------------------------- */}
      <section className="lp-fx" aria-label="One price, every currency">
        <p>One price, read in everyone’s own money</p>
        <div className="lp-fx-row">
          <span>
            <Art name="coin-usd" size={44} /> $12.50
          </span>
          <span>
            <Art name="coin-eur" size={44} /> €11.50
          </span>
          <span>
            <Art name="coin-gbp" size={44} /> £9.88
          </span>
          <span>
            <Art name="coin-ngn" size={44} /> ₦17,188
          </span>
        </div>
        <small>At Kova’s published reference rates. Payments always settle in dollars (USDC).</small>
      </section>

      {/* Developers -------------------------------------------------------------------------- */}
      <section className="lp-dev" id="developers">
        <div className="lp-dev-copy">
          <p className="lp-panel-kicker">For developers</p>
          <h2>One POST to charge. A signed webhook when it’s paid.</h2>
          <p>
            Take Kova payments on your own site or till software. Create a charge, show its code, and hear about it the moment it settles. Retries are safe with an
            Idempotency-Key, and every payment is matched on-chain, so there’s nothing to reconcile by hand.
          </p>
          <Pill href="/signup" icon="code" tone="paper">
            Get API keys
          </Pill>
        </div>
        <pre className="lp-code" aria-label="Example: create a charge">
          <code>
            <span className="c-dim">$</span> curl <span className="c-str">https://api.kova…/v1/payment_intents</span> \{'\n'}
            {'    '}-H <span className="c-str">"Authorization: Bearer $KOVA_SECRET_KEY"</span> \{'\n'}
            {'    '}-d <span className="c-str">{`'{"amount":"12.50","reference":"Order 1042"}'`}</span>
            {'\n\n'}
            {'{'}
            {'\n'}
            {'  '}
            <span className="c-key">"id"</span>: <span className="c-str">"pi_06gd1ajtn5yr71g1tdwpvk9fqm"</span>,{'\n'}
            {'  '}
            <span className="c-key">"amount"</span>: <span className="c-str">"12.50"</span>,{'\n'}
            {'  '}
            <span className="c-key">"status"</span>: <span className="c-str">"requires_payment"</span>,{'\n'}
            {'  '}
            <span className="c-key">"pay_to"</span>: <span className="c-str">"0x44e3…7e41"</span>
            {'\n'}
            {'}'}
            {'\n\n'}
            <span className="c-dim">{'// ≈1s later, to your webhook:'}</span>
            {'\n'}
            <span className="c-key">Kova-Signature</span>: t=1790208020,v1=9e56…{'\n'}
            {'{ '}
            <span className="c-key">"type"</span>: <span className="c-ok">"payment_intent.paid"</span>
            {' }'}
          </code>
        </pre>
      </section>

      {/* Trust --------------------------------------------------------------------------------- */}
      <section className="lp-section">
        <h2 className="lp-h2">Kova never holds your money</h2>
        <div className="lp-trust">
          <div>
            <Icon name="shield" size={24} />
            <h3>Settles to you, directly</h3>
            <p>Payments move from your customer’s wallet to yours. There’s no Kova balance in between, and nothing to freeze.</p>
          </div>
          <div>
            <Icon name="key" size={24} />
            <h3>Keys stay on phones</h3>
            <p>A Kova Pay wallet key lives in the phone’s secure chip behind Face ID. It never touches a server.</p>
          </div>
          <div>
            <Icon name="check" size={24} />
            <h3>Checked on-chain</h3>
            <p>Every payment carries a memo tying it to its charge, and Kova verifies it on Tempo before anything says Paid.</p>
          </div>
        </div>
      </section>

      {/* Closing ----------------------------------------------------------------------------- */}
      <section className="lp-close">
        <Art name="kovi-peek" size={220} className="lp-close-peek" />
        <h2>Your counter is ready when you are</h2>
        <p>Open a shop in a minute. Pair your phone. Take your first payment before your coffee goes cold.</p>
        <div className="lp-ctas lp-ctas-center">
          <Pill href="/signup" icon="arrow">
            Open a shop
          </Pill>
          <form action={signInDemo}>
            <Pill type="submit" icon="tap" tone="paper">
              Explore the demo shop
            </Pill>
          </form>
        </div>
      </section>

      <footer className="lp-foot">
        <Brand />
        <p>Tap. Paid. Anywhere. Built on Tempo. A test network preview: no real money moves.</p>
        <nav aria-label="Footer">
          <Link href="/signin">Sign in</Link>
          <Link href="/signup">Open a shop</Link>
          <a href="#developers">Developers</a>
        </nav>
      </footer>
    </div>
  )
}
