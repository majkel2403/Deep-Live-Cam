/**
 * View-model helpers for the Agents view: status/level metadata (Polish labels + colours),
 * defensive normalisation of snapshots coming from remote sources, sorting and formatting.
 */
import {
  SKILL_AXES,
  type Agent,
  type AgentEvent,
  type AgentLink,
  type AgentStatus,
  type AgentTask,
  type EventLevel,
  type OrchestrationSnapshot,
  type SkillAxis,
} from '@/lib/agents'

export const STATUS_IDS: AgentStatus[] = ['running', 'thinking', 'waiting', 'idle', 'error', 'offline']

/** Semantic colours shared with tokens.css (three/echarts/canvas need concrete values). */
export const SEMANTIC = {
  ok: '#3dffa8',
  warn: '#ffb000',
  danger: '#ff3b5c',
  violet: '#8a7dff',
  offline: '#5d6b78',
} as const

export const STATUS_META: Record<AgentStatus, { label: string; short: string; css: string; pulse: boolean }> = {
  running: { label: 'Działa', short: 'DZIAŁA', css: 'var(--jx-ok)', pulse: true },
  thinking: { label: 'Myśli', short: 'MYŚLI', css: 'var(--jx-violet)', pulse: true },
  waiting: { label: 'Czeka', short: 'CZEKA', css: 'var(--jx-warn)', pulse: false },
  idle: { label: 'Bezczynny', short: 'GOTOWY', css: 'var(--jx-accent)', pulse: false },
  error: { label: 'Błąd', short: 'BŁĄD', css: 'var(--jx-danger)', pulse: true },
  offline: { label: 'Offline', short: 'OFFLINE', css: 'var(--jx-text-dim)', pulse: false },
}

/** Concrete hex colour for a status; idle follows the runtime accent hue. */
export function statusHex(status: AgentStatus, accentHex: string): string {
  switch (status) {
    case 'running':
      return SEMANTIC.ok
    case 'thinking':
      return SEMANTIC.violet
    case 'waiting':
      return SEMANTIC.warn
    case 'error':
      return SEMANTIC.danger
    case 'offline':
      return SEMANTIC.offline
    default:
      return accentHex
  }
}

export const LEVEL_META: Record<EventLevel, { label: string; css: string }> = {
  info: { label: 'INFO', css: 'var(--jx-accent)' },
  ok: { label: 'OK', css: 'var(--jx-ok)' },
  warn: { label: 'UWAGA', css: 'var(--jx-warn)' },
  error: { label: 'BŁĄD', css: 'var(--jx-danger)' },
}

export const LINK_META: Record<AgentLink['kind'], { label: string; hint: string }> = {
  delegates: { label: 'Deleguje', hint: 'zlecenia od nadzorcy' },
  reports: { label: 'Raportuje', hint: 'wyniki do nadzorcy' },
  tool: { label: 'Narzędzie', hint: 'wywołanie innego agenta' },
}

export const TASK_STATE: Record<AgentTask['state'], { label: string; css: string }> = {
  queued: { label: 'W kolejce', css: 'var(--jx-warn)' },
  active: { label: 'W toku', css: 'var(--jx-accent)' },
  done: { label: 'Gotowe', css: 'var(--jx-ok)' },
  failed: { label: 'Nieudane', css: 'var(--jx-danger)' },
}

const LEVELS: EventLevel[] = ['info', 'ok', 'warn', 'error']
const LINK_KINDS: AgentLink['kind'][] = ['delegates', 'reports', 'tool']
const TASK_STATES: AgentTask['state'][] = ['queued', 'active', 'done', 'failed']

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/**
 * Remote sources are untrusted: coerce every field into the shape the widgets expect
 * so a partial / malformed snapshot degrades gracefully instead of crashing the view.
 */
export function normalizeSnapshot(s: OrchestrationSnapshot | null): OrchestrationSnapshot | null {
  if (!s || !Array.isArray(s.agents)) return null
  const seen = new Set<string>()
  const agents: Agent[] = []
  for (const a of s.agents) {
    if (!a || (typeof a.id !== 'string' && typeof a.id !== 'number')) continue
    const id = String(a.id)
    if (seen.has(id)) continue
    seen.add(id)
    agents.push({
      id,
      name: String(a.name ?? id),
      role: String(a.role ?? ''),
      model: String(a.model ?? ''),
      status: STATUS_IDS.includes(a.status) ? a.status : 'offline',
      load: clamp01(num(a.load)),
      latencyMs: Math.max(0, num(a.latencyMs)),
      tokensPerMin: Math.max(0, num(a.tokensPerMin)),
      successRate: clamp01(num(a.successRate, 1)),
      queue: Math.max(0, Math.round(num(a.queue))),
      parentId: a.parentId != null ? String(a.parentId) : undefined,
      skills: Object.fromEntries(SKILL_AXES.map((x) => [x.id, clamp01(num(a.skills?.[x.id]))])) as Record<SkillAxis, number>,
      history: Array.isArray(a.history) ? a.history.slice(-120).map((v) => clamp01(num(v))) : [],
      uptime: Array.isArray(a.uptime) ? a.uptime.slice(-96).map(Boolean) : [],
    })
  }
  const linkKeys = new Set<string>()
  const links: AgentLink[] = []
  for (const l of Array.isArray(s.links) ? s.links : []) {
    if (!l) continue
    const source = String(l.source)
    const target = String(l.target)
    const kind = LINK_KINDS.includes(l.kind) ? l.kind : 'delegates'
    const key = `${source}>${target}:${kind}`
    if (!seen.has(source) || !seen.has(target) || source === target || linkKeys.has(key)) continue
    linkKeys.add(key)
    links.push({ source, target, kind, traffic: Math.max(0, num(l.traffic)) })
  }
  const events: AgentEvent[] = (Array.isArray(s.events) ? s.events : [])
    .slice(-200)
    .filter((e) => e && e.agentId != null)
    .map((e, i) => ({
      id: String(e.id ?? `ev-${i}`),
      ts: num(e.ts, Date.now()),
      agentId: String(e.agentId),
      level: LEVELS.includes(e.level) ? e.level : 'info',
      text: String(e.text ?? ''),
    }))
  const tasks: AgentTask[] = (Array.isArray(s.tasks) ? s.tasks : [])
    .filter((t) => t && t.ownerId != null)
    .map((t, i) => ({
      id: String(t.id ?? `task-${i}`),
      title: String(t.title ?? ''),
      ownerId: String(t.ownerId),
      progress: clamp01(num(t.progress)),
      state: TASK_STATES.includes(t.state) ? t.state : 'queued',
      startedAt: num(t.startedAt, Date.now()),
    }))
  return { ts: num(s.ts, Date.now()), agents, links, events, tasks }
}

export type SortKey = 'name' | 'status' | 'load' | 'latencyMs' | 'tokensPerMin' | 'successRate' | 'queue'
export interface SortState {
  key: SortKey
  dir: 'asc' | 'desc'
}

const STATUS_RANK: Record<AgentStatus, number> = { error: 0, running: 1, thinking: 2, waiting: 3, idle: 4, offline: 5 }

export function sortAgents(agents: Agent[], sort: SortState): Agent[] {
  const m = sort.dir === 'asc' ? 1 : -1
  return [...agents].sort((a, b) => {
    let d: number
    if (sort.key === 'name') d = a.name.localeCompare(b.name, 'pl')
    else if (sort.key === 'status') d = STATUS_RANK[a.status] - STATUS_RANK[b.status]
    else d = a[sort.key] - b[sort.key]
    return d === 0 ? a.name.localeCompare(b.name, 'pl') : d * m
  })
}

/* ---------------- formatting (pl-PL) ---------------- */

const intFmt = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 })
const pctFmt = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

export const fmtInt = (v: number) => intFmt.format(Math.round(v))
export const fmtPct = (v: number) => `${Math.round(v * 100)}%`
export const fmtPct1 = (v: number) => `${pctFmt.format(v * 100)}%`
export const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('pl-PL', { hour12: false })

/** Escape text before interpolating it into HTML strings (graph tooltips render innerHTML). */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
}

/** Aggregate KPIs for the status strip. */
export function summarize(snap: OrchestrationSnapshot) {
  const active = snap.agents.filter((a) => a.status === 'running' || a.status === 'thinking').length
  const errors = snap.agents.filter((a) => a.status === 'error').length
  const traffic = snap.links.reduce((s, l) => s + l.traffic, 0)
  const avgLatency = snap.agents.length ? snap.agents.reduce((s, a) => s + a.latencyMs, 0) / snap.agents.length : 0
  const tokens = snap.agents.reduce((s, a) => s + a.tokensPerMin, 0)
  const tasksActive = snap.tasks.filter((t) => t.state === 'active').length
  const tasksQueued = snap.tasks.filter((t) => t.state === 'queued').length
  return { active, errors, traffic, avgLatency, tokens, tasksActive, tasksQueued, total: snap.agents.length }
}

/** Mean skill profile of the whole roster (radar comparison layer). */
export function teamSkills(agents: Agent[]): Record<SkillAxis, number> {
  const out = Object.fromEntries(SKILL_AXES.map((x) => [x.id, 0])) as Record<SkillAxis, number>
  if (!agents.length) return out
  for (const a of agents) for (const x of SKILL_AXES) out[x.id] += a.skills[x.id] / agents.length
  return out
}

/** Validate the agent-source spec typed by the user. Returns an error message (Polish) or null. */
export function validateSourceSpec(spec: string): string | null {
  const v = spec.trim()
  if (!v) return 'Podaj adres źródła albo wpisz „demo”.'
  if (v.toLowerCase() === 'demo') return null
  if (!/^(wss?|https?):\/\//i.test(v)) return 'Dozwolone: demo, ws://, wss://, http:// lub https://'
  try {
    new URL(v)
  } catch {
    return 'Niepoprawny adres URL.'
  }
  return null
}
