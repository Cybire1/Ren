'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Watches an open charge; the moment it is paid (or closes), the page re-renders. */
export function WatchPaid({ id }: { id: string }) {
  const router = useRouter()
  useEffect(() => {
    const timer = setInterval(async () => {
      const response = await fetch(`/api/checkout/${id}`).catch(() => null)
      if (!response?.ok) return
      const { status } = (await response.json()) as { status: string }
      if (status !== 'requires_payment' && status !== 'processing') {
        clearInterval(timer)
        router.refresh()
      }
    }, 1500)
    return () => clearInterval(timer)
  }, [id, router])
  return null
}
