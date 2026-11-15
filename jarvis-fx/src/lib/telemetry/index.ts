import { useSyncExternalStore } from 'react'
import { getTelemetrySnapshot, subscribeTelemetry, type TelemetrySnapshot } from './sampler'

export type { BatteryInfo, ConnectionInfo, HeapInfo, LongTaskInfo, StorageInfo, TelemetrySnapshot } from './sampler'
export { subscribeTelemetry, getTelemetrySnapshot } from './sampler'

/**
 * Live, REAL browser telemetry (1 Hz). Shared ref-counted sampler: mounting several consumers
 * costs one rAF loop + one interval. Unsupported APIs are `null` – render them as "n/d".
 */
export function useTelemetry(): TelemetrySnapshot {
  return useSyncExternalStore(subscribeTelemetry, getTelemetrySnapshot, getTelemetrySnapshot)
}

/** Narrow selector to avoid re-rendering on unrelated fields (compares with Object.is). */
export function useTelemetryValue<T>(select: (s: TelemetrySnapshot) => T): T {
  return useSyncExternalStore(
    subscribeTelemetry,
    () => select(getTelemetrySnapshot()),
    () => select(getTelemetrySnapshot()),
  )
}

/** Visible-tab flag driven by the Page Visibility API (no sampler needed). */
export { useDocumentVisible } from './visibility'

/** Formatting helpers shared by telemetry widgets. */
export function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

export const ND = 'n/d'
