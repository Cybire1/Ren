import { getToken, moneyActionMessage, type NetworkId } from '@kova/tempo'
import type { Address, Hex } from 'viem'

/**
 * What cash-outs and the dollar card share: a request only this wallet can make (its signature
 * over the action), and the transfer the API asks the wallet to send (`pay`), which goes out
 * through the provider's sendToRen, sponsored, with the memo that names it.
 */

export type Sign = (message: string) => Promise<Hex>

/**
 * `{ signed_at, signature }` for a signed route, fresh to the second: the wallet's signature over
 * the action (packages/tempo money.ts, the same words the API's requireWalletSignature checks).
 */
export async function signed(address: Address, sign: Sign, action: string, detail = '') {
  const signed_at = Math.floor(Date.now() / 1000)
  return {
    signed_at,
    signature: await sign(moneyActionMessage(address, action, signed_at, detail)),
  }
}

/** The transfer the API asks for: this token, to Ren, this much (base units), with this memo. */
export interface PayRequest {
  token: string
  to: string | null
  amount: string
  memo: Hex
}

/** A `pay` the wallet can send as it stands, or the reason it won't. */
export function checkedPay(
  network: NetworkId,
  pay: PayRequest | null | undefined,
): { to: Address; amount: bigint; memo: Hex } {
  if (!pay?.to) throw new Error('This isn’t switched on yet. Nothing moved.')
  if (pay.token.toLowerCase() !== getToken(network).address.toLowerCase())
    throw new Error('Ren asked for a token this wallet doesn’t pay with. Nothing moved.')
  if (!/^0x[0-9a-fA-F]{40}$/.test(pay.to) || !/^\d{1,30}$/.test(pay.amount))
    throw new Error('Ren’s payment details didn’t read right. Nothing moved.')
  if (!/^0x[0-9a-fA-F]{64}$/.test(pay.memo))
    throw new Error('Ren’s payment details didn’t read right. Nothing moved.')
  return { to: pay.to as Address, amount: BigInt(pay.amount), memo: pay.memo }
}

/** A failed send in words someone can act on. Null when they cancelled the passkey. */
export function moveProblem(error: unknown, fallback: string): string | null {
  const message = error instanceof Error ? error.message : String(error)
  if (/cancel|reject|denied|abort|not allowed/i.test(message)) return null
  if (/insufficient|exceeds balance/i.test(message))
    return 'Not enough dollars in this wallet. Nothing moved.'
  // Ren's own sentences are short; a chain library's error is not something to show.
  return message.length <= 140 && !/\n/.test(message) ? message : fallback
}

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
