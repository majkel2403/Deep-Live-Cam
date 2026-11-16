/**
 * Real waveforms for the Sound Lab: the synth recipes are rendered offline (OfflineAudioContext,
 * the very same scheduleSynth() the live fallback uses) and file backends are fetched and
 * decoded. Results are cached per source; measurements (peak, RMS, audible length) are computed
 * from the actual samples.
 */
import { scheduleSynth, synthDuration, type Backend, type BleepName } from '@/lib/sound'

export interface Wave {
  samples: Float32Array
  sampleRate: number
  /** length until the signal last exceeds −60 dBFS */
  durationMs: number
  peak: number
  rms: number
}

const SR = 44100
const SILENCE = 0.001 // −60 dBFS
const cache = new Map<string, Promise<Wave | null>>()

function offlineCtor(): typeof OfflineAudioContext | null {
  if (typeof window === 'undefined') return null
  return window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext ?? null
}

function analyse(buf: AudioBuffer): Wave {
  const d = buf.getChannelData(0)
  let peak = 0
  let sum = 0
  let last = 0
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i])
    if (a > peak) peak = a
    if (a > SILENCE) last = i
    sum += d[i] * d[i]
  }
  return { samples: d, sampleRate: buf.sampleRate, durationMs: ((last + 1) / buf.sampleRate) * 1000, peak, rms: Math.sqrt(sum / Math.max(1, last + 1)) }
}

async function renderSynth(name: BleepName): Promise<Wave | null> {
  const OAC = offlineCtor()
  if (!OAC) return null
  const ctx = new OAC(1, Math.ceil((synthDuration(name) + 0.05) * SR), SR)
  scheduleSynth(ctx, ctx.destination, name, 1, 0)
  return analyse(await ctx.startRendering())
}

async function decodeUrl(url: string): Promise<Wave | null> {
  const OAC = offlineCtor()
  if (!OAC) return null
  const res = await fetch(url)
  if (!res.ok) throw new Error(String(res.status))
  const data = await res.arrayBuffer()
  const ctx = new OAC(1, 1, SR)
  return analyse(await ctx.decodeAudioData(data))
}

/** Waveform of what `backend` plays for `name` (url = first file of a file pack). */
export function loadWave(name: BleepName, backend: Backend, url?: string): Promise<Wave | null> {
  const key = backend === 'synth' || !url ? `synth:${name}` : `${backend}:${url}`
  let p = cache.get(key)
  if (!p) {
    p = (backend === 'synth' || !url ? renderSynth(name) : decodeUrl(url)).catch(() => null)
    cache.set(key, p)
  }
  return p
}
