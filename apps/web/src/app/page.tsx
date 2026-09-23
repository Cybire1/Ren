import { Notice } from '@/components/notice'
import { type IntentList, kova, type Summary, type Terminal } from '@/lib/api'
import { Dashboard } from './dashboard'

export const dynamic = 'force-dynamic'

export default async function Page() {
  try {
    const [summary, intents, terminals] = await Promise.all([
      kova<Summary>('/v1/summary'),
      kova<IntentList>('/v1/payment_intents?limit=25'),
      kova<{ data: Terminal[] }>('/v1/terminals'),
    ])
    return <Dashboard initialSummary={summary} initialIntents={intents.data} initialTerminals={terminals.data} />
  } catch (error) {
    return (
      <Notice title="Can’t reach Kova">
        <p>{error instanceof Error ? error.message : 'Unknown error'}.</p>
        <p>
          Check <code>KOVA_API_URL</code> and <code>KOVA_API_KEY</code> in <code>apps/web/.env</code>, then reload.
        </p>
      </Notice>
    )
  }
}
