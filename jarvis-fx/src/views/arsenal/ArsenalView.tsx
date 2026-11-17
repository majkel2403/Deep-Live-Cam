import { lazy, Suspense, useEffect, useState, type ComponentType, type KeyboardEvent, type ReactNode } from 'react'
import IconIcons from '@tabler/icons-react/icons/IconIcons'
import IconLicense from '@tabler/icons-react/icons/IconLicense'
import IconPalette from '@tabler/icons-react/icons/IconPalette'
import IconShape from '@tabler/icons-react/icons/IconShape'
import IconTypography from '@tabler/icons-react/icons/IconTypography'
import { Decipher, HudButton, StatusDot } from '@/hud'
import { FX } from '@/fx/registry'
import { RESOURCES } from '@/data/resources'
import { playBleep } from '@/lib/sound'

// Every tab is its own chunk: the header and tablist render as soon as this module evaluates, and
// heavy tab dependencies (IconsTab: lucide, Material Symbols CSS, Iconify offline) load only when opened.
const LedgerTab = lazy(() => import('./LedgerTab').then((m) => ({ default: m.LedgerTab })))
const TypeTab = lazy(() => import('./TypeTab').then((m) => ({ default: m.TypeTab })))
const IconsTab = lazy(() => import('./IconsTab').then((m) => ({ default: m.IconsTab })))
const ShapesTab = lazy(() => import('./ShapesTab').then((m) => ({ default: m.ShapesTab })))
const PaletteTab = lazy(() => import('./PaletteTab').then((m) => ({ default: m.PaletteTab })))

/**
 * Arsenał – the "use everything" ledger: every resource from the research report with its licence,
 * a licence flag and where (if anywhere) the app uses it, plus living specimens of the type, icon,
 * shape and colour systems. Deep links: #/arsenal/<tab>  (rejestr | typografia | ikony | ksztalty | paleta).
 */
type TabId = 'rejestr' | 'typografia' | 'ikony' | 'ksztalty' | 'paleta'

const TABS: { id: TabId; label: string; icon: ReactNode; Comp: ComponentType }[] = [
  { id: 'rejestr', label: 'Rejestr', icon: <IconLicense />, Comp: LedgerTab },
  { id: 'typografia', label: 'Typografia', icon: <IconTypography />, Comp: TypeTab },
  { id: 'ikony', label: 'Ikony', icon: <IconIcons />, Comp: IconsTab },
  { id: 'ksztalty', label: 'Kształty', icon: <IconShape />, Comp: ShapesTab },
  { id: 'paleta', label: 'Paleta', icon: <IconPalette />, Comp: PaletteTab },
]

function tabFromHash(): TabId {
  const sub = window.location.hash.replace(/^#\/?/, '').split('/')[1]
  return TABS.some((t) => t.id === sub) ? (sub as TabId) : 'rejestr'
}

export default function ArsenalView() {
  const [tab, setTab] = useState<TabId>(tabFromHash)

  // keep the hash in sync without a hashchange (the router only cares about the view segment)
  useEffect(() => {
    const want = `#/arsenal${tab === 'rejestr' ? '' : `/${tab}`}`
    if (window.location.hash !== want && window.location.hash.startsWith('#/arsenal')) history.replaceState(null, '', want)
  }, [tab])

  const select = (id: TabId, focus = false) => {
    if (id !== tab) playBleep('toggle')
    setTab(id)
    if (focus) document.getElementById(`arsenal-tab-${id}`)?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab)
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null
    if (next === null) return
    e.preventDefault()
    select(TABS[(next + TABS.length) % TABS.length].id, true)
  }

  const inCode = RESOURCES.filter((r) => r.usage === 'code').length
  const Active = TABS.find((t) => t.id === tab)!.Comp

  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="jx-display text-lg text-jx-accent jx-glow-text font-[family-name:var(--jx-font-cmd)]">
            <Decipher text="Arsenał" />
          </h1>
          <p className="jx-label text-[0.64rem] hidden md:block">
            Technologie · licencje · zasoby <span className="text-jx-dim">—</span>{' '}
            <span className="jx-num text-jx-accent">{RESOURCES.length}</span> pozycji, <span className="jx-num text-jx-accent">{inCode}</span> w kodzie,{' '}
            <span className="jx-num text-jx-accent">{FX.length}</span> efektów
          </p>
        </div>
        <span className="flex-1" />
        <div role="tablist" aria-label="Sekcje arsenału" className="flex flex-wrap gap-1" onKeyDown={onKeyDown}>
          {TABS.map((t) => (
            <HudButton
              key={t.id}
              size="sm"
              role="tab"
              id={`arsenal-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`arsenal-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              data-active={tab === t.id ? 'true' : undefined}
              icon={t.icon}
              onClick={() => select(t.id)}
            >
              {t.label}
            </HudButton>
          ))}
        </div>
        <span className="hidden xl:flex items-center gap-1.5 jx-label text-[0.625rem]" title="Licencje sprawdzone w kodzie i package.json">
          <StatusDot tone="ok" /> rejestr zweryfikowany
        </span>
      </div>

      <div role="tabpanel" id={`arsenal-panel-${tab}`} aria-labelledby={`arsenal-tab-${tab}`} className="flex-1 min-h-0" tabIndex={-1}>
        <Suspense fallback={<TabLoading />}>
          <Active />
        </Suspense>
      </div>
    </div>
  )
}

function TabLoading() {
  return (
    <div role="status" className="flex items-center gap-2 p-6 jx-label">
      <StatusDot tone="accent" pulse />
      <span className="jx-caret">Ładowanie zakładki</span>
    </div>
  )
}
