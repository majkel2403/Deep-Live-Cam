import { useMemo, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { IconAlertTriangle, IconBolt, IconEye, IconRadar2 } from '@tabler/icons-react'
import { Glitch } from '@/hud'
import type { Agent } from '@/lib/agents'
import { MODES, TEXT_TONE, fmtCompact, type CoreMode, type Tone } from './model'
import type { BridgeAggregates } from './useBridgeState'
import { AnimatedNumber } from './AnimatedNumber'
import { DemoBadge } from './DemoBadge'
import { Sparkline } from './Sparkline'

const MODE_ICON: Record<CoreMode, ReactNode> = {
  standby: <IconEye />,
  analyze: <IconRadar2 />,
  act: <IconBolt />,
  alarm: <IconAlertTriangle />,
}

const MODE_TONE: Record<CoreMode, string> = {
  standby: 'var(--jx-accent)',
  analyze: 'var(--jx-violet)',
  act: 'var(--jx-accent-2)',
  alarm: 'var(--jx-danger)',
}

/** Segmented core-mode indicator (read-only status, Motion shared-layout highlight). */
function ModeSegments({ mode, reducedMotion }: { mode: CoreMode; reducedMotion: boolean }) {
  const current = MODES.find((m) => m.id === mode)!
  return (
    <div className="flex items-stretch gap-[3px]" role="status" aria-live="polite" aria-label={`Tryb rdzenia: ${current.seg}`}>
      {MODES.map((m) => {
        const on = m.id === mode
        return (
          <div
            key={m.id}
            className={`bx-seg flex items-center gap-1.5 pl-3.5 pr-3 py-1 jx-label text-[0.625rem] transition-colors ${on ? 'text-white' : 'text-jx-dim'}`}
            style={{ background: on ? undefined : 'hsl(var(--jx-hue) 80% 40% / 0.1)' }}
            aria-hidden="true"
          >
            {on && (
              <motion.span
                layoutId="bx-mode-hl"
                className="bx-seg-hl"
                style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${MODE_TONE[m.id]} 55%, transparent), color-mix(in srgb, ${MODE_TONE[m.id]} 25%, transparent))`, boxShadow: `inset 0 -2px 0 ${MODE_TONE[m.id]}` }}
                transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="[&>svg]:size-3.5" style={{ color: on ? MODE_TONE[m.id] : undefined }}>
              {MODE_ICON[m.id]}
            </span>
            <span className="jx-num opacity-60">{m.code}</span>
            {/* the active mode always shows its name; the others only at very wide viewports */}
            <span className={on ? 'whitespace-nowrap' : 'hidden min-[1700px]:inline'}>{m.seg}</span>
          </div>
        )
      })}
    </div>
  )
}

function Stat({ label, children, unit, tone = 'accent', hint }: { label: string; children: ReactNode; unit?: string; tone?: Tone; hint?: string }) {
  return (
    <div className="flex flex-col shrink-0 min-w-0 px-2 xl:px-2.5 2xl:px-3.5 border-l border-jx-line/50 first:border-l-0 max-sm:[&:nth-child(3n+1)]:border-l-0" title={hint}>
      <span className="jx-label text-[0.625rem] whitespace-nowrap">{label}</span>
      <span className={`jx-num text-[1.02rem] leading-tight jx-glow-text ${TEXT_TONE[tone]} whitespace-nowrap`}>
        {children}
        {unit && <span className="text-[0.62em] text-jx-dim ml-1">{unit}</span>}
      </span>
    </div>
  )
}

export function StatusStrip({
  agg,
  mode,
  source,
  status,
  errorSeq,
  reducedMotion,
  agents,
}: {
  agents: Agent[]
  agg: BridgeAggregates
  mode: CoreMode
  source: { label: string; synthetic: boolean }
  status: 'connecting' | 'live' | 'error'
  errorSeq: number
  reducedMotion: boolean
}) {
  // swarm load trace: mean of every agent's load history, aligned on the newest sample
  const swarm = useMemo(() => {
    const len = agents.reduce((m, a) => Math.max(m, a.history.length), 0)
    const out: number[] = []
    for (let i = 0; i < len; i++) {
      let sum = 0
      let n = 0
      for (const a of agents) {
        const v = a.history[a.history.length - len + i]
        if (v !== undefined) {
          sum += v
          n++
        }
      }
      out.push(n ? sum / n : 0)
    }
    return out
  }, [agents])

  return (
    <header
      data-augmented-ui="tl-clip br-clip tr-clip bl-clip b-clip-x border"
      className="bx-strip jx-aug flex flex-wrap lg:flex-nowrap items-center gap-x-3 xl:gap-x-4 gap-y-2 px-4 py-2"
      aria-label="Pasek stanu misji"
    >
      <div className="flex items-center gap-3 shrink-0">
        <Glitch mode="once" trigger={errorSeq || undefined}>
          <h1 className="jx-display text-[0.92rem] font-bold text-jx-accent jx-glow-text leading-none whitespace-nowrap">Mostek</h1>
        </Glitch>
        <span className="hidden min-[1800px]:inline jx-label text-[0.625rem] whitespace-nowrap">Centrum dowodzenia</span>
      </div>

      <ModeSegments mode={mode} reducedMotion={reducedMotion} />

      <div className="hidden min-[1360px]:flex flex-[1_1_0%] min-w-0 flex-col justify-center gap-0.5 overflow-hidden" aria-hidden={swarm.length === 0}>
        <span className="jx-label text-[0.625rem] whitespace-nowrap">
          Obciąż. roju
        </span>
        <Sparkline data={swarm} min={0} max={1} capacity={40} height={18} ariaLabel="Średnie obciążenie agentów w ostatnich próbkach" />
      </div>

      <div
        className="grid grid-cols-3 sm:grid-cols-5 gap-y-1.5 min-w-0 basis-full order-last lg:flex lg:items-center lg:basis-auto lg:flex-[1_1_auto] min-[1360px]:flex-[0_1_auto] lg:justify-center-safe lg:overflow-hidden lg:order-none"
        role="group"
        aria-label="Kluczowe odczyty orkiestracji"
      >
        <Stat label="Agenci aktywni" hint="Agenci w stanie „myśli” lub „działa” / wszyscy">
          <AnimatedNumber value={agg.active} />
          <span className="text-jx-dim">/{agg.total}</span>
        </Stat>
        <Stat label="Zadania" hint="W toku · w kolejce">
          <AnimatedNumber value={agg.tasksActive} />
          <span className="text-jx-dim text-[0.75em]"> · {agg.tasksQueued} kol.</span>
        </Stat>
        <Stat label="Tokeny" unit="/min">
          <AnimatedNumber value={agg.tokensPerMin} format={fmtCompact} />
        </Stat>
        <Stat label="Śr. latencja" unit="ms" tone={agg.avgLatency > 600 ? 'warn' : 'accent'}>
          <AnimatedNumber value={agg.total ? agg.avgLatency : null} />
        </Stat>
        <span className="hidden xl:contents">
          <Stat label="Skuteczność" unit="%" tone={agg.successRate < 0.85 ? 'warn' : 'ok'}>
            <AnimatedNumber value={agg.total ? agg.successRate * 100 : null} format={(v) => v.toFixed(1)} />
          </Stat>
          <Stat label="Zdarzenia" unit="/min">
            <AnimatedNumber value={agg.eventsPerMin} />
          </Stat>
        </span>
        <Stat label="Błędy · 5 min" tone={agg.errored || agg.errors5m ? 'danger' : 'dim'} hint={`Zdarzenia błędu w ostatnich 5 minutach · agenci w stanie błędu teraz: ${agg.errored}`}>
          <AnimatedNumber value={agg.errors5m} />
          {agg.errored > 0 && <span className="hidden xl:inline text-[0.62em] ml-1">({agg.errored} akt.)</span>}
        </Stat>
      </div>

      {/* full source label lives in the agents roster footer; the strip keeps the status dot + DEMO badge */}
      <span className="flex items-center gap-2 shrink-0" title={`Źródło: ${source.label}`}>
        <DemoBadge synthetic={source.synthetic} label={source.label} status={status} compact />
      </span>
    </header>
  )
}
