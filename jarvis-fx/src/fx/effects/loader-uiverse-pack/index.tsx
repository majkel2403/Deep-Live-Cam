import './uiverse.css'
import type { CSSProperties, ReactNode } from 'react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { HudChrome } from '../hud-kit/HudChrome'
import { useSize } from '../hud-kit/useSize'
import { LBL } from '../hud-kit/ui'

/**
 * Six Uiverse.io loaders (MIT) – markup here, styles + per-author attribution in ./uiverse.css.
 * Source: https://github.com/uiverse-io/galaxy/tree/main/loaders (ported/adapted, restyled to tokens).
 */

interface Item {
  code: string
  name: string
  author: string
  file: string
  /** natural size of the loader box, used to fit it into the tile */
  w: number
  h: number
  node: ReactNode
}

const WORD = 'ŁADOWANIE'

const ITEMS: Item[] = [
  { code: 'UV-01', name: 'Radar impulsowy', author: 'mrhyddenn', file: 'mrhyddenn_giant-lion-34', w: 150, h: 150, node: <div className="uvp-radar"><span /></div> },
  { code: 'UV-02', name: 'Neonowy pierścień', author: 'aadium', file: 'aadium_bright-lion-66', w: 130, h: 130, node: <div className="uvp-ring" /> },
  {
    code: 'UV-03',
    name: 'Smuga świetlna',
    author: 'Smit-Prajapati',
    file: 'Smit-Prajapati_soft-donkey-32',
    w: 300,
    h: 40,
    node: (
      <div className="uvp-streaks">
        {[0, 1, 2].map((i) => (
          <div key={i} className="uvp-streak">
            <div className="uvp-light" />
            <div className="uvp-overlay" />
          </div>
        ))}
      </div>
    ),
  },
  {
    code: 'UV-04',
    name: 'Fala liter',
    author: 'gagan-gv',
    file: 'gagan-gv_nervous-wasp-20',
    w: 250,
    h: 50,
    node: (
      <div className="uvp-letters" aria-hidden="true">
        {[...WORD].map((ch, i) => (
          <span key={i} style={{ '--i': i } as CSSProperties}>
            {ch}
          </span>
        ))}
      </div>
    ),
  },
  { code: 'UV-05', name: 'Elastyczne słupki', author: 'TemRevil', file: 'TemRevil_rude-moth-53', w: 150, h: 150, node: <div className="uvp-bars"><div /><div /><div /></div> },
  { code: 'UV-06', name: 'Warstwy danych', author: 'mobinkakei', file: 'mobinkakei_dry-insect-94', w: 110, h: 110, node: <div className="uvp-layers" /> },
]

export default function UiversePack({ reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    speed: { value: 1, min: 0.25, max: 3, step: 0.05, label: 'prędkość' },
    glow: { value: true, label: 'poświata' },
    labels: { value: true, label: 'podpisy' },
  })
  const [ref, size] = useSize<HTMLDivElement>()
  const cols = stage ? (size.width > 900 ? 3 : 2) : 3
  const rows = Math.ceil(ITEMS.length / cols)
  const padTop = stage ? 48 : 20
  const padBottom = stage ? 40 : 8
  const tileW = (size.width - (stage ? 64 : 16) - (cols - 1) * 12) / cols
  const tileH = (size.height - padTop - padBottom - (rows - 1) * 12) / rows
  const showLabels = stage && c.labels

  return (
    <div
      ref={ref}
      className="uvp-root absolute inset-0 overflow-hidden"
      data-paused={paused || reducedMotion ? 'true' : undefined}
      data-glow={c.glow ? undefined : 'false'}
      style={{ '--uvp-speed': c.speed } as CSSProperties}
    >
      <div className="absolute grid gap-3" style={{ left: stage ? 32 : 8, right: stage ? 32 : 8, top: padTop, bottom: padBottom, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {ITEMS.map((it) => {
          const room = Math.max(0, tileH - (showLabels ? 44 : 0))
          const s = tileW > 0 && room > 0 ? Math.min(1.25, (tileW * 0.82) / it.w, (room * 0.8) / it.h) : 0.4
          return (
            <figure key={it.code} data-augmented-ui={stage ? 'tl-clip br-clip border' : undefined} className={`relative m-0 flex min-h-0 flex-col ${stage ? 'jx-aug' : ''}`} aria-label={`${it.name} – loader autorstwa ${it.author} (Uiverse.io, MIT)`}>
              <div className="relative grid flex-1 place-items-center overflow-hidden" role="progressbar" aria-busy="true" aria-label={it.name}>
                {/* absolutely centred so the unscaled layout box never stretches the grid track */}
                <div className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%, -50%) scale(${s})` }}>
                  {it.node}
                </div>
              </div>
              {showLabels && (
                <figcaption className="flex items-baseline gap-2 border-t border-jx-line/50 px-3 py-1.5">
                  <span className="jx-num text-[0.62rem] text-jx-accent">{it.code}</span>
                  <span className={`${LBL} truncate text-[0.68rem] text-jx-text`}>{it.name}</span>
                  <span className="flex-1" />
                  <span className="jx-num truncate text-[0.58rem] text-jx-dim" title={`uiverse-io/galaxy · loaders/${it.file}.html`}>
                    uiverse.io/{it.author} · MIT
                  </span>
                </figcaption>
              )}
            </figure>
          )
        })}
      </div>
      <HudChrome code="LDR-UV · UIVERSE" title="Sześć loaderów CSS · MIT" stage={stage} corners={stage} footer={stage ? <span className={`${LBL} text-[0.6rem]`}>Źródło: github.com/uiverse-io/galaxy · przeniesione i przestylowane na tokeny JARVIS</span> : undefined} />
    </div>
  )
}
