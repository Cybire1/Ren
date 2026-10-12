import {
  AUSD_TESTNET_FAUCET,
  currencies,
  DEFAULT_CURRENCY,
  decodeCardPayments,
  decodeMemo,
  decodeTokenTransfers,
  eip3009Abi,
  explorerAddressUrl,
  explorerTxUrl,
  getNetwork,
  getToken,
  isCurrency,
  kovaCardAbi,
  kovaCardAddress,
  LOG_RANGE,
  supportedTokens,
  TEST_DOLLARS_A_DAY,
  tokenByAddress,
  verifyPayment,
} from '@kova/monad'
import { type Address, decodeEventLog, getAbiItem, type Hex } from 'viem'
import type { ChainKit, NetworkId } from './kit.js'

/**
 * Kova on Monad: payers sign EIP-3009 authorizations whose nonce is the Kova memo, and Kova Card
 * taps go through the KovaCard contract, which records the charge's memo beside the transfer.
 */
export function monadKit(networkId: NetworkId): ChainKit {
  const network = getNetwork(networkId)
  const tokens = supportedTokens(networkId)
  const cardContract = kovaCardAddress(networkId)
  return {
    id: 'monad',
    name: 'Monad',
    network,
    currencies,
    defaultCurrency: DEFAULT_CURRENCY,
    tokens,
    getToken: (currency) =>
      getToken(networkId, currency && isCurrency(currency) ? currency : DEFAULT_CURRENCY),
    tokenByAddress: (address) => tokenByAddress(networkId, address),
    logRange: LOG_RANGE,
    watchEvents: [
      getAbiItem({ abi: eip3009Abi, name: 'AuthorizationUsed' }),
      getAbiItem({ abi: eip3009Abi, name: 'Transfer' }),
      getAbiItem({ abi: kovaCardAbi, name: 'CardPayment' }),
    ],
    watchAddresses: cardContract
      ? [...tokens.map((t) => t.address), cardContract]
      : tokens.map((t) => t.address),
    // A card tap pairs the contract's CardPayment with the token's Transfer, so both are read.
    indexTransfers: (logs, token) =>
      decodeTokenTransfers(logs as never, token, cardContract).map((t) => ({
        from: t.from,
        to: t.to,
        value: t.value,
        logIndex: t.logIndex,
        // Monad records every authorization's nonce, Kova memo or not, exactly as before.
        memo: t.nonce ?? null,
      })),
    memos: (logs) => {
      // Card taps first: the KovaCard contract names the charge each one paid.
      const found: Hex[] = decodeCardPayments(logs as never, cardContract)
        .map((tap) => tap.memo)
        .filter((memo) => decodeMemo(memo))
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
    verifyPayment: (receipt, expected) => verifyPayment(receipt, { ...expected, cardContract }),
    testDollarsADay: TEST_DOLLARS_A_DAY,
    faucets: [AUSD_TESTNET_FAUCET as Address],
    explorerTxUrl: (hash) => explorerTxUrl(network, hash),
    explorerAddressUrl: (address) => explorerAddressUrl(network, address),
  }
}
