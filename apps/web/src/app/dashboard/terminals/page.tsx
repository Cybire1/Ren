import type { Metadata } from 'next'
import { TerminalsManager } from '@/components/terminals-manager'
import { kova, type Terminal } from '@/lib/api'

export const metadata: Metadata = { title: 'Terminals' }

export default async function TerminalsPage() {
  const terminals = await kova<{ data: Terminal[] }>('/v1/terminals')
  return <TerminalsManager initial={terminals.data} />
}
