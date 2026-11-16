import { useCallback } from 'react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import type { VantaEffect } from 'vanta/dist/vanta.globe.min'
import { deepBg, hexToNum } from '../bg-kit/color'
import { useVanta } from '../bg-kit/useVanta'
import { setColor } from '../bg-kit/vantaUtil'
import { VantaShell } from '../bg-kit/VantaShell'

const load = () => import('vanta/dist/vanta.globe.min')

export default function VantaGlobe({ accent, accent2, hue, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    size: { value: 0.95, min: 0.6, max: 1.6, step: 0.05, label: 'rozmiar kuli' },
    points: { value: 10, min: 5, max: 14, step: 1, label: 'węzły / oś' },
    maxDistance: { value: 20, min: 10, max: 30, step: 1, label: 'zasięg połączeń' },
    showDots: { value: true, label: 'pokaż węzły' },
  })
  const points = stage ? c.points : Math.min(c.points, 7)
  const bg = deepBg(hue)
  // Vanta reads the globe/line colours only at init → recolour the materials in place
  const apply = useCallback((fx: VantaEffect) => {
    const { color, color2 } = fx.options
    setColor(fx.sphere, color)
    setColor(fx.linesMesh2, color2)
    setColor(fx.linesMesh3, color2)
    ;(fx.points as unknown[] | null | undefined)?.forEach((p) => setColor(p, color))
  }, [])
  const { hostRef, status } = useVanta({
    load,
    options: {
      color: hexToNum(accent),
      color2: hexToNum(accent2),
      backgroundColor: hexToNum(bg),
      size: c.size,
      points,
      maxDistance: c.maxDistance,
      spacing: 15,
      showDots: c.showDots,
    },
    rebuildKey: `${points}|${c.size}|${c.showDots}|${quality}`,
    apply,
    paused,
    reducedMotion,
    quality,
  })
  return (
    <VantaShell
      hostRef={hostRef}
      status={status}
      background={bg}
      code="BG/VANTA · GLOBE"
      hint="Kursor przesuwa kamerę · kula obraca się stale"
      stats={[{ label: 'Skala kuli', value: c.size.toFixed(2) }]}
      stage={stage}
      paused={paused}
    />
  )
}
