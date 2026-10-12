import { type Address, isAddress } from 'viem'
import { webUrl } from './config'
import type { DisplayCurrency } from './money'
import { displayCurrencies } from './money'

/**
 * What a scanned code or opened link means.
 *
 * - A charge: a terminal's QR (`https://…/pay/<id>`) or `kova://pay/<id>`.
 * - A stall: its table poster or shared link (`https://…/s/<slug>`), or `kova://s/<slug>`. A
 *   table's own code adds `?table=3`, so the order is brought to that table.
 * - A person: `https://…/to/<address>?name=Maya&cur=EUR&amount=24.00&note=Dinner`, from
 *   someone's Receive or Request screen, in the app or on the web. The older `kova://to/…` form and
 *   a bare address work too.
 */
export type Scanned =
  | { kind: 'charge'; id: string }
  | { kind: 'stall'; slug: string; table?: string }
  | { kind: 'pair'; code: string }
  | {
      kind: 'person'
      address: Address
      name?: string
      currency?: DisplayCurrency
      amount?: string
      note?: string
    }

export function parseScanned(text: string): Scanned | null {
  const value = text.trim()
  const pairing = /^kova:\/\/pair\/([0-9A-Za-z-]{4,12})$/.exec(value)
  if (pairing?.[1]) return { kind: 'pair', code: pairing[1] }
  const charge =
    /\/pay\/([A-Za-z0-9_]+)/.exec(value) ?? /^kova:\/\/pay\/([A-Za-z0-9_]+)/.exec(value)
  if (charge?.[1]) return { kind: 'charge', id: charge[1] }
  const stall = /^(?:https?:\/\/[^/]+|kova:\/)\/s\/([a-z0-9-]{1,64})\/?(?:\?([^#]*))?(?:#.*)?$/.exec(value)
  if (stall?.[1]) {
    const table = tableFrom(new URLSearchParams(stall[2] ?? '').get('table'))
    return { kind: 'stall', slug: stall[1], ...(table ? { table } : {}) }
  }

  if (isAddress(value)) return { kind: 'person', address: value }

  const person = /^(?:kova:\/\/|https?:\/\/[^/]+\/)to\/(0x[0-9a-fA-F]{40})(?:\?(.*))?$/.exec(value)
  if (person?.[1] && isAddress(person[1])) {
    const params = new URLSearchParams(person[2] ?? '')
    const cur = params.get('cur')
    const amount = params.get('amount')
    return {
      kind: 'person',
      address: person[1],
      name: params.get('name') ?? undefined,
      currency:
        cur && (displayCurrencies as readonly string[]).includes(cur)
          ? (cur as DisplayCurrency)
          : undefined,
      amount: amount && /^\d+(\.\d{1,2})?$/.test(amount) ? amount : undefined,
      note: params.get('note') ?? undefined,
    }
  }
  return null
}

/** A table from a stall's table code, as Kova accepts it ("3", "Patio 2"), or undefined. */
export function tableFrom(value: string | null | undefined): string | undefined {
  const table = value?.trim()
  return table && /^[\w -]{1,12}$/.test(table) ? table : undefined
}

/**
 * A link anyone can pay you with. It's an https link, so any phone camera opens it: in Ren when
 * it's installed (the site vouches for the app), on the web when it isn't.
 */
export function personLink(p: {
  address: Address
  name: string
  currency: DisplayCurrency
  amount?: string
  note?: string
}) {
  const params = new URLSearchParams({ name: p.name, cur: p.currency })
  if (p.amount) params.set('amount', p.amount)
  if (p.note) params.set('note', p.note)
  return `${webUrl}/to/${p.address}?${params.toString()}`
}
