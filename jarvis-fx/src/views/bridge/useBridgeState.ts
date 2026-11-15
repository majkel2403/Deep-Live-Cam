import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentEvent, OrchestrationSnapshot } from '@/lib/agents'
import { playBleep } from '@/lib/sound'
import type { CoreMode } from './model'

export interface BridgeAggregates {
  total: number
  active: number
  thinking: number
  running: number
  waiting: number
  errored: number
  /** mean utilisation 0..1 */
  avgLoad: number
  avgLatency: number
  tokensPerMin: number
  successRate: number
  tasksActive: number
  tasksQueued: number
  tasksDone: number
  tasksFailed: number
  eventsPerMin: number
  lastEvent: AgentEvent | null
}

const EMPTY: BridgeAggregates = {
  total: 0,
  active: 0,
  thinking: 0,
  running: 0,
  waiting: 0,
  errored: 0,
  avgLoad: 0,
  avgLatency: 0,
  tokensPerMin: 0,
  successRate: 0,
  tasksActive: 0,
  tasksQueued: 0,
  tasksDone: 0,
  tasksFailed: 0,
  eventsPerMin: 0,
  lastEvent: null,
}

export function aggregate(snap: OrchestrationSnapshot | null): BridgeAggregates {
  if (!snap || !snap.agents.length) return { ...EMPTY, lastEvent: snap?.events.at(-1) ?? null }
  const a = snap.agents
  const online = a.filter((x) => x.status !== 'offline')
  const count = (s: string) => a.filter((x) => x.status === s).length
  const now = snap.ts
  return {
    total: a.length,
    thinking: count('thinking'),
    running: count('running'),
    active: count('thinking') + count('running'),
    waiting: count('waiting'),
    errored: count('error'),
    avgLoad: online.reduce((s, x) => s + x.load, 0) / Math.max(1, online.length),
    avgLatency: online.reduce((s, x) => s + x.latencyMs, 0) / Math.max(1, online.length),
    tokensPerMin: a.reduce((s, x) => s + x.tokensPerMin, 0),
    successRate: online.reduce((s, x) => s + x.successRate, 0) / Math.max(1, online.length),
    tasksActive: snap.tasks.filter((t) => t.state === 'active').length,
    tasksQueued: snap.tasks.filter((t) => t.state === 'queued').length,
    tasksDone: snap.tasks.filter((t) => t.state === 'done').length,
    tasksFailed: snap.tasks.filter((t) => t.state === 'failed').length,
    eventsPerMin: snap.events.filter((e) => e.ts > now - 60_000).length,
    lastEvent: snap.events.at(-1) ?? null,
  }
}

/** Raw (un-smoothed) mode for one snapshot. */
function rawMode(snap: OrchestrationSnapshot, agg: BridgeAggregates): CoreMode {
  const recentError = snap.events.some((e) => e.level === 'error' && e.ts > snap.ts - 6000)
  if (agg.errored > 0 || recentError) return 'alarm'
  const early = snap.tasks.filter((t) => t.state === 'active' && t.progress < 0.3).length
  const late = snap.tasks.filter((t) => t.state === 'active' && t.progress >= 0.3).length
  if (agg.active === 0 && agg.tasksActive === 0) return agg.tasksQueued > 0 ? 'analyze' : 'standby'
  const analyzeScore = agg.thinking + early + agg.tasksQueued * 0.5
  const actScore = agg.running + late
  return analyzeScore > actScore ? 'analyze' : 'act'
}

const HOLD_MS = 2600
const ALARM_HOLD_MS = 4000
const ALERT_GAP_MS = 6000

export interface BridgeState {
  agg: BridgeAggregates
  mode: CoreMode
  /** increments for every new event (drives 3D shockwaves) */
  eventSeq: number
  /** increments for every new error event (drives glitches) */
  errorSeq: number
  /** events newer than this timestamp arrived after mount (only these get the decipher entrance) */
  liveSince: number
}

/**
 * Derives the dashboard state from orchestration snapshots:
 *  - aggregates for readouts
 *  - a debounced core mode (hysteresis so the label does not flicker every tick)
 *  - event / error counters, plus a throttled 'alert' bleep on new errors
 */
export function useBridgeState(snapshot: OrchestrationSnapshot | null, status: 'connecting' | 'live' | 'error'): BridgeState {
  const agg = useMemo(() => aggregate(snapshot), [snapshot])
  const [mode, setMode] = useState<CoreMode>('standby')
  const [seq, setSeq] = useState({ eventSeq: 0, errorSeq: 0 })
  const held = useRef({ mode: 'standby' as CoreMode, candidate: 'standby' as CoreMode, since: 0, lockUntil: 0 })
  const seen = useRef<{ lastId: string | null; lastTs: number; primed: boolean }>({ lastId: null, lastTs: 0, primed: false })
  const lastAlert = useRef(0)
  const [liveSince] = useState(() => Date.now())

  useEffect(() => {
    if (!snapshot) return
    const now = Date.now()

    // --- mode with hysteresis -----------------------------------------------------------
    const raw = status === 'live' ? rawMode(snapshot, agg) : 'standby'
    const h = held.current
    if (raw === 'alarm' && h.mode !== 'alarm') {
      h.mode = 'alarm'
      h.candidate = 'alarm'
      h.lockUntil = now + ALARM_HOLD_MS
      setMode('alarm')
    } else if (raw !== h.mode && now >= h.lockUntil) {
      if (raw !== h.candidate) {
        h.candidate = raw
        h.since = now
      } else if (now - h.since >= HOLD_MS) {
        h.mode = raw
        h.lockUntil = now + HOLD_MS
        setMode(raw)
      }
    } else if (raw === h.mode) {
      h.candidate = raw
      if (raw === 'alarm') h.lockUntil = Math.max(h.lockUntil, now + 1500)
    }

    // --- new events ---------------------------------------------------------------------
    const s = seen.current
    const events = snapshot.events
    if (!s.primed) {
      s.primed = true
      s.lastId = events.at(-1)?.id ?? null
      s.lastTs = events.at(-1)?.ts ?? 0
      return
    }
    let startIdx = 0
    if (s.lastId) {
      const idx = events.findIndex((e) => e.id === s.lastId)
      startIdx = idx >= 0 ? idx + 1 : events.findIndex((e) => e.ts > s.lastTs)
      if (startIdx < 0) startIdx = events.length
    }
    const fresh = events.slice(startIdx)
    if (!fresh.length) return
    s.lastId = fresh.at(-1)!.id
    s.lastTs = fresh.at(-1)!.ts
    const errors = fresh.filter((e) => e.level === 'error').length
    setSeq((p) => ({ eventSeq: p.eventSeq + fresh.length, errorSeq: p.errorSeq + errors }))
    if (errors && now - lastAlert.current > ALERT_GAP_MS) {
      lastAlert.current = now
      playBleep('alert')
    }
  }, [snapshot, agg, status])

  return { agg, mode, eventSeq: seq.eventSeq, errorSeq: seq.errorSeq, liveSince }
}
