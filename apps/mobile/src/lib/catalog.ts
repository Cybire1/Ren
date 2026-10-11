import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { type CatalogItem, getCatalog } from './api'

/**
 * The shop's catalogue, read with this phone's device key (any terminal can sell from it).
 * Reloads whenever the screen comes into focus, so an item added a moment ago is there.
 */
export function useCatalog() {
  const [items, setItems] = useState<CatalogItem[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const next = await getCatalog()
      setItems(next)
      setProblem(null)
      return next
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Ren is unreachable')
      return null
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void reload()
    }, [reload]),
  )

  return { items, problem, reload, setItems }
}

/** A barcode as scanners report it: UPC-A often arrives as EAN-13 with a leading zero. */
export function sameBarcode(a: string | null | undefined, b: string) {
  if (!a) return false
  const x = a.replace(/^0+/, '')
  const y = b.replace(/^0+/, '')
  return x === y
}
