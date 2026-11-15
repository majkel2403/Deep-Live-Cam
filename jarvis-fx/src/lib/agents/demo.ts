import type { Agent, AgentEvent, AgentLink, AgentSource, AgentStatus, AgentTask, EventLevel, OrchestrationSnapshot, SkillAxis } from './types'

/**
 * DEMO source – a deterministic-ish simulator so the HUD can be developed without a backend.
 * It is always labelled synthetic; connect a real WS/SSE source in Settings → Agent source.
 * Roster mirrors the Jarvis ecosystem: JARVIS (orchestrator), Hermes (planner), Jev (judge/router) + tool agents.
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

const TASKS = ['Poranny briefing', 'Analiza rynku BTC', 'Refaktor modułu okien', 'Streszczenie notatek', 'Plan podróży', 'Przegląd PR', 'Transkrypcja nagrania', 'Raport dnia']

export function createDemoSource(): AgentSource {
  return {
    label: 'DEMO · symulator',
    kind: 'demo',
    synthetic: true,
    subscribe(cb, onStatus) {
      let seq = 0
      let tick = 0
      const rnd = (() => {
        let s = 1337
        return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
      })()
      const agents: Agent[] = ROSTER.map((r) => ({
        ...r,
        status: 'idle' as AgentStatus,
        load: rnd() * 0.3,
        latencyMs: 120 + rnd() * 300,
        tokensPerMin: 0,
        successRate: 0.9 + rnd() * 0.1,
        queue: 0,
        history: Array.from({ length: 40 }, () => rnd() * 0.3),
        uptime: Array.from({ length: 48 }, () => rnd() > 0.04),
      }))
      const links: AgentLink[] = agents
        .filter((a) => a.parentId)
        .flatMap((a) => [
          { source: a.parentId!, target: a.id, kind: 'delegates' as const, traffic: 0 },
          { source: a.id, target: a.parentId!, kind: 'reports' as const, traffic: 0 },
        ])
      const events: AgentEvent[] = []
      const tasks: AgentTask[] = []

      const push = (agentId: string, level: EventLevel) => {
        const a = agents.find((x) => x.id === agentId)!
        const pool = LINES[level]
        events.push({ id: `e${seq++}`, ts: Date.now(), agentId, level, text: `${a.name}: ${pool[Math.floor(rnd() * pool.length)]}` })
        if (events.length > 200) events.splice(0, events.length - 200)
      }

      const step = () => {
        tick++
        // spawn tasks
        if (tasks.filter((t) => t.state === 'active' || t.state === 'queued').length < 4 && rnd() < 0.35) {
          const owner = agents[1 + Math.floor(rnd() * (agents.length - 1))]
          tasks.push({ id: `t${seq++}`, title: TASKS[Math.floor(rnd() * TASKS.length)], ownerId: owner.id, progress: 0, state: 'queued', startedAt: Date.now() })
          push('jarvis', 'info')
        }
        for (const t of tasks) {
          if (t.state === 'queued' && rnd() < 0.5) t.state = 'active'
          if (t.state === 'active') {
            t.progress = Math.min(1, t.progress + rnd() * 0.12)
            if (rnd() < 0.015) {
              t.state = 'failed'
              push(t.ownerId, 'error')
            } else if (t.progress >= 1) {
              t.state = 'done'
              push(t.ownerId, 'ok')
            }
          }
        }
        if (tasks.length > 12) tasks.splice(0, tasks.length - 12)

        for (const a of agents) {
          const busy = tasks.some((t) => t.ownerId === a.id && t.state === 'active')
          const target = busy ? 0.55 + rnd() * 0.4 : a.id === 'jarvis' ? 0.25 + rnd() * 0.2 : rnd() * 0.15
          a.load += (target - a.load) * 0.35
          a.history.push(a.load)
          if (a.history.length > 40) a.history.shift()
          a.latencyMs = Math.max(40, a.latencyMs + (rnd() - 0.5) * 60 + (busy ? 20 : -10))
          a.tokensPerMin = busy ? Math.round(800 + rnd() * 2400) : Math.round(rnd() * 120)
          a.queue = tasks.filter((t) => t.ownerId === a.id && t.state === 'queued').length
          const prev = a.status
          a.status = busy ? (rnd() < 0.3 ? 'thinking' : 'running') : a.queue ? 'waiting' : 'idle'
          if (rnd() < 0.004) a.status = 'error'
          if (a.status === 'error' && prev !== 'error') push(a.id, 'error')
          else if (busy && rnd() < 0.18) push(a.id, rnd() < 0.15 ? 'warn' : 'info')
          a.successRate = Math.max(0.6, Math.min(1, a.successRate + (a.status === 'error' ? -0.03 : 0.004)))
          if (tick % 10 === 0) {
            a.uptime.push(a.status !== 'error')
            if (a.uptime.length > 48) a.uptime.shift()
          }
        }
        for (const l of links) {
          const src = agents.find((a) => a.id === l.source)!
          l.traffic = Math.round(src.load * (l.kind === 'delegates' ? 40 : 25) + rnd() * 4)
        }
        cb({ ts: Date.now(), agents: agents.map((a) => ({ ...a, history: [...a.history], uptime: [...a.uptime] })), links: links.map((l) => ({ ...l })), events: [...events], tasks: tasks.map((t) => ({ ...t })) } satisfies OrchestrationSnapshot)
      }

      onStatus?.('live')
      step()
      const timer = setInterval(step, 1000)
      return () => clearInterval(timer)
    },
  }
}
