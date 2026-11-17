import { useEffect, useState } from 'react'
import { FRAME_KINDS, Frame } from '@/hud'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { HudChrome } from '../hud-kit/HudChrome'

/** Augmented-ui clip presets. `cls` is the attribute value; `name` is the Polish caption shown under it. */
const AUG = [
  { cls: 'tl-clip br-clip border', name: 'Ścięte narożniki' },
  { cls: 'tl-clip-x tr-rect br-clip-y border', name: 'Asymetryczne ścięcia' },
  { cls: 'tl-round br-clip both', name: 'Zaokrąglenie i ścięcie' },
  { cls: 'bl-clip-x tr-clip-y border', name: 'Ukośne krawędzie' },
  { cls: 'tl-scoop br-scoop border', name: 'Wklęsłe łuki' },
  { cls: 'tl-clip tr-clip bl-clip br-clip border', name: 'Cztery ścięcia' },
] as const

// Utility-only caption classes: `.jx-label` lives in unlayered CSS and would beat a Tailwind colour utility.
const CAPTION = 'font-label font-semibold uppercase tracking-[0.12em] text-[0.625rem] leading-tight'

export default function ArwesFrames({ stage, reducedMotion, paused }: FxProps) {
  const { replayEvery, showAug } = useFxControls({ replayEvery: { value: 6, min: 2, max: 20, step: 1, label: 'replay (s)' }, showAug: { value: true, label: 'augmented-ui' } })
  // `k` re-keys every frame so its line-drawing enter animation replays; no timer runs while paused or reduced
  const [k, setK] = useState(0)
  useEffect(() => {
    if (reducedMotion || paused) return
    const t = setInterval(() => setK((x) => x + 1), replayEvery * 1000)
    return () => clearInterval(t)
  }, [replayEvery, reducedMotion, paused])

  // the gallery card has room for six frames (two rows); the stage shows all nine plus the augmented-ui set
  const kinds = stage ? FRAME_KINDS : FRAME_KINDS.slice(0, 6)

  return (
    <>
      <div
        className={`absolute inset-0 grid content-center ${stage ? 'gap-4 px-6 pb-12 pt-16 grid-cols-3 md:grid-cols-5' : 'gap-2 p-3 grid-cols-3'}`}
      >
        {kinds.map((kind) => (
          <div key={`${kind}-${k}`} className="jx-frame-host grid aspect-[4/3] place-items-center">
            <Frame kind={kind} />
            <span className={`${CAPTION} text-jx-accent`}>{kind}</span>
          </div>
        ))}
        {stage &&
          showAug &&
          AUG.map((a) => (
            <div key={a.cls} data-augmented-ui={a.cls} className="jx-aug grid aspect-[4/3] place-items-center p-2">
              <span className={`${CAPTION} text-center text-jx-dim`}>{a.name}</span>
              <span className="jx-num mt-1 text-center text-[0.625rem] text-jx-dim/70">{a.cls}</span>
            </div>
          ))}
      </div>
      <HudChrome
        code="RMK-01 · RAMKI"
        title="Warianty @arwes/frames i augmented-ui"
        stage={stage}
        corners={stage}
        footer={stage ? <span className={`${CAPTION} text-jx-dim`}>@arwes/frames · augmented-ui · nazwy wariantów z bibliotek · montaż linii co {replayEvery} s</span> : undefined}
      />
    </>
  )
}
