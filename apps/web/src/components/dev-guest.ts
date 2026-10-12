import { createPublicClient, type Hex, http } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { walletChains } from '@/lib/chain'
import type { EmbeddedWallet } from './privy-wallet'

/**
 * Development only: a stand-in for Privy's embedded wallet, so the guest flow (pay with email,
 * then keep the change in Ren) can be tested on localhost without a real email sign-in. A
 * throwaway key in this tab, behind the same EIP-1193 calls the page makes of Privy's wallet.
 */
export function devGuestWallet(chainId: number): EmbeddedWallet {
  const account = privateKeyToAccount(generatePrivateKey())
  const client = createPublicClient({ transport: http(walletChains[chainId]?.rpcUrls[0]) })
  const provider = {
    async request({ method, params }: { method: string; params?: unknown }): Promise<unknown> {
      const args = (params ?? []) as unknown[]
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [account.address]
        case 'eth_chainId':
          return `0x${chainId.toString(16)}`
        case 'wallet_switchEthereumChain':
          return null
        // Tempo: transactions are signed by their hash, as Privy's wallet signs them.
        case 'secp256k1_sign':
          return account.sign({ hash: args[0] as Hex })
        case 'eth_signTypedData_v4': {
          const { domain, types, primaryType, message } = JSON.parse(args[1] as string)
          const { EIP712Domain: _, ...rest } = types
          return account.signTypedData({ domain, types: rest, primaryType, message })
        }
        default:
          return client.request({ method, params } as never)
      }
    },
  }
  return { address: account.address, provider, signedInAs: 'dev@localhost', logout: async () => {} }
}
