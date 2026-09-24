'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useActionState, useCallback, useState } from 'react'
import { type FormState, signIn, signInDemo, signUp } from '@/app/actions'
import { Art, Icon, Pill } from './brand'
import type { EmbeddedWallet } from './privy-wallet'

// Privy is only downloaded when someone chooses to make their shop's wallet with it.
const PrivyWallet = dynamic(() => import('./privy-wallet'), { ssr: false })

export function SignInForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {})
  const [show, setShow] = useState(false)
  return (
    <div className="auth-card">
      <h1>Welcome back</h1>
      <p className="auth-lead">Sign in with your shop’s secret key.</p>
      {notice ? <p className="form-note">{notice}</p> : null}
      <form action={action} className="stack-form">
        <label className="field-label" htmlFor="key">
          Secret key
        </label>
        <div className="keyfield">
          <input id="key" name="key" type={show ? 'text' : 'password'} placeholder="kova_test_sk_…" autoComplete="current-password" spellCheck={false} required />
          <button type="button" className="round" aria-label={show ? 'Hide key' : 'Show key'} onClick={() => setShow(!show)}>
            <Icon name="eye" size={18} />
          </button>
        </div>
        {state.error ? <p className="form-error">{state.error}</p> : null}
        <Pill type="submit" icon="arrow" disabled={pending} wide>
          {pending ? 'Checking' : 'Sign in'}
        </Pill>
      </form>
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

export function SignUpForm({ privyAppId, chainId }: { privyAppId?: string | null; chainId: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {})
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  // With Privy, a shop's wallet is made from its owner's email or Google; pasting an address is the fallback.
  const [manual, setManual] = useState(!privyAppId)
  const [privy, setPrivy] = useState(false)
  const [wallet, setWallet] = useState<EmbeddedWallet | null>(null)
  const onWallet = useCallback((made: EmbeddedWallet) => setWallet(made), [])
  const onCancel = useCallback(() => setPrivy(false), [])

  if (state.ok && state.secret)
    return (
      <div className="auth-card">
        <Art name="kovi-key" size={130} className="auth-kovi" />
        <h1>{state.name} is open</h1>
        {wallet ? (
          <p className="auth-lead">Payments land in the wallet you made with {wallet.signedInAs}. Sign in with it any time to see it.</p>
        ) : null}
        <p className="auth-lead">This is your shop’s secret key. It’s how you sign in and how your systems charge. Kova keeps only a hash of it, so this is the only time you’ll see it.</p>
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

  return (
    <div className="auth-card">
      <h1>Open your shop</h1>
      <p className="auth-lead">Two things, and you can take payments today.</p>
      <form action={action} className="stack-form">
        <label className="field-label" htmlFor="name">
          Shop name
        </label>
        <input id="name" name="name" placeholder="Ada’s Bakery" minLength={2} maxLength={60} required autoComplete="organization" />

        <label className="field-label" htmlFor="address">
          Where should money land?
        </label>
        {manual ? (
          <>
            <input id="address" name="address" placeholder="0x…" className="mono-input" spellCheck={false} required pattern="0x[0-9a-fA-F]{40}" />
            <p className="field-help">
              Your Monad address. In the Kova app it’s on your Profile, under <em>Your address on Monad</em>. Payments go straight there; Kova never holds them.
              {privyAppId ? (
                <>
                  {' '}
                  <button type="button" className="textlink inline-link" onClick={() => setManual(false)}>
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
            <p className="field-help">Payments go straight there; Kova never holds them.</p>
          </>
        ) : (
          <>
            <button type="button" className="shop-wallet shop-wallet-make" disabled={privy} onClick={() => setPrivy(true)}>
              <span className="wallet-glyph wallet-glyph-coral">
                <Icon name="mail" size={16} />
              </span>
              <span>
                {privy ? 'Opening sign-in…' : 'Make my shop’s wallet'}
                <small className="wallet-sub">With your email or Google. Nothing to install, no seed phrase.</small>
              </span>
              <Icon name="arrow" size={18} />
            </button>
            <p className="field-help">
              <button type="button" className="textlink inline-link" onClick={() => setManual(true)}>
                I already have a wallet address
              </button>
            </p>
            {privy && privyAppId ? <PrivyWallet appId={privyAppId} chainId={chainId} onWallet={onWallet} onCancel={onCancel} /> : null}
          </>
        )}
        {state.error ? <p className="form-error">{state.error}</p> : null}
        <Pill type="submit" icon="arrow" tone="coral" disabled={pending || (!manual && !wallet)} wide>
          {pending ? 'Opening your shop' : 'Open my shop'}
        </Pill>
      </form>
      <p className="auth-switch">
        Already have a shop? <Link href="/signin">Sign in</Link>
      </p>
    </div>
  )
}
