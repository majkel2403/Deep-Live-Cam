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
 * and whether a LICENSE file ships with the package.
 *
 * Import scan: every module specifier in src/ and vite.config.ts is collected with ES import
 * syntax only (statements, re-exports, side-effect imports, CSS @import, dynamic import()).
 * Comments and string literals such as `from "demand"` in prose are not picked up.
 *  - declared in package.json but not imported anywhere → "Deklarowane bez importu" (build tools,
 *    code generators, aliases resolved by vite.config.ts);
 *  - imported in src/ but not declared → "Importowane bez deklaracji" (should be empty).
 * No dependencies; Node ≥ 20.19 (the Vite 8 requirement).
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
  if (!i) return `| \`${name}\` | ${spec} | — | **nie zainstalowany** | — | ${kind} | ${used.has(name) ? 'tak' : 'nie'} |`
  const alias = i.realName !== name ? ` (alias \`${i.realName}\`)` : ''
  const flag = /^(MIT|ISC|Apache-2\.0|BSD-[23]-Clause|0BSD|Zlib|Unlicense|CC0-1\.0|OFL-1\.1|BlueOak-1\.0\.0)( \(tekst w pliku LICENSE\))?$/.test(i.license) ? '' : ' ⚠'
  // "tak" = an import in src/ or vite.config.ts (a direct dependency of the bundle); "nie" = tooling or a transitive package
  const direct = used.has(name) ? 'tak' : 'nie'
  return `| \`${name}\`${alias} | ${i.version} | ${i.license}${flag} | ${i.hasFile ? 'tak' : 'nie'} | ${i.home ? `<${i.home}>` : '—'} | ${kind} | ${direct} |`
}

/** ES import syntax only – no comments, no prose, no string literals outside import statements */
const IMPORT_PATTERNS = [
  // import x from 'y' · import { a, b } from 'y' · export { a } from 'y' — the clause between the keyword and
  // `from` may contain only identifiers, braces, commas and whitespace, so a `(`, `=` or quote stops the match
  /^\s*(?:import|export)\s+(?:type\s+)?[\w*\s{},$]*?\s*\bfrom\s+['"]([^'"]+)['"]/gm,
  /^\s*\}\s*from\s+['"]([^'"]+)['"]/gm, // closing line of a multi-line import
  /^\s*import\s+['"]([^'"]+)['"]/gm, // import 'y' (side effect)
  /^\s*@import\s+['"]([^'"]+)['"]/gm, // CSS @import
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g, // dynamic import()
]

/** package name of a bare specifier, or null for relative / alias / node: specifiers */
function packageOf(spec) {
  if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/') || spec.startsWith('node:')) return null
  return spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
}

function collectImports() {
  const used = new Map() // package name → number of importing files
  const scan = (file) => {
    const src = readFileSync(file, 'utf8')
    const names = new Set()
    for (const re of IMPORT_PATTERNS) {
      for (const m of src.matchAll(re)) {
        const name = packageOf(m[1])
        if (name) names.add(name)
      }
    }
    for (const n of names) used.set(n, (used.get(n) ?? 0) + 1)
  }
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx?|css)$/.test(f)) scan(p)
    }
  }
  walk(path.join(root, 'src'))
  const vite = path.join(root, 'vite.config.ts')
  if (existsSync(vite)) scan(vite)
  return used
}

const declaredRuntime = Object.keys(pkg.dependencies ?? {})
const declaredDev = Object.keys(pkg.devDependencies ?? {})
const declared = new Set([...declaredRuntime, ...declaredDev])
const used = collectImports()
const deps = Object.entries(pkg.dependencies ?? {}).sort(([a], [b]) => a.localeCompare(b))
const dev = Object.entries(pkg.devDependencies ?? {}).sort(([a], [b]) => a.localeCompare(b))
const head = '| Pakiet | Wersja | Licencja (pole `license`) | Plik LICENSE | Strona / repozytorium | Typ | Import w `src/` |\n|---|---|---|---|---|---|---|'

const counts = new Map()
for (const [n] of [...deps, ...dev]) {
  const l = readInstalled(n)?.license ?? 'nie zainstalowany'
  counts.set(l, (counts.get(l) ?? 0) + 1)
}
const summary = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([l, c]) => `${l} × ${c}`).join(' · ')
const undeclared = [...used.keys()].filter((n) => !declared.has(n)).sort()
const unused = [...declared].filter((n) => !used.has(n)).sort((a, b) => a.localeCompare(b))
const unusedRows = unused.map((n) => row(n, pkg.dependencies?.[n] ?? pkg.devDependencies?.[n], declaredRuntime.includes(n) ? 'runtime' : 'dev'))

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
  '### Importowane bez deklaracji w package.json',
  '',
  undeclared.length
    ? [head, ...undeclared.map((n) => row(n, '', 'NIEZADEKLAROWANA'))].join('\n')
    : '_Brak – każdy import z `src/` i `vite.config.ts` jest zadeklarowany w package.json._',
  '',
  '### Zadeklarowane bez importu w `src/` i `vite.config.ts`',
  '',
  unused.length
    ? [head, ...unusedRows].join('\n') + '\n\nTe pakiety nie trafiają do paczki aplikacji bezpośrednio: są narzędziami (typy, lint, build), generatorem (`@iconify-json/game-icons` – źródło podzbioru ikon, patrz `docs/ARCHITECTURE.md` §11; `material-symbols` – źródło podzbioru czcionki, `scripts/subset-material-symbols.py`) albo aliasem przeładowanym w `vite.config.ts` (`motion-v10`).'
    : '_Brak._',
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
  console.log(`LICENSES.md: ${deps.length + dev.length} packages, ${undeclared.length} undeclared imports, ${unused.length} declared without import`)
}
