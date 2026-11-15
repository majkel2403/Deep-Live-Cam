/**
 * Agent-orchestration data contract (STABLE – consumed by Bridge and Agents views).
 * A source emits full snapshots; views never mutate them.
 */
export type AgentStatus = 'idle' | 'thinking' | 'running' | 'waiting' | 'error' | 'offline'

export type SkillAxis = 'plan' | 'code' | 'search' | 'memory' | 'voice' | 'vision'
export const SKILL_AXES: { id: SkillAxis; label: string }[] = [
  { id: 'plan', label: 'Planowanie' },
  { id: 'code', label: 'Kod' },
  { id: 'search', label: 'Wyszukiwanie' },
  { id: 'memory', label: 'Pamięć' },
  { id: 'voice', label: 'Głos' },
  { id: 'vision', label: 'Wizja' },
]

export interface Agent {
  id: string
  name: string
  role: string
  model: string
  status: AgentStatus
  /** 0..1 utilisation */
  load: number
  latencyMs: number
  tokensPerMin: number
  /** 0..1 over the recent window */
  successRate: number
  queue: number
  /** orchestration parent (delegator) */
  parentId?: string
  /** 0..1 capability scores for radar charts */
  skills: Record<SkillAxis, number>
  /** last N load samples (oldest first) for sparklines */
  history: number[]
  /** uptime ticks: true = healthy, false = incident (for tracker bars) */
  uptime: boolean[]
}

export interface AgentLink {
  source: string
  target: string
  kind: 'delegates' | 'reports' | 'tool'
  /** messages per minute */
  traffic: number
}

export type EventLevel = 'info' | 'ok' | 'warn' | 'error'

export interface AgentEvent {
  id: string
  ts: number
  agentId: string
  level: EventLevel
  text: string
}

export interface AgentTask {
  id: string
  title: string
  ownerId: string
  /** 0..1 */
  progress: number
  state: 'queued' | 'active' | 'done' | 'failed'
  startedAt: number
}

export interface OrchestrationSnapshot {
  ts: number
  agents: Agent[]
  links: AgentLink[]
  /** newest last, capped (~200) */
  events: AgentEvent[]
  tasks: AgentTask[]
}

export interface AgentSource {
  /** human label shown in the UI, e.g. "DEMO · symulator" or "ws://localhost:8651/agents" */
  label: string
  kind: 'demo' | 'ws' | 'sse'
  /** true when the data is synthetic – the UI must show a DEMO badge */
  synthetic: boolean
  subscribe(cb: (snap: OrchestrationSnapshot) => void, onStatus?: (s: 'connecting' | 'live' | 'error', detail?: string) => void): () => void
}
