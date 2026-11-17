#!/usr/bin/env node
/**
 * Gallery poster renderer.
 *
 *   node scripts/posters.mjs [--base http://127.0.0.1:5173] [--only id1,id2] [--out public/posters]
 *                            [--webgl-wait 7000] [--wait 3500] [--quality 78]
 *
 * For every effect folder with a meta.ts it opens ?fx=<id> at 640x400 (DPR 1), waits for the effect to
 * draw (WebGL effects get --webgl-wait ms, the rest --wait ms) and saves a JPEG. Gallery cards show these
 * stills as a cover while the live effect is not running (offscreen, no WebGL slot, still loading).
 *
 * Same Chromium flags as scripts/shoot.mjs (SwiftShader software WebGL). Run it again after visual changes
 * to an effect, or after the whole set changes. Effects are rendered one at a time to keep the GPU quiet.
 * Output: one JSON line per effect { id, file, bytes, webgl, errors }. Exit code 1 if any effect logged errors.
 */
import { readdirSync, readFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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
const opt = { base: 'http://127.0.0.1:5173', out: '', only: '', 'webgl-wait': 7000, wait: 3500, quality: 78 }
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a.startsWith('--')) opt[a.slice(2)] = args[++i]
  else {
    console.error(`unexpected argument: ${a}`)
    process.exit(2)
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const effectsDir = path.join(root, 'src', 'fx', 'effects')
const outDir = opt.out ? path.resolve(opt.out) : path.join(root, 'public', 'posters')
const only = opt.only ? new Set(opt.only.split(',').map((s) => s.trim()).filter(Boolean)) : null

const ids = readdirSync(effectsDir)
  .filter((d) => existsSync(path.join(effectsDir, d, 'meta.ts')))
  .filter((d) => !only || only.has(d))
  .sort()

if (only) {
  const missing = [...only].filter((id) => !ids.includes(id))
  if (missing.length) console.error(`unknown effect id(s): ${missing.join(', ')}`)
}
if (!ids.length) {
  console.error('no effects to render')
  process.exit(2)
}

mkdirSync(outDir, { recursive: true })
const browser = await playwright.chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
})

// Fixed, neutral state so every poster is captured with the same accent and full motion.
const SETTINGS = { bootSeen: true, soundOn: false, hue: 188, motion: 'full', quality: 'med', scanlines: false, volume: 0.35 }

let failed = false
for (const id of ids) {
  const webgl = /webgl:\s*true/.test(readFileSync(path.join(effectsDir, id, 'meta.ts'), 'utf8'))
  const ctx = await browser.newContext({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 })
  await ctx.addInitScript((st) => {
    localStorage.setItem('jx-settings', JSON.stringify({ state: st, version: 1 }))
  }, SETTINGS)
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 300))
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e.message).slice(0, 300)}`))
  const file = path.join(outDir, `${id}.jpg`)
  const t0 = Date.now()
  try {
    await page.goto(`${opt.base}/?fx=${encodeURIComponent(id)}`, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(Number(webgl ? opt['webgl-wait'] : opt.wait))
    await page.screenshot({ path: file, type: 'jpeg', quality: Number(opt.quality), timeout: 90000 })
  } catch (e) {
    errors.push(`navigation: ${String(e.message).slice(0, 300)}`)
  }
  // Noise that is not ours (same filter as shoot.mjs).
  const real = errors.filter((e) => !/favicon|DevTools|GPU stall|WebGL-|Automatic fallback to software WebGL|AudioContext was not allowed/i.test(e))
  const bytes = existsSync(file) ? statSync(file).size : 0
  if (real.length || bytes < 4000) failed = true
  console.log(JSON.stringify({ id, file: path.relative(root, file), bytes, webgl, ms: Date.now() - t0, errors: real }))
  await ctx.close()
}
await browser.close()
process.exit(failed ? 1 : 0)
