import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Quality = 'low' | 'med' | 'high'
export type QualityPref = Quality | 'auto'
export type MotionPref = 'auto' | 'full' | 'reduced'

export type ViewId = 'bridge' | 'gallery' | 'agents' | 'sound' | 'arsenal' | 'boot'

export interface Settings {
  soundOn: boolean
  volume: number // 0..1
  motion: MotionPref
  quality: QualityPref
  hue: number // accent hue 0..360
  scanlines: boolean
  bootSeen: boolean
  agentSource: string // 'demo' | ws://… | http(s)://… (SSE)
}

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void
  reset: () => void
}

export const DEFAULT_SETTINGS: Settings = {
  soundOn: true,
  volume: 0.35,
  motion: 'auto',
  quality: 'auto',
  hue: 188,
  scanlines: true,
  bootSeen: false,
  agentSource: 'demo',
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      reset: () => set({ ...DEFAULT_SETTINGS, bootSeen: true }),
    }),
    { name: 'jx-settings', version: 1 },
  ),
)

/** hsl → hex for libraries that need a concrete colour (three, echarts, canvas). */
export function hueToHex(h: number, s = 100, l = 52): string {
  const sat = s / 100
  const lig = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
}

export function useAccent(): { hue: number; hex: string; hex2: string; dim: string } {
  const hue = useSettings((s) => s.hue)
  return {
    hue,
    hex: hueToHex(hue),
    hex2: hueToHex((hue + 24) % 360, 100, 64),
    dim: hueToHex(hue, 80, 30),
  }
}

const mq = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : undefined

export function useReducedMotion(): boolean {
  const motion = useSettings((s) => s.motion)
  if (motion === 'full') return false
  if (motion === 'reduced') return true
  return !!mq?.matches
}

/** Resolve 'auto' quality from device hints (cores, memory, DPR, coarse pointer). */
export function resolveQuality(pref: QualityPref): Quality {
  if (pref !== 'auto') return pref
  if (typeof navigator === 'undefined') return 'med'
  const cores = navigator.hardwareConcurrency || 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  if (coarse || cores <= 4 || mem <= 4) return 'low'
  if (cores >= 12 && mem >= 8) return 'high'
  return 'med'
}

export function useQuality(): Quality {
  return resolveQuality(useSettings((s) => s.quality))
}
