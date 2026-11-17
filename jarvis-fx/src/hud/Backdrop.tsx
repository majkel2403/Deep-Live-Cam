import { useEffect, useRef } from 'react'
import { createBackgroundDots, createBackgroundGridLines, createBackgroundMovingLines, createBackgroundPuffs } from '@arwes/bgs'
import type { AnimatorNode } from '@arwes/animator'
import { createAnimatorShim } from './arwes'
import { useAccent, useReducedMotion } from '@/lib/store'

type Layer = 'grid' | 'dots' | 'lines' | 'puffs'

/**
 * ARWES backgrounds (@arwes/bgs, MIT): grid lines, dots, moving lines, puffs – stacked canvases.
 * Driven by a tiny animator shim so we don't need @arwes/react.
 */
export function Backdrop({ layers = ['grid', 'dots', 'lines'], className = 'fixed inset-0 -z-10', intensity = 1 }: { layers?: Layer[]; className?: string; intensity?: number }) {
  const { hue } = useAccent()
  const reduced = useReducedMotion()
  const refs = useRef<Record<Layer, HTMLCanvasElement | null>>({ grid: null, dots: null, lines: null, puffs: null })
  // A string key keeps the effect dependency stable when callers pass an inline array literal.
  const layerKey = layers.join(',')

  useEffect(() => {
    const active = layerKey.split(',').filter(Boolean) as Layer[]
    const a = (alpha: number) => `hsla(${hue}, 100%, 60%, ${alpha * intensity})`
    // The shim implements the subset of AnimatorNode that @arwes/bgs reads (state, settings, subscribe).
    const shim = createAnimatorShim({ enter: 1.2, interval: reduced ? 1e9 : 12 })
    const animator = shim as unknown as AnimatorNode
    const handles: { cancel: () => void }[] = []
    const c = refs.current
    if (c.grid && active.includes('grid'))
      handles.push(createBackgroundGridLines({ canvas: c.grid, animator, settingsRef: { current: { lineColor: a(0.08), distance: 40, horizontalLineDash: [4], verticalLineDash: [] } } }))
    if (c.dots && active.includes('dots'))
      handles.push(createBackgroundDots({ canvas: c.dots, animator, settingsRef: { current: { color: a(0.16), distance: 40, size: 2, type: 'cross', crossSize: 4, origin: 'center' } } }))
    if (c.lines && active.includes('lines'))
      handles.push(createBackgroundMovingLines({ canvas: c.lines, animator, settingsRef: { current: { lineColor: a(0.12), distance: 40, sets: 18 } } }))
    if (c.puffs && active.includes('puffs'))
      handles.push(createBackgroundPuffs({ canvas: c.puffs, animator, settingsRef: { current: { color: a(0.35), quantity: 600 } } }))
    shim.transition('enter')
    return () => handles.forEach((h) => h.cancel())
  }, [hue, reduced, intensity, layerKey])

  return (
    <div className={`${className} pointer-events-none`} aria-hidden="true" style={{ background: 'radial-gradient(ellipse at 50% 40%, var(--jx-bg-2), var(--jx-bg) 70%)' }}>
      {(['grid', 'dots', 'lines', 'puffs'] as Layer[]).map((l) =>
        layers.includes(l) ? <canvas key={l} ref={(el) => void (refs.current[l] = el)} className="absolute inset-0 w-full h-full" /> : null,
      )}
    </div>
  )
}
