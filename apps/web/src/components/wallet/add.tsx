'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Art, Icon } from '@/components/brand'
import { formatUsd } from '@/lib/wallet/money'
import { ScreenHead } from './activity'
import { useWallet } from './provider'

type Stage =
  | { at: 'ready' }
  | { at: 'adding' }
  | { at: 'done'; balance: bigint }
  | { at: 'problem'; message: string }

/** Money in. On the test network, Kova sends $5 of test dollars a day and pays the gas; on mainnet, AUSD to your address. */
export function AddMoney() {
  const { network, addTestDollars } = useWallet()
  const [stage, setStage] = useState<Stage>({ at: 'ready' })

  if (network !== 'testnet')
    return (
      <div className="w-screen">
        <ScreenHead title="Add money" />
        <div className="w-empty w-empty-art">
          <Art name="kovi-catch" size={160} />
          <strong>Send AUSD on Monad to your address</strong>
          <span>
            Bring dollars from any chain, or send AUSD from an exchange or another wallet. Card and
            bank top-ups are coming.
          </span>
        </div>
        <Link href="/wallet/add/chain" className="w-add-chain">
          <span>
            <strong>From another chain</strong>
            <small>USDC, USDT, ETH, SOL or BTC, from 30+ chains</small>
          </span>
          <Icon name="arrow" size={18} />
        </Link>
        <Link href="/wallet/receive" className="pill pill-block" data-tone="ink">
          <span className="pill-label">Show my address</span>
          <span className="pill-cap">
            <Icon name="arrow" size={18} />
          </span>
        </Link>
      </div>
    )

  if (stage.at === 'done')
    return (
      <div className="w-screen w-moment">
        <Art name="scene-coin-rain" size={260} className="w-moment-art" />
        <h1 className="w-hero-title">Money’s in.</h1>
        <p className="w-lead">
          Your balance is {formatUsd(stage.balance)}. Pay a shop, or send some to a friend.
        </p>
        <div className="w-moment-actions">
          <Link href="/wallet" className="pill pill-block" data-tone="ink">
            <span className="pill-label">Back to home</span>
            <span className="pill-cap">
              <Icon name="home" size={18} />
            </span>
          </Link>
        </div>
      </div>
    )

  return (
    <div className="w-screen">
      <ScreenHead title="Add money" />
      <div className="w-add">
        <Art name="kovi-catch" size={150} className="w-add-art" />
        <h1 className="w-title">Free test dollars</h1>
        <p className="w-lead">
          Kova is running on Monad’s test network. It sends you $5 of test dollars a day to try
          every payment for real, and pays the gas.
        </p>
        <dl className="w-review-card">
          <div className="w-review-row">
            <dt>Amount</dt>
            <dd>$5, once a day</dd>
          </div>
          <div className="w-review-row">
            <dt>From</dt>
            <dd>Kova, on Monad testnet</dd>
          </div>
          <div className="w-review-row">
            <dt>Arrives</dt>
            <dd>In about a second</dd>
          </div>
        </dl>
        {stage.at === 'problem' ? <p className="form-error">{stage.message}</p> : null}
        <button
          type="button"
          className="pill pill-block"
          data-tone="coral"
          disabled={stage.at === 'adding'}
          onClick={async () => {
            setStage({ at: 'adding' })
            try {
              setStage({ at: 'done', balance: await addTestDollars() })
            } catch (e) {
              setStage({
                at: 'problem',
                message:
                  e instanceof Error
                    ? e.message
                    : 'The test-dollar faucet didn’t answer. Try again.',
              })
            }
          }}
        >
          <span className="pill-label">
            {stage.at === 'adding' ? 'Adding test dollars…' : 'Add test dollars'}
          </span>
          <span className="pill-cap">
            <Icon name="plus" size={18} />
          </span>
        </button>
        <Link href="/wallet/add/chain" className="w-add-chain">
          <span>
            <strong>From another chain</strong>
            <small>USDC, USDT, ETH, SOL or BTC, from 30+ chains</small>
          </span>
          <Icon name="arrow" size={18} />
        </Link>
      </div>
    </div>
  )
}
