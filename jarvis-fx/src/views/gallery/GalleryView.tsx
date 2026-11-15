import { useEffect, useMemo, useState } from 'react'
import { IconSearch, IconX, IconChevronLeft, IconChevronRight, IconAdjustments, IconExternalLink } from '@tabler/icons-react'
import { FX, FX_BY_ID } from '@/fx/registry'
import { FX_CATEGORIES, type FxCategory } from '@/fx/types'
import { FxCard } from '@/fx/FxCard'
import { FxHost } from '@/fx/FxHost'
import { FxLevaPanel, useFxControlsStore } from '@/fx/controls'
import { setWebglSlotLimit } from '@/fx/slots'
import { navigate, useRoute } from '@/lib/router'
import { useQuality } from '@/lib/store'
import { playBleep } from '@/lib/sound'
import { Decipher, Frame, HudButton, Panel } from '@/hud'

export default function GalleryView() {
  const { fxId } = useRoute()
  const [cat, setCat] = useState<FxCategory | 'all'>('all')
  const [q, setQ] = useState('')
  const quality = useQuality()

  useEffect(() => {
    // pause all card contexts while the stage is open; otherwise quality-dependent pool
    setWebglSlotLimit(fxId ? 1 : quality === 'high' ? 6 : quality === 'med' ? 4 : 3)
  }, [quality, fxId])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return FX.filter((f) => (cat === 'all' || f.category === cat) && (!needle || [f.title, f.description, ...f.tech, ...(f.tags ?? [])].join(' ').toLowerCase().includes(needle)))
  }, [cat, q])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    FX.forEach((f) => m.set(f.category, (m.get(f.category) ?? 0) + 1))
    return m
  }, [])

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="jx-display text-jx-accent text-lg jx-glow-text mr-2">
          <Decipher text={`Galeria FX · ${FX.length}`} />
        </h1>
        <HudButton size="sm" active={cat === 'all'} onClick={() => setCat('all')}>
          Wszystkie
        </HudButton>
        {FX_CATEGORIES.filter((c) => counts.get(c.id)).map((c) => (
          <HudButton key={c.id} size="sm" active={cat === c.id} onClick={() => setCat(c.id)}>
            {c.label} <span className="jx-num text-jx-dim">{counts.get(c.id)}</span>
          </HudButton>
        ))}
        <span className="flex-1" />
        <label className="jx-frame-host flex items-center gap-2 px-3 py-1.5 min-w-56">
          <Frame kind="underline" enter={false} />
          <IconSearch size={14} className="text-jx-accent" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj: shader, GSAP, radar…"
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-jx-dim"
            aria-label="Szukaj efektu"
          />
        </label>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))] pb-6">
          {list.map((fx) => (
            <FxCard key={fx.id} fx={fx} onOpen={(id) => navigate('gallery', id)} />
          ))}
          {list.length === 0 && <p className="jx-label p-6">Brak efektów dla tego filtra.</p>}
        </div>
      </div>

      {fxId && <FxStage id={fxId} ids={list.map((f) => f.id)} />}
    </div>
  )
}

export function FxStage({ id, ids, solo = false }: { id: string; ids: string[]; solo?: boolean }) {
  const fx = FX_BY_ID.get(id)
  const store = useFxControlsStore()
  const [showControls, setShowControls] = useState(true)
  const idx = ids.indexOf(id)
  const prev = ids[(idx - 1 + ids.length) % ids.length]
  const next = ids[(idx + 1) % ids.length]

  useEffect(() => {
    if (solo) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,[contenteditable]')) return
      if (e.key === 'Escape') {
        playBleep('close')
        navigate('gallery')
      } else if (e.key === 'ArrowRight' && next) navigate('gallery', next)
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
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm p-3 md:p-6 flex" role="dialog" aria-modal="true" aria-label={fx.title}>
      <Panel
        className="flex-1"
        title={<Decipher text={fx.title} />}
        code={`FX/${String(idx + 1).padStart(2, '0')}`}
        actions={
          <div className="flex items-center gap-1 mr-2">
            <HudButton size="sm" aria-label="Poprzedni" onClick={() => prev && navigate('gallery', prev)} icon={<IconChevronLeft />} />
            <HudButton size="sm" aria-label="Następny" onClick={() => next && navigate('gallery', next)} icon={<IconChevronRight />} />
            <HudButton size="sm" active={showControls} onClick={() => setShowControls((s) => !s)} icon={<IconAdjustments />}>
              Parametry
            </HudButton>
            <HudButton size="sm" aria-label="Zamknij" onClick={() => navigate('gallery')} icon={<IconX />} />
          </div>
        }
        bodyClassName="flex min-h-0"
      >
        <div className="relative flex-1 min-w-0">
          <FxHost key={id} id={id} stage store={store} />
        </div>
        <aside className={`${showControls ? 'flex' : 'hidden'} w-72 shrink-0 flex-col gap-3 border-l border-jx-line/60 p-3 overflow-y-auto`}>
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
                    {fx.source.label} <IconExternalLink size={12} />
                  </a>
                </dd>
              </>
            )}
          </dl>
          <div className="jx-label mt-1">Parametry na żywo (Leva)</div>
          <div className="min-h-40">
            <FxLevaPanel store={store} />
          </div>
          <p className="jx-label text-[0.6rem] mt-auto">← → przełączanie · Esc zamyka</p>
        </aside>
      </Panel>
    </div>
  )
}
