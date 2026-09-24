'use client'

import { PrivyProvider, useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { useEffect, useRef } from 'react'
import { monad, monadTestnet } from 'viem/chains'

/**
 * A wallet for people who don't have one: log in with email or Google, and Privy makes an
 * embedded wallet on the spot, with nothing to install. It hands back a standard EIP-1193
 * provider, so paying with it is the same signed authorization as any other wallet, and Kova's
 * relayer pays the gas.
 *
 * Loaded only when someone asks for it (next/dynamic), so the pay page stays light on a phone
 * that just scanned a code. The provider must stay mounted while the wallet is in use: the
 * embedded wallet lives inside it.
 */

export interface EmbeddedWallet {
  address: `0x${string}`
  provider: { request(args: { method: string; params?: unknown }): Promise<unknown> }
  /** How they signed in, to show them: an email address, or "Google". */
  signedInAs: string
}

interface Props {
  appId: string
  chainId: number
  onWallet: (wallet: EmbeddedWallet) => void
  onCancel: () => void
}

export default function PrivyWallet({ appId, chainId, onWallet, onCancel }: Props) {
  const chain = chainId === monad.id ? monad : monadTestnet
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'google'],
        appearance: { theme: 'light', accentColor: '#d46558', landingHeader: 'Your Kova wallet', showWalletLoginFirst: false },
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' }, showWalletUIs: false },
        defaultChain: chain,
        supportedChains: [chain],
      }}
    >
      <Connect onWallet={onWallet} onCancel={onCancel} />
    </PrivyProvider>
  )
}

function Connect({ onWallet, onCancel }: Pick<Props, 'onWallet' | 'onCancel'>) {
  const { ready, authenticated, user } = usePrivy()
  const { wallets, ready: walletsReady } = useWallets()
  const asked = useRef(false)
  const delivered = useRef(false)
  // Closing Privy's sign-in without finishing counts as changing their mind.
  const { login } = useLogin({ onError: () => !delivered.current && onCancel() })

  // Open Privy's sign-in once it's ready, unless they're already signed in from before.
  useEffect(() => {
    if (!ready || authenticated || asked.current) return
    asked.current = true
    login()
  }, [ready, authenticated, login])

  // The embedded wallet appears moments after sign-in.
  useEffect(() => {
    if (!authenticated || !walletsReady || delivered.current) return
    const embedded = wallets.find((w) => w.walletClientType === 'privy')
    if (!embedded) return
    delivered.current = true
    void embedded.getEthereumProvider().then((provider) =>
      onWallet({
        address: embedded.address as `0x${string}`,
        provider,
        signedInAs: user?.email?.address ?? user?.google?.email ?? 'your email',
      }),
    )
  }, [authenticated, walletsReady, wallets, user, onWallet])

  return null
}
