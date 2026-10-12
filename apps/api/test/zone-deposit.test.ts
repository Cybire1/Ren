import { type Address, encodeFunctionData, parseAbi } from 'viem'
import { Abis, Actions } from 'viem/tempo'
import { describe, expect, it } from 'vitest'
import { zoneDepositProblem } from '../src/tempo/zone-deposit.js'

/** Which moves into the private zone Ren pays the fee for: exactly what the wallet builds. */

const alpha = '0x20C0000000000000000000000000000000000001' as Address
const beta = '0x20C0000000000000000000000000000000000002' as Address
const dollars = [alpha]
/** A current-runtime portal on Moderato: 0x5ad0… followed by the zone id. */
const portal = '0x5Ad0000000000000000000000000000000000003' as Address
const sender = '0x1111111111111111111111111111111111111111' as Address
const someoneElse = '0x2222222222222222222222222222222222222222' as Address

const encrypted = {
  ephemeralPubkeyX: `0x${'ab'.repeat(32)}`,
  ephemeralPubkeyYParity: 2,
  ciphertext: `0x${'cd'.repeat(96)}`,
  nonce: `0x${'ef'.repeat(12)}`,
  tag: `0x${'01'.repeat(16)}`,
} as const

/** The calls the wallet sends, built by viem exactly as `encryptedDeposit` does. */
const deposit = (
  amount: bigint,
  overrides: { token?: Address; refund?: Address; portal?: Address } = {},
) =>
  Actions.zone.encryptedDeposit
    .calls({
      amount,
      chainId: 42431,
      encrypted,
      keyIndex: 0n,
      sender,
      portalAddress: overrides.portal ?? portal,
      tempoRefundRecipient: overrides.refund ?? sender,
      token: overrides.token ?? alpha,
      zoneId: 6,
    })
    .map((c) => ({ to: c.to, data: c.data }))

describe('zoneDepositProblem', () => {
  it('pays for an approval and an encrypted deposit of the same dollar and amount', () => {
    expect(zoneDepositProblem(deposit(5_000_000n), sender, portal, dollars)).toBeNull()
  })

  it('refuses a deposit into another zone', () => {
    const other = '0x5Ad0000000000000000000000000000000000002' as Address
    expect(
      zoneDepositProblem(deposit(5_000_000n, { portal: other }), sender, portal, dollars),
    ).toBe('not Ren’s private zone')
  })

  it('refuses a dollar Ren does not accept', () => {
    expect(zoneDepositProblem(deposit(5_000_000n, { token: beta }), sender, portal, dollars)).toBe(
      'not a dollar Ren accepts',
    )
  })

  it('refuses a bounce refunded to someone other than the sender', () => {
    expect(
      zoneDepositProblem(deposit(5_000_000n, { refund: someoneElse }), sender, portal, dollars),
    ).toBe('a bounced deposit must refund the sender')
  })

  it('refuses a deposit larger than the approval', () => {
    const [approve, pay] = deposit(5_000_000n)
    const bigger = deposit(9_000_000n)[1]
    expect(zoneDepositProblem([approve!, bigger!], sender, portal, dollars)).toBe(
      'the deposit is not the approved amount',
    )
    expect(zoneDepositProblem([approve!, pay!], sender, portal, dollars)).toBeNull()
  })

  it('refuses an approval to anyone but the zone', () => {
    const [, pay] = deposit(5_000_000n)
    const approveSomeoneElse = {
      to: alpha,
      data: encodeFunctionData({
        abi: Abis.tip20,
        functionName: 'approve',
        args: [someoneElse, 5_000_000n],
      }),
    }
    expect(zoneDepositProblem([approveSomeoneElse, pay!], sender, portal, dollars)).toBe(
      'the approval is not for the zone',
    )
  })

  it('refuses a transfer dressed up as the first call', () => {
    const [, pay] = deposit(5_000_000n)
    const transfer = {
      to: alpha,
      data: encodeFunctionData({
        abi: Abis.tip20,
        functionName: 'transfer',
        args: [someoneElse, 5_000_000n],
      }),
    }
    expect(zoneDepositProblem([transfer, pay!], sender, portal, dollars)).toBe(
      'the first call must approve the zone',
    )
  })

  it('refuses nothing, and a missing sender', () => {
    expect(zoneDepositProblem(deposit(0n), sender, portal, dollars)).toBe('nothing to deposit')
    expect(zoneDepositProblem(deposit(5_000_000n), undefined, portal, dollars)).toBe('no sender')
    expect(zoneDepositProblem(deposit(5_000_000n).slice(0, 1), sender, portal, dollars)).toBe(
      'expected an approval and a deposit',
    )
  })
})

/** Tempo's persistent sandbox zones (A and B) take the earlier deposit, without a refund address. */
const sandboxPortal = parseAbi([
  'function depositEncrypted(address token, uint128 amount, uint256 keyIndex, (bytes32 ephemeralPubkeyX, uint8 ephemeralPubkeyYParity, bytes ciphertext, bytes12 nonce, bytes16 tag) encrypted) returns (bytes32)',
])
const sandboxDeposit = (approved: bigint, deposited: bigint, token: Address = alpha) => [
  {
    to: token,
    data: encodeFunctionData({
      abi: Abis.tip20,
      functionName: 'approve',
      args: [portal, approved],
    }),
  },
  {
    to: portal,
    data: encodeFunctionData({
      abi: sandboxPortal,
      functionName: 'depositEncrypted',
      args: [token, deposited, 0n, encrypted],
    }),
  },
]

describe('zoneDepositProblem, sandbox portal', () => {
  it('pays for the earlier encrypted deposit of the approved dollar and amount', () => {
    expect(
      zoneDepositProblem(sandboxDeposit(5_000_000n, 5_000_000n), sender, portal, dollars),
    ).toBeNull()
  })

  it('still refuses a deposit larger than the approval, or another dollar', () => {
    expect(
      zoneDepositProblem(sandboxDeposit(5_000_000n, 9_000_000n), sender, portal, dollars),
    ).toBe('the deposit is not the approved amount')
    expect(
      zoneDepositProblem(sandboxDeposit(5_000_000n, 5_000_000n, beta), sender, portal, dollars),
    ).toBe('not a dollar Ren accepts')
  })
})
