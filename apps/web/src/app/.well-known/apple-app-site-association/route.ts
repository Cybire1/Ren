/**
 * Tells iOS which apps this domain vouches for:
 * - webcredentials: Kova Pay may create and use passkeys for this domain. On Monad the wallet
 *   is a Mera passkey, so this file is what makes a wallet possible at all.
 * - applinks: scanning a shop's code (a /pay/… link) or opening a stall (/s/…) with the iPhone
 *   camera opens Kova Pay straight at it, when it's installed.
 *
 * Served as JSON with no redirect, as Apple requires.
 */
export const dynamic = 'force-static'

const team = process.env.APPLE_TEAM_ID ?? '5N8DU2A9WH'
const bundles = (process.env.KOVA_IOS_BUNDLE_IDS ?? 'xyz.kova.pay.monad').split(',').map((b) => b.trim()).filter(Boolean)
const apps = bundles.map((bundle) => `${team}.${bundle}`)

export function GET() {
  return Response.json({
    webcredentials: { apps },
    applinks: {
      details: [{ appIDs: apps, components: [{ '/': '/pay/*' }, { '/': '/s/*' }] }],
    },
  })
}
