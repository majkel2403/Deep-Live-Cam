import type { ReactNode } from 'react'
import IconCode from '@tabler/icons-react/icons/IconCode'
import IconExternalLink from '@tabler/icons-react/icons/IconExternalLink'
import IconLayoutGrid from '@tabler/icons-react/icons/IconLayoutGrid'
import IconSparkles from '@tabler/icons-react/icons/IconSparkles'
import { FX_BY_ID } from '@/fx/registry'
import type { FxEntry } from '@/fx/types'
import { navigate } from '@/lib/router'
import type { ViewId } from '@/lib/store'
import { playBleep } from '@/lib/sound'
import { FLAG_INFO, USAGE_INFO, VIEW_LABELS, type LicenseFlag, type Resource, type Usage } from '@/data/resources'

/** Small bordered tag (licence flag, usage, category). */
export function Tag({ children, className = '', title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 border px-1.5 py-px jx-num text-[0.625rem] leading-[1.35] tracking-wider uppercase whitespace-nowrap ${className}`}>
      {children}
    </span>
  )
}

export function FlagTag({ flag }: { flag: LicenseFlag }) {
  const f = FLAG_INFO[flag]
  return (
    <Tag className={f.tone} title={f.text}>
      <span className="jx-dot size-[5px]" aria-hidden="true" />
      {f.short}
    </Tag>
  )
}

const USAGE_TONE: Record<Usage, string> = {
  code: 'text-jx-accent border-jx-accent/60',
  reference: 'text-[var(--jx-violet)] border-[var(--jx-violet)]/60',
  excluded: 'text-jx-dim border-jx-line',
}

export function UsageTag({ usage }: { usage: Usage }) {
  return (
    <Tag className={USAGE_TONE[usage]} title={USAGE_INFO[usage].text}>
      {USAGE_INFO[usage].label}
    </Tag>
  )
}

/** Clickable chips for view:/fx:/code: tokens. */
export function WhereChips({ r, effects, compact = false }: { r: Resource; effects: FxEntry[]; compact?: boolean }) {
  const views = r.where.filter((w) => w.startsWith('view:')).map((w) => w.slice(5) as ViewId)
  const code = r.where.filter((w) => w.startsWith('code:')).map((w) => w.slice(5))
  const missingFx = r.where.filter((w) => w.startsWith('fx:') && !FX_BY_ID.has(w.slice(3))).map((w) => w.slice(3))
  const chip = 'inline-flex items-center gap-1 border border-jx-line/70 px-1.5 py-px text-[0.68rem] font-ui leading-snug hover:border-jx-accent hover:text-white hover:bg-jx-accent/10 focus-visible:outline focus-visible:outline-1 focus-visible:outline-jx-accent cursor-pointer'
  const go = (fn: () => void) => () => {
    playBleep('click')
    fn()
  }
  const fxShown = compact ? effects.slice(0, 2) : effects
  return (
    <span className="flex flex-wrap gap-1">
      {views.map((v) => (
        <button key={v} type="button" className={`${chip} text-jx-text`} onClick={go(() => navigate(v))} aria-label={`Przejdź do widoku ${VIEW_LABELS[v]}`}>
          <IconLayoutGrid className="size-3 text-jx-accent" aria-hidden="true" />
          {VIEW_LABELS[v]}
        </button>
      ))}
      {fxShown.map((fx) => (
        <button key={fx.id} type="button" className={`${chip} text-jx-text`} onClick={go(() => navigate('gallery', fx.id))} aria-label={`Otwórz efekt ${fx.title}`} title={fx.id}>
          <IconSparkles className="size-3 text-jx-accent" aria-hidden="true" />
          {fx.title}
        </button>
      ))}
      {compact && effects.length > fxShown.length && <span className="jx-num text-[0.65rem] text-jx-dim self-center">+{effects.length - fxShown.length} FX</span>}
      {!compact &&
        code.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 border border-dashed border-jx-line/60 px-1.5 py-px jx-num text-[0.625rem] text-jx-dim">
            <IconCode className="size-3" aria-hidden="true" />
            {c}
          </span>
        ))}
      {!compact &&
        missingFx.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 border border-dashed border-jx-warn/50 px-1.5 py-px jx-num text-[0.625rem] text-jx-warn" title="Efekt wymieniony w rejestrze, ale nie ma go w galerii">
            {id} · brak
          </span>
        ))}
    </span>
  )
}

export function ExtLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={`inline-flex items-center gap-1 hover:text-white underline-offset-2 hover:underline ${className}`}>
      {children}
      <IconExternalLink className="size-3 shrink-0" aria-hidden="true" />
    </a>
  )
}

/** Section heading inside a tab: label + rule + optional right-side meta. */
export function SectionHead({ children, meta, id }: { children: ReactNode; meta?: ReactNode; id?: string }) {
  return (
    <div className="flex items-center gap-3 mb-2 min-w-0">
      <h3 id={id} className="jx-title text-[0.78rem] leading-none whitespace-nowrap">
        {children}
      </h3>
      <span className="flex-1 h-px bg-gradient-to-r from-jx-line to-transparent" />
      {meta && <span className="jx-num text-[0.625rem] text-jx-dim whitespace-nowrap truncate min-w-0 shrink">{meta}</span>}
    </div>
  )
}
