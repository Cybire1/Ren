'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Address, Hex } from 'viem'
import { Art, Icon } from '@/components/brand'
import { chainName } from '@/lib/chain'
import { applyKey, formatUsd, groupTyped, type Key, toBase } from '@/lib/wallet/money'
import { sessionCovers } from '@/lib/wallet/session'
import { ScreenHead } from './activity'
import { useWallet } from './provider'
import { Fact, SlideToSend, wait } from './sheet'
import { Keypad } from './ui'

/**
 * Cashing out to naira (the API's services/naira.ts): dollars from this wallet to a Nigerian bank
 * account, through Paystack. How much, which account (the bank says whose it is), a look at the
 * quote, slide. The wallet sends the dollars to Ren with this cash-out's memo, Ren pays the fee,
 * and Paystack pays the account; if the bank can't take it, the dollars come back.
 */

interface Bank {
  name: string
  code: string
}

interface CashOut {
  id: string
  amount: string
  naira: string
  rate: string
  fee: string
  bank_name: string
  account_name: string
  account_last4: string
  status: 'quoted' | 'received' | 'paying' | 'paid' | 'failed' | 'expired'
  pay_to: Address
  memo: Hex
  failure: string | null
  test_mode: boolean
}

type Step = 'amount' | 'account' | 'review' | 'done'

async function nairaApi<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown; token?: string } = {}): Promise<T> {
  const response = await fetch(`/api/naira/${path}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  })
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
  if (!response.ok) throw new Error(body.error?.message ?? `Ren is unreachable (${response.status})`)
  return body as T
}

export function NairaCashOut() {
  const { balance, keys, profile, sendToRen } = useWallet()
  const [step, setStep] = useState<Step>('amount')
  const [typed, setTyped] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [banks, setBanks] = useState<Bank[] | null>(null)
  const [search, setSearch] = useState('')
  const [bank, setBank] = useState<Bank | null>(null)
  const [account, setAccount] = useState('')
  const [named, setNamed] = useState<{ number: string; name: string } | null>(null)
  const [looking, setLooking] = useState(false)
  const [quote, setQuote] = useState<CashOut | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    void nairaApi<{ enabled: boolean }>('naira').then((n) => setEnabled(n.enabled)).catch(() => setEnabled(false))
  }, [])

  const onKey = useCallback((key: Key) => setTyped((v) => applyKey(v, key, 2)), [])
  const amount = useMemo(() => {
    try {
      return typed && Number(typed) > 0 ? toBase(Number(typed).toFixed(2)) : 0n
    } catch {
      return 0n
    }
  }, [typed])
  const over = balance !== null && amount > balance
  const tooSmall = amount > 0n && amount < 1_000_000n

  // What it comes to in naira, as they type.
  useEffect(() => {
    if (amount < 1_000_000n) return setPreview(null)
    const id = setTimeout(() => {
      void nairaApi<{ naira: string }>(`naira/quote?amount=${(Number(amount) / 1e6).toFixed(2)}`)
        .then((q) => setPreview(q.naira))
        .catch(() => setPreview(null))
    }, 250)
    return () => clearTimeout(id)
  }, [amount])

  useEffect(() => {
    if (step !== 'account' || banks) return
    void nairaApi<{ data: Bank[] }>('naira/banks').then((b) => setBanks(b.data)).catch((e: Error) => setProblem(e.message))
  }, [banks, step])

  // The bank says whose account it is, once all ten digits are in.
  useEffect(() => {
    setNamed(null)
    if (!bank || !/^\d{10}$/.test(account)) return
    setLooking(true)
    setProblem(null)
    void nairaApi<{ account_name: string }>('naira/account', { method: 'POST', body: { account_number: account, bank_code: bank.code } })
      .then((r) => setNamed({ number: account, name: r.account_name }))
      .catch((e: Error) => setProblem(e.message))
      .finally(() => setLooking(false))
  }, [account, bank])

  const shown = useMemo(() => {
    if (!banks) return []
    const q = search.trim().toLowerCase()
    const list = q ? banks.filter((b) => b.name.toLowerCase().includes(q)) : banks
    return list.slice(0, 40)
  }, [banks, search])

  const review = async () => {
    if (!bank || !named) return
    setBusy(true)
    setProblem(null)
    try {
      const token = await keys.token()
      setQuote(
        await nairaApi<CashOut>(`wallets/${profile?.address}/cash-outs`, {
          method: 'POST',
          token,
          body: { amount: (Number(amount) / 1e6).toFixed(2), bank_code: bank.code, account_number: named.number },
        }),
      )
      setStep('review')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t go through.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(false)
    }
  }

  const go = async () => {
    if (!quote || !profile) return
    setBusy(true)
    setProblem(null)
    const started = Date.now()
    try {
      const moved = await sendToRen({
        to: quote.pay_to,
        amount,
        memo: quote.memo,
        name: quote.bank_name,
        detail: `Cash out to ••••${quote.account_last4}`,
      })
      let result = await nairaApi<CashOut>(`wallets/${profile.address}/cash-outs/${quote.id}/sent`, {
        method: 'POST',
        token: await keys.token(),
        body: { tx_hash: moved.hash },
      })
      await wait(Math.max(0, 900 - (Date.now() - started)))
      setQuote(result)
      setStep('done')
      for (let i = 0; i < 20 && (result.status === 'paying' || result.status === 'received'); i++) {
        await wait(3000)
        result = await nairaApi<CashOut>(`wallets/${profile.address}/cash-outs/${quote.id}`, { token: await keys.token() })
        setQuote(result)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'It didn’t go through.'
      if (!/cancel/i.test(message)) setProblem(message)
    } finally {
      setBusy(false)
    }
  }

  if (!profile) return null
  if (enabled === false)
    return (
      <div className="w-screen">
        <ScreenHead title="Cash out" back="/wallet/profile" />
        <div className="w-empty w-empty-art">
          <Art name="coin-ngn" size={110} className="w-bob" />
          <strong>Naira cash-outs aren’t on here yet</strong>
          <span>This site isn’t connected to a payout partner.</span>
        </div>
      </div>
    )

  return (
    <div className="w-screen w-cashout">
      <ScreenHead title="Cash out" back="/wallet/profile" />

      {step === 'amount' ? (
        <div className="w-sheet-amount w-cashout-step">
          <div className="w-sheet-top">
            <Art name="coin-ngn" size={44} />
            <span className="w-sheet-who">
              <strong>To naira</strong>
              <small>Any Nigerian bank account, through Paystack</small>
            </span>
          </div>
          <p className="w-typed" aria-live="polite">
            <span className="w-typed-sign">$</span>
            {groupTyped(typed)}
          </p>
          <div className="w-sheet-pills">
            {preview && !over ? <span className="w-sheet-pill w-sheet-pill-teal">They get ≈ {preview}</span> : null}
            {balance !== null ? (
              <span className={`w-sheet-pill${over ? ' w-sheet-pill-over' : ''}`}>
                {over ? `You have ${formatUsd(balance)}` : `${formatUsd(balance)} available`}
              </span>
            ) : null}
          </div>
          <Keypad onKey={onKey} />
          <button
            type="button"
            className="pill pill-block"
            data-tone="ink"
            disabled={amount === 0n || over || tooSmall}
            onClick={() => setStep('account')}
          >
            <span className="pill-label">{over ? 'More than you have' : tooSmall ? 'At least $1' : 'Choose the account'}</span>
            <span className="pill-cap">
              <Icon name="arrow" size={18} />
            </span>
          </button>
        </div>
      ) : null}

      {step === 'account' ? (
        <div className="w-cashout-step w-keyform">
          <div className="w-sheet-top">
            <button type="button" className="round" aria-label="Change the amount" onClick={() => setStep('amount')}>
              <Icon name="back" size={20} />
            </button>
            <strong className="w-sheet-title">Which account?</strong>
          </div>
          {bank ? (
            <button type="button" className="w-bankpick" onClick={() => setBank(null)}>
              <span className="w-keybadge w-keybadge-allowance" aria-hidden="true">
                <Icon name="globe" size={17} />
              </span>
              <span>
                <strong>{bank.name}</strong>
                <small>Change bank</small>
              </span>
            </button>
          ) : (
            <div className="w-field">
              <span>Bank</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your bank" autoFocus />
              <div className="w-banklist" role="listbox" aria-label="Banks">
                {banks === null ? (
                  <p className="w-quiet">Loading banks…</p>
                ) : (
                  shown.map((b) => (
                    <button key={`${b.code}-${b.name}`} type="button" role="option" aria-selected={false} onClick={() => setBank(b)}>
                      {b.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          {bank ? (
            <label className="w-field">
              <span>Account number</span>
              <input
                inputMode="numeric"
                maxLength={10}
                value={account}
                onChange={(e) => setAccount(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10 digits"
                autoFocus
              />
            </label>
          ) : null}
          {looking ? <p className="w-quiet">Asking the bank whose account it is…</p> : null}
          {named ? (
            <p className="w-accountname">
              <Icon name="check" size={16} /> {named.name}
            </p>
          ) : null}
          {problem ? (
            <p className="w-sheet-problem" role="alert">
              <Icon name="info" size={18} />
              {problem}
            </p>
          ) : null}
          <button type="button" className="pill pill-block" data-tone="ink" disabled={!named || busy} onClick={() => void review()}>
            <span className="pill-label">{busy ? 'Getting a quote…' : 'Review'}</span>
            <span className="pill-cap">
              <Icon name="arrow" size={18} />
            </span>
          </button>
        </div>
      ) : null}

      {step === 'review' && quote ? (
        <div className="w-cashout-step">
          <div className="w-sheet-top">
            <button type="button" className="round" aria-label="Change the account" disabled={busy} onClick={() => setStep('account')}>
              <Icon name="back" size={20} />
            </button>
            <strong className="w-sheet-title">{busy ? 'Cashing out' : 'Check and cash out'}</strong>
          </div>
          <div className="w-sheet-sum">
            <strong>{quote.naira}</strong>
            <span>
              to {quote.account_name}, {quote.bank_name} ••••{quote.account_last4}
            </span>
          </div>
          <dl className="w-facts">
            <Fact label="You send" value={`$${quote.amount}`} hint={`From your balance on ${chainName}`} />
            <Fact label="Rate" value={`₦${quote.rate} per dollar`} />
            <Fact label="Bank fee" value={quote.fee} hint="Taken from the naira" />
            <Fact label="Network fee" value="$0.00, Ren covers it" />
            <Fact label="Arrives" value="In minutes" icon="bolt" hint="If the bank can’t take it, your dollars come back" />
          </dl>
          {quote.test_mode ? <p className="w-fine">Paystack test mode: no real naira moves.</p> : null}
          {problem ? (
            <p className="w-sheet-problem" role="alert">
              <Icon name="info" size={18} />
              {problem}
            </p>
          ) : null}
          <SlideToSend label={problem ? 'Slide to try again' : `Slide to cash out $${quote.amount}`} busy={busy} busyLabel="Cashing out" onSend={() => void go()} />
          <p className="w-fine w-center">
            {sessionCovers(amount) ? 'Your wallet is open, so this one needs no passkey.' : 'Your passkey approves it.'}
          </p>
        </div>
      ) : null}

      {step === 'done' && quote ? (
        <div className="w-sheet-sent w-cashout-step">
          <div className="w-sheet-cheer">
            <Art name={quote.status === 'failed' ? 'reni-oops' : 'reni-cheer'} size={150} />
          </div>
          <h2>
            {quote.status === 'paid'
              ? 'In their account'
              : quote.status === 'failed'
                ? 'It didn’t reach the bank'
                : 'On its way to the bank'}
          </h2>
          <p>
            {quote.status === 'failed'
              ? (quote.failure ?? 'The bank couldn’t take it. Your dollars came back to your wallet.')
              : `${quote.naira} to ${quote.account_name}, ${quote.bank_name} ••••${quote.account_last4}.`}
          </p>
          <Link href="/wallet" className="pill pill-block" data-tone="ink">
            <span className="pill-label">Done</span>
            <span className="pill-cap">
              <Icon name="check" size={18} />
            </span>
          </Link>
        </div>
      ) : null}
    </div>
  )
}
