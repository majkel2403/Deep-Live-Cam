import { useMemo } from 'react'
import { motion } from 'motion/react'
import IconCircleCheck from '@tabler/icons-react/icons/IconCircleCheck'
import IconCircleDashed from '@tabler/icons-react/icons/IconCircleDashed'
import IconCircleX from '@tabler/icons-react/icons/IconCircleX'
import IconListCheck from '@tabler/icons-react/icons/IconListCheck'
import IconLoader2 from '@tabler/icons-react/icons/IconLoader2'
import { Glitch, Panel } from '@/hud'
import type { Agent, AgentTask } from '@/lib/agents'
import { BG_TONE, CSS_TONE, TASK_STATE, TEXT_TONE, fmtElapsed } from './model'

const ORDER: Record<AgentTask['state'], number> = { active: 0, queued: 1, failed: 2, done: 3 }
const ICON = {
  active: <IconLoader2 className="animate-[jx-spin_1.6s_linear_infinite]" />,
  queued: <IconCircleDashed />,
  done: <IconCircleCheck />,
  failed: <IconCircleX />,
}

export function TasksPanel({
  tasks,
  agents,
  now,
  reducedMotion,
  noData = false,
  status = 'live',
}: {
  tasks: AgentTask[]
  agents: Agent[]
  now: number
  reducedMotion: boolean
  /** no snapshot yet – say so instead of claiming an idle core */
  noData?: boolean
  status?: 'connecting' | 'live' | 'error'
}) {
  const names = useMemo(() => new Map(agents.map((a) => [a.id, a.name])), [agents])
  const sorted = useMemo(
    () =>
      // stable order (state, then age) so rows do not swap places on every progress tick
      [...tasks].sort((a, b) => ORDER[a.state] - ORDER[b.state] || (a.state === 'done' || a.state === 'failed' ? b.startedAt - a.startedAt : a.startedAt - b.startedAt)).slice(0, 8),
    [tasks],
  )
  const active = tasks.filter((t) => t.state === 'active').length
  const queued = tasks.filter((t) => t.state === 'queued').length
  const overall = active ? tasks.filter((t) => t.state === 'active').reduce((s, t) => s + t.progress, 0) / active : 0

  return (
    <Panel
      title="Zadania"
      icon={<IconListCheck />}
      code={`${active} W TOKU · ${queued} KOL.`}
      skin="nefrex"
      className="bx-tasks h-full"
      bodyClassName="flex flex-col px-2.5 pb-2 pt-1.5 gap-1.5"
    >
      <div className="flex items-center gap-2 shrink-0" aria-label={`Średni postęp zadań w toku: ${Math.round(overall * 100)}%`}>
        <span className="jx-label text-[0.625rem]">Postęp łączny</span>
        <div className="bx-bar-track relative h-1 flex-1">
          <motion.div className="bx-bar-fill absolute inset-0 bg-jx-accent" initial={false} animate={{ scaleX: overall }} transition={{ duration: reducedMotion ? 0 : 0.8 }} />
        </div>
        <span className="jx-num text-[0.66rem] text-jx-accent">{Math.round(overall * 100)}%</span>
      </div>
      <ul className="bx-fade-b relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden m-0 p-0 pb-2 list-none flex flex-col gap-1" aria-label="Lista zadań">
        {sorted.length === 0 && (
          <li className="jx-label py-2 jx-caret">{noData ? (status === 'error' ? 'Brak danych – błąd łącza ze źródłem' : 'Łączenie ze źródłem') : 'Brak zadań – rdzeń czuwa'}</li>
        )}
        {sorted.map((t) => {
          const st = TASK_STATE[t.state]
          const pct = Math.round(t.progress * 100)
          return (
            <motion.li
              key={t.id}
              layout={!reducedMotion}
              initial={reducedMotion ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: t.state === 'done' ? 0.6 : 1, x: 0 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col gap-[3px] px-1.5 py-1 border border-jx-line/30 bg-[hsl(var(--jx-hue)_80%_30%/0.07)]"
              aria-label={`${t.title}, ${names.get(t.ownerId) ?? t.ownerId}: ${st.label}, ${pct}%`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`${TEXT_TONE[st.tone]} [&>svg]:size-3.5 shrink-0`} aria-hidden="true">
                  {ICON[t.state]}
                </span>
                {t.state === 'failed' ? (
                  <Glitch mode="once" trigger={t.id} className="min-w-0 truncate">
                    <span className="font-ui text-[0.74rem] text-jx-danger truncate">{t.title}</span>
                  </Glitch>
                ) : (
                  <span className="font-ui text-[0.74rem] text-jx-text truncate">{t.title}</span>
                )}
                <span className="flex-1" />
                <span className="jx-label text-[0.625rem] text-jx-accent truncate max-w-20">{names.get(t.ownerId) ?? t.ownerId}</span>
                {(t.state === 'active' || t.state === 'queued') && (
                  <span className="jx-num text-[0.625rem] text-jx-dim" title="Czas od zlecenia">
                    {fmtElapsed(now - t.startedAt)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="bx-bar-track relative h-[5px] flex-1" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Postęp: ${t.title}`}>
                  <motion.div
                    className={`bx-bar-fill absolute inset-0 ${BG_TONE[st.tone]}`}
                    style={{ boxShadow: `0 0 5px ${CSS_TONE[st.tone]}` }}
                    initial={false}
                    animate={{ scaleX: t.state === 'queued' ? 0.02 : Math.max(0.02, t.progress) }}
                    transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 22 }}
                  />
                </div>
                <span className={`jx-num text-[0.625rem] w-8 text-right ${TEXT_TONE[st.tone]}`}>{t.state === 'queued' ? '—' : `${pct}%`}</span>
                <span className={`jx-label text-[0.625rem] w-[4.4rem] text-right whitespace-nowrap ${TEXT_TONE[st.tone]}`}>{st.label}</span>
              </div>
            </motion.li>
          )
        })}
      </ul>
    </Panel>
  )
}
