/*
 * bg-reactbits-eye – ported/adapted from React Bits "Evil Eye" by David Haz (OGL build).
 * Source: https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Backgrounds/EvilEye/EvilEye.tsx
 * License of the component: MIT + Commons Clause – https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md
 *   (free to use inside an application; the component itself may not be sold or redistributed alone).
 * Rendering library: OGL – https://github.com/oframe/ogl (Unlicense): Renderer, Program, Mesh, Triangle, Texture.
 * Adaptations: eye colour = FxProps.accent and backdrop tinted by the runtime hue (no fixed palette), Leva
 * controls, pause and reduced motion driven by the app (no loop while paused; a single still frame when
 * reduced), DPR capped per quality tier and on software rasterisers, noise texture cached per page load,
 * dark-only (light-mode branch removed), HUD overlay, explicit context release on unmount.
 */
import { useEffect, useRef } from 'react'
import { Mesh, Program, Renderer, Texture, Triangle } from 'ogl'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { BgHud } from '../bg-kit/BgHud'
import { deepBg, dprFor, hexToRgb01, isSoftwareGL } from '../bg-kit/color'
import { eyeNoise, EYE_NOISE_SIZE } from './noise'
import { EYE_FRAGMENT, EYE_VERTEX } from './shaders'

type Vec3 = [number, number, number]

interface Settings {
  eye: Vec3
  backdrop: Vec3
  intensity: number
  pupilSize: number
  pupilFollow: number
  flameSpeed: number
  glow: number
  scale: number
  dpr: number
  still: boolean
  paused: boolean
}

/** Iris thickness and noise scale are fixed by the design; the Leva panel exposes the rest. */
const IRIS_WIDTH = 0.25
const NOISE_SCALE = 1
/** Software rasterisers (SwiftShader, llvmpipe) render the full-screen pass at reduced resolution. */
const SOFTWARE_DPR = 0.75
/** Pupil glide rate in 1/s – frame-rate independent exponential smoothing. */
const POINTER_EASE = 6

function tryRenderer(canvas: HTMLCanvasElement): Renderer | null {
  try {
    return new Renderer({ canvas, alpha: true, premultipliedAlpha: false, depth: false, dpr: 1 })
  } catch {
    return null
  }
}

export default function EvilEye({ accent, hue, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    intensity: { value: 0.95, min: 0.3, max: 3, step: 0.05, label: 'natężenie' },
    pupilSize: { value: 0.6, min: 0.2, max: 1.2, step: 0.02, label: 'źrenica' },
    pupilFollow: { value: 1, min: 0, max: 2, step: 0.05, label: 'śledzenie kursora' },
    flameSpeed: { value: 1, min: 0, max: 3, step: 0.05, label: 'prędkość płomieni' },
    glow: { value: 0.3, min: 0, max: 1, step: 0.01, label: 'poświata' },
    scale: { value: 0.8, min: 0.4, max: 1.6, step: 0.02, label: 'skala oka' },
  })
  const hostRef = useRef<HTMLDivElement>(null)
  const wakeRef = useRef<(() => void) | null>(null)
  const fallbackRef = useRef<HTMLDivElement>(null)

  const settings: Settings = {
    eye: hexToRgb01(accent),
    backdrop: hexToRgb01(deepBg(hue, 3)),
    intensity: c.intensity,
    pupilSize: c.pupilSize,
    pupilFollow: c.pupilFollow,
    flameSpeed: c.flameSpeed,
    glow: c.glow,
    scale: c.scale,
    dpr: dprFor(quality),
    still: reducedMotion,
    paused,
  }
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    // A fresh canvas per mount: a context lost in StrictMode's simulated unmount must never be reused.
    const canvas = document.createElement('canvas')
    canvas.className = 'absolute inset-0 block h-full w-full'
    canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(canvas)

    // OGL throws when neither webgl2 nor webgl is available
    const renderer = tryRenderer(canvas)
    if (!renderer) {
      // one-off fallback: show the message by DOM (no re-render needed, and no setState inside the effect)
      if (fallbackRef.current) fallbackRef.current.style.display = 'grid'
      canvas.remove()
      return undefined
    }
    const gl = renderer.gl
    const software = isSoftwareGL(gl)
    const dprFromSettings = () => (software ? Math.min(settingsRef.current.dpr, SOFTWARE_DPR) : settingsRef.current.dpr)

    const noise = new Texture(gl, {
      image: eyeNoise(),
      width: EYE_NOISE_SIZE,
      height: EYE_NOISE_SIZE,
      generateMipmaps: false,
      flipY: false,
    })
    noise.minFilter = gl.LINEAR
    noise.magFilter = gl.LINEAR
    noise.wrapS = gl.REPEAT
    noise.wrapT = gl.REPEAT

    const geometry = new Triangle(gl)
    const program = new Program(gl, {
      vertex: EYE_VERTEX,
      fragment: EYE_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [1, 1, 1] },
        uNoiseTexture: { value: noise },
        uPupilSize: { value: 0.6 },
        uIrisWidth: { value: IRIS_WIDTH },
        uGlowIntensity: { value: 0.3 },
        uIntensity: { value: 0.95 },
        uScale: { value: 0.8 },
        uNoiseScale: { value: NOISE_SCALE },
        uMouse: { value: [0, 0] },
        uPupilFollow: { value: 1 },
        uFlameSpeed: { value: 1 },
        uEyeColor: { value: [1, 1, 1] },
        uBgColor: { value: [0, 0, 0] },
      },
    })
    const mesh = new Mesh(gl, { geometry, program })
    const u = program.uniforms

    // pointer state: `target` is where the cursor is, `mouse` is the eased pupil offset
    const pointer = { target: [0, 0] as [number, number], mouse: [0, 0] as [number, number] }
    let time = 0
    let raf = 0
    let last = 0
    let alive = true

    const draw = () => {
      const s = settingsRef.current
      u.uEyeColor.value = s.eye
      u.uBgColor.value = s.backdrop
      u.uIntensity.value = s.intensity
      u.uPupilSize.value = s.pupilSize
      u.uPupilFollow.value = s.pupilFollow
      u.uFlameSpeed.value = s.flameSpeed
      u.uGlowIntensity.value = s.glow
      u.uScale.value = s.scale
      u.uTime.value = time
      u.uMouse.value = pointer.mouse
      renderer.render({ scene: mesh })
    }

    const size = () => {
      const dpr = dprFromSettings()
      if (renderer.dpr !== dpr) renderer.dpr = dpr
      renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight))
      u.uResolution.value = [gl.canvas.width, gl.canvas.height, gl.canvas.width / Math.max(1, gl.canvas.height)]
      draw()
    }

    const frame = (now: number) => {
      raf = 0
      const s = settingsRef.current
      if (!alive || s.paused) return
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      time += dt * s.flameSpeed
      const follow = 1 - Math.exp(-dt * POINTER_EASE)
      pointer.mouse[0] += (pointer.target[0] - pointer.mouse[0]) * follow
      pointer.mouse[1] += (pointer.target[1] - pointer.mouse[1]) * follow
      draw()
      raf = requestAnimationFrame(frame)
    }

    /** Restarts the loop after pause / a settings change; reduced motion repaints one still frame instead. */
    const wake = () => {
      if (!alive) return
      const s = settingsRef.current
      if (dprFromSettings() !== renderer.dpr) {
        size()
        return
      }
      if (s.paused) return
      if (s.still) {
        pointer.mouse = [...pointer.target]
        draw()
        return
      }
      if (!raf) {
        last = 0
        raf = requestAnimationFrame(frame)
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
      const y = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1)
      pointer.target = [x, y]
      wake()
    }
    const onPointerLeave = () => {
      pointer.target = [0, 0]
      wake()
    }

    const resizeObserver = new ResizeObserver(() => size())
    resizeObserver.observe(host)
    host.addEventListener('pointermove', onPointerMove, { passive: true })
    host.addEventListener('pointerleave', onPointerLeave)
    size()
    wakeRef.current = wake
    wake()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      wakeRef.current = null
      resizeObserver.disconnect()
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerleave', onPointerLeave)
      geometry.remove()
      program.remove()
      gl.deleteTexture(noise.texture)
      canvas.remove()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  // Re-run after every render so Leva edits, accent or hue changes and resume-from-pause repaint or restart the loop.
  useEffect(() => {
    wakeRef.current?.()
  })

  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden" style={{ background: deepBg(hue, 2.5) }}>
      <div ref={fallbackRef} className="absolute inset-0 place-items-center" style={{ display: 'none' }}>
        <span className="jx-label text-jx-danger">Wymagany WebGL</span>
      </div>
      <BgHud
        code="BG/REACT BITS · OKO"
        stage={stage}
        paused={paused}
        hint="Źrenica podąża za kursorem"
        stats={[{ label: 'Natężenie', value: c.intensity.toFixed(2) }]}
        vignette={0.5}
      />
    </div>
  )
}
