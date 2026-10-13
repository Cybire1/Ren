'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Awning } from '@/components/awning'
import { Art, Icon } from '@/components/brand'
import { chainName, onTempo } from '@/lib/chain'
import { formatUsd, toBase } from '@/lib/wallet/money'
import { KeysCard } from './keys'
import { PrivateCard } from './private'
import { isUnnamed, useWallet } from './provider'
import { ActionTile, Avatar, BalanceCard, EntryRow, isFresh, Waves } from './ui'

const greetingFor = (hour: number) =>
  hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

/** Today, Yesterday, or the date: the headings Recent is grouped under. */
function dayOf(at: number) {
  const d = new Date(at)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === new Date(today.getTime() - 86_400_000).toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })
}

/**
 * Home is for paying, and you should never have to look for your money: the app's Home. The
 * balance opens the screen on a solid green card (money at rest is green across Ren), Pay sits
 * right beneath it with Send and Request beside it, and the people you pay are one tap away.
 * Money that just landed shows on the card and glows in Recent. A wallet with nothing in it
 * yet gets the first steps instead.
 */
export function Home() {
  const { profile, balance, activity, contacts, network } = useWallet()
  if (!profile) return null
  const empty = balance === 0n
  const firstRun = empty && activity.length === 0
  const now = new Date()
  const greeting = greetingFor(now.getHours())
  const newest = activity[0]
  const fresh = newest && isFresh(newest) ? newest : null

  const hello = (
    <div className="w-hello">
      <Link href="/wallet/profile" className="w-hello-face" aria-label="Your profile">
        <Avatar name={profile.name} id={profile.address} size={44} />
      </Link>
      <div className="w-hello-text">
        <span className="w-hello-small">{greeting}</span>
        <span className="w-hello-date">
          {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
        <strong>
          <span className="w-hello-greet">{greeting}, </span>
          {profile.name ? profile.name.split(' ')[0] : 'there'}
        </strong>
      </div>
      <Link href="/wallet/activity" className="round w-hello-bell" aria-label="Activity">
        <Icon name="bell" size={20} />
      </Link>
    </div>
  )

  if (firstRun)
    return (
      <div className="w-screen w-home">
        <div className="w-home-main">
          {hello}
          {profile.name ? null : <NameYourself />}
          <BalanceCard empty />
          {/* Dollars someone sent privately are here even when the balance above is empty. */}
          <PrivateCard />
          <KeysCard />
        </div>
        <div className="w-home-side">
          <FirstSteps />
          <ShopCard />
        </div>
      </div>
    )

  const recent: React.ReactNode[] = []
  let lastDay = ''
  for (const [rank, entry] of activity.slice(0, 6).entries()) {
    const day = dayOf(entry.at)
    if (day !== lastDay)
      recent.push(
        <p key={`day-${entry.id}`} className="w-recent-day" data-rank={rank}>
          {day}
        </p>,
      )
    lastDay = day
    recent.push(<EntryRow key={entry.id} entry={entry} rank={rank} />)
  }

  return (
    <div className="w-screen w-home">
      <div className="w-home-main">
        {hello}

        {profile.name ? null : <NameYourself />}

        <BalanceCard fresh={fresh} />

        <div className="w-hero">
          <Link href="/wallet/pay" className="w-pay" aria-label="Pay. Scan a code or pay a link">
            <span className="w-pay-icons">
              <span className="w-pay-icon w-pay-icon-coral">
                <Icon name="scan" size={22} />
              </span>
              <span className="w-pay-icon">
                <Icon name="tap" size={22} />
              </span>
            </span>
            <Waves className="w-pay-waves" size={124} />
            <span>
              <span className="w-pay-label">Pay</span>
              <span className="w-pay-sub">Scan a code or pay a link</span>
            </span>
          </Link>
          <div className="w-hero-side">
            <ActionTile kind="send" />
            <ActionTile kind="request" />
          </div>
        </div>

        <PrivateCard />
        <KeysCard />

        <ShopCard />

        {empty ? (
          <Link href="/wallet/add" className="w-notice">
            <span className="w-notice-icon">
              <Icon name="plus" size={20} />
            </span>
            <span className="w-notice-text">
              <strong>
                {network === 'testnet' ? 'Add test dollars' : 'Add money to keep paying'}
              </strong>
              <span>
                {network === 'testnet'
                  ? `$5 a day, free on ${chainName} testnet. Arrives in about a second.`
                  : `Send ${onTempo ? 'USDC' : 'AUSD'} on ${chainName} to your address.`}
              </span>
            </span>
            <span className="w-notice-cta">Add</span>
          </Link>
        ) : null}
      </div>

      <div className="w-home-side">
        <div className="w-section-row">
          <h2 className="w-section">Send again</h2>
          {contacts.length > 0 ? (
            <Link href="/wallet/send" className="w-see-all">
              All people
            </Link>
          ) : null}
        </div>
        <div className="w-people">
          <Link href="/wallet/send" className="w-person" aria-label="Pay someone new">
            <span className="w-person-new">
              <Icon name="plus" size={22} />
            </span>
            <span>New</span>
          </Link>
          {contacts.slice(0, 8).map((c) => (
            <Link
              key={c.address}
              href={`/wallet/send/${c.address}?name=${encodeURIComponent(c.name)}${c.currency ? `&cur=${c.currency}` : ''}`}
              className="w-person"
              aria-label={`Send to ${c.name}`}
            >
              <Avatar name={c.name} id={c.address} size={56} />
              <span>{isUnnamed(c.name) ? c.address.slice(0, 6) : c.name.split(' ')[0]}</span>
            </Link>
          ))}
        </div>

        <div className="w-section-row">
          <h2 className="w-section">Recent</h2>
          {activity.length > 3 ? (
            <Link href="/wallet/activity" className="w-see-all">
              See all
            </Link>
          ) : null}
        </div>
        {activity.length === 0 ? (
          <p className="w-quiet">Your payments show up here the moment they land.</p>
        ) : (
          <div className="w-entries" data-more={activity.length > 3 ? 'true' : undefined}>
            {recent}
          </div>
        )}
      </div>
    </div>
  )
}

/** A new wallet's first three things, each one tap from here. */
function FirstSteps() {
  const { network } = useWallet()
  const testnet = network === 'testnet'
  const steps = [
    {
      href: '/wallet/add',
      title: testnet ? 'Add test dollars' : 'Add money',
      sub: testnet
        ? `$5 a day, free on ${chainName} testnet`
        : `Send ${onTempo ? 'USDC' : 'AUSD'} on ${chainName} to your address`,
    },
    { href: '/wallet/pay', title: 'Pay a shop', sub: 'Scan its code or open its link' },
    { href: '/wallet/send', title: 'Send to a friend', sub: 'By name or link. Ren covers the fee' },
  ]
  return (
    <section className="w-steps" aria-label="Three things to try">
      <div className="w-section-row">
        <h2 className="w-section">Three things to try</h2>
        <span className="w-see-all">0 of 3 done</span>
      </div>
      <ol className="w-steps-list">
        {steps.map((step, i) => (
          <li key={step.href}>
            <Link href={step.href} className={`w-step${i === 0 ? ' w-step-next' : ''}`}>
              <span className="w-step-n">{i + 1}</span>
              <span className="w-step-text">
                <strong>{step.title}</strong>
                <span>{step.sub}</span>
              </span>
              <span className="w-step-go">
                <Icon name="chevron" size={16} />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * Your shop, one of the wallet's features, under the stall's awning as in the app: the way into
 * shop mode. Signed in, it shows today's takings; otherwise the passkey signs you in on the way;
 * with no shop yet, it opens one.
 */
function ShopCard() {
  const { shop, knownShop } = useWallet()
  const name = shop?.name ?? knownShop
  const today = shop?.today
  const line = shop
    ? today && today.count > 0
      ? `${formatUsd(toBase(today.total))} today, ${today.count} ${today.count === 1 ? 'sale' : 'sales'}`
      : 'No sales yet today'
    : name
      ? 'Your passkey signs you in'
      : 'Take payments into this wallet'
  return (
    <Link
      href={shop ? '/dashboard' : name ? '/wallet/shop?go=signin' : '/wallet/shop?go=open'}
      className="w-shopcard"
    >
      <Awning height={22} stripe={16} />
      <span className="w-shopcard-body">
        <Art name="badge-shop" size={50} className="w-face" />
        <span className="w-shopcard-text">
          <small>{name ? 'Your shop' : 'Run a shop?'}</small>
          <strong>{name ?? 'Open a shop'}</strong>
          <span>{line}</span>
        </span>
        <span className="w-shopcard-go">
          <Icon name="arrow" size={18} />
        </span>
      </span>
    </Link>
  )
}

/** A wallet from before names were kept: ask once, like the app's restore does. */
function NameYourself() {
  const { setName } = useWallet()
  const [name, setText] = useState('')
  return (
    <form
      className="w-nameyourself"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) setName(name)
      }}
    >
      <label htmlFor="w-name-yourself">
        <strong>What should people call you?</strong>
        <span>It’s the name people see when you ask them for money.</span>
      </label>
      <div className="w-nameyourself-row">
        <input
          id="w-name-yourself"
          value={name}
          onChange={(e) => setText(e.target.value)}
          placeholder="Your name"
          maxLength={40}
          autoComplete="name"
        />
        <button type="submit" className="pill" data-tone="ink" disabled={!name.trim()}>
          <span className="pill-label">Save</span>
          <span className="pill-cap">
            <Icon name="check" size={18} />
          </span>
        </button>
      </div>
    </form>
  )
}
