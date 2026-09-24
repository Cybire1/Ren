import type { Metadata } from 'next'
import { NewStall } from '@/components/new-stall'

export const metadata: Metadata = { title: 'Open a stall' }

export default function NewStallPage() {
  return <NewStall />
}
