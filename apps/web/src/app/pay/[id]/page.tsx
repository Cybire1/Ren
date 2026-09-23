import type { Metadata } from 'next'
import { Art, Brand, Pill } from '@/components/brand'
import { CopyField } from '@/components/copy'
import { Notice } from '@/components/notice'
import { WatchPaid } from '@/components/watch-paid'
import { kova, type PaymentIntent, type Summary } from '@/lib/api'
import { usd } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pay' }

/**
 * What a customer sees after scanning a terminal's code. Kova Pay opens it as a deep link; any
 * other Tempo wallet can pay the address and memo shown here.
 */
export default async function PayPage(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  let intent: PaymentIntent
  let merchantName = 'this shop'
  try {
    ;[intent, merchantName] = await Promise.all([
      kova<PaymentIntent>(`/v1/payment_intents/${id}`),
      kova<Summary>('/v1/summary').then((s) => s.merchant.name),
    ])
  } catch {
    return (
      <Notice title="This charge isn’t available">
        <p>It may have expired. Ask the shop to show the code again.</p>
      </Notice>
    )
  }

  if (intent.status === 'paid')
    return (
      <main className="page page-narrow">
        <header className="topbar">
          <Brand />
        </header>
        <section className="paid" aria-live="polite">
          <div className="receipt" style={{ marginTop: '3.5rem' }}>
            <Art name="scene-paid-terminal" size={304} />
            <div className="receipt-text">
              <small>PAID</small>
              <strong>{usd(intent.amount)}</strong>
            </div>
            <Art name="kovi-cheer" size={88} className="kovi-cheer" />
          </div>
          <h1>Paid to {merchantName}</h1>
          <p>
            {usd(intent.amount)}
            {intent.reference ? ` for ${intent.reference}` : ''}. You can close this page.
          </p>
        </section>
      </main>
    )

  const closed = ['failed', 'expired', 'canceled'].includes(intent.status)
  if (closed)
    return (
      <Notice title="This charge has closed">
        <p>Nothing was taken. Ask {merchantName} to start a new one.</p>
      </Notice>
    )

  return (
    <main className="page page-narrow">
      <header className="topbar">
        <Brand />
      </header>

      <section className="card payee">
        <Art name="badge-shop" size={84} />
        <p className="await-label" style={{ marginTop: '0.5rem' }}>
          Pay {merchantName}
        </p>
        <p className="await-amount">{usd(intent.amount)}</p>
        {intent.reference ? <p className="await-label">{intent.reference}</p> : null}
        <Pill href={`kova://pay/${intent.id}`} icon="tap" tone="coral">
          Pay with Kova
        </Pill>
      </section>

      <section className="manual">
        <h2>Paying from another wallet</h2>
        <p>Send exactly {intent.amount} USDC on Tempo, with this memo attached so the shop sees it.</p>
        <CopyField label="Address" value={intent.pay_to} />
        <CopyField label="Memo" value={intent.memo} />
      </section>

      <p className="fineprint">Tap. Paid. Anywhere.</p>
      <WatchPaid id={intent.id} />
    </main>
  )
}
