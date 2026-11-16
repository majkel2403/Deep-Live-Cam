import { useMemo } from 'react'
import type { ISourceOptions } from '@tsparticles/engine'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { deepBg } from '../bg-kit/color'
import { hueToHex } from '@/lib/store'
import { ParticlesFx } from '../particles-kit/ParticlesFx'
import { baseOptions, budget } from '../particles-kit/options'

export default function ParticlesNetwork({ accent, accent2, hue, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    count: { value: 170, min: 30, max: 300, step: 5, label: 'węzły' },
    linkDistance: { value: 150, min: 60, max: 240, step: 5, label: 'zasięg połączeń' },
    speed: { value: 0.7, min: 0, max: 3, step: 0.05, label: 'dryf' },
    grab: { value: 200, min: 80, max: 360, step: 10, label: 'zasięg chwytu' },
    triangles: { value: true, label: 'wypełnienie trójkątów' },
  })
  const bg = deepBg(hue)
  // near-white highlight tinted by the runtime hue (never a fixed cyan)
  const highlight = hueToHex(hue, 50, 94)
  const count = Math.round(c.count * (stage ? budget(quality, stage) : 0.25))

  const options = useMemo<ISourceOptions>(
    () => ({
      ...baseOptions(quality, stage),
      particles: {
        // density scaling only on the stage – in a 260×160 card it would cull almost every node
        number: { value: count, density: { enable: stage, width: 1400, height: 900 } },
        paint: { fill: { enable: true, color: { value: [accent, accent, accent2, highlight] } } },
        shape: { type: 'circle' },
        opacity: {
          value: { min: 0.35, max: 0.95 },
          animation: { enable: !reducedMotion, speed: 0.8, sync: false },
        },
        size: { value: { min: 1, max: stage ? 2.8 : 2 } },
        links: {
          enable: true,
          distance: stage ? c.linkDistance : c.linkDistance * 0.4,
          color: accent,
          opacity: 0.44,
          width: 1,
          // in a card almost every pair links up and stacked triangles saturate → stage only
          triangles: { enable: c.triangles && stage, color: accent, opacity: 0.05 },
        },
        move: {
          enable: !reducedMotion && c.speed > 0,
          speed: c.speed,
          direction: 'none',
          random: false,
          straight: false,
          outModes: { default: 'bounce' },
        },
      },
      interactivity: {
        detectsOn: 'window',
        events: {
          onHover: { enable: true, mode: reducedMotion ? 'grab' : ['grab', 'bubble'] },
          onClick: { enable: !reducedMotion, mode: 'push' },
        },
        modes: {
          grab: { distance: c.grab, links: { opacity: 0.95, color: accent2 } },
          bubble: { distance: c.grab * 0.6, size: 4.5, duration: 1.4, opacity: 1 },
          push: { quantity: 4 },
        },
      },
    }),
    [accent, accent2, highlight, quality, stage, count, c.linkDistance, c.speed, c.grab, c.triangles, reducedMotion],
  )

  return (
    <ParticlesFx
      options={options}
      paused={paused}
      stage={stage}
      background={bg}
      code="PTC/NETWORK"
      hint="Najedź kursorem — wiązki chwytu · klik dodaje węzły"
      stats={[{ label: 'Węzły', value: count }]}
      label="Animowana sieć połączonych węzłów"
    />
  )
}
