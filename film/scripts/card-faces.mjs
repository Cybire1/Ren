// Renders the six Kova Card designs (src/cards/markup.json) into the app: one 2x PNG per design
// (all landscape) with the holder's name left blank, plus where the name goes (apps/mobile/assets/cards).
// Run from film/: node scripts/card-faces.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

// Every card in the app is landscape: the three portrait designs use their landscape layouts.
const markup = { ...JSON.parse(readFileSync('src/cards/markup.json', 'utf8')), ...JSON.parse(readFileSync('src/cards/landscape.json', 'utf8')) }
const out = resolve('../apps/mobile/assets/cards')
mkdirSync(out, { recursive: true })
const font = (family, file, weight) => `@font-face{font-family:${family};src:url(file://${resolve('public/fonts', file)});font-weight:${weight}}`
const fonts = [font('Manrope', 'Manrope_500Medium.ttf', 500), font('Manrope', 'Manrope_600SemiBold.ttf', 600), font('Manrope', 'Manrope_700Bold.ttf', 700), font('Manrope', 'Manrope_800ExtraBold.ttf', 800), font('Caveat', 'Caveat-Bold.ttf', 700)].join('')
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--allow-file-access-from-files'] })
const page = await browser.newPage()
const meta = {}
for (const id of ['main', 'coral', 'metal', 'drop', 'night', 'open']) {
  const { w, h, html } = markup[id]
  const body = html.replace(/\{\{art\}\}([\w.-]+)/g, (_, f) => `file://${resolve('public/art', f)}`)
  writeFileSync(`/tmp/claude-501/card-${id}.html`, `<html><head><style>${fonts}html,body{margin:0;background:transparent}.brushed{background-color:#101f22;background-image:repeating-linear-gradient(90deg,rgba(255,255,255,0.025) 0 1px,transparent 1px 3px)}</style></head><body>${body}</body></html>`)
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 })
  await page.goto(`file:///tmp/claude-501/card-${id}.html`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  // Find the holder's name, note its box and type, then blank it for the app to draw live.
  const slot = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div, span, text, p')].find((e) => e.childElementCount === 0 && /ADA LAINE/i.test(e.textContent ?? ''))
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    const slot = { x: r.left, y: r.top, w: r.width, h: r.height, size: parseFloat(cs.fontSize), weight: cs.fontWeight, color: cs.color, letterSpacing: parseFloat(cs.letterSpacing) || 0, align: cs.textAlign }
    el.style.visibility = 'hidden'
    return slot
  })
  await page.screenshot({ path: `${out}/${id}.png`, omitBackground: true })
  meta[id] = { w, h, name: slot }
  console.log(id, w, 'x', h, slot ? `name at ${Math.round(slot.x)},${Math.round(slot.y)} ${slot.size}px` : 'no name')
}
writeFileSync(`${out}/faces.json`, `${JSON.stringify(meta, null, 2)}\n`)
await browser.close()
