import {
  AUSD_TESTNET_FAUCET,
  currencies,
  DEFAULT_CURRENCY,
  decodeMemo,
  decodeTokenTransfers,
  eip3009Abi,
  explorerAddressUrl,
  explorerTxUrl,
  getNetwork,
  getToken,
  isCurrency,
  LOG_RANGE,
  supportedTokens,
  TEST_DOLLARS_A_DAY,
  tokenByAddress,
  verifyPayment,
} from '@kova/monad'
import { type Address, decodeEventLog, getAbiItem, type Hex } from 'viem'
import type { ChainKit, NetworkId } from './kit.js'

/** Kova on Monad: payers sign EIP-3009 authorizations whose nonce is the Kova memo. */
export function monadKit(networkId: NetworkId): ChainKit {
  const network = getNetwork(networkId)
  return {
    id: 'monad',
    name: 'Monad',
    network,
    currencies,
    defaultCurrency: DEFAULT_CURRENCY,
    tokens: supportedTokens(networkId),
    getToken: (currency) =>
      getToken(networkId, currency && isCurrency(currency) ? currency : DEFAULT_CURRENCY),
    tokenByAddress: (address) => tokenByAddress(networkId, address),
    logRange: LOG_RANGE,
    watchEvents: [
      getAbiItem({ abi: eip3009Abi, name: 'AuthorizationUsed' }),
      getAbiItem({ abi: eip3009Abi, name: 'Transfer' }),
    ],
    indexTransfers: (logs, token) =>
      decodeTokenTransfers(logs as never, token).map((t) => ({
        from: t.from,
        to: t.to,
        value: t.value,
        logIndex: t.logIndex,
        // Monad records every authorization's nonce, Kova memo or not, exactly as before.
        memo: t.nonce ?? null,
      })),
    memos: (logs) => {
      const found: Hex[] = []
      for (const log of logs) {
        try {
          // decodeEventLog decodes whatever event the log is; it doesn't enforce the name asked for.
          const event = decodeEventLog({ abi: eip3009Abi, data: log.data, topics: log.topics })
          if (event.eventName === 'AuthorizationUsed' && decodeMemo(event.args.nonce))
            found.push(event.args.nonce)
        } catch {}
      }
      return found
    },
    verifyPayment: (receipt, expected) => verifyPayment(receipt, expected),
    testDollarsADay: TEST_DOLLARS_A_DAY,
    faucets: [AUSD_TESTNET_FAUCET as Address],
    explorerTxUrl: (hash) => explorerTxUrl(network, hash),
    explorerAddressUrl: (address) => explorerAddressUrl(network, address),
  }
}
