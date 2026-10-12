'use client'

import { useState } from 'react'
import type { Checkout } from '@/lib/api'
import { KeepInKova } from './keep-in-kova'
import { PaidReceipt } from './paid-receipt'
import { type PaidGuest, WalletPay } from './wallet-pay'
import { WatchPaid } from './watch-paid'

/**
 * An open charge on the pay page. Normally a payment refreshes the page into its receipt. A guest
 * who paid with email or Google stays here instead: the email wallet lives in this page, and it's
 * needed once more, to move what's left into a Ren wallet if they want one.
 */
export function PayFlow({
  checkout,
  testnet,
  privyAppId,
  children,
}: {
  checkout: Checkout
  testnet: boolean
  privyAppId: string | null
  children: React.ReactNode
}) {
  const [guest, setGuest] = useState<PaidGuest | null>(null)
  const [guestPaying, setGuestPaying] = useState(false)
  return (
    <>
      {guest ? (
        <>
          <PaidReceipt checkout={checkout} after="" />
          <KeepInKova checkout={checkout} guest={guest} />
        </>
      ) : (
        children
      )}
      {/* Kept mounted after paying: the email wallet inside it moves the change. */}
      <div hidden={guest !== null}>
        <WalletPay
          checkout={checkout}
          testnet={testnet}
          privyAppId={privyAppId}
          onGuestPaid={setGuest}
          onGuestPaying={setGuestPaying}
        />
      </div>
      {guest ? null : <p className="fineprint">Tap. Paid. Anywhere.</p>}
      <WatchPaid id={checkout.id} paused={guestPaying || guest !== null} />
    </>
  )
}
