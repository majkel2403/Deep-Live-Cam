import { useCallback } from 'react'
import { Mesh, MeshBasicMaterial } from 'three-vanta'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { hueToHex } from '@/lib/store'
import type { VantaEffect } from 'vanta/dist/vanta.waves.min'
import { hexToNum } from '../bg-kit/color'
import { useVanta } from '../bg-kit/useVanta'
import type { V3Object } from '../bg-kit/vantaUtil'
import { VantaShell } from '../bg-kit/VantaShell'

const load = () => import('vanta/dist/vanta.waves.min')

interface SceneLike {
  add: (o: unknown) => void
  children: { isAmbientLight?: boolean; isPointLight?: boolean; intensity: number; color?: { set: (c: number) => void } }[]
}

export default function VantaWaves({ accent, hue, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    waveHeight: { value: 18, min: 4, max: 40, step: 1, label: 'wysokość fal' },
    waveSpeed: { value: 0.8, min: 0.1, max: 2.5, step: 0.05, label: 'tempo fal' },
    shininess: { value: 28, min: 0, max: 150, step: 1, label: 'połysk' },
    zoom: { value: 0.9, min: 0.65, max: 1.6, step: 0.01, label: 'zbliżenie' },
    wire: { value: true, label: 'siatka holo' },
  })
  // Overlay: an accent wireframe mesh sharing the plane's geometry, so it rides the same waves.
  const apply = useCallback((fx: VantaEffect) => {
    const plane = fx.plane as V3Object | undefined
    const scene = fx.scene as SceneLike | undefined
    if (!plane || !scene) return
    const want = fx.options.jxWire === true
    let wire = fx.jxWireMesh as V3Object | undefined
    if (want && !wire) {
      wire = new Mesh(plane.geometry, new MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.6 })) as V3Object
      fx.jxWireMesh = wire
      scene.add(wire)
    }
    if (wire) {
      wire.visible = want
      wire.material?.color?.set(fx.options.jxWireColor as number)
    }
    // Vanta lights the sea with flat white; dim the fill and tint the key light for a night-ops look
    for (const l of scene.children) {
      if (l.isAmbientLight) l.intensity = 0.38
      if (l.isPointLight) {
        l.intensity = 1.1
        l.color?.set(fx.options.jxLightColor as number)
      }
    }
  }, [])
  const { hostRef, status } = useVanta({
    load,
    options: {
      color: hexToNum(hueToHex(hue, 90, 12)),
      backgroundColor: hexToNum(hueToHex(hue, 70, 3)),
      shininess: c.shininess,
      waveHeight: c.waveHeight,
      waveSpeed: c.waveSpeed,
      zoom: c.zoom,
      jxWire: c.wire,
      jxWireColor: hexToNum(accent),
      jxLightColor: hexToNum(hueToHex(hue, 60, 78)),
    },
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
      background={hueToHex(hue, 70, 3)}
      code="BG/VANTA · WAVES"
      hint="Kursor przesuwa kamerę nad taflą"
      stats={[{ label: 'Fala', value: `${c.waveHeight} j.` }]}
      stage={stage}
      paused={paused}
    />
  )
}
