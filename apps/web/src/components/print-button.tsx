'use client'

import { Pill } from './brand'

export function PrintButton() {
  return (
    <Pill icon="download" onClick={() => window.print()}>
      Print this poster
    </Pill>
  )
}
