import type { Checkout } from '@/lib/api'
import { usd } from '@/lib/format'
import { Art } from './brand'

/** A paid charge, as the payer sees it: the terminal's receipt and Kovi cheering. */
export function PaidReceipt({
  checkout: c,
  after = 'You can close this page.',
}: {
  checkout: Checkout
  after?: string
}) {
  return (
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
        {c.reference ? ` for ${c.reference}` : ''}. {after}
      </p>
    </section>
  )
}
