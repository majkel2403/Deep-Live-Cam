/**
 * Static waveform plot (min/max per pixel column) on a fixed time axis, so lengths are
 * comparable between bleeps; the 150 ms line marks the sound-policy budget.
 * Redraws only on data / size / colour change.
 */
import { useEffect, useRef } from 'react'
import type { Wave } from './wave'

export const POLICY_MS = 150

export function WaveCanvas({ wave, windowMs, accent, className = '' }: { wave: Wave | null; windowMs: number; accent: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      const g = canvas.getContext('2d')
      if (!g) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const mid = h / 2
      const xOf = (ms: number) => (ms / windowMs) * w

      // 50 ms grid
      g.strokeStyle = 'rgba(255,255,255,0.06)'
      g.lineWidth = 1
      g.beginPath()
      for (let ms = 50; ms < windowMs; ms += 50) {
        const x = Math.round(xOf(ms)) + 0.5
        g.moveTo(x, 0)
        g.lineTo(x, h)
      }
      g.moveTo(0, Math.round(mid) + 0.5)
      g.lineTo(w, Math.round(mid) + 0.5)
      g.stroke()

      // policy marker
      if (POLICY_MS < windowMs) {
        const x = Math.round(xOf(POLICY_MS)) + 0.5
        g.save()
        g.strokeStyle = 'rgba(255,176,0,0.55)'
        g.setLineDash([3, 3])
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x, h)
        g.stroke()
        g.restore()
      }

      if (!wave) return
      const { samples, sampleRate, peak } = wave
      const norm = peak > 0 ? (mid - 3) / peak : 0
      const perPx = (sampleRate * windowMs) / 1000 / w
      const cols = Math.min(w, Math.ceil(samples.length / perPx))
      g.beginPath()
      const top: number[] = []
      const bot: number[] = []
      for (let x = 0; x < cols; x++) {
        const a = Math.floor(x * perPx)
        const b = Math.min(samples.length, Math.floor((x + 1) * perPx))
        let lo = 0
        let hi = 0
        for (let i = a; i < b; i++) {
          const v = samples[i]
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
        top.push(mid - hi * norm)
        bot.push(mid - lo * norm)
      }
      g.moveTo(0, mid)
      top.forEach((y, x) => g.lineTo(x, y))
      for (let x = bot.length - 1; x >= 0; x--) g.lineTo(x, bot[x])
      g.closePath()
      const grad = g.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, `${accent}cc`)
      grad.addColorStop(0.5, `${accent}55`)
      grad.addColorStop(1, `${accent}cc`)
      g.fillStyle = grad
      g.fill()
      g.strokeStyle = accent
      g.lineWidth = 0.75
      g.stroke()
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [wave, windowMs, accent])

  return <canvas ref={ref} className={`block w-full h-full ${className}`} aria-hidden="true" />
}
