#!/usr/bin/env node
/**
 * Keyboard smoke test (no accessibility library needed): drives the app with key presses only.
 *
 *   node scripts/smoke-keyboard.mjs [--base http://127.0.0.1:5173]
 *
 * Checks: Tab reaches the view navigation, the focus ring is visible on plain controls (2 px outline),
 * Alt+1…6 switches views, Ctrl+K opens and Escape closes the command palette, and a gallery card opens
 * from the keyboard and closes with Escape. Prints one JSON line per check; exit 1 if any check fails.
 * Needs Playwright (see README, "Zrzuty ekranu"): npm i -D playwright, or PLAYWRIGHT_MODULE=<path>.
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let playwright
try {
  playwright = require('playwright')
} catch {
  if (!process.env.PLAYWRIGHT_MODULE) {
    console.error('Playwright not found. Install: npm i -D playwright && npx playwright install chromium (or set PLAYWRIGHT_MODULE).')
    process.exit(2)
  }
  playwright = require(process.env.PLAYWRIGHT_MODULE)
}

const baseArg = process.argv.indexOf('--base')
const base = baseArg > 0 ? process.argv[baseArg + 1] : 'http://127.0.0.1:5173'

const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
await ctx.addInitScript(() => {
  if (!sessionStorage.getItem('jx-smoke')) {
    sessionStorage.setItem('jx-smoke', '1')
    localStorage.setItem('jx-settings', JSON.stringify({ state: { bootSeen: true, soundOn: false, quality: 'low', motion: 'reduced' }, version: 1 }))
  }
})
const page = await ctx.newPage()
const results = []
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail })

await page.goto(`${base}/#/bridge`, { waitUntil: 'load' })
await page.waitForTimeout(1500)

// 1. Tab reaches the view navigation
let reached = false
for (let i = 0; i < 40 && !reached; i++) {
  await page.keyboard.press('Tab')
  reached = await page.evaluate(() => Boolean(document.activeElement?.closest('nav[aria-label="Widoki"]')))
}
check('tab-reaches-nav', reached)

// 2. focus ring on a plain control (the gallery search box is a native input inside a label)
await page.goto(`${base}/#/gallery`, { waitUntil: 'load' })
await page.waitForTimeout(1200)
// the gallery mounts lazily: wait for its search box (cold starts can exceed the 30 s default)
await page.waitForSelector('input[aria-label="Szukaj efektu"]', { timeout: 90000 })
await page.focus('input[aria-label="Szukaj efektu"]')
await page.keyboard.press('Shift+Tab')
await page.keyboard.press('Tab')
const ring = await page.evaluate(() => {
  const el = document.activeElement
  return el ? { tag: el.tagName, outline: getComputedStyle(el).outlineWidth, style: getComputedStyle(el).outlineStyle } : null
})
check('focus-ring-2px', ring && ring.outline === '2px' && ring.style === 'solid', JSON.stringify(ring))

// 3. Alt+digit switches views
for (const [key, hash] of [['3', 'agents'], ['5', 'arsenal'], ['1', 'bridge']]) {
  await page.keyboard.press(`Alt+${key}`)
  await page.waitForTimeout(400)
  const current = await page.evaluate(() => location.hash)
  check(`alt-${key}-to-${hash}`, current.startsWith(`#/${hash}`), current)
}

// 4. Command palette opens with Ctrl+K and closes with Escape
await page.keyboard.press('Control+k')
await page.waitForTimeout(400)
const opened = await page.evaluate(() => Boolean(document.querySelector('[role="dialog"] [cmdk-root], [role="dialog"] input')))
check('ctrl-k-opens-palette', opened)
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
const closed = await page.evaluate(() => !document.querySelector('[role="dialog"] [cmdk-root]'))
check('escape-closes-palette', closed)

// 5. Gallery card opens by keyboard and Escape returns to the grid
await page.goto(`${base}/#/gallery`, { waitUntil: 'load' })
await page.waitForTimeout(1200)
let cardFocused = false
for (let i = 0; i < 30 && !cardFocused; i++) {
  await page.keyboard.press('Tab')
  cardFocused = await page.evaluate(() => Boolean(document.activeElement?.matches('button.jx-aug')))
}
check('card-reachable-by-tab', cardFocused)
if (cardFocused) {
  await page.keyboard.press('Enter')
  await page.waitForTimeout(800)
  const inStage = await page.evaluate(() => /#\/gallery\/[^/]+/.test(location.hash))
  check('enter-opens-stage', inStage, await page.evaluate(() => location.hash))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const back = await page.evaluate(() => location.hash === '#/gallery')
  check('escape-returns-to-grid', back, await page.evaluate(() => location.hash))
}

await browser.close()
const failed = results.filter((r) => !r.ok)
for (const r of results) console.log(JSON.stringify(r))
console.log(failed.length ? `${failed.length} check(s) failed` : `all ${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
