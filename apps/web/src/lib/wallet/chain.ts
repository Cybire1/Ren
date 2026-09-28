import { onTempo } from '../chain'
import * as monad from './chain-monad'
import * as tempo from './chain-tempo'

/**
 * The web wallet's money calls on this deployment's chain: Tempo (a relayed TIP-20 transfer, Kova
 * pays the fee) or Monad (an EIP-3009 authorization Kova's relayer submits). Same calls either way.
 */
export type { ChargeToPay, IndexedTransfer, Moved } from './chain-monad'

const side = onTempo ? tempo : monad

export const balanceOf = side.balanceOf
export const sendMoney = side.sendMoney
export const payCharge = side.payCharge
export const addTestDollars = side.addTestDollars
export const transfersAfter = side.transfersAfter
