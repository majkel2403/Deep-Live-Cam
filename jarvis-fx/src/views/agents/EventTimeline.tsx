import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { IconTimelineEvent } from '@tabler/icons-react'
import { Decipher, HudButton, Panel } from '@/hud'
import type { Agent, AgentEvent, EventLevel } from '@/lib/agents'
import { LEVEL_META, fmtTime } from './model'

const MAX_ROWS = 60
const LEVELS: EventLevel[] = ['info', 'ok', 'warn', 'error']

export interface EventTimelineProps {
  events: AgentEvent[]
  agents: Agent[]
  selected: Agent | null
  reduced: boolean
  className?: string
}

/**
 * Event timeline, newest on top. Filtered to the selected agent by default ("Wybrany"),
 * with a toggle for the whole fleet and per-level filter chips. New rows slide in with
 * Motion (motion/react, MIT); with reduced motion they simply appear.
 */
export function EventTimeline({ events, agents, selected, reduced, className = '' }: EventTimelineProps) {
  const [scope, setScope] = useState<'agent' | 'all'>('agent')
  const [hidden, setHidden] = useState<Set<EventLevel>>(() => new Set())
  const names = useMemo(() => new Map(agents.map((a) => [a.id, a.name])), [agents])

  const rows = useMemo(() => {
    const out: AgentEvent[] = []
    for (let i = events.length - 1; i >= 0 && out.length < MAX_ROWS; i--) {
      const e = events[i]
      if (scope === 'agent' && selected && e.agentId !== selected.id) continue
      if (hidden.has(e.level)) continue
      out.push(e)
    }
    return out
  }, [events, scope, selected, hidden])

  const counts = useMemo(() => {
    const c: Record<EventLevel, number> = { info: 0, ok: 0, warn: 0, error: 0 }
    for (const e of events) if (scope === 'all' || !selected || e.agentId === selected.id) c[e.level]++
    return c
  }, [events, scope, selected])

  const toggleLevel = (l: EventLevel) =>
    setHidden((h) => {
      const n = new Set(h)
      if (n.has(l)) n.delete(l)
      else n.add(l)
      return n
    })

  // strip the "Name: " prefix that sources commonly prepend – the agent is shown separately
  const textOf = (e: AgentEvent) => {
    const name = names.get(e.agentId)
    return name && e.text.startsWith(`${name}: `) ? e.text.slice(name.length + 2) : e.text
  }

  return (
    <Panel
      skin="kranox"
      className={className}
      icon={<IconTimelineEvent />}
      title={<Decipher text="Oś zdarzeń" />}
      code={scope === 'agent' && selected ? selected.name.toUpperCase() : 'CAŁA FLOTA'}
      bodyClassName="flex flex-col min-h-0 px-3 pb-2 pt-1.5 gap-1.5"
      actions={
        <div className="flex items-center gap-1" role="group" aria-label="Zakres zdarzeń">
          <HudButton size="sm" active={scope === 'agent'} onClick={() => setScope('agent')} disabled={!selected}>
            Wybrany
          </HudButton>
          <HudButton size="sm" active={scope === 'all'} onClick={() => setScope('all')}>
            Wszyscy
          </HudButton>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtr poziomów">
        {LEVELS.map((l) => {
          const on = !hidden.has(l)
          return (
            <button
              key={l}
              type="button"
              className="ag-level-chip"
              aria-pressed={on}
              style={{ color: LEVEL_META[l].css }}
              onClick={() => toggleLevel(l)}
              title={on ? `Ukryj poziom ${LEVEL_META[l].label}` : `Pokaż poziom ${LEVEL_META[l].label}`}
            >
              {LEVEL_META[l].label}
              <span className="jx-num text-jx-text">{counts[l]}</span>
            </button>
          )
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1" role="log" aria-live="polite" aria-relevant="additions" aria-label="Zdarzenia agentów">
        {rows.length === 0 ? (
          <p className="jx-label text-[0.62rem] py-4 text-center">
            {events.length ? 'Brak zdarzeń dla bieżącego filtru' : 'Strumień zdarzeń pusty'}
          </p>
        ) : (
          <ol className="ag-timeline">
            <AnimatePresence initial={false}>
              {rows.map((e) => (
                <motion.li
                  key={e.id}
                  layout={reduced ? false : 'position'}
                  initial={reduced ? false : { opacity: 0, x: -14, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
                  className="ag-tl-row"
                  data-level={e.level}
                  style={{ ['--lvl' as string]: LEVEL_META[e.level].css }}
                >
                  <span className="ag-tl-node" aria-hidden="true" />
                  <time className="jx-num text-[0.66rem] text-jx-dim shrink-0" dateTime={new Date(e.ts).toISOString()}>
                    {fmtTime(e.ts)}
                  </time>
                  <span className="ag-tl-level jx-label text-[0.56rem] shrink-0">{LEVEL_META[e.level].label}</span>
                  {scope === 'all' && <span className="font-head text-[0.7rem] text-jx-accent tracking-wider shrink-0">{names.get(e.agentId) ?? e.agentId}</span>}
                  <span className="text-[0.76rem] text-jx-text truncate">{textOf(e)}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
      </div>
    </Panel>
  )
}
