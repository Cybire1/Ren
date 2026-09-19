import { type Address, encodeEventTopics, type Hex, pad } from 'viem'
import { Abis, type Transaction } from 'viem/tempo'
import { describe, expect, it } from 'vitest'
import { decodeMemo, encodeMemo, isKovaMemo } from '../src/memo.js'
import {
  FEE_MANAGER,
  RECEIVE_POLICY_GUARD,
  TRANSFER_WITH_MEMO_SELECTOR,
  transferWithMemoCall,
  verifyPayment,
} from '../src/payment.js'
import { formatAmount, getToken, parseAmount } from '../src/tokens.js'

const TOKEN = getToken('mainnet', 'USDC').address
const MERCHANT = '0x2222222222222222222222222222222222222222' as Address
const PAYER = '0x3333333333333333333333333333333333333333' as Address
const VIRTUAL = '0x4444444444444444444444444444444444444444' as Address
const INTENT = '0192f3a4-5b6c-7d8e-9f01-23456789abcd'

function transferLog(from: Address, to: Address, amount: bigint, index: number) {
  return {
    address: TOKEN,
    topics: encodeEventTopics({ abi: Abis.tip20, eventName: 'Transfer', args: { from, to } }),
    data: pad(`0x${amount.toString(16)}`, { size: 32 }) as Hex,
    logIndex: index,
  }
}

function memoLog(from: Address, to: Address, amount: bigint, memo: Hex, index: number) {
  return {
    address: TOKEN,
    topics: encodeEventTopics({
      abi: Abis.tip20,
      eventName: 'TransferWithMemo',
      args: { from, to, memo },
    }),
    data: pad(`0x${amount.toString(16)}`, { size: 32 }) as Hex,
    logIndex: index,
  }
}

/** A receipt shaped like Tempo's: the payment logs plus the fee transfer every receipt carries. */
function receipt(
  logs: unknown[],
  status: 'success' | 'reverted' = 'success',
): Transaction.TransactionReceipt {
  return {
    status,
    logs: [...logs, transferLog(PAYER, FEE_MANAGER as Address, 31n, 99)],
  } as unknown as Transaction.TransactionReceipt
}

describe('memo', () => {
  it('round-trips', () => {
    const memo = encodeMemo({ kind: 'payment', id: INTENT })
    expect(memo).toHaveLength(66)
    expect(memo.slice(2, 10)).toBe('4b4f5641')
    expect(decodeMemo(memo)).toEqual({ kind: 'payment', id: INTENT })
  })

  it('distinguishes payments from refunds for the same object', () => {
    expect(encodeMemo({ kind: 'payment', id: INTENT })).not.toBe(
      encodeMemo({ kind: 'refund', id: INTENT }),
    )
  })

  it('rejects foreign and malformed memos', () => {
    expect(decodeMemo(pad('0xef1ed712', { size: 32, dir: 'right' }))).toBeNull() // MPP-style memo
    expect(decodeMemo('0x00')).toBeNull()
    expect(isKovaMemo(`0x${'00'.repeat(32)}`)).toBe(false)
  })

  it('rejects a non-UUID id', () => {
    expect(() => encodeMemo({ kind: 'payment', id: 'order-1' })).toThrow()
  })
})

describe('amounts', () => {
  it('parses and formats', () => {
    expect(parseAmount('25.00')).toBe(25_000_000n)
    expect(parseAmount('0.000031')).toBe(31n)
    expect(formatAmount(25_000_000n)).toBe('25.00')
    expect(formatAmount(31n)).toBe('0.000031')
    expect(formatAmount(0n)).toBe('0.00')
  })

  it('rejects ambiguous input', () => {
    for (const bad of ['', '1.2345678', '-1', '1e6', '1,000', '01.0', ' 1.0', '.5', '1.'])
      expect(() => parseAmount(bad), bad).toThrow()
  })
})

describe('transferWithMemoCall', () => {
  it('encodes the documented selector and never sends value', () => {
    const call = transferWithMemoCall({
      token: TOKEN,
      to: MERCHANT,
      amount: parseAmount('4.50'),
      memo: encodeMemo({ kind: 'payment', id: INTENT }),
    })
    expect(call.to).toBe(TOKEN)
    expect(call.value).toBe(0n)
    expect(call.data.slice(0, 10)).toBe(TRANSFER_WITH_MEMO_SELECTOR)
  })
})

describe('verifyPayment', () => {
  const amount = parseAmount('4.50')
  const memo = encodeMemo({ kind: 'payment', id: INTENT })
  const expected = { token: TOKEN, merchant: MERCHANT, amount, memo }

  it('accepts a direct payment', () => {
    const rc = receipt([
      transferLog(PAYER, MERCHANT, amount, 0),
      memoLog(PAYER, MERCHANT, amount, memo, 1),
    ])
    expect(verifyPayment(rc, expected)).toMatchObject({ status: 'paid', payer: PAYER })
  })

  it('accepts a virtual-address payment that forwards to the merchant', () => {
    const rc = receipt([
      transferLog(PAYER, VIRTUAL, amount, 0),
      transferLog(VIRTUAL, MERCHANT, amount, 1),
    ])
    expect(
      verifyPayment(rc, { token: TOKEN, merchant: MERCHANT, payTo: VIRTUAL, amount }),
    ).toMatchObject({ status: 'paid' })
  })

  it('reports held when the receive policy redirects to the guard', () => {
    const rc = receipt([transferLog(PAYER, RECEIVE_POLICY_GUARD as Address, amount, 0)])
    expect(verifyPayment(rc, expected).status).toBe('held')
  })

  it('reports failed for a reverted transaction', () => {
    expect(verifyPayment(receipt([], 'reverted'), expected).status).toBe('failed')
  })

  it('does not count the fee transfer as a payment', () => {
    expect(verifyPayment(receipt([]), { ...expected, amount: 31n, memo: undefined }).status).toBe(
      'unmatched',
    )
  })

  it('rejects a wrong amount, a wrong recipient and a wrong token', () => {
    const rc = receipt([
      transferLog(PAYER, MERCHANT, amount, 0),
      memoLog(PAYER, MERCHANT, amount, memo, 1),
    ])
    expect(verifyPayment(rc, { ...expected, amount: amount + 1n }).status).toBe('unmatched')
    expect(verifyPayment(rc, { ...expected, merchant: VIRTUAL }).status).toBe('unmatched')
    expect(
      verifyPayment(rc, { ...expected, token: getToken('mainnet', 'pathUSD').address }).status,
    ).toBe('unmatched')
  })

  it('flags a memo mismatch even when the money moved', () => {
    const rc = receipt([
      transferLog(PAYER, MERCHANT, amount, 0),
      memoLog(PAYER, MERCHANT, amount, encodeMemo({ kind: 'refund', id: INTENT }), 1),
    ])
    expect(verifyPayment(rc, expected)).toMatchObject({ status: 'memo_mismatch', payer: PAYER })
  })

  it('does not require a memo when none is expected', () => {
    const rc = receipt([transferLog(PAYER, MERCHANT, amount, 0)])
    expect(verifyPayment(rc, { token: TOKEN, merchant: MERCHANT, amount }).status).toBe('paid')
  })
})
