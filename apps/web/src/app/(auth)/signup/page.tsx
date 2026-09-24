import type { Metadata } from 'next'
import { SignUpForm } from '@/components/auth-forms'

export const metadata: Metadata = { title: 'Open a shop' }

export default function SignUpPage() {
  return <SignUpForm />
}
