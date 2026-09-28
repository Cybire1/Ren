import {
  type Address,
  createPublicClient,
  createWalletClient,
  fallback,
  type Hash,
  type Hex,
  http,
  nonceManager,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createClient as createTempoClient, http as tempoHttp } from 'viem/tempo'
import { type KitToken, kit, onTempo } from './chains/index.js'
import { config } from './config.js'

export { kit, onTempo }

export const network = kit.network
export const rpcUrl = (onTempo ? config.TEMPO_RPC_URL : config.MONAD_RPC_URL) ?? network.rpcUrl

/** The dollar Kova settles in: USDC (USDC.e) on Tempo, AUSD on Monad. */
export const settlementCurrency = kit.defaultCurrency
export const settlementToken: KitToken = kit.getToken()

/** Every token Kova accepts on this network. A transfer in anything else is not a Kova payment. */
export const acceptedTokens = kit.tokens

export function tokenFor(currency: string): KitToken {
  return kit.getToken(currency)
}

/**
 * Kova's fee payer. On Tempo it signs only the fee half of a transaction the payer signed, never
 * a payment; on Monad it submits the EIP-3009 authorizations payers sign and pays the MON gas.
 * Either way it can only move money someone signed over, so a compromise costs fees and nothing
 * else. Fee payers must be secp256k1 keys. The nonce manager lets concurrent sends not collide.
 */
export const feePayerAccount = config.KOVA_FEE_PAYER_PRIVATE_KEY
  ? privateKeyToAccount(config.KOVA_FEE_PAYER_PRIVATE_KEY as `0x${string}`, { nonceManager })
  : undefined

export const feePayerAddress: Address | undefined = feePayerAccount?.address

/**
 * Traces every upstream RPC call when KOVA_TRACE_RPC is set. The relay's cost is mostly the
 * calls it makes on our behalf, and they are invisible without this.
 */
const trace = process.env.KOVA_TRACE_RPC
  ? {
      onFetchRequest: async (request: Request) => {
        const body = (await request
          .clone()
          .json()
          .catch(() => ({}))) as { method?: string } | { method?: string }[]
        const methods = Array.isArray(body)
          ? body.map((entry) => entry.method).join(',')
          : body.method
        console.log(`[rpc] ${methods}`)
      },
    }
  : {}

/**
 * Public Monad RPCs allow about 25 requests a second per address, and Railway's outbound
 * addresses are shared, so on Monad requests retry with patience and fail over to a second
 * provider. Tempo's public RPCs have no such limit worth planning around.
 */
const backups: Record<'tempo' | 'monad', Record<typeof network.id, string[]>> = {
  tempo: { testnet: [], mainnet: [] },
  monad: {
    testnet: ['https://rpc.ankr.com/monad_testnet'],
    mainnet: ['https://rpc.ankr.com/monad'],
  },
}
const endpoint = (url: string) =>
  http(url, { ...trace, timeout: 10_000, retryCount: 3, retryDelay: 400 })
const transport = fallback(
  [endpoint(rpcUrl), ...backups[kit.id][network.id].filter((url) => url !== rpcUrl).map(endpoint)],
  { rank: false, retryCount: 2 },
)

/**
 * Reads the chain. On Tempo it is a Tempo client (with Tempo's token and fee actions, and the
 * relay's simulations run against it); on Monad, a plain public client polled fast, since Monad
 * makes a block every ~0.3s.
 */
export const publicClient = onTempo
  ? (createTempoClient({
      testnet: network.id === 'testnet',
      feeToken: settlementToken.address,
      transport: tempoHttp(rpcUrl, trace),
    }) as unknown as ReturnType<typeof createPublicClient>)
  : createPublicClient({ chain: network.chain, transport, pollingInterval: 200 })

/** Signs and submits as the fee payer (Monad's relayer). Undefined when this deployment has no key. */
export const walletClient = feePayerAccount
  ? createWalletClient({
      account: feePayerAccount,
      chain: network.chain,
      transport,
      pollingInterval: 200,
    })
  : undefined

/**
 * The fee payer as a Tempo client that sends its own transactions (testnet treasury top-ups and
 * refunds). It pays its own fee in the settlement dollar.
 */
export const treasuryClient =
  onTempo && feePayerAccount
    ? createTempoClient({
        account: feePayerAccount,
        testnet: network.id === 'testnet',
        feeToken: settlementToken.address,
        transport: tempoHttp(rpcUrl, trace),
      })
    : undefined

/** The two token calls every chain's dollars share. */
export const erc20Abi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

/** A token balance, on either chain. (Tempo has no native balance; `eth_getBalance` is a placeholder.) */
export async function balanceOf(token: Address, owner: Address): Promise<bigint> {
  return publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [owner],
  })
}

/**
 * Sends dollars from Kova's treasury (the fee payer's own balance) on either chain: test-dollar
 * top-ups on testnet, and, on Tempo, travel refunds carrying their refund memo.
 */
export async function sendFromTreasury(params: {
  token: Address
  to: Address
  amount: bigint
  memo?: Hex
}): Promise<Hash> {
  if (treasuryClient) {
    const { receipt } = await treasuryClient.token.transferSync({
      token: params.token,
      to: params.to,
      amount: params.amount,
      ...(params.memo ? { memo: params.memo } : {}),
    })
    if (receipt.status !== 'success') throw new Error('treasury transfer reverted')
    return receipt.transactionHash
  }
  if (!walletClient) throw new Error('no treasury key on this server')
  const receipt = await walletClient.writeContractSync({
    address: params.token,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [params.to, params.amount],
    timeout: 10_000,
  })
  if (receipt.status !== 'success') throw new Error('treasury transfer reverted')
  return receipt.transactionHash
}
