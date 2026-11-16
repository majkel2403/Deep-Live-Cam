/**
 * Live output monitor: oscilloscope + log-frequency spectrum from the shared AnalyserNode that
 * both the synth and howler are routed through (src/lib/sound/engine.ts). Real signal only.
 * The rAF loop runs only while something is sounding (plus a short tail) and the tab is visible.
 */
import { useEffect, useRef, useState } from 'react'
import { getAnalyser, onBleep, type BleepEvent } from '@/lib/sound'
import { BLEEP_INFO, BACKEND_INFO } from './labels'
import { wakers } from './scopeBus'


const TAIL_MS = 1400

export function LiveScope({ accent, muted, reduced }: { accent: string; muted: boolean; reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [last, setLast] = useState<BleepEvent | null>(null)
  const [hasAnalyser, setHasAnalyser] = useState(() => !!getAnalyser())

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let raf = 0
    let until = 0
    let td: Float32Array<ArrayBuffer> | null = null
    let fd: Uint8Array<ArrayBuffer> | null = null
    // persistence: strongest frame of the latest sound + decaying spectrum peaks
    let hold: Float32Array | null = null
    let holdEnergy = 0
    const BANDS = 64
    const bandLive = new Float32Array(BANDS)
    const bandHold = new Float32Array(BANDS)

    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
    }

    const trace = (g: CanvasRenderingContext2D, data: Float32Array, w: number, mid: number) => {
      const n = data.length
      g.beginPath()
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * w
        const y = mid - Math.max(-1, Math.min(1, data[i] * 4)) * (mid - 4)
        if (i) g.lineTo(x, y)
        else g.moveTo(x, y)
      }
      g.stroke()
    }

    const draw = (live: boolean) => {
      const g = canvas.getContext('2d')
      if (!g) return
      const dpr = canvas.width / Math.max(1, canvas.clientWidth)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const scopeH = h * 0.62
      const mid = scopeH / 2

      // graticule
      g.strokeStyle = 'rgba(255,255,255,0.055)'
      g.lineWidth = 1
      g.beginPath()
      for (let i = 1; i < 10; i++) {
        const x = Math.round((w * i) / 10) + 0.5
        g.moveTo(x, 0)
        g.lineTo(x, scopeH)
      }
      for (let i = 1; i < 4; i++) {
        const y = Math.round((scopeH * i) / 4) + 0.5
        g.moveTo(0, y)
        g.lineTo(w, y)
      }
      g.moveTo(0, scopeH + 0.5)
      g.lineTo(w, scopeH + 0.5)
      g.stroke()

      const an = getAnalyser()
      let fresh = false
      if (an && live) {
        if (!td || td.length !== an.fftSize) td = new Float32Array(an.fftSize)
        if (!fd || fd.length !== an.frequencyBinCount) fd = new Uint8Array(an.frequencyBinCount)
        an.getFloatTimeDomainData(td)
        an.getByteFrequencyData(fd)
        fresh = true
        let e = 0
        for (let i = 0; i < td.length; i++) e += td[i] * td[i]
        if (e > holdEnergy && e > 1e-6) {
          holdEnergy = e
          hold = Float32Array.from(td)
        }
        const nyq = an.context.sampleRate / 2
        const lo = Math.log(40)
        const hi = Math.log(nyq)
        for (let b = 0; b < BANDS; b++) {
          const f0 = Math.exp(lo + ((hi - lo) * b) / BANDS)
          const f1 = Math.exp(lo + ((hi - lo) * (b + 1)) / BANDS)
          const i0 = Math.max(0, Math.floor((f0 / nyq) * fd.length))
          const i1 = Math.min(fd.length - 1, Math.max(i0, Math.ceil((f1 / nyq) * fd.length)))
          let m = 0
          for (let i = i0; i <= i1; i++) m = Math.max(m, fd[i])
          bandLive[b] = m / 255
          bandHold[b] = Math.max(bandHold[b] * 0.992, bandLive[b])
        }
      }

      // oscilloscope (×4 gain: UI bleeps peak around −14 dBFS)
      g.save()
      if (hold) {
        g.strokeStyle = `${accent}66`
        g.lineWidth = 1
        trace(g, hold, w, mid)
      }
      g.strokeStyle = accent
      g.lineWidth = 1.5
      g.shadowColor = accent
      g.shadowBlur = fresh ? 8 : 0
      if (td && fresh) trace(g, td, w, mid)
      else if (!hold) {
        g.beginPath()
        g.moveTo(0, mid)
        g.lineTo(w, mid)
        g.stroke()
      }
      g.restore()

      // spectrum: 64 log-spaced bands, 40 Hz … Nyquist; live bars + decaying peak caps
      const top = scopeH + 6
      const bh = h - top - 2
      const bw = w / BANDS
      g.fillStyle = `${accent}22`
      g.fillRect(0, h - 2, w, 1)
      for (let b = 0; b < BANDS; b++) {
        const x = b * bw + 1
        const bwid = Math.max(1, bw - 2)
        const v = fresh ? bandLive[b] * bh : 0
        if (v >= 1) {
          g.fillStyle = `${accent}${bandLive[b] > 0.78 ? 'ff' : bandLive[b] > 0.47 ? 'cc' : '88'}`
          g.fillRect(x, top + bh - v, bwid, v)
        }
        const p = bandHold[b] * bh
        if (p >= 2) {
          g.fillStyle = `${accent}aa`
          g.fillRect(x, top + bh - p, bwid, 1.5)
        }
      }
    }

    const loop = () => {
      draw(true)
      // after the tail the last real frame stays on screen (frozen) until the next sound
      if (performance.now() < until && !document.hidden) raf = requestAnimationFrame(loop)
      else raf = 0
    }
    const wake = () => {
      setHasAnalyser(!!getAnalyser())
      until = performance.now() + TAIL_MS
      if (!raf && !reduced) raf = requestAnimationFrame(loop)
      else if (reduced) {
        // reduced motion: a single snapshot shortly after the sound starts instead of an animation
        window.setTimeout(() => draw(true), 60)
      }
    }

    size()
    draw(false)
    // the analyser appears once any backend touches audio (howler adoption or first synth note)
    const probe = window.setInterval(() => {
      if (!getAnalyser()) return
      setHasAnalyser(true)
      window.clearInterval(probe)
    }, 1000)
    const ro = new ResizeObserver(() => {
      size()
      draw(false)
    })
    ro.observe(canvas)
    // every new sound captures a fresh persistence trace
    const wakeFresh = () => {
      holdEnergy = 0
      wake()
    }
    wakers.add(wakeFresh)
    const off = onBleep((e) => {
      setLast(e)
      wakeFresh()
    })
    return () => {
      window.clearInterval(probe)
      cancelAnimationFrame(raf)
      ro.disconnect()
      wakers.delete(wakeFresh)
      off()
    }
  }, [accent, reduced])

  return (
    <div className="relative h-full min-h-[140px]">
      <canvas ref={ref} className="absolute inset-0 w-full h-full" role="img" aria-label="Oscyloskop i widmo sygnału wyjściowego" />
      <div className="absolute left-2 top-1.5 flex items-center gap-2 pointer-events-none">
        <span className="jx-label text-[0.6rem]">
          Oscyloskop ×4<span className="hidden sm:inline"> · ślad: najsilniejsza ramka</span>
        </span>
      </div>
      <div className="absolute left-2 bottom-1 pointer-events-none jx-label text-[0.58rem]">Widmo · skala log. od 40 Hz{hasAnalyser ? '' : ' · analizator nieaktywny'}</div>
      <div className="absolute right-2 top-1.5 text-right pointer-events-none" aria-live="polite">
        {muted ? (
          <span className="jx-label text-[0.62rem] text-jx-warn">Dźwięk wyciszony</span>
        ) : last ? (
          <span className="jx-num text-[0.68rem] text-jx-text">
            {BLEEP_INFO[last.name].label} <span className="text-jx-dim">·</span> <span className="text-jx-accent">{last.backend === 'external' ? 'zewn.' : BACKEND_INFO[last.backend].short}</span>
          </span>
        ) : (
          <span className="jx-label text-[0.6rem]">Oczekiwanie na sygnał — zagraj dowolny bleep</span>
        )}
      </div>
    </div>
  )
}
