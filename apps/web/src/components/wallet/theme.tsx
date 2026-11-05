'use client'

import { useLayoutEffect } from 'react'
import { applyTheme, clearTheme } from '@/lib/theme'

/** Keeps the wallet dark while it's open, and the rest of the site light again on leaving it. */
export function WalletTheme() {
  useLayoutEffect(() => {
    applyTheme()
    return clearTheme
  }, [])
  return null
}
