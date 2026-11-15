import { useCallback } from 'react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import type { VantaEffect } from 'vanta/dist/vanta.rings.min'
import { accentPalette, deepBg, hexToNum } from '../bg-kit/color'
import { useVanta } from '../bg-kit/useVanta'
import { VantaShell } from '../bg-kit/VantaShell'

const load = () => import('vanta/dist/vanta.rings.min')

const PALETTES = { akcent: 'akcent', 'akcent + alarm': 'alarm', monochrom: 'mono' } as const
type PaletteMode = (typeof PALETTES)[keyof typeof PALETTES]

interface RingMesh {
  speed: number
  material: { color: { set: (c: number) => void } }
  jxBase?: number
  jxSlot?: number
}

function palette(mode: PaletteMode, hue: number): number[] {
  const acc = accentPalette(hue).map(hexToNum)
  if (mode === 'alarm') return [...acc.slice(0, 4), 0xffb000, 0xff3b5c]
  if (mode === 'mono') return [0xe8f4f8, 0x9fb3bd, 0x51646e, acc[0], acc[2]]
  return acc
}

export default function VantaRings({ hue, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    speed: { value: 1, min: 0, max: 4, step: 0.1, label: 'prędkość' },
    palette: { value: 'akcent' as PaletteMode, options: PALETTES, label: 'paleta' },
  })
  const bg = deepBg(hue, 3.5)
  // RINGS picks random colours from a fixed prototype list at init → re-tint every ring in place,
  // and scale each ring's own angular speed (Vanta has no global speed for this effect)
  const apply = useCallback((fx: VantaEffect) => {
    const pal = (fx.options.jxPalette as number[] | undefined) ?? []
    const mult = (fx.options.jxSpeed as number | undefined) ?? 1
    ;(fx.rings as RingMesh[] | undefined)?.forEach((r, i) => {
      if (r.jxBase === undefined) {
        r.jxBase = r.speed
        r.jxSlot = (i * 7 + Math.floor(Math.random() * 5)) | 0
      }
      r.speed = r.jxBase * mult
      if (pal.length) r.material.color.set(pal[(r.jxSlot ?? i) % pal.length])
    })
  }, [])
  const { hostRef, status } = useVanta({
    load,
    options: { backgroundColor: hexToNum(bg), jxPalette: palette(c.palette, hue), jxSpeed: c.speed },
    rebuildKey: quality,
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
      code="BG/VANTA · RINGS"
      hint="Kursor przechyla kamerę nad tarczami"
      stats={[{ label: 'Prędkość', value: `×${c.speed.toFixed(1)}` }]}
      stage={stage}
      paused={paused}
    />
  )
}
