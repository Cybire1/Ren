import { type Address, decodeFunctionData, type Hex, isAddressEqual, parseAbi } from 'viem'
import { Abis } from 'viem/tempo'

type Call = { to?: Address | undefined; data?: Hex | undefined }

/**
 * The earlier portal's encrypted deposit, on Tempo's persistent testnet zones (A and B): the same
 * call without a refund address. Kept in step with apps/web src/lib/wallet/zone.ts.
 */
const sandboxPortal = parseAbi([
  'function depositEncrypted(address token, uint128 amount, uint256 keyIndex, (bytes32 ephemeralPubkeyX, uint8 ephemeralPubkeyYParity, bytes ciphertext, bytes12 nonce, bytes16 tag) encrypted) returns (bytes32)',
])

/** The deposit call's token, amount and refund address, from whichever portal it was made for. */
function readDeposit(
  data: Hex,
): { token: Address; amount: bigint; refundTo: Address | null } | null {
  try {
    const current = decodeFunctionData({ abi: Abis.zonePortal, data })
    if (current.functionName !== 'depositEncrypted') return null
    const [token, amount, , , refundTo] = current.args as readonly [
      Address,
      bigint,
      bigint,
      unknown,
      Address,
    ]
    return { token, amount, refundTo }
  } catch {}
  try {
    const sandbox = decodeFunctionData({ abi: sandboxPortal, data })
    const [token, amount] = sandbox.args as readonly [Address, bigint, bigint, unknown]
    return { token, amount, refundTo: null }
  } catch {
    return null
  }
}

/**
 * Why Ren won't pay the fee for this move into the private zone (Tempo Zones), or null when it will.
 *
 * A deposit is two calls in one transaction, as viem's `encryptedDeposit` builds it: approve
 * exactly the amount to the zone's portal, then `depositEncrypted` that amount of the same dollar.
 * Who it's for is encrypted to the zone's sequencer, so Ren can't see it and doesn't need to: a
 * deposit only ever moves the sender's own dollars. Where the portal takes a refund address for a
 * deposit the zone bounces, it must be the sender's, so Ren's fee never routes anyone else's money.
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
  try {
    approval = decodeFunctionData({ abi: Abis.tip20, data: approve.data })
  } catch {
    return 'undecodable call'
  }
  if (approval.functionName !== 'approve') return 'the first call must approve the zone'
  const [spender, allowance] = approval.args as readonly [Address, bigint]
  if (!isAddressEqual(spender, portal)) return 'the approval is not for the zone'

  const deposited = readDeposit(deposit.data)
  if (!deposited) return 'only encrypted deposits are sponsored'
  if (!isAddressEqual(deposited.token, token)) return 'the deposit is not the approved dollar'
  if (deposited.amount <= 0n) return 'nothing to deposit'
  if (deposited.amount !== allowance) return 'the deposit is not the approved amount'
  if (deposited.refundTo && !isAddressEqual(deposited.refundTo, from))
    return 'a bounced deposit must refund the sender'
  return null
}
