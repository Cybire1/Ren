'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Hex } from 'viem'
import { Art, Icon, Wordmark } from '@/components/brand'
import { formatUsd, toBase } from '@/lib/wallet/money'
import {
  type CardCheck,
  type CardDetails,
  type CardTopUp,
  type DollarCard,
  deleteDollarCard,
  getDollarCard,
  newDollarCard,
  reportCardTopUpSent,
  requestCardAccess,
  revealDollarCard,
  setDollarCard,
  startCardCheck,
  startCardTopUp,
  topUpFee,
  withdrawFromCard,
} from '@/lib/wallet/partners'
import { checkedPay, moveProblem, wait } from '@/lib/wallet/signed'
import '@/styles/dollar-card.css'
import { ScreenHead } from './activity'
import { useWallet } from './provider'

/**
 * The dollar card (Nuvion) in the web wallet: a virtual USD card topped up from the wallet, up to
 * a daily cap. Where you are decides the screen: what it is, the ID check, the check with the
 * issuer, a check that didn't pass, the card itself (balance, top up, withdraw, details, freeze,
 * delete), or a deleted card with its money and the way to a new one.
 *
 * It sits beside the Ren Card (a key on your wallet, under Keys): this one is a card number that
 * works anywhere online, filled from the wallet. A top-up is a transfer the wallet sends itself
 * (sponsored, with the top-up's memo), then reports by its hash.
 */

/** Something went wrong, in words; null when they only cancelled their passkey. */
const problemOf = (e: unknown) => moveProblem(e, 'Something went wrong. Try again.')
const BLOCKS = 10

type View = 'home' | 'check' | 'top-up' | 'withdraw' | 'details' | 'delete'

export function DollarCardScreen() {
  const { profile } = useWallet()
  const address = profile?.address
  const [data, setData] = useState<DollarCard | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [view, setView] = useState<View>('home')
  const router = useRouter()
  // Opened from Cash out (?check=1&from=cash-out): straight to the ID check, then back to Cash out.
  const [fromCashOut, setFromCashOut] = useState(false)
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search)
    if (asked.get('check') === '1') setView('check')
    setFromCashOut(asked.get('from') === 'cash-out')
  }, [])
  const load = useCallback(async () => {
    if (!address) return
    try {
      setData(await getDollarCard(address))
      setProblem(null)
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Ren didn’t answer. Try again.')
    }
  }, [address])
  useEffect(() => {
    void load()
  }, [load])

  // While the issuer checks the ID (or makes the card), look again so the card appears by itself.
  const checking = data?.stage === 'checking'
  useEffect(() => {
    if (!checking) return
    const t = setInterval(() => void load(), 8000)
    return () => clearInterval(t)
  }, [checking, load])

  if (!data)
    return (
      <div className="w-screen dcd">
        <ScreenHead title="Dollar card" />
        {problem ? (
          <div className="w-empty w-empty-art">
            <Art name="reni-oops" size={120} />
            <strong>The card didn’t open</strong>
            <span>{problem}</span>
            <button
              type="button"
              className="pill dcd-gap"
              data-tone="ink"
              onClick={() => {
                setProblem(null)
                void load()
              }}
            >
              <span className="pill-label">Try again</span>
              <span className="pill-cap">
                <Icon name="arrow" size={18} />
              </span>
            </button>
          </div>
        ) : (
          <div className="dcd-opening" aria-busy="true">
            <i data-shape="card" />
            <i />
            <i />
            <span className="sr-only">Opening your card</span>
          </div>
        )}
      </div>
    )
  if (view === 'check')
    return (
      <Check
        onBack={() => (fromCashOut ? router.back() : setView('home'))}
        onSent={(d) => {
          setData(d)
          if (fromCashOut) router.push('/wallet/cash-out')
          else setView('home')
        }}
      />
    )
  if (view === 'details') return <Details onClose={() => setView('home')} />
  if (!data.live)
    return <Waitlist data={data} onRequested={() => setData({ ...data, requested: true })} />
  if (data.stage === 'intro')
    return <Intro sandbox={data.sandbox} cap={data.daily_topup} onStart={() => setView('check')} />
  if (data.stage === 'checking')
    return (
      <Checking
        approved={!!data.approved}
        cardProblem={data.card_problem ?? null}
        problem={problem}
        onRefresh={load}
      />
    )
  if (data.stage === 'fix')
    return (
      <TryAgain
        reason={data.reason ?? null}
        unfinished={!!data.unfinished}
        onRetry={() => setView('check')}
      />
    )
  if (data.stage === 'closed')
    return (
      <>
        <CardClosed data={data} onChange={setData} onWithdraw={() => setView('withdraw')} />
        {view === 'withdraw' ? (
          <Withdraw
            data={data}
            onClose={() => setView('home')}
            onDone={(d) => {
              setData(d)
              setView('home')
            }}
          />
        ) : null}
      </>
    )
  return (
    <>
      <CardHome
        data={data}
        onChange={setData}
        onTopUp={() => setView('top-up')}
        onWithdraw={() => setView('withdraw')}
        onDetails={() => setView('details')}
        onDelete={() => setView('delete')}
      />
      {view === 'top-up' ? (
        <TopUp
          data={data}
          onClose={() => setView('home')}
          onDone={(d) => {
            setData(d)
            setView('home')
          }}
        />
      ) : null}
      {view === 'withdraw' ? (
        <Withdraw
          data={data}
          onClose={() => setView('home')}
          onDone={(d) => {
            setData(d)
            setView('home')
          }}
        />
      ) : null}
      {view === 'delete' ? (
        <DeleteCard
          data={data}
          onClose={() => setView('home')}
          onDeleted={(d) => {
            setData(d)
            setView('home')
          }}
        />
      ) : null}
    </>
  )
}

/** Home's way in: the card and where it stands, in the row style of Home's other cards. */
export function DollarCardRow() {
  const { profile } = useWallet()
  const address = profile?.address
  const [card, setCard] = useState<DollarCard | null>(null)
  useEffect(() => {
    if (!address) return
    void getDollarCard(address)
      .then(setCard)
      .catch(() => setCard(null))
  }, [address])
  const line = card?.card
    ? card.card.frozen
      ? `•••• ${card.card.last_four} · Frozen`
      : card.card.balance
        ? `•••• ${card.card.last_four} · ${formatUsd(BigInt(card.card.balance))} to spend`
        : `•••• ${card.card.last_four}`
    : card?.stage === 'checking'
      ? 'Your ID is being checked'
      : card?.stage === 'fix'
        ? 'Your ID check needs another look'
        : card?.stage === 'closed'
          ? 'Deleted. Get a new one any time'
          : 'A card number that works anywhere online'
  return (
    <Link href="/wallet/card" className="w-keyscard">
      <span className="w-keyscard-icon dcd-row-icon">
        <Icon name="card" size={20} />
      </span>
      <span className="w-keyscard-text">
        <small>Dollar card</small>
        <strong>{card?.card ? 'Spend anywhere' : 'Get a dollar card'}</strong>
        <span>{line}</span>
      </span>
      <span className="w-privcard-go w-keyscard-arrow" aria-hidden="true">
        <Icon name="arrow" size={18} />
      </span>
    </Link>
  )
}

function Problem({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <p className="w-sheet-problem dcd-problem" role="alert">
      <Icon name="info" size={18} />
      {text}
    </p>
  )
}

/**
 * The card, drawn: Ren's raspberry plastic with the chip, the contactless mark and the network.
 * Every size is in card units (--u, 1/354 of the card's width), so it scales as one piece. The
 * same drawing is the small card on the home screens and the full one in Card details.
 */
function Plastic({
  last4,
  brand,
  name,
  frozen,
  className,
}: {
  last4?: string
  brand?: string
  name?: string
  frozen?: boolean
  className?: string
}) {
  return (
    <span
      className={`dcd-plastic${className ? ` ${className}` : ''}`}
      data-frozen={frozen ? 'yes' : undefined}
      role="img"
      aria-label={
        last4 ? `Your Ren dollar card ending ${last4}${frozen ? ', frozen' : ''}` : 'The Ren card'
      }
    >
      <span className="dcd-face">
        <FaceMark />
        <span className="dcd-face-logo">
          <Wordmark height={30} ink="#fff" shadow="transparent" />
        </span>
        <span className="dcd-face-kind">VIRTUAL</span>
        <Chip />
        <Tap />
        <span className="dcd-print dcd-face-number">
          {last4 ? `•••• •••• •••• ${last4}` : '•••• •••• •••• ••••'}
        </span>
        {name ? <span className="dcd-print dcd-face-name">{name}</span> : null}
        <CardBrand brand={brand} className="dcd-face-brand" />
      </span>
    </span>
  )
}

/** The big contactless mark printed across the card, a shade off the plastic. */
function FaceMark() {
  return (
    <svg className="dcd-face-mark" viewBox="0 0 354 223" aria-hidden="true">
      <path d="M236 44v136" strokeWidth="20" />
      <path
        d="M264 80a44 44 0 0 1 0 64M286 62a72 72 0 0 1 0 100M308 44a100 100 0 0 1 0 136"
        strokeWidth="15"
      />
    </svg>
  )
}

function Tap() {
  return (
    <svg className="dcd-face-tap" viewBox="0 0 20 24" aria-hidden="true">
      <path d="M3 8a6 6 0 0 1 0 8M8 5a10 10 0 0 1 0 14M13 2a14 14 0 0 1 0 20" />
    </svg>
  )
}

/** What the card is, before there is one: the same picture whether it's open here yet or not. */
function IntroTop() {
  return (
    <div className="dcd-intro-top">
      <h1 className="dcd-hero">{'Spend\ndollars\nanywhere.'}</h1>
      <Art name="reni-ride" size={132} className="dcd-reni" />
      <Plastic className="dcd-intro-card" />
    </div>
  )
}

function Waitlist({ data, onRequested }: { data: DollarCard; onRequested: () => void }) {
  const { profile, signMessage } = useWallet()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="w-screen dcd">
      <ScreenHead title="Dollar card" />
      <IntroTop />
      <p className="w-lead dcd-lead">
        Subscriptions, flights, apps, anything online that takes a card. Fill it from your Ren
        balance in a tap. Opening soon.
      </p>
      <Problem text={error} />
      <button
        type="button"
        className="pill pill-block dcd-gap"
        data-tone="ink"
        disabled={busy || data.requested || !profile}
        onClick={async () => {
          if (!profile) return
          setBusy(true)
          setError(null)
          try {
            await requestCardAccess(profile.address, signMessage)
            onRequested()
          } catch (e) {
            setError(problemOf(e))
          } finally {
            setBusy(false)
          }
        }}
      >
        <span className="pill-label">
          {data.requested ? 'You’re on the list' : busy ? 'One moment…' : 'Request access'}
        </span>
        <span className="pill-cap">
          <Icon name={data.requested ? 'check' : 'bell'} size={18} />
        </span>
      </button>
      {data.requested ? (
        <p className="dcd-fine">We’ll open it for this wallet as soon as the card is ready here.</p>
      ) : null}
    </div>
  )
}

function Intro({ sandbox, cap, onStart }: { sandbox: boolean; cap: string; onStart: () => void }) {
  return (
    <div className="w-screen dcd">
      <ScreenHead title="Dollar card" />
      <IntroTop />
      <div className="dcd-stickers">
        <span>Top up from Ren</span>
        <span data-tone="teal">Up to ${Number(BigInt(cap) / 1_000_000n)} a day</span>
        <span>Freeze in one tap</span>
        <span data-tone="coral">One ID check</span>
      </div>
      {sandbox ? <p className="dcd-sandbox">Card sandbox: a test card, no money moves.</p> : null}
      <div className="dcd-foot">
        <button type="button" className="pill pill-block" data-tone="coral" onClick={onStart}>
          <span className="pill-label">Get my card</span>
          <span className="pill-cap">
            <Icon name="arrow" size={18} />
          </span>
        </button>
        <p className="dcd-fine">
          Virtual card with our partner Nuvion. Ren covers the card fee. Your main balance stays in
          your wallet.
        </p>
      </div>
    </div>
  )
}

/** The check is with Nuvion: waiting on the ID, or approved and waiting on the card itself. */
function Checking({
  approved,
  cardProblem,
  problem,
  onRefresh,
}: {
  approved: boolean
  cardProblem: string | null
  problem: string | null
  onRefresh: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="w-screen dcd">
      <ScreenHead title="Dollar card" />
      <div className="dcd-check-art">
        <span className="dcd-check-card" />
        <Art name="reni-peek" size={240} />
      </div>
      <h1 className="dcd-title">{approved ? 'Your ID is approved' : 'Checking your ID'}</h1>
      <p className="w-lead dcd-lead">
        {cardProblem
          ? 'Nuvion is taking longer than usual to make your card. Ren keeps asking, and it appears here as soon as it’s ready. Nothing is charged until then.'
          : approved
            ? 'Nuvion is making your card. It appears here as soon as it’s ready.'
            : 'Your card appears here the moment Nuvion is done. You can close this page; it’s checked again when you come back.'}
      </p>
      <ol className="dcd-steps">
        <li data-state="done">Details sent</li>
        <li data-state="done">ID and proof of address sent</li>
        <li data-state={approved ? 'done' : 'now'}>Nuvion checks it</li>
        <li data-state={approved ? 'now' : undefined}>Your card is made</li>
      </ol>
      {cardProblem ? <p className="dcd-said">Nuvion said: {cardProblem}</p> : null}
      <Problem text={problem} />
      <button
        type="button"
        className="pill pill-block dcd-gap"
        data-tone="light"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await onRefresh()
          setBusy(false)
        }}
      >
        <span className="pill-label">{busy ? 'Checking…' : 'Check again'}</span>
        <span className="pill-cap">
          <Icon name="clock" size={18} />
        </span>
      </button>
      <p className="dcd-fine">If something doesn’t match, we’ll tell you what to fix.</p>
    </div>
  )
}

/** A check to send again: one that stopped before Nuvion could review it, or one it refused. */
function TryAgain({
  reason,
  unfinished,
  onRetry,
}: {
  reason: string | null
  unfinished: boolean
  onRetry: () => void
}) {
  return (
    <div className="w-screen dcd">
      <ScreenHead title="Dollar card" />
      <div className="dcd-oops">
        <Art name="reni-oops" size={132} />
      </div>
      <h1 className="dcd-title">{unfinished ? 'Finish your ID check' : 'Your ID didn’t pass'}</h1>
      {reason ? <p className="dcd-said">Nuvion said: {reason}</p> : null}
      <p className="w-lead dcd-lead">
        {unfinished
          ? 'Nuvion needs a photo of your ID and a bill or bank statement with your address before it can check you. It takes a minute.'
          : `${reason ? '' : 'Nuvion couldn’t confirm your details from that photo. '}Check that your details match your ID exactly, then send a clearer photo.`}
      </p>
      <button type="button" className="pill pill-block dcd-gap" data-tone="coral" onClick={onRetry}>
        <span className="pill-label">{unfinished ? 'Finish my check' : 'Try again'}</span>
        <span className="pill-cap">
          <Icon name="arrow" size={18} />
        </span>
      </button>
    </div>
  )
}

const COUNTRIES = [
  ['NG', 'Nigeria'],
  ['GH', 'Ghana'],
  ['KE', 'Kenya'],
  ['ZA', 'South Africa'],
  ['GB', 'United Kingdom'],
  ['US', 'United States'],
] as const
const IDS: Array<[CardCheck['document']['type'], string]> = [
  ['international_passport', 'Passport'],
  ['national_id', 'National ID'],
  ['drivers_license', 'Licence'],
]

const PROOFS: Array<[CardCheck['address_proof']['type'], string]> = [
  ['utility_bill', 'Utility bill'],
  ['bank_statement', 'Bank statement'],
]

/** The national number Nuvion needs from some countries: a NIN or BVN in Nigeria, an SSN in the US. */
const NUMBERS = {
  nin: {
    label: 'NIN',
    digits: 11,
    hint: 'On your NIN slip and newer passports. Or dial *346# from the phone it’s linked to.',
  },
  bvn: { label: 'BVN', digits: 11, hint: 'Dial *565*0# from the phone number your bank has.' },
  ssn: { label: 'Social Security number', digits: 9, hint: 'The 9 digits on your card.' },
} as const

type Upload = { url: string; base64: string; mime: CardCheck['document']['mime'] }

/**
 * The ID check in three steps: your details exactly as on your ID, a photo of it, then a bill or
 * bank statement showing your address (Nuvion needs both documents before it will check anyone).
 */
function Check({ onBack, onSent }: { onBack: () => void; onSent: (d: DollarCard) => void }) {
  const { profile, signMessage } = useWallet()
  const [step, setStep] = useState<'details' | 'photo' | 'address'>('details')
  const [f, setF] = useState({
    first: '',
    last: '',
    dob: '',
    gender: '' as '' | 'f' | 'm',
    country: 'NG',
    email: '',
    phone: '+234',
    line1: '',
    city: '',
    state: '',
    postal: '',
    idType: 'international_passport' as CardCheck['document']['type'],
    idNumber: '',
    numberType: 'nin' as 'nin' | 'bvn',
    number: '',
    proofType: 'utility_bill' as CardCheck['address_proof']['type'],
  })
  const [photo, setPhoto] = useState<Upload | null>(null)
  const [proof, setProof] = useState<Upload | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Continue was pressed with something missing: say what, under the fields. */
  const [asked, setAsked] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value })
  const adult = (() => {
    const d = new Date(`${f.dob}T00:00:00Z`)
    const line = new Date()
    line.setUTCFullYear(line.getUTCFullYear() - 18)
    return !Number.isNaN(d.getTime()) && d <= line && d.getUTCFullYear() >= 1900
  })()
  const kind = f.country === 'NG' ? f.numberType : f.country === 'US' ? 'ssn' : null
  const digits = f.number.replace(/\D/g, '')
  /** The first thing still missing, in words; null when the details are complete. */
  const missing = !f.first.trim()
    ? 'Add your first name.'
    : !f.last.trim()
      ? 'Add your last name.'
      : !f.dob
        ? 'Add your date of birth.'
        : !adult
          ? 'The card is for people 18 and over.'
          : !f.gender
            ? 'Choose the gender on your ID.'
            : !/^\S+@\S+\.\S+$/.test(f.email.trim())
              ? 'Add an email address.'
              : !/^\+\d{8,15}$/.test(f.phone.replace(/\s/g, ''))
                ? 'Add your phone number with its country code, like +234…'
                : f.line1.trim().length < 3
                  ? 'Add your home address.'
                  : f.city.trim().length < 2
                    ? 'Add your city.'
                    : f.state.trim().length < 2
                      ? 'Add your state.'
                      : f.postal.trim().length < 2
                        ? 'Add your postcode.'
                        : f.idNumber.trim().length < 4
                          ? 'Add the number on your ID.'
                          : kind && digits.length !== NUMBERS[kind].digits
                            ? `Your ${NUMBERS[kind].label} is ${NUMBERS[kind].digits} digits.`
                            : null
  const idName = IDS.find(([t]) => t === f.idType)?.[1] ?? 'ID'

  const read = (keep: (u: Upload) => void) => async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (file.size > 6_000_000) return setError('That file is over 6 MB. Choose a smaller one.')
    const mime = file.type as CardCheck['document']['mime']
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(mime))
      return setError('Choose a JPEG, PNG or PDF.')
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = () => reject(new Error('That file couldn’t be read.'))
        reader.readAsDataURL(file)
      })
      keep({ url: URL.createObjectURL(file), base64, mime })
    } catch {
      setError('That file couldn’t be read. Choose it again.')
    }
  }

  const send = async () => {
    if (!profile || !photo || !proof || !f.gender) return
    setBusy(true)
    setError(null)
    try {
      onSent(
        await startCardCheck(profile.address, signMessage, {
          first_name: f.first.trim(),
          last_name: f.last.trim(),
          date_of_birth: f.dob,
          email: f.email.trim(),
          phone: f.phone.replace(/\s/g, ''),
          nationality: f.country,
          gender: f.gender,
          address: {
            line1: f.line1.trim(),
            city: f.city.trim(),
            state: f.state.trim(),
            postal_code: f.postal.trim(),
            country: f.country,
          },
          document: {
            type: f.idType,
            number: f.idNumber.trim(),
            file: photo.base64,
            mime: photo.mime,
          },
          ...(kind ? { id_number: { type: kind, value: digits } } : {}),
          address_proof: { type: f.proofType, file: proof.base64, mime: proof.mime },
        }),
      )
    } catch (e) {
      setError(problemOf(e))
    } finally {
      setBusy(false)
    }
  }

  if (step === 'photo')
    return (
      <PhotoStep
        step={2}
        label={`Step 2 of 3 · Photo of your ${idName.toLowerCase()}`}
        title={`Fit your ${idName.toLowerCase()} in the frame`}
        camera
        upload={photo}
        tips={[
          ['glare', 'No glare'],
          ['corners', 'All four corners'],
          ['type', 'Easy to read'],
        ]}
        error={error}
        onBack={() => {
          setError(null)
          setStep('details')
        }}
        onFile={read(setPhoto)}
        next={{
          label: 'Continue',
          icon: 'arrow',
          onClick: () => {
            setError(null)
            setStep('address')
          },
        }}
      />
    )

  if (step === 'address')
    return (
      <PhotoStep
        step={3}
        label="Step 3 of 3 · Proof of address"
        title="A bill or statement with your address"
        lead={`From the last 3 months, with ${`${f.first.trim()} ${f.last.trim()}`.trim() || 'your name'} and ${f.line1.trim() || 'your address'} on it. A photo or a PDF.`}
        choices={
          <div className="dcd-choices">
            {PROOFS.map(([type, name]) => (
              <button
                key={type}
                type="button"
                aria-pressed={f.proofType === type}
                onClick={() => setF({ ...f, proofType: type })}
              >
                {name}
              </button>
            ))}
          </div>
        }
        tall
        upload={proof}
        tips={[
          ['user', 'Your name'],
          ['home', 'This address'],
          ['calendar', 'Last 3 months'],
        ]}
        error={error}
        onBack={() => {
          setError(null)
          setStep('photo')
        }}
        onFile={read(setProof)}
        next={{
          label: busy ? 'Sending to Nuvion…' : 'Send for checking',
          icon: 'check',
          busy,
          onClick: () => void send(),
        }}
      />
    )

  return (
    <div className="w-screen dcd">
      <ScreenHead title="ID check" onBack={onBack} />
      <form
        className="dcd-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (missing) setAsked(true)
          else setStep('photo')
        }}
      >
        <Progress step={1} label="Step 1 of 3 · Your details" />
        <h1 className="dcd-title">Exactly as it’s written on your ID</h1>
        <div className="dcd-pair">
          <Field
            label="First name"
            value={f.first}
            onChange={set('first')}
            autoComplete="given-name"
            placeholder="Mia"
          />
          <Field
            label="Last name"
            value={f.last}
            onChange={set('last')}
            autoComplete="family-name"
          />
        </div>
        <div className="dcd-pair">
          <Field
            label="Date of birth"
            type="date"
            value={f.dob}
            onChange={set('dob')}
            autoComplete="bday"
          />
          <fieldset className="dcd-fieldset">
            <legend>Gender</legend>
            <div className="dcd-choices">
              {(
                [
                  ['f', 'Female'],
                  ['m', 'Male'],
                ] as const
              ).map(([g, name]) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={f.gender === g}
                  onClick={() => setF({ ...f, gender: g })}
                >
                  {name}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <fieldset className="dcd-fieldset">
          <legend>Nationality</legend>
          <div className="dcd-choices dcd-wrap">
            {COUNTRIES.map(([code, name]) => (
              <button
                key={code}
                type="button"
                aria-pressed={f.country === code}
                onClick={() => setF({ ...f, country: code })}
              >
                {name}
              </button>
            ))}
          </div>
        </fieldset>
        <Field
          label="Email"
          type="email"
          value={f.email}
          onChange={set('email')}
          autoComplete="email"
        />
        <Field
          label="Phone"
          type="tel"
          value={f.phone}
          onChange={set('phone')}
          autoComplete="tel"
        />
        <Field
          label="Home address"
          value={f.line1}
          onChange={set('line1')}
          placeholder="House number and street"
          autoComplete="street-address"
        />
        <div className="dcd-pair">
          <Field label="City" value={f.city} onChange={set('city')} />
          <Field label="State" value={f.state} onChange={set('state')} />
        </div>
        <Field
          label="Postcode"
          value={f.postal}
          onChange={set('postal')}
          autoComplete="postal-code"
        />
        <fieldset className="dcd-fieldset">
          <legend>ID type</legend>
          <div className="dcd-choices">
            {IDS.map(([type, name]) => (
              <button
                key={type}
                type="button"
                aria-pressed={f.idType === type}
                onClick={() => setF({ ...f, idType: type })}
              >
                {name}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label={`${idName} number`} value={f.idNumber} onChange={set('idNumber')} />
        {f.country === 'NG' ? (
          <fieldset className="dcd-fieldset">
            <legend>NIN or BVN</legend>
            <div className="dcd-choices">
              {(['nin', 'bvn'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={f.numberType === t}
                  onClick={() => setF({ ...f, numberType: t })}
                >
                  {NUMBERS[t].label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
        {kind ? (
          <div className="dcd-number">
            <Field
              label={NUMBERS[kind].label}
              value={f.number}
              onChange={(e) => setF({ ...f, number: e.target.value.replace(/[^\d -]/g, '') })}
              placeholder={`${NUMBERS[kind].digits} digits`}
              inputMode="numeric"
              autoComplete="off"
            />
            <p className="dcd-hint">{NUMBERS[kind].hint}</p>
          </div>
        ) : null}
        <p className="dcd-note">
          <Icon name="lock" size={15} />
          Sent straight to Nuvion, who issue the card. Ren keeps only whether you passed.
        </p>
        <Problem text={asked ? missing : null} />
        <button type="submit" className="pill pill-block" data-tone="ink">
          <span className="pill-label">Continue</span>
          <span className="pill-cap">
            <Icon name="arrow" size={18} />
          </span>
        </button>
      </form>
    </div>
  )
}

/**
 * A step that takes a photo (or, for the bill, a PDF): the frame, three tips, what went wrong,
 * and the way on once there's something chosen.
 */
function PhotoStep({
  step,
  label,
  title,
  lead,
  choices,
  tall,
  camera,
  upload,
  tips,
  error,
  onBack,
  onFile,
  next,
}: {
  step: 2 | 3
  label: string
  title: string
  lead?: string
  choices?: React.ReactNode
  tall?: boolean
  /** Open the camera on a phone; without it, a file can be chosen too. */
  camera?: boolean
  upload: Upload | null
  tips: Array<[React.ComponentProps<typeof Icon>['name'], string]>
  error: string | null
  onBack: () => void
  onFile: (file: File | undefined) => Promise<void>
  next: {
    label: string
    icon: React.ComponentProps<typeof Icon>['name']
    busy?: boolean
    onClick: () => void
  }
}) {
  return (
    <div className="w-screen dcd">
      <ScreenHead title="ID check" onBack={onBack} />
      <div className="dcd-shoot">
        <Progress step={step} label={label} />
        <h1 className="dcd-title dcd-center">{title}</h1>
        {lead ? <p className="dcd-shoot-lead">{lead}</p> : null}
        {choices}
        <label className="dcd-frame" data-tall={tall || undefined} data-filled={!!upload}>
          {upload ? (
            upload.mime === 'application/pdf' ? (
              <span className="dcd-frame-empty">
                <Icon name="check" size={28} />
                PDF chosen. Tap to change
              </span>
            ) : (
              // biome-ignore lint/performance/noImgElement: a local preview of the chosen file
              <img src={upload.url} alt="What you chose" />
            )
          ) : (
            <span className="dcd-frame-empty">
              <Icon name="camera" size={28} />
              {camera ? 'Take or choose a photo' : 'Choose a photo or PDF'}
            </span>
          )}
          <i className="dcd-corner" data-at="tl" />
          <i className="dcd-corner" data-at="tr" />
          <i className="dcd-corner" data-at="bl" />
          <i className="dcd-corner" data-at="br" />
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            capture={camera ? 'environment' : undefined}
            aria-label={camera ? 'Take or choose a photo' : 'Choose a photo or PDF'}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
        <ul className="dcd-tips">
          {tips.map(([icon, text]) => (
            <li key={text}>
              <Icon name={icon} size={20} />
              {text}
            </li>
          ))}
        </ul>
        <Problem text={error} />
        <button
          type="button"
          className="pill pill-block"
          data-tone="coral"
          disabled={!upload || next.busy}
          onClick={next.onClick}
        >
          <span className="pill-label">{next.label}</span>
          <span className="pill-cap">
            <Icon name={next.icon} size={18} />
          </span>
        </button>
      </div>
    </div>
  )
}

function Progress({ step, label }: { step: 1 | 2 | 3; label: string }) {
  return (
    <div className="dcd-progress">
      <span>{label}</span>
      <div>
        {[1, 2, 3].map((n) => (
          <i key={n} data-on={n <= step || undefined} />
        ))}
      </div>
    </div>
  )
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props
  return (
    <label className="dcd-field">
      <span>{label}</span>
      <input {...rest} />
    </label>
  )
}

function CardHome({
  data,
  onChange,
  onTopUp,
  onWithdraw,
  onDetails,
  onDelete,
}: {
  data: DollarCard
  onChange: (d: DollarCard) => void
  onTopUp: () => void
  onWithdraw: () => void
  onDetails: () => void
  onDelete: () => void
}) {
  const { profile, signMessage } = useWallet()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const card = data.card
  if (!card) return null
  const cap = BigInt(data.daily_topup)
  const today = BigInt(data.topups?.today ?? '0')
  const left = BigInt(data.topups?.left ?? data.daily_topup)
  const used = cap > 0n ? Number((today * BigInt(BLOCKS)) / cap) : 0
  const balance = card.balance === null ? '—' : formatUsd(BigInt(card.balance))

  const freeze = async (frozen: boolean) => {
    if (!profile) return
    setBusy(true)
    setError(null)
    try {
      onChange(await setDollarCard(profile.address, signMessage, frozen))
    } catch (e) {
      setError(problemOf(e))
    } finally {
      setBusy(false)
    }
  }

  if (card.frozen)
    return (
      <div className="w-screen dcd">
        <ScreenHead title="Dollar card" />
        <h1 className="dcd-title">Frozen</h1>
        <p className="w-lead dcd-lead">
          Every payment is refused until you unfreeze it. Nothing leaves your card.
        </p>
        <div className="dcd-frozen">
          <Plastic last4={card.last_four} brand={card.brand} frozen className="dcd-tilt" />
          <span className="dcd-lockbadge" aria-hidden="true">
            <Icon name="lock" size={26} />
          </span>
        </div>
        <div className="dcd-safe">
          <span>
            <small>Safe on your card</small>
            <strong>{balance}</strong>
          </span>
          <span>•••• {card.last_four}</span>
        </div>
        <Problem text={error} />
        <button
          type="button"
          className="pill pill-block dcd-gap"
          data-tone="coral"
          disabled={busy}
          onClick={() => void freeze(false)}
        >
          <span className="pill-label">{busy ? 'One moment…' : 'Unfreeze'}</span>
          <span className="pill-cap">
            <Icon name="check" size={18} />
          </span>
        </button>
        <button type="button" className="dcd-delete" onClick={onDelete}>
          <Icon name="trash" size={16} />
          Delete card
        </button>
      </div>
    )

  return (
    <div className="w-screen dcd">
      <ScreenHead title="Dollar card" />
      <div className="dcd-band">
        <small>Ready to spend{data.sandbox ? ' · sandbox' : ''}</small>
        <strong className="dcd-balance">{balance}</strong>
      </div>
      <div className="dcd-hero-card">
        <Plastic last4={card.last_four} brand={card.brand} name={card.name} className="dcd-tilt" />
        <div className="dcd-meter">
          <p>
            <strong>Today’s top-ups</strong>
            <span>
              {formatUsd(left)} left of {formatUsd(cap)}
            </span>
          </p>
          <div className="dcd-blocks">
            {Array.from({ length: BLOCKS }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: ten fixed blocks of a meter
              <i key={i} data-on={i < used ? 'yes' : 'no'} />
            ))}
          </div>
        </div>
      </div>
      <Problem text={error} />
      <div className="dcd-actions">
        <button type="button" data-tone="coral" disabled={left === 0n} onClick={onTopUp}>
          <Icon name="plus" size={18} />
          Top up
        </button>
        <button
          type="button"
          disabled={!card.balance || BigInt(card.balance) < 1_000_000n}
          onClick={onWithdraw}
        >
          <Icon name="down" size={18} />
          Withdraw
        </button>
        <button type="button" onClick={onDetails}>
          <Icon name="eye" size={18} />
          Details
        </button>
        <button type="button" disabled={busy} onClick={() => void freeze(true)}>
          <Icon name="lock" size={18} />
          {busy ? 'Freezing…' : 'Freeze'}
        </button>
      </div>
      {left === 0n ? (
        <p className="dcd-fine">You’ve topped up all of today’s {formatUsd(cap)}. More tomorrow.</p>
      ) : null}
      <h2 className="dcd-section">On your card</h2>
      <ul className="dcd-activity">
        {(data.activity ?? []).length === 0 ? (
          <li className="dcd-activity-none">
            Top-ups, withdrawals and card payments show up here.
          </li>
        ) : (
          (data.activity ?? []).map((a) => (
            <li key={a.id}>
              <span className="dcd-dot" data-kind={a.kind}>
                {a.kind === 'spend' ? (
                  a.title.slice(0, 1).toUpperCase()
                ) : (
                  <Icon name={a.kind === 'topup' ? 'up' : 'down'} size={16} />
                )}
              </span>
              <span className="dcd-what">
                <strong>{a.title}</strong>
                <small>
                  {new Date(a.at).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {a.kind === 'check' ? ' · Card check, not charged' : ''}
                  {a.kind !== 'check' && a.status === 'pending' ? ' · On its way' : ''}
                  {a.status === 'failed' ? ' · Declined' : ''}
                </small>
              </span>
              <span className="dcd-amount" data-kind={a.kind}>
                {a.kind === 'spend' || a.kind === 'withdraw' ? '−' : a.kind === 'check' ? '' : '+'}
                {formatUsd(BigInt(a.amount) < 0n ? -BigInt(a.amount) : BigInt(a.amount))}
              </span>
            </li>
          ))
        )}
      </ul>
      <button type="button" className="dcd-delete" onClick={onDelete}>
        <Icon name="trash" size={16} />
        Delete card
      </button>
    </div>
  )
}

/**
 * Onto the card, in two steps the person sees as one: the wallet asks (signed) and Ren names the
 * transfer; the wallet sends it, sponsored, with the top-up's memo; then Ren is told the hash and
 * fills the card. Once the dollars have left, the sheet never sends again: it only keeps telling
 * Ren the hash until the card shows them.
 */
function TopUp({
  data,
  onClose,
  onDone,
}: {
  data: DollarCard
  onClose: () => void
  onDone: (d: DollarCard) => void
}) {
  const { profile, network, signMessage, sendToRen, balance } = useWallet()
  const [typed, setTyped] = useState('20')
  const [busy, setBusy] = useState<null | 'asking' | 'sending' | 'filling'>(null)
  const [error, setError] = useState<string | null>(null)
  /** Ren's total came out different from the one shown: the person confirms the new one. */
  const [changed, setChanged] = useState<{ order: CardTopUp; total: bigint } | null>(null)
  /** The dollars are on Tempo, the card isn't filled yet. */
  const [sent, setSent] = useState<{ id: string; hash: Hex } | null>(null)
  const cap = BigInt(data.daily_topup)
  const today = BigInt(data.topups?.today ?? '0')
  const left = BigInt(data.topups?.left ?? data.daily_topup)
  const value = (() => {
    try {
      return typed ? toBase(typed) : 0n
    } catch {
      return 0n
    }
  })()
  const bps = data.topup_fee_bps ?? 50
  const fee = value > 0n ? topUpFee(value, bps) : 0n
  const total = value + fee
  const tooMuch = value > left
  const short = balance !== null && total > balance
  const earlier = cap > 0n ? Number((today * BigInt(BLOCKS)) / cap) : 0
  const now = cap > 0n ? Math.ceil(Number(((today + value) * BigInt(BLOCKS)) / cap)) - earlier : 0

  /** Tells Ren the transfer's hash until the card comes back filled. */
  const fill = async (order: { id: string; hash: Hex }) => {
    if (!profile) return
    setBusy('filling')
    setError(null)
    let last: unknown = null
    for (let i = 0; i < 3; i++) {
      try {
        onDone(await reportCardTopUpSent(profile.address, order.id, order.hash))
        return
      } catch (e) {
        last = e
        await wait(1500)
      }
    }
    setBusy(null)
    setError(
      `Your dollars left your wallet, but Ren hasn’t filled the card yet${
        last instanceof Error && last.message.length < 120 ? ` (${last.message})` : ''
      }. Nothing needs sending again.`,
    )
  }

  /** Sends exactly the transfer Ren named for this top-up, then has the card filled. */
  const pay = async (order: CardTopUp) => {
    setBusy('sending')
    setError(null)
    let hash: Hex
    try {
      const moved = await sendToRen({
        ...checkedPay(network, order.pay),
        name: 'Dollar card',
        detail: `Top-up, ${formatUsd(value)} onto your card`,
      })
      hash = moved.hash
    } catch (e) {
      setBusy(null)
      setError(moveProblem(e, 'The top-up didn’t go through. Nothing left your wallet.'))
      return
    }
    const order2 = { id: order.id, hash }
    setSent(order2)
    setChanged(null)
    await fill(order2)
  }

  const go = async () => {
    if (!profile) return
    if (sent) return fill(sent)
    if (changed) return pay(changed.order)
    setBusy('asking')
    setError(null)
    let order: CardTopUp
    try {
      order = await startCardTopUp(profile.address, signMessage, value)
    } catch (e) {
      setBusy(null)
      setError(problemOf(e))
      return
    }
    let asks: bigint
    try {
      asks = checkedPay(network, order.pay).amount
    } catch (e) {
      setBusy(null)
      setError(problemOf(e))
      return
    }
    // Ren's total is the one that's paid. If it isn't the one on screen, they see it first.
    if (asks !== total) {
      setBusy(null)
      setChanged({ order, total: asks })
      return
    }
    await pay(order)
  }

  const locked = busy !== null || sent !== null || changed !== null

  return (
    <div className="dcd-sheet-back" role="dialog" aria-modal="true" aria-label="Top up card">
      <div className="dcd-sheet">
        <p className="dcd-sheet-head">
          <strong>Top up card</strong>
          <button type="button" aria-label="Close" disabled={busy !== null} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </p>
        <label className="dcd-amount-input">
          <span>$</span>
          <input
            inputMode="decimal"
            value={typed}
            readOnly={locked}
            onChange={(e) => setTyped(e.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
            aria-label="Amount"
          />
        </label>
        <div className="dcd-meter">
          <div className="dcd-blocks">
            {Array.from({ length: BLOCKS }, (_, i) => (
              <i
                // biome-ignore lint/suspicious/noArrayIndexKey: ten fixed blocks of a meter
                key={i}
                data-on={
                  i < earlier ? 'yes' : i < earlier + now ? (tooMuch ? 'over' : 'now') : 'no'
                }
              />
            ))}
          </div>
          <p>
            <span>
              {today > 0n ? `${formatUsd(today)} earlier · ` : ''}+{formatUsd(value)} now
            </span>
            <strong data-over={tooMuch ? 'yes' : 'no'}>
              {formatUsd(tooMuch ? left : left - value)} left today
            </strong>
          </p>
        </div>
        <p className="dcd-from">
          <span>From your Ren balance</span>
          <strong data-over={short ? 'yes' : 'no'}>
            {balance === null ? '—' : formatUsd(balance)}
          </strong>
        </p>
        <p className="dcd-from dcd-fee">
          <span>Ren’s fee ({(bps / 100).toFixed(1)}%)</span>
          <span>
            {changed
              ? `you pay ${formatUsd(changed.total)}`
              : `${formatUsd(fee)} · you pay ${formatUsd(total)}`}
          </span>
        </p>
        {changed ? (
          <p className="dcd-said">
            With the fee, this top-up comes to {formatUsd(changed.total)}, not {formatUsd(total)}.
            Pay that, or close to leave it.
          </p>
        ) : null}
        <Problem text={error} />
        <button
          type="button"
          className="pill pill-block"
          data-tone="coral"
          disabled={busy !== null || (!sent && !changed && (value <= 0n || tooMuch || short))}
          onClick={() => void go()}
        >
          <span className="pill-label">
            {busy === 'asking'
              ? 'One moment…'
              : busy === 'sending'
                ? 'Sending…'
                : busy === 'filling'
                  ? 'Filling your card…'
                  : sent
                    ? 'Check again'
                    : changed
                      ? `Pay ${formatUsd(changed.total)}`
                      : tooMuch
                        ? `Up to ${formatUsd(left)} today`
                        : short
                          ? 'Not enough in your balance'
                          : `Top up ${formatUsd(value)}`}
          </span>
          <span className="pill-cap">
            <Icon name={sent ? 'clock' : 'face'} size={18} />
          </span>
        </button>
      </div>
    </div>
  )
}

/** Off the card, back to the Ren balance, free: an amount up to what's on the card, signed. */
function Withdraw({
  data,
  onClose,
  onDone,
}: {
  data: DollarCard
  onClose: () => void
  onDone: (d: DollarCard) => void
}) {
  const { profile, signMessage, refresh } = useWallet()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A live card's money, or what a deleted card left on its account.
  const held = data.card?.balance ?? (data.stage === 'closed' ? data.balance : null)
  const onCard = held ? BigInt(held) : null
  // Whole cents only: what's on the card, rounded down to the cent.
  const all = onCard === null ? null : (onCard / 10_000n) * 10_000n
  const value = (() => {
    try {
      return typed ? toBase(typed) : 0n
    } catch {
      return 0n
    }
  })()
  const tooMuch = all !== null && value > all
  const tooLittle = value > 0n && value < 1_000_000n

  const go = async () => {
    if (!profile) return
    setBusy(true)
    setError(null)
    try {
      const done = await withdrawFromCard(profile.address, signMessage, value)
      void refresh()
      onDone(done.card)
    } catch (e) {
      setError(problemOf(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dcd-sheet-back" role="dialog" aria-modal="true" aria-label="Withdraw to Ren">
      <div className="dcd-sheet">
        <p className="dcd-sheet-head">
          <strong>Withdraw to Ren</strong>
          <button type="button" aria-label="Close" disabled={busy} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </p>
        <label className="dcd-amount-input">
          <span>$</span>
          <input
            inputMode="decimal"
            value={typed}
            placeholder="0"
            readOnly={busy}
            onChange={(e) => setTyped(e.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
            aria-label="Amount"
          />
        </label>
        <p className="dcd-from">
          <span>On your card</span>
          <strong data-over={tooMuch ? 'yes' : 'no'}>{all === null ? '—' : formatUsd(all)}</strong>
          {all !== null && all >= 1_000_000n ? (
            <button
              type="button"
              className="dcd-all"
              onClick={() => setTyped((Number(all) / 1_000_000).toFixed(2).replace(/\.00$/, ''))}
            >
              All
            </button>
          ) : null}
        </p>
        <p className="dcd-from dcd-fee">
          <span>To your Ren balance</span>
          <span>Free · you get {formatUsd(value)}</span>
        </p>
        <Problem text={error} />
        <button
          type="button"
          className="pill pill-block"
          data-tone="coral"
          disabled={busy || value <= 0n || tooMuch || tooLittle}
          onClick={() => void go()}
        >
          <span className="pill-label">
            {tooMuch
              ? `Up to ${formatUsd(all ?? 0n)}`
              : tooLittle
                ? 'At least $1.00'
                : busy
                  ? 'Withdrawing…'
                  : `Withdraw ${formatUsd(value)}`}
          </span>
          <span className="pill-cap">
            <Icon name="face" size={18} />
          </span>
        </button>
      </div>
    </div>
  )
}

/**
 * Delete the card: a sheet that says plainly what happens before anything does. The card stops at
 * once and can't come back; the money was never on the card itself, so it stays the holder's, to
 * move to Ren whenever they like.
 */
function DeleteCard({
  data,
  onClose,
  onDeleted,
}: {
  data: DollarCard
  onClose: () => void
  onDeleted: (d: DollarCard) => void
}) {
  const { profile, signMessage } = useWallet()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const left = data.card?.balance ? BigInt(data.card.balance) : 0n

  const remove = async () => {
    if (!profile) return
    setBusy(true)
    setError(null)
    try {
      onDeleted(await deleteDollarCard(profile.address, signMessage))
    } catch (e) {
      setError(problemOf(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dcd-sheet-back" role="dialog" aria-modal="true" aria-label="Delete this card">
      <div className="dcd-sheet">
        <span className="dcd-trash" aria-hidden="true">
          <Icon name="trash" size={22} />
        </span>
        <h2 className="dcd-sheet-title">Delete this card?</h2>
        <ul className="dcd-points">
          <li>It stops working at once, and it can’t be brought back.</li>
          <li>
            {left > 0n
              ? `Your ${formatUsd(left)} stays yours. Move it to your Ren balance any time.`
              : 'There’s no money on it, so nothing needs moving.'}
          </li>
          <li>Subscriptions paid with it will fail. Give them a new card first.</li>
          <li>You can get a new card later, with a new number.</li>
        </ul>
        <Problem text={error} />
        <button type="button" className="dcd-danger" disabled={busy} onClick={() => void remove()}>
          {busy ? 'Deleting…' : 'Delete card'}
        </button>
        <button
          type="button"
          className="pill pill-block"
          data-tone="light"
          disabled={busy}
          onClick={onClose}
        >
          <span className="pill-label">Keep it</span>
          <span className="pill-cap">
            <Icon name="close" size={18} />
          </span>
        </button>
      </div>
    </div>
  )
}

/** After the card is deleted: its money, one tap from the Ren balance, and a way to a new card. */
function CardClosed({
  data,
  onChange,
  onWithdraw,
}: {
  data: DollarCard
  onChange: (d: DollarCard) => void
  onWithdraw: () => void
}) {
  const { profile, signMessage } = useWallet()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const left = data.balance ? BigInt(data.balance) : 0n

  const again = async () => {
    if (!profile) return
    setBusy(true)
    setError(null)
    try {
      onChange(await newDollarCard(profile.address, signMessage))
    } catch (e) {
      setError(problemOf(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-screen dcd">
      <ScreenHead title="Dollar card" />
      <div className="dcd-closed" aria-hidden="true">
        <Icon name="card" size={28} />
        Deleted
      </div>
      <h1 className="dcd-title">Your card is deleted</h1>
      <p className="w-lead dcd-lead">
        {data.balance === null || data.balance === undefined
          ? 'Anything that was on it is still yours.'
          : left > 0n
            ? `${formatUsd(left)} is still yours. Move it to your Ren balance, free.`
            : 'Nothing was left on it.'}
      </p>
      <Problem text={error} />
      {left >= 1_000_000n ? (
        <button
          type="button"
          className="pill pill-block dcd-gap"
          data-tone="coral"
          disabled={busy}
          onClick={onWithdraw}
        >
          <span className="pill-label">Move {formatUsd(left)} to Ren</span>
          <span className="pill-cap">
            <Icon name="down" size={18} />
          </span>
        </button>
      ) : null}
      <button
        type="button"
        className="pill pill-block dcd-gap"
        data-tone={left >= 1_000_000n ? 'light' : 'coral'}
        disabled={busy}
        onClick={() => void again()}
      >
        <span className="pill-label">{busy ? 'Making your card…' : 'Get a new card'}</span>
        <span className="pill-cap">
          <Icon name="plus" size={18} />
        </span>
      </button>
    </div>
  )
}

const SHOWN_FOR = 60

/** A US state's name from its code ("FL" → "Florida"), as checkout forms list them. */
const US_STATES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  PR: 'Puerto Rico',
}
const stateName = (code: string) => US_STATES[code.trim().toUpperCase()] ?? code

/** "US" → "United States", for the country field of a checkout. */
const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/**
 * The card's details, read from Nuvion when this opens and gone a minute later; Ren never stores
 * them. They're printed on the card the way a physical card lays them out (chip and contactless
 * left, the number on its own line, valid thru, the name, the network bottom right), and the
 * security code is on the back: "Show CVV" turns the card over. Every value copies on click, and
 * so does each part of the billing address (the card's own, which checkouts ask for).
 */
function Details({ onClose }: { onClose: () => void }) {
  const { profile, signMessage } = useWallet()
  const [details, setDetails] = useState<CardDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Long enough to copy the number, expiry, CVV, name and each part of the address into a checkout.
  const [left, setLeft] = useState(SHOWN_FOR)
  const [back, setBack] = useState(false)
  const [copied, setCopied] = useState<{ what: string; at: number } | null>(null)
  // The wallet's signer can change identity as the wallet's state moves; the details are asked for
  // once per opening (and once per "Try again"), never again because of that.
  const sign = useRef(signMessage)
  sign.current = signMessage
  const owner = profile?.address
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` asks Nuvion again
  useEffect(() => {
    if (!owner) return
    let gone = false
    setError(null)
    revealDollarCard(owner, (message) => sign.current(message))
      .then((d) => {
        if (!gone) setDetails(d)
      })
      .catch((e) => {
        if (!gone) setError(problemOf(e) ?? 'Your passkey shows the details. Try again.')
      })
    return () => {
      gone = true
    }
  }, [owner, attempt])
  useEffect(() => {
    if (!details) return
    const t = setInterval(() => setLeft((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [details])
  useEffect(() => {
    if (left <= 0) onClose()
  }, [left, onClose])
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(null), 1600)
    return () => clearTimeout(t)
  }, [copied])
  const copy = (what: string, value: string) => {
    void navigator.clipboard?.writeText(value).catch(() => {})
    setCopied({ what, at: Date.now() })
  }
  const expiry = details ? `${details.exp_month}/${details.exp_year.slice(-2)}` : '··/··'
  const address = details?.billing_address ?? null
  const street = address ? [address.line1, address.line2].filter(Boolean).join(', ') : ''
  const cell = (label: string, value: string, className = '') => (
    <button
      type="button"
      className={`dcd-cell ${className}`}
      aria-label={`${label}: ${value}. Copy`}
      onClick={() => copy(label, value)}
    >
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
      <Icon name="copy" size={14} />
    </button>
  )
  return (
    <div className="w-screen dcd">
      <ScreenHead title="Card details" onBack={onClose}>
        {details ? (
          <span className="dcd-clock">
            <Icon name="clock" size={13} />
            {left} s
          </span>
        ) : null}
      </ScreenHead>
      <div
        className="dcd-plastic dcd-plastic-full"
        data-back={back ? 'yes' : 'no'}
        data-waiting={!details && !error ? 'yes' : undefined}
      >
        <div className="dcd-plastic-turn">
          <div className="dcd-face" aria-hidden={back}>
            <FaceMark />
            <span className="dcd-face-logo">
              <Wordmark height={30} ink="#fff" shadow="transparent" />
            </span>
            <span className="dcd-face-kind">VIRTUAL</span>
            <Chip />
            <Tap />
            <button
              type="button"
              className="dcd-print dcd-face-number"
              disabled={!details || back}
              aria-label="Copy card number"
              onClick={() => details && copy('Card number', details.number)}
            >
              {details ? details.number.replace(/(\d{4})(?=\d)/g, '$1 ') : '•••• •••• •••• ••••'}
              <Icon name="copy" size={16} />
            </button>
            <button
              type="button"
              className="dcd-print dcd-face-expiry"
              disabled={!details || back}
              aria-label={`Copy expiry ${expiry}`}
              onClick={() => copy('Expiry', expiry)}
            >
              <small>
                VALID
                <br />
                THRU
              </small>
              {expiry}
            </button>
            <button
              type="button"
              className="dcd-print dcd-face-name"
              disabled={!details || back}
              aria-label="Copy name on card"
              onClick={() => details && copy('Name', details.name)}
            >
              {details?.name ?? ''}
            </button>
            <CardBrand brand={details?.brand ?? 'mastercard'} className="dcd-face-brand" />
          </div>
          <div className="dcd-face dcd-face-back" aria-hidden={!back}>
            <i className="dcd-stripe" />
            <small className="dcd-back-label">SECURITY CODE</small>
            <div className="dcd-back-panel">
              <i className="dcd-signature" />
              <button
                type="button"
                className="dcd-cvv"
                disabled={!details || !back}
                aria-label="Copy CVV"
                onClick={() => details && copy('CVV', details.cvv)}
              >
                {details?.cvv ?? '···'}
                <Icon name="copy" size={14} />
              </button>
            </div>
            <p className="dcd-back-note">For online and phone payments. Never share it.</p>
            <span className="dcd-back-logo">
              <Wordmark height={22} ink="#fff" shadow="transparent" />
            </span>
            <CardBrand brand={details?.brand ?? 'mastercard'} className="dcd-back-brand" />
          </div>
        </div>
      </div>

      {error ? (
        <>
          <Problem text={error} />
          <button
            type="button"
            className="pill pill-block dcd-gap"
            data-tone="ink"
            onClick={() => setAttempt((n) => n + 1)}
          >
            <span className="pill-label">Try again</span>
            <span className="pill-cap">
              <Icon name="face" size={18} />
            </span>
          </button>
        </>
      ) : (
        <div className="dcd-plastic-actions">
          <button
            type="button"
            className="dcd-pill"
            disabled={!details}
            onClick={() => setBack((b) => !b)}
          >
            <Icon name="swap" size={15} />
            {back ? 'Show front' : 'Show CVV'}
          </button>
          <button
            type="button"
            className="dcd-pill dcd-pill-ink"
            disabled={!details}
            onClick={() => details && copy('Card number', details.number)}
          >
            <Icon name="copy" size={15} />
            Copy number
          </button>
        </div>
      )}

      {!details && !error ? (
        <p className="dcd-fine">Asking Nuvion for your card’s details…</p>
      ) : null}

      {address && !error ? (
        <>
          <div className="dcd-grid-head">
            <strong>Billing address</strong>
            <small>The card’s, not your home</small>
          </div>
          <div className="dcd-grid">
            {cell('Street', street, 'dcd-cell-wide')}
            {cell('City', address.city)}
            {cell('State', stateName(address.state))}
            {cell('ZIP code', address.postal_code)}
            {cell('Country', countryName(address.country))}
          </div>
        </>
      ) : null}

      <p className="dcd-note dcd-note-quiet">
        <Icon name="lock" size={13} />
        Only you can see this. Ren never stores your card number.
      </p>
      <output className="dcd-toast" data-on={copied ? 'yes' : 'no'} key={copied?.at}>
        <Icon name="check" size={16} />
        {copied ? `${copied.what} copied` : ''}
      </output>
    </div>
  )
}

/** The EMV chip: gold, with its contact pads. */
function Chip() {
  return (
    <svg className="dcd-face-chip" viewBox="0 0 46 35" aria-hidden="true">
      <defs>
        <linearGradient id="dcd-chip-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3DB9A" />
          <stop offset="0.5" stopColor="#D9B866" />
          <stop offset="1" stopColor="#C49A48" />
        </linearGradient>
      </defs>
      <rect
        x="0.5"
        y="0.5"
        width="45"
        height="34"
        rx="6"
        fill="url(#dcd-chip-gold)"
        stroke="#A8823A"
      />
      <path
        d="M0.5 12h14M0.5 23h14M31.5 12h14M31.5 23h14M14.5 0.5v34M31.5 0.5v34M14.5 17.5h17"
        stroke="#A8823A"
        fill="none"
      />
    </svg>
  )
}

/** Mastercard's two overlapping circles on a Mastercard; other brands show nothing rather than a guess. */
function CardBrand({ brand, className }: { brand?: string; className?: string }) {
  if (brand !== 'mastercard') return null
  return (
    <svg
      viewBox="0 0 38 24"
      width="38"
      height="24"
      className={className}
      role="img"
      aria-label="Mastercard"
    >
      <circle cx="12" cy="12" r="12" fill="#EB001B" />
      <circle cx="26" cy="12" r="12" fill="#F79E1B" />
      <path d="M19 2.25A12 12 0 0 1 19 21.75A12 12 0 0 1 19 2.25Z" fill="#FF5F00" />
    </svg>
  )
}
