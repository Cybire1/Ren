import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignInForm } from '@/components/auth-forms'
import { getSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Sign in' }

export default async function SignInPage(props: { searchParams: Promise<{ expired?: string; demo?: string }> }) {
  const params = await props.searchParams
  if (!params.expired && (await getSession())) redirect('/dashboard')
  const notice = params.expired ? 'That key was revoked or has expired. Sign in again.' : params.demo === 'off' ? 'The demo shop isn’t available right now.' : undefined
  return <SignInForm notice={notice} />
}
