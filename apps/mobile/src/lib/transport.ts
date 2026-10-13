import { createTransport, type Transport } from 'viem'

/**
 * Some networks drop connections to Tempo's endpoints while the rest of the internet works (an
 * iPhone on one couldn't reach Tempo's RPC or the private zone, though Ren's servers could). So the
 * app goes straight to them, and when a call can't get through, it goes through Ren's servers,
 * which pass the same call on, for the next few minutes before trying direct again. Only a call
 * that never arrived switches over: an answer, even a refusal, comes back as it is.
 */
const downUntil = new Map<string, number>()
const AWAY_MS = 5 * 60_000

// By name: viem/tempo's transports throw from their own copy of viem's errors in the app's bundle.
const unreachable = (error: unknown) => {
  const e = error as { name?: string; status?: number } | null
  return e?.name === 'TimeoutError' || (e?.name === 'HttpRequestError' && (e.status === undefined || e.status >= 500))
}

export function directOrThroughRen(name: string, direct: Transport, throughRen: Transport): Transport {
  return (config) => {
    const directly = direct(config)
    const viaRen = throughRen(config)
    return createTransport({
      key: name,
      name,
      type: name,
      retryCount: 0,
      async request({ method, params }, options) {
        if ((downUntil.get(name) ?? 0) > Date.now()) return viaRen.request({ method, params }, options) as never
        try {
          return (await directly.request({ method, params }, options)) as never
        } catch (error) {
          if (!unreachable(error)) throw error
          if (typeof __DEV__ !== 'undefined' && __DEV__) console.log(`[transport] ${name} unreachable, going through Ren`)
          downUntil.set(name, Date.now() + AWAY_MS)
          return viaRen.request({ method, params }, options) as never
        }
      },
    })
  }
}
