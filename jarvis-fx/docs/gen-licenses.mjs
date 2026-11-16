#!/usr/bin/env node
/**
 * gen-licenses.mjs — regenerates the dependency tables in LICENSES.md from node_modules.
 *
 *   node docs/gen-licenses.mjs            # rewrite the block between the AUTO markers in LICENSES.md
 *   node docs/gen-licenses.mjs --print    # only print the markdown
 *
 * For every entry in package.json (dependencies + devDependencies) it reads the INSTALLED
 * node_modules/<name>/package.json and reports: real package name (npm aliases such as
 * "three-vanta" → three@0.134), installed version, the "license" field (or legacy "licenses"),
 * and whether a LICENSE file ships with the package. It also lists packages that src/ imports
 * directly but that are only present transitively. No dependencies; Node ≥ 18.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))

function readInstalled(name) {
  const dir = path.join(root, 'node_modules', name)
  const file = path.join(dir, 'package.json')
  if (!existsSync(file)) return null
  const p = JSON.parse(readFileSync(file, 'utf8'))
  let license = p.license
  if (license && typeof license === 'object') license = license.type
  if (!license && Array.isArray(p.licenses)) license = p.licenses.map((l) => l.type ?? l).join(' OR ')
  const licFile = readdirSync(dir).find((f) => /^(licen[cs]e|copying)/i.test(f))
  const hasFile = !!licFile
  // no SPDX id in package.json ("SEE LICENSE IN LICENSE" or missing) → identify the licence text itself
  if ((!license || /^SEE LICEN[CS]E IN/i.test(license)) && licFile) {
    const text = readFileSync(path.join(dir, licFile), 'utf8')
    if (/Permission is hereby granted, free of charge/i.test(text)) license = 'MIT (tekst w pliku LICENSE)'
    else if (/Apache License,?\s+Version 2\.0/i.test(text)) license = 'Apache-2.0 (tekst w pliku LICENSE)'
    else if (/Permission to use, copy, modify, and\/or distribute/i.test(text)) license = 'ISC (tekst w pliku LICENSE)'
  }
  const repo = typeof p.repository === 'string' ? p.repository : p.repository?.url
  const home = p.homepage || (repo ? repo.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://') : '')
  return { realName: p.name, version: p.version, license: license || 'UNKNOWN', hasFile, home }
}

function row(name, spec, kind) {
  const i = readInstalled(name)
  if (!i) return `| \`${name}\` | ${spec} | — | **nie zainstalowany** | — | ${kind} |`
  const alias = i.realName !== name ? ` (alias \`${i.realName}\`)` : ''
  const flag = /^(MIT|ISC|Apache-2\.0|BSD-[23]-Clause|0BSD|Zlib|Unlicense|CC0-1\.0|OFL-1\.1|BlueOak-1\.0\.0)( \(tekst w pliku LICENSE\))?$/.test(i.license) ? '' : ' ⚠'
  return `| \`${name}\`${alias} | ${i.version} | ${i.license}${flag} | ${i.hasFile ? 'tak' : 'nie'} | ${i.home ? `<${i.home}>` : '—'} | ${kind} |`
}

/** bare specifiers imported from src/ that are not declared in package.json */
function undeclaredImports() {
  const declared = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})])
  const found = new Set()
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx?|css)$/.test(f)) {
        const src = readFileSync(p, 'utf8')
        for (const m of src.matchAll(/(?:from\s+|import\s+|@import\s+)['"]([^'"./][^'"]*)['"]/g)) {
          const spec = m[1]
          if (spec.startsWith('@/') || spec.startsWith('node:')) continue
          const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
          if (!declared.has(name)) found.add(name)
        }
      }
    }
  }
  walk(path.join(root, 'src'))
  return [...found].sort()
}

const deps = Object.entries(pkg.dependencies ?? {}).sort(([a], [b]) => a.localeCompare(b))
const dev = Object.entries(pkg.devDependencies ?? {}).sort(([a], [b]) => a.localeCompare(b))
const head = '| Pakiet | Wersja | Licencja (pole `license`) | Plik LICENSE | Strona / repozytorium | Typ |\n|---|---|---|---|---|---|'

const counts = new Map()
for (const [n] of [...deps, ...dev]) {
  const l = readInstalled(n)?.license ?? 'nie zainstalowany'
  counts.set(l, (counts.get(l) ?? 0) + 1)
}
const summary = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([l, c]) => `${l} × ${c}`).join(' · ')
const transitive = undeclaredImports()

const md = [
  `Wygenerowano z \`node_modules\` (${deps.length} zależności + ${dev.length} deweloperskich). Podsumowanie: ${summary}.`,
  '⚠ = licencja spoza listy permisywnych SPDX – opis w sekcji „Zastrzeżenia”.',
  '',
  '### Zależności (`dependencies`)',
  '',
  head,
  ...deps.map(([n, s]) => row(n, s, 'runtime')),
  '',
  '### Zależności deweloperskie (`devDependencies`)',
  '',
  head,
  ...dev.map(([n, s]) => row(n, s, 'dev')),
  '',
  '### Importowane bezpośrednio, obecne tylko przechodnio',
  '',
  transitive.length
    ? [head, ...transitive.map((n) => row(n, '', 'przechodnia'))].join('\n')
    : '_Brak – każdy import z `src/` jest zadeklarowany w package.json._',
].join('\n')

if (process.argv.includes('--print')) {
  console.log(md)
} else {
  const file = path.join(root, 'LICENSES.md')
  const doc = readFileSync(file, 'utf8')
  const start = '<!-- AUTO:DEPENDENCIES:START -->'
  const end = '<!-- AUTO:DEPENDENCIES:END -->'
  const a = doc.indexOf(start)
  const b = doc.indexOf(end)
  if (a < 0 || b < 0) throw new Error('LICENSES.md: AUTO markers not found')
  writeFileSync(file, `${doc.slice(0, a + start.length)}\n${md}\n${doc.slice(b)}`)
  console.log(`LICENSES.md: ${deps.length + dev.length} packages, ${transitive.length} transitive direct imports`)
}
