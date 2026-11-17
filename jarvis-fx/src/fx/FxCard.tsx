import { useEffect, useRef, useState } from 'react'
import IconCube from '@tabler/icons-react/icons/IconCube'
import IconPlayerPlay from '@tabler/icons-react/icons/IconPlayerPlay'
import { playBleep } from '@/lib/sound'
import { useSettings } from '@/lib/store'
import { FxHost } from './FxHost'
import { useWebglSlot } from './slots'
import type { FxEntry } from './types'

/** Posters are captured with the default cyan accent (188°); shift them to the active accent hue. */
const POSTER_HUE = 188
const POSTER_BASE = `${(import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/')}posters`

/**
 * Gallery card. Live effect when the card is on screen (and holds a WebGL slot, if it needs one);
 * otherwise a still poster from public/posters/<id>.jpg, falling back to a text placeholder when the
 * poster is missing (scripts/posters.mjs produces them).
 */
/** Touch-first devices have no hover: the card copy says "dotknij" instead of "najedź". */
const COARSE = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches

export function FxCard({ fx, onOpen }: { fx: FxEntry; onOpen: (id: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(false)
  const [hasSlot, force] = useWebglSlot(!!fx.webgl, visible)
  const [posterFailed, setPosterFailed] = useState(false)
  const hue = useSettings((s) => s.hue)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const live = visible && hasSlot
  // Hue-rotate the still so the accent follows the settings; desaturate so the HUD chrome stays dominant.
  const posterFilter = `saturate(0.6) brightness(0.85) hue-rotate(${(((hue - POSTER_HUE) % 360) + 360) % 360}deg)`

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        playBleep('open')
        onOpen(fx.id)
      }}
      onMouseEnter={() => {
        playBleep('hover')
        if (fx.webgl && !hasSlot) force()
      }}
      // keyboard parity with hover: focusing a WebGL card brings its live scene up
      onFocus={() => {
        if (fx.webgl && !hasSlot) force()
      }}
      data-augmented-ui="tl-clip br-clip border"
      className="jx-aug group text-left flex flex-col min-w-0 cursor-pointer hover:[--aug-border-bg:var(--jx-accent)] focus-visible:[--aug-border-bg:var(--jx-accent)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-black/40">
        {live ? (
          <FxHost id={fx.id} stage={false} />
        ) : !posterFailed ? (
          <>
            <img
              src={`${POSTER_BASE}/${fx.id}.jpg`}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setPosterFailed(true)}
              className="absolute inset-0 size-full object-cover"
              style={{ filter: posterFilter }}
            />
            <div className="absolute inset-0 jx-grid-bg opacity-30 pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50 pointer-events-none" aria-hidden="true" />
            <span className="absolute left-2 top-2 jx-label text-[0.625rem] leading-none text-jx-accent bg-black/55 border border-jx-line/60 px-1.5 py-1 backdrop-blur-[2px]">
              {fx.webgl ? `WebGL · ${COARSE ? 'dotknij, aby uruchomić' : 'najedź, aby uruchomić'}` : `podgląd · ${COARSE ? 'dotknij' : 'najedź'}`}
            </span>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center jx-grid-bg">
            <span className="flex flex-col items-center gap-1 text-jx-dim">
              {fx.webgl ? <IconCube size={28} stroke={1} /> : <IconPlayerPlay size={28} stroke={1} />}
              <span className="jx-label text-[0.625rem]">{fx.webgl ? `WebGL · ${COARSE ? 'dotknij, aby uruchomić' : 'najedź, aby uruchomić'}` : 'podgląd'}</span>
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
      </div>
      <div className="px-3 py-2 flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-head text-sm font-semibold tracking-wider uppercase text-jx-text group-hover:text-jx-accent truncate">{fx.title}</h3>
          <span className="flex-1" />
          <span className="jx-num text-[0.625rem] text-jx-dim" role="img" aria-label={`Koszt ${fx.cost ?? 1} z 3: ${['', 'niski', 'średni', 'wysoki'][fx.cost ?? 1]}`} title={`Koszt: ${['', 'niski', 'średni', 'wysoki'][fx.cost ?? 1]} (▮ = 1 z 3)`}>
            {'▮'.repeat(fx.cost ?? 1)}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {fx.tech.slice(0, 4).map((t) => (
            <span key={t} className="jx-num text-[0.625rem] px-1.5 py-px border border-jx-line text-jx-dim">
              {t}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}
