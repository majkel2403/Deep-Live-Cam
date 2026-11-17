import { memo, useMemo, type ReactNode } from 'react'
import { motion } from 'motion/react'
import IconArrowUpRight from '@tabler/icons-react/icons/IconArrowUpRight'
import IconTopologyStar3 from '@tabler/icons-react/icons/IconTopologyStar3'
import { Binoculars } from '@phosphor-icons/react/dist/csr/Binoculars'
import { BookOpenText } from '@phosphor-icons/react/dist/csr/BookOpenText'
import { Cpu } from '@phosphor-icons/react/dist/csr/Cpu'
import { Eye } from '@phosphor-icons/react/dist/csr/Eye'
import { Hammer } from '@phosphor-icons/react/dist/csr/Hammer'
import { Microphone } from '@phosphor-icons/react/dist/csr/Microphone'
import { Robot } from '@phosphor-icons/react/dist/csr/Robot'
import { Scales } from '@phosphor-icons/react/dist/csr/Scales'
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { TreeStructure } from '@phosphor-icons/react/dist/csr/TreeStructure'
import { HudButton, Panel, StatusDot } from '@/hud'
import type { Agent } from '@/lib/agents'
import { navigate } from '@/lib/router'
import { BG_TONE, CSS_TONE, STATUS_META, TEXT_TONE, fmtCompact, treeOrder } from './model'
import { DemoBadge } from './DemoBadge'
import { Sparkline } from './Sparkline'

/** Avatar glyphs (Phosphor Icons, MIT) for the known roster; anything else gets a robot. */
const AVATAR: Record<string, ReactNode> = {
  jarvis: <Cpu weight="duotone" />,
  hermes: <TreeStructure weight="duotone" />,
  jev: <Scales weight="duotone" />,
  kowal: <Hammer weight="duotone" />,
  zwiad: <Binoculars weight="duotone" />,
  kronika: <BookOpenText weight="duotone" />,
  lektor: <Microphone weight="duotone" />,
  oko: <Eye weight="duotone" />,
  straz: <ShieldCheck weight="duotone" />,
}

const DOT_TONE = { accent: 'accent', ok: 'ok', warn: 'warn', danger: 'danger', dim: 'dim', violet: 'accent' } as const

const AgentRow = memo(function AgentRow({ agent: a, depth, last, reducedMotion }: { agent: Agent; depth: number; last: boolean; reducedMotion: boolean }) {
  const st = STATUS_META[a.status]
  const hot = a.status === 'running' || a.status === 'thinking'
  const loadTone = a.status === 'error' ? 'danger' : a.load > 0.85 ? 'warn' : st.tone === 'violet' ? 'violet' : 'accent'
  return (
    <li
      className={`group flex flex-[1_0_auto] max-h-16 items-stretch gap-1.5 px-2 py-[3px] border-b border-jx-line/25 last:border-b-0 ${a.status === 'error' ? 'bg-[color-mix(in_srgb,var(--jx-danger)_10%,transparent)]' : ''}`}
      aria-label={`${a.name}, ${a.role}: ${st.label}, obciążenie ${Math.round(a.load * 100)}%, latencja ${Math.round(a.latencyMs)} ms`}
    >
      {Array.from({ length: Math.max(0, depth - 1) }, (_, i) => (
        <span key={i} className="w-3 shrink-0" />
      ))}
      {depth > 0 && <span className="bx-tree" data-last={last ? 'true' : 'false'} aria-hidden="true" />}
      <span
        className={`grid place-items-center size-6 shrink-0 self-center border ${hot ? 'border-jx-accent text-jx-accent shadow-[var(--jx-glow-sm)]' : 'border-jx-line text-jx-dim'} [&>svg]:size-4`}
        style={a.status === 'error' ? { color: 'var(--jx-danger)', borderColor: 'var(--jx-danger)' } : a.status === 'thinking' ? { color: 'var(--jx-violet)', borderColor: 'var(--jx-violet)' } : undefined}
        aria-hidden="true"
      >
        {AVATAR[a.id] ?? <Robot weight="duotone" />}
      </span>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-[3px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-head font-semibold text-[0.8rem] tracking-wider uppercase text-jx-text truncate">{a.name}</span>
          <StatusDot tone={DOT_TONE[st.tone]} pulse={st.pulse} />
          <span className={`jx-label text-[0.625rem] ${TEXT_TONE[st.tone]} truncate`}>{st.label}</span>
          <span className="flex-1" />
          <span className={`jx-num text-[0.68rem] ${a.latencyMs > 600 ? 'text-jx-warn' : 'text-jx-text'} whitespace-nowrap`} title="Latencja">
            {Math.round(a.latencyMs)}
            <span className="text-jx-dim text-[0.92em]"> ms</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="jx-label text-[0.625rem] normal-case tracking-wide truncate w-[38%] shrink-0" title={`${a.role} · ${a.model}`}>
            {a.role}
          </span>
          <div className="bx-bar-track relative h-[7px] flex-1 min-w-6" role="meter" aria-label={`Obciążenie ${a.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(a.load * 100)}>
            <motion.div
              className={`bx-bar-fill absolute inset-0 ${BG_TONE[loadTone]}`}
              style={{ boxShadow: `0 0 6px ${CSS_TONE[loadTone]}` }}
              initial={false}
              animate={{ scaleX: Math.max(0.01, Math.min(1, a.load)) }}
              transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 24 }}
            />
          </div>
          <span className="jx-num text-[0.625rem] text-jx-dim w-7 text-right">{Math.round(a.load * 100)}%</span>
          <span className="w-12 shrink-0 hidden xl:block" aria-hidden="true">
            <Sparkline data={a.history.slice(-24)} min={0} max={1} height={14} capacity={24} color={CSS_TONE[loadTone]} ariaLabel={`Historia obciążenia ${a.name}`} />
          </span>
        </div>
      </div>
    </li>
  )
})

export function AgentsRoster({
  agents,
  source,
  status,
  detail,
  reducedMotion,
}: {
  agents: Agent[]
  source: { label: string; synthetic: boolean }
  status: 'connecting' | 'live' | 'error'
  detail?: string
  reducedMotion: boolean
}) {
  const rows = useMemo(() => treeOrder(agents), [agents])
  const tokens = agents.reduce((s, a) => s + a.tokensPerMin, 0)
  return (
    <Panel
      title="Agenci"
      icon={<IconTopologyStar3 />}
      code={`Σ ${fmtCompact(tokens)} TOK/MIN`}
      skin="kranox"
      className="bx-agents h-full"
      bodyClassName="flex flex-col"
      actions={
        <HudButton size="sm" icon={<IconArrowUpRight />} onClick={() => navigate('agents')} className="px-1.5! py-0.5! text-[0.625rem]!" title="Otwórz widok agentów (Alt+3)">
          Graf
        </HudButton>
      }
    >
      {rows.length === 0 ? (
        <div className="flex-1 grid place-items-center p-4 text-center">
          <p className="jx-label jx-caret">{status === 'error' ? `Błąd źródła${detail ? `: ${detail}` : ''}` : 'Oczekiwanie na dane agentów'}</p>
        </div>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden m-0 p-0 list-none flex flex-col" aria-label="Lista agentów">
          {rows.map((r) => (
            <AgentRow key={r.agent.id} agent={r.agent} depth={r.depth} last={r.last} reducedMotion={reducedMotion} />
          ))}
        </ul>
      )}
      <footer className="shrink-0 flex items-center gap-2 px-2.5 py-1.5 border-t border-jx-line/50 min-w-0">
        <DemoBadge synthetic={source.synthetic} label={source.label} status={status} focusable={false} />
      </footer>
    </Panel>
  )
}
