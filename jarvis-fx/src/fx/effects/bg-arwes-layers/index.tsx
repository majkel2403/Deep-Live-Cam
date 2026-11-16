import { useEffect, useMemo, useRef, useState } from 'react'
import { createBackgroundDots, createBackgroundGridLines, createBackgroundMovingLines, createBackgroundPuffs } from '@arwes/bgs'
import type { AnimatorNode } from '@arwes/animator'
import { IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { HudButton, StatusDot } from '@/hud'
import { createAnimatorShim, type ArwesAnimatorShim, type ArwesNodeState } from '@/hud/arwes'
import { BgHud } from '../bg-kit/BgHud'
import { deepBg } from '../bg-kit/color'

type Layer = 'grid' | 'dots' | 'lines' | 'puffs'

const LAYERS: { id: Layer; label: string; api: string }[] = [
  { id: 'grid', label: 'Siatka', api: 'createBackgroundGridLines' },
  { id: 'dots', label: 'Kropki', api: 'createBackgroundDots' },
  { id: 'lines', label: 'Ruchome linie', api: 'createBackgroundMovingLines' },
  { id: 'puffs', label: 'Obłoki', api: 'createBackgroundPuffs' },
]

const STATE_PL: Record<ArwesNodeState, string> = {
  entering: 'wejście',
  entered: 'aktywny',
  exiting: 'wyjście',
  exited: 'uśpiony',
}

const DOT_TYPES = { krzyżyk: 'cross', kwadrat: 'box', okrąg: 'circle' } as const
type DotType = (typeof DOT_TYPES)[keyof typeof DOT_TYPES]

/** @arwes/bgs only reads state, settings.duration and subscribe() – the shim provides exactly that. */
const asNode = (s: ArwesAnimatorShim) => s as unknown as AnimatorNode

export default function ArwesLayers({ hue, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    grid: { value: true, label: 'siatka' },
    dots: { value: true, label: 'kropki' },
    lines: { value: true, label: 'ruchome linie' },
    puffs: { value: true, label: 'obłoki' },
    distance: { value: 40, min: 20, max: 90, step: 2, label: 'odstęp (px)' },
    dotType: { value: 'cross' as DotType, options: DOT_TYPES, label: 'kształt kropek' },
  })
  const canvases = useRef<Record<Layer, HTMLCanvasElement | null>>({ grid: null, dots: null, lines: null, puffs: null })
  const distance = stage ? c.distance : Math.max(16, Math.round(c.distance * 0.6))

  // One shim per loop rhythm: puffs breathe every ~3 s, lines sweep every ~9 s.
  const shims = useMemo(
    () => ({
      base: createAnimatorShim({ enter: 1.2, exit: 0.6, interval: 10 }),
      lines: createAnimatorShim({ enter: 1.2, exit: 0.6, interval: 9 }),
      puffs: createAnimatorShim({ enter: 1.2, exit: 0.6, interval: 3 }),
    }),
    [],
  )
  // the two looping layers exist only to move → reduced motion keeps grid + dots
  const lines = c.lines && !reducedMotion
  const puffs = c.puffs && !reducedMotion
  const [state, setState] = useState<ArwesNodeState>('exited')
  const replayTimer = useRef<number>(0)

  useEffect(() => {
    const off = shims.base.subscribe((n) => setState(n.state))
    Object.values(shims).forEach((s) => s.transition('enter'))
    return () => {
      off()
      window.clearTimeout(replayTimer.current)
    }
  }, [shims])

  const color = (alpha: number) => `hsla(${hue}, 100%, 62%, ${alpha})`

  useEffect(() => {
    const el = canvases.current.grid
    if (paused || !c.grid || !el) return
    const h = createBackgroundGridLines({
      canvas: el,
      animator: asNode(shims.base),
      settingsRef: { current: { lineColor: color(0.1), distance, horizontalLineDash: [4], verticalLineDash: [] } },
    })
    return () => h.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, c.grid, hue, distance, shims])

  useEffect(() => {
    const el = canvases.current.dots
    if (paused || !c.dots || !el) return
    const h = createBackgroundDots({
      canvas: el,
      animator: asNode(shims.base),
      settingsRef: { current: { color: color(0.28), distance, size: c.dotType === 'cross' ? 1.5 : 2.5, type: c.dotType, crossSize: 5, origin: 'center' } },
    })
    return () => h.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, c.dots, c.dotType, hue, distance, shims])

  useEffect(() => {
    const el = canvases.current.lines
    if (paused || !lines || !el) return
    const h = createBackgroundMovingLines({
      canvas: el,
      animator: asNode(shims.lines),
      settingsRef: { current: { lineColor: color(0.22), distance, sets: stage ? 14 : 8 } },
    })
    return () => h.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, lines, hue, distance, stage, shims])

  useEffect(() => {
    const el = canvases.current.puffs
    if (paused || !puffs || !el) return
    const h = createBackgroundPuffs({
      canvas: el,
      animator: asNode(shims.puffs),
      // each puff is a radial gradient per frame – keep the count modest for software rasterisers
      settingsRef: { current: { color: color(0.34), quantity: stage ? 280 : 90, padding: 20 } },
    })
    return () => h.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, puffs, hue, stage, shims])

  const replay = () => {
    Object.values(shims).forEach((s) => s.transition('exit'))
    window.clearTimeout(replayTimer.current)
    replayTimer.current = window.setTimeout(() => Object.values(shims).forEach((s) => s.transition('enter')), 700)
  }
  const toggleOut = () => Object.values(shims).forEach((s) => s.transition(state === 'exited' || state === 'exiting' ? 'enter' : 'exit'))
  const enabled: Record<Layer, boolean> = { grid: c.grid, dots: c.dots, lines, puffs }

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 40%, ${deepBg(hue, 7)}, ${deepBg(hue, 2.5)} 70%)` }}>
      {LAYERS.map((l) => (
        <canvas key={l.id} ref={(el) => void (canvases.current[l.id] = el)} className="absolute inset-0 h-full w-full" style={{ opacity: 0 }} aria-hidden="true" />
      ))}
      <BgHud code="BG/ARWES · LAYERS" stage={stage} paused={paused} hint="Warstwy włączasz w panelu parametrów" vignette={0.45} />
      {stage && (
        // augmented-ui forces position:relative on its host, so the anchor is a separate wrapper
        <div className="absolute bottom-6 left-6 z-20 w-72">
          <section data-augmented-ui="tl-clip br-clip border" className="jx-aug flex flex-col gap-2 p-3" aria-label="Warstwy ARWES">
            <header className="flex items-center justify-between">
              <span className="jx-title text-xs">Animator</span>
              <span className="jx-num text-[0.7rem] text-jx-accent" aria-live="polite">
                {STATE_PL[state]}
              </span>
            </header>
            <ul className="flex flex-col gap-1">
              {LAYERS.map((l) => (
                <li key={l.id} className="flex items-center gap-2 text-xs">
                  <StatusDot tone={enabled[l.id] ? 'ok' : 'dim'} pulse={enabled[l.id] && (state === 'entering' || state === 'exiting')} />
                  <span className="font-ui text-jx-text">{l.label}</span>
                  <span className="jx-num ml-auto truncate text-[0.66rem] text-jx-dim">{l.api}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1">
              <HudButton size="sm" onClick={replay} icon={<IconPlayerPlay />} disabled={paused}>
                Odtwórz wejście
              </HudButton>
              <HudButton size="sm" onClick={toggleOut} icon={<IconPlayerStop />} active={state === 'exited' || state === 'exiting'} disabled={paused}>
                Wygaś
              </HudButton>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
