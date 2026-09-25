/**
 * Whether this page load is someone coming back from Google through Privy. Privy finishes that
 * sign-in from the address bar, so a page that lazy-loads Privy has to load it straight away.
 * Kept out of the Privy bundle so a page can check without downloading Privy.
 */
export function returningFromPrivy(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.has('privy_oauth_code') && params.has('privy_oauth_state')
}
