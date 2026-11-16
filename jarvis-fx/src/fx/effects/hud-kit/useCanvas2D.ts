import { useEffect, useRef } from 'react'
import type { Quality } from '@/lib/store'

export interface Frame2D {
  ctx: CanvasRenderingContext2D
  /** CSS pixel size (the context is already scaled by DPR) */
  w: number
  h: number
  /** effect clock in seconds – only advances while not paused */
  t: number
  /** seconds since the previous frame (clamped) */
  dt: number
  dpr: number
}

export interface Canvas2DOptions {
  paused: boolean
  quality: Quality
  /** cap the frame rate (e.g. 30 for gallery cards) */
  maxFps?: number
  /** multiplies dt (0 freezes time but keeps redrawing, e.g. for reduced motion) */
  timeScale?: number
}

const DPR_CAP: Record<Quality, number> = { low: 1, med: 1.5, high: 2 }

/**
 * Canvas 2D render loop shared by the HUD effects: DPR-aware sizing via ResizeObserver,
 * a pausable rAF loop with its own clock and an optional FPS cap (no frames are scheduled while paused). The latest `draw`
 * closure is always used, so callers can read props / Leva values directly.
 * Everything (rAF, observer) is torn down on unmount.
 */
export function useCanvas2D(draw: (f: Frame2D) => void, { paused, quality, maxFps = 60, timeScale = 1 }: Canvas2DOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  const optsRef = useRef({ paused, maxFps, timeScale })
  const clock = useRef(0)
  const redraw = useRef<() => void>(() => {})

  useEffect(() => {
    drawRef.current = draw
  })
  const start = useRef<() => void>(() => {})
  useEffect(() => {
    optsRef.current = { paused, maxFps, timeScale }
    // paused: the loop stops by itself; repaint once so parameter changes are still visible.
    // resumed: restart the loop.
    if (paused) redraw.current()
    else start.current()
  }, [paused, maxFps, timeScale])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP[quality])
    let w = 0
    let h = 0
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      w = Math.max(1, r.width)
      h = Math.max(1, r.height)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    resize()
    const paint = (dt: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawRef.current({ ctx, w, h, t: clock.current, dt, dpr })
    }
    redraw.current = () => paint(0)
    const ro = new ResizeObserver(() => {
      resize()
      paint(0)
    })
    ro.observe(canvas)

    let raf = 0
    let last = performance.now()
    let acc = 0
    const loop = (now: number) => {
      const o = optsRef.current
      if (o.paused) {
        // stop scheduling frames entirely while paused (restarted via start.current)
        raf = 0
        return
      }
      raf = requestAnimationFrame(loop)
      const real = Math.min(0.1, (now - last) / 1000)
      last = now
      acc += real
      const minStep = 1 / o.maxFps
      if (acc + 0.002 < minStep) return
      const dt = Math.min(0.1, acc) * o.timeScale
      acc = 0
      clock.current += dt
      paint(dt)
    }
    start.current = () => {
      if (raf) return
      last = performance.now()
      acc = 0
      raf = requestAnimationFrame(loop)
    }
    paint(0)
    if (!optsRef.current.paused) start.current()
    return () => {
      cancelAnimationFrame(raf)
      raf = 0
      ro.disconnect()
      redraw.current = () => {}
      start.current = () => {}
    }
  }, [quality])

  return canvasRef
}
