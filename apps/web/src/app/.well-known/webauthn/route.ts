/**
 * WebAuthn related origins: the other sites that may use this site's passkeys. A Ren wallet's
 * passkey belongs to the site's first domain (NEXT_PUBLIC_KOVA_PASSKEY_DOMAIN); listing Ren's own
 * domain here lets the same passkey, and so the same wallet, open there too (Chrome and Safari).
 */
export const dynamic = 'force-static'

const origins = (process.env.KOVA_PASSKEY_ORIGINS ?? 'https://renpay.app,https://www.renpay.app')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

export function GET() {
  return Response.json({ origins })
}
