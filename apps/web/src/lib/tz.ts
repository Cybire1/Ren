import 'server-only'
import { cookies } from 'next/headers'

/**
 * The viewer's time zone, which decides what "today" and "noon" mean on the dashboard. The
 * browser writes it into this cookie (see Shell); until it has, the API counts in UTC.
 */
export const TZ_COOKIE = 'kova_tz'

export function validZone(tz: string | null | undefined) {
  if (!tz || tz.length > 64) return undefined
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return undefined
  }
}

export async function timeZone() {
  return validZone((await cookies()).get(TZ_COOKIE)?.value)
}

/** `?tz=…` for /v1/summary, or nothing. */
export const tzQuery = (tz: string | undefined) => (tz ? `?tz=${encodeURIComponent(tz)}` : '')
