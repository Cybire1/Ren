import { config } from '../config.js'
import type { ChainKit } from './kit.js'
import { monadKit } from './monad.js'
import { tempoKit } from './tempo.js'

export type { ChainKit, ChainName, Currency, IndexedTransfer, KitNetwork, KitToken } from './kit.js'

/** The chain this deployment runs on. One process serves one chain and one network. */
export const kit: ChainKit =
  config.KOVA_CHAIN === 'tempo' ? tempoKit(config.KOVA_NETWORK) : monadKit(config.KOVA_NETWORK)

export const onTempo = kit.id === 'tempo'
