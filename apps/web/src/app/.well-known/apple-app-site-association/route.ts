/**
 * Tells iOS which apps this domain vouches for:
 * - webcredentials: Ren Pay may create and use passkeys for this domain. The wallet is a
 *   passkey, so this file is what makes a wallet possible at all. Both apps are listed (Ren on
 *   Tempo, xyz.kova.pay, and Ren on Monad), so one passkey opens the same wallet in either.
 * - applinks: scanning a shop's code (a /pay/… link), opening a stall (/s/…) or someone's request
 *   (/to/…) with the iPhone camera opens Ren Pay straight at it, when it's installed.
 *
 * Served as JSON with no redirect, as Apple requires.
 */
export const dynamic = 'force-static'

// Ren's Apple team (R38YN743Q6), and the team earlier builds were signed with, so both keep passkeys.
const list = (value: string) =>
  value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
const teams = list(process.env.APPLE_TEAM_ID ?? 'R38YN743Q6,5N8DU2A9WH')
const bundles = list(process.env.KOVA_IOS_BUNDLE_IDS ?? 'xyz.kova.pay,xyz.kova.pay.monad')
const apps = teams.flatMap((team) => bundles.map((bundle) => `${team}.${bundle}`))

export function GET() {
  return Response.json({
    webcredentials: { apps },
    applinks: {
      details: [
        { appIDs: apps, components: [{ '/': '/pay/*' }, { '/': '/s/*' }, { '/': '/to/*' }] },
      ],
    },
  })
}
