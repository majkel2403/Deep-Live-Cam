/**
 * UI sound API ("bleeps", ARWES naming). STABLE CONTRACT – other modules only use:
 *   playBleep(name)   BLEEPS   type BleepName   registerBleepPlayer(player)
 *
 * Backends (chosen per bleep, see files.ts → resolveBackend):
 *   1. Kenney CC0 packs  – if /sounds/index.json lists a "kenney" pack (scripts/fetch-kenney.mjs)
 *   2. our CC0 WAVs      – /sounds/synth/*.wav played via howler (scripts/render-sounds.mjs)
 *   3. WebAudio synth    – procedural, always available, also the fallback while files load
 * Respects the global sound settings (soundOn, volume). Sounds are short (<150 ms) and quiet.
 */
import { useSettings } from '../store'
import type { BleepName } from './names'
import { getAudio } from './engine'
import { scheduleSynth } from './synth'
import { filePlayer, initFileBackends, resolveBackend, type Backend } from './files'

export { BLEEPS, type BleepName, isBleepName } from './names'
export { RECIPES, synthDuration, scheduleSynth, type Voice } from './synth'
export { getAnalyser, audioState, getAudio } from './engine'
export {
  useSoundEngine,
  initFileBackends,
  ensureHowler,
  resolveBackend,
  soundUrl,
  type Backend,
  type BackendPref,
  type FilePackId,
  type PackInfo,
  type PackBleep,
  type PackStatus,
} from './files'

// ---------------------------------------------------------------------------------------------
// playback events (Sound Lab visualisers subscribe; cheap no-op when nobody listens)

export interface BleepEvent {
  name: BleepName
  backend: Backend | 'external'
  at: number
}
const listeners = new Set<(e: BleepEvent) => void>()
export function onBleep(listener: (e: BleepEvent) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
function emit(name: BleepName, backend: BleepEvent['backend']) {
  if (!listeners.size) return
  const e = { name, backend, at: performance.now() }
  listeners.forEach((l) => l(e))
}

// ---------------------------------------------------------------------------------------------

/**
 * Extension hook: a file-backed player that takes precedence over the synth.
 * Return false to fall through to the synth; true (or a backend label) when it played.
 */
type ExternalPlayer = (name: BleepName, volume: number) => boolean | string
let external: ExternalPlayer | null = null
export function registerBleepPlayer(player: ExternalPlayer | null) {
  external = player
}

const lastPlayed = new Map<BleepName, number>()

function playSynth(name: BleepName, volume: number) {
  const a = getAudio()
  if (!a) return
  scheduleSynth(a.ctx, a.bus, name, volume)
}

export function playBleep(name: BleepName) {
  const { soundOn, volume } = useSettings.getState()
  if (!soundOn || volume <= 0) return
  const now = performance.now()
  const minGap = name === 'type' ? 30 : name === 'hover' ? 60 : 25
  if (now - (lastPlayed.get(name) ?? 0) < minGap) return
  lastPlayed.set(name, now)
  if (external) {
    const r = external(name, volume)
    if (r) {
      emit(name, typeof r === 'string' ? (r as Backend) : 'external')
      return
    }
  }
  playSynth(name, volume)
  emit(name, 'synth')
}

/**
 * Sound Lab: play a bleep through one specific backend (falls back to the synth when that
 * backend has no file for it). Still honours mute and volume. Returns the backend used.
 */
export function auditionBleep(name: BleepName, backend: Backend): Backend | null {
  const { soundOn, volume } = useSettings.getState()
  if (!soundOn || volume <= 0) return null
  if (backend !== 'synth' && resolveBackend(name, backend) === backend) {
    const r = filePlayer(name, volume, backend)
    if (r) {
      emit(name, r)
      return r
    }
  }
  playSynth(name, volume)
  emit(name, 'synth')
  return 'synth'
}

// file backends register themselves once loaded; deferred so they never compete with first paint
registerBleepPlayer((name, volume) => filePlayer(name, volume))
if (typeof window !== 'undefined') {
  const start = () => {
    if (useSettings.getState().soundOn) {
      void initFileBackends()
      return
    }
    const unsub = useSettings.subscribe((s) => {
      if (s.soundOn) {
        unsub()
        void initFileBackends()
      }
    })
  }
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(start, { timeout: 2500 })
  else setTimeout(start, 1200)
}

