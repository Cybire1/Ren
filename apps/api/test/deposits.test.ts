import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../src/config.js'
import { depositAddress, depositsTo, units } from '../src/services/deposits.js'

// Deposits and Ramp land on Monad (on Tempo they're switched off), so these run as Monad does.
// vi.hoisted runs before the imports above.
vi.hoisted(() => {
  process.env.KOVA_CHAIN = 'monad'
})

/**
 * Deposits from other chains go through Aurora Intents, which runs on mainnet only. These check
 * what Kova asks Aurora for and how it reads the answers, with Aurora's documented responses
 * stubbed; the live check is a real deposit on mainnet.
 */

const wallet = '0x7171732ec724CF39b8e2ee08C762d04AFab36696'
const saved = { network: config.KOVA_NETWORK, key: config.AURORA_INTENTS_KEY }

function live() {
  config.KOVA_NETWORK = 'mainnet'
  config.AURORA_INTENTS_KEY = 'test-key'
}

afterEach(() => {
  config.KOVA_NETWORK = saved.network
  config.AURORA_INTENTS_KEY = saved.key
  vi.unstubAllGlobals()
})

describe('deposit addresses', () => {
  it('says "mainnet only" on testnet, without calling Aurora', async () => {
    config.KOVA_NETWORK = 'testnet'
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(depositAddress(wallet, 'evm')).rejects.toMatchObject({
      code: 'conflict',
      details: { mainnet_only: true },
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('asks for one permanent address per wallet and chain, landing as dollars on Monad', async () => {
    live()
    const fetch = vi.fn(async () =>
      Response.json({
        depositAddress: '0xD3p05170000000000000000000000000000000001',
        alreadyExists: false,
      }),
    )
    vi.stubGlobal('fetch', fetch)
    const made = await depositAddress(wallet, 'evm')
    expect(made).toEqual({
      source: 'evm',
      address: '0xD3p05170000000000000000000000000000000001',
      memo: null,
    })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://intents-api.aurora.dev/api/persistent-deposit-address/test-key')
    expect(JSON.parse(init.body as string)).toEqual({
      recipient: wallet,
      sender: wallet.toLowerCase(),
      depositChain: 'evm',
      destinationChain: 'monad',
      destinationAsset: 'AUSD',
    })
  })

  it('explains an unapproved key plainly', async () => {
    live()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ message: 'Forbidden', statusCode: 403 }, { status: 403 })),
    )
    await expect(depositAddress(wallet, 'sol')).rejects.toThrow(
      'approved for permanent deposit addresses',
    )
  })
})

describe('deposits', () => {
  it('shows a deposit as seen until it arrives on Monad, newest first', async () => {
    live()
    const answers: Record<string, unknown> = {
      received: [
        {
          tx_hash: '0xnew',
          fromChain: 'base',
          asset_id: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
          decimals: 6,
          amount: '25000000',
          created_at: '2026-10-01T10:05:00Z',
          intents_account: 'x',
          deposit_address: 'd',
          recipient: wallet,
        },
        {
          tx_hash: '0xold',
          fromChain: 'arb',
          asset_id: 'nep141:arb-0xaf88.omft.near',
          decimals: 6,
          amount: '10500000',
          created_at: '2026-10-01T09:00:00Z',
          intents_account: 'x',
          deposit_address: 'd',
          recipient: wallet,
        },
      ],
      success: [
        {
          tx_hash: '0xmonad',
          destinationChain: 'monad',
          asset_id: 'nep141:monad-0xa901.omft.near',
          decimals: 6,
          amount: '10490000',
          created_at: '2026-10-01T09:02:00Z',
          intents_account: 'x',
          deposit_address: 'd',
          recipient: wallet,
        },
      ],
      failed: [],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        Response.json({ deposits: answers[new URL(url).searchParams.get('type') as string] }),
      ),
    )
    const deposits = await depositsTo('d')
    expect(deposits.map((d) => [d.tx_hash, d.status, d.chain, d.amount])).toEqual([
      ['0xnew', 'seen', 'base', '25'],
      ['0xmonad', 'arrived', 'monad', '10.49'],
    ])
  })

  it('turns base units into amounts without floating point', () => {
    expect(units('25000000', 6)).toBe('25')
    expect(units('1', 18)).toBe('0')
    expect(units('123456789', 8)).toBe('1.234567')
    expect(units('5', null)).toBe('5')
  })
})

describe('card and bank top-ups (Ramp Network)', () => {
  it('gives no link on testnet or without a key', async () => {
    const { topUpFor } = await import('../src/services/ramp.js')
    config.KOVA_NETWORK = 'testnet'
    expect(topUpFor(wallet, 'EUR')).toMatchObject({ live: false, url: null })
  })

  it('opens Ramp for AUSD on Monad, to this wallet, in their currency', async () => {
    const { topUpFor } = await import('../src/services/ramp.js')
    const savedKey = config.RAMP_HOST_API_KEY
    config.KOVA_NETWORK = 'mainnet'
    config.RAMP_HOST_API_KEY = 'ramp-key'
    const url = new URL(topUpFor(wallet, 'EUR', 25, 'kova://add-money').url as string)
    config.RAMP_HOST_API_KEY = savedKey
    expect(url.origin).toBe('https://app.rampnetwork.com')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      hostApiKey: 'ramp-key',
      enabledCryptoAssets: 'MONAD_AUSD',
      outAsset: 'MONAD_AUSD',
      inAsset: 'EUR',
      inAssetValue: '2500',
      userAddress: wallet,
      finalUrl: 'kova://add-money',
    })
    // Naira isn't a Ramp card currency: they pay in dollars.
    config.RAMP_HOST_API_KEY = 'ramp-key'
    expect(new URL(topUpFor(wallet, 'NGN').url as string).searchParams.get('inAsset')).toBe('USD')
    config.RAMP_HOST_API_KEY = savedKey
  })
})

describe('cash out (Ramp Network off-ramp)', () => {
  it('sells AUSD on Monad from this wallet, paid out in their currency, only when live', async () => {
    const { cashOutFor } = await import('../src/services/ramp.js')
    config.KOVA_NETWORK = 'testnet'
    expect(cashOutFor(wallet, 'GBP')).toMatchObject({ live: false, config: null })
    const savedKey = config.RAMP_HOST_API_KEY
    config.KOVA_NETWORK = 'mainnet'
    config.RAMP_HOST_API_KEY = 'ramp-key'
    expect(cashOutFor(wallet, 'GBP').config).toMatchObject({
      defaultFlow: 'OFFRAMP',
      offrampAsset: 'MONAD_AUSD',
      fiatCurrency: 'GBP',
      userAddress: wallet,
    })
    config.RAMP_HOST_API_KEY = savedKey
  })
})
