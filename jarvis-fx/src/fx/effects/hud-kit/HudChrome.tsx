import type { ReactNode } from 'react'
import { LBL } from './ui'

/** Visible marker for synthetic data (honesty rule): never shown for real browser metrics. */
export function DemoBadge({ label = 'DEMO', title = 'Dane syntetyczne – generowane lokalnie, nie pochodzą z realnych czujników' }: { label?: string; title?: string }) {
  return (
    <span
      role="note"
      title={title}
      aria-label={`${label}: ${title}`}
      data-augmented-ui="tl-clip br-clip border"
      className="jx-aug jx-num pointer-events-auto inline-flex items-center px-1.5 py-px text-[0.625rem] font-bold tracking-[0.25em] text-jx-warn [--aug-border-bg:var(--jx-warn)] [--aug-tl:5px] [--aug-br:5px]"
    >
      {label}
    </span>
  )
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const place = {
    tl: 'left-2 top-2 border-l border-t',
    tr: 'right-2 top-2 border-r border-t',
    bl: 'left-2 bottom-2 border-l border-b',
    br: 'right-2 bottom-2 border-r border-b',
  }[pos]
  return <span className={`absolute h-4 w-4 ${place}`} style={{ borderColor: 'var(--jx-line-strong)' }} />
}

/**
 * Decorative frame shared by the HUD / loader / data effects: corner brackets, a module code
 * (top-left), optional right-side badges and a footer line. Pointer events pass through except on
 * the badges, so the effect underneath stays interactive.
 */
export function HudChrome({
  code,
  title,
  stage,
  badges,
  footer,
  corners = true,
}: {
  code: string
  title?: ReactNode
  stage: boolean
  badges?: ReactNode
  footer?: ReactNode
  corners?: boolean
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      {corners && (
        <>
          <Corner pos="tl" />
          <Corner pos="tr" />
          <Corner pos="bl" />
          <Corner pos="br" />
        </>
      )}
      <div className={`absolute flex items-center gap-2 ${stage ? 'left-5 top-4' : 'left-3 top-2.5'}`}>
        <span className={`${LBL} text-jx-accent jx-glow-text ${stage ? 'text-[0.7rem]' : 'text-[0.625rem]'}`}>{code}</span>
        {stage && title && <span className={`${LBL} text-[0.625rem] text-jx-dim`}>{title}</span>}
      </div>
      {badges && <div className={`absolute flex items-center gap-1.5 ${stage ? 'right-5 top-3.5' : 'right-3 top-2'}`}>{badges}</div>}
      {footer && <div className={`absolute ${stage ? 'left-5 bottom-3.5 right-5' : 'left-3 bottom-2 right-3'} flex items-center gap-3`}>{footer}</div>}
    </div>
  )
}
