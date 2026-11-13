import type { Address } from 'viem'

/**
 * The parts of Ren that run through a partner (the dollar card, cash-outs abroad). What the wallet
 * signs to act on its own account lives here, so the app, the web and the API agree on it to the
 * byte.
 */

export type MoneyFeature = 'us_account' | 'dollar_card' | 'savings'

export const MONEY_FEATURES: readonly MoneyFeature[] = ['us_account', 'dollar_card', 'savings']

/** How long a signed request to Ren stays good, in seconds. */
export const MONEY_SIGNATURE_MAX_AGE = 300

/**
 * The message a wallet signs to act on its own account at Ren (start its ID check, top up or freeze
 * its card, see its card number, save where it cashes out to). `detail` pins the exact change, so a
 * signature for one action can't be replayed as another.
 */
export function moneyActionMessage(
  wallet: Address,
  action: string,
  signedAt: number,
  detail = '',
): string {
  return `Ren account\nWallet ${wallet.toLowerCase()}\nAction ${action}${detail ? `\n${detail}` : ''}\nSigned ${signedAt}`
}
