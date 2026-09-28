/**
 * The chain this build of Kova Pay runs on (EXPO_PUBLIC_KOVA_CHAIN): Tempo by default, or Monad.
 * Both sides offer the same calls, so the wallet and every screen are the same on either chain.
 */
import * as monad from './chain-monad'
import * as tempo from './chain-tempo'
import { onTempo } from './config'

export type { Charge, Incoming, Sent } from './chain-tempo'

const side = onTempo ? tempo : monad

export const publicClient = side.publicClient as typeof monad.publicClient
export const getBalance = side.getBalance
export const fundFromFaucet = side.fundFromFaucet
export const payCharge = side.payCharge
export const sendMoney = side.sendMoney
export const incomingSince = side.incomingSince
export const explorerTx = side.explorerTx
