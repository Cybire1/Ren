import {
  type Address,
  decodeEventLog,
  getAbiItem,
  type Hex,
  isAddressEqual,
  type TransactionReceipt,
} from 'viem'
import { Abis } from 'viem/tempo'
import { feePayerAddress, publicClient, sendFromTreasury, settlementToken } from '../chain.js'

/**
 * Dollars into and out of Ren's treasury (the fee payer's wallet) for the things Ren does through
 * a partner: a cash-out abroad, a card top-up, money off a card.
 *
 * In: the wallet sends a `transferWithMemo` naming what it pays for, then tells the API its hash;
 * `paidTreasury` reads the receipt and says whether it is exactly that payment.
 *
 * Out: `sendOnceFromTreasury` sends a refund or a withdrawal exactly once. Tempo answers a send with
 * its receipt, so most sends are known at once; the one that isn't (the node took it and the answer
 * never came) is looked for on Tempo by its memo, which is unique to what it pays, before anything
 * is sent again.
 */

const transferWithMemo = getAbiItem({ abi: Abis.tip20, name: 'TransferWithMemo' })

/** Whether a transaction moved exactly `amount` of Ren's dollar from `from` to the treasury, with `memo`. */
export async function paidTreasury(
  txHash: Hex,
  expected: { from: Address; amount: bigint; memo: Hex },
): Promise<boolean> {
  if (!feePayerAddress) return false
  const receipt = (await publicClient
    .waitForTransactionReceipt({ hash: txHash, timeout: 30_000 })
    .catch(() => null)) as TransactionReceipt | null
  if (receipt?.status !== 'success') return false
  const memo = expected.memo.toLowerCase()
  for (const log of receipt.logs) {
    if (!isAddressEqual(log.address, settlementToken.address)) continue
    try {
      const event = decodeEventLog({ abi: Abis.tip20, data: log.data, topics: log.topics })
      if (event.eventName !== 'TransferWithMemo') continue
      const args = event.args as { from: Address; to: Address; amount: bigint; memo: Hex }
      if (
        isAddressEqual(args.to, feePayerAddress) &&
        isAddressEqual(args.from, expected.from) &&
        args.amount === expected.amount &&
        args.memo.toLowerCase() === memo
      )
        return true
    } catch {
      // Not a transfer event.
    }
  }
  return false
}

/** Where a send from the treasury stands, as its row keeps it. */
export interface SendState {
  txHash: string | null
  /** The block before the first try: the search for it on Tempo starts here. */
  block: bigint | null
  /** When it was last tried and got no answer; null when the last try certainly moved nothing. */
  triedAt: Date | null
}

/** A send that got no answer is left alone this long before it's tried again. */
export const RESEND_AFTER_MS = 10 * 60_000

/** The treasury's transfer of `amount` to `to` with `memo`, if Tempo has it since `fromBlock`. */
async function sentAlready(
  transfer: { to: Address; amount: bigint; memo: Hex },
  fromBlock: bigint,
): Promise<Hex | null> {
  const logs = await publicClient.getLogs({
    address: settlementToken.address,
    event: transferWithMemo,
    args: { from: feePayerAddress, to: transfer.to, memo: transfer.memo },
    fromBlock,
    toBlock: 'latest',
  })
  return logs.find((log) => log.args.amount === transfer.amount)?.transactionHash ?? null
}

/**
 * Sends `amount` from the treasury to `to`, once per memo. `save` writes what changed to the row
 * before anything else happens, so a crash at any point leaves enough to carry on from.
 *
 * Returns the hash once the transfer is on Tempo, or null while it isn't (call again later). A try
 * that got no answer is searched for by its memo first; only after ten minutes with no sign of it,
 * by when the treasury's later transactions have used its nonce, is it sent again.
 */
export async function sendOnceFromTreasury(
  state: SendState,
  transfer: { to: Address; amount: bigint; memo: Hex },
  save: (next: Partial<SendState>) => Promise<void>,
): Promise<Hex | null> {
  if (state.txHash) return state.txHash as Hex
  if (state.block !== null) {
    const found = await sentAlready(transfer, state.block)
    if (found) {
      await save({ txHash: found })
      return found
    }
    if (state.triedAt && Date.now() - state.triedAt.getTime() < RESEND_AFTER_MS) return null
  }
  const block = state.block ?? (await publicClient.getBlockNumber())
  await save({ block, triedAt: new Date() })
  try {
    const hash = await sendFromTreasury({ token: settlementToken.address, ...transfer })
    await save({ txHash: hash })
    return hash
  } catch (error) {
    const said = error instanceof Error ? error.message : String(error)
    // Reverted on Tempo: it was read, and nothing moved, so the next try needn't wait.
    if (/reverted/i.test(said)) await save({ triedAt: null })
    console.error('[treasury] a send didn’t go through yet:', said.slice(0, 200))
    return null
  }
}
