'use client'

import { Pill } from './brand'

export function PrintButton({ children = 'Print this poster' }: { children?: React.ReactNode }) {
  return (
    <Pill icon="download" onClick={() => window.print()}>
      {children}
    </Pill>
  )
}
