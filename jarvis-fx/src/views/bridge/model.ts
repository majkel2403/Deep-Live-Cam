import type { Agent, AgentStatus, EventLevel, AgentTask } from '@/lib/agents'

/** Core modes shown in the segmented indicator and the big state label. */
export type CoreMode = 'standby' | 'analyze' | 'act' | 'alarm'

export const MODES: { id: CoreMode; seg: string; label: string; code: string }[] = [
  { id: 'standby', seg: 'Czuwanie', label: 'CZUWAM', code: '01' },
  { id: 'analyze', seg: 'Analiza', label: 'ANALIZUJĘ', code: '02' },
  { id: 'act', seg: 'Działanie', label: 'DZIAŁAM', code: '03' },
  { id: 'alarm', seg: 'Alarm', label: 'ALARM', code: '04' },
]

export type Tone = 'accent' | 'ok' | 'warn' | 'danger' | 'dim' | 'violet'

export const STATUS_META: Record<AgentStatus, { label: string; tone: Tone; pulse: boolean }> = {
  idle: { label: 'Bezczynny', tone: 'dim', pulse: false },
  thinking: { label: 'Myśli', tone: 'violet', pulse: true },
  running: { label: 'Działa', tone: 'accent', pulse: true },
  waiting: { label: 'Czeka', tone: 'warn', pulse: false },
  error: { label: 'Błąd', tone: 'danger', pulse: true },
  offline: { label: 'Offline', tone: 'dim', pulse: false },
}

export const LEVEL_META: Record<EventLevel, { tag: string; label: string; tone: Tone }> = {
  info: { tag: 'INFO', label: 'Informacja', tone: 'dim' },
  ok: { tag: ' OK ', label: 'Sukces', tone: 'ok' },
  warn: { tag: 'UWAG', label: 'Ostrzeżenie', tone: 'warn' },
  error: { tag: 'BŁĄD', label: 'Błąd', tone: 'danger' },
}

export const TASK_STATE: Record<AgentTask['state'], { label: string; tone: Tone }> = {
  active: { label: 'W toku', tone: 'accent' },
  queued: { label: 'W kolejce', tone: 'warn' },
  done: { label: 'Gotowe', tone: 'ok' },
  failed: { label: 'Nieudane', tone: 'danger' },
}

export const TEXT_TONE: Record<Tone, string> = {
  accent: 'text-jx-accent',
  ok: 'text-jx-ok',
  warn: 'text-jx-warn',
  danger: 'text-jx-danger',
  dim: 'text-jx-dim',
  violet: 'text-jx-violet',
}

export const BG_TONE: Record<Tone, string> = {
  accent: 'bg-jx-accent',
  ok: 'bg-jx-ok',
  warn: 'bg-jx-warn',
  danger: 'bg-jx-danger',
  dim: 'bg-jx-dim',
  violet: 'bg-jx-violet',
}

/** CSS colour for SVG / inline styles (follows the runtime hue through CSS vars). */
export const CSS_TONE: Record<Tone, string> = {
  accent: 'var(--jx-accent)',
  ok: 'var(--jx-ok)',
  warn: 'var(--jx-warn)',
  danger: 'var(--jx-danger)',
  dim: 'var(--jx-text-dim)',
  violet: 'var(--jx-violet)',
}

/** depth in the delegation tree (0 = root orchestrator) */
export function agentDepth(a: Agent, byId: Map<string, Agent>): number {
  let d = 0
  let cur = a
  const seen = new Set<string>()
  while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.id) && d < 6) {
    seen.add(cur.id)
    cur = byId.get(cur.parentId)!
    d++
  }
  return d
}

/** Roster sorted depth-first along the delegation tree, so children follow their parent. */
export function treeOrder(agents: Agent[]): { agent: Agent; depth: number; last: boolean }[] {
  const byId = new Map(agents.map((a) => [a.id, a]))
  const children = new Map<string, Agent[]>()
  const roots: Agent[] = []
  for (const a of agents) {
    if (a.parentId && byId.has(a.parentId)) {
      const list = children.get(a.parentId) ?? []
      list.push(a)
      children.set(a.parentId, list)
    } else roots.push(a)
  }
  const out: { agent: Agent; depth: number; last: boolean }[] = []
  const walk = (a: Agent, depth: number, last: boolean) => {
    out.push({ agent: a, depth, last })
    const kids = children.get(a.id) ?? []
    kids.forEach((k, i) => walk(k, depth + 1, i === kids.length - 1))
  }
  roots.forEach((r, i) => walk(r, 0, i === roots.length - 1))
  return out
}

export function fmtClock(ts: number, ms = false): string {
  const d = new Date(ts)
  const pad = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${ms ? `.${pad(d.getMilliseconds(), 3)}` : ''}`
}

export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

export function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
