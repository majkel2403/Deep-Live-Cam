#!/usr/bin/env node
/**
 * Text-size floor check: nothing under src/ may set text below 10 px (0.625 rem).
 *
 *   node scripts/check-text-floor.mjs            # exit 1 and a list of offenders if any
 *   node scripts/check-text-floor.mjs --fix      # raise every offender to 0.625rem in place
 *
 * Covers Tailwind arbitrary sizes (text-[0.5rem], text-[0.5rem]!, text-[9px]) and CSS font-size values.
 * Stage-only micro labels are not exempt: on phones the card branch and the stage branch share the same
 * layouts, so one floor keeps the HUD readable everywhere.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const FLOOR_REM = 0.625
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src')
const fix = process.argv.includes('--fix')

const RULES = [
  { re: /text-\[(\d*\.?\d+)rem\]/g, fmt: (v) => `text-[${v}rem]`, min: FLOOR_REM },
  { re: /font-size:\s*(\d*\.?\d+)rem/g, fmt: (v) => `font-size: ${v}rem`, min: FLOOR_REM },
  { re: /text-\[(\d*\.?\d+)px\]/g, fmt: (v) => `text-[${v}px]`, min: 10 },
]

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(tsx?|css)$/.test(name)) yield p
  }
}

let offenders = 0
for (const file of walk(root)) {
  const src = readFileSync(file, 'utf8')
  let out = ''
  let last = 0
  // collect every match with its position, then rewrite once per file
  const hits = []
  for (const rule of RULES) {
    for (const m of src.matchAll(rule.re)) {
      const v = Number(m[1])
      if (v < rule.min) hits.push({ index: m.index, text: m[0], rule })
    }
  }
  hits.sort((a, b) => a.index - b.index)
  for (const h of hits) {
    offenders++
    const line = src.slice(0, h.index).split('\n').length
    if (!fix) console.log(`${path.relative(process.cwd(), file)}:${line}: ${h.text}`)
    out += src.slice(last, h.index) + (fix ? h.rule.fmt(h.rule.min === 10 ? 10 : FLOOR_REM) : h.text)
    last = h.index + h.text.length
  }
  if (fix && hits.length) {
    out += src.slice(last)
    writeFileSync(file, out)
  }
}

if (offenders) {
  console.log(fix ? `raised ${offenders} value(s) to the 10 px floor` : `${offenders} value(s) below the 10 px floor`)
  process.exit(fix ? 0 : 1)
}
console.log('text floor: ok (no sizes below 10 px)')
