import { KovaError } from './errors.js'

/**
 * Per-process speed bumps for public routes: a few hundred requests a minute from one place is a
 * script, not a person. Counts live in memory, so a restart forgets them; that is fine for a
 * bump, and nothing that protects money depends on it.
 */
const hits = new Map<string, number[]>()

export function limit(key: string, max: number, windowMs: number, message: string) {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) throw new KovaError('rate_limited', message)
  hits.set(key, [...recent, now])
}

export const clientIp = (c: { req: { header: (name: string) => string | undefined } }) =>
  c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
