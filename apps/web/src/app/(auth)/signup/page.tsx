import { redirect } from 'next/navigation'

/** Shops open inside the Kova app now: the wallet first, then the shop it owns. */
export default function SignUpPage() {
  redirect('/wallet/shop?go=open')
}
