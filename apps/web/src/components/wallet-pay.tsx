'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Checkout } from '@/lib/api'
import { usd } from '@/lib/format'
import { Icon } from './brand'

/**
 * Paying a Kova charge from any Monad wallet in the browser: MetaMask, Rabby, Phantom, whatever
 * announces itself (EIP-6963). The wallet signs the same EIP-3009 authorization Kova Pay signs,
 * for exactly this charge, and Kova's relayer submits it and pays the gas: the payer needs AUSD
 * and nothing else, not even MON.
 */

interface Eip1193 {
  request(args: { method: string; params?: unknown }): Promise<unknown>
}
interface WalletInfo {
  uuid: string
  name: string
  icon: string
  rdns: string
}
interface Wallet {
  info: WalletInfo
  provider: Eip1193
}

type Stage =
  | { name: 'choose' }
  | { name: 'working'; wallet: string; step: 'connect' | 'network' | 'sign' | 'pay' }
  | { name: 'short'; wallet: Wallet; address: string; balance: bigint }
  | { name: 'paid' }
  | { name: 'problem'; message: string }

/** What a wallet needs to add Monad if it has never seen it. */
const chains: Record<number, { chainName: string; rpcUrls: string[]; blockExplorerUrls: string[] }> = {
  10143: { chainName: 'Monad Testnet', rpcUrls: ['https://testnet-rpc.monad.xyz'], blockExplorerUrls: ['https://testnet.monadscan.com'] },
  143: { chainName: 'Monad', rpcUrls: ['https://rpc.monad.xyz'], blockExplorerUrls: ['https://monadscan.com'] },
}

const hex = (n: number) => `0x${n.toString(16)}`

function useWallets(): Wallet[] | null {
  const [wallets, setWallets] = useState<Wallet[] | null>(null)
  useEffect(() => {
    const found = new Map<string, Wallet>()
    const announce = (event: Event) => {
      const detail = (event as CustomEvent<Wallet>).detail
      if (!detail?.info?.uuid || found.has(detail.info.rdns)) return
      found.set(detail.info.rdns, detail)
      setWallets([...found.values()])
    }
    window.addEventListener('eip6963:announceProvider', announce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    // Wallets that predate EIP-6963 only leave window.ethereum behind.
    const settle = setTimeout(() => {
      const legacy = (window as unknown as { ethereum?: Eip1193 }).ethereum
      if (found.size === 0 && legacy)
        found.set('legacy', { info: { uuid: 'legacy', name: 'Browser wallet', icon: '', rdns: 'legacy' }, provider: legacy })
      setWallets([...found.values()])
    }, 400)
    return () => {
      window.removeEventListener('eip6963:announceProvider', announce)
      clearTimeout(settle)
    }
  }, [])
  return wallets
}

async function switchToMonad(provider: Eip1193, chainId: number) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex(chainId) }] })
  } catch (error) {
    // 4902: the wallet has never heard of this chain.
    if ((error as { code?: number }).code !== 4902 && !String((error as Error).message).includes('Unrecognized')) throw error
    const chain = chains[chainId]
    if (!chain) throw error
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{ chainId: hex(chainId), nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, ...chain }],
    })
  }
}

async function balanceOf(provider: Eip1193, token: string, owner: string): Promise<bigint> {
  const data = `0x70a08231${owner.slice(2).toLowerCase().padStart(64, '0')}`
  const result = (await provider.request({ method: 'eth_call', params: [{ to: token, data }, 'latest'] })) as string
  return BigInt(result && result !== '0x' ? result : '0x0')
}

function typedData(c: Checkout, from: string) {
  if (!c.token_domain) throw new Error('This charge can’t be signed from a browser yet.')
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    domain: { ...c.token_domain, chainId: c.chain_id, verifyingContract: c.token },
    primaryType: 'TransferWithAuthorization',
    message: {
      from,
      to: c.pay_to,
      value: c.amount_base,
      validAfter: '0',
      // The approval dies with the charge.
      validBefore: String(Math.floor(Date.parse(c.expires_at) / 1000)),
      nonce: c.memo,
    },
  }
}

function explain(error: unknown): string {
  const e = error as { code?: number; message?: string }
  if (e.code === 4001 || /reject|denied|cancel/i.test(e.message ?? '')) return 'You cancelled in your wallet. Nothing was paid.'
  return e.message && e.message.length < 160 ? e.message : 'Something went wrong. Nothing was paid; try again.'
}

export function WalletPay({ checkout, testnet }: { checkout: Checkout; testnet: boolean }) {
  const router = useRouter()
  const wallets = useWallets()
  const [stage, setStage] = useState<Stage>({ name: 'choose' })
  const [mobile, setMobile] = useState(false)
  const [funding, setFunding] = useState(false)
  useEffect(() => setMobile(/iphone|ipad|android/i.test(navigator.userAgent)), [])

  const pay = async (wallet: Wallet) => {
    const name = wallet.info.name
    try {
      setStage({ name: 'working', wallet: name, step: 'connect' })
      const [address] = (await wallet.provider.request({ method: 'eth_requestAccounts' })) as string[]
      if (!address) throw new Error('Your wallet shared no account.')

      setStage({ name: 'working', wallet: name, step: 'network' })
      await switchToMonad(wallet.provider, checkout.chain_id)
      const balance = await balanceOf(wallet.provider, checkout.token, address)
      if (balance < BigInt(checkout.amount_base)) return setStage({ name: 'short', wallet, address, balance })

      setStage({ name: 'working', wallet: name, step: 'sign' })
      const signature = (await wallet.provider.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(typedData(checkout, address))],
      })) as string

      setStage({ name: 'working', wallet: name, step: 'pay' })
      const message = typedData(checkout, address).message
      const response = await fetch(`/api/checkout/${checkout.id}/authorize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: checkout.token, ...message, signature }),
      })
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Kova couldn’t take that payment. Nothing was paid.')
      setStage({ name: 'paid' })
      router.refresh()
    } catch (error) {
      setStage({ name: 'problem', message: explain(error) })
    }
  }

  const topUp = async (wallet: Wallet, address: string) => {
    setFunding(true)
    try {
      const response = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'The test-dollar faucet didn’t answer.')
      await pay(wallet)
    } catch (error) {
      setStage({ name: 'problem', message: explain(error) })
    } finally {
      setFunding(false)
    }
  }

  const here = typeof window === 'undefined' ? '' : window.location.href

  return (
    <section className="manual wallet-pay" aria-live="polite">
      <h2>Or pay from any Monad wallet</h2>
      <p>Sign once in your wallet. Kova covers the network fee, so you only need {checkout.token_symbol ?? 'AUSD'}.</p>

      {stage.name === 'working' ? (
        <div className="wallet-status">
          <span className="spinner" aria-hidden="true" />
          <span>
            {stage.step === 'connect'
              ? `Open ${stage.wallet} and connect`
              : stage.step === 'network'
                ? `Switching ${stage.wallet} to Monad`
                : stage.step === 'sign'
                  ? `Approve ${usd(checkout.amount)} to ${checkout.merchant_name} in ${stage.wallet}`
                  : 'Paying…'}
          </span>
        </div>
      ) : stage.name === 'paid' ? (
        <div className="wallet-status wallet-done">
          <Icon name="check" size={18} />
          <span>Paid</span>
        </div>
      ) : stage.name === 'short' ? (
        <div className="wallet-short">
          <p>
            This wallet has {usd(Number(stage.balance) / 1e6)} {checkout.token_symbol ?? 'AUSD'} on Monad, and this costs {usd(checkout.amount)}.
          </p>
          {testnet ? (
            <button type="button" className="pill pill-block" data-tone="light" disabled={funding} onClick={() => void topUp(stage.wallet, stage.address)}>
              <span className="pill-label">{funding ? 'Getting test dollars…' : 'Get test dollars and pay'}</span>
              <span className="pill-cap">
                <Icon name="plus" size={18} />
              </span>
            </button>
          ) : null}
          <button type="button" className="textlink wallet-again" onClick={() => setStage({ name: 'choose' })}>
            Use another wallet
          </button>
        </div>
      ) : (
        <>
          {stage.name === 'problem' ? <p className="wallet-problem">{stage.message}</p> : null}
          {wallets === null ? (
            <div className="wallet-status">
              <span className="spinner" aria-hidden="true" />
              <span>Looking for wallets…</span>
            </div>
          ) : wallets.length > 0 ? (
            <ul className="wallet-list">
              {wallets.map((wallet) => (
                <li key={wallet.info.uuid}>
                  <button type="button" onClick={() => void pay(wallet)}>
                    {wallet.info.icon ? <img src={wallet.info.icon} alt="" width={32} height={32} /> : <span className="wallet-glyph"><Icon name="key" size={16} /></span>}
                    <span>{wallet.info.name}</span>
                    <Icon name="arrow" size={18} />
                  </button>
                </li>
              ))}
            </ul>
          ) : mobile ? (
            <ul className="wallet-list">
              <li>
                <a href={`https://metamask.app.link/dapp/${here.replace(/^https?:\/\//, '')}`}>
                  <span className="wallet-glyph"><Icon name="external" size={16} /></span>
                  <span>Open in MetaMask</span>
                  <Icon name="arrow" size={18} />
                </a>
              </li>
              <li>
                <a href={`https://phantom.app/ul/browse/${encodeURIComponent(here)}?ref=${encodeURIComponent(here)}`}>
                  <span className="wallet-glyph"><Icon name="external" size={16} /></span>
                  <span>Open in Phantom</span>
                  <Icon name="arrow" size={18} />
                </a>
              </li>
            </ul>
          ) : (
            <p className="wallet-none">No wallet in this browser. Pay with Kova on your phone, or open this page where MetaMask, Rabby or Phantom is installed.</p>
          )}
        </>
      )}
    </section>
  )
}
