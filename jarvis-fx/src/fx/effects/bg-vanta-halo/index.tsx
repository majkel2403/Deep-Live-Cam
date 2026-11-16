import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { hueToHex } from '@/lib/store'
import { deepBg, hexToNum } from '../bg-kit/color'
import { useVanta } from '../bg-kit/useVanta'
import { VantaShell } from '../bg-kit/VantaShell'

const load = () => import('vanta/dist/vanta.halo.min')

export default function VantaHalo({ accent, accent2, hue, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    size: { value: 1.4, min: 0.5, max: 2.6, step: 0.05, label: 'rozmiar' },
    amplitudeFactor: { value: 1.2, min: 0, max: 3, step: 0.05, label: 'amplituda' },
    speed: { value: 1, min: 0.1, max: 2.5, step: 0.05, label: 'prędkość' },
    xOffset: { value: 0.04, min: -0.5, max: 0.5, step: 0.01, label: 'przesunięcie X' },
    tint: { value: 0.75, min: 0, max: 1, step: 0.05, label: 'barwienie akcentem' },
  })
  const bg = deepBg(hue, 2.5)
  const { hostRef, status } = useVanta({
    load,
    // all uniforms → fully live; only the quality tier (render-target size) rebuilds
    options: {
      baseColor: hexToNum(hueToHex(hue, 100, 22)),
      color2: hexToNum(accent2),
      backgroundColor: hexToNum(bg),
      size: c.size,
      amplitudeFactor: c.amplitudeFactor,
      speed: c.speed,
      xOffset: stage ? c.xOffset : 0,
      yOffset: 0,
    },
    rebuildKey: quality,
    paused,
    reducedMotion,
    quality,
  })
  return (
    <VantaShell
      hostRef={hostRef}
      status={status}
      background={bg}
      code="BG/VANTA · HALO"
      hint="Środek pierścienia podąża za kursorem"
      stats={[{ label: 'Amplituda', value: c.amplitudeFactor.toFixed(2) }]}
      stage={stage}
      paused={paused}
    >
      {/* HALO's shader cycles a rainbow; a 'color' blend layer re-hues it to the accent, keeping luminance */}
      <div className="pointer-events-none absolute inset-0" style={{ background: accent, mixBlendMode: 'color', opacity: c.tint }} />
    </VantaShell>
  )
}
