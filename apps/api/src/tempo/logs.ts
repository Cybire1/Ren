import { type Address, formatLog, getAbiItem, type Hex, type Log, pad, toEventSelector } from 'viem'
import { Abis } from 'viem/tempo'
import { acceptedTokens, publicClient } from '../chain.js'

/**
 * Token logs on Tempo, filtered by who sent or received them.
 *
 * Tempo's test dollars are busy (every faucet drip on the network is one), so scanning every
 * transfer in the tokens Kova accepts overflows the RPC's 20,000-result cap within a few hundred
 * blocks. Kova never needs everyone's transfers: the watcher needs those paid to shops with an
 * open charge, and a wallet needs its own. Filtering on the indexed `from`/`to` topics asks the
 * node for exactly that.
 */

const TRANSFER = toEventSelector(getAbiItem({ abi: Abis.tip20, name: 'Transfer' }))
const TRANSFER_WITH_MEMO = toEventSelector(
  getAbiItem({ abi: Abis.tip20, name: 'TransferWithMemo' }),
)

const asTopic = (address: Address) => pad(address.toLowerCase() as Hex, { size: 32 })

export async function tokenLogs(params: {
  from?: readonly Address[]
  to?: readonly Address[]
  fromBlock: bigint
  toBlock: bigint
}): Promise<Log[]> {
  const topics = [
    [TRANSFER, TRANSFER_WITH_MEMO],
    params.from?.length ? params.from.map(asTopic) : null,
    params.to?.length ? params.to.map(asTopic) : null,
  ]
  const request = publicClient.request as unknown as (args: {
    method: string
    params: unknown[]
  }) => Promise<unknown>
  const raw = (await request({
    method: 'eth_getLogs',
    params: [
      {
        address: acceptedTokens.map((t) => t.address),
        topics,
        fromBlock: `0x${params.fromBlock.toString(16)}`,
        toBlock: `0x${params.toBlock.toString(16)}`,
      },
    ],
  })) as unknown[]
  return raw.map((log) => formatLog(log as never)) as Log[]
}
