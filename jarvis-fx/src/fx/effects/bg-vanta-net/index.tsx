import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { deepBg, hexToNum } from '../bg-kit/color'
import { useVanta } from '../bg-kit/useVanta'
import { VantaShell } from '../bg-kit/VantaShell'

const load = () => import('vanta/dist/vanta.net.min')

export default function VantaNet({ accent, hue, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    points: { value: 11, min: 5, max: 18, step: 1, label: 'węzły / oś' },
    maxDistance: { value: 21, min: 10, max: 32, step: 1, label: 'zasięg połączeń' },
    spacing: { value: 16, min: 10, max: 26, step: 1, label: 'rozstaw' },
    showDots: { value: true, label: 'pokaż węzły' },
  })
  // cards are ~260×160 px: a smaller lattice keeps several contexts affordable
  const points = stage ? c.points : Math.min(c.points, 8)
  const bg = deepBg(hue)
  const { hostRef, status } = useVanta({
    load,
    options: {
      color: hexToNum(accent),
      backgroundColor: hexToNum(bg),
      maxDistance: c.maxDistance,
      points,
      spacing: c.spacing,
      showDots: c.showDots,
    },
    rebuildKey: `${points}|${c.spacing}|${c.showDots}|${quality}`,
    paused,
    reducedMotion,
    quality,
  })
  return (
    <VantaShell
      hostRef={hostRef}
      status={status}
      background={bg}
      code="BG/VANTA · NET"
      hint="Ruch kursora obraca kamerę wokół sieci"
      stats={[{ label: 'Węzły', value: points * points * 2 }]}
      stage={stage}
      paused={paused}
    />
  )
}
