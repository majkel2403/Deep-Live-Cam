import { useEffect, useState } from 'react'
import { FRAME_KINDS, Frame } from '@/hud'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'

const AUG = ['tl-clip br-clip border', 'tl-clip-x tr-rect br-clip-y border', 'tl-round br-clip both', 'bl-clip-x tr-clip-y border', 'tl-scoop br-scoop border', 'tl-clip tr-clip bl-clip br-clip border']

export default function ArwesFrames({ stage, reducedMotion }: FxProps) {
  const { replayEvery, showAug } = useFxControls({ replayEvery: { value: 6, min: 2, max: 20, step: 1, label: 'replay (s)' }, showAug: { value: true, label: 'augmented-ui' } })
  const [k, setK] = useState(0)
  useEffect(() => {
    if (reducedMotion) return
    const t = setInterval(() => setK((x) => x + 1), replayEvery * 1000)
    return () => clearInterval(t)
  }, [replayEvery, reducedMotion])

  return (
    <div className={`absolute inset-0 grid gap-3 p-4 ${stage ? 'grid-cols-3 md:grid-cols-5' : 'grid-cols-3 p-2 gap-2'} content-center`}>
      {FRAME_KINDS.map((kind) => (
        <div key={`${kind}-${k}`} className="jx-frame-host aspect-[4/3] grid place-items-center">
          <Frame kind={kind} />
          <span className="jx-label text-[0.6rem] text-jx-accent">{kind}</span>
        </div>
      ))}
      {showAug &&
        (stage ? AUG : AUG.slice(0, 0)).map((a) => (
          <div key={a} data-augmented-ui={a} className="jx-aug aspect-[4/3] grid place-items-center p-2">
            <span className="jx-num text-[0.55rem] text-jx-dim text-center">{a}</span>
          </div>
        ))}
    </div>
  )
}
