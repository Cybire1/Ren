// A customer's bag at a Kova shop link, filled in, for the films (no payment).
//   node scripts/capture/bag.mjs <name> <currency> <slug> "<item>*<qty>;..." "<note>" <out.png>
import puppeteer from 'puppeteer-core'

const [name, currency, slug, order, note, out] = process.argv.slice(2)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
await page.goto(`https://mykova.app/s/${slug}`, { waitUntil: 'networkidle0' })
await wait(1000)
if (currency !== 'USD') {
  const [pick] = await page.$$(`xpath/.//*[self::button or self::a][contains(., "${currency}")]`)
  if (pick) await pick.evaluate((n) => n.click())
  await wait(800)
}
for (const part of order.split(';')) {
  const [item, qty = '1'] = part.split('*')
  for (let i = 0; i < Number(qty); i++) {
    await (await page.$(`button[aria-label="Add ${item} to your bag"]`)).evaluate((n) => n.click())
    await wait(700)
  }
}
await (await page.$('button[aria-label^="Bag"]')).evaluate((n) => n.click())
await wait(900)
const inputs = await page.$$('input')
await inputs.at(-2).type(name)
await inputs.at(-1).type(note)
await wait(500)
await page.screenshot({ path: out })
console.log((await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(-300))
await browser.close()
