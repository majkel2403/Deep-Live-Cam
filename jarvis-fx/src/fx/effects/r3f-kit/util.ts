import { useEffect, useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Color, type IUniform, type ShaderMaterialParameters } from 'three'

/*
 * Shared helpers for the r3f-* effects (not an effect itself: no meta.ts / index.tsx here).
 */

const WHITE = new Color('#ffffff')

const argsCache = new WeakMap<object, [ShaderMaterialParameters]>()

/**
 * R3F ≥ 9.8 copies a `uniforms` *prop* into the material's own uniform objects, so later `u.x.value = …`
 * writes (clocks in useFrame, Leva values) never reach the GPU. Handing the object to the constructor keeps
 * the reference instead:  <shaderMaterial args={uniformArgs(u)} vertexShader={…} … />
 * The args tuple is cached per uniforms object, so R3F never sees new args (which would rebuild the material).
 */
export function uniformArgs(uniforms: Record<string, IUniform>): [ShaderMaterialParameters] {
  let args = argsCache.get(uniforms)
  if (!args) {
    args = [{ uniforms }]
    argsCache.set(uniforms, args)
  }
  return args
}

/** Accent mixed towards white (0 = accent, 1 = white) as a hex string — keeps "white-hot" parts on-hue. */
export function tint(accent: string, mix: number): string {
  return '#' + new Color(accent).lerp(WHITE, mix).getHexString()
}

/**
 * With frameloop="demand" (paused or reduced motion) R3F only redraws when JSX props change, so uniforms
 * mutated during render or inside useFrame would not show a Leva change. Render one frame whenever any of
 * the given live parameters change. Place inside <Canvas>.
 */
export function useRedrawOn(params: unknown) {
  const invalidate = useThree((s) => s.invalidate)
  const key = JSON.stringify(params)
  useEffect(() => {
    invalidate()
  }, [key, invalidate])
}

export function Redraw({ on }: { on: unknown }) {
  useRedrawOn(on)
  return null
}

/**
 * Scenes are framed for a wide canvas (`designAspect`, e.g. 1.6). On narrower canvases (the gallery stage
 * next to the parameter panel, portrait screens) pull the camera back along z so the composition stays in frame.
 */
export function useFitAspect(z: number, designAspect = 1.6, maxPull = 1.6) {
  const camera = useThree((s) => s.camera)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  const invalidate = useThree((s) => s.invalidate)
  useLayoutEffect(() => {
    const aspect = width / Math.max(1, height)
    camera.position.z = z * Math.min(maxPull, Math.max(1, (designAspect / aspect) ** 0.85))
    invalidate()
  }, [camera, width, height, z, designAspect, maxPull, invalidate])
}
