'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Keeps the customer's page honest: the moment the charge is paid, show the receipt. */
export function WatchPaid({ id }: { id: string }) {
  const router = useRouter()
  useEffect(() => {
    const timer = setInterval(async () => {
      const response = await fetch(`/api/intent/${id}`).catch(() => null)
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
