import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import IconArrowBarToDown from '@tabler/icons-react/icons/IconArrowBarToDown'
import IconTerminal2 from '@tabler/icons-react/icons/IconTerminal2'
import { Decipher, Glitch, HudButton, Panel } from '@/hud'
import type { Agent, AgentEvent, EventLevel } from '@/lib/agents'
import { LEVEL_META, TEXT_TONE, fmtClock } from './model'
import { DemoBadge } from './DemoBadge'

const MAX_LINES = 90
type Filter = 'all' | EventLevel

const FILTERS: { id: Filter; label: string; short: string }[] = [
  { id: 'all', label: 'Wszystko', short: 'Wsz.' },
  { id: 'info', label: 'Info', short: 'Inf.' },
  { id: 'ok', label: 'OK', short: 'OK' },
  { id: 'warn', label: 'Uwaga', short: 'Uw.' },
  { id: 'error', label: 'Błędy', short: 'Bł.' },
]

/** Strip the "Name: " prefix that sources often put in front of the message. */
function splitText(e: AgentEvent, name: string | undefined): string {
  if (name && e.text.startsWith(`${name}: `)) return e.text.slice(name.length + 2)
  return e.text
}

/**
 * One log line. Whether it plays the ARWES decipher / PowerGlitch entrance is decided once at
 * mount (fresh events only), so re-renders or filter changes never replay old lines.
 */
const LogLine = memo(function LogLine({ e, agentName, fresh }: { e: AgentEvent; agentName: string; fresh: boolean }) {
  const [animate] = useState(fresh)
  const meta = LEVEL_META[e.level]
  const text = splitText(e, agentName)
  const body = animate ? <Decipher text={text} duration={0.55} /> : <span>{text}</span>
  return (
    <li className="bx-log-line font-mono text-[0.74rem] leading-[1.35rem]" data-level={e.level}>
      <time className="jx-num text-[0.66rem] text-jx-dim whitespace-nowrap" dateTime={new Date(e.ts).toISOString()}>
        {fmtClock(e.ts)}
        <span className="bx-ms">{fmtClock(e.ts, true).slice(8)}</span>
      </time>
      <span className={`bx-tag ${TEXT_TONE[meta.tone]}`} title={meta.label}>
        {meta.tag.trim()}
      </span>
      <span className="bx-log-agent text-jx-accent truncate">{agentName}</span>
      <span className={`truncate ${e.level === 'error' ? 'text-jx-danger' : e.level === 'warn' ? 'text-jx-warn' : 'text-jx-text'}`}>
        {e.level === 'error' && animate ? (
          <Glitch mode="once" trigger={e.id}>
            {body}
          </Glitch>
        ) : (
          body
        )}
      </span>
    </li>
  )
})

export function EventLog({
  events,
  agents,
  liveSince,
  source,
  status,
}: {
  events: AgentEvent[]
  agents: Agent[]
  /** only events newer than this get the entrance animation */
  liveSince: number
  source: { label: string; synthetic: boolean }
  status: 'connecting' | 'live' | 'error'
}) {
  const [filter, setFilter] = useState<Filter>('all')
  /** id of the newest visible line when auto-follow was paused (null = following the tail) */
  const [pausedAt, setPausedAt] = useState<string | null>(null)
  /** data-clock timestamp: lines at or before it never play the entrance (set on filter switches) */
  const [animFrom, setAnimFrom] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const follow = pausedAt === null

  const names = useMemo(() => new Map(agents.map((a) => [a.id, a.name])), [agents])
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: events.length, info: 0, ok: 0, warn: 0, error: 0 }
    for (const e of events) c[e.level]++
    return c
  }, [events])
  const lines = useMemo(() => (filter === 'all' ? events : events.filter((e) => e.level === filter)).slice(-MAX_LINES), [events, filter])
  const lastError = useMemo(() => [...events].reverse().find((e) => e.level === 'error'), [events])
  // lines that arrived after the user paused auto-follow (works with a full, rolling buffer too)
  const unread = useMemo(() => {
    if (pausedAt === null) return 0
    const i = lines.findIndex((e) => e.id === pausedAt)
    return i < 0 ? lines.length : lines.length - 1 - i
  }, [lines, pausedAt])

  // auto-scroll: stick to the bottom unless the user scrolled up to read
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && follow) el.scrollTop = el.scrollHeight
  }, [lines, follow])

  const pause = () => setPausedAt(lines.at(-1)?.id ?? '')
  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 28
    if (atBottom && !follow) setPausedAt(null)
    else if (!atBottom && follow) pause()
  }
  const jump = () => setPausedAt(null)
  const chooseFilter = (f: Filter) => {
    setFilter(f)
    setPausedAt(null)
    // lines revealed by the new filter are history: no decipher replay
    setAnimFrom(events.at(-1)?.ts ?? 0)
  }

  return (
    <Panel
      title={
        <>
          <span className="xl:hidden">Dziennik</span>
          <span className="hidden xl:inline">Dziennik zdarzeń</span>
        </>
      }
      icon={<IconTerminal2 />}
      code={<span className="hidden xl:inline">{`LOG·${String(counts.all).padStart(3, '0')}`}</span>}
      aug="tl-clip tr-clip br-clip bl-clip-y border"
      className="bx-log h-full"
      bodyClassName="relative flex flex-col"
      actions={
        <div className="flex items-center gap-1 flex-wrap justify-end" role="group" aria-label="Filtr poziomu zdarzeń">
          {source.synthetic && (
            <span className="hidden xl:contents">
              <DemoBadge synthetic label={source.label} status={status} compact focusable={false} />
            </span>
          )}
          {FILTERS.map((f) => (
            <HudButton key={f.id} size="sm" active={filter === f.id} onClick={() => chooseFilter(f.id)} className="px-1.5! py-0.5! text-[0.625rem]!" aria-label={`${f.label} (${counts[f.id]})`}>
              <span className={f.id === 'error' && counts.error ? 'text-jx-danger' : undefined}>
                <span className="xl:hidden">{f.short}</span>
                <span className="hidden xl:inline">{f.label}</span>
              </span>
              <span className="jx-num text-jx-dim hidden xl:inline">{counts[f.id]}</span>
            </HudButton>
          ))}
          <HudButton size="sm" active={follow} onClick={() => (follow ? pause() : jump())} icon={<IconArrowBarToDown />} className="px-1.5! py-0.5!" aria-label="Automatyczne przewijanie" title="Automatyczne przewijanie" />
        </div>
      }
    >
      <div ref={scroller} onScroll={onScroll} className="bx-log-scroll bx-fade-t flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-1" tabIndex={0} role="log" aria-live="off" aria-label="Strumień zdarzeń orkiestracji">
        {lines.length === 0 ? (
          <p className="jx-label px-3 py-2 jx-caret">
            {status === 'connecting' ? 'Łączenie ze źródłem' : status === 'error' && !events.length ? 'Brak danych – błąd łącza ze źródłem' : 'Brak zdarzeń dla wybranego filtra'}
          </p>
        ) : (
          <ol className="m-0 p-0 list-none">
            {lines.map((e) => (
              <LogLine key={e.id} e={e} agentName={names.get(e.agentId) ?? e.agentId} fresh={e.ts >= liveSince && e.ts > animFrom} />
            ))}
          </ol>
        )}
        <span className="block h-px" />
      </div>
      {!follow && unread > 0 && (
        <button type="button" onClick={jump} className="jx-aug-btn absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 text-[0.66rem]" data-augmented-ui="tl-clip br-clip border">
          Nowe zdarzenia: {unread} ↓
        </button>
      )}
      {/* screen readers only hear errors, not the full firehose */}
      <p className="bx-sr-only" aria-live="assertive">
        {lastError && lastError.ts >= liveSince ? `Błąd: ${lastError.text}` : ''}
      </p>
    </Panel>
  )
}
