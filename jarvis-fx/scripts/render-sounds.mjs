#!/usr/bin/env node
/**
 * render-sounds.mjs — renders the 11 JARVIS FX UI "bleeps" to small 16-bit mono WAV files.
 *
 *   node scripts/render-sounds.mjs [--rate 44100] [--out public/sounds/synth]
 *
 * No dependencies (plain Node ≥ 18). The sounds are ORIGINAL, synthesised here from oscillators,
 * envelopes and a seeded noise source — released by the JARVIS FX authors under CC0 1.0.
 * The recipes mirror the WebAudio fallback synth in src/lib/sound/synth.ts (same pitches,
 * glides and peak levels) so switching backends keeps the same character and loudness; the
 * offline renderer adds what is awkward to do live: band-limited waveforms, a click transient,
 * a gentle low-pass and a swelling filter on the boot sound.
 *
 * Outputs:
 *   <out>/<bleep>.wav                 one file per bleep
 *   <out>/manifest.json               pack manifest (files, durations, sizes, peaks, licence)
 *   public/sounds/index.json          pack registry read by the app (pack id "wav"; other packs kept)
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const opt = { rate: 44100, out: 'public/sounds/synth' }
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--rate') opt.rate = Number(args[++i])
  else if (a === '--out') opt.out = args[++i]
  else if (a === '-h' || a === '--help') {
    console.log('usage: node scripts/render-sounds.mjs [--rate 44100] [--out public/sounds/synth]')
    process.exit(0)
  }
}
const SR = opt.rate
if (!Number.isFinite(SR) || SR < 8000 || SR > 96000) throw new Error(`bad --rate ${opt.rate}`)

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const outDir = path.resolve(root, opt.out)
const soundsDir = path.resolve(root, 'public/sounds')

// ---------------------------------------------------------------------------------------------
// DSP primitives
// ---------------------------------------------------------------------------------------------

/** Seeded PRNG (mulberry32) — renders are byte-for-byte reproducible. */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** PolyBLEP residual — removes most aliasing from naive square/saw waves. */
function polyBlep(t, dt) {
  if (t < dt) {
    t /= dt
    return t + t - t * t - 1
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt
    return t * t + t + t + 1
  }
  return 0
}

/** One oscillator sample for phase p ∈ [0,1) and phase increment dt. */
function oscSample(type, p, dt) {
  switch (type) {
    case 'sine':
      return Math.sin(2 * Math.PI * p)
    case 'triangle':
      return 1 - 4 * Math.abs(Math.round(p - 0.25) - (p - 0.25))
    case 'square': {
      let v = p < 0.5 ? 1 : -1
      v += polyBlep(p, dt)
      v -= polyBlep((p + 0.5) % 1, dt)
      return v * 0.8 // a band-limited square is louder than a sine at the same peak
    }
    case 'sawtooth': {
      let v = 2 * p - 1
      v -= polyBlep(p, dt)
      return v * 0.85
    }
    default:
      throw new Error(`unknown oscillator ${type}`)
  }
}

/**
 * A voice = oscillator with exponential pitch glide f → f2 and the same envelope shape the
 * WebAudio synth uses: quick attack to `gain`, exponential decay to −80 dB at `dur`.
 * `attack` defaults to 5 ms; the boot swell uses a longer one.
 */
function renderVoice(buf, v) {
  const start = Math.round((v.delay ?? 0) * SR)
  const n = Math.round(v.dur * SR)
  const attack = Math.max(1, Math.round((v.attack ?? 0.005) * SR))
  const floor = 0.0001
  let phase = 0
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / n
    const f = v.f2 ? v.f * Math.pow(v.f2 / v.f, t) : v.f
    const dt = f / SR
    let env
    if (i < attack) {
      // exponential rise like exponentialRampToValueAtTime(floor → gain)
      env = floor * Math.pow(v.gain / floor, i / attack)
    } else {
      const k = (i - attack) / Math.max(1, n - attack)
      env = v.gain * Math.pow(floor / v.gain, k)
    }
    let s = oscSample(v.type, phase, dt)
    if (v.harm) s = s * (1 - v.harm) + oscSample('sine', (phase * 2) % 1, dt * 2) * v.harm
    buf[start + i] += s * env
    phase += dt
    if (phase >= 1) phase -= 1
  }
}

/** Short filtered noise burst — the "tick" transient of a physical switch. */
function renderNoise(buf, { delay = 0, dur, gain, seed = 7, hp = 0.85 }) {
  const r = rng(seed)
  const start = Math.round(delay * SR)
  const n = Math.round(dur * SR)
  let prevIn = 0
  let prevOut = 0
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const x = r() * 2 - 1
    // one-pole high-pass keeps it crisp
    const y = hp * (prevOut + x - prevIn)
    prevIn = x
    prevOut = y
    const env = Math.pow(1 - i / n, 3)
    buf[start + i] += y * env * gain
  }
}

/** One-pole low-pass; `cutoff` may be a function of normalised time for sweeps. */
function lowpass(buf, cutoff) {
  let y = 0
  for (let i = 0; i < buf.length; i++) {
    const fc = typeof cutoff === 'function' ? cutoff(i / buf.length) : cutoff
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR)
    y += a * (buf[i] - y)
    buf[i] = y
  }
}

/** Removes DC and fades the last 3 ms so files never end on a click. */
function finish(buf) {
  let mean = 0
  for (let i = 0; i < buf.length; i++) mean += buf[i]
  mean /= buf.length || 1
  const fade = Math.min(buf.length, Math.round(0.003 * SR))
  for (let i = 0; i < buf.length; i++) {
    buf[i] -= mean
    const fromEnd = buf.length - 1 - i
    if (fromEnd < fade) buf[i] *= fromEnd / fade
  }
}

function peakOf(buf) {
  let p = 0
  for (let i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i]))
  return p
}

/** RIFF/WAVE, PCM 16-bit little endian, mono. */
function encodeWav(buf) {
  const dataBytes = buf.length * 2
  const out = Buffer.alloc(44 + dataBytes)
  out.write('RIFF', 0, 'ascii')
  out.writeUInt32LE(36 + dataBytes, 4)
  out.write('WAVE', 8, 'ascii')
  out.write('fmt ', 12, 'ascii')
  out.writeUInt32LE(16, 16) // fmt chunk size
  out.writeUInt16LE(1, 20) // PCM
  out.writeUInt16LE(1, 22) // channels
  out.writeUInt32LE(SR, 24)
  out.writeUInt32LE(SR * 2, 28) // byte rate
  out.writeUInt16LE(2, 32) // block align
  out.writeUInt16LE(16, 34) // bits per sample
  out.write('data', 36, 'ascii')
  out.writeUInt32LE(dataBytes, 40)
  for (let i = 0; i < buf.length; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]))
    out.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2)
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Recipes (keep in sync with src/lib/sound/synth.ts — same names, pitches and peak levels)
// ---------------------------------------------------------------------------------------------

const TAIL = 0.008 // seconds of decay tail after the last voice

/** @type {Record<string, { voices: object[]; noise?: object[]; lp?: number | ((t:number)=>number); note: string }>} */
const RECIPES = {
  click: {
    note: 'naciśnięcie przycisku',
    voices: [{ f: 1800, f2: 900, dur: 0.035, type: 'square', gain: 0.18 }],
    noise: [{ dur: 0.004, gain: 0.08, seed: 11 }],
    lp: 9000,
  },
  hover: {
    note: 'najechanie kursorem (bardzo cicho)',
    voices: [{ f: 2600, f2: 2400, dur: 0.02, type: 'sine', gain: 0.05 }],
  },
  open: {
    note: 'otwarcie panelu / okna',
    voices: [
      { f: 520, f2: 1040, dur: 0.09, type: 'triangle', gain: 0.22 },
      { f: 1040, f2: 1560, dur: 0.07, type: 'sine', gain: 0.12, delay: 0.05 },
    ],
  },
  close: {
    note: 'zamknięcie panelu / okna',
    voices: [{ f: 1200, f2: 420, dur: 0.1, type: 'triangle', gain: 0.2 }],
  },
  type: {
    note: 'tyknięcie dekodowanego tekstu',
    voices: [{ f: 3200, dur: 0.012, type: 'square', gain: 0.04 }],
    noise: [{ dur: 0.003, gain: 0.02, seed: 23 }],
    lp: 10000,
  },
  success: {
    note: 'potwierdzenie / sukces',
    voices: [
      { f: 880, dur: 0.07, type: 'sine', gain: 0.2, harm: 0.12 },
      { f: 1320, dur: 0.1, type: 'sine', gain: 0.2, harm: 0.12, delay: 0.07 },
    ],
  },
  error: {
    note: 'błąd',
    voices: [
      { f: 220, f2: 180, dur: 0.12, type: 'sawtooth', gain: 0.16 },
      { f: 200, f2: 150, dur: 0.12, type: 'sawtooth', gain: 0.14, delay: 0.13 },
    ],
    lp: 2600,
  },
  alert: {
    note: 'ostrzeżenie / zwrócenie uwagi',
    voices: [
      { f: 990, dur: 0.08, type: 'square', gain: 0.12 },
      { f: 990, dur: 0.08, type: 'square', gain: 0.12, delay: 0.14 },
    ],
    lp: 6000,
  },
  scan: {
    note: 'przemiatanie radaru / skanowanie',
    voices: [{ f: 300, f2: 2400, dur: 0.14, type: 'sine', gain: 0.1 }],
  },
  boot: {
    note: 'narastanie mocy przy rozruchu (wyjątek od limitu 150 ms)',
    voices: [
      { f: 80, f2: 420, dur: 0.6, type: 'sawtooth', gain: 0.12, attack: 0.12 },
      { f: 160, f2: 840, dur: 0.6, type: 'triangle', gain: 0.1, delay: 0.1, attack: 0.1 },
      { f: 40, f2: 210, dur: 0.55, type: 'sine', gain: 0.08, attack: 0.15 },
    ],
    // filter opens as the power comes up
    lp: (t) => 500 + 5500 * Math.pow(t, 1.4),
  },
  toggle: {
    note: 'przełącznik',
    voices: [{ f: 1400, f2: 1100, dur: 0.04, type: 'triangle', gain: 0.16 }],
    noise: [{ dur: 0.003, gain: 0.04, seed: 5 }],
  },
}

// ---------------------------------------------------------------------------------------------

mkdirSync(outDir, { recursive: true })
const manifest = {
  pack: 'wav',
  title: 'JARVIS FX · synteza własna (WAV)',
  author: 'JARVIS FX — wygenerowane przez scripts/render-sounds.mjs',
  license: 'CC0-1.0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  sampleRate: SR,
  bitDepth: 16,
  channels: 1,
  bleeps: {},
}

let total = 0
for (const [name, r] of Object.entries(RECIPES)) {
  const end = Math.max(...r.voices.map((v) => (v.delay ?? 0) + v.dur)) + TAIL
  const buf = new Float64Array(Math.round(end * SR))
  for (const v of r.voices) renderVoice(buf, v)
  for (const n of r.noise ?? []) renderNoise(buf, n)
  if (r.lp) lowpass(buf, r.lp)
  finish(buf)
  const peak = peakOf(buf)
  if (peak > 0.95) throw new Error(`${name}: clipping (peak ${peak.toFixed(3)})`)
  const wav = encodeWav(buf)
  const file = `${name}.wav`
  writeFileSync(path.join(outDir, file), wav)
  total += wav.length
  manifest.bleeps[name] = {
    files: [file],
    durationMs: Math.round(end * 1000),
    bytes: wav.length,
    peak: Number(peak.toFixed(3)),
    note: r.note,
  }
  console.log(`${name.padEnd(8)} ${String(Math.round(end * 1000)).padStart(4)} ms  ${String(wav.length).padStart(6)} B  peak ${peak.toFixed(3)}`)
}

writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

// pack registry — merge so packs added by other scripts (e.g. kenney) are kept
const indexFile = path.join(soundsDir, 'index.json')
let index = { packs: [] }
if (existsSync(indexFile)) {
  try {
    index = JSON.parse(readFileSync(indexFile, 'utf8'))
    if (!Array.isArray(index.packs)) index.packs = []
  } catch {
    index = { packs: [] }
  }
}
const rel = path.relative(soundsDir, path.join(outDir, 'manifest.json')).split(path.sep).join('/')
index.packs = index.packs.filter((p) => p.id !== 'wav')
index.packs.push({ id: 'wav', manifest: rel })
index.packs.sort((a, b) => a.id.localeCompare(b.id))
writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n')

console.log(`\n${Object.keys(RECIPES).length} files, ${(total / 1024).toFixed(1)} KB total → ${path.relative(root, outDir)}`)
if (total > 300 * 1024) {
  console.error('warning: total size exceeds the 300 KB budget')
  process.exitCode = 1
}
