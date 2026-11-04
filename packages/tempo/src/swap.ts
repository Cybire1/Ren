import { type Address, decodeFunctionData, type Hex, isAddressEqual } from 'viem'
import { Abis, Actions, Addresses } from 'viem/tempo'

/**
 * Turning other dollars into OUSD on Tempo's stablecoin exchange (a precompile at 0xdec0…): one
 * `swapExactAmountIn` per dollar, all in one transaction the wallet signs, so they all go or none
 * does. The exchange needs no approval, takes no fee beyond its spread, and its quote is what the
 * swap fills at, so each swap asks for at least the quote less a sliver for a market that moved.
 */

export const STABLECOIN_DEX: Address = Addresses.stablecoinDex

/** How far below its quote a swap may fill: 0.5%. */
export const SWAP_SLIPPAGE_BPS = 50n

/** The least a swap quoted at `quoted` may give. */
export const swapMinOut = (quoted: bigint): bigint =>
  (quoted * (10_000n - SWAP_SLIPPAGE_BPS)) / 10_000n

/** One dollar to swap: how much, and what the exchange quoted for it. */
export interface SwapIn {
  token: Address
  amount: bigint
  quoted: bigint
}

/** The calls for one transaction that turns every `SwapIn` into `into`. */
export function swapIntoCalls(swaps: readonly SwapIn[], into: Address) {
  return swaps.map((s) =>
    Actions.dex.sell.call({
      tokenIn: s.token,
      tokenOut: into,
      amountIn: s.amount,
      minAmountOut: swapMinOut(s.quoted),
    }),
  )
}

/** A call that sells one token into another on the exchange, read back from its calldata. */
export interface DecodedSwap {
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  minAmountOut: bigint
}

/** Reads a `swapExactAmountIn` on the exchange; anything else is null. */
export function decodeSwapIn(call: {
  to?: Address | undefined
  data?: Hex | undefined
}): DecodedSwap | null {
  if (!call.to || !call.data || !isAddressEqual(call.to, STABLECOIN_DEX)) return null
  try {
    const { functionName, args } = decodeFunctionData({ abi: Abis.stablecoinDex, data: call.data })
    if (functionName !== 'swapExactAmountIn') return null
    const [tokenIn, tokenOut, amountIn, minAmountOut] = args as [Address, Address, bigint, bigint]
    return { tokenIn, tokenOut, amountIn, minAmountOut }
  } catch {
    return null
  }
}
