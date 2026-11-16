/**
 * Boot log lines. Every value is read from this browser at boot time (no invented telemetry):
 * CPU threads, viewport, DPR, WebGL2 API presence, effect registry size, sound settings.
 */
import { FX } from '@/fx/registry'
import { useSettings } from '@/lib/store'

export interface BootLogLine {
  text: string
  tag: 'OK' | 'INFO' | 'WYŁ'
  /** cumulative boot progress (0..100) reached when the line completes */
  pct: number
}

export function buildBootLog(): BootLogLine[] {
  const s = useSettings.getState()
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  const cores = nav?.hardwareConcurrency
  const w = typeof window !== 'undefined' ? window.innerWidth : 0
  const h = typeof window !== 'undefined' ? window.innerHeight : 0
  const dpr = typeof window !== 'undefined' ? Math.round(window.devicePixelRatio * 100) / 100 : 1
  const webgl2 = typeof window !== 'undefined' && 'WebGL2RenderingContext' in window
  const audio = typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window)
  const reduced = document.documentElement.matches('[data-motion="reduced"]')
  const cats = new Set(FX.map((f) => f.category)).size

  const rows: Omit<BootLogLine, 'pct'>[] = [
    { text: 'zasilanie rdzenia interfejsu', tag: 'OK' },
    { text: `wątki procesora: ${cores ?? 'brak danych'}`, tag: 'INFO' },
    { text: `ekran: ${w}×${h} px @${dpr}x`, tag: 'INFO' },
    { text: `API WebGL2: ${webgl2 ? 'obecne' : 'brak'}`, tag: webgl2 ? 'OK' : 'INFO' },
    { text: `rejestr FX: ${FX.length} efektów / ${cats} kategorii`, tag: 'OK' },
    { text: `audio: ${audio ? 'WebAudio' : 'brak'} · ${s.soundOn ? `głośność ${Math.round(s.volume * 100)}%` : 'wyciszone'}`, tag: s.soundOn ? 'OK' : 'WYŁ' },
    { text: `ruch: ${reduced ? 'ograniczony' : 'pełny'} · akcent ${Math.round(s.hue)}°`, tag: 'INFO' },
    { text: 'kalibracja nakładki HUD', tag: 'OK' },
    { text: 'interfejs gotowy do pracy', tag: 'OK' },
  ]
  return rows.map((r, i) => ({ ...r, pct: Math.round(((i + 1) / rows.length) * 100) }))
}
