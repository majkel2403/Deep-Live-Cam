import type { ReactNode } from 'react'
import { useFps } from './useFps'

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const place = {
    tl: 'left-3 top-3 border-l border-t',
    tr: 'right-3 top-3 border-r border-t',
    bl: 'left-3 bottom-3 border-l border-b',
    br: 'right-3 bottom-3 border-r border-b',
  }[pos]
  return <span className={`absolute h-5 w-5 ${place}`} style={{ borderColor: 'var(--jx-line-strong)' }} />
}

export interface BgHudStat {
  label: string
  value: ReactNode
}

/**
 * Thin cinematic overlay shared by every background/particle effect: vignette always, and in the
 * big stage also corner brackets, a module code, an interaction hint and a live FPS readout.
 * Purely decorative – pointer-events are disabled so the effect underneath stays interactive.
 */
export function BgHud({
  code,
  stage,
  paused,
  hint,
  stats = [],
  vignette = 0.55,
}: {
  code: string
  stage: boolean
  paused: boolean
  hint?: ReactNode
  stats?: BgHudStat[]
  vignette?: number
}) {
  const fps = useFps(stage && !paused)
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 50%, transparent 52%, rgb(0 0 0 / ${vignette}) 100%)` }} />
      {stage && (
        <>
          {/* soft scrims keep the HUD captions readable over busy fields (glyph rain, dense particles) */}
          <div className="absolute inset-x-0 top-0 h-28" style={{ background: 'linear-gradient(to bottom, rgb(0 0 0 / 0.55), transparent)' }} />
          <div className="absolute inset-x-0 bottom-0 h-24" style={{ background: 'linear-gradient(to top, rgb(0 0 0 / 0.5), transparent)' }} />
          <Corner pos="tl" />
          <Corner pos="tr" />
          <Corner pos="bl" />
          <Corner pos="br" />
          <div className="absolute left-6 top-5 flex flex-col gap-1">
            <span className="jx-label text-jx-accent jx-glow-text">{code}</span>
            {hint && <span className="jx-label text-[0.7rem] text-jx-dim normal-case tracking-wider">{hint}</span>}
          </div>
          <div className="absolute bottom-5 right-6 flex items-end gap-5">
            {stats.map((s) => (
              <span key={s.label} className="flex flex-col items-end leading-none">
                <span className="jx-label text-[0.66rem]">{s.label}</span>
                <span className="jx-num text-xs text-jx-accent">{s.value}</span>
              </span>
            ))}
            <span className="flex flex-col items-end leading-none">
              <span className="jx-label text-[0.66rem]">{paused ? 'Wstrzymano' : 'Klatki/s'}</span>
              <span className="jx-num text-xs text-jx-accent">{paused ? '—' : (fps ?? '··')}</span>
            </span>
          </div>
        </>
      )}
    </div>
  )
}
