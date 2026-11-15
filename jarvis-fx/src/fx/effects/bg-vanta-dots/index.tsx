import { useCallback } from 'react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import type { VantaEffect } from 'vanta/dist/vanta.dots.min'
import { deepBg, hexToNum } from '../bg-kit/color'
import { importWithGlobalThree, useVanta } from '../bg-kit/useVanta'
import { setColor, type V3Object } from '../bg-kit/vantaUtil'
import { VantaShell } from '../bg-kit/VantaShell'

// DOTS ignores the THREE option (no constructor override upstream) → global shim during import
const load = () => importWithGlobalThree(() => import('vanta/dist/vanta.dots.min'))

export default function VantaDots({ accent, accent2, hue, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    size: { value: 3, min: 1, max: 7, step: 0.25, label: 'rozmiar punktu' },
    spacing: { value: 32, min: 18, max: 55, step: 1, label: 'rozstaw' },
    showLines: { value: true, label: 'kłąb promieni' },
  })
  const bg = deepBg(hue, 3)
  // DOTS bakes colour and point size into its materials at init → update them in place
  const apply = useCallback((fx: VantaEffect) => {
    const { color, color2, size } = fx.options
    const field = fx.starField as V3Object | undefined
    setColor(field, color)
    if (field?.material && typeof size === 'number') field.material.size = size
    setColor(fx.linesMesh, color2)
  }, [])
  const { hostRef, status } = useVanta({
    load,
    options: { color: hexToNum(accent), color2: hexToNum(accent2), backgroundColor: hexToNum(bg), size: c.size, spacing: c.spacing, showLines: c.showLines },
    rebuildKey: `${c.spacing}|${c.showLines}|${quality}`,
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
      code="BG/VANTA · DOTS"
      hint="Kursor steruje przelotem kamery"
      stats={[{ label: 'Punkty', value: 61 * 61 }]}
      stage={stage}
      paused={paused}
    />
  )
}
