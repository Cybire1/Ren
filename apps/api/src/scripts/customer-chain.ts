/**
 * The throwaway customer for whichever chain this API runs on: a sponsored TIP-20 transfer on
 * Tempo, an EIP-3009 authorization through the relayer on Monad. Same calls either way.
 */
import { config } from '../config.js'

const impl = config.KOVA_CHAIN === 'tempo' ? await import('./customer-tempo.js') : await import('./customer.js')

export const { fund, getCheckout, newCustomer, pay } = impl
