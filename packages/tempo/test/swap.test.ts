import { describe, expect, it } from 'vitest'
import { decodeSwapIn, STABLECOIN_DEX, swapIntoCalls, swapMinOut } from '../src/swap.js'
import { OUSD_ADDRESS, otherDollars } from '../src/tokens.js'

const alpha = otherDollars.testnet[0]!.address
const beta = otherDollars.testnet[1]!.address

describe('swapping other dollars into OUSD', () => {
  it('asks for the quote less half a percent', () => {
    expect(swapMinOut(10_000_000n)).toBe(9_950_000n)
    expect(swapMinOut(0n)).toBe(0n)
  })

  it('makes one exchange call per dollar, read back exactly', () => {
    const calls = swapIntoCalls(
      [
        { token: alpha, amount: 5_000_000n, quoted: 4_950_000n },
        { token: beta, amount: 1_250_000n, quoted: 1_240_000n },
      ],
      OUSD_ADDRESS,
    )
    expect(calls).toHaveLength(2)
    expect(calls.every((c) => c.to.toLowerCase() === STABLECOIN_DEX.toLowerCase())).toBe(true)
    expect(decodeSwapIn(calls[0]!)).toEqual({
      tokenIn: alpha,
      tokenOut: OUSD_ADDRESS,
      amountIn: 5_000_000n,
      minAmountOut: swapMinOut(4_950_000n),
    })
    expect(decodeSwapIn(calls[1]!)?.amountIn).toBe(1_250_000n)
  })

  it('reads nothing but a sell on the exchange', () => {
    const [call] = swapIntoCalls([{ token: alpha, amount: 1n, quoted: 1n }], OUSD_ADDRESS)
    expect(decodeSwapIn({ to: alpha, data: call!.data })).toBeNull()
    expect(decodeSwapIn({ to: STABLECOIN_DEX, data: '0xdeadbeef' })).toBeNull()
  })

  it('never lists OUSD among the other dollars', () => {
    for (const list of Object.values(otherDollars))
      expect(list.some((d) => d.address.toLowerCase() === OUSD_ADDRESS.toLowerCase())).toBe(false)
  })
})
