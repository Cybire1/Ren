import type { Metadata } from 'next'
import { OverviewLive } from '@/components/overview-live'
import { type IntentList, kova, type Summary, type Terminal, type WebhookEndpoint } from '@/lib/api'

export const metadata: Metadata = { title: 'Overview' }

export default async function OverviewPage() {
  const [summary, intents, terminals, webhooks] = await Promise.all([
    kova<Summary>('/v1/summary'),
    kova<IntentList>('/v1/payment_intents?limit=8'),
    kova<{ data: Terminal[] }>('/v1/terminals'),
    kova<{ data: WebhookEndpoint[] }>('/v1/webhook_endpoints'),
  ])
  return <OverviewLive initialSummary={summary} initialIntents={intents.data} initialTerminals={terminals.data} hasWebhook={webhooks.data.length > 0} />
}
