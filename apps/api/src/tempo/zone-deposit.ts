import { type Address, decodeFunctionData, type Hex, isAddressEqual } from 'viem'
import { Abis } from 'viem/tempo'

type Call = { to?: Address | undefined; data?: Hex | undefined }

/**
 * Why Ren won't pay the fee for this move into the private zone (Tempo Zones), or null when it will.
 *
 * A deposit is two calls in one transaction, as viem's `encryptedDeposit` builds it: approve
 * exactly the amount to the zone's portal, then `depositEncrypted` that amount of the same dollar.
 * Who it's for is encrypted to the zone's sequencer, so Ren can't see it and doesn't need to: a
 * deposit only ever moves the sender's own dollars. A deposit the zone bounces is refunded, and
 * the refund must go back to the sender, so Ren's fee never routes anyone else's money.
 */
export function zoneDepositProblem(
  calls: readonly Call[],
  from: Address | undefined,
  portal: Address,
  dollars: readonly Address[],
): string | null {
  if (calls.length !== 2) return 'expected an approval and a deposit'
  const [approve, deposit] = calls
  if (!approve?.to || !approve.data || !deposit?.to || !deposit.data) return 'call missing to/data'
  const token = dollars.find((d) => isAddressEqual(d, approve.to as Address))
  if (!token) return 'not a dollar Ren accepts'
  if (!isAddressEqual(deposit.to, portal)) return 'not Ren’s private zone'
  if (!from) return 'no sender'

  let approval: ReturnType<typeof decodeFunctionData<typeof Abis.tip20>>
  let deposited: ReturnType<typeof decodeFunctionData<typeof Abis.zonePortal>>
  try {
    approval = decodeFunctionData({ abi: Abis.tip20, data: approve.data })
    deposited = decodeFunctionData({ abi: Abis.zonePortal, data: deposit.data })
  } catch {
    return 'undecodable call'
  }
  if (approval.functionName !== 'approve') return 'the first call must approve the zone'
  const [spender, allowance] = approval.args as readonly [Address, bigint]
  if (!isAddressEqual(spender, portal)) return 'the approval is not for the zone'
  if (deposited.functionName !== 'depositEncrypted') return 'only encrypted deposits are sponsored'
  const [depositToken, amount, , , refundTo] = deposited.args as readonly [
    Address,
    bigint,
    bigint,
    unknown,
    Address,
  ]
  if (!isAddressEqual(depositToken, token)) return 'the deposit is not the approved dollar'
  if (amount <= 0n) return 'nothing to deposit'
  if (amount !== allowance) return 'the deposit is not the approved amount'
  if (!isAddressEqual(refundTo, from)) return 'a bounced deposit must refund the sender'
  return null
}
