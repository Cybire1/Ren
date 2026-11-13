'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { Hex } from 'viem'
import { Art, Icon } from '@/components/brand'
import { applyKey, formatUsd, toBase } from '@/lib/wallet/money'
import {
  addRecipient,
  type CashOutAccess,
  type Corridor,
  getCashOutAccounts,
  getPayout,
  getPayoutBanks,
  getPayoutRate,
  getPayoutsInfo,
  inCurrency,
  type Payout,
  type PayoutBank,
  PayoutError,
  type PayoutField,
  type PayoutsInfo,
  quotePayout,
  type Recipient,
  reportPayoutPaid,
  type Verification,
} from '@/lib/wallet/payouts'
import { checkedPay, moveProblem, wait } from '@/lib/wallet/signed'
import '@/styles/cash-out-world.css'
import { ScreenHead } from './activity'
import { type NairaRecent, readNairaRecents, useNairaOn } from './naira'
import { useWallet } from './provider'
import { SlideToSend } from './sheet'
import { Keypad } from './ui'

type Step = 'where' | 'country' | 'verify' | 'rail' | 'details' | 'amount' | 'review' | 'tracking'

/** The fields about the person (not the account), asked once and kept in this browser. */
const ABOUT = [
  'email',
  'address_line1',
  'address_city',
  'address_state',
  'address_postal_code',
  'address_country',
]
const aboutKey = (address: string) => `kova.cashout.about.${address.toLowerCase()}`

/** Round flags we ship (public/flags); anything else gets the globe. */
const FLAGS = new Set('AE AU CA CN EU GB GH HK KE MX NG PH SG TZ UG US ZA USDC WW'.split(' '))
const flagCode = (way: { id?: string; corridor?: string; country: string }) =>
  (way.id ?? way.corridor) === 'usdc' ? 'USDC' : way.country

function Flag({ code, size = 36 }: { code: string; size?: number }) {
  const file = FLAGS.has(code) ? code : 'WW'
  return (
    // biome-ignore lint/performance/noImgElement: a 36px SVG; next/image adds nothing here
    <img
      className="cw-flag"
      src={`/flags/${file}.svg`}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  )
}

/** The country the browser is set to (en-NG → NG), as a guess for where someone lives. */
const homeCountry = () => {
  const region = Intl.DateTimeFormat().resolvedOptions().locale.split('-').pop() ?? ''
  return /^[A-Z]{2}$/.test(region) ? region : ''
}

const clock = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? undefined
    : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Arrival in a few words, for tight spaces: "Same or next day" → "By tomorrow". */
const brief = (speed: string) =>
  speed === 'Same or next day'
    ? 'By tomorrow'
    : speed.replace(' business days', ' days').replace('Under a minute', 'In a minute')

/** What to type, when the field is empty: its own example, or the shape it wants. */
const hint = (f: PayoutField) =>
  f.placeholder ??
  (f.kind === 'digits' && f.min && f.max
    ? f.min === f.max
      ? `${f.min} digits`
      : `${f.min} to ${f.max} digits`
    : f.kind === 'email'
      ? 'you@example.com'
      : f.kind === 'iban'
        ? 'Starts with two letters'
        : f.kind === 'bic'
          ? '8 or 11 characters'
          : f.kind === 'phone'
            ? 'With the country code'
            : f.kind === 'country'
              ? 'Two letters, like NG'
              : '')

/** Short fields that read as one (a city, its state, its postal code) share a line. */
const TOGETHER = [
  ['bank_city', 'bank_state', 'bank_postal_code'],
  ['address_city', 'address_state'],
  ['address_postal_code', 'address_country'],
]
function rowsOf(fields: PayoutField[]): PayoutField[][] {
  const rows: PayoutField[][] = []
  for (const f of fields) {
    const group = TOGETHER.find((g) => g.includes(f.key))
    const last = rows[rows.length - 1]
    if (group && last?.[0] && group.includes(last[0].key)) last.push(f)
    else rows.push([f])
  }
  return rows
}

/** What went wrong, in a line someone can act on, from Ren's longer note. */
function plainFailure(failure: string | null): string {
  const f = (failure ?? '').toLowerCase()
  if (f.includes('postal')) return 'Your address needs a postal code'
  if (f.includes('state')) return 'Your address needs a state or region'
  if (f.includes('account') && f.includes('number')) return 'The account number wasn’t right'
  if (f.includes('name')) return 'The name didn’t match the account'
  return 'The bank didn’t accept the details'
}

/** A country's ways out in a few words: "Interac · Bank account", "M-Pesa · Bank account". */
const ways = (rails: Corridor[]) =>
  [
    ...new Set(
      rails.map((r) =>
        r.title.includes('Interac')
          ? 'Interac'
          : r.title.startsWith('M-Pesa')
            ? 'M-Pesa'
            : r.title.startsWith('Mobile money')
              ? 'Mobile money'
              : r.title.startsWith('Wire')
                ? 'Wire'
                : r.title.startsWith('Bank or e-wallet')
                  ? 'Bank or e-wallet'
                  : 'Bank account',
      ),
    ),
  ].join(' · ') + (rails.some((r) => r.speed === 'Instant') ? ' · instant' : '')

function Problem({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <p className="w-sheet-problem cw-problem" role="alert">
      <Icon name="info" size={18} />
      {text}
    </p>
  )
}

/**
 * Cash out to a bank, mobile money or a USDC wallet, almost anywhere, as in the app: a saved account
 * or a new one (where, how it should arrive, the account), an amount with what lands and when, a
 * check, the slide, then the payout followed until it lands. The person's own address is asked
 * once and kept in this browser. It is the whole of Cash out: the saved accounts (naira ones
 * included) or a new one starting with the browser's country. Nigeria goes to the naira cash-out
 * (components/wallet/naira.tsx, no ID from Ren); anywhere else asks for the one-time ID check as
 * a step of its own, only when it's needed.
 *
 * On Tempo the wallet pays for a payout itself: the quote names a transfer (`pay`), the wallet
 * sends exactly that, sponsored, with its memo, and then tells Ren the hash.
 */
export function CashOutWorld() {
  const { profile, balance, network, signMessage, sendToRen, refresh } = useWallet()
  const router = useRouter()
  const [info, setInfo] = useState<PayoutsInfo | null>(null)
  /** Ren didn't answer about cash-outs abroad: why, in its words. */
  const [unreachable, setUnreachable] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [recipients, setRecipients] = useState<Recipient[] | null>(null)
  const [access, setAccess] = useState<CashOutAccess | null>(null)
  const [step, setStep] = useState<Step>('where')
  const [country, setCountry] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [corridor, setCorridor] = useState<Corridor | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [about, setAbout] = useState<Record<string, string> | null>(null)
  const [editAbout, setEditAbout] = useState(false)
  const [banks, setBanks] = useState<PayoutBank[] | null>(null)
  const [bankQuery, setBankQuery] = useState('')
  const [bank, setBank] = useState<PayoutBank | null>(null)
  const [recipient, setRecipient] = useState<Recipient | null>(null)
  const [typed, setTyped] = useState('')
  const [rate, setRate] = useState<number | null>(null)
  const [quote, setQuote] = useState<Payout | null>(null)
  const [payout, setPayout] = useState<Payout | null>(null)
  /** The dollars are on Tempo but Ren hasn't confirmed the payout yet: the transfer's hash. */
  const [unconfirmed, setUnconfirmed] = useState<Hex | null>(null)
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  /** Naira through Paystack: when it's on, Nigeria and the naira accounts open the naira cash-out. */
  const nairaOn = useNairaOn()
  const [nairaRecents, setNairaRecents] = useState<NairaRecent[]>([])

  useEffect(() => {
    setNairaRecents(readNairaRecents())
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` asks again after a failure
  useEffect(() => {
    setUnreachable(null)
    void getPayoutsInfo()
      .then(setInfo)
      .catch((e) => setUnreachable(e instanceof Error ? e.message : 'Ren is unreachable.'))
  }, [attempt])

  /** Cashing out abroad isn't available here (off, or Ren didn't answer about it). */
  const off = unreachable !== null || (info !== null && !info.live)
  // Then, when naira is on, naira is the whole of Cash out.
  useEffect(() => {
    if (off && nairaOn) router.replace('/wallet/cash-out/naira')
  }, [off, nairaOn, router])

  useEffect(() => {
    if (!profile) return
    void getCashOutAccounts(profile.address)
      .then((r) => {
        setRecipients(r.recipients)
        setAccess(r.access)
      })
      .catch(() => setRecipients([]))
    try {
      const raw = localStorage.getItem(aboutKey(profile.address))
      setAbout(raw ? (JSON.parse(raw) as Record<string, string>) : null)
    } catch {
      setAbout(null)
    }
  }, [profile])

  const countries = useMemo(() => {
    const by = new Map<string, Corridor[]>()
    for (const c of info?.corridors ?? []) by.set(c.country, [...(by.get(c.country) ?? []), c])
    return [...by.entries()]
      .map(([code, rails]) => ({ code, rails, name: rails[0]?.name ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [info])
  const named = countries.filter((c) => c.code !== 'WW')
  const elsewhere = (info?.corridors ?? []).filter((c) => c.country === 'WW')
  const wayOf = (r: Recipient) => info?.corridors.find((c) => c.id === r.corridor)
  const railsOf = (code: string | null | undefined) =>
    (info?.corridors ?? []).filter(
      (c) => c.country === code && (code !== 'WW' || c.id.startsWith('swift')),
    )
  const feeOn = (dollars: number) =>
    Math.ceil((dollars * (info?.fee_bps ?? 0)) / 10_000 / 0.01) * 0.01

  const choose = (c: Corridor) => {
    setCorridor(c)
    setValues({
      holder_name: profile?.name ?? '',
      address_country: homeCountry(),
      ...(about ?? {}),
    })
    setEditAbout(!about)
    setBank(null)
    setBanks(null)
    setBankQuery('')
    setProblem(null)
    setStep('details')
    if (c.banks)
      void getPayoutBanks(c.banks)
        .then(setBanks)
        .catch(() => setBanks([]))
  }

  const mustVerify = !!access?.required && access.verification !== 'verified'

  const pickCountry = (code: string) => {
    if (code === 'NG' && nairaOn) {
      router.push('/wallet/cash-out/naira')
      return
    }
    const rails = railsOf(code)
    setCountry(code)
    setSearch('')
    // Anywhere else goes out in the person's own name: the ID check first, as a step of its own.
    if (mustVerify) {
      setProblem(null)
      setStep('verify')
      return
    }
    if (rails.length === 1 && rails[0]) {
      choose(rails[0])
      return
    }
    setPicked(rails[0]?.id ?? null)
    setRate(null)
    setStep('rail')
    const currency = rails[0]?.currency
    if (currency && currency !== 'USD')
      void getPayoutRate(currency)
        .then(setRate)
        .catch(() => setRate(null))
    else setRate(1)
  }

  const startAmount = (r: Recipient) => {
    setRecipient(r)
    setTyped('')
    setQuote(null)
    setProblem(null)
    setRate(r.currency === 'USD' ? 1 : null)
    setStep('amount')
    if (r.currency !== 'USD')
      void getPayoutRate(r.currency === 'USDC' ? 'USC' : r.currency)
        .then(setRate)
        .catch(() => setRate(null))
  }

  /** Ren said the ID check comes first: the check's own step, which shows where it stands. */
  const needsCheck = (e: unknown) => {
    if (!(e instanceof PayoutError) || !e.verification) return false
    setAccess({ required: true, verification: e.verification })
    setStep('verify')
    return true
  }

  const save = async () => {
    if (!profile || !corridor) return
    setBusy(true)
    setProblem(null)
    try {
      const saved = await addRecipient(profile.address, signMessage, corridor.id, {
        ...values,
        ...(bank ? { bank: bank.code } : {}),
      })
      const kept = Object.fromEntries(ABOUT.filter((k) => values[k]).map((k) => [k, values[k]]))
      if (Object.keys(kept).length) {
        setAbout(kept as Record<string, string>)
        try {
          localStorage.setItem(aboutKey(profile.address), JSON.stringify(kept))
        } catch {
          // Not remembered on this browser; they're asked again next time.
        }
      }
      setRecipients((list) => [saved, ...(list ?? []).filter((r) => r.label !== saved.label)])
      startAmount(saved)
    } catch (e) {
      if (needsCheck(e)) return
      // Ren's own words name the field the bank refused; a cancelled passkey says nothing.
      const message =
        e instanceof PayoutError
          ? e.message
          : moveProblem(e, 'Those details weren’t saved. Try again.')
      if (message) setProblem(message)
    } finally {
      setBusy(false)
    }
  }

  const dollars = (() => {
    try {
      return typed ? toBase(typed) : 0n
    } catch {
      return 0n
    }
  })()
  const min = info ? toBase(info.min) : 1_000_000n
  const max = info ? toBase(info.max) : 500_000_000n
  const short = balance !== null && dollars > balance

  const getQuote = async () => {
    if (!profile || !recipient) return
    setBusy(true)
    setProblem(null)
    try {
      setQuote(await quotePayout(profile.address, recipient.id, typed))
      setNow(Date.now())
      setStep('review')
    } catch (e) {
      if (needsCheck(e)) return
      setProblem(e instanceof Error ? e.message : 'Ren couldn’t get a rate. Try again.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (step !== 'review') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [step])

  // Follows the payout until it lands or comes back. While Ren hasn't confirmed the transfer, it
  // keeps handing over the hash (the dollars are already on Tempo, so it never sends twice).
  useEffect(() => {
    if (step !== 'tracking' || !payout || payout.status === 'paid' || payout.status === 'failed')
      return
    const t = setInterval(() => {
      if (unconfirmed)
        void reportPayoutPaid(payout.id, unconfirmed)
          .then((p) => {
            setPayout(p)
            setUnconfirmed(null)
          })
          .catch(() => {})
      else
        void getPayout(payout.id)
          .then(setPayout)
          .catch(() => {})
    }, 4000)
    return () => clearInterval(t)
  }, [step, payout, unconfirmed])
  const left = quote ? Math.max(0, Math.floor((Date.parse(quote.expires_at) - now) / 1000)) : 0

  const approve = async () => {
    if (!quote) return
    setBusy(true)
    setProblem(null)
    let hash: Hex
    try {
      const pay = checkedPay(network, quote.pay)
      const moved = await sendToRen({
        ...pay,
        name: quote.recipient?.label ?? 'Cash out',
        detail: `Cash out, ${inCurrency(quote.amount_to, quote.currency)}`,
      })
      hash = moved.hash
    } catch (e) {
      const message = moveProblem(e, 'The cash-out didn’t go through. Nothing left your wallet.')
      if (message) setProblem(message)
      setBusy(false)
      return
    }
    // The dollars have left: from here the screen is the payout's, whatever Ren answers.
    let confirmed: Payout | null = null
    for (let i = 0; i < 3 && !confirmed; i++) {
      confirmed = await reportPayoutPaid(quote.id, hash).catch(() => null)
      if (!confirmed) await wait(1200)
    }
    setPayout(confirmed ?? quote)
    setUnconfirmed(confirmed ? null : hash)
    setStep('tracking')
    setBusy(false)
    void refresh()
  }

  const back = () => {
    setProblem(null)
    if (step === 'country') setStep('where')
    else if (step === 'verify') setStep(country ? 'country' : 'where')
    else if (step === 'rail') setStep('country')
    else if (step === 'details') setStep(railsOf(corridor?.country).length > 1 ? 'rail' : 'country')
    else if (step === 'amount') setStep('where')
    else if (step === 'review') setStep('amount')
  }

  const placeName = (code: string | null) => countries.find((c) => c.code === code)?.name ?? ''
  const title =
    step === 'where'
      ? 'Cash out'
      : step === 'country'
        ? 'Where to?'
        : step === 'rail' || step === 'verify'
          ? placeName(country) || 'Cash out'
          : step === 'details'
            ? (corridor?.title ?? 'Details')
            : step === 'amount'
              ? 'How much?'
              : step === 'review'
                ? 'Check and send'
                : payout?.status === 'failed'
                  ? 'Sent back'
                  : payout?.status === 'paid'
                    ? 'Arrived'
                    : 'On its way'
  const progress =
    step === 'country'
      ? 1
      : step === 'rail' || step === 'verify'
        ? 2
        : step === 'details'
          ? 3
          : step === 'amount' || step === 'review'
            ? 4
            : 0

  const fields = corridor?.fields ?? []
  const split = fields.findIndex((f) => !!f.section)
  const accountFields = split === -1 ? fields : fields.slice(0, split)
  const aboutFields = split === -1 ? [] : fields.slice(split)
  const aboutComplete = aboutFields.every((f) => f.optional || !!values[f.key])
  const setValue = (key: string) => (v: string) => setValues((prev) => ({ ...prev, [key]: v }))

  /** Every saved account in one list: naira ones (in this browser) first, then the rest. */
  const saved = [
    ...(nairaOn ? nairaRecents : []).map((r) => ({
      key: `ng-${r.bankCode}-${r.accountNumber}`,
      flag: 'NG',
      title: `${r.bankName} ••${r.accountNumber.slice(-4)}`,
      detail: `${r.name} · Naira, in minutes`,
      open: () =>
        router.push(
          `/wallet/cash-out/naira?recent=${encodeURIComponent(`${r.bankCode}:${r.accountNumber}`)}`,
        ),
    })),
    ...(recipients ?? []).map((r) => {
      const way = wayOf(r)
      return {
        key: r.id,
        flag: way ? flagCode(way) : flagCode(r),
        title: r.label,
        detail: `${r.title} · ${r.currency}`,
        open: () => startAmount(r),
      }
    }),
  ]
  const verification: Exclude<Verification, 'verified'> =
    access?.verification && access.verification !== 'verified' ? access.verification : 'needed'
  const place = country && country !== 'WW' ? placeName(country) : ''
  const live = info?.live === true && !off

  return (
    <div className="w-screen cw">
      <ScreenHead
        title={title}
        back="/wallet"
        {...(step === 'where' || step === 'tracking' ? {} : { onBack: back })}
      />
      {progress > 0 ? (
        <div className="cw-steps" role="img" aria-label={`Step ${progress} of 4`}>
          {[1, 2, 3, 4].map((n) => (
            <i key={n} data-on={n <= progress ? 'yes' : 'no'} />
          ))}
        </div>
      ) : null}

      {/* Opening: Ren hasn't said yet what this site can cash out to. */}
      {(!info && !unreachable) || (off && nairaOn !== false) ? (
        <div className="cw-opening" aria-busy="true">
          <i />
          <i />
          <i />
          <span className="sr-only">Opening Cash out</span>
        </div>
      ) : null}

      {/* Neither cash-outs abroad nor naira are on, or Ren didn't answer. */}
      {off && nairaOn === false ? (
        <div className="w-empty w-empty-art">
          <Art name="reni-sleep" size={120} />
          <strong>{unreachable ? 'Cash out didn’t open' : 'Cash out isn’t on here yet'}</strong>
          <span>
            {unreachable
              ? `${unreachable} Your dollars are where they were.`
              : 'This site isn’t connected to a payout partner yet. Your dollars stay in your wallet.'}
          </span>
          {unreachable ? (
            <button
              type="button"
              className="pill cw-gap"
              data-tone="ink"
              onClick={() => setAttempt((n) => n + 1)}
            >
              <span className="pill-label">Try again</span>
              <span className="pill-cap">
                <Icon name="arrow" size={18} />
              </span>
            </button>
          ) : null}
        </div>
      ) : null}

      {live && step === 'where' ? (
        <>
          <p className="cw-balance">
            <small>From your balance</small>
            <strong>{balance === null ? '—' : formatUsd(balance)}</strong>
          </p>
          {recipients === null ? (
            <div className="cw-opening" aria-busy="true">
              <i />
              <i />
              <span className="sr-only">Loading your accounts</span>
            </div>
          ) : saved.length > 0 ? (
            <>
              <p className="cw-head">
                <strong>Your accounts</strong>
                <small>{saved.length} saved</small>
              </p>
              <ul className="cw-card">
                {saved.map((a) => (
                  <li key={a.key}>
                    <button type="button" className="cw-row" onClick={a.open}>
                      <Flag code={a.flag} />
                      <span className="cw-text">
                        <strong>{a.title}</strong>
                        <small>{a.detail}</small>
                      </span>
                      <Icon name="arrow" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="cw-first">
              <Art name="reni-catch" size={96} />
              <strong>To your bank or mobile money</strong>
              <span>Pick a country, add the account once, and it’s saved here for next time.</span>
            </div>
          )}
          <button type="button" className="cw-add" onClick={() => setStep('country')}>
            <span className="cw-add-dot">
              <Icon name="plus" size={16} />
            </span>
            <span className="cw-text">
              <strong>New</strong>
              <small>A bank or mobile money</small>
            </span>
          </button>
        </>
      ) : null}

      {live && step === 'verify' ? (
        <div className="cw-flow cw-check">
          <span className="cw-check-icon" aria-hidden="true">
            <Icon name={verification === 'checking' ? 'clock' : 'user'} size={22} />
          </span>
          <h2 className="cw-ask">{VERIFY_COPY[verification].title}</h2>
          <p className="cw-check-body">
            {verification === 'needed'
              ? `Money to ${place || 'another country'} goes from an account in your name, so Ren’s banking partner checks it’s you. It takes a few minutes.`
              : VERIFY_COPY[verification].body}
          </p>
          {verification === 'needed' ? (
            <ul className="cw-needs">
              {CHECK_NEEDS.map((line) => (
                <li key={line}>
                  <span className="cw-tick" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="pill pill-block cw-gap"
            data-tone="ink"
            onClick={() =>
              router.push(
                verification === 'needed' ? '/wallet/card?check=1&from=cash-out' : '/wallet/card',
              )
            }
          >
            <span className="pill-label">{VERIFY_COPY[verification].cta}</span>
            <span className="pill-cap">
              <Icon name="arrow" size={18} />
            </span>
          </button>
          {nairaOn && homeCountry() === 'NG' ? (
            <button
              type="button"
              className="pill pill-block cw-gap-s"
              data-tone="light"
              onClick={() => router.push('/wallet/cash-out/naira')}
            >
              <span className="pill-label">Cash out in naira instead</span>
              <span className="pill-cap">
                <Icon name="arrow" size={18} />
              </span>
            </button>
          ) : null}
        </div>
      ) : null}

      {live && step === 'country'
        ? (() => {
            const q = search.trim().toLowerCase()
            const shown = named.filter((c) =>
              `${c.name} ${c.rails[0]?.currency ?? ''} ${ways(c.rails)}`.toLowerCase().includes(q),
            )
            // The country the browser is set to comes first, on its own.
            const mine = q ? undefined : named.find((c) => c.code === homeCountry())
            const rest = mine ? shown.filter((c) => c.code !== mine.code) : shown
            const isNaira = (code: string) => code === 'NG' && nairaOn === true
            const countryRow = (c: (typeof named)[number]) => (
              <li key={c.code}>
                <button type="button" className="cw-row" onClick={() => pickCountry(c.code)}>
                  <Flag code={c.code} />
                  <span className="cw-text">
                    <span className="cw-title">
                      <strong>{c.name}</strong>
                      {isNaira(c.code) && mustVerify ? <em className="cw-badge">No ID</em> : null}
                    </span>
                    <small>{isNaira(c.code) ? 'Any bank, naira in minutes' : ways(c.rails)}</small>
                  </span>
                  {isNaira(c.code) ? (
                    <Icon name="arrow" size={16} />
                  ) : (
                    <span className="cw-aside">{c.rails[0]?.currency}</span>
                  )}
                </button>
              </li>
            )
            return (
              <>
                <label className="cw-search">
                  <Icon name="search" size={18} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search a country or currency"
                    aria-label="Search countries"
                  />
                </label>
                {mine ? (
                  <>
                    <p className="cw-label">Your country</p>
                    <ul className="cw-card">{countryRow(mine)}</ul>
                  </>
                ) : null}
                <p className="cw-label cw-label-row">
                  <span>{q ? `${shown.length} found` : 'All countries'}</span>
                  {mustVerify && !q ? <small>One-time ID check first</small> : null}
                </p>
                {rest.length ? (
                  <ul className="cw-card">{rest.map(countryRow)}</ul>
                ) : (
                  <div className="cw-card cw-empty">
                    <strong>Not listed by name</strong>
                    <small>
                      Most banks still take an international transfer. Pick “Any other country”
                      below.
                    </small>
                  </div>
                )}
                {elsewhere.length ? (
                  <>
                    <p className="cw-label">Other ways out</p>
                    <ul className="cw-card">
                      {elsewhere.some((c) => c.id.startsWith('swift')) ? (
                        <li>
                          <button
                            type="button"
                            className="cw-row"
                            onClick={() => pickCountry('WW')}
                          >
                            <Flag code="WW" />
                            <span className="cw-text">
                              <strong>Any other country</strong>
                              <small>International bank transfer</small>
                            </span>
                            <Icon name="arrow" size={16} />
                          </button>
                        </li>
                      ) : null}
                      {elsewhere
                        .filter((c) => !c.id.startsWith('swift'))
                        .map((c) => (
                          <li key={c.id}>
                            <button type="button" className="cw-row" onClick={() => choose(c)}>
                              <Flag code={flagCode(c)} />
                              <span className="cw-text">
                                <strong>{c.name}</strong>
                                <small>{c.title.replace(/^USDC on /, '')}</small>
                              </span>
                              <Icon name="arrow" size={16} />
                            </button>
                          </li>
                        ))}
                    </ul>
                  </>
                ) : null}
              </>
            )
          })()
        : null}

      {live && step === 'rail' ? (
        <div className="cw-flow">
          <h2 className="cw-ask">
            <Flag code={country ?? 'WW'} size={28} />
            How should it arrive?
          </h2>
          <p className="cw-sub">Prices are for $100.</p>
          <div className="cw-ways">
            {railsOf(country).map((r) => {
              const net = 100 - feeOn(100)
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={r.id === picked}
                  className="cw-way"
                  onClick={() => setPicked(r.id)}
                >
                  <span className="cw-way-head">
                    <i className="cw-radio" />
                    <strong>{r.title}</strong>
                    {r.speed === 'Instant' ? <span className="cw-tag">Fastest</span> : null}
                  </span>
                  <span className="cw-way-facts">
                    <span>
                      <small>Arrives</small>
                      <b>{brief(r.speed)}</b>
                    </span>
                    <span>
                      <small>Fees</small>
                      <b>${feeOn(100).toFixed(2)}</b>
                    </span>
                    <span>
                      <small>They get</small>
                      <b>
                        {rate === null
                          ? '…'
                          : `${r.currency === 'USD' ? '' : '≈ '}${inCurrency(net * rate, r.currency)}`}
                      </b>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="pill pill-block cw-gap"
            data-tone="ink"
            disabled={!picked}
            onClick={() => {
              const r = info?.corridors.find((c) => c.id === picked)
              if (r) choose(r)
            }}
          >
            <span className="pill-label">Continue</span>
            <span className="pill-cap">
              <Icon name="arrow" size={18} />
            </span>
          </button>
        </div>
      ) : null}

      {live && step === 'details' && corridor ? (
        <form
          className="cw-flow"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div className="cw-rail">
            <Flag code={flagCode(corridor)} size={30} />
            <span className="cw-text">
              <strong>{corridor.name}</strong>
              <small>
                {corridor.speed} · arrives in {corridor.currency}
              </small>
            </span>
          </div>
          <p className="cw-label">The account</p>
          <div className="cw-card">
            {rowsOf(accountFields).map((row) => (
              <div key={row.map((f) => f.key).join()} className="cw-line">
                {row.map((f) => (
                  <Field
                    key={f.key}
                    field={f}
                    value={values[f.key] ?? ''}
                    onChange={setValue(f.key)}
                    banks={banks}
                    bank={bank}
                    bankQuery={bankQuery}
                    setBankQuery={setBankQuery}
                    onBank={setBank}
                  />
                ))}
              </div>
            ))}
          </div>
          {aboutFields.length ? (
            <>
              <p className="cw-head">
                <strong>Your address</strong>
                <small>Asked once, kept in this browser</small>
              </p>
              {!editAbout && aboutComplete ? (
                <div className="cw-card cw-about">
                  <span className="cw-home">
                    <Icon name="home" size={16} />
                  </span>
                  <span className="cw-text">
                    <strong>
                      {[values.address_line1, values.address_city].filter(Boolean).join(', ')}
                    </strong>
                    <small>
                      {[values.address_state, values.address_postal_code, values.address_country]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </span>
                  <button type="button" className="cw-link" onClick={() => setEditAbout(true)}>
                    Edit
                  </button>
                </div>
              ) : (
                <div className="cw-card">
                  {rowsOf(aboutFields).map((row) => (
                    <div key={row.map((f) => f.key).join()} className="cw-line">
                      {row.map((f) => (
                        <Field
                          key={f.key}
                          field={f}
                          value={values[f.key] ?? ''}
                          onChange={setValue(f.key)}
                          banks={null}
                          bank={null}
                          bankQuery=""
                          setBankQuery={() => {}}
                          onBank={() => {}}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <p className="cw-note">
                <Icon name="lock" size={12} />
                Banks need it to pay you. Ren keeps only the account’s last digits.
              </p>
            </>
          ) : null}
          <Problem text={problem} />
          <button type="submit" className="pill pill-block cw-gap" data-tone="ink" disabled={busy}>
            <span className="pill-label">{busy ? 'Saving…' : 'Save account'}</span>
            <span className="pill-cap">
              <Icon name="face" size={18} />
            </span>
          </button>
        </form>
      ) : null}

      {live && step === 'amount' && recipient ? (
        <div className="cw-amount">
          <button type="button" className="cw-to" onClick={() => setStep('where')}>
            <Flag
              code={(() => {
                const way = wayOf(recipient)
                return way ? flagCode(way) : flagCode(recipient)
              })()}
              size={30}
            />
            <span className="cw-text">
              <strong>{recipient.label}</strong>
              <small>
                {recipient.title} · {recipient.speed}
              </small>
            </span>
            <span className="cw-link">Change</span>
          </button>
          <strong className="cw-typed" aria-live="polite">
            <small>$</small>
            {typed || '0'}
          </strong>
          <p className="cw-left" data-over={short ? 'yes' : 'no'}>
            {short
              ? 'More than you have'
              : balance === null
                ? ''
                : `${formatUsd(balance)} available`}
          </p>
          <div className="cw-sums">
            <span>
              <small>Fees</small>
              <b>{dollars > 0n ? `$${feeOn(Number(dollars) / 1e6).toFixed(2)}` : '—'}</b>
            </span>
            <span data-strong="yes">
              <small>They get</small>
              <b>
                {dollars === 0n
                  ? '—'
                  : rate === null
                    ? '…'
                    : `${recipient.currency === 'USD' ? '' : '≈ '}${inCurrency(
                        (Number(dollars) / 1e6 - feeOn(Number(dollars) / 1e6)) * rate,
                        recipient.currency,
                      )}`}
              </b>
            </span>
            <span>
              <small>Arrives</small>
              <b>{brief(recipient.speed)}</b>
            </span>
          </div>
          <Keypad onKey={(key) => setTyped((t) => applyKey(t, key, 2))} />
          <Problem text={problem} />
          <button
            type="button"
            className="pill pill-block"
            data-tone="ink"
            disabled={busy || dollars < min || dollars > max || short}
            onClick={() => void getQuote()}
          >
            <span className="pill-label">
              {dollars > 0n && dollars < min
                ? `At least ${formatUsd(min)}`
                : dollars > max
                  ? `Up to ${formatUsd(max)} at a time`
                  : short
                    ? 'Not enough in your balance'
                    : busy
                      ? 'Locking the rate…'
                      : 'Continue'}
            </span>
            <span className="pill-cap">
              <Icon name="arrow" size={18} />
            </span>
          </button>
        </div>
      ) : null}

      {live && step === 'review' && quote ? (
        <div className="cw-flow">
          <p className="cw-hero">
            <small>{quote.recipient?.holder_name ?? 'They'} gets</small>
            <strong>{inCurrency(quote.amount_to, quote.currency)}</strong>
            <small>{quote.recipient?.label}</small>
          </p>
          <dl className="cw-card cw-facts">
            <div>
              <dt>You send</dt>
              <dd>${quote.amount}</dd>
            </div>
            <div>
              <dt>Fees</dt>
              <dd>${quote.fee}</dd>
            </div>
            {quote.currency !== 'USD' ? (
              <div>
                <dt>Rate</dt>
                <dd>$1 = {inCurrency(Number(quote.rate), quote.currency)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Network fee</dt>
              <dd>$0.00, Ren covers it</dd>
            </div>
            <div>
              <dt>Arrives</dt>
              <dd data-tone="teal">{quote.recipient?.speed}</dd>
            </div>
          </dl>
          <p className="cw-held" data-out={left > 0 ? 'no' : 'yes'}>
            <Icon name="clock" size={14} />
            {left > 0
              ? `${quote.currency === 'USD' ? 'Good' : 'Rate held'} for ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
              : quote.currency === 'USD'
                ? 'This one ran out. Get a fresh one.'
                : 'This rate ran out. Get a fresh one.'}
          </p>
          <Problem text={problem} />
          <div className="cw-gap">
            {left > 0 ? (
              <SlideToSend
                label={problem ? 'Slide to try again' : `Slide to send $${quote.amount}`}
                busy={busy}
                busyLabel="Sending"
                onSend={() => void approve()}
              />
            ) : (
              <button
                type="button"
                className="pill pill-block"
                data-tone="ink"
                disabled={busy}
                onClick={() => void getQuote()}
              >
                <span className="pill-label">
                  {busy ? 'Locking the rate…' : 'Get a fresh rate'}
                </span>
                <span className="pill-cap">
                  <Icon name="arrow" size={18} />
                </span>
              </button>
            )}
          </div>
          <p className="w-fine w-center">If the bank can’t take it, your dollars come back.</p>
        </div>
      ) : null}

      {step === 'tracking' && payout ? (
        <div className="cw-flow">
          <p className="cw-hero">
            <strong>
              {payout.status === 'failed'
                ? `$${payout.amount}`
                : inCurrency(payout.amount_to, payout.currency)}
            </strong>
            <small>
              {payout.status === 'failed'
                ? 'back in your Ren wallet'
                : `to ${payout.recipient?.label ?? 'the account'}`}
            </small>
          </p>
          {unconfirmed ? (
            <p className="cw-waiting" role="status">
              <Icon name="clock" size={16} />
              Your dollars left your wallet. Ren is confirming them; this screen keeps checking, so
              there’s nothing to send again.
            </p>
          ) : null}
          <ol className="cw-card cw-stages">
            <Stage
              title="Sent"
              time={clock(payout.created_at)}
              detail="From your Ren wallet"
              state="done"
            />
            {payout.status === 'failed' ? (
              <>
                <Stage
                  title="The bank couldn’t take it"
                  detail={plainFailure(payout.failure)}
                  state="failed"
                />
                <Stage title="Back in your wallet" detail="Every cent, fees too" state="done" />
              </>
            ) : (
              <>
                <Stage
                  title={unconfirmed ? 'Ren confirms it' : 'Paid out'}
                  detail={
                    unconfirmed
                      ? 'Usually a few seconds'
                      : `To ${payout.recipient?.label ?? 'the account'}`
                  }
                  state={
                    payout.status === 'sending' || payout.status === 'paid' ? 'done' : 'active'
                  }
                />
                <Stage
                  title="On its way to the bank"
                  time={payout.status === 'sending' ? 'Now' : undefined}
                  detail="Banks move money on business days"
                  state={
                    payout.status === 'paid'
                      ? 'done'
                      : payout.status === 'sending'
                        ? 'active'
                        : 'pending'
                  }
                />
                <Stage
                  title="In the account"
                  detail={
                    payout.status === 'paid'
                      ? 'It’s there'
                      : `Usually ${(payout.recipient?.speed ?? '').toLowerCase()}`
                  }
                  state={payout.status === 'paid' ? 'done' : 'pending'}
                />
              </>
            )}
          </ol>
          <dl className="cw-receipt">
            <div>
              <dt>You sent</dt>
              <dd>${payout.amount}</dd>
            </div>
            <div>
              <dt>Fees</dt>
              <dd>${payout.fee}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="pill pill-block cw-gap"
            data-tone="ink"
            onClick={() => router.push('/wallet')}
          >
            <span className="pill-label">Done</span>
            <span className="pill-cap">
              <Icon name="check" size={18} />
            </span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

const VERIFY_COPY: Record<
  Exclude<Verification, 'verified'>,
  { title: string; body: string; cta: string }
> = {
  needed: {
    title: 'Check your ID, once',
    body: 'Money to another country goes from an account in your name, so Ren’s banking partner checks it’s you. It takes a few minutes.',
    cta: 'Check my ID',
  },
  checking: {
    title: 'Your ID is being checked',
    body: 'You can cash out to other countries as soon as it passes. It usually takes a few minutes.',
    cta: 'See the check',
  },
  failed: {
    title: 'Your ID check didn’t pass',
    body: 'Cashing out to other countries isn’t open to you yet. You can see why and send it again.',
    cta: 'See why',
  },
}

/** What the ID check asks for (the dollar card's check, components/wallet/dollar-card.tsx). */
const CHECK_NEEDS = [
  'A passport, driver’s licence or national ID',
  'A bill or bank statement with your address',
  'Done once, for every country and your dollar card',
]

function Stage({
  title,
  detail,
  time,
  state,
}: {
  title: string
  detail: string
  time?: string
  state: 'done' | 'active' | 'pending' | 'failed'
}) {
  return (
    <li data-state={state}>
      <span className="cw-stage-top">
        <strong>{title}</strong>
        {time ? <small data-now={time === 'Now' ? 'yes' : 'no'}>{time}</small> : null}
      </span>
      <small>{detail}</small>
    </li>
  )
}

function Field({
  field,
  value,
  onChange,
  banks,
  bank,
  bankQuery,
  setBankQuery,
  onBank,
}: {
  field: PayoutField
  value: string
  onChange: (v: string) => void
  banks: PayoutBank[] | null
  bank: PayoutBank | null
  bankQuery: string
  setBankQuery: (q: string) => void
  onBank: (b: PayoutBank | null) => void
}) {
  const label = `${field.label}${field.optional ? ' (optional)' : ''}`
  if (field.kind === 'bank') {
    const q = bankQuery.trim().toLowerCase()
    const matches = (banks ?? []).filter((b) => b.name.toLowerCase().includes(q)).slice(0, 8)
    return (
      <div className="cw-field">
        <span>{label}</span>
        {bank ? (
          <button type="button" className="cw-picked" onClick={() => onBank(null)}>
            {bank.name} <small>Change</small>
          </button>
        ) : (
          <>
            <input
              value={bankQuery}
              onChange={(e) => setBankQuery(e.target.value)}
              placeholder={
                banks === null
                  ? 'Loading banks…'
                  : banks.length === 0
                    ? 'Type your bank’s name'
                    : `Search ${banks.length} banks`
              }
              aria-label="Search banks"
            />
            {q ? (
              <ul className="cw-banks">
                {matches.map((b) => (
                  <li key={`${b.code}-${b.name}`}>
                    <button type="button" onClick={() => onBank(b)}>
                      {b.name}
                    </button>
                  </li>
                ))}
                {matches.length === 0 ? (
                  <li className="cw-banks-none">
                    {banks === null ? 'Loading banks…' : 'No bank by that name.'}
                  </li>
                ) : null}
              </ul>
            ) : null}
          </>
        )}
      </div>
    )
  }
  if (field.kind === 'select')
    return (
      <div className="cw-field cw-field-row">
        <span>{label}</span>
        <div className="cw-segment">
          {(field.options ?? []).map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={value === o.value}
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    )
  return (
    <label className="cw-field">
      <span>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint(field)}
        inputMode={
          field.kind === 'digits'
            ? 'numeric'
            : field.kind === 'phone'
              ? 'tel'
              : field.kind === 'email'
                ? 'email'
                : 'text'
        }
        type={field.kind === 'email' ? 'email' : 'text'}
        autoComplete="off"
        autoCapitalize={
          field.kind === 'country' || field.kind === 'bic' || field.kind === 'iban'
            ? 'characters'
            : 'none'
        }
        spellCheck={false}
      />
    </label>
  )
}
