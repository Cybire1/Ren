import { AUSD_TESTNET_FAUCET, eip3009Abi, faucetAbi, formatAmount } from '@kova/monad'
import { type Address, BaseError, type Hash } from 'viem'
import { feePayerAccount, publicClient, settlementToken, walletClient } from '../chain.js'
import { KovaError } from '../errors.js'

/**
 * Test dollars, on testnet only. Agora's faucet gives 10,000 test AUSD a request; when it has run
 * dry (it reverts with InsufficientFunds), Kova's own testnet treasury, the relayer, sends a
 * smaller top-up instead, so trying Kova never depends on someone else's faucet being full.
 */
export const TREASURY_DRIP = 100_000_000n

export interface Drip {
  amount: string
  txHash: Hash
  from: 'agora' | 'kova'
}

const dry = (error: unknown) =>
  error instanceof BaseError && (error.walk((e) => (e as { signature?: string }).signature === '0x356680b7') !== null || /InsufficientFunds/.test(error.message))

export async function giveTestDollars(to: Address): Promise<Drip> {
  if (!walletClient || !feePayerAccount) throw new KovaError('chain_error', 'Test dollars are not switched on for this server yet.')
  try {
    const receipt = await walletClient.writeContractSync({ address: AUSD_TESTNET_FAUCET, abi: faucetAbi, functionName: 'requestFunds', args: [to], timeout: 10_000 })
    if (receipt.status !== 'success') throw new KovaError('chain_error', 'The test-dollar faucet said no. Try again later.')
    return { amount: '10000.00', txHash: receipt.transactionHash, from: 'agora' }
  } catch (error) {
    if (!dry(error)) {
      console.error('[faucet]', error instanceof Error ? error.message.split('\n')[0] : error)
      throw error instanceof KovaError ? error : new KovaError('chain_error', 'The test-dollar faucet didn’t answer. Try again in a moment.')
    }
  }

  const stock = await publicClient.readContract({ address: settlementToken.address, abi: eip3009Abi, functionName: 'balanceOf', args: [feePayerAccount.address] })
  if (stock < TREASURY_DRIP) {
    console.error(`[faucet] Agora's faucet is dry and the treasury holds ${formatAmount(stock)} AUSD: top up ${feePayerAccount.address}`)
    throw new KovaError('chain_error', 'Test dollars have run out for the moment. Kova is topping up; try again later.')
  }
  const receipt = await walletClient.writeContractSync({
    address: settlementToken.address,
    abi: eip3009Abi,
    functionName: 'transfer',
    args: [to, TREASURY_DRIP],
    timeout: 10_000,
  })
  if (receipt.status !== 'success') throw new KovaError('chain_error', 'The test-dollar top-up failed. Try again in a moment.')
  return { amount: formatAmount(TREASURY_DRIP), txHash: receipt.transactionHash, from: 'kova' }
}
