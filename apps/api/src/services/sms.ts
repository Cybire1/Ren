import { config } from '../config.js'

/**
 * Text messages through Africa's Talking: USSD receipts and phone codes. With the username
 * "sandbox" they arrive in Africa's Talking's simulator. Without keys, they are logged instead,
 * so development never needs a phone.
 */

export const smsReady = () => Boolean(config.AT_USERNAME && config.AT_API_KEY)

export async function sendSms(to: string, message: string): Promise<void> {
  if (!config.AT_USERNAME || !config.AT_API_KEY) {
    console.log(`[sms] to ${to}: ${message}`)
    return
  }
  const host =
    config.AT_USERNAME === 'sandbox' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com'
  const body = new URLSearchParams({ username: config.AT_USERNAME, to, message })
  if (config.AT_SENDER_ID) body.set('from', config.AT_SENDER_ID)
  const response = await fetch(`https://${host}/version1/messaging`, {
    method: 'POST',
    headers: {
      apiKey: config.AT_API_KEY,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok)
    throw new Error(
      `Africa's Talking SMS: ${response.status} ${(await response.text()).slice(0, 200)}`,
    )
}

/** Sends without waiting or failing: a receipt that doesn't arrive must never undo a payment. */
export function sendSmsLater(to: string, message: string): void {
  sendSms(to, message).catch((error) =>
    console.error('[sms] not sent', error instanceof Error ? error.message : error),
  )
}
