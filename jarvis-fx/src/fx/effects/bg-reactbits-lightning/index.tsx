/*
 * bg-reactbits-lightning – ported/adapted from React Bits "Lightning" by David Haz (MIT + Commons Clause).
 * Source: https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Backgrounds/Lightning/Lightning.tsx
 * Licence of the component: MIT + Commons Clause – https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md
 *   Commons Clause: the software may not be sold, i.e. offered for a fee as a product or service whose value
 *   derives substantially from it. Use inside this free application is permitted.
 * Rendering library: OGL – https://github.com/oframe/ogl (Unlicense): Renderer, Program, Mesh, Triangle.
 * Adaptations: the upstream component is a raw WebGL2 class (its main branch has no OGL build), so the context,
 * program, geometry and uniforms here go through OGL; colour = FxProps.accent and backdrop tinted by the runtime
 * hue; Leva controls; pause and reduced motion driven by the app (reduced motion paints one still frame, no
 * strikes or flicker); DPR capped per quality tier and on software rasterisers; light-mode branch removed (dark
 * HUD only); the pointer spring, strike envelope and intro timing are kept from upstream; explicit release of the
 * program, geometry and WebGL context on unmount; HUD overlay.
 */
import { useEffect, useRef } from 'react'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { BgHud } from '../bg-kit/BgHud'
import { deepBg, dprFor, hexToRgb01, isSoftwareGL } from '../bg-kit/color'
import { LIGHTNING_FRAGMENT, LIGHTNING_VERTEX } from './shaders'

/** Array sizes baked into the GLSL (`uStrikes[4]`, `uStrikeInfo[4]`, bolt loop). */
const MAX_STRIKES = 4
const MAX_BOLTS = 4
/** Seconds a strike spends in its leader phase before the main discharge. */
const LEADER = 0.11
/** Seconds a strike stays alive (upstream timing). */
const LIFE = 1.3
/** Software rasterisers: the per-pixel fbm stack is heavy, so the full-screen pass runs at half resolution. */
const SOFTWARE_DPR = 0.5
/** Pointer spring (stiffness / damping) and presence easing, as in the upstream component. */
const SPRING_K = 120
const SPRING_D = 19
const PRESENCE_IN = 0.3
const PRESENCE_OUT = 0.55
/** Intro sweep duration in ms; the arcs reveal from the top edge down. */
const INTRO_MS = 420

interface Strike {
  x: number
  y: number
  born: number
  seed: number
  reach: number
}

interface Settings {
  color: [number, number, number]
  intensity: number
  glow: number
  speed: number
  flicker: number
  bolts: number
  branches: number
  strikes: boolean
  paused: boolean
  still: boolean
  dpr: number
}

const smootherstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/** OGL falls back to WebGL1 silently; the GLSL needs WebGL2, so anything else is treated as unsupported. */
function tryRenderer(canvas: HTMLCanvasElement): Renderer | null {
  try {
    const renderer = new Renderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: false, depth: false, dpr: 1 })
    return renderer.isWebgl2 ? renderer : null
  } catch {
    return null
  }
}

export default function ReactBitsLightning({ accent, hue, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    intensity: { value: 1, min: 0.2, max: 2.5, step: 0.05, label: 'natężenie' },
    glow: { value: 1, min: 0.3, max: 2.5, step: 0.05, label: 'poświata' },
    speed: { value: 1, min: 0, max: 3, step: 0.05, label: 'prędkość' },
    flicker: { value: 0.6, min: 0, max: 1, step: 0.02, label: 'migotanie' },
    bolts: { value: 2, min: 1, max: MAX_BOLTS, step: 1, label: 'wyładowania' },
    branches: { value: 0.5, min: 0, max: 1, step: 0.02, label: 'rozgałęzienia' },
    strikes: { value: true, label: 'uderzenia kliknięciem' },
  })
  const hostRef = useRef<HTMLDivElement>(null)
  const fallbackRef = useRef<HTMLDivElement>(null)
  const wakeRef = useRef<(() => void) | null>(null)

  // cards draw at most two bolts: the per-pixel cost scales with the bolt count
  const bolts = Math.min(MAX_BOLTS, Math.max(1, Math.round(stage ? c.bolts : Math.min(c.bolts, 2))))

  const settings: Settings = {
    color: hexToRgb01(accent),
    intensity: c.intensity,
    glow: c.glow,
    speed: c.speed,
    flicker: c.flicker,
    bolts,
    branches: c.branches,
    strikes: c.strikes,
    paused,
    still: reducedMotion,
    dpr: dprFor(quality),
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

    const renderer = tryRenderer(canvas)
    if (!renderer) {
      // unsupported: reveal the message by DOM (no re-render needed, and no setState inside the effect)
      if (fallbackRef.current) fallbackRef.current.style.display = 'grid'
      canvas.remove()
      return undefined
    }
    const gl = renderer.gl
    const software = isSoftwareGL(gl)
    const dprNow = () => {
      const s = settingsRef.current
      return software ? Math.min(s.dpr, SOFTWARE_DPR) : s.dpr
    }

    // strike slots are arrays of arrays: OGL flattens them into one vec4[4] upload
    const strikeUniform: number[][] = Array.from({ length: MAX_STRIKES }, () => [0, 0, 0, 0])
    const infoUniform: number[][] = Array.from({ length: MAX_STRIKES }, () => [0, 0, 0, 0])

    const program = new Program(gl, {
      vertex: LIGHTNING_VERTEX,
      fragment: LIGHTNING_FRAGMENT,
      uniforms: {
        uResolution: { value: [1, 1] },
        uPhase: { value: 0.21 },
        uColor: { value: [0.3, 0.42, 1] },
        uIntensity: { value: 1 },
        uSize: { value: 1 },
        uThickness: { value: 1 },
        uGlow: { value: 1 },
        uFlicker: { value: 0.6 },
        uBranches: { value: 0.5 },
        uXOffset: { value: 0 },
        uAngle: { value: 0 },
        uSpread: { value: 0.6 },
        uBolts: { value: 1 },
        uPointer: { value: [0, 0, 0, 1] },
        uStrikes: { value: strikeUniform },
        uStrikeInfo: { value: infoUniform },
        uFlash: { value: 0 },
        uIntro: { value: 1 },
        uLight: { value: 0 },
        uFade: { value: 0 },
        uOpacity: { value: 1 },
      },
    })
    const geometry = new Triangle(gl)
    const mesh = new Mesh(gl, { geometry, program })
    const u = program.uniforms

    const view = { width: 1, height: 1 }
    const pointer = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, presence: 0, inside: false }
    const strikes: Strike[] = Array.from({ length: MAX_STRIKES }, () => ({ x: 0, y: 0, born: -1, seed: 0, reach: 2 }))
    let next = 0
    let phase = 0.21
    // null = no intro (reduced motion), -1 = waiting for the first animated frame, otherwise the start time
    let introStart: number | null = settingsRef.current.still ? null : -1
    let raf = 0
    let last = 0
    let alive = true

    /** Maps CSS-pixel coordinates to the shader's centred, height-normalised space (angle is fixed at 0). */
    const toUv = (x: number, y: number): [number, number] => [(2 * x - view.width) / view.height, (view.height - 2 * y) / view.height]

    const draw = (now: number) => {
      const s = settingsRef.current
      let flash = 0
      for (let j = 0; j < MAX_STRIKES; j++) {
        const strike = strikes[j]
        const sv = strikeUniform[j]
        const iv = infoUniform[j]
        const age = strike.born < 0 ? -1 : (now - strike.born) / 1000
        if (age < 0 || age > LIFE) {
          sv.fill(0)
          iv.fill(0)
          continue
        }
        const progress = Math.min(1, age / LEADER)
        const since = age - LEADER
        let env = 0.45 + 0.35 * progress
        if (since >= 0) {
          env = 1.8 * Math.exp(-since * 5.5) * (0.85 + 0.2 * Math.sin(since * 70))
          if (since > 0.17) env += Math.exp(-(since - 0.17) * 9)
          if (since > 0.33) env += 0.7 * Math.exp(-(since - 0.33) * 10)
          flash += 0.5 * Math.exp(-since * 9)
          if (since > 0.17) flash += 0.25 * Math.exp(-(since - 0.17) * 12)
        }
        env *= 1 - smootherstep((age - (LIFE - 0.4)) / 0.4)
        sv[0] = strike.x
        sv[1] = strike.y
        sv[2] = strike.reach * (1 - progress ** 1.6)
        sv[3] = env
        iv[0] = strike.seed
        iv[1] = strike.reach
        iv[2] = since >= 0 ? 1 : 0
        iv[3] = 0
      }
      const intro = introStart === null ? 1 : introStart < 0 ? 0 : Math.min(1, (now - introStart) / INTRO_MS)
      const [px, py] = toUv(pointer.x, pointer.y)
      u.uResolution.value = [canvas.width, canvas.height]
      u.uPhase.value = phase
      u.uColor.value = s.color
      u.uIntensity.value = Math.max(0, s.intensity)
      u.uGlow.value = Math.max(0.01, s.glow)
      u.uFlicker.value = s.still ? 0 : Math.min(1, Math.max(0, s.flicker))
      u.uBranches.value = Math.min(1, Math.max(0, s.branches))
      u.uBolts.value = s.bolts
      u.uPointer.value = [px, py, pointer.presence, 1]
      u.uFlash.value = Math.min(1, flash)
      u.uIntro.value = intro
      renderer.render({ scene: mesh })
    }

    const size = () => {
      const dpr = dprNow()
      if (renderer.dpr !== dpr) renderer.dpr = dpr
      view.width = Math.max(1, host.clientWidth)
      view.height = Math.max(1, host.clientHeight)
      renderer.setSize(view.width, view.height)
      draw(performance.now())
    }

    const frame = (now: number) => {
      raf = 0
      const s = settingsRef.current
      if (!alive || s.paused || s.still) return
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      if (introStart !== null && introStart < 0) introStart = now
      phase = (phase + (dt * Math.max(0, s.speed)) / 10) % 1
      // spring the pointer towards the cursor in sub-steps, so the motion is stable at any frame rate
      const steps = Math.max(1, Math.ceil(dt / (1 / 120)))
      const h = dt / steps
      for (let n = 0; n < steps; n++) {
        pointer.vx += (SPRING_K * (pointer.tx - pointer.x) - SPRING_D * pointer.vx) * h
        pointer.vy += (SPRING_K * (pointer.ty - pointer.y) - SPRING_D * pointer.vy) * h
        pointer.x += pointer.vx * h
        pointer.y += pointer.vy * h
      }
      const goal = pointer.inside ? 1 : 0
      pointer.presence += (goal - pointer.presence) * (1 - Math.exp(-dt / (goal > pointer.presence ? PRESENCE_IN : PRESENCE_OUT)))
      draw(now)
      raf = requestAnimationFrame(frame)
    }

    /** Restarts the loop after pause / a settings change; reduced motion repaints one still frame instead. */
    const wake = () => {
      if (!alive) return
      const s = settingsRef.current
      if (dprNow() !== renderer.dpr) size()
      if (s.still) {
        draw(performance.now())
        return
      }
      if (s.paused || raf) return
      last = 0
      raf = requestAnimationFrame(frame)
    }

    const pointerIn = (event: PointerEvent): [number, number, boolean] => {
      const rect = host.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      return [x, y, x >= 0 && y >= 0 && x <= rect.width && y <= rect.height]
    }

    const onMove = (event: PointerEvent) => {
      if (settingsRef.current.still) return
      const [x, y, inside] = pointerIn(event)
      if (inside && !pointer.inside && pointer.presence < 0.02) {
        // a cursor entering from rest should not sweep the arcs across the screen
        pointer.x = x
        pointer.y = y
        pointer.vx = 0
        pointer.vy = 0
      }
      pointer.tx = x
      pointer.ty = y
      pointer.inside = inside
      wake()
    }

    const onLeave = () => {
      pointer.inside = false
      wake()
    }

    const onDown = (event: PointerEvent) => {
      const s = settingsRef.current
      if (!s.strikes || s.still) return
      const [x, y, inside] = pointerIn(event)
      if (!inside) return
      const [ux, uy] = toUv(x, y)
      const strike = strikes[next]
      next = (next + 1) % MAX_STRIKES
      strike.x = ux
      strike.y = uy
      // angle is fixed at 0, so the upstream reach term reduces to (top - uy + 0.2) with top = 1
      strike.reach = 1.2 - uy
      strike.born = performance.now()
      strike.seed = Math.random() * 100
      wake()
    }

    const resizeObserver = new ResizeObserver(() => size())
    resizeObserver.observe(host)
    host.addEventListener('pointermove', onMove, { passive: true })
    host.addEventListener('pointerleave', onLeave)
    host.addEventListener('pointerdown', onDown, { passive: true })
    size()
    wakeRef.current = wake
    wake()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      wakeRef.current = null
      resizeObserver.disconnect()
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      host.removeEventListener('pointerdown', onDown)
      geometry.remove()
      program.remove()
      canvas.remove()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  // Re-run after every render so Leva edits, accent or hue changes and resume-from-pause repaint or restart the loop.
  useEffect(() => {
    wakeRef.current?.()
  })

  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden" style={{ background: deepBg(hue, 3) }}>
      <div ref={fallbackRef} className="absolute inset-0 place-items-center" style={{ display: 'none' }}>
        <span className="jx-label text-jx-danger">Wymagany WebGL2</span>
      </div>
      <BgHud
        code="BG/REACT BITS · LIGHTNING"
        stage={stage}
        paused={paused}
        hint="Kliknięcie wywołuje uderzenie · kursor przyciąga łuki"
        stats={[{ label: 'Łuki', value: bolts }]}
        vignette={0.45}
      />
    </div>
  )
}
