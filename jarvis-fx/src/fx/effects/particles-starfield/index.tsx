import { useMemo } from 'react'
import type { ISourceOptions } from '@tsparticles/engine'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { deepBg } from '../bg-kit/color'
import { ParticlesFx } from '../particles-kit/ParticlesFx'
import { baseOptions, budget, trailVeil } from '../particles-kit/options'

export default function ParticlesStarfield({ accent, accent2, hue, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    warp: { value: 1, min: 0.1, max: 4, step: 0.05, label: 'współczynnik warp' },
    count: { value: 520, min: 120, max: 1000, step: 10, label: 'gwiazdy' },
    trail: { value: 0.8, min: 0, max: 0.95, step: 0.01, label: 'długość smug' },
    // 0 = respawn exactly at the vanishing point keeping each star's original heading (no 'spokes')
    core: { value: 0, min: 0, max: 120, step: 1, label: 'promień źródła (px)' },
  })
  const bg = deepBg(hue, 2.4)
  const count = Math.round(c.count * budget(quality, stage))
  const trails = !reducedMotion && c.trail > 0.02

  const options = useMemo<ISourceOptions>(
    () => ({
      ...baseOptions(quality, stage),
      // trails: never clear, veil the previous frame with the backdrop colour instead
      clear: !trails,
      background: trails ? { color: 'transparent', draw: trailVeil(bg, 1 - c.trail) } : { color: 'transparent' },
      particles: {
        number: { value: count },
        paint: { fill: { enable: true, color: { value: ['#ffffff', '#ffffff', accent, accent2] } } },
        shape: { type: 'circle' },
        size: { value: { min: 0.4, max: stage ? 2 : 1.5 } },
        opacity: { value: { min: 0.45, max: 1 } },
        move: {
          enable: !reducedMotion,
          direction: 'outside',
          center: { x: 50, y: 50, mode: 'percent', radius: stage ? c.core : 0 },
          speed: { min: (stage ? 1.6 : 0.9) * c.warp, max: (stage ? 12 : 5) * c.warp },
          straight: true,
          outModes: { default: 'out' },
        },
      },
      interactivity: {
        detectsOn: 'window',
        events: { onHover: { enable: !reducedMotion, mode: 'slow' } },
        modes: { slow: { factor: 4, radius: 160 } },
      },
    }),
    [accent, accent2, bg, quality, stage, count, c.warp, c.trail, c.core, trails, reducedMotion],
  )

  return (
    <ParticlesFx
      options={options}
      paused={paused}
      stage={stage}
      background={bg}
      code="PTC/WARP"
      hint="Najedź kursorem — lokalne spowolnienie czasu"
      stats={[
        { label: 'Gwiazdy', value: count },
        { label: 'Warp', value: `×${c.warp.toFixed(2)}` },
      ]}
      label="Gwiazdy rozbiegające się od środka jak w skoku nadświetlnym"
    >
      {/* vanishing-point reticle */}
      {stage && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
          <div className="h-16 w-16 rounded-full border border-jx-line opacity-60" />
          <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-jx-accent shadow-[0_0_10px_var(--jx-accent)]" />
        </div>
      )}
    </ParticlesFx>
  )
}
