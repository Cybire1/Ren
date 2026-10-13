import { AcceptAllowance } from '@/components/wallet/allowance'

/** Accepting an allowance someone sent: a new visitor makes their wallet first, right here. */
export default async function AcceptPage({ params }: { params: Promise<{ code: string }> }) {
  return <AcceptAllowance code={(await params).code} />
}
