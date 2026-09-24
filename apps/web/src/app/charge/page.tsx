import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { Charge } from './charge'

export const metadata: Metadata = { title: 'New charge' }

export default async function ChargePage() {
  if (!(await getSession())) redirect('/signin')
  return <Charge />
}
