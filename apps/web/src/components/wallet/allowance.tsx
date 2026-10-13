'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { Address } from 'viem'
import { Art, Icon } from '@/components/brand'
import { chainName } from '@/lib/chain'
import { formatUsd } from '@/lib/wallet/money'
import { ScreenHead } from './activity'
import type { HeldAllowance } from './keys-state'
import { short, useWallet } from './provider'
import { Fact } from './sheet'

/**
 * Allowances from the side of the person they're for: accepting one from its link, and spending
 * it. Accepting makes a key in this browser that never leaves it; the giver then switches it on
 * with their passkey, and from then on this wallet can pay from the giver's dollars, up to the
 * limit, which Tempo enforces. Allowances are green, like money at rest.
 */

interface Invite {
  from: Address
  label: string
  limit: string
  period: 'day' | 'week'
  expires_at: string
  claimed: boolean
}

/** Who gave it, as this wallet knows them. */
export function useGiverName() {
  const { contacts } = useWallet()
  return (owner: string) => {
    const known = contacts.find((c) => c.address.toLowerCase() === owner.toLowerCase())
    return known && !known.name.startsWith('0x') ? known.name : short(owner)
  }
}

export function AcceptAllowance({ code }: { code: string }) {
  const { keys, profile } = useWallet()
  const giver = useGiverName()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    void fetch(`/api/keys/allowances/${code}`)
      .then(async (response) => {
        const body = (await response.json()) as Invite & { error?: { message?: string } }
        if (!response.ok) throw new Error(body.error?.message ?? 'This link isn’t right.')
        setInvite(body)
      })
      .catch((error: Error) => setProblem(error.message))
  }, [code])

  const held = keys.held.find((h) => invite && h.owner.toLowerCase() === invite.from.toLowerCase())
  const accept = async () => {
    setBusy(true)
    setProblem(null)
    try {
      await keys.claim(code, profile?.name && !profile.name.startsWith('0x') ? profile.name : undefined)
      setAccepted(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t go through.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(false)
    }
  }

  if (!profile) return null
  const own = invite && invite.from.toLowerCase() === profile.address.toLowerCase()

  return (
    <div className="w-screen">
      <ScreenHead title="An allowance" />
      {!invite && !problem ? <div className="w-loading" aria-busy="true" /> : null}
      {problem && !invite ? (
        <div className="w-empty w-empty-art">
          <Art name="reni-oops" size={130} className="w-bob" />
          <strong>This link didn’t open</strong>
          <span>{problem}</span>
        </div>
      ) : null}
      {invite ? (
        <>
          <section className="w-allowhero">
            <span className="w-private-label">
              <Icon name="user" size={16} /> Allowance
            </span>
            <p className="w-allowhero-from">{giver(invite.from)} gives you</p>
            <p className="w-private-amount">
              <span className="w-balance-whole">{formatUsd(BigInt(Math.round(Number(invite.limit) * 1e6)))}</span>
            </p>
            <p className="w-allowhero-sub">
              a {invite.period}, from their dollars, until{' '}
              {new Date(invite.expires_at).toLocaleDateString([], { day: 'numeric', month: 'long' })}
            </p>
            <Art name="reni-wave" size={104} className="w-private-reni" />
          </section>

          {held?.live ? (
            <div className="w-keycall">
              <strong>It’s on</strong>
              <span>
                You can spend up to {formatUsd(held.remaining)} {held.period === 'week' ? 'this week' : 'today'}. Pick
                it under “From” when you send or pay.
              </span>
              <Link href="/wallet" className="pill pill-block" data-tone="ink">
                <span className="pill-label">Go to your wallet</span>
                <span className="pill-cap">
                  <Icon name="arrow" size={18} />
                </span>
              </Link>
            </div>
          ) : accepted || (invite.claimed && held) ? (
            <div className="w-keycall">
              <strong>Accepted</strong>
              <span>
                {giver(invite.from)} switches it on with their passkey. You’ll see it on Home as soon as they do.
              </span>
            </div>
          ) : invite.claimed ? (
            <p className="w-sheet-problem" role="alert">
              <Icon name="info" size={18} />
              Someone already accepted this allowance. Ask for a new link.
            </p>
          ) : own ? (
            <p className="w-sheet-problem" role="alert">
              <Icon name="info" size={18} />
              This is your own allowance. Send the link to the person it’s for.
            </p>
          ) : (
            <>
              <dl className="w-facts">
                <Fact label="From" value={giver(invite.from)} />
                <Fact label="You can spend" value={`${formatUsd(BigInt(Math.round(Number(invite.limit) * 1e6)))} a ${invite.period}`} icon="shield" hint={`${chainName} enforces it`} />
                <Fact label="Your key" value="Made in this browser" icon="lock" hint="It never leaves it, and Ren never sees it" />
              </dl>
              {problem ? (
                <p className="w-sheet-problem" role="alert">
                  <Icon name="info" size={18} />
                  {problem}
                </p>
              ) : null}
              <button type="button" className="pill pill-block" data-tone="ink" disabled={busy} onClick={() => void accept()}>
                <span className="pill-label">{busy ? 'Accepting…' : 'Accept'}</span>
                <span className="pill-cap">
                  <Icon name="check" size={18} />
                </span>
              </button>
              <p className="w-fine w-center">Your passkey says it’s you. Nothing moves until they switch it on.</p>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}

/** Allowances this wallet can spend, on Home. */
export function AllowanceCards() {
  const { keys } = useWallet()
  const giver = useGiverName()
  const live = keys.held.filter((h) => h.live)
  if (live.length === 0) return null
  return (
    <>
      {live.map((allowance) => (
        <AllowanceCard key={allowance.id} allowance={allowance} giver={giver(allowance.owner)} />
      ))}
    </>
  )
}

function AllowanceCard({ allowance, giver }: { allowance: HeldAllowance; giver: string }) {
  const share = allowance.limit > 0n ? Number((allowance.remaining * 1000n) / allowance.limit) / 10 : 0
  return (
    <Link href={`/wallet/send?from=${allowance.id}`} className="w-allowcard" aria-label={`Allowance from ${giver}, ${formatUsd(allowance.remaining)} left`}>
      <span className="w-keybadge w-keybadge-allowance" aria-hidden="true">
        <Icon name="user" size={18} />
      </span>
      <span className="w-keyscard-text">
        <small>From {giver}</small>
        <strong>{formatUsd(allowance.remaining)} left</strong>
        <span className="w-keymeter" aria-hidden="true">
          <span style={{ width: `${share}%` }} />
        </span>
      </span>
      <span className="w-keyscard-go">Spend</span>
    </Link>
  )
}
