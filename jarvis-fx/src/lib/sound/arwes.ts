/**
 * ARWES backend (@arwes/bleeps, MIT — Romel Perez, arwes.dev).
 *
 * Plays the same CC0 WAV files as the 'wav' backend, but through the bleep objects of
 * @arwes/bleeps. Each bleep decodes into our shared AudioContext and routes into our shared bus,
 * so the Sound Lab analyser also sees ARWES playback. The library is imported lazily and only once
 * the user selects ARWES (with sound on); nothing is loaded for everyone else.
 *
 * Honest status: a bleep counts as loaded only when its buffer really decoded (Bleep.isLoaded).
 * If files stay undecoded past DECODE_TIMEOUT_MS the pack reports 'partial' or 'error' instead.
 */
import type { Bleep } from '@arwes/bleeps'
import type { BleepName } from './names'
import { getAudio } from './engine'
import {
  discoverPackManifests,
  fetchJson,
  manifestDir,
  parseBleeps,
  patchPack,
  patchPackBleep,
  soundUrl,
  useSoundEngine,
  type Manifest,
} from './files'

const DECODE_TIMEOUT_MS = 10_000
const POLL_MS = 120

/** ARWES bleep objects per name (one per WAV variant), created once. */
const variants: Partial<Record<BleepName, Bleep[]>> = {}
const lastVariant = new Map<BleepName, number>()
let initPromise: Promise<void> | null = null

/** Loads the ARWES pack once (idempotent). Resolves when every file decoded, or when the timeout ends. */
export function initArwes(): Promise<void> {
  if (!initPromise) initPromise = load()
  return initPromise
}

async function load(): Promise<void> {
  patchPack('arwes', {
    status: 'loading',
    error: undefined,
    title: 'ARWES · @arwes/bleeps',
    author: 'Romel Perez (arwes.dev)',
    license: 'MIT',
    sourceUrl: 'https://arwes.dev',
  })

  const audio = getAudio()
  if (!audio) {
    patchPack('arwes', { status: 'error', error: 'brak AudioContext' })
    return
  }

  // same WAV pack as the 'wav' backend: its manifest lists the files and their gain
  const manifestPath = (await discoverPackManifests()).wav
  if (!manifestPath) {
    patchPack('arwes', { status: 'absent' })
    return
  }
  let manifest: Manifest
  try {
    manifest = await fetchJson<Manifest>(soundUrl(manifestPath))
  } catch (e) {
    patchPack('arwes', { status: 'error', error: String(e) })
    return
  }
  const bleeps = parseBleeps(manifest, manifestDir(manifestPath))
  patchPack('arwes', { bleeps })
  const names = Object.keys(bleeps) as BleepName[]
  if (!names.length) {
    patchPack('arwes', { status: 'error', error: 'empty manifest' })
    return
  }

  let mod: typeof import('@arwes/bleeps')
  try {
    mod = await import('@arwes/bleeps')
  } catch (e) {
    patchPack('arwes', { status: 'error', error: String(e) })
    return
  }

  for (const name of names) {
    const list = bleeps[name]!.urls.map((src) =>
      mod.createBleep({ sources: [{ src, type: 'audio/wav' }], context: audio.ctx, masterGain: audio.bus, preload: true }),
    )
    variants[name] = list.filter((b): b is Bleep => b !== null)
  }

  await waitForDecode(names)
}

/** Polls Bleep.isLoaded (createBleep has no load callback) and reports real progress to the store. */
function waitForDecode(names: BleepName[]): Promise<void> {
  const started = performance.now()
  return new Promise((resolve) => {
    const tick = () => {
      let allLoaded = true
      let anyLoaded = false
      for (const name of names) {
        const list = variants[name] ?? []
        const loaded = list.filter((b) => b.isLoaded).length
        if (loaded < list.length) allLoaded = false
        if (loaded > 0) anyLoaded = true
        patchPackBleep('arwes', name, { loaded, failed: list.length - loaded })
      }
      if (allLoaded) {
        patchPack('arwes', { status: 'ready' })
        resolve()
        return
      }
      if (performance.now() - started > DECODE_TIMEOUT_MS) {
        patchPack('arwes', anyLoaded ? { status: 'partial' } : { status: 'error', error: 'pliki nie zdekodowały się' })
        resolve()
        return
      }
      window.setTimeout(tick, POLL_MS)
    }
    tick()
  })
}

/**
 * Plays one ARWES bleep for `name`, picking a decoded variant at random (never twice in a row).
 * Returns false when no variant has decoded yet, so the caller can fall back.
 */
export function arwesPlay(name: BleepName, volume: number): boolean {
  const list = variants[name]?.filter((b) => b.isLoaded)
  if (!list?.length) return false
  let i = Math.floor(Math.random() * list.length)
  if (list.length > 1 && i === lastVariant.get(name)) i = (i + 1) % list.length
  lastVariant.set(name, i)
  const bleep = list[i]
  const gain = useSoundEngine.getState().packs.arwes.bleeps[name]?.gain ?? 1
  bleep.volume = Math.min(1, volume * gain)
  bleep.play()
  return true
}
