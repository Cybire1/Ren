'use client'

import type { SwapIn } from '@kova/tempo'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Art, Icon } from '@/components/brand'
import { chainName, settlementTokenOf } from '@/lib/chain'
import { quoteIntoDollars } from '@/lib/wallet/chain-tempo'
import { formatUsd } from '@/lib/wallet/money'
import { ScreenHead } from './activity'
import { useWallet } from './provider'
import { Fact, SlideToSend, wait } from './sheet'

/**
 * Other dollars: USDC, USDT, pathUSD and the like that reach this wallet on Tempo. Ren keeps one
 * dollar, OUSD, so these sit apart until the wallet turns them into it: one transaction on Tempo's
 * stablecoin exchange, a swap for each, all or nothing, with Ren paying the fee.
 */

const sum = (values: bigint[]) => values.reduce((a, b) => a + b, 0n)

/** On Home, only while the wallet holds some: how much, and the way to add it to the balance. */
export function OtherDollarsCard() {
  const { otherDollars, network } = useWallet()
  if (otherDollars.length === 0) return null
  const total = sum(otherDollars.map((h) => h.amount))
  const names = new Intl.ListFormat('en', { type: 'conjunction' }).format(
    otherDollars.map((h) => h.dollar.name),
  )
  return (
    <Link
      href="/wallet/other"
      className="w-keyscard w-othercard"
      aria-label={`Other dollars, ${formatUsd(total)} in ${names}. Add them to your balance as ${settlementTokenOf(network).symbol}`}
    >
      <span className="w-keyscard-icon w-othercard-icon">
        <Icon name="refresh" size={20} />
      </span>
      <span className="w-keyscard-text">
        <small>Other dollars</small>
        <strong>{formatUsd(total)}</strong>
        <span>{names}</span>
      </span>
      <span className="w-keyscard-go">Add</span>
    </Link>
  )
}

type Step = 'review' | 'done'

/** Every other dollar the wallet holds, what each becomes, and one slide to add them all. */
export function OtherDollarsScreen() {
  const { otherDollars, network, profile, turnIntoDollars } = useWallet()
  const ours = settlementTokenOf(network).symbol
  const [quotes, setQuotes] = useState<SwapIn[] | null>(null)
  const [step, setStep] = useState<Step>('review')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<{ got: bigint; ms: number; explorer: string } | null>(null)

  useEffect(() => {
    if (step !== 'review' || otherDollars.length === 0) return
    let live = true
    setQuotes(null)
    quoteIntoDollars(network, otherDollars)
      .then((q) => live && setQuotes(q))
      .catch(() => live && setQuotes([]))
    return () => {
      live = false
    }
  }, [network, otherDollars, step])

  if (!profile) return null

  const quoted = quotes ? sum(quotes.map((q) => q.quoted)) : null
  const held = sum(otherDollars.map((h) => h.amount))
  const unpriced = quotes
    ? otherDollars.filter((h) => !quotes.some((q) => q.token === h.dollar.address))
    : []

  const go = async () => {
    if (!quotes || quotes.length === 0) return
    setBusy(true)
    setProblem(null)
    const started = Date.now()
    try {
      const moved = await turnIntoDollars(quotes)
      await wait(Math.max(0, 900 - (Date.now() - started)))
      setDone({ got: sum(quotes.map((q) => q.quoted)), ms: moved.ms, explorer: moved.explorer })
      setStep('done')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t go through.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(false)
    }
  }

  if (step === 'done' && done)
    return (
      <div className="w-screen w-other">
        <ScreenHead title="Other dollars" />
        <div className="w-sheet-sent">
          <div className="w-sheet-cheer">
            <Art name="reni-cheer" size={150} />
            <Art name="sparkle-4" size={26} className="w-spark w-spark-1" />
            <Art name="sparkle-8" size={30} className="w-spark w-spark-2" />
          </div>
          <h2>In your balance</h2>
          <p>
            {formatUsd(done.got)} in {ours}, ready to pay with. One transaction on {chainName}, and
            Ren paid its fee.
          </p>
          <span className="w-sheet-time">
            <Icon name="bolt" size={16} />
            Done in {(done.ms / 1000).toFixed(2)} s
          </span>
          <a className="w-fine w-center" href={done.explorer} target="_blank" rel="noreferrer">
            See it on {chainName}’s explorer
          </a>
          <Link href="/wallet" className="pill pill-block" data-tone="ink">
            <span className="pill-label">Done</span>
            <span className="pill-cap">
              <Icon name="check" size={18} />
            </span>
          </Link>
        </div>
      </div>
    )

  return (
    <div className="w-screen w-other">
      <ScreenHead title="Other dollars" />
      {otherDollars.length === 0 ? (
        <div className="w-empty w-empty-art">
          <Art name="reni-sleep" size={150} />
          <strong>No other dollars</strong>
          <span>
            When USDC, USDT or another dollar reaches this wallet on {chainName}, it shows up here,
            ready to turn into {ours}.
          </span>
        </div>
      ) : (
        <>
          <p className="w-other-lede">
            Ren keeps one dollar, {ours}, so these wait apart from your balance. Add them and they
            become {ours} in one go.
          </p>
          <ul className="w-other-list">
            {otherDollars.map((h) => {
              const q = quotes?.find((x) => x.token === h.dollar.address)
              return (
                <li key={h.dollar.address} className="w-other-row">
                  <span className="w-other-coin" aria-hidden="true">
                    {h.dollar.name.slice(0, 1)}
                  </span>
                  <span className="w-other-name">
                    <strong>{h.dollar.name}</strong>
                    <small>
                      {formatUsd(h.amount).slice(1)} on {chainName}
                    </small>
                  </span>
                  <span className="w-other-into">
                    {quotes === null ? (
                      <small>Pricing…</small>
                    ) : q ? (
                      <>
                        <strong>{formatUsd(q.quoted)}</strong>
                        <small>{ours}</small>
                      </>
                    ) : (
                      <small>No price now</small>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="w-sheet-sum">
            <strong>{quoted === null ? '…' : formatUsd(quoted)}</strong>
            <span>
              {quoted === null
                ? 'Asking Tempo’s exchange'
                : `Into your balance, from ${formatUsd(held)} of other dollars`}
            </span>
          </div>
          <dl className="w-facts">
            <Fact label="Fee" value="$0.00, Ren covers it" />
            <Fact
              label="Rate"
              value={`${chainName}’s stablecoin exchange`}
              hint="Its quote, or at most 0.5% under it, or nothing moves"
            />
            <Fact
              label="How"
              value="One transaction"
              hint="Every swap goes, or none does"
              icon="bolt"
            />
          </dl>
          {unpriced.length > 0 ? (
            <p className="w-fine">
              {unpriced.map((h) => h.dollar.name).join(', ')} can’t be priced right now, so{' '}
              {unpriced.length === 1 ? 'it stays' : 'they stay'} as{' '}
              {unpriced.length === 1 ? 'it is' : 'they are'}.
            </p>
          ) : null}
          {problem ? (
            <p className="w-sheet-problem" role="alert">
              <Icon name="info" size={18} />
              {problem}
            </p>
          ) : null}
          <SlideToSend
            label={
              problem
                ? 'Slide to try again'
                : quoted
                  ? `Slide to add ${formatUsd(quoted)}`
                  : 'Slide to add them'
            }
            busy={busy}
            busyLabel="Adding"
            disabled={!quotes || quotes.length === 0}
            onSend={() => void go()}
          />
          <p className="w-fine w-center">Your passkey approves it. Nothing leaves your wallet.</p>
        </>
      )}
    </div>
  )
}
