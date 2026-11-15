import { useMemo } from 'react'
import type { ISourceOptions } from '@tsparticles/engine'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { deepBg } from '../bg-kit/color'
import { DATA_GLYPHS, GLYPH_SHAPE, hasGlyphShape, useParticlesReady } from '../particles-kit/engine'
import { ParticlesFx } from '../particles-kit/ParticlesFx'
import { baseOptions, budget, trailVeil } from '../particles-kit/options'

const SETS = {
  'katakana + hex': DATA_GLYPHS,
  binarny: '0101100110',
  szesnastkowy: '0123456789ABCDEF',
  'symbole HUD': '◢◣◤◥▲▼◆◇○●□■△▽⌖⌬⏣',
} as const

export default function ParticlesDataRain({ accent, accent2, hue, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    speed: { value: 1, min: 0.1, max: 3, step: 0.05, label: 'prędkość' },
    density: { value: 340, min: 60, max: 600, step: 10, label: 'gęstość' },
    trail: { value: 0.8, min: 0, max: 0.96, step: 0.01, label: 'długość smug' },
    glyphs: { value: SETS['katakana + hex'] as string, options: SETS, label: 'zestaw znaków' },
    repulse: { value: true, label: 'odpychanie kursorem' },
  })
  const bg = deepBg(hue, 2.2)
  const count = Math.round(c.density * (stage ? budget(quality, stage) : 0.2))
  const trails = !reducedMotion && c.trail > 0.02
  // the glyph shape is known only after the shared engine has initialised
  const ready = useParticlesReady()
  const glyph = ready && hasGlyphShape()

  const options = useMemo<ISourceOptions>(
    () => ({
      ...baseOptions(quality, stage),
      clear: !trails,
      background: trails ? { color: 'transparent', draw: trailVeil(bg, 1 - c.trail) } : { color: 'transparent' },
      particles: {
        number: { value: count, density: { enable: stage, width: 1200, height: 800 } },
        paint: { fill: { enable: true, color: { value: [accent, accent, accent2, '#eafcff'] } } },
        // custom glyph drawer when registered; plain squares if tsParticles was initialised elsewhere first
        shape: glyph
          ? { type: GLYPH_SHAPE, options: { [GLYPH_SHAPE]: { glyphs: c.glyphs, flicker: reducedMotion ? 0 : 0.45 } } }
          : { type: 'square' },
        size: { value: { min: stage ? 6 : 4, max: stage ? 13 : 7 } },
        opacity: {
          value: { min: 0.3, max: 1 },
          animation: { enable: !reducedMotion, speed: 1.2, sync: false },
        },
        // depth layers: far glyphs are smaller, dimmer and slower
        zIndex: { value: { min: 0, max: 100 }, opacityRate: 0.5, sizeRate: 0.35, velocityRate: 0.8 },
        move: {
          enable: !reducedMotion,
          direction: 'bottom',
          straight: true,
          speed: { min: 2 * c.speed, max: 7 * c.speed },
          outModes: { default: 'out' },
        },
      },
      interactivity: {
        detectsOn: 'window',
        events: { onHover: { enable: c.repulse && !reducedMotion, mode: 'repulse' } },
        modes: { repulse: { distance: 110, duration: 0.4, speed: 0.6 } },
      },
    }),
    [accent, accent2, bg, quality, stage, count, c.speed, c.trail, c.glyphs, c.repulse, trails, glyph, reducedMotion],
  )

  if (!ready) return <div className="absolute inset-0" style={{ background: bg }} />
  return (
    <ParticlesFx
      options={options}
      paused={paused}
      stage={stage}
      background={bg}
      code="PTC/DATA-RAIN"
      hint={glyph ? 'Własny kształt „jx-glyph” · kursor odpycha strumień' : 'Tryb zastępczy: kwadraty (kształt glifów niedostępny)'}
      stats={[{ label: 'Znaki', value: count }]}
      label="Pionowy strumień migoczących znaków"
    />
  )
}
