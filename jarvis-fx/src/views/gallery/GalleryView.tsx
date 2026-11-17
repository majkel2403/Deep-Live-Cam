import { useEffect, useMemo, useRef, useState } from 'react'
import IconSearch from '@tabler/icons-react/icons/IconSearch'
import { FX } from '@/fx/registry'
import { FX_CATEGORIES, type FxCategory } from '@/fx/types'
import { FxCard } from '@/fx/FxCard'
import { FxStage } from '@/fx/FxStage'
import { setWebglSlotLimit } from '@/fx/slots'
import { navigate, useRoute } from '@/lib/router'
import { useQuality } from '@/lib/store'
import { Decipher, Frame, HudButton } from '@/hud'

export default function GalleryView() {
  const { fxId } = useRoute()
  const [cat, setCat] = useState<FxCategory | 'all'>('all')
  const [q, setQ] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
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
        <span className="jx-label text-[0.625rem] hidden lg:inline" title="Koszt renderowania efektu: ▮ niski, ▮▮ średni, ▮▮▮ wysoki">▮ koszt renderu: 1 niski · 3 wysoki</span>
        <span className="flex-1" />
        <label className="jx-frame-host flex items-center gap-2 px-3 py-1.5 min-w-56 w-full sm:w-auto">
          <Frame kind="underline" enter={false} />
          <IconSearch size={14} className="text-jx-accent shrink-0" aria-hidden="true" />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj: shader, GSAP, radar…"
            className="bg-transparent text-sm flex-1 min-w-0 placeholder:text-jx-dim"
            aria-label="Szukaj efektu"
          />
        </label>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <p className="sr-only" aria-live="polite">
          {list.length === 0 ? 'Brak efektów dla tego filtra' : `Efekty: ${list.length}`}
        </p>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))] pb-6">
          {list.map((fx) => (
            <FxCard key={fx.id} fx={fx} onOpen={(id) => navigate('gallery', id)} />
          ))}
          {list.length === 0 && (
            <div className="p-6 flex flex-col items-start gap-3">
              <p className="jx-label">Brak efektów dla tego filtra.</p>
              <HudButton
                size="sm"
                onClick={() => {
                  setQ('')
                  setCat('all')
                  // the button unmounts with the empty state: move focus to the field that stays mounted
                  searchRef.current?.focus()
                }}
              >
                Pokaż wszystkie
              </HudButton>
            </div>
          )}
        </div>
      </div>

      {fxId && <FxStage id={fxId} ids={list.map((f) => f.id)} />}
    </div>
  )
}
