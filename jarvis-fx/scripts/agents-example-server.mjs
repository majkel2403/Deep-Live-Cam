#!/usr/bin/env node
/**
 * Example agent source for JARVIS FX: a complete SSE server with no dependencies (Node 20.19+ or 22.12+).
 *
 *   node scripts/agents-example-server.mjs            # http://127.0.0.1:8651/agents
 *   PORT=9000 node scripts/agents-example-server.mjs  # another port
 *
 * In the app: Agenci → Źródło → http://127.0.0.1:8651/agents (or set settings.agentSource).
 * Every SSE message carries one full OrchestrationSnapshot as JSON (src/lib/agents/types.ts).
 * Replace `simulate()` / `buildSnapshot()` with your orchestrator's state; the app reconnects on its own.
 */
import { createServer } from 'node:http'

const PORT = Number(process.env.PORT ?? 8651)
const SKILLS = { plan: 0.9, code: 0.4, search: 0.6, memory: 0.7, voice: 0.1, vision: 0.2 }

// Static roster: who delegates to whom.
const ROSTER = [
  { id: 'a1', name: 'Planista', role: 'orkiestrator', model: 'example-large', parentId: undefined },
  { id: 'a2', name: 'Kod', role: 'wykonawca', model: 'example-code', parentId: 'a1' },
  { id: 'a3', name: 'Wyszukiwanie', role: 'wykonawca', model: 'example-search', parentId: 'a1' },
]

// Mutable state the simulation moves; the snapshot is rebuilt from it on every tick.
const state = ROSTER.map((a) => ({ ...a, load: 0.3, history: [], uptime: [], queue: 0 }))
const events = []
let tick = 0

function simulate() {
  tick++
  for (const a of state) {
    a.load = Math.min(1, Math.max(0, a.load + (Math.random() - 0.5) * 0.2))
    a.history = [...a.history, a.load].slice(-40)
    a.uptime = [...a.uptime, Math.random() > 0.05].slice(-40)
    a.queue = Math.round(Math.random() * 4)
  }
  if (tick % 3 === 0) {
    const owner = state[tick % state.length]
    events.push({ id: `e${tick}`, ts: Date.now(), agentId: owner.id, level: 'info', text: 'Przetwarzam krok planu' })
  }
  events.splice(0, Math.max(0, events.length - 200))
}

function buildSnapshot() {
  return {
    ts: Date.now(),
    agents: state.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      model: a.model,
      status: a.load > 0.6 ? 'running' : 'idle',
      load: Number(a.load.toFixed(3)),
      latencyMs: Math.round(300 + a.load * 900),
      tokensPerMin: Math.round(2000 + a.load * 6000),
      successRate: 0.95,
      queue: a.queue,
      ...(a.parentId ? { parentId: a.parentId } : {}),
      skills: SKILLS,
      history: a.history,
      uptime: a.uptime,
    })),
    links: state
      .filter((a) => a.parentId)
      .map((a) => ({ source: a.parentId, target: a.id, kind: 'delegates', traffic: Math.round(a.load * 20) })),
    events,
    tasks: [{ id: 't1', title: 'Analiza logów', ownerId: 'a2', progress: (tick % 100) / 100, state: 'active', startedAt: Date.now() - 60_000 }],
  }
}

createServer((req, res) => {
  if (req.url !== '/agents') {
    res.writeHead(404).end('not found')
    return
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*', // the app runs on another origin (Vite dev server)
  })
  const send = () => res.write(`data: ${JSON.stringify(buildSnapshot())}\n\n`)
  send()
  const timer = setInterval(() => {
    simulate()
    send()
  }, 1000)
  req.on('close', () => clearInterval(timer))
}).listen(PORT, '127.0.0.1', () => {
  console.log(`agents SSE: http://127.0.0.1:${PORT}/agents`)
})
