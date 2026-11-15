/**
 * Agenci – agent-orchestration view.
 *
 *  ┌ status strip: KPIs + source indicator (DEMO badge) + source form ───────────────┐
 *  │ topology (react-force-graph-3d / 2d fallback)  │ agent dossier (ECharts, visx,   │
 *  │                                                │ Tremor-style uptime tracker)    │
 *  │ sortable roster                                │ event timeline (Motion)         │
 *  └────────────────────────────────────────────────┴─────────────────────────────────┘
 *
 * Data comes from the shared, ref-counted `useAgents()` connection (demo simulator or a real
 * WS/SSE source). Snapshots are normalised defensively before reaching any widget.
 */
import { useCallback, useMemo, useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useAgents } from '@/lib/agents'
import { useAccent, useQuality, useReducedMotion } from '@/lib/store'
import { playBleep } from '@/lib/sound'
import { AgentDetail } from './detail/AgentDetail'
import { EventTimeline } from './EventTimeline'
import { TopologyPanel } from './graph/TopologyPanel'
import { normalizeSnapshot, teamSkills } from './model'
import { RosterTable } from './RosterTable'
import { StatusStrip } from './StatusStrip'
import './agents.css'

export default function AgentsView() {
  const { snapshot: raw, status, detail, source } = useAgents()
  const snapshot = useMemo(() => normalizeSnapshot(raw), [raw])
  const accent = useAccent()
  const reduced = useReducedMotion()
  const quality = useQuality()
  const [picked, setPicked] = useState<string | null>(null)

  // keep a valid selection: fall back to the orchestrator root (or first agent) when the
  // picked agent disappears or nothing has been picked yet
  const agents = snapshot?.agents
  const selected = useMemo(() => {
    if (!agents?.length) return null
    return agents.find((a) => a.id === picked) ?? agents.find((a) => !a.parentId) ?? agents[0]
  }, [agents, picked])
  const selectedId = selected?.id ?? null

  const select = useCallback(
    (id: string) => {
      if (id !== selectedId) playBleep('click')
      setPicked(id)
    },
    [selectedId],
  )

  const team = useMemo(() => teamSkills(agents ?? []), [agents])

  const sourceInfo = useMemo(() => ({ ...source, status, detail }), [source, status, detail])
  const waitHint = status === 'error' ? (detail ?? 'Błąd łącza ze źródłem') : status === 'connecting' ? 'Łączenie ze źródłem danych' : 'Oczekiwanie na migawkę'

  return (
    <Tooltip.Provider delayDuration={150} skipDelayDuration={300}>
      <div className="ag-view h-full min-h-0 flex flex-col gap-3">
        <StatusStrip snapshot={snapshot} source={sourceInfo} />
        <div className="flex-1 min-h-0 grid gap-3 grid-cols-1 xl:grid-cols-[minmax(0,1.32fr)_minmax(0,1fr)] overflow-y-auto xl:overflow-visible">
          <div className="min-h-0 flex flex-col gap-3">
            <TopologyPanel
              className="flex-1 min-h-[300px]"
              snapshot={snapshot}
              selectedId={selectedId}
              onSelect={select}
              accent={accent.hex}
              accent2={accent.hex2}
              reduced={reduced}
              quality={quality}
              waitHint={waitHint}
              synthetic={source.synthetic}
            />
            <RosterTable className="shrink-0 max-h-[46%] min-h-[180px]" agents={agents ?? []} selectedId={selectedId} onSelect={select} accent={accent.hex} reduced={reduced} />
          </div>
          <div className="min-h-0 flex flex-col gap-3">
            <AgentDetail className="flex-[1.5] min-h-[400px]" agent={selected} snapshot={snapshot} team={team} accent={accent.hex} accent2={accent.hex2} reduced={reduced} />
            <EventTimeline className="flex-1 min-h-[200px]" events={snapshot?.events ?? []} agents={agents ?? []} selected={selected} reduced={reduced} />
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  )
}
