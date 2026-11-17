#!/usr/bin/env node
/**
 * Screenshot + console-error probe (dev tool used during development and CI smoke tests).
 *
 *   node scripts/shoot.mjs [--base http://127.0.0.1:5173] [--wait 2500] [--out shots] [--w 1440 --h 900] <target>...
 *     [--hue 30] [--motion reduced|full] [--quality low|med|high] [--dsf 2] [--jpeg 85]
 *     [--click "<playwright selector>"]   (clicked after load, e.g. --click "text=Sceny 3D"; repeatable)
 *     [--suffix _orange]                   (appended to the output file name)
 *
 * target:  fx:<id>        → ?fx=<id> (single effect, full screen)
 *          view:<name>    → #/<name>  (bridge | gallery | agents | sound | arsenal | boot)
 *          view:boot-overlay → the first-run boot sequence over the bridge (navigator.webdriver is cleared)
 *          fx:all         → every effect in the registry (reads src/fx/effects/*)
 *          <anything else>→ treated as a path/hash appended to base
 *
 * Prints one JSON line per target: { target, file, errors: [...], warnings: n }.
 * Exit code 1 if any page logged console errors or page errors.
 */
import { readdirSync, mkdirSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
let playwright
try {
  playwright = require('playwright')
} catch {
  // Not installed in this checkout: install it (npm i -D playwright && npx playwright install chromium)
  // or point PLAYWRIGHT_MODULE at an existing playwright package directory.
  if (!process.env.PLAYWRIGHT_MODULE) {
    console.error('Playwright not found. Install: npm i -D playwright && npx playwright install chromium (or set PLAYWRIGHT_MODULE).')
    process.exit(2)
  }
  playwright = require(process.env.PLAYWRIGHT_MODULE)
}

const args = process.argv.slice(2)
const opt = { base: 'http://127.0.0.1:5173', wait: 2500, out: 'shots', w: 1440, h: 900, dsf: 1, suffix: '' }
const clicks = []
const targets = []
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--click') clicks.push(args[++i])
  else if (a.startsWith('--')) opt[a.slice(2)] = args[++i]
  else targets.push(a)
}
opt.wait = Number(opt.wait)
if (!targets.length) {
  console.error('usage: node scripts/shoot.mjs [--base URL] [--wait ms] fx:<id>|fx:all|view:<name> …')
  process.exit(2)
}

const root = path.dirname(new URL(import.meta.url).pathname)
const expanded = targets.flatMap((t) => {
  if (t === 'fx:all') {
    const dir = path.join(root, '..', 'src', 'fx', 'effects')
    return readdirSync(dir).filter((d) => existsSync(path.join(dir, d, 'meta.ts'))).map((d) => `fx:${d}`)
  }
  return [t]
})

mkdirSync(opt.out, { recursive: true })
const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
let failed = false
for (const t of expanded) {
  const ctx = await browser.newContext({ viewport: { width: Number(opt.w), height: Number(opt.h) }, deviceScaleFactor: Number(opt.dsf) })
  // persisted settings: skip the boot overlay (unless view:boot-overlay), sound off, optional hue/motion/quality
  const state = { bootSeen: t !== 'view:boot-overlay', soundOn: false }
  if (opt.hue !== undefined) state.hue = Number(opt.hue)
  if (opt.motion) state.motion = opt.motion
  if (opt.quality) state.quality = opt.quality
  await ctx.addInitScript((st) => {
    if (!sessionStorage.getItem('jx-shoot-init')) {
      sessionStorage.setItem('jx-shoot-init', '1')
      localStorage.setItem('jx-settings', JSON.stringify({ state: st, version: 1 }))
    }
  }, state)
  // App skips the boot overlay when navigator.webdriver is set (automation); the overlay target clears it.
  if (t === 'view:boot-overlay') await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }))
  const page = await ctx.newPage()
  const errors = []
  let warnings = 0
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 400))
    if (m.type() === 'warning') warnings++
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e.message).slice(0, 400)}`))
  let url
  if (t.startsWith('fx:')) url = `${opt.base}/?fx=${encodeURIComponent(t.slice(3))}`
  // the boot overlay is shown on top of any view while bootSeen is false: capture it over the bridge
  else if (t === 'view:boot-overlay') url = `${opt.base}/#/bridge`
  else if (t.startsWith('view:')) url = `${opt.base}/#/${t.slice(5)}`
  else url = `${opt.base}${t.startsWith('/') || t.startsWith('#') || t.startsWith('?') ? '' : '/'}${t}`
  const ext = opt.jpeg ? 'jpg' : 'png'
  const file = path.join(opt.out, `${t.replace(/[^a-z0-9_-]+/gi, '_')}${opt.suffix}.${ext}`)
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 })
    for (const sel of clicks) {
      await page.waitForTimeout(800)
      await page.click(sel, { timeout: 15000 })
    }
    await page.waitForTimeout(opt.wait)
    await page.screenshot({ path: file, timeout: 90000, ...(opt.jpeg ? { type: 'jpeg', quality: Number(opt.jpeg) } : {}) })
  } catch (e) {
    errors.push(`navigation: ${e.message.slice(0, 300)}`)
  }
  // ignore noise that is not ours
  const real = errors.filter((e) => !/favicon|DevTools|GPU stall|WebGL-|Automatic fallback to software WebGL|AudioContext was not allowed/i.test(e))
  if (real.length) failed = true
  console.log(JSON.stringify({ target: t, file, errors: real, warnings }))
  await ctx.close()
}
await browser.close()
process.exit(failed ? 1 : 0)
