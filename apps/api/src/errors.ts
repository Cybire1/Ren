import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

export type ErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'idempotency_conflict'
  | 'policy_declined'
  | 'rate_limited'
  | 'chain_error'
  | 'internal'

const statusByCode: Record<ErrorCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  idempotency_conflict: 409,
  policy_declined: 422,
  rate_limited: 429,
  chain_error: 502,
  internal: 500,
}

/** An error that is safe to show a caller: every field here is returned in the response. */
export class KovaError extends Error {
  readonly code: ErrorCode
  readonly details: Record<string, unknown> | undefined

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'KovaError'
    this.code = code
    this.details = details
  }

  get status(): number {
    return statusByCode[this.code]
  }
}

export function notFound(kind: string, id: string): KovaError {
  return new KovaError('not_found', `No such ${kind}: ${id}`)
}

/** Every error response has the same shape: { error: { code, message, details? } }. */
export function errorHandler(error: unknown, c: Context): Response {
  if (error instanceof KovaError)
    return c.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      error.status as 400,
    )
  if (error instanceof HTTPException)
    return c.json(
      { error: { code: 'invalid_request', message: error.message } },
      error.status as 400,
    )
  console.error('unhandled error', error)
  return c.json({ error: { code: 'internal', message: 'Internal server error' } }, 500)
}
