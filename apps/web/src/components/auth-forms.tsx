'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { stringToHex } from 'viem'
import {
  type FormState,
  type ShopChoice,
  signIn,
  signInDemo,
  signInWithWallet,
  signUp,
  walletChallenge,
} from '@/app/actions'
import { returningFromPrivy } from '@/lib/privy-return'
import { Art, Icon, Pill } from './brand'
import type { EmbeddedWallet } from './privy-wallet'

// Privy is only downloaded when someone chooses email or Google, or comes back from Google.
const PrivyWallet = dynamic(() => import('./privy-wallet'), { ssr: false })

/** An email wallet signs without a prompt of its own (Privy's wallet UI is off): the page is the prompt. */
async function signWith(wallet: EmbeddedWallet, text: string) {
  return (await wallet.provider.request({
    method: 'personal_sign',
    params: [stringToHex(text), wallet.address],
  })) as string
}

const explain = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

// --- Signing in -------------------------------------------------------------------------

export function SignInForm({
  notice,
  privyAppId,
  chainId,
}: {
  notice?: string
  privyAppId?: string | null
  chainId: number
}) {
  // Without Privy the secret key is the only way in, so it starts open.
  const [withKey, setWithKey] = useState(!privyAppId)
  const keyStart = chainId === 143 ? 'kova_live_sk_' : 'kova_test_sk_'
  return (
    <div className="auth-card">
      <h1>Welcome back</h1>
      <p className="auth-lead">
        {privyAppId
          ? 'Sign in the way you opened your shop.'
          : 'Sign in with your shop’s secret key.'}
      </p>
      {notice ? <p className="form-note">{notice}</p> : null}
      <div className="signin-ways">
        {privyAppId ? <EmailSignIn appId={privyAppId} chainId={chainId} /> : null}
        {withKey ? (
          <KeySignIn keyStart={keyStart} focus={Boolean(privyAppId)} />
        ) : (
          <button
            type="button"
            className="shop-wallet shop-wallet-make"
            onClick={() => setWithKey(true)}
          >
            <span className="wallet-glyph">
              <Icon name="key" size={16} />
            </span>
            <span>
              Use a secret key
              <small className="wallet-sub">The {keyStart}… key you saved</small>
            </span>
            <Icon name="chevron" size={18} />
          </button>
        )}
      </div>
      <div className="auth-or">
        <span>or</span>
      </div>
      <form action={signInDemo}>
        <Pill type="submit" icon="tap" tone="light" wide>
          Explore the demo shop
        </Pill>
      </form>
      <p className="auth-switch">
        New to Kova? <Link href="/signup">Open a shop</Link>
      </p>
    </div>
  )
}

function KeySignIn({ keyStart, focus }: { keyStart: string; focus: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {})
  const [show, setShow] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  // Opened on purpose, so the cursor goes straight to the key. On a page where it's the only way
  // in, the page loads without grabbing focus.
  useEffect(() => {
    if (focus) field.current?.focus()
  }, [focus])
  return (
    <form action={action} className="stack-form signin-key">
      <label className="field-label" htmlFor="key">
        Secret key
      </label>
      <div className="keyfield">
        <input
          id="key"
          name="key"
          type={show ? 'text' : 'password'}
          placeholder={`${keyStart}…`}
          autoComplete="current-password"
          spellCheck={false}
          required
          ref={field}
        />
        <button
          type="button"
          className="round"
          aria-label={show ? 'Hide key' : 'Show key'}
          onClick={() => setShow(!show)}
        >
          <Icon name="eye" size={18} />
        </button>
      </div>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      <Pill type="submit" icon="arrow" disabled={pending} wide>
        {pending ? 'Checking' : 'Sign in'}
      </Pill>
    </form>
  )
}

interface Proof {
  message: string
  signature: string
}

type Step =
  | { at: 'idle' }
  | { at: 'privy' }
  | { at: 'checking'; who: string }
  | { at: 'choose'; wallet: EmbeddedWallet; proof: Proof; shops: ShopChoice[]; picking?: string }
  | { at: 'no-shop'; wallet: EmbeddedWallet }
  | { at: 'done'; who: string }
  | { at: 'problem'; message: string }

const openedOn = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Signing in the way most shops open: with the email or Google account their wallet was made
 * with. Privy signs them in and hands over that wallet, the wallet signs Kova's sign-in message
 * without a prompt, and Kova opens the shop that wallet owns.
 */
function EmailSignIn({ appId, chainId }: { appId: string; chainId: number }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>({ at: 'idle' })
  // Every attempt is a new Privy sign-in that asks who they are, even if someone was signed in here.
  const [attempt, setAttempt] = useState(0)

  // Back from Google: Privy picks up where it left off.
  useEffect(() => {
    if (returningFromPrivy()) setStep({ at: 'privy' })
  }, [])

  const finish = useCallback(
    async (wallet: EmbeddedWallet, proof: Proof, merchant?: string) => {
      const result = await signInWithWallet({ ...proof, merchant })
      if (result.ok) {
        setStep({ at: 'done', who: wallet.signedInAs })
        // Kova's session runs the dashboard now. Privy's would only sign the next person here in as them.
        await wallet.logout().catch(() => {})
        router.replace('/dashboard')
      } else if (result.noShop) setStep({ at: 'no-shop', wallet })
      else if (result.shops) setStep({ at: 'choose', wallet, proof, shops: result.shops })
      else {
        await wallet.logout().catch(() => {})
        setStep({ at: 'problem', message: result.error ?? 'Kova couldn’t sign you in. Try again.' })
      }
    },
    [router],
  )

  const onWallet = useCallback(
    async (wallet: EmbeddedWallet) => {
      setStep({ at: 'checking', who: wallet.signedInAs })
      try {
        const challenge = await walletChallenge(wallet.address, 'sign_in')
        if (!challenge.message) throw new Error(challenge.error ?? 'Kova didn’t answer. Try again.')
        await finish(wallet, {
          message: challenge.message,
          signature: await signWith(wallet, challenge.message),
        })
      } catch (error) {
        await wallet.logout().catch(() => {})
        setStep({ at: 'problem', message: explain(error, 'Kova couldn’t sign you in. Try again.') })
      }
    },
    [finish],
  )
  const onCancel = useCallback(() => setStep({ at: 'idle' }), [])

  const start = () => {
    setAttempt((n) => n + 1)
    setStep({ at: 'privy' })
  }

  const differentEmail = (
    <button type="button" className="textlink inline-link signin-again" onClick={start}>
      Use a different email
    </button>
  )

  return (
    <>
      {step.at !== 'idle' && step.at !== 'problem' ? (
        <PrivyWallet
          key={attempt}
          appId={appId}
          chainId={chainId}
          onWallet={onWallet}
          onCancel={onCancel}
          title="Sign in to your shop"
          fresh
        />
      ) : null}

      {step.at === 'checking' || step.at === 'done' ? (
        <div className="shop-wallet" role="status">
          <span className="wallet-glyph wallet-glyph-coral">
            <span className="spinner" aria-hidden="true" />
          </span>
          <span>
            {step.at === 'done' ? 'Opening your dashboard' : `Signing in as ${step.who}`}
            <small className="wallet-sub">
              {step.at === 'done' ? `Signed in as ${step.who}` : 'Checking it’s your shop’s wallet'}
            </small>
          </span>
        </div>
      ) : step.at === 'no-shop' ? (
        <div className="signin-panel" role="status">
          <p className="signin-panel-title">No shop uses {step.wallet.signedInAs} yet</p>
          <p className="signin-panel-body">
            Open one now. The wallet is already made, so all it needs is a name.
          </p>
          <Pill href="/signup?wallet=email" icon="arrow" tone="coral" wide>
            Open a shop with this email
          </Pill>
          {differentEmail}
        </div>
      ) : step.at === 'choose' ? (
        <div className="signin-panel">
          <p className="signin-panel-title">Which shop?</p>
          <p className="signin-panel-body">
            {step.wallet.signedInAs} signs in to {step.shops.length} shops.
          </p>
          <div className="signin-shops">
            {step.shops.map((shop) => (
              <button
                key={shop.id}
                type="button"
                className="shop-wallet shop-wallet-make"
                disabled={Boolean(step.picking)}
                onClick={() => {
                  setStep({ ...step, picking: shop.id })
                  void finish(step.wallet, step.proof, shop.id)
                }}
              >
                <span className="wallet-glyph">
                  <Icon name="stall" size={16} />
                </span>
                <span>
                  {shop.name}
                  <small className="wallet-sub">Opened {openedOn(shop.created_at)}</small>
                </span>
                {step.picking === shop.id ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  <Icon name="arrow" size={18} />
                )}
              </button>
            ))}
          </div>
          {differentEmail}
        </div>
      ) : (
        <>
          <button
            type="button"
            className="shop-wallet shop-wallet-make"
            disabled={step.at === 'privy'}
            onClick={start}
          >
            <span className="wallet-glyph wallet-glyph-coral">
              <Icon name="mail" size={16} />
            </span>
            <span>
              {step.at === 'privy' ? 'Opening sign-in…' : 'Continue with email or\u00a0Google'}
              <small className="wallet-sub">The one you opened your shop with</small>
            </span>
            <Icon name="arrow" size={18} />
          </button>
          {step.at === 'problem' ? <p className="form-error">{step.message}</p> : null}
        </>
      )}
    </>
  )
}

// --- Opening a shop ---------------------------------------------------------------------

/** Google sends people away and back; the shop's name waits here for them. */
const NAME_KEY = 'kova.signup.name'

export function SignUpForm({
  privyAppId,
  chainId,
  startWithEmail = false,
}: {
  privyAppId?: string | null
  chainId: number
  startWithEmail?: boolean
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {})
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  // With Privy, a shop's wallet is made from its owner's email or Google; pasting an address is the fallback.
  const [manual, setManual] = useState(!privyAppId)
  const [privy, setPrivy] = useState(false)
  const [wallet, setWallet] = useState<EmbeddedWallet | null>(null)
  const [name, setName] = useState('')
  const [proving, setProving] = useState(false)
  const [proofError, setProofError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const onWallet = useCallback((made: EmbeddedWallet) => setWallet(made), [])
  const onCancel = useCallback(() => setPrivy(false), [])

  // Back from Google, or sent here from signing in to open a shop with that email: carry on with Privy.
  useEffect(() => {
    if (!privyAppId) return
    const back = returningFromPrivy()
    if (!back && !startWithEmail) return
    setManual(false)
    setPrivy(true)
    if (back)
      try {
        setName(sessionStorage.getItem(NAME_KEY) ?? '')
      } catch {}
  }, [privyAppId, startWithEmail])

  const makeWallet = () => {
    try {
      sessionStorage.setItem(NAME_KEY, name)
    } catch {}
    setPrivy(true)
  }

  // The shop is open and Kova's session is signed in to it. Privy's would only sign the next
  // person here in as its owner, so it ends.
  const opened = state.ok === true
  useEffect(() => {
    if (!opened || !wallet) return
    void wallet.logout().catch(() => {})
    try {
      sessionStorage.removeItem(NAME_KEY)
    } catch {}
  }, [opened, wallet])

  /** With an email wallet, the wallet first signs Kova's "open a shop" message, so the shop is its owner's. */
  const openWithWallet = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!wallet) return
    const form = new FormData(event.currentTarget)
    setProving(true)
    setProofError(null)
    try {
      const challenge = await walletChallenge(wallet.address, 'open_shop')
      if (!challenge.message) throw new Error(challenge.error ?? 'Kova didn’t answer. Try again.')
      form.set('owner_message', challenge.message)
      form.set('owner_signature', await signWith(wallet, challenge.message))
      startTransition(() => action(form))
    } catch (error) {
      setProofError(explain(error, 'Your wallet didn’t sign. Try again.'))
    } finally {
      setProving(false)
    }
  }

  // Stays mounted through the whole flow: the wallet lives inside it, and it signs out at the end.
  const privyWallet =
    privy && privyAppId ? (
      <PrivyWallet appId={privyAppId} chainId={chainId} onWallet={onWallet} onCancel={onCancel} />
    ) : null

  if (state.ok && !state.secret)
    return (
      <div className="auth-card">
        {privyWallet}
        <Art name="kovi-cheer" size={130} className="auth-kovi" />
        <h1>{state.name} is open</h1>
        <p className="auth-lead">
          Sign in any time with {wallet?.signedInAs ?? 'your email'}. There’s no password or key to
          keep. Payments land in your shop’s own wallet, made with it, and Kova never holds them.
        </p>
        <Pill href="/dashboard" icon="arrow" tone="coral" wide>
          Go to my dashboard
        </Pill>
        <p className="field-help signin-foot">
          Connecting your own systems? Make a secret key in Developers.
        </p>
      </div>
    )

  if (state.ok && state.secret)
    return (
      <div className="auth-card">
        {privyWallet}
        <Art name="kovi-key" size={130} className="auth-kovi" />
        <h1>{state.name} is open</h1>
        <p className="auth-lead">
          This is your shop’s secret key. It’s how you sign in and how your systems charge. Kova
          keeps only a hash of it, so this is the only time you’ll see it.
        </p>
        <div className="secret secret-big">
          <div className="secret-value">
            <code>{state.secret}</code>
          </div>
          <button
            type="button"
            className="mini mini-ink"
            onClick={async () => {
              await navigator.clipboard.writeText(state.secret ?? '')
              setCopied(true)
              setSaved(true)
            }}
          >
            <Icon name={copied ? 'check' : 'copy'} size={14} /> {copied ? 'Copied' : 'Copy key'}
          </button>
        </div>
        <label className="checkline">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          I’ve saved it in my password manager
        </label>
        <Pill href={saved ? '/dashboard' : undefined} icon="arrow" disabled={!saved} wide>
          Go to my dashboard
        </Pill>
      </div>
    )

  const error = state.error ?? proofError
  return (
    <div className="auth-card">
      {privyWallet}
      <h1>Open your shop</h1>
      <p className="auth-lead">Two things, and you can take payments today.</p>
      <form
        action={wallet ? undefined : action}
        onSubmit={wallet ? openWithWallet : undefined}
        className="stack-form"
      >
        <label className="field-label" htmlFor="name">
          Shop name
        </label>
        <input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ada’s Bakery"
          minLength={2}
          maxLength={60}
          required
          autoComplete="organization"
        />

        <label className="field-label" htmlFor="address">
          Where should money land?
        </label>
        {manual ? (
          <>
            <input
              id="address"
              name="address"
              placeholder="0x…"
              className="mono-input"
              spellCheck={false}
              required
              pattern="0x[0-9a-fA-F]{40}"
            />
            <p className="field-help">
              Your Monad address. In the Kova app it’s on your Profile, under{' '}
              <em>Your address on Monad</em>. Payments go straight there; Kova never holds them.
              {privyAppId ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className="textlink inline-link"
                    onClick={() => setManual(false)}
                  >
                    Make a wallet with email instead
                  </button>
                </>
              ) : null}
            </p>
          </>
        ) : wallet ? (
          <>
            <input type="hidden" name="address" value={wallet.address} />
            <div className="shop-wallet">
              <span className="wallet-glyph wallet-glyph-coral">
                <Icon name="check" size={16} />
              </span>
              <span>
                Your shop’s wallet, made with {wallet.signedInAs}
                <code>
                  {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
                </code>
              </span>
            </div>
            <p className="field-help">
              Payments go straight there, and you’ll sign in with {wallet.signedInAs}. Kova never
              holds your money.
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              className="shop-wallet shop-wallet-make"
              disabled={privy}
              onClick={makeWallet}
            >
              <span className="wallet-glyph wallet-glyph-coral">
                <Icon name="mail" size={16} />
              </span>
              <span>
                {privy ? 'Opening sign-in…' : 'Make my shop’s wallet'}
                <small className="wallet-sub">
                  With your email or Google. Nothing to install, no seed phrase.
                </small>
              </span>
              <Icon name="arrow" size={18} />
            </button>
            <p className="field-help">
              <button
                type="button"
                className="textlink inline-link"
                onClick={() => setManual(true)}
              >
                I already have a wallet address
              </button>
            </p>
          </>
        )}
        {error ? <p className="form-error">{error}</p> : null}
        <Pill
          type="submit"
          icon="arrow"
          tone="coral"
          disabled={pending || proving || (!manual && !wallet)}
          wide
        >
          {pending || proving ? 'Opening your shop' : 'Open my shop'}
        </Pill>
      </form>
      <p className="auth-switch">
        Already have a shop? <Link href="/signin">Sign in</Link>
      </p>
    </div>
  )
}
