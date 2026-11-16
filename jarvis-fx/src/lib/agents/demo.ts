import type { Agent, AgentEvent, AgentLink, AgentSource, AgentStatus, AgentTask, EventLevel, OrchestrationSnapshot, SkillAxis } from './types'

/**
 * DEMO source – a deterministic-ish simulator so the HUD can be developed without a backend.
 * It is always labelled synthetic; connect a real WS/SSE source in Settings → Agent source.
 * Roster mirrors the Jarvis ecosystem: JARVIS (orchestrator), Hermes (planner), Jev (judge/router) + tool agents.
 *
 * Behaviour model (tuned so a session reads like a real assistant, not a permanent fire drill):
 *  - demand rises and falls in slow waves (~2.5 min), so the swarm alternates between quiet
 *    stand-by, planning bursts (fresh tasks → owners "think") and execution (owners "run");
 *  - incidents are rare: a task fails or an agent faults roughly once every 1.5–2 minutes on
 *    average, the fault lasts a few seconds and is reported as an `error` event;
 *  - the simulator opens calm: no incidents in the last seconds of warm-up or the first live
 *    seconds, so the first paint is never an alarm that the data did not earn.
 */
type Seed = Pick<Agent, 'id' | 'name' | 'role' | 'model' | 'parentId'> & { skills: Record<SkillAxis, number> }

const ROSTER: Seed[] = [
  { id: 'jarvis', name: 'JARVIS', role: 'Orkiestrator', model: 'core-runtime', skills: { plan: 0.8, code: 0.5, search: 0.5, memory: 0.9, voice: 0.9, vision: 0.4 } },
  { id: 'hermes', name: 'Hermes', role: 'Planista / wykonawca', model: 'hermes-4', parentId: 'jarvis', skills: { plan: 0.95, code: 0.8, search: 0.7, memory: 0.6, voice: 0.3, vision: 0.4 } },
  { id: 'jev', name: 'Jev', role: 'Sędzia intencji', model: 'jev-system-one', parentId: 'jarvis', skills: { plan: 0.6, code: 0.2, search: 0.3, memory: 0.5, voice: 0.4, vision: 0.2 } },
  { id: 'kowal', name: 'Kowal', role: 'Kod i build', model: 'coder', parentId: 'hermes', skills: { plan: 0.5, code: 0.97, search: 0.4, memory: 0.4, voice: 0.1, vision: 0.2 } },
  { id: 'zwiad', name: 'Zwiadowca', role: 'Wyszukiwanie WWW', model: 'search', parentId: 'hermes', skills: { plan: 0.3, code: 0.2, search: 0.95, memory: 0.5, voice: 0.1, vision: 0.3 } },
  { id: 'kronika', name: 'Kronikarz', role: 'Pamięć i notatki', model: 'memory-store', parentId: 'jarvis', skills: { plan: 0.3, code: 0.2, search: 0.6, memory: 0.98, voice: 0.2, vision: 0.1 } },
  { id: 'lektor', name: 'Lektor', role: 'Mowa i słuch', model: 'tts/stt', parentId: 'jarvis', skills: { plan: 0.1, code: 0.05, search: 0.1, memory: 0.3, voice: 0.98, vision: 0.1 } },
  { id: 'oko', name: 'Oko', role: 'Wizja / ekran', model: 'vision', parentId: 'hermes', skills: { plan: 0.2, code: 0.2, search: 0.3, memory: 0.3, voice: 0.1, vision: 0.96 } },
  { id: 'straz', name: 'Strażnik', role: 'Uprawnienia i ryzyko', model: 'policy', parentId: 'jev', skills: { plan: 0.4, code: 0.3, search: 0.2, memory: 0.4, voice: 0.2, vision: 0.2 } },
]

const LINES: Record<EventLevel, string[]> = {
  info: ['przyjął zadanie', 'deleguje krok planu', 'odczytuje kontekst pulpitu', 'wywołuje narzędzie', 'synchronizuje pamięć', 'aktualizuje plan', 'oczekuje na wynik narzędzia'],
  ok: ['krok zakończony', 'weryfikacja OK', 'wynik zapisany', 'odpowiedź dostarczona'],
  warn: ['wysoka latencja', 'ponawia z innym parametrem', 'czeka na zgodę użytkownika', 'budżet tur bliski limitu'],
  error: ['narzędzie zwróciło błąd', 'przekroczono limit czasu', 'odmowa uprawnień'],
}

/** Cross-links where one agent calls another as a tool (memory lookups, intent checks…). */
const TOOL_LINKS: [string, string][] = [
  ['hermes', 'kronika'],
  ['oko', 'kronika'],
  ['lektor', 'jev'],
  ['kowal', 'straz'],
]

/** Simulated seconds run silently on subscribe so history, events and tasks are populated at first paint. */
const WARMUP_STEPS = 90
/** No incidents during the last CALM_BEFORE warm-up steps and the first CALM_AFTER live steps. */
const CALM_BEFORE = 12
const CALM_AFTER = 20
/** Demand wave period (simulated seconds). */
const DEMAND_PERIOD = 150
/** Per active task, per second. ~2–3 active tasks on average → a failure every ~3 min. */
const TASK_FAIL_P = 0.002
/** Whole swarm, per second: chance that one busy agent faults (→ every ~3 min). */
const AGENT_FAULT_P = 0.006
/** Minimum simulated seconds between two incidents (no alarm storms). */
const INCIDENT_GAP = 40

const TASKS = ['Poranny briefing', 'Analiza rynku BTC', 'Refaktor modułu okien', 'Streszczenie notatek', 'Plan podróży', 'Przegląd PR', 'Transkrypcja nagrania', 'Raport dnia']

interface SimAgent extends Agent {
  /** resting latency (ms) this agent drifts back to */
  baseLatency: number
  /** long-run success rate this agent recovers to */
  baseSuccess: number
  /** remaining seconds of an ongoing fault */
  faultFor: number
  /** a fault happened since the last uptime sample */
  incident: boolean
}

export function createDemoSource(): AgentSource {
  return {
    label: 'DEMO · symulator',
    kind: 'demo',
    synthetic: true,
    subscribe(cb, onStatus) {
      let seq = 0
      let tick = 0
      let lastIncident = -INCIDENT_GAP
      // simulation clock: starts WARMUP_STEPS seconds in the past, then follows wall time
      let clock = Date.now() - WARMUP_STEPS * 1000
      const rnd = (() => {
        let s = 1337
        return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
      })()
      const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
      const agents: SimAgent[] = ROSTER.map((r) => {
        const baseLatency = 120 + rnd() * 300
        return {
          ...r,
          status: 'idle' as AgentStatus,
          load: rnd() * 0.3,
          latencyMs: baseLatency,
          baseLatency,
          tokensPerMin: 0,
          successRate: 0.95 + rnd() * 0.05,
          baseSuccess: 0.94 + rnd() * 0.055,
          queue: 0,
          history: Array.from({ length: 40 }, () => rnd() * 0.3),
          uptime: Array.from({ length: 48 }, () => rnd() > 0.03),
          faultFor: 0,
          incident: false,
        }
      })
      const links: AgentLink[] = [
        ...agents.filter((a) => a.parentId).flatMap((a): AgentLink[] => [
          { source: a.parentId!, target: a.id, kind: 'delegates', traffic: 0 },
          { source: a.id, target: a.parentId!, kind: 'reports', traffic: 0 },
        ]),
        ...TOOL_LINKS.map(([source, target]): AgentLink => ({ source, target, kind: 'tool', traffic: 0 })),
      ]
      const events: AgentEvent[] = []
      const tasks: AgentTask[] = []

      const push = (agentId: string, level: EventLevel) => {
        const a = agents.find((x) => x.id === agentId)!
        events.push({ id: `e${seq++}`, ts: clock, agentId, level, text: `${a.name}: ${pick(LINES[level])}` })
        if (events.length > 200) events.splice(0, events.length - 200)
      }

      const step = (emit = true) => {
        tick++
        const calm = (tick > WARMUP_STEPS - CALM_BEFORE && tick <= WARMUP_STEPS + CALM_AFTER) || tick - lastIncident < INCIDENT_GAP
        // slow demand wave (0..1) with a little jitter; phase chosen so warm-up ends mid-burst
        const demand = Math.max(0, Math.min(1, 0.5 + 0.55 * Math.sin(((tick - 30) / DEMAND_PERIOD) * Math.PI * 2) + (rnd() - 0.5) * 0.2))
        const open = tasks.filter((t) => t.state === 'active' || t.state === 'queued').length
        const cap = Math.round(demand * 4)

        // spawn tasks – JARVIS takes the request and queues it for a sub-agent
        let dispatched = false
        if (open < cap && rnd() < 0.08 + demand * 0.3) {
          // prefer a free sub-agent and a request that is not already in flight
          const openTasks = tasks.filter((t) => t.state === 'active' || t.state === 'queued')
          const subs = agents.slice(1)
          const free = subs.filter((a) => !openTasks.some((t) => t.ownerId === a.id))
          const owner = pick(free.length ? free : subs)
          const fresh = TASKS.filter((title) => !openTasks.some((t) => t.title === title))
          tasks.push({ id: `t${seq++}`, title: pick(fresh.length ? fresh : TASKS), ownerId: owner.id, progress: 0, state: 'queued', startedAt: clock })
          push('jarvis', 'info')
          dispatched = true
        }
        for (const t of tasks) {
          if (t.state === 'queued' && rnd() < 0.35) {
            t.state = 'active'
            if (rnd() < 0.5) push(t.ownerId, 'info')
          } else if (t.state === 'active') {
            // planning phase is slower than execution
            t.progress = Math.min(1, t.progress + rnd() * (t.progress < 0.3 ? 0.06 : 0.1))
            if (!calm && rnd() < TASK_FAIL_P) {
              t.state = 'failed'
              lastIncident = tick
              push(t.ownerId, 'error')
            } else if (t.progress >= 1) {
              t.state = 'done'
              push(t.ownerId, 'ok')
            }
          }
        }
        if (tasks.length > 12) tasks.splice(0, tasks.length - 12)

        // rare agent fault: one busy agent fails for a few seconds
        if (!calm && rnd() < AGENT_FAULT_P) {
          const busy = agents.filter((a) => tasks.some((t) => t.ownerId === a.id && t.state === 'active'))
          const victim = busy.length ? pick(busy) : null
          if (victim && victim.faultFor === 0) {
            lastIncident = tick
            victim.faultFor = 2 + Math.floor(rnd() * 3)
            victim.incident = true
            push(victim.id, 'error')
          }
        }

        const openNow = tasks.filter((t) => t.state === 'active' || t.state === 'queued').length
        for (const a of agents) {
          const own = tasks.find((t) => t.ownerId === a.id && t.state === 'active')
          const isRoot = !a.parentId
          a.queue = tasks.filter((t) => t.ownerId === a.id && t.state === 'queued').length
          if (a.faultFor > 0) {
            a.faultFor--
            a.status = 'error'
          } else if (own) {
            // fresh tasks are mostly planned ("thinks"), later ones executed ("runs")
            a.status = own.progress < 0.3 ? (rnd() < 0.75 ? 'thinking' : 'running') : rnd() < 0.12 ? 'thinking' : 'running'
          } else if (isRoot) {
            a.status = dispatched || tasks.some((t) => t.state === 'queued') ? 'thinking' : openNow > 2 ? 'running' : 'idle'
          } else a.status = a.queue ? 'waiting' : 'idle'

          const busy = a.status === 'running' || a.status === 'thinking'
          const target = a.status === 'error' ? 0.15 : busy ? (isRoot ? 0.35 + openNow * 0.08 : 0.55 + rnd() * 0.4) : isRoot ? 0.2 + rnd() * 0.12 : rnd() * 0.12
          a.load += (target - a.load) * 0.35
          a.history.push(a.load)
          if (a.history.length > 40) a.history.shift()
          // latency drifts back to the agent's resting value, rises with load
          const latTarget = a.baseLatency * (1 + a.load * 0.9)
          a.latencyMs = Math.max(40, a.latencyMs + (latTarget - a.latencyMs) * 0.2 + (rnd() - 0.5) * 40)
          const tokTarget = busy ? 900 + a.load * 2400 : rnd() * 120
          a.tokensPerMin = Math.round(a.tokensPerMin + (tokTarget - a.tokensPerMin) * 0.5)
          if (busy && rnd() < 0.12) {
            if (rnd() < 0.18) {
              push(a.id, 'warn')
              a.latencyMs += 180
            } else push(a.id, 'info')
          }
          a.successRate = a.status === 'error' ? Math.max(0.6, a.successRate - 0.02) : a.successRate + (a.baseSuccess - a.successRate) * 0.03
          if (tick % 10 === 0) {
            a.uptime.push(!a.incident)
            a.incident = false
            if (a.uptime.length > 48) a.uptime.shift()
          }
        }
        for (const l of links) {
          const src = agents.find((a) => a.id === l.source)!
          const scale = l.kind === 'delegates' ? 40 : l.kind === 'reports' ? 25 : 14
          l.traffic = Math.round(src.load * scale + rnd() * (l.kind === 'tool' ? 2 : 4))
        }
        if (!emit) return
        cb({
          ts: clock,
          // strip simulator-internal fields: consumers get the plain contract shape
          agents: agents.map(({ baseLatency: _b, baseSuccess: _s, faultFor: _f, incident: _i, ...a }) => ({ ...a, history: [...a.history], uptime: [...a.uptime] })),
          links: links.map((l) => ({ ...l })),
          events: [...events],
          tasks: tasks.map((t) => ({ ...t })),
        } satisfies OrchestrationSnapshot)
      }

      for (let i = 0; i < WARMUP_STEPS; i++) {
        step(false)
        clock += 1000
      }
      clock = Date.now()
      onStatus?.('live')
      step()
      const timer = setInterval(() => {
        // a hidden tab gets no new data (saves the whole dashboard re-rendering in the background)
        if (typeof document !== 'undefined' && document.hidden) return
        clock = Date.now()
        step()
      }, 1000)
      return () => clearInterval(timer)
    },
  }
}
