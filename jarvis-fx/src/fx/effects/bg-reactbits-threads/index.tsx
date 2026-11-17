/*
 * bg-reactbits-threads – ported/adapted from React Bits "Threads" by David Haz.
 * Source: https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Backgrounds/Threads/Threads.tsx
 * License: MIT + Commons Clause – https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md
 *   Commons Clause: the software may not be sold, i.e. offered for a fee as a product or service whose value
 *   derives substantially from it. Use inside this free application is permitted.
 * Adaptations: FxProps (accent colours, quality → DPR cap, reducedMotion/paused from the app instead of
 * matchMedia), Leva controls, lighter card mode, HUD overlay, WebGL2-missing fallback, context release.
 */
import { useEffect, useRef, useState } from 'react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { BgHud } from '../bg-kit/BgHud'
import { deepBg, dprFor, hexToRgb01 } from '../bg-kit/color'
import { LINE_FRAGMENT, LINE_VERTEX, SCREEN_FRAGMENT, SCREEN_VERTEX, link, locate } from './shaders'

type Settings = {
  color: [number, number, number]
  accent: [number, number, number]
  amplitude: number
  distance: number
  lineCount: number
  thickness: number
  softness: number
  speed: number
  waves: number
  split: number
  fray: number
  angle: number
  seed: number
  parting: number
  taper: number
  brightness: number
  fade: number
  opacity: number
  paused: boolean
  still: boolean
  maxDpr: number
}

const MAX_RENDER_DIM = 1920
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export default function Threads({ accent, accent2, hue, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    amplitude: { value: 1.7, min: 0, max: 4, step: 0.05, label: 'amplituda' },
    lineCount: { value: 90, min: 10, max: 240, step: 1, label: 'liczba nici' },
    speed: { value: 0.6, min: 0, max: 2.5, step: 0.05, label: 'prędkość' },
    angle: { value: 18, min: -90, max: 90, step: 1, label: 'kąt (°)' },
    parting: { value: 0.6, min: 0, max: 1, step: 0.05, label: 'rozchylanie kursorem' },
    distance: { value: 0.4, min: 0, max: 1, step: 0.01, label: 'rozstaw' },
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wakeRef = useRef<(() => void) | null>(null)
  const [unsupported, setUnsupported] = useState(false)

  const settings: Settings = {
    color: hexToRgb01(accent),
    accent: hexToRgb01(accent2),
    amplitude: c.amplitude,
    distance: c.distance,
    lineCount: clamp(Math.round(stage ? c.lineCount : c.lineCount * 0.5), 1, 400),
    thickness: 0.6,
    softness: 1.3,
    speed: c.speed,
    waves: 1.05,
    split: 0.04,
    fray: 0.5,
    angle: c.angle,
    seed: 0,
    parting: c.parting,
    taper: 0.85,
    brightness: 1.4,
    fade: 0.08,
    opacity: 1,
    paused,
    still: reducedMotion,
    maxDpr: dprFor(quality),
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

    const lineProgram = link(gl, LINE_VERTEX, LINE_FRAGMENT)
    const screenProgram = link(gl, SCREEN_VERTEX, SCREEN_FRAGMENT)
    if (!lineProgram || !screenProgram) {
      setUnsupported(true)
      return undefined
    }

    const lineUniforms = locate(gl, lineProgram, [
      'uTime',
      'uResolution',
      'uFrame',
      'uAmplitude',
      'uDistance',
      'uMouse',
      'uCount',
      'uThickness',
      'uSoftness',
      'uWaves',
      'uSplit',
      'uFray',
      'uSeed',
      'uTurn',
      'uPart',
      'uTaper',
      'uColor',
      'uAccent',
    ])
    const screenUniforms = locate(gl, screenProgram, ['uLines', 'uResolution', 'uFade', 'uOpacity', 'uCurve'])

    const lineVao = gl.createVertexArray()
    const lineBuffer = gl.createBuffer()
    gl.bindVertexArray(lineVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer)
    const pointLocation = gl.getAttribLocation(lineProgram, 'aPoint')
    gl.enableVertexAttribArray(pointLocation)
    gl.vertexAttribPointer(pointLocation, 2, gl.FLOAT, false, 0, 0)

    const screenVao = gl.createVertexArray()
    const screenBuffer = gl.createBuffer()
    gl.bindVertexArray(screenVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, screenBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const positionLocation = gl.getAttribLocation(screenProgram, 'aPosition')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    const target = gl.createTexture()
    const framebuffer = gl.createFramebuffer()
    gl.bindTexture(gl.TEXTURE_2D, target)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    const state = {
      time: 0,
      width: 1,
      height: 1,
      segments: 0,
      mouse: [0.5, 0.5],
      targetMouse: [0.5, 0.5],
      pointer: [0, 0],
      targetPointer: [0, 0],
      presence: 0,
      inside: false,
    }
    let raf = 0
    let last = 0
    let alive = true
    let appliedDpr = 0

    const buildStrip = (segments: number) => {
      if (segments === state.segments) return
      state.segments = segments
      const points = new Float32Array((segments + 1) * 4)
      for (let i = 0; i <= segments; i++) {
        const u = i / segments
        points.set([u, -1, u, 1], i * 4)
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW)
    }

    const resize = () => {
      const width = Math.max(1, container.clientWidth)
      const height = Math.max(1, container.clientHeight)
      const baseDpr = settingsRef.current.maxDpr
      appliedDpr = baseDpr
      const longest = Math.max(width, height) * baseDpr
      const dpr = longest > MAX_RENDER_DIM ? (baseDpr * MAX_RENDER_DIM) / longest : baseDpr
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      state.width = width
      state.height = height
      gl.bindTexture(gl.TEXTURE_2D, target)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      buildStrip(clamp(Math.round(width / 3), 96, 640))
      render()
    }

    const render = () => {
      const s = settingsRef.current
      const w = canvas.width
      const h = canvas.height
      const radians = (s.angle * Math.PI) / 180
      const cos = Math.cos(radians)
      const sin = Math.sin(radians)
      const length = Math.abs(w * cos) + Math.abs(h * sin)
      const across = Math.abs(w * sin) + Math.abs(h * cos)
      const scale = w / state.width
      const strength = s.parting * state.presence * 2
      const px = state.pointer[0] * scale
      const py = state.pointer[1] * scale
      const local = [px * cos + py * sin, -px * sin + py * cos]

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.viewport(0, 0, w, h)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.useProgram(lineProgram)
      gl.uniform1f(lineUniforms.uTime, state.time)
      gl.uniform2f(lineUniforms.uResolution, w, h)
      gl.uniform2f(lineUniforms.uFrame, length, across)
      gl.uniform1f(lineUniforms.uAmplitude, s.amplitude)
      gl.uniform1f(lineUniforms.uDistance, s.distance)
      gl.uniform2f(lineUniforms.uMouse, state.mouse[0], state.mouse[1])
      gl.uniform1f(lineUniforms.uCount, s.lineCount)
      gl.uniform1f(lineUniforms.uThickness, s.thickness)
      gl.uniform1f(lineUniforms.uSoftness, s.softness)
      gl.uniform1f(lineUniforms.uWaves, s.waves)
      gl.uniform1f(lineUniforms.uSplit, s.split)
      gl.uniform1f(lineUniforms.uFray, s.fray)
      gl.uniform1f(lineUniforms.uSeed, s.seed * 13.37)
      gl.uniform2f(lineUniforms.uTurn, cos, sin)
      gl.uniform4f(lineUniforms.uPart, local[0], local[1], strength, Math.min(w, h) * 0.16)
      gl.uniform1f(lineUniforms.uTaper, s.taper)
      gl.uniform3f(lineUniforms.uColor, s.color[0], s.color[1], s.color[2])
      gl.uniform3f(lineUniforms.uAccent, s.accent[0], s.accent[1], s.accent[2])
      gl.bindVertexArray(lineVao)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (state.segments + 1) * 2, s.lineCount)

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, w, h)
      gl.disable(gl.BLEND)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(screenProgram)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, target)
      gl.uniform1i(screenUniforms.uLines, 0)
      gl.uniform2f(screenUniforms.uResolution, w, h)
      gl.uniform1f(screenUniforms.uFade, s.fade)
      gl.uniform1f(screenUniforms.uOpacity, s.opacity)
      gl.uniform1f(screenUniforms.uCurve, 2 / s.brightness)
      gl.bindVertexArray(screenVao)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindVertexArray(null)
    }

    const frame = (now: number) => {
      raf = 0
      const s = settingsRef.current
      if (!alive || s.paused) return
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      const moving = !s.still
      if (moving) state.time += dt * s.speed
      const follow = 1 - Math.exp(-dt * 3)
      state.mouse[0] += (state.targetMouse[0] - state.mouse[0]) * follow
      state.mouse[1] += (state.targetMouse[1] - state.mouse[1]) * follow
      const glide = 1 - Math.exp(-dt * 10)
      state.pointer[0] += (state.targetPointer[0] - state.pointer[0]) * glide
      state.pointer[1] += (state.targetPointer[1] - state.pointer[1]) * glide
      state.presence += ((state.inside && s.parting > 0 ? 1 : 0) - state.presence) * (1 - Math.exp(-dt * 4))
      render()
      const settling =
        Math.abs(state.targetMouse[0] - state.mouse[0]) > 0.0005 ||
        Math.abs(state.targetMouse[1] - state.mouse[1]) > 0.0005 ||
        Math.abs(state.targetPointer[0] - state.pointer[0]) > 0.05 ||
        Math.abs(state.targetPointer[1] - state.pointer[1]) > 0.05 ||
        Math.abs((state.inside && s.parting > 0 ? 1 : 0) - state.presence) > 0.002
      if (moving || settling) raf = requestAnimationFrame(frame)
      else last = 0
    }

    const wake = () => {
      if (!raf && alive && !settingsRef.current.paused) {
        last = 0
        raf = requestAnimationFrame(frame)
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      const x = (event.clientX - rect.left) / Math.max(1, rect.width)
      const y = (event.clientY - rect.top) / Math.max(1, rect.height)
      const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1
      if (inside) {
        state.targetMouse = [x, 1 - y]
        state.targetPointer = [event.clientX - rect.left - rect.width / 2, rect.height / 2 - (event.clientY - rect.top)]
        if (!state.inside && state.presence < 0.01) state.pointer = [...state.targetPointer]
      } else if (state.inside) {
        state.targetMouse = [0.5, 0.5]
      }
      state.inside = inside
      wake()
    }

    const onPointerLeave = () => {
      state.inside = false
      state.targetMouse = [0.5, 0.5]
      wake()
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onPointerLeave)
    resize()

    // settings changed (Leva, accent, pause): repaint once and resume the loop if needed
    wakeRef.current = () => {
      if (settingsRef.current.maxDpr !== appliedDpr) resize()
      else if (!raf) render()
      wake()
    }

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      wakeRef.current = null
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      gl.deleteFramebuffer(framebuffer)
      gl.deleteTexture(target)
      gl.deleteBuffer(lineBuffer)
      gl.deleteBuffer(screenBuffer)
      gl.deleteVertexArray(lineVao)
      gl.deleteVertexArray(screenVao)
      gl.deleteProgram(lineProgram)
      gl.deleteProgram(screenProgram)
      // real unmount only: StrictMode's simulated unmount keeps the canvas (and its context) alive
      if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  useEffect(() => {
    wakeRef.current?.()
  })

  const bg = deepBg(hue, 2.6)
  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 55%, ${deepBg(hue, 6)}, ${bg} 75%)` }}>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden="true" />
      {unsupported && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="jx-label text-jx-danger">Wymagany WebGL2</span>
        </div>
      )}
      <BgHud
        code="BG/REACT BITS · THREADS"
        stage={stage}
        paused={paused}
        hint="Najedź kursorem — nici rozchylają się wokół wskaźnika"
        stats={[{ label: 'Nici', value: settings.lineCount }]}
      />
    </div>
  )
}
