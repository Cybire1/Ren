import { KeyScreen } from '@/components/wallet/keys'

/** One key: what it can still spend, its rules, and what it paid. */
export default async function KeyPage({ params }: { params: Promise<{ id: string }> }) {
  return <KeyScreen id={(await params).id} />
}
