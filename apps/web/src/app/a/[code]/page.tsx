import { redirect } from 'next/navigation'

/** An allowance's short link, as it travels in a message: it opens in the wallet. */
export default async function AllowanceLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  redirect(`/wallet/accept/${encodeURIComponent(code)}`)
}
