import * as Tooltip from '@radix-ui/react-tooltip'
import { useAgents, type Agent } from '@/lib/agents'
import { useAccent, useQuality, useReducedMotion } from '@/lib/store'
import { AgentsRoster } from './AgentsRoster'
import { CoreStage } from './CoreStage'
import { EventLog } from './EventLog'
import { StatusStrip } from './StatusStrip'
import { TasksPanel } from './TasksPanel'
import { TelemetryPanel } from './TelemetryPanel'
import { useBridgeState } from './useBridgeState'
import './bridge.css'

const NO_AGENTS: Agent[] = []

/**
 * MOSTEK – Mission Control dashboard (first screen).
 *
 *  ┌──────────────────────── status strip (mode · key readouts · source) ───────────────────────┐
 *  │ telemetry (REAL browser) │        JARVIS core (R3F + radial SVG HUD)        │ agents roster │
 *  │                          ├──────────────────────────────────────────────────┼───────────────┤
 *  │                          │               live event log                     │ active tasks  │
 *  └──────────────────────────┴──────────────────────────────────────────────────┴───────────────┘
 *
 * Agent data comes from the shared orchestration source (useAgents); when that source is
 * synthetic every agent-derived panel carries a visible DEMO badge. Browser telemetry is measured live.
 * Below 1024 px the grid collapses into a single scrolling column.
 */
export default function BridgeView() {
  const { snapshot, status, source, detail } = useAgents()
  const bridge = useBridgeState(snapshot, status)
  const { hex, hex2 } = useAccent()
  const quality = useQuality()
  const reducedMotion = useReducedMotion()
  const agents = snapshot?.agents ?? NO_AGENTS

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="h-full overflow-y-auto overflow-x-hidden lg:overflow-hidden">
        <div className="bx-root">
          <div className="bx-strip">
            <StatusStrip agents={agents} agg={bridge.agg} mode={bridge.mode} source={source} status={status} errorSeq={bridge.errorSeq} reducedMotion={reducedMotion} />
          </div>
          <CoreStage snapshot={snapshot} bridge={bridge} accent={hex} accent2={hex2} quality={quality} reducedMotion={reducedMotion} />
          <div className="bx-agents min-h-0">
            <AgentsRoster agents={agents} source={source} status={status} detail={detail} reducedMotion={reducedMotion} />
          </div>
          <div className="bx-tele min-h-0">
            <TelemetryPanel reducedMotion={reducedMotion} />
          </div>
          <div className="bx-log min-h-0">
            <EventLog events={snapshot?.events ?? []} agents={agents} liveSince={bridge.liveSince} source={source} status={status} />
          </div>
          <div className="bx-tasks min-h-0">
            <TasksPanel tasks={snapshot?.tasks ?? []} agents={agents} now={snapshot?.ts ?? 0} reducedMotion={reducedMotion} />
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  )
}
