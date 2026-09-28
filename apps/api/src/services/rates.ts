import { type Address, hexToString } from 'viem'
import { kit, network, publicClient } from '../chain.js'
import { config } from '../config.js'
import { PER_USD } from './ai.js'

/**
 * Kova's reference exchange rates, for the apps to show local prices and for Kova Travel to price
 * fares. Nothing is ever converted; rates only label dollar amounts (DECISIONS D-012).
 *
 * - On Monad, a Chainlink CRE workflow publishes them to KovaRates: every node of the DON reads
 *   two independent sources and cross-checks them, and the DON writes the median (apps/rates).
 * - CRE does not reach Tempo, so on Tempo this server reads the same two sources itself and
 *   applies the same cross-check.
 *
 * If the rates can't be read, the last ones stand, and before any have been read, the table.
 */
const kovaRatesAbi = [
  {
    type: 'function',
    name: 'allRates',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'codes', type: 'bytes3[]' },
      { name: 'perUsdE8', type: 'uint256[]' },
      { name: 'asOf', type: 'uint64[]' },
    ],
  },
] as const

export interface Rate {
  perUsd: number
  /** When the DON published it. Null for the fixed table. */
  asOf: string | null
}

export interface RateBook {
  source: 'chainlink' | 'sources' | 'table'
  contract: Address | null
  rates: Record<string, Rate>
}

const table = (): Record<string, Rate> =>
  Object.fromEntries(
    Object.entries(PER_USD).map(([code, perUsd]) => [code, { perUsd, asOf: null }]),
  )

let book: RateBook = { source: 'table', contract: null, rates: table() }
let readAt = 0

/** The two public sources the CRE workflow reads, cross-checked the same way (apps/rates). */
const SOURCE_A = 'https://open.er-api.com/v6/latest/USD'
const SOURCE_B =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'
const CODES = ['NGN', 'KES', 'EUR', 'GBP', 'MXN'] as const
/** Two sources more than 2% apart on a currency means one is wrong: keep the last rate for it. */
const MAX_SPREAD = 0.02

async function fromSources(): Promise<RateBook> {
  const get = async (url: string) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!response.ok) throw new Error(`${url} answered ${response.status}`)
    return (await response.json()) as {
      rates?: Record<string, number>
      usd?: Record<string, number>
    }
  }
  const [a, b] = await Promise.allSettled([get(SOURCE_A), get(SOURCE_B)])
  const first = a.status === 'fulfilled' ? (a.value.rates ?? {}) : {}
  const second = b.status === 'fulfilled' ? (b.value.usd ?? {}) : {}
  const asOf = new Date().toISOString()
  const rates = { ...book.rates }
  let any = false
  for (const code of CODES) {
    const x = first[code]
    const y = second[code.toLowerCase()]
    const good = (v: number | undefined): v is number => typeof v === 'number' && v > 0
    const value =
      good(x) && good(y)
        ? Math.abs(x - y) / Math.min(x, y) <= MAX_SPREAD
          ? (x + y) / 2
          : 0
        : good(x)
          ? x
          : good(y)
            ? y
            : 0
    if (!(value > 0)) continue
    rates[code] = { perUsd: value, asOf }
    PER_USD[code] = value
    any = true
  }
  if (!any) throw new Error('neither rate source answered')
  return { source: 'sources', contract: null, rates }
}

export async function rateBook(): Promise<RateBook> {
  if (kit.id === 'tempo') {
    if (Date.now() - readAt < 5 * 60_000) return book
    readAt = Date.now()
    try {
      book = await fromSources()
    } catch (error) {
      console.warn(
        '[rates] sources unreadable; keeping the last rates:',
        error instanceof Error ? error.message : error,
      )
    }
    return book
  }
  const address = config.KOVA_RATES_ADDRESS as Address | undefined
  if (!address || Date.now() - readAt < 60_000) return book
  readAt = Date.now()
  try {
    const [codes, values, asOf] = await publicClient.readContract({
      address,
      abi: kovaRatesAbi,
      functionName: 'allRates',
    })
    const rates = { ...book.rates }
    codes.forEach((code, i) => {
      const currency = hexToString(code, { size: 3 })
      const perUsd = Number(values[i]) / 1e8
      if (!(perUsd > 0)) return
      rates[currency] = { perUsd, asOf: new Date(Number(asOf[i]) * 1000).toISOString() }
      // Kova Travel prices fares with these too.
      PER_USD[currency] = perUsd
    })
    book = { source: 'chainlink', contract: address, rates }
  } catch (error) {
    console.warn(
      '[rates] KovaRates unreadable; keeping the last rates:',
      error instanceof Error ? error.message.split('\n')[0] : error,
    )
  }
  return book
}

export function serializeRates(current: RateBook) {
  return {
    object: 'rates',
    source: current.source,
    chain: network.name,
    contract: current.contract,
    contract_url: current.contract ? kit.explorerAddressUrl(current.contract) : null,
    rates: Object.fromEntries(
      Object.entries(current.rates).map(([code, r]) => [
        code,
        { per_usd: r.perUsd, as_of: r.asOf },
      ]),
    ),
  }
}
