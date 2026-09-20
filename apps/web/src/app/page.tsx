import { type IntentList, kova, type Summary } from '@/lib/api'
import { Dashboard } from './dashboard'

export const dynamic = 'force-dynamic'

export default async function Page() {
  try {
    const [summary, intents] = await Promise.all([
      kova<Summary>('/v1/summary'),
      kova<IntentList>('/v1/payment_intents?limit=25'),
    ])
    return <Dashboard initialSummary={summary} initialIntents={intents.data} />
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return (
      <main className="shell">
        <header className="masthead">
          <div className="wordmark">
            Kova <span>Merchant</span>
          </div>
        </header>
        <div className="notice">
          <h2>Can&rsquo;t reach the Kova API</h2>
          <p>{message}</p>
          <p>Start it with `pnpm --filter @kova/api dev`, then set KOVA_API_KEY in apps/web/.env</p>
        </div>
      </main>
    )
  }
}
