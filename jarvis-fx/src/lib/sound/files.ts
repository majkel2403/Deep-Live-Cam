/**
 * File-backed bleep backends played through howler (MIT):
 *   'wav'    – our own CC0 WAVs rendered by scripts/render-sounds.mjs  → /sounds/synth/*.wav
 *   'kenney' – optional CC0 Kenney packs fetched by scripts/fetch-kenney.mjs → /sounds/kenney/**
 *
 * Packs are discovered through /sounds/index.json (written by both scripts) so the app never
 * probes for files that may not exist (no 404 noise). Howler is loaded lazily in its own chunk.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Howl as HowlInstance } from 'howler'
import { isBleepName, type BleepName } from './names'
import { adoptHowler } from './engine'

export type Backend = 'synth' | 'wav' | 'kenney'
export type BackendPref = 'auto' | Backend
export type FilePackId = 'wav' | 'kenney'
export type PackStatus = 'idle' | 'loading' | 'ready' | 'partial' | 'error' | 'absent'

export interface PackBleep {
  urls: string[]
  durationMs?: number
  bytes?: number
  gain: number
  loaded: number
  failed: number
}

export interface PackInfo {
  id: FilePackId
  status: PackStatus
  title?: string
  author?: string
  license?: string
  licenseUrl?: string
  sourceUrl?: string
  error?: string
  bleeps: Partial<Record<BleepName, PackBleep>>
}

interface EngineState {
  pref: BackendPref
  howler: 'idle' | 'loading' | 'ready' | 'error'
  packs: Record<FilePackId, PackInfo>
  setPref: (pref: BackendPref) => void
}

const emptyPack = (id: FilePackId): PackInfo => ({ id, status: 'idle', bleeps: {} })

export const useSoundEngine = create<EngineState>()(
  persist(
    (set) => ({
      pref: 'auto',
      howler: 'idle',
      packs: { wav: emptyPack('wav'), kenney: emptyPack('kenney') },
      setPref: (pref) => set({ pref }),
    }),
    { name: 'jx-sound', version: 1, partialize: (s) => ({ pref: s.pref }) },
  ),
)

function patchPack(id: FilePackId, patch: Partial<PackInfo>) {
  useSoundEngine.setState((s) => ({ packs: { ...s.packs, [id]: { ...s.packs[id], ...patch } } }))
}

function patchPackBleep(id: FilePackId, name: BleepName, patch: Partial<PackBleep>) {
  useSoundEngine.setState((s) => {
    const pack = s.packs[id]
    const prev = pack.bleeps[name]
    if (!prev) return s
    return { packs: { ...s.packs, [id]: { ...pack, bleeps: { ...pack.bleeps, [name]: { ...prev, ...patch } } } } }
  })
}

// ---------------------------------------------------------------------------------------------

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/')
export const soundUrl = (p: string) => `${BASE}sounds/${p}`

type HowlerModule = typeof import('howler')
let howlerMod: HowlerModule | null = null
let howlerPromise: Promise<HowlerModule | null> | null = null

/** Lazy-load howler and route it through the shared AudioContext/analyser. */
export function ensureHowler(): Promise<HowlerModule | null> {
  if (!howlerPromise) {
    useSoundEngine.setState({ howler: 'loading' })
    howlerPromise = import('howler')
      .then((m) => {
        const mod = ((m as unknown as { Howl?: unknown }).Howl ? m : (m as unknown as { default: HowlerModule }).default) as HowlerModule
        adoptHowler(mod.Howler)
        howlerMod = mod
        useSoundEngine.setState({ howler: 'ready' })
        return mod
      })
      .catch(() => {
        useSoundEngine.setState({ howler: 'error' })
        return null
      })
  }
  return howlerPromise
}

const howls: Record<FilePackId, Partial<Record<BleepName, HowlInstance[]>>> = { wav: {}, kenney: {} }
const lastVariant = new Map<string, number>()

interface ManifestBleep {
  files?: string[]
  file?: string
  gain?: number
  durationMs?: number
  bytes?: number
}
interface Manifest {
  title?: string
  author?: string
  license?: string
  licenseUrl?: string
  sourceUrl?: string
  bleeps?: Record<string, ManifestBleep>
}
interface PackIndex {
  packs?: { id?: string; manifest?: string }[]
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-cache' })
  const type = res.headers.get('content-type') ?? ''
  // the dev server answers unknown paths with index.html — treat that as "absent"
  if (!res.ok || !/json/i.test(type)) throw new Error(`absent:${res.status}`)
  return (await res.json()) as T
}

const MAX_VARIANTS = 4

async function loadPack(id: FilePackId, manifestPath: string, mod: HowlerModule) {
  patchPack(id, { status: 'loading' })
  let manifest: Manifest
  try {
    manifest = await fetchJson<Manifest>(soundUrl(manifestPath))
  } catch (e) {
    patchPack(id, { status: String(e).includes('absent') ? 'absent' : 'error', error: String(e) })
    return
  }
  const dir = manifestPath.includes('/') ? manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1) : ''
  const bleeps: Partial<Record<BleepName, PackBleep>> = {}
  for (const [name, entry] of Object.entries(manifest.bleeps ?? {})) {
    if (!isBleepName(name) || !entry) continue
    const files = (entry.files ?? (entry.file ? [entry.file] : [])).filter((f) => typeof f === 'string' && !f.includes('..')).slice(0, MAX_VARIANTS)
    if (!files.length) continue
    bleeps[name] = {
      urls: files.map((f) => soundUrl(dir + f)),
      durationMs: entry.durationMs,
      bytes: entry.bytes,
      gain: typeof entry.gain === 'number' && entry.gain > 0 ? Math.min(1.5, entry.gain) : 1,
      loaded: 0,
      failed: 0,
    }
  }
  patchPack(id, {
    title: manifest.title,
    author: manifest.author,
    license: manifest.license,
    licenseUrl: manifest.licenseUrl,
    sourceUrl: manifest.sourceUrl,
    bleeps,
  })

  const entries = Object.entries(bleeps) as [BleepName, PackBleep][]
  if (!entries.length) {
    patchPack(id, { status: 'error', error: 'empty manifest' })
    return
  }
  let pending = entries.reduce((n, [, b]) => n + b.urls.length, 0)
  let ok = 0
  const settle = () => {
    if (--pending > 0) return
    const total = entries.reduce((n, [, b]) => n + b.urls.length, 0)
    patchPack(id, { status: ok === total ? 'ready' : ok > 0 ? 'partial' : 'error' })
  }
  for (const [name, b] of entries) {
    howls[id][name] = b.urls.map(
      (src) =>
        new mod.Howl({
          src: [src],
          preload: true,
          onload: () => {
            ok++
            patchPackBleep(id, name, { loaded: (useSoundEngine.getState().packs[id].bleeps[name]?.loaded ?? 0) + 1 })
            settle()
          },
          onloaderror: () => {
            patchPackBleep(id, name, { failed: (useSoundEngine.getState().packs[id].bleeps[name]?.failed ?? 0) + 1 })
            settle()
          },
        }),
    )
  }
}

let initPromise: Promise<void> | null = null

/** Discover and preload file packs (idempotent). */
export function initFileBackends(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const mod = await ensureHowler()
      if (!mod) return
      let index: PackIndex
      try {
        index = await fetchJson<PackIndex>(soundUrl('index.json'))
      } catch {
        index = { packs: [{ id: 'wav', manifest: 'synth/manifest.json' }] }
      }
      const listed = new Map<FilePackId, string>()
      for (const p of index.packs ?? []) {
        if ((p.id === 'wav' || p.id === 'kenney') && typeof p.manifest === 'string') listed.set(p.id, p.manifest)
      }
      if (!listed.has('kenney')) patchPack('kenney', { status: 'absent' })
      if (!listed.has('wav')) patchPack('wav', { status: 'absent' })
      await Promise.all([...listed].map(([id, m]) => loadPack(id, m, mod)))
    })()
  }
  return initPromise
}

function hasLoaded(id: FilePackId, name: BleepName): boolean {
  const b = useSoundEngine.getState().packs[id].bleeps[name]
  return !!b && b.loaded > 0
}

/** Which backend will play `name` right now, given the preference and what has loaded. */
export function resolveBackend(name: BleepName, pref: BackendPref = useSoundEngine.getState().pref): Backend {
  if (pref === 'synth') return 'synth'
  // 'auto' and 'kenney' prefer Kenney; every file preference falls back to our WAVs, then the synth
  if (pref !== 'wav' && hasLoaded('kenney', name)) return 'kenney'
  if (hasLoaded('wav', name)) return 'wav'
  return 'synth'
}

/** Player registered through registerBleepPlayer: returns the backend label or false (→ synth). */
export function filePlayer(name: BleepName, volume: number, force?: Backend): Backend | false {
  const backend = force ?? resolveBackend(name)
  if (backend === 'synth') return false
  const list = howls[backend][name]?.filter((h) => h.state() === 'loaded')
  if (!list?.length) return false
  const key = `${backend}:${name}`
  let i = Math.floor(Math.random() * list.length)
  if (list.length > 1 && i === lastVariant.get(key)) i = (i + 1) % list.length
  lastVariant.set(key, i)
  const howl = list[i]
  const gain = useSoundEngine.getState().packs[backend].bleeps[name]?.gain ?? 1
  const id = howl.play()
  howl.volume(Math.min(1, volume * gain), id)
  return backend
}

export function howlerReady(): boolean {
  return !!howlerMod
}

