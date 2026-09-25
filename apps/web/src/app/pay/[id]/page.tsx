import type { Metadata } from 'next'
import { Art, Brand, Pill } from '@/components/brand'
import { Notice } from '@/components/notice'
import { WalletPay } from '@/components/wallet-pay'
import { WatchPaid } from '@/components/watch-paid'
import { type Checkout, kovaPublic } from '@/lib/api'
import { usd } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pay' }

/**
 * What a customer sees after scanning a terminal's code. Public: the charge id is the only
 * credential. Kova Pay opens it as a deep link; any browser wallet can pay it by signing the
 * same authorization Kova Pay signs, and Kova's relayer pays the gas either way.
 */
export default async function PayPage(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  let c: Checkout
  try {
    c = await kovaPublic<Checkout>(`/v1/checkout/${encodeURIComponent(id)}`)
  } catch {
    return (
      <Notice title="This charge isn’t available">
        <p>The link may be incomplete. Ask the shop to show the code again.</p>
      </Notice>
    )
  }

  if (c.status === 'paid')
    return (
      <main className="page page-narrow">
        <header className="topbar">
          <Brand />
        </header>
        <section className="paid" aria-live="polite">
          <div className="receipt" style={{ marginTop: '3.5rem' }}>
            <Art name="scene-paid-terminal" size={304} priority />
            <div className="receipt-text">
              <small>PAID</small>
              <strong>{usd(c.amount)}</strong>
            </div>
            <Art name="kovi-cheer" size={88} className="kovi-cheer" priority />
          </div>
          <h1>Paid to {c.merchant_name}</h1>
          <p>
            {usd(c.amount)}
            {c.reference ? ` for ${c.reference}` : ''}. You can close this page.
          </p>
        </section>
      </main>
    )

  if (c.status !== 'requires_payment' && c.status !== 'processing')
    return (
      <Notice title="This charge has closed">
        <p>Nothing was taken. Ask {c.merchant_name} to start a new one.</p>
      </Notice>
    )

  return (
    <main className="page page-narrow">
      <header className="topbar">
        <Brand />
      </header>

      <section className="card payee">
        <Art name="badge-shop" size={84} priority />
        <p className="await-label" style={{ marginTop: '0.5rem' }}>
          {c.order?.pay_for_me && c.order.customer_name
            ? `${c.order.customer_name} asked you to pay for their order at ${c.order.stall?.name ?? c.merchant_name}`
            : c.order?.stall
              ? `Your order from ${c.order.stall.name}`
              : `Pay ${c.merchant_name}`}
        </p>
        <p className="await-amount">{usd(c.amount)}</p>
        {c.order ? (
          <ul className="pay-lines">
            {c.order.lines.map((l) => (
              <li key={l.item_id}>
                <span>
                  {l.quantity > 1 ? `${l.quantity} × ` : ''}
                  {l.name}
                </span>
                <span>{usd(Number(l.unit_price) * l.quantity)}</span>
              </li>
            ))}
            {c.order.note ? <li className="pay-note">“{c.order.note}”</li> : null}
          </ul>
        ) : c.reference ? (
          <p className="await-label">{c.reference}</p>
        ) : null}
        <Pill href={`kova://pay/${c.id}`} icon="tap" tone="coral" wide>
          Pay with the Kova app
        </Pill>
        {/* The same wallet in the browser, opened with the app's passkey (or made here in a moment). */}
        <Pill href={`/wallet/pay/${c.id}`} icon="arrow" tone="light" wide className="pay-kova-web">
          Pay with my Kova wallet
        </Pill>
      </section>

      <WalletPay checkout={c} testnet={c.network === 'testnet'} privyAppId={process.env.PRIVY_APP_ID ?? null} />

      <p className="fineprint">Tap. Paid. Anywhere.</p>
      <WatchPaid id={c.id} />
    </main>
  )
}
