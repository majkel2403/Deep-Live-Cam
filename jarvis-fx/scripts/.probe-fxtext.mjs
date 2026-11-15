import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let pw; try { pw = require('playwright') } catch { pw = require('/opt/node-tools/node_modules/playwright') }
const [,, url, js, wait='4000'] = process.argv
const b = await pw.chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => localStorage.setItem('jx-settings', JSON.stringify({ state: { bootSeen: true, soundOn: false }, version: 1 })))
const p = await ctx.newPage()
p.on('console', m => console.log('console', m.type(), m.text().slice(0, 300)))
p.on('pageerror', e => console.log('pageerror', e.message))
await p.goto(url, { waitUntil: 'load' })
await p.waitForTimeout(Number(wait))
console.log(JSON.stringify(await p.evaluate(js), null, 1))
await b.close()
