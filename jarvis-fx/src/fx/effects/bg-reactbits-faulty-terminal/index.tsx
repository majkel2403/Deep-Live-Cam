/*
 * bg-reactbits-faulty-terminal – ported/adapted from React Bits "FaultyTerminal" by David Haz.
 * Source: https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Backgrounds/FaultyTerminal/FaultyTerminal.tsx
 * License: MIT + Commons Clause – https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md
 *   Commons Clause: the software may not be sold, i.e. offered for a fee as a product or service whose value
 *   derives substantially from it. Use inside this free application is permitted.
 * Adaptations: FxProps (tint = runtime accent, quality → DPR cap, reducedMotion/paused from the app
 * instead of matchMedia/visibility), Leva controls, HUD overlay, WebGL2-missing fallback, StrictMode-safe
 * context release.
 */
import { useEffect, useRef, useState } from 'react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { BgHud } from '../bg-kit/BgHud'
import { deepBg, dprFor, hexToRgb01, isSoftwareGL } from '../bg-kit/color'
import { CELL_FRAGMENT, CLICKS, CLICK_SECONDS, GLYPHS, INTRO_SECONDS, MAIN_FRAGMENT, MAX_CLICKS, link } from './shaders'

type Settings = {
  scale: number
  gridX: number
  gridY: number
  digitSize: number
  timeScale: number
  pause: boolean
  still: boolean
  scanlineIntensity: number
  glitchAmount: number
  flickerAmount: number
  noiseAmp: number
  chromaticAberration: number
  dither: number
  curvature: number
  tint: [number, number, number]
  mouseReact: boolean
  mouseStrength: number
  pageLoadAnimation: boolean
  brightness: number
  glyphs: number
  glow: number
  persistence: number
  scramble: number
  mouseGlow: number
  vignette: number
  clickEffect: number
  clickSeconds: number
  dpr: number
}

const GLYPH_OPTIONS = { znaki: 'characters', bloki: 'blocks', kropki: 'dots' } as const
const CLICK_OPTIONS = { zakłócenie: 'glitch', rozmagnesowanie: 'degauss', brak: 'none' } as const
type GlyphMode = (typeof GLYPH_OPTIONS)[keyof typeof GLYPH_OPTIONS]
type ClickMode = (typeof CLICK_OPTIONS)[keyof typeof CLICK_OPTIONS]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export default function FaultyTerminal({ accent, hue, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    glyphs: { value: 'characters' as GlyphMode, options: GLYPH_OPTIONS, label: 'glify' },
    scale: { value: 1.5, min: 0.5, max: 3, step: 0.05, label: 'skala siatki' },
    glitch: { value: 1, min: 0, max: 4, step: 0.1, label: 'zakłócenia' },
    curvature: { value: 0.18, min: 0, max: 0.5, step: 0.01, label: 'krzywizna CRT' },
    glow: { value: 0.8, min: 0, max: 2, step: 0.05, label: 'poświata' },
    click: { value: 'glitch' as ClickMode, options: CLICK_OPTIONS, label: 'efekt kliknięcia' },
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wakeRef = useRef<(() => void) | null>(null)
  const [unsupported, setUnsupported] = useState(false)

  const settings: Settings = {
    scale: Math.max(0.05, c.scale),
    gridX: 2 * 15,
    gridY: 1 * 15,
    digitSize: 1.5,
    timeScale: 0.3,
    pause: paused,
    still: reducedMotion,
    scanlineIntensity: 0.3,
    glitchAmount: c.glitch,
    flickerAmount: 1,
    noiseAmp: 1,
    chromaticAberration: stage ? 0.6 : 0,
    dither: 0,
    curvature: c.curvature,
    tint: hexToRgb01(accent),
    mouseReact: true,
    mouseStrength: 0.2,
    pageLoadAnimation: true,
    brightness: 1,
    glyphs: GLYPHS[c.glyphs] ?? 0,
    glow: clamp(c.glow, 0, 3),
    persistence: 0.5,
    scramble: 0.5,
    mouseGlow: 0.6,
    vignette: 0.25,
    clickEffect: CLICKS[c.click] ?? 0,
    clickSeconds: CLICK_SECONDS[c.click] ?? 1,
    // the main pass samples 9 cells × 3 channels per pixel → keep the backing store modest
    dpr: Math.min(dprFor(quality), stage ? 1.5 : 1),
  }
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  })

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const gl = canvas?.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false })
    if (!container || !canvas || !gl) {
      setUnsupported(true)
      return undefined
    }
    const cellShader = link(gl, CELL_FRAGMENT)
    const mainShader = link(gl, MAIN_FRAGMENT)
    if (!cellShader || !mainShader) {
      setUnsupported(true)
      return undefined
    }
    const cu = cellShader.uniforms
    const mu = mainShader.uniforms
    // software GL: the 27-tap main pass would drop to ~1 fps → half resolution, no CA / bloom taps
    const software = isSoftwareGL(gl)
    const vao = gl.createVertexArray()

    const makeTexture = () => {
      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      return texture
    }
    const targets = [0, 1].map(() => {
      const rings = makeTexture()
      const extra = makeTexture()
      const framebuffer = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rings, 0)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, extra, 0)
      return { rings, extra, framebuffer }
    })
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    const view = { width: 1, height: 1, ratio: 1, columns: 1 }
    const cells = { x: 0, y: 0, w: 1, h: 1, key: '' }
    const pointer = { x: 0.5, y: 0.5, inside: false }
    const mouse = { x: 0.5, y: 0.5 }
    const clicks = new Float32Array(MAX_CLICKS * 4)
    let clickIndex = 0
    let clock = 0
    let hover = 0
    let current = 0
    let fresh = true
    let iTime = Math.random() * 100 * settingsRef.current.timeScale
    let introClock = settingsRef.current.pageLoadAnimation && !settingsRef.current.still ? 0 : 1
    let raf = 0
    let last = 0
    let quiet = 0
    let alive = true

    const layoutCells = (s: Settings) => {
      const reach = 1 + Math.max(0, s.curvature) * 2
      const uvMin = 0.5 - 0.5 * reach
      const uvMax = 0.5 + 0.5 * reach
      const margin = 0.06 * Math.max(1, Math.abs(s.glitchAmount)) * Math.max(1, Math.abs(s.flickerAmount)) + 0.2
      const gridX = s.gridX * view.columns
      const x0 = Math.floor((uvMin * s.scale - margin) * gridX) - 2
      const x1 = Math.floor((uvMax * s.scale + margin) * gridX) + 2
      const y0 = Math.floor((uvMin * s.scale - margin) * s.gridY) - 2
      const y1 = Math.floor((uvMax * s.scale + margin) * s.gridY) + 2
      const key = `${x0}:${x1}:${y0}:${y1}`
      if (key === cells.key) return
      cells.key = key
      cells.x = x0
      cells.y = y0
      cells.w = Math.max(1, Math.min(4096, x1 - x0 + 1))
      cells.h = Math.max(1, Math.min(4096, y1 - y0 + 1))
      for (const target of targets) {
        for (const texture of [target.rings, target.extra]) {
          gl.bindTexture(gl.TEXTURE_2D, texture)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cells.w, cells.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        }
      }
      fresh = true
    }

    const stepCells = (s: Settings, decay: number) => {
      const source = targets[current]
      const target = targets[1 - current]
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])
      gl.viewport(0, 0, cells.w, cells.h)
      gl.disable(gl.BLEND)
      gl.useProgram(cellShader.program)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, source.rings)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, source.extra)
      gl.uniform1i(cu.uPrev0, 0)
      gl.uniform1i(cu.uPrev1, 1)
      gl.uniform1f(cu.iTime, iTime)
      gl.uniform2f(cu.uGridMul, (s.gridX * view.columns) / 15, s.gridY / 15)
      gl.uniform1f(cu.uNoiseAmp, s.noiseAmp)
      gl.uniform1f(cu.uScale, s.scale)
      gl.uniform2f(cu.uMouse, mouse.x, mouse.y)
      gl.uniform1f(cu.uMouseStrength, s.mouseStrength)
      gl.uniform1f(cu.uUseMouse, s.mouseReact ? 1 : 0)
      gl.uniform1f(cu.uPageLoadProgress, introClock)
      gl.uniform1f(cu.uUsePageLoadAnimation, s.pageLoadAnimation ? 1 : 0)
      gl.uniform2i(cu.uOrigin, cells.x, cells.y)
      gl.uniform1f(cu.uDecay, decay)
      gl.uniform1f(cu.uFresh, fresh ? 1 : 0)
      gl.uniform1f(cu.uHover, hover)
      gl.bindVertexArray(vao)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      current = 1 - current
      fresh = false
    }

    const draw = () => {
      const s = settingsRef.current
      const source = targets[current]
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(mainShader.program)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, source.rings)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, source.extra)
      gl.uniform1i(mu.uRings0, 0)
      gl.uniform1i(mu.uRings1, 1)
      gl.uniform1f(mu.iTime, iTime)
      gl.uniform3f(mu.iResolution, canvas.width, canvas.height, canvas.width / canvas.height)
      gl.uniform1f(mu.uScale, s.scale)
      gl.uniform2f(mu.uGridMul, (s.gridX * view.columns) / 15, s.gridY / 15)
      gl.uniform1f(mu.uDigitSize, s.digitSize)
      gl.uniform1f(mu.uScanlineIntensity, s.scanlineIntensity)
      gl.uniform1f(mu.uGlitchAmount, s.still ? 0 : s.glitchAmount)
      gl.uniform1f(mu.uFlickerAmount, s.still ? 0 : s.flickerAmount)
      gl.uniform1f(mu.uChromaticAberration, software ? 0 : s.chromaticAberration)
      gl.uniform1f(mu.uDither, s.dither)
      gl.uniform1f(mu.uCurvature, s.curvature)
      gl.uniform3fv(mu.uTint, s.tint)
      gl.uniform1f(mu.uBrightness, s.brightness)
      gl.uniform1f(mu.uLightMode, 0)
      gl.uniform2i(mu.uOrigin, cells.x, cells.y)
      gl.uniform2i(mu.uCellCount, cells.w, cells.h)
      gl.uniform1i(mu.uGlyphs, s.glyphs)
      gl.uniform1f(mu.uGlow, software ? 0 : s.glow)
      gl.uniform1f(mu.uScramble, s.scramble)
      gl.uniform1f(mu.uMouseGlow, s.mouseGlow)
      gl.uniform1f(mu.uVignette, s.vignette)
      gl.uniform4fv(mu.uClicks, clicks)
      gl.uniform1i(mu.uClickMode, s.clickEffect)
      gl.uniform1f(mu.uClickSeconds, s.clickSeconds)
      gl.uniform1f(mu.uClock, clock)
      gl.bindVertexArray(vao)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindVertexArray(null)
    }

    const resize = () => {
      const s = settingsRef.current
      view.width = Math.max(1, container.clientWidth)
      view.height = Math.max(1, container.clientHeight)
      view.ratio = software ? Math.min(s.dpr, 0.5) : s.dpr
      view.columns = Math.min(1, view.width / view.height / 1.5)
      canvas.width = Math.max(1, Math.round(view.width * view.ratio))
      canvas.height = Math.max(1, Math.round(view.height * view.ratio))
      layoutCells(s)
      stepCells(s, 0)
      draw()
      wake()
    }

    const frame = (now: number) => {
      raf = 0
      const s = settingsRef.current
      if (!alive || s.pause) return
      const dt = last ? clamp((now - last) / 1000, 0.001, 1 / 20) : 1 / 60
      last = now
      clock += dt
      if (!s.still) iTime += dt * s.timeScale
      const targetX = pointer.inside ? pointer.x : 0.5
      const targetY = pointer.inside ? pointer.y : 0.5
      const follow = 1 - Math.exp(-dt / (pointer.inside ? 0.19988 : 0.6))
      mouse.x += (targetX - mouse.x) * follow
      mouse.y += (targetY - mouse.y) * follow
      hover += ((pointer.inside ? 1 : 0) - hover) * (1 - Math.exp(-dt / 0.35))
      for (let k = 0; k < MAX_CLICKS; k++) {
        if (clicks[k * 4 + 3] > 0 && clock - clicks[k * 4 + 2] > s.clickSeconds) clicks[k * 4 + 3] = 0
      }
      layoutCells(s)
      const decay = s.persistence > 0 ? Math.exp(-dt / (0.08 + s.persistence * 1.4)) : 0
      stepCells(s, decay)
      draw()
      if (introClock < 1) introClock = Math.min(1, introClock + dt / INTRO_SECONDS)
      let busy = !s.still || introClock < 1
      busy = busy || Math.abs(targetX - mouse.x) + Math.abs(targetY - mouse.y) > 0.0001
      busy = busy || Math.abs((pointer.inside ? 1 : 0) - hover) > 0.001
      for (let k = 0; k < MAX_CLICKS; k++) busy = busy || clicks[k * 4 + 3] > 0
      quiet = busy ? 0 : quiet + dt
      if (quiet < 2.5) raf = requestAnimationFrame(frame)
    }

    function wake() {
      quiet = 0
      if (!raf && alive && !settingsRef.current.pause) {
        last = 0
        raf = requestAnimationFrame(frame)
      }
    }

    const locatePointer = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      const x = (event.clientX - rect.left) / Math.max(rect.width, 1)
      const y = 1 - (event.clientY - rect.top) / Math.max(rect.height, 1)
      return { x, y, inside: x >= 0 && x <= 1 && y >= 0 && y <= 1 }
    }

    const onPointerMove = (event: PointerEvent) => {
      const { x, y, inside } = locatePointer(event)
      const was = pointer.inside
      pointer.inside = inside
      if (inside) {
        pointer.x = x
        pointer.y = y
      }
      if (inside || was) wake()
    }

    const onPointerDown = (event: PointerEvent) => {
      const s = settingsRef.current
      const { x, y, inside } = locatePointer(event)
      if (!inside || s.still || !s.clickEffect) return
      const o = clickIndex * 4
      clicks[o] = x
      clicks[o + 1] = y
      clicks[o + 2] = clock
      clicks[o + 3] = 1
      clickIndex = (clickIndex + 1) % MAX_CLICKS
      wake()
    }

    const onPointerLeave = () => {
      pointer.inside = false
      wake()
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    document.documentElement.addEventListener('pointerleave', onPointerLeave)
    resize()
    wakeRef.current = () => {
      if ((software ? Math.min(settingsRef.current.dpr, 0.5) : settingsRef.current.dpr) !== view.ratio) resize()
      else if (!raf) draw()
      wake()
    }

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      wakeRef.current = null
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      for (const target of targets) {
        gl.deleteTexture(target.rings)
        gl.deleteTexture(target.extra)
        gl.deleteFramebuffer(target.framebuffer)
      }
      gl.deleteVertexArray(vao)
      gl.deleteProgram(cellShader.program)
      gl.deleteProgram(mainShader.program)
      // real unmount only: StrictMode's simulated unmount keeps the canvas (and its context) alive
      if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  useEffect(() => {
    wakeRef.current?.()
  })

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" style={{ background: deepBg(hue, 2) }}>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden="true" />
      {unsupported && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="jx-label text-jx-danger">Wymagany WebGL2</span>
        </div>
      )}
      <BgHud
        code="BG/REACT BITS · FAULTY TERMINAL"
        stage={stage}
        paused={paused}
        hint="Kursor rozgrzewa luminofor · kliknięcie wywołuje zakłócenie"
        stats={[{ label: 'Skala', value: c.scale.toFixed(2) }]}
        vignette={0.35}
      />
    </div>
  )
}
