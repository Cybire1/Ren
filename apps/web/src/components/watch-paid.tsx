'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Watches an open charge; the moment it is paid (or closes), the page re-renders. Paused while a guest decides what to do with their change. */
export function WatchPaid({ id, paused = false }: { id: string; paused?: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (paused) return
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
  }, [id, router, paused])
  return null
}
