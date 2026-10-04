// Screenshots a mykova.app page at an iPhone 16 viewport (393x852 @3x), for the films.
//   node scripts/capture/page.mjs <url> <out.png>
import puppeteer from 'puppeteer-core'

const [url, out] = process.argv.slice(2)
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
await page.goto(url, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))
console.log(page.url(), '|', (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 500))
await page.screenshot({ path: out })
await browser.close()
