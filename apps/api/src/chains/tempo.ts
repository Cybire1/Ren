import {
  currencies,
  DEFAULT_CURRENCY,
  decodeIndexedTransfers,
  explorerAddressUrl,
  explorerTxUrl,
  getNetwork,
  getToken,
  isCurrency,
  LOG_RANGE,
  memosIn,
  supportedTokens,
  TEST_DOLLARS_A_DAY,
  tokenByAddress,
  verifyPayment,
} from '@kova/tempo'
import { getAbiItem } from 'viem'
import { Abis, type Transaction } from 'viem/tempo'
import type { ChainKit, NetworkId } from './kit.js'

/**
 * Kova on Tempo: payments are TIP-20 `transferWithMemo` calls carrying the Kova memo, and Kova's
 * fee payer covers the fee, so nobody needs a gas token.
 */
export function tempoKit(networkId: NetworkId): ChainKit {
  const network = getNetwork(networkId)
  return {
    id: 'tempo',
    name: 'Tempo',
    network: { ...network, name: network.name },
    currencies,
    defaultCurrency: DEFAULT_CURRENCY,
    tokens: supportedTokens(networkId),
    getToken: (currency) =>
      getToken(networkId, currency && isCurrency(currency) ? currency : DEFAULT_CURRENCY),
    tokenByAddress: (address) => tokenByAddress(networkId, address),
    logRange: LOG_RANGE,
    watchEvents: [
      getAbiItem({ abi: Abis.tip20, name: 'Transfer' }),
      getAbiItem({ abi: Abis.tip20, name: 'TransferWithMemo' }),
    ] as never,
    indexTransfers: (logs, token) => decodeIndexedTransfers(logs as never, token),
    memos: (logs) => memosIn(logs as never),
    verifyPayment: (receipt, expected) =>
      verifyPayment(receipt as unknown as Transaction.TransactionReceipt, {
        token: expected.token,
        merchant: expected.payTo,
        amount: expected.amount,
        memo: expected.memo,
      }),
    testDollarsADay: TEST_DOLLARS_A_DAY,
    // Tempo's public faucet mints from the zero address.
    faucets: [],
    explorerTxUrl: (hash) => explorerTxUrl(network, hash),
    explorerAddressUrl: (address) => explorerAddressUrl(network, address),
  }
}
