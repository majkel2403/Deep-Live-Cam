/**
 * Procedural WebAudio "bleep" synth — the always-available fallback backend.
 * The same recipes are rendered offline to WAV by scripts/render-sounds.mjs (keep in sync).
 */
import type { BleepName } from './names'

export type Voice = { f: number; f2?: number; dur: number; type: OscillatorType; gain: number; delay?: number; attack?: number }

export const RECIPES: Record<BleepName, Voice[]> = {
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
    { f: 80, f2: 420, dur: 0.6, type: 'sawtooth', gain: 0.12, attack: 0.12 },
    { f: 160, f2: 840, dur: 0.6, type: 'triangle', gain: 0.1, delay: 0.1, attack: 0.1 },
  ],
  toggle: [{ f: 1400, f2: 1100, dur: 0.04, type: 'triangle', gain: 0.16 }],
}

/** Length of a recipe in seconds (last voice end). */
export function synthDuration(name: BleepName): number {
  return Math.max(...RECIPES[name].map((v) => (v.delay ?? 0) + v.dur))
}

/**
 * Schedule one bleep on any (online or offline) audio context.
 * `volume` is the user volume 0..1; each voice's peak is `gain * volume`.
 */
export function scheduleSynth(ac: BaseAudioContext, dest: AudioNode, name: BleepName, volume: number, t0 = ac.currentTime + 0.005) {
  for (const v of RECIPES[name]) {
    const osc = ac.createOscillator()
    const g = ac.createGain()
    const start = t0 + (v.delay ?? 0)
    const attack = v.attack ?? 0.005
    osc.type = v.type
    osc.frequency.setValueAtTime(v.f, start)
    if (v.f2) osc.frequency.exponentialRampToValueAtTime(v.f2, start + v.dur)
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v.gain * volume), start + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, start + v.dur)
    osc.connect(g).connect(dest)
    osc.start(start)
    osc.stop(start + v.dur + 0.02)
    osc.onended = () => {
      osc.disconnect()
      g.disconnect()
    }
  }
}
