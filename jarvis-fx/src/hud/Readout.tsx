import type { ReactNode } from 'react'

export function Readout({ label, value, unit, tone = 'accent', hint }: { label: ReactNode; value: ReactNode; unit?: ReactNode; tone?: 'accent' | 'ok' | 'warn' | 'danger' | 'dim'; hint?: ReactNode }) {
  const color = { accent: 'text-jx-accent', ok: 'text-jx-ok', warn: 'text-jx-warn', danger: 'text-jx-danger', dim: 'text-jx-dim' }[tone]
  return (
    <div className="flex flex-col gap-0.5 min-w-0" title={typeof hint === 'string' ? hint : undefined}>
      <span className="jx-label truncate">{label}</span>
      <span className={`jx-num text-lg leading-none ${color} jx-glow-text truncate`}>
        {value}
        {unit && <span className="text-[0.65em] text-jx-dim ml-1">{unit}</span>}
      </span>
    </div>
  )
}

export function StatusDot({ tone = 'ok', pulse = false }: { tone?: 'ok' | 'warn' | 'danger' | 'accent' | 'dim'; pulse?: boolean }) {
  const color = { accent: 'text-jx-accent', ok: 'text-jx-ok', warn: 'text-jx-warn', danger: 'text-jx-danger', dim: 'text-jx-dim' }[tone]
  return <span className={`jx-dot ${color}`} data-pulse={pulse ? 'true' : undefined} />
}

/** Thin segmented bar (0..1) */
export function SegBar({ value, segments = 20, tone = 'accent' }: { value: number; segments?: number; tone?: 'accent' | 'ok' | 'warn' | 'danger' }) {
  const on = Math.round(Math.max(0, Math.min(1, value)) * segments)
  const color = { accent: 'bg-jx-accent', ok: 'bg-jx-ok', warn: 'bg-jx-warn', danger: 'bg-jx-danger' }[tone]
  return (
    <div className="flex gap-[2px] h-2" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={value}>
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={`flex-1 ${i < on ? `${color} shadow-[0_0_4px_currentColor]` : 'bg-jx-accent-dim/30'}`} />
      ))}
    </div>
  )
}
