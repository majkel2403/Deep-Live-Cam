/**
 * Single-effect stage: full-screen dialog (gallery) or bare full-screen host (`?fx=<id>` solo mode).
 *
 * Lives in src/fx, not in the gallery view, so App.tsx can import it statically without pulling the
 * gallery view into the main chunk (the view stays lazy-loaded).
 */
import { useEffect, useRef, useState } from 'react'
import IconChevronLeft from '@tabler/icons-react/icons/IconChevronLeft'
import IconChevronRight from '@tabler/icons-react/icons/IconChevronRight'
import IconAdjustments from '@tabler/icons-react/icons/IconAdjustments'
import IconExternalLink from '@tabler/icons-react/icons/IconExternalLink'
import IconX from '@tabler/icons-react/icons/IconX'
import { FX_BY_ID } from '@/fx/registry'
import { FxHost } from '@/fx/FxHost'
import { FxLevaPanel, useFxControlsStore } from '@/fx/controls'
import { navigate } from '@/lib/router'
import { playBleep } from '@/lib/sound'
import { Decipher, HudButton, Panel } from '@/hud'

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

export function FxStage({ id, ids, solo = false }: { id: string; ids: string[]; solo?: boolean }) {
  const fx = FX_BY_ID.get(id)
  const store = useFxControlsStore()
  // Parameters sit beside the stage on wide screens and below it (collapsed) on phones.
  const [showControls, setShowControls] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const idx = ids.indexOf(id)
  const prev = ids[(idx - 1 + ids.length) % ids.length]
  const next = ids[(idx + 1) % ids.length]

  // Focus moves into the dialog when it opens and returns to the element that opened it on close.
  useEffect(() => {
    if (solo) return
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus({ preventScroll: true })
    return () => opener?.focus?.({ preventScroll: true })
  }, [solo])

  useEffect(() => {
    if (solo) return
    const onKey = (e: KeyboardEvent) => {
      // Radix dialogs (command palette) handle Escape first and mark the event; leave it to them.
      if (e.defaultPrevented) return
      // Escape inside a Leva field only leaves the field; a second Escape closes the stage.
      const field = (e.target as HTMLElement)?.closest?.('input,textarea,select,[contenteditable]') as HTMLElement | null
      if (e.key === 'Escape') {
        if (field) {
          field.blur()
          return
        }
        playBleep('close')
        navigate('gallery')
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        // Another open dialog (the command palette) owns Tab while it is focused.
        const ownDialog = (e.target as HTMLElement)?.closest?.('[role="dialog"]')
        if (ownDialog && ownDialog !== dialogRef.current) return
        // keep Tab focus inside the modal dialog (checked before the text-field guard: Leva sliders are inputs)
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
          e.preventDefault()
          first.focus()
        }
        return
      }
      if (field) return
      if (e.key === 'ArrowRight' && next) navigate('gallery', next)
      else if (e.key === 'ArrowLeft' && prev) navigate('gallery', prev)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, solo])

  if (!fx) return null
  if (solo)
    return (
      <div className="fixed inset-0 bg-jx-bg">
        <FxHost id={id} stage store={store} />
      </div>
    )

  return (
    <div ref={dialogRef} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm p-2 sm:p-3 md:p-6 flex" role="dialog" aria-modal="true" aria-label={fx.title}>
      <Panel
        className="flex-1 min-w-0"
        title={<Decipher text={fx.title} />}
        code={`FX/${String(idx + 1).padStart(2, '0')}`}
        actions={
          <div className="flex items-center gap-1 mr-2">
            <HudButton size="sm" aria-label="Poprzedni efekt" onClick={() => prev && navigate('gallery', prev)} icon={<IconChevronLeft />} />
            <HudButton size="sm" aria-label="Następny efekt" onClick={() => next && navigate('gallery', next)} icon={<IconChevronRight />} />
            <HudButton size="sm" aria-label="Parametry" active={showControls} onClick={() => setShowControls((s) => !s)} icon={<IconAdjustments />}>
              <span className="hidden sm:inline">Parametry</span>
            </HudButton>
            <HudButton ref={closeRef} size="sm" aria-label="Zamknij" onClick={() => navigate('gallery')} icon={<IconX />} />
          </div>
        }
        bodyClassName="flex min-h-0 flex-col md:flex-row"
      >
        <div className="relative flex-1 min-w-0 min-h-[40vh] md:min-h-0">
          <FxHost key={id} id={id} stage store={store} />
        </div>
        <aside
          aria-label="Parametry efektu"
          className={`${showControls ? 'flex' : 'hidden'} w-full md:w-80 md:shrink-0 max-h-[42vh] md:max-h-none flex-col gap-3 border-t md:border-t-0 md:border-l border-jx-line/60 p-3 overflow-y-auto`}
        >
          <p className="text-sm text-jx-text/90">{fx.description}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="jx-label">Technologia</dt>
            <dd className="jx-num">{fx.tech.join(' · ')}</dd>
            <dt className="jx-label">Licencja</dt>
            <dd className="jx-num">{fx.license}</dd>
            <dt className="jx-label">Koszt</dt>
            <dd className="jx-num">{['', 'niski', 'średni', 'wysoki'][fx.cost ?? 1]}</dd>
            {fx.source && (
              <>
                <dt className="jx-label">Źródło</dt>
                <dd>
                  <a className="text-jx-accent hover:underline inline-flex items-center gap-1" href={fx.source.url} target="_blank" rel="noreferrer">
                    {fx.source.label} <IconExternalLink size={12} aria-hidden="true" />
                    <span className="sr-only">(otwiera nową kartę)</span>
                  </a>
                </dd>
              </>
            )}
          </dl>
          <div className="jx-label mt-1">Parametry na żywo (Leva)</div>
          <div className="min-h-40">
            <FxLevaPanel store={store} />
          </div>
          <p className="jx-label text-[0.625rem] mt-auto">← → przełączanie · Esc zamyka</p>
        </aside>
      </Panel>
    </div>
  )
}
