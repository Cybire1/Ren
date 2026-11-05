/**
 * Ren's wallet is dark, always: raspberry on black. The root layout's script makes the wallet's
 * pages dark before the first paint, and the wallet keeps them so while it's open
 * (components/wallet/theme.tsx). Pages outside the wallet (pay pages, stalls, the site) stay light.
 */

/** The browser's and the phone's top bar, in the page's colour. */
export const BAR = { light: '#F6F1F0', dark: '#000000' }

const WALLET_PATH = /^\/wallet(\/|$)/

/** In the wallet: dark. */
export function applyTheme() {
  setDark(true)
}

/** Leaving the wallet: the rest of the site is light. */
export function clearTheme() {
  setDark(false)
}

function setDark(dark: boolean) {
  const root = document.documentElement
  if (dark) root.dataset.theme = 'dark'
  else delete root.dataset.theme
  for (const meta of document.querySelectorAll('meta[name="theme-color"]'))
    meta.setAttribute('content', dark ? BAR.dark : BAR.light)
}

/** The same, as the inline script the root layout runs in <head> before anything paints. */
export const THEME_SCRIPT = `(function(){try{if(!${WALLET_PATH}.test(location.pathname))return;document.documentElement.dataset.theme='dark';var bar=function(){document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content','${BAR.dark}')})};bar();document.addEventListener('DOMContentLoaded',bar)}catch(e){}})()`
