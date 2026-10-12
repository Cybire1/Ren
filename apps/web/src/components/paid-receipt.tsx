import type { Checkout } from '@/lib/api'
import { usd } from '@/lib/format'
import { Art } from './brand'
import { OrderReady } from './order-ready'
import { StampsAfterPay } from './stamp-card'

/**
 * A paid charge, as the payer sees it: the terminal's receipt and Reni cheering. A stall order
 * then shows where it is at the counter, and the stamp the payment earned.
 */
export function PaidReceipt({
  checkout: c,
  after = 'You can close this page.',
}: {
  checkout: Checkout
  after?: string
}) {
  const order = c.order
  // Someone paying for a friend's order isn't the one waiting for it.
  const waiting = order?.stall && order.status && !order.pay_for_me ? order : null
  return (
    <section className="paid" aria-live="polite">
      <div className="receipt" style={{ marginTop: '3.5rem' }}>
        <Art name="scene-paid-terminal" size={304} priority />
        <div className="receipt-text">
          <small>PAID</small>
          <strong>{usd(c.amount)}</strong>
        </div>
        <Art name="reni-cheer" size={88} className="reni-cheer" priority />
      </div>
      <h1>Paid to {c.merchant_name}</h1>
      {/* A stall order's card below says the rest. */}
      {waiting ? null : (
        <p>
          {usd(c.amount)}
          {c.reference ? ` for ${c.reference}` : ''}. {after}
        </p>
      )}
      {order?.reward ? (
        <p className="paid-reward">
          <strong>Free with your stamp card</strong> One {order.reward.name}, {usd(order.reward.amount)} off
        </p>
      ) : null}
      {waiting?.stall ? (
        <div className="paid-order">
          <OrderReady checkoutId={c.id} order={waiting} shop={waiting.stall.name} />
          <StampsAfterPay slug={waiting.stall.slug} shop={waiting.stall.name} usedReward={Boolean(order?.reward)} />
        </div>
      ) : null}
    </section>
  )
}
