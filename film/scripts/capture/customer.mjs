// One customer buying from a Kova shop link, for the films: a passkey wallet at mykova.app, a
// wait for its dollars, then the shop, the bag, and paying with the Kova wallet. Screens are
// captured at iPhone 16 resolution (393x852 @3x).
//   node scripts/capture/customer.mjs <name> <currency> <shop slug> "<item>*<qty>;..." "<note>" <out dir>
// Prints the wallet address as soon as it exists ("WALLET 0x…"), then waits to be funded.
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const [name, currency, slug, order, note, out] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const base = 'https://mykova.app'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)))
const cdp = await page.createCDPSession()
await cdp.send('WebAuthn.enable')
await cdp.send('WebAuthn.addVirtualAuthenticator', {
  options: { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true },
})
const click = async (selector) => {
  const el = await page.$(selector)
  if (!el) throw new Error(`nothing at ${selector}`)
  await el.evaluate((n) => n.click())
  await wait(900)
}
const clickText = async (text) => {
  const [el] = await page.$$(`xpath/.//*[self::button or self::a][contains(., "${text}")]`)
  if (!el) throw new Error(`nothing says ${text}`)
  await el.evaluate((n) => n.click())
  await wait(1200)
}
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` })
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))

try {
  // A Kova wallet, made with a passkey.
  await page.goto(`${base}/wallet`, { waitUntil: 'networkidle0' })
  await wait(1000)
  await clickText('Create my wallet')
  await page.waitForSelector('#w-name')
  await page.type('#w-name', name)
  await clickText('Create with my passkey')
  await page.waitForSelector('.w-balance', { timeout: 30000 })
  const address = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const m = (localStorage.getItem(localStorage.key(i)) ?? '').match(/0x[0-9a-fA-F]{40}/)
      if (m) return m[0]
    }
  })
  console.log(`WALLET ${address}`)

  // Wait for dollars.
  for (let i = 0; i < 120; i++) {
    const balance = await page.evaluate(() => document.querySelector('.w-balance-amount')?.innerText.replace(/\s+/g, '') ?? '')
    if (!/^\$0\.00$|^\$0$/.test(balance) && /\$\d/.test(balance)) break
    await wait(5000)
    if (i % 6 === 5) await page.reload({ waitUntil: 'networkidle0' })
  }
  console.log('FUNDED', await page.evaluate(() => document.querySelector('.w-balance-amount')?.innerText.replace(/\s+/g, '')))

  // The shop, from its link.
  await page.goto(`${base}/s/${slug}`, { waitUntil: 'networkidle0' })
  await wait(1200)
  if (currency !== 'USD') {
    const [pick] = await page.$$(`xpath/.//*[self::button or self::option or self::a][contains(., "${currency}")]`)
    if (pick) await pick.evaluate((n) => n.click())
    await page.select('select', currency).catch(() => {})
    await wait(800)
  }
  await shot('1-shop')
  for (const part of order.split(';')) {
    const [item, qty = '1'] = part.split('*')
    for (let i = 0; i < Number(qty); i++) await click(`button[aria-label="Add ${item} to your bag"]`)
  }
  await click('button[aria-label^="Bag"]')
  const inputs = await page.$$('input')
  await inputs.at(-2).type(name)
  await inputs.at(-1).type(note)
  await wait(400)
  await shot('2-bag')
  await clickText('Pay $')
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {})
  await wait(1500)
  await shot('3-pay')
  console.log('PAY PAGE', page.url(), (await text()).slice(0, 200))
  await clickText('Pay with my Kova wallet')
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {})
  await wait(2000)
  await shot('4-wallet')
  console.log('WALLET PAY', page.url(), (await text()).slice(0, 300))
  // Pay with the Kova wallet: the passkey approves it.
  const started = Date.now()
  await clickText('Pay $')
  await page.waitForFunction(() => /paid/i.test(document.body.innerText), { timeout: 60000 })
  console.log(`PAID in ${((Date.now() - started) / 1000).toFixed(2)} s (tap to paid, from here)`)
  await wait(400)
  await shot('5-paid')
  await wait(2500)
  await shot('6-paid-settled')
  console.log('PAID PAGE', page.url(), (await text()).slice(0, 400))
} catch (error) {
  console.log('FAILED:', error.message)
  await shot('error')
} finally {
  await browser.close()
}
