import { kova, type PaymentIntent, type Summary } from '@/lib/api'

export const dynamic = 'force-dynamic'

/**
 * What a customer sees after scanning the QR. Kova Pay opens this as a deep link; any other
 * wallet can pay the address and memo shown here.
 */
export default async function PayPage(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  let intent: PaymentIntent
  let merchantName = 'this merchant'
  try {
    ;[intent, merchantName] = await Promise.all([
      kova<PaymentIntent>(`/v1/payment_intents/${id}`),
      kova<Summary>('/v1/summary').then((s) => s.merchant.name),
    ])
  } catch {
    return (
      <main className="shell">
        <div className="notice">
          <h2>This charge is not available</h2>
          <p>Ask the merchant to show the code again.</p>
        </div>
      </main>
    )
  }

  if (intent.status === 'paid')
    return (
      <main className="shell stage-paid">
        <div className="paid">
          <p className="paid-mark" aria-hidden="true">
            ✓
          </p>
          <p className="paid-amount mono">{intent.amount}</p>
          <p className="paid-label">Paid to {merchantName}</p>
        </div>
      </main>
    )

  return (
    <main className="shell">
      <header className="masthead">
        <div className="wordmark">
          Kova <span>Pay</span>
        </div>
      </header>

      <section className="await">
        <p className="await-amount mono">{intent.amount} USDC</p>
        <p className="await-label">
          to {merchantName}
          {intent.reference ? ` · ${intent.reference}` : ''}
        </p>
        <p>
          <a className="button" href={`kova://pay/${intent.id}`}>
            Pay with Kova
          </a>
        </p>
      </section>

      <section className="manual">
        <h2>Paying from another wallet</h2>
        <p>Send exactly {intent.amount} USDC on Tempo, with this memo attached.</p>
        <dl>
          <dt>Address</dt>
          <dd className="mono">{intent.pay_to}</dd>
          <dt>Memo</dt>
          <dd className="mono">{intent.memo}</dd>
        </dl>
      </section>
    </main>
  )
}
