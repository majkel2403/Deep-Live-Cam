import { useEffect, useRef, useState } from 'react'
import { IconCube, IconPlayerPlay } from '@tabler/icons-react'
import { playBleep } from '@/lib/sound'
import { FxHost } from './FxHost'
import { useWebglSlot } from './slots'
import type { FxEntry } from './types'

export function FxCard({ fx, onOpen }: { fx: FxEntry; onOpen: (id: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(false)
  const [hasSlot, force] = useWebglSlot(!!fx.webgl, visible)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

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
      data-augmented-ui="tl-clip br-clip border"
      className="jx-aug group text-left flex flex-col min-w-0 cursor-pointer hover:[--aug-border-bg:var(--jx-accent)] focus-visible:[--aug-border-bg:var(--jx-accent)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-black/40">
        {visible && hasSlot ? (
          <FxHost id={fx.id} stage={false} />
        ) : (
          <div className="absolute inset-0 grid place-items-center jx-grid-bg">
            <span className="flex flex-col items-center gap-1 text-jx-dim">
              {fx.webgl ? <IconCube size={28} stroke={1} /> : <IconPlayerPlay size={28} stroke={1} />}
              <span className="jx-label text-[0.62rem]">{fx.webgl ? 'WebGL · najedź, aby uruchomić' : 'podgląd'}</span>
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
      </div>
      <div className="px-3 py-2 flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-head text-sm font-semibold tracking-wider uppercase text-jx-text group-hover:text-jx-accent truncate">{fx.title}</h3>
          <span className="flex-1" />
          <span className="jx-num text-[0.6rem] text-jx-dim">{'▮'.repeat(fx.cost ?? 1)}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {fx.tech.slice(0, 4).map((t) => (
            <span key={t} className="jx-num text-[0.6rem] px-1.5 py-px border border-jx-line text-jx-dim">
              {t}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}
