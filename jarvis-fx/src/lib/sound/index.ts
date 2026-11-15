/**
 * UI sound API ("bleeps", ARWES naming). STABLE CONTRACT – other modules only use:
 *   playBleep(name)   BLEEPS   type BleepName
 *
 * Implementation (owned by the sound module) may be swapped: procedural WebAudio synth,
 * pre-rendered WAVs via howler, or CC0 Kenney packs dropped into /public/sounds/kenney.
 * Respects the global sound settings (soundOn, volume). Sounds are short (<150 ms) and quiet.
 */
import { useSettings } from '../store'

export const BLEEPS = [
  'click', // button press
  'hover', // pointer over interactive element (very quiet)
  'open', // panel / dialog open
  'close', // panel / dialog close
  'type', // decipher text tick
  'success',
  'error',
  'alert', // attention / warning
  'scan', // radar sweep / scanning
  'boot', // power-up swell
  'toggle',
] as const

export type BleepName = (typeof BLEEPS)[number]

let ctx: AudioContext | null = null
const lastPlayed = new Map<BleepName, number>()

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

type Voice = { f: number; f2?: number; dur: number; type: OscillatorType; gain: number; delay?: number }

const RECIPES: Record<BleepName, Voice[]> = {
  click: [{ f: 1800, f2: 900, dur: 0.035, type: 'square', gain: 0.18 }],
  hover: [{ f: 2600, f2: 2400, dur: 0.02, type: 'sine', gain: 0.05 }],
  open: [
    { f: 520, f2: 1040, dur: 0.09, type: 'triangle', gain: 0.22 },
    { f: 1040, f2: 1560, dur: 0.07, type: 'sine', gain: 0.12, delay: 0.05 },
  ],
  close: [{ f: 1200, f2: 420, dur: 0.1, type: 'triangle', gain: 0.2 }],
  type: [{ f: 3200, dur: 0.012, type: 'square', gain: 0.04 }],
  success: [
    { f: 880, dur: 0.07, type: 'sine', gain: 0.2 },
    { f: 1320, dur: 0.1, type: 'sine', gain: 0.2, delay: 0.07 },
  ],
  error: [
    { f: 220, f2: 180, dur: 0.12, type: 'sawtooth', gain: 0.16 },
    { f: 200, f2: 150, dur: 0.12, type: 'sawtooth', gain: 0.14, delay: 0.13 },
  ],
  alert: [
    { f: 990, dur: 0.08, type: 'square', gain: 0.12 },
    { f: 990, dur: 0.08, type: 'square', gain: 0.12, delay: 0.14 },
  ],
  scan: [{ f: 300, f2: 2400, dur: 0.14, type: 'sine', gain: 0.1 }],
  boot: [
    { f: 80, f2: 420, dur: 0.6, type: 'sawtooth', gain: 0.12 },
    { f: 160, f2: 840, dur: 0.6, type: 'triangle', gain: 0.1, delay: 0.1 },
  ],
  toggle: [{ f: 1400, f2: 1100, dur: 0.04, type: 'triangle', gain: 0.16 }],
}

/** Extension hook: the sound module can register a file-backed player that takes precedence. */
type ExternalPlayer = (name: BleepName, volume: number) => boolean
let external: ExternalPlayer | null = null
export function registerBleepPlayer(player: ExternalPlayer | null) {
  external = player
}

export function playBleep(name: BleepName) {
  const { soundOn, volume } = useSettings.getState()
  if (!soundOn || volume <= 0) return
  const now = performance.now()
  const minGap = name === 'type' ? 30 : name === 'hover' ? 60 : 25
  if (now - (lastPlayed.get(name) ?? 0) < minGap) return
  lastPlayed.set(name, now)
  if (external && external(name, volume)) return

  const ac = audio()
  if (!ac) return
  const t0 = ac.currentTime + 0.005
  for (const v of RECIPES[name]) {
    const osc = ac.createOscillator()
    const g = ac.createGain()
    const start = t0 + (v.delay ?? 0)
    osc.type = v.type
    osc.frequency.setValueAtTime(v.f, start)
    if (v.f2) osc.frequency.exponentialRampToValueAtTime(v.f2, start + v.dur)
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v.gain * volume), start + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, start + v.dur)
    osc.connect(g).connect(ac.destination)
    osc.start(start)
    osc.stop(start + v.dur + 0.02)
  }
}
