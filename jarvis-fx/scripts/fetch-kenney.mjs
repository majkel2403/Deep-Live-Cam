#!/usr/bin/env node
/**
 * fetch-kenney.mjs — OPTIONAL: install Kenney's CC0 "Interface Sounds" + "Sci-fi Sounds" packs as
 * an alternative bleep backend for JARVIS FX. Run it on your own machine (kenney.nl is not
 * reachable from every sandbox / CI):
 *
 *   node scripts/fetch-kenney.mjs                     # download from kenney.nl, extract, map
 *   node scripts/fetch-kenney.mjs --zip ~/Downloads/kenney_interface-sounds.zip --zip ~/Downloads/kenney_sci-fi-sounds.zip
 *   node scripts/fetch-kenney.mjs --from-dir ~/Downloads   # pick up kenney_*.zip already downloaded
 *   node scripts/fetch-kenney.mjs --remap              # only rebuild manifest.json from extracted files
 *   node scripts/fetch-kenney.mjs --remove             # uninstall (delete folder, unlist the pack)
 *
 * Options: --out <dir> (default public/sounds/kenney) · --dry-run · --keep-zips · --help
 *
 * What it does
 *   1. obtains the two ZIPs (download, or local files you pass in),
 *   2. extracts only the audio (.ogg/.wav/.mp3) + licence files into <out>/<pack>/ (no deps:
 *      a tiny ZIP reader on top of node:zlib),
 *   3. reads each file's real duration (Ogg Vorbis / WAV headers) and maps the 11 bleeps to the
 *      best-fitting, shortest candidates (up to 3 variants each; the app picks one at random),
 *   4. writes <out>/manifest.json and lists the pack in public/sounds/index.json — the app then
 *      prefers these files automatically (Sound Lab → "Kenney"). Edit manifest.json to taste:
 *      "files" and "gain" per bleep are the only fields the app needs.
 *
 * Licence: Kenney assets are CC0 1.0 (public domain) — https://kenney.nl/support. Credit is
 * appreciated but not required. Requires Node ≥ 18 (global fetch). Behind a corporate proxy use
 * Node ≥ 24 with NODE_USE_ENV_PROXY=1, or download the ZIPs in a browser and use --zip/--from-dir.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import path from 'node:path'
import { inflateRawSync } from 'node:zlib'

const PACKS = [
  {
    id: 'interface-sounds',
    title: 'Interface Sounds',
    page: 'https://kenney.nl/assets/interface-sounds',
    zip: /kenney[_-]?interface[_-]?sounds[^/]*\.zip$/i,
  },
  {
    id: 'sci-fi-sounds',
    title: 'Sci-fi Sounds',
    page: 'https://kenney.nl/assets/sci-fi-sounds',
    zip: /kenney[_-]?sci[_-]?fi[_-]?sounds[^/]*\.zip$/i,
  },
]

/**
 * Bleep → candidate filename patterns (priority order), max duration in ms, playback gain.
 * Kenney files are mastered loud; the gains bring them down to the app's quiet UI level.
 */
const MAPPING = {
  click: { patterns: [/^click/i, /^select/i, /^switch/i], maxMs: 200, gain: 0.35 },
  hover: { patterns: [/^tick/i, /^scroll/i, /^click/i], maxMs: 120, gain: 0.12 },
  open: { patterns: [/^open/i, /^maximize/i, /^doorOpen/i], maxMs: 450, gain: 0.4 },
  close: { patterns: [/^close/i, /^minimize/i, /^back/i, /^doorClose/i], maxMs: 450, gain: 0.4 },
  type: { patterns: [/^tick/i, /^scratch/i, /^click/i], maxMs: 100, gain: 0.12 },
  success: { patterns: [/^confirmation/i, /^select/i, /^pluck/i], maxMs: 600, gain: 0.45 },
  error: { patterns: [/^error/i, /^glitch/i], maxMs: 600, gain: 0.4 },
  alert: { patterns: [/^question/i, /^bong/i, /^glass/i, /^computerNoise/i], maxMs: 700, gain: 0.35 },
  scan: { patterns: [/^forceField/i, /^computerNoise/i, /^laserSmall/i, /^scroll/i], maxMs: 900, gain: 0.3 },
  boot: { patterns: [/^spaceEngineLow/i, /^lowFrequency/i, /^forceField/i, /^computerNoise/i], maxMs: 2500, gain: 0.4 },
  toggle: { patterns: [/^switch/i, /^toggle/i, /^click/i], maxMs: 250, gain: 0.35 },
}
const VARIANTS = 3
const AUDIO_EXT = /\.(ogg|wav|mp3)$/i
const LICENSE_FILE = /(^|\/)(license|licence)[^/]*\.txt$/i

// ---------------------------------------------------------------------------------------------
// CLI

const args = process.argv.slice(2)
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const opt = { out: path.join(root, 'public/sounds/kenney'), zips: [], fromDir: null, dryRun: false, keepZips: false, remap: false, remove: false }
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  const next = () => {
    const v = args[++i]
    if (v === undefined) fail(`missing value after ${a}`)
    return v.replace(/^~(?=$|\/)/, homedir())
  }
  if (a === '--out') opt.out = path.resolve(next())
  else if (a === '--zip') opt.zips.push(path.resolve(next()))
  else if (a === '--from-dir') opt.fromDir = path.resolve(next())
  else if (a === '--dry-run') opt.dryRun = true
  else if (a === '--keep-zips') opt.keepZips = true
  else if (a === '--remap') opt.remap = true
  else if (a === '--remove') opt.remove = true
  else if (a === '-h' || a === '--help') {
    const src = readFileSync(new URL(import.meta.url), 'utf8').split('\n')
    console.log(src.slice(2, src.indexOf(' */')).map((l) => l.replace(/^ \*\s?/, '')).join('\n'))
    process.exit(0)
  } else fail(`unknown argument ${a} (see --help)`)
}

const soundsDir = path.dirname(opt.out)
const indexFile = path.join(soundsDir, 'index.json')
const log = (...m) => console.log(...m)

function fail(msg) {
  console.error(`\n✖ ${msg}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------------------------
// Minimal ZIP reader (stored + deflate, no ZIP64) — enough for Kenney's archives.

function readZip(buf) {
  const EOCD = 0x06054b50
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a ZIP file (no end-of-central-directory record)')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  if (count === 0xffff || p === 0xffffffff) throw new Error('ZIP64 archives are not supported — unzip manually and use --remap')
  const entries = []
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt central directory')
    const flags = buf.readUInt16LE(p + 8)
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const size = buf.readUInt32LE(p + 24)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString(flags & 0x800 ? 'utf8' : 'latin1')
    entries.push({ name, method, compSize, size, local, encrypted: !!(flags & 1) })
    p += 46 + nameLen + extraLen + commentLen
  }
  return {
    entries: entries.filter((e) => !e.name.endsWith('/')),
    read(e) {
      if (e.encrypted) throw new Error(`${e.name}: encrypted entries are not supported`)
      if (buf.readUInt32LE(e.local) !== 0x04034b50) throw new Error(`${e.name}: bad local header`)
      const start = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28)
      const raw = buf.subarray(start, start + e.compSize)
      if (e.method === 0) return Buffer.from(raw)
      if (e.method === 8) return inflateRawSync(raw)
      throw new Error(`${e.name}: unsupported compression method ${e.method}`)
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Duration probes (no decoding): Ogg Vorbis/Opus last granule ÷ rate, WAV data size ÷ byte rate.

function oggDurationMs(buf) {
  let rate = 0
  const vorbis = buf.indexOf(Buffer.from([0x01, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73])) // \x01vorbis
  if (vorbis >= 0) rate = buf.readUInt32LE(vorbis + 12)
  const opus = buf.indexOf(Buffer.from('OpusHead'))
  if (!rate && opus >= 0) rate = 48000
  if (!rate) return null
  const last = buf.lastIndexOf(Buffer.from('OggS'))
  if (last < 0 || last + 14 > buf.length) return null
  const granule = Number(buf.readBigUInt64LE(last + 6))
  const preSkip = opus >= 0 && vorbis < 0 ? buf.readUInt16LE(opus + 10) : 0
  return Math.round(((granule - preSkip) / rate) * 1000)
}

function wavDurationMs(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null
  let p = 12
  let byteRate = 0
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4)
    const size = buf.readUInt32LE(p + 4)
    if (id === 'fmt ') byteRate = buf.readUInt32LE(p + 16)
    if (id === 'data' && byteRate) return Math.round((size / byteRate) * 1000)
    p += 8 + size + (size % 2)
  }
  return null
}

function durationMs(file) {
  const buf = readFileSync(file)
  if (/\.ogg$/i.test(file)) return oggDurationMs(buf)
  if (/\.wav$/i.test(file)) return wavDurationMs(buf)
  return null // mp3: unknown, still usable
}

// ---------------------------------------------------------------------------------------------
// Download helpers

const UA = { 'user-agent': 'jarvis-fx-asset-fetcher/1.0 (+https://kenney.nl CC0 assets)' }

async function get(url, as = 'text') {
  const res = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(90_000) })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return as === 'buffer' ? Buffer.from(await res.arrayBuffer()) : res.text()
}

async function findZipUrl(pack) {
  const html = await get(pack.page)
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+\.zip)(?:\?[^"']*)?["']/gi)].map((m) => new URL(m[1].replace(/&amp;/g, '&'), pack.page).href)
  return links.find((l) => pack.zip.test(new URL(l).pathname)) ?? links[0] ?? null
}

async function obtainZip(pack) {
  const local = opt.zips.find((z) => pack.zip.test(path.basename(z)))
  if (local) {
    if (!existsSync(local)) fail(`--zip file not found: ${local}`)
    log(`  ↳ using ${local}`)
    return readFileSync(local)
  }
  if (opt.fromDir) {
    const hit = readdirSync(opt.fromDir).find((f) => pack.zip.test(f))
    if (hit) {
      log(`  ↳ using ${path.join(opt.fromDir, hit)}`)
      return readFileSync(path.join(opt.fromDir, hit))
    }
    log(`  ↳ no ${pack.title} ZIP in ${opt.fromDir}, trying kenney.nl…`)
  }
  let url
  try {
    log(`  ↳ reading ${pack.page}`)
    url = await findZipUrl(pack)
  } catch (e) {
    throw new Error(
      `cannot reach kenney.nl (${e.cause?.code ?? e.message}).\n` +
        `  Download "${pack.title}" manually from ${pack.page}\n` +
        `  and re-run with:  node scripts/fetch-kenney.mjs --zip <file.zip> (or --from-dir <folder>)`,
    )
  }
  if (!url) throw new Error(`no .zip link found on ${pack.page} — the site layout may have changed; download manually and use --zip`)
  log(`  ↳ downloading ${url}`)
  const buf = await get(url, 'buffer')
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error(`${url} did not return a ZIP file`)
  if (opt.keepZips) {
    const keep = path.join(tmpdir(), path.basename(new URL(url).pathname))
    writeFileSync(keep, buf)
    log(`  ↳ kept a copy at ${keep}`)
  }
  return buf
}

function extract(pack, zipBuf) {
  const zip = readZip(zipBuf)
  const dest = path.join(opt.out, pack.id)
  const audio = zip.entries.filter((e) => AUDIO_EXT.test(e.name))
  const lic = zip.entries.filter((e) => LICENSE_FILE.test(e.name))
  if (!audio.length) throw new Error(`${pack.title}: no audio files inside the ZIP`)
  if (opt.dryRun) {
    log(`  ↳ would extract ${audio.length} audio files to ${path.relative(root, dest)}`)
    return
  }
  mkdirSync(dest, { recursive: true })
  const seen = new Set()
  for (const e of audio) {
    // flatten ("Audio/click_001.ogg" → "click_001.ogg"), never trust archive paths
    const base = path.basename(e.name).replace(/[^\w.-]+/g, '_')
    if (!base || base.startsWith('.') || seen.has(base)) continue
    seen.add(base)
    writeFileSync(path.join(dest, base), zip.read(e))
  }
  if (lic[0]) writeFileSync(path.join(dest, 'License.txt'), zip.read(lic[0]))
  log(`  ↳ extracted ${seen.size} audio files → ${path.relative(root, dest)}`)
}

// ---------------------------------------------------------------------------------------------
// Mapping + manifest

function listAudio() {
  const files = []
  for (const pack of PACKS) {
    const dir = path.join(opt.out, pack.id)
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).sort()) {
      if (!AUDIO_EXT.test(f)) continue
      const full = path.join(dir, f)
      let ms = null
      try {
        ms = durationMs(full)
      } catch {
        ms = null
      }
      files.push({ pack: pack.id, name: f, rel: `${pack.id}/${f}`, ms, bytes: statSync(full).size })
    }
  }
  return files
}

function buildManifest(files) {
  const bleeps = {}
  for (const [bleep, rule] of Object.entries(MAPPING)) {
    let picked = []
    for (const re of rule.patterns) {
      const hits = files.filter((f) => re.test(f.name))
      if (!hits.length) continue
      const fit = hits.filter((f) => f.ms == null || f.ms <= rule.maxMs)
      // shortest first — UI bleeps should be snappy
      const pool = (fit.length ? fit : hits).slice().sort((a, b) => (a.ms ?? 1e9) - (b.ms ?? 1e9) || a.name.localeCompare(b.name))
      picked = pool.slice(0, VARIANTS)
      break
    }
    if (!picked.length) continue
    bleeps[bleep] = {
      files: picked.map((f) => f.rel),
      gain: rule.gain,
      durationMs: Math.max(...picked.map((f) => f.ms ?? 0)) || undefined,
      bytes: picked.reduce((n, f) => n + f.bytes, 0),
    }
  }
  return {
    pack: 'kenney',
    title: 'Kenney · Interface Sounds + Sci-fi Sounds',
    author: 'Kenney (kenney.nl)',
    license: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    sourceUrl: 'https://kenney.nl/assets/interface-sounds',
    sources: PACKS.map((p) => ({ id: p.id, title: p.title, url: p.page })),
    generatedAt: new Date().toISOString(),
    generator: 'scripts/fetch-kenney.mjs',
    bleeps,
  }
}

function readIndex() {
  if (!existsSync(indexFile)) return { packs: [] }
  try {
    const idx = JSON.parse(readFileSync(indexFile, 'utf8'))
    return Array.isArray(idx.packs) ? idx : { packs: [] }
  } catch {
    return { packs: [] }
  }
}

function writeIndex(listKenney) {
  const idx = readIndex()
  idx.packs = idx.packs.filter((p) => p.id !== 'kenney')
  if (listKenney) idx.packs.push({ id: 'kenney', manifest: `${path.relative(soundsDir, opt.out).split(path.sep).join('/')}/manifest.json` })
  idx.packs.sort((a, b) => String(a.id).localeCompare(String(b.id)))
  writeFileSync(indexFile, JSON.stringify(idx, null, 2) + '\n')
}

// ---------------------------------------------------------------------------------------------

async function main() {
  log('JARVIS FX · Kenney CC0 sound packs')
  if (opt.remove) {
    if (!opt.dryRun) {
      rmSync(opt.out, { recursive: true, force: true })
      writeIndex(false)
    }
    log(`✔ removed ${path.relative(root, opt.out)} and unlisted it from ${path.relative(root, indexFile)}`)
    return
  }

  if (!opt.remap) {
    let failures = 0
    for (const pack of PACKS) {
      log(`\n• ${pack.title}`)
      try {
        extract(pack, await obtainZip(pack))
      } catch (e) {
        failures++
        console.error(`  ✖ ${e.message}`)
      }
    }
    if (failures === PACKS.length && !listAudio().length) fail('nothing installed (see messages above). The app keeps using the built-in WAV/synth bleeps.')
  }

  const files = listAudio()
  if (!files.length) fail(`no audio files in ${path.relative(root, opt.out)} — run without --remap first`)
  const manifest = buildManifest(files)
  const mapped = Object.keys(manifest.bleeps)

  log('\nMapping (bleep → files, duration, gain):')
  for (const bleep of Object.keys(MAPPING)) {
    const m = manifest.bleeps[bleep]
    log(`  ${bleep.padEnd(8)} ${m ? `${m.files.join(', ')}  ≤${m.durationMs ?? '?'} ms  ×${m.gain}` : '— (stays on the built-in WAV)'}`)
  }
  if (opt.dryRun) {
    log('\n(dry run — nothing written)')
    return
  }
  mkdirSync(opt.out, { recursive: true })
  writeFileSync(path.join(opt.out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  writeIndex(mapped.length > 0)
  log(`\n✔ ${mapped.length}/${Object.keys(MAPPING).length} bleeps mapped · ${files.length} files available`)
  log(`  manifest → ${path.relative(root, path.join(opt.out, 'manifest.json'))}`)
  log(`  listed in ${path.relative(root, indexFile)} — reload the app; Sound Lab (Dźwięk) shows the active backend.`)
  log('  Kenney assets are CC0 1.0 — credit "Kenney (kenney.nl)" is appreciated, not required.')
}

main().catch((e) => fail(e.stack ?? String(e)))
