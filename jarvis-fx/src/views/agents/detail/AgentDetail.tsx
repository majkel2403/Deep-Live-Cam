import { useMemo } from 'react'
import { IconCpu, IconHierarchy2, IconStack2 } from '@tabler/icons-react'
import { Decipher, Panel, SegBar, StatusDot } from '@/hud'
import type { Agent, OrchestrationSnapshot, SkillAxis } from '@/lib/agents'
import { SEMANTIC, STATUS_META, TASK_STATE, fmtInt, fmtPct, fmtPct1, statusHex } from '../model'
import { ArcGauge, SkillRadar } from './charts'
import { LoadSparkline } from './LoadSparkline'
import { UptimeTracker } from './UptimeTracker'

export interface AgentDetailProps {
  agent: Agent | null
  snapshot: OrchestrationSnapshot | null
  team: Record<SkillAxis, number>
  accent: string
  accent2: string
  reduced: boolean
  className?: string
}

const LAT_MAX = 1000
const TONE_TEXT = { ok: 'text-jx-ok', warn: 'text-jx-warn', danger: 'text-jx-danger' } as const
const TOK_MAX = 4000

function latencyColor(ms: number, accent: string) {
  if (ms >= 800) return SEMANTIC.danger
  if (ms >= 500) return SEMANTIC.warn
  return accent
}

/** Detail dossier for the selected agent: radar, gauges, load history, uptime tracker, KPIs. */
export function AgentDetail({ agent, snapshot, team, accent, accent2, reduced, className = '' }: AgentDetailProps) {
  const parent = useMemo(() => (agent?.parentId ? snapshot?.agents.find((a) => a.id === agent.parentId) : undefined), [agent, snapshot])
  const children = useMemo(() => (agent ? (snapshot?.agents.filter((a) => a.parentId === agent.id) ?? []) : []), [agent, snapshot])
  const task = useMemo(() => {
    if (!agent || !snapshot) return undefined
    const own = snapshot.tasks.filter((t) => t.ownerId === agent.id)
    return own.find((t) => t.state === 'active') ?? own.find((t) => t.state === 'queued') ?? own[own.length - 1]
  }, [agent, snapshot])

  if (!agent) {
    return (
      <Panel className={className} title={<Decipher text="Profil agenta" />} code="AGT-—" bodyClassName="grid place-items-center">
        <p className="jx-label jx-caret">{snapshot ? 'Wybierz agenta w grafie lub w rejestrze' : 'Oczekiwanie na dane'}</p>
      </Panel>
    )
  }

  const st = STATUS_META[agent.status]
  const col = statusHex(agent.status, accent)
  const succTone = agent.successRate >= 0.95 ? 'ok' : agent.successRate >= 0.85 ? 'warn' : 'danger'
  const dotTone = agent.status === 'running' ? 'ok' : agent.status === 'waiting' ? 'warn' : agent.status === 'error' ? 'danger' : agent.status === 'offline' ? 'dim' : 'accent'

  return (
    <Panel
      className={className}
      aug="tl-clip tr-clip-x br-clip bl-clip border"
      title={<Decipher text="Profil agenta" />}
      code={`AGT-${agent.id.slice(0, 8).toUpperCase()}`}
      bodyClassName="flex flex-col gap-2 p-3 pt-2 min-h-0"
    >
      {/* identity */}
      <div className="flex items-start gap-3 min-w-0">
        <div className="ag-sigil shrink-0" style={{ color: col }} aria-hidden="true">
          <span>{agent.name.slice(0, 2).toUpperCase()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <Decipher as="h3" text={agent.name.toUpperCase()} replayKey={agent.id} className="jx-display text-lg leading-none text-jx-text jx-glow-text truncate" />
            <span className="ag-chip" style={{ color: st.css }}>
              <StatusDot tone={dotTone} pulse={st.pulse && !reduced} />
              {st.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 jx-label text-[0.62rem] normal-case tracking-wider">
            <span className="text-jx-text">{agent.role || '—'}</span>
            <span className="inline-flex items-center gap-1">
              <IconCpu className="size-3 text-jx-accent" aria-hidden="true" />
              <span className="font-mono">{agent.model || 'n/d'}</span>
            </span>
            <span className="inline-flex items-center gap-1" title="Nadzorca → podwładni">
              <IconHierarchy2 className="size-3 text-jx-accent" aria-hidden="true" />
              {parent ? parent.name : 'korzeń'} → {children.length ? children.map((c) => c.name).join(', ') : 'brak podwładnych'}
            </span>
          </div>
        </div>
      </div>

      {/* current task */}
      <div className="ag-task flex items-center gap-2 px-2 py-1 min-w-0">
        <IconStack2 className="size-3.5 text-jx-accent shrink-0" aria-hidden="true" />
        {task ? (
          <>
            <span className="jx-label text-[0.6rem] shrink-0" style={{ color: TASK_STATE[task.state].css }}>
              {TASK_STATE[task.state].label}
            </span>
            <span className="text-[0.78rem] truncate flex-1">{task.title}</span>
            <span className="w-24 shrink-0">
              <SegBar value={task.progress} segments={16} tone={task.state === 'failed' ? 'danger' : task.state === 'done' ? 'ok' : 'accent'} />
            </span>
            <span className="jx-num text-[0.7rem] w-9 text-right">{fmtPct(task.progress)}</span>
          </>
        ) : (
          <span className="jx-label text-[0.62rem]">Brak przypisanych zadań</span>
        )}
      </div>

      {/* radar + gauges + KPIs */}
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-2">
        <div className="ag-subframe relative min-h-0 flex flex-col">
          <span className="jx-label text-[0.6rem] px-2 pt-1.5 flex items-center gap-2">
            Umiejętności
            <span className="flex-1" />
            <span className="inline-flex items-center gap-1 normal-case tracking-wider">
              <i className="ag-key" style={{ background: accent }} /> agent
            </span>
            <span className="inline-flex items-center gap-1 normal-case tracking-wider">
              <i className="ag-key ag-key--dash" style={{ borderColor: accent2 }} /> śr. zespołu
            </span>
          </span>
          <div className="flex-1 min-h-0">
            <SkillRadar skills={agent.skills} team={team} name={agent.name} accent={accent} accent2={accent2} reduced={reduced} />
          </div>
        </div>
        <div className="min-h-0 grid grid-rows-[minmax(0,1fr)_auto] gap-2">
          <div className="grid grid-cols-2 gap-2 min-h-0">
            <div className="ag-subframe min-h-0 p-1">
              <ArcGauge
                value={agent.latencyMs}
                max={LAT_MAX}
                display={fmtInt(agent.latencyMs)}
                unit="ms"
                label="Latencja"
                color={latencyColor(agent.latencyMs, accent)}
                accent={accent}
                reduced={reduced}
              />
            </div>
            <div className="ag-subframe min-h-0 p-1">
              <ArcGauge
                value={agent.tokensPerMin}
                max={TOK_MAX}
                display={agent.tokensPerMin >= 1000 ? `${(agent.tokensPerMin / 1000).toFixed(1).replace('.', ',')}k` : fmtInt(agent.tokensPerMin)}
                unit="tok/min"
                label="Tokeny"
                color={accent2}
                accent={accent}
                reduced={reduced}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="ag-subframe px-2 py-1.5 flex flex-col gap-1 min-w-0">
              <span className="jx-label text-[0.58rem] truncate">Skuteczność</span>
              <span className={`jx-num text-base leading-none jx-glow-text ${TONE_TEXT[succTone]}`}>{fmtPct1(agent.successRate)}</span>
              <SegBar value={agent.successRate} segments={16} tone={succTone} />
            </div>
            <div className="ag-subframe px-2 py-1.5 flex flex-col gap-1 min-w-0">
              <span className="jx-label text-[0.58rem] truncate">Kolejka zadań</span>
              <span className={`jx-num text-base leading-none jx-glow-text ${agent.queue >= 3 ? 'text-jx-warn' : 'text-jx-accent'}`}>{fmtInt(agent.queue)}</span>
              <div className="flex gap-[3px] h-2" role="meter" aria-label="Zadania w kolejce" aria-valuemin={0} aria-valuemax={8} aria-valuenow={agent.queue}>
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} className={`flex-1 ${i < agent.queue ? (agent.queue >= 3 ? 'bg-jx-warn' : 'bg-jx-accent') + ' shadow-[0_0_4px_currentColor]' : 'bg-jx-accent-dim/30'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* history + uptime */}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 shrink-0">
        <div className="h-[58px]">
          <LoadSparkline history={agent.history} color={col} accent={accent} />
        </div>
        <UptimeTracker uptime={agent.uptime} />
      </div>
    </Panel>
  )
}
