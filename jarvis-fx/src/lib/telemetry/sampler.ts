/**
 * Real browser telemetry sampler (no synthetic values).
 *
 * One shared, ref-counted sampler per page: the first subscriber starts it, the last one stops it
 * and removes every listener / observer / rAF it created. Each metric degrades honestly to `null`
 * (rendered as "n/d") when the corresponding Web API is unavailable in the current browser.
 *
 * Sources:
 *  - FPS / frame time        requestAnimationFrame frame counting (rAF loop and 1 Hz sampling stop while the tab is hidden)
 *  - JS heap                 performance.memory (Chromium-only, non-standard, quantised)
 *  - network                 navigator.connection (Network Information API, Chromium)
 *  - battery                 navigator.getBattery() (Battery Status API, Chromium)
 *  - long tasks              PerformanceObserver({ type: 'longtask' })
 *  - storage                 navigator.storage.estimate()
 *  - device                  hardwareConcurrency, deviceMemory, devicePixelRatio, screen, language
 *  - session                 performance.now() uptime, online/offline, document.visibilityState
 */

export interface HeapInfo {
  usedMB: number
  totalMB: number
  limitMB: number
}

export interface ConnectionInfo {
  effectiveType: string | null
  downlinkMbps: number | null
  rttMs: number | null
  saveData: boolean | null
  type: string | null
}

export interface BatteryInfo {
  /** 0..1 */
  level: number
  charging: boolean
  /** seconds, Infinity when unknown */
  chargingTime: number
  dischargingTime: number
}

export interface LongTaskInfo {
  supported: boolean
  /** long tasks since the sampler started */
  count: number
  totalMs: number
  /** duration of the most recent long task */
  lastMs: number | null
  maxMs: number
  /** share of wall time blocked by long tasks in the last 10 s, 0..1 */
  busy: number
}

export interface StorageInfo {
  usageMB: number
  quotaMB: number
}

export interface TelemetrySnapshot {
  ts: number
  /** frames per second over the last sample window; null while the tab is hidden / before first sample */
  fps: number | null
  /** mean frame duration in ms over the last window */
  frameMs: number | null
  /** worst single frame in the last window (ms) */
  worstFrameMs: number | null
  heap: HeapInfo | null
  connection: ConnectionInfo | null
  /** null = API unsupported; undefined = still resolving */
  battery: BatteryInfo | null | undefined
  cores: number | null
  /** GB, rounded & capped by the browser (privacy) */
  deviceMemoryGB: number | null
  dpr: number
  screen: { w: number; h: number } | null
  viewport: { w: number; h: number }
  language: string | null
  timeZone: string | null
  uptimeMs: number
  longTasks: LongTaskInfo
  storage: StorageInfo | null | undefined
  online: boolean
  visibility: DocumentVisibilityState
  /** rolling histories, oldest first, one sample per second */
  history: {
    fps: (number | null)[]
    heapMB: (number | null)[]
    busy: number[]
  }
}

const HISTORY = 60
const SAMPLE_MS = 1000
const BUSY_WINDOW_MS = 10_000

type Nav = Navigator & {
  connection?: EventTarget & { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean; type?: string }
  deviceMemory?: number
  getBattery?: () => Promise<EventTarget & { level: number; charging: boolean; chargingTime: number; dischargingTime: number }>
}
type PerfWithMemory = Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }

const MB = 1024 * 1024

function readHeap(): HeapInfo | null {
  const m = (performance as PerfWithMemory).memory
  if (!m || !m.jsHeapSizeLimit) return null
  return { usedMB: m.usedJSHeapSize / MB, totalMB: m.totalJSHeapSize / MB, limitMB: m.jsHeapSizeLimit / MB }
}

function readConnection(): ConnectionInfo | null {
  const c = (navigator as Nav).connection
  if (!c) return null
  return {
    effectiveType: c.effectiveType ?? null,
    downlinkMbps: typeof c.downlink === 'number' ? c.downlink : null,
    rttMs: typeof c.rtt === 'number' ? c.rtt : null,
    saveData: typeof c.saveData === 'boolean' ? c.saveData : null,
    type: c.type ?? null,
  }
}

/** StorageManager.estimate() is missing in some embedded / insecure contexts despite the DOM typings. */
function hasStorageEstimate(): boolean {
  return typeof (navigator as { storage?: { estimate?: unknown } }).storage?.estimate === 'function'
}

function timeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  } catch {
    return null
  }
}

function initial(): TelemetrySnapshot {
  const hasWindow = typeof window !== 'undefined'
  const nav = (hasWindow ? navigator : undefined) as Nav | undefined
  return {
    ts: Date.now(),
    fps: null,
    frameMs: null,
    worstFrameMs: null,
    heap: hasWindow ? readHeap() : null,
    connection: hasWindow ? readConnection() : null,
    battery: nav?.getBattery ? undefined : null,
    cores: nav?.hardwareConcurrency || null,
    deviceMemoryGB: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : null,
    dpr: hasWindow ? window.devicePixelRatio || 1 : 1,
    screen: hasWindow && window.screen ? { w: window.screen.width, h: window.screen.height } : null,
    viewport: hasWindow ? { w: window.innerWidth, h: window.innerHeight } : { w: 0, h: 0 },
    language: nav?.language ?? null,
    timeZone: timeZone(),
    uptimeMs: hasWindow ? performance.now() : 0,
    longTasks: { supported: false, count: 0, totalMs: 0, lastMs: null, maxMs: 0, busy: 0 },
    storage: hasWindow && hasStorageEstimate() ? undefined : null,
    online: hasWindow ? navigator.onLine : true,
    visibility: hasWindow ? document.visibilityState : 'visible',
    history: { fps: [], heapMB: [], busy: [] },
  }
}

let snapshot: TelemetrySnapshot = initial()
const listeners = new Set<() => void>()
let refs = 0
let teardown: (() => void) | null = null

function emit(patch: Partial<TelemetrySnapshot>) {
  snapshot = { ...snapshot, ...patch }
  listeners.forEach((l) => l())
}

function push<T>(arr: T[], v: T): T[] {
  const next = arr.length >= HISTORY ? arr.slice(arr.length - HISTORY + 1) : arr.slice()
  next.push(v)
  return next
}

function start(): () => void {
  const cleanups: (() => void)[] = []
  const on = <K extends string>(target: EventTarget | undefined | null, type: K, fn: EventListener) => {
    if (!target) return
    target.addEventListener(type, fn)
    cleanups.push(() => target.removeEventListener(type, fn))
  }

  // --- FPS via rAF ---------------------------------------------------------------------------
  let frames = 0
  let worst = 0
  let lastFrame = performance.now()
  let windowStart = lastFrame
  let raf = 0
  const loop = (t: number) => {
    // hidden tab: stop counting (browsers throttle rAF there anyway); restarted on visibilitychange
    if (document.hidden) {
      raf = 0
      return
    }
    frames++
    const d = t - lastFrame
    if (d > worst) worst = d
    lastFrame = t
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
  cleanups.push(() => cancelAnimationFrame(raf))

  // --- long tasks ----------------------------------------------------------------------------
  // counters live in a private mutable object; a fresh copy is emitted on every sample
  const longTaskLog: { end: number; dur: number }[] = []
  // reset on (re)start: `buffered: true` replays earlier entries, so counting from zero avoids doubles
  const lt: LongTaskInfo = { supported: false, count: 0, totalMs: 0, lastMs: null, maxMs: 0, busy: 0 }
  const supportsLongTask = typeof PerformanceObserver !== 'undefined' && (PerformanceObserver.supportedEntryTypes ?? []).includes('longtask')
  if (supportsLongTask) {
    try {
      const obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          lt.count++
          lt.totalMs += e.duration
          lt.lastMs = e.duration
          lt.maxMs = Math.max(lt.maxMs, e.duration)
          longTaskLog.push({ end: e.startTime + e.duration, dur: e.duration })
        }
      })
      obs.observe({ type: 'longtask', buffered: true })
      cleanups.push(() => obs.disconnect())
      lt.supported = true
    } catch {
      lt.supported = false
    }
  }

  // --- event-driven sources ------------------------------------------------------------------
  on(window, 'online', () => emit({ online: true }))
  on(window, 'offline', () => emit({ online: false }))
  on(document, 'visibilitychange', () => {
    // restart the FPS window so a hidden period does not register as a frame-rate collapse
    frames = 0
    worst = 0
    lastFrame = windowStart = performance.now()
    if (!document.hidden && !raf) raf = requestAnimationFrame(loop)
    emit({ visibility: document.visibilityState, fps: document.hidden ? null : snapshot.fps })
  })
  on(window, 'resize', () => emit({ viewport: { w: window.innerWidth, h: window.innerHeight }, dpr: window.devicePixelRatio || 1 }))
  const conn = (navigator as Nav).connection
  on(conn, 'change', () => emit({ connection: readConnection() }))

  let alive = true
  cleanups.push(() => {
    alive = false
  })

  const nav = navigator as Nav
  if (nav.getBattery) {
    nav
      .getBattery()
      .then((b) => {
        if (!alive) return
        const read = () => emit({ battery: { level: b.level, charging: b.charging, chargingTime: b.chargingTime, dischargingTime: b.dischargingTime } })
        read()
        for (const ev of ['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange']) on(b, ev, read)
      })
      .catch(() => alive && emit({ battery: null }))
  }

  const readStorage = () => {
    navigator.storage
      ?.estimate?.()
      .then((est) => alive && emit({ storage: { usageMB: (est.usage ?? 0) / MB, quotaMB: (est.quota ?? 0) / MB } }))
      .catch(() => alive && emit({ storage: null }))
  }
  if (hasStorageEstimate()) {
    readStorage()
    const st = setInterval(readStorage, 30_000)
    cleanups.push(() => clearInterval(st))
  }

  // --- 1 Hz sampler --------------------------------------------------------------------------
  const sample = () => {
    // nothing to measure while the tab is hidden: skip the sample (no re-render of consumers)
    if (document.hidden) return
    const now = performance.now()
    const elapsed = now - windowStart
    const visible = !document.hidden
    let fps: number | null = null
    let frameMs: number | null = null
    let worstFrameMs: number | null = null
    if (visible && elapsed > 200) {
      // zero frames in a visible window is a real (blocked main thread) measurement, not "n/d"
      fps = (frames * 1000) / elapsed
      frameMs = frames > 0 ? elapsed / frames : elapsed
      worstFrameMs = frames > 0 ? Math.max(worst, now - lastFrame) : now - lastFrame
    }
    frames = 0
    worst = 0
    windowStart = now

    // drop long tasks that ended before the busy window, then measure the blocked share
    const cutoff = now - BUSY_WINDOW_MS
    while (longTaskLog.length && longTaskLog[0].end < cutoff) longTaskLog.shift()
    const blocked = longTaskLog.reduce((s, e) => s + Math.min(e.dur, e.end - cutoff), 0)
    lt.busy = Math.min(1, blocked / Math.max(1, Math.min(BUSY_WINDOW_MS, now)))

    const heap = readHeap()
    emit({
      ts: Date.now(),
      fps,
      frameMs,
      worstFrameMs,
      heap,
      uptimeMs: now,
      longTasks: { ...lt },
      online: navigator.onLine,
      visibility: document.visibilityState,
      history: {
        fps: push(snapshot.history.fps, fps),
        heapMB: push(snapshot.history.heapMB, heap ? heap.usedMB : null),
        busy: push(snapshot.history.busy, lt.busy),
      },
    })
  }
  const timer = setInterval(sample, SAMPLE_MS)
  cleanups.push(() => clearInterval(timer))

  return () => cleanups.splice(0).forEach((c) => c())
}

export function subscribeTelemetry(cb: () => void): () => void {
  listeners.add(cb)
  refs++
  if (refs === 1 && typeof window !== 'undefined') teardown = start()
  return () => {
    listeners.delete(cb)
    refs--
    if (refs === 0) {
      teardown?.()
      teardown = null
    }
  }
}

export function getTelemetrySnapshot(): TelemetrySnapshot {
  return snapshot
}
