import { useMemo, useRef, useState, useEffect } from 'react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { DemoBadge, HudChrome } from '../hud-kit/HudChrome'
import { hexA, SEM } from '../hud-kit/color'
import { useCanvas2D, type Frame2D } from '../hud-kit/useCanvas2D'
import { LBL } from '../hud-kit/ui'
import { buildBust } from './mesh'

/**
 * Original "image scan" loader: a horizontal scan beam sweeps down and reveals a procedural
 * wireframe bust. Three clipped passes (revealed / hot band / ghost) keep it one cheap canvas.
 * Progress is simulated (it is a loader demo) and labelled as such.
 */

const STAGES: [number, string][] = [
  [0, 'Kalibracja czujników'],
  [0.18, 'Mapowanie siatki'],
  [0.42, 'Analiza topologii'],
  [0.68, 'Rekonstrukcja modelu'],
  [0.9, 'Weryfikacja spójności'],
]

export default function ScanBar({ accent, accent2, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    duration: { value: 5.5, min: 2, max: 14, step: 0.5, label: 'czas skanu (s)' },
    density: { value: 1, min: 0.5, max: 1.8, step: 0.1, label: 'gęstość siatki' },
    turn: { value: 0.35, min: 0, max: 1.5, step: 0.05, label: 'obrót' },
    ghost: { value: true, label: 'kontur przed skanem' },
  })
  const density = stage ? c.density : Math.min(0.7, c.density)
  const mesh = useMemo(() => buildBust(density), [density])
  const progRef = useRef(0)
  const [ui, setUi] = useState({ p: 0, msg: STAGES[0][1], done: false })

  const draw = ({ ctx, w, h, t }: Frame2D) => {
    const cycle = c.duration + 1.4 // scan + hold
    const ph = t % cycle
    const p = Math.min(1, ph / c.duration)
    const done = ph >= c.duration
    progRef.current = done ? 1 : p

    const top = stage ? 64 : 24
    const bottom = h - (stage ? 70 : 26)
    const S = Math.max(8, Math.min((bottom - top) / 1.5, w * 0.48))
    const cx = w / 2
    const cy = top + S * 0.9 // model y≈0.88 sits just under the top edge
    const scanY = top + (bottom - top) * p
    const ang = reducedMotion ? 0.2 : Math.sin(t * c.turn) * 0.38 + 0.12

    ctx.clearRect(0, 0, w, h)
    const ca = Math.cos(ang)
    const sa = Math.sin(ang)
    const proj = (v: [number, number, number]) => {
      const x = v[0] * ca + v[2] * sa
      const z = -v[0] * sa + v[2] * ca
      return [cx + x * S, cy - v[1] * S, z] as const
    }
    // project every polyline once per frame; passes below only stroke what intersects their band
    const projected = mesh.lines.map((pl) => {
      const pts = new Float32Array(pl.length * 2)
      let minY = Infinity
      let maxY = -Infinity
      let zSum = 0
      for (let i = 0; i < pl.length; i++) {
        const [x, y, z] = proj(pl[i])
        pts[i * 2] = x
        pts[i * 2 + 1] = y
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        zSum += z
      }
      return { pts, minY, maxY, depth: Math.max(0, Math.min(1, 0.5 + (zSum / pl.length) * 2.2)) }
    })
    const pass = (stroke: string, width: number, depthFade: boolean, y0: number, y1: number) => {
      ctx.lineWidth = width
      ctx.strokeStyle = stroke
      for (const pl of projected) {
        if (pl.maxY < y0 || pl.minY > y1) continue
        ctx.beginPath()
        ctx.moveTo(pl.pts[0], pl.pts[1])
        for (let i = 2; i < pl.pts.length; i += 2) ctx.lineTo(pl.pts[i], pl.pts[i + 1])
        ctx.globalAlpha = depthFade ? 0.35 + 0.65 * pl.depth : 1
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    // ghost (not yet scanned)
    if (c.ghost) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, scanY, w, h - scanY)
      ctx.clip()
      pass(hexA(accent, 0.07), 1, false, scanY, h)
      ctx.restore()
    }
    // revealed mesh
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, w, scanY)
    ctx.clip()
    pass(hexA(accent, done ? 0.65 : 0.42), 1, true, 0, scanY)
    ctx.restore()
    // hot band just above the beam
    if (!done) {
      const band = stage ? 26 : 12
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, scanY - band, w, band)
      ctx.clip()
      // fake glow: a wide translucent stroke under a thin bright one (shadowBlur is too slow here)
      if (quality !== 'low') pass(hexA(accent2, 0.18), 4, false, scanY - band, scanY)
      pass(hexA(accent2, 0.95), 1.2, false, scanY - band, scanY)
      ctx.restore()
      // vertices touched by the beam
      ctx.fillStyle = SEM.text
      for (const v of mesh.verts) {
        const [x, y] = proj(v)
        if (Math.abs(y - scanY) < 5) ctx.fillRect(x - 1.5, y - 1.5, 3, 3)
      }
    }

    // beam + light curtain
    if (!done) {
      // light curtain above the beam: a half-ellipse radial glow
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, scanY - 90, w, 90)
      ctx.clip()
      ctx.translate(cx, scanY)
      ctx.scale(1, 90 / (S * 0.8))
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 0.8)
      g.addColorStop(0, hexA(accent, 0.26))
      g.addColorStop(0.6, hexA(accent, 0.08))
      g.addColorStop(1, hexA(accent, 0))
      ctx.fillStyle = g
      ctx.fillRect(-S * 0.8, -S * 0.8, S * 1.6, S * 0.8)
      ctx.restore()
      const lg = ctx.createLinearGradient(cx - S * 0.8, 0, cx + S * 0.8, 0)
      lg.addColorStop(0, hexA(accent2, 0))
      lg.addColorStop(0.5, hexA(accent2, 1))
      lg.addColorStop(1, hexA(accent2, 0))
      ctx.save()
      ctx.shadowColor = accent2
      ctx.shadowBlur = 14
      ctx.fillStyle = lg
      ctx.fillRect(cx - S * 0.8, scanY - 1, S * 1.6, 2)
      ctx.restore()
    }

    // frame brackets around the scan volume
    const fx0 = cx - S * 0.78
    const fx1 = cx + S * 0.78
    const L = stage ? 18 : 9
    ctx.strokeStyle = hexA(accent, 0.8)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (const [x, y, dx, dy] of [
      [fx0, top, 1, 1],
      [fx1, top, -1, 1],
      [fx0, bottom, 1, -1],
      [fx1, bottom, -1, -1],
    ] as const) {
      ctx.moveTo(x, y + dy * L)
      ctx.lineTo(x, y)
      ctx.lineTo(x + dx * L, y)
    }
    ctx.stroke()

    // left ruler with a marker at the beam
    if (stage) {
      const rx = fx0 - 26
      ctx.fillStyle = hexA(accent, 0.5)
      for (let i = 0; i <= 40; i++) {
        const y = top + ((bottom - top) * i) / 40
        ctx.fillRect(rx - (i % 5 === 0 ? 8 : 4), y, i % 5 === 0 ? 8 : 4, 1)
      }
      ctx.font = '500 9px "JetBrains Mono", monospace'
      ctx.textAlign = 'right'
      for (let i = 0; i <= 4; i++) {
        const y = top + ((bottom - top) * i) / 4
        ctx.fillText(`${i * 25}`, rx - 12, y + 3)
      }
      ctx.fillStyle = accent2
      ctx.beginPath()
      ctx.moveTo(rx + 2, scanY)
      ctx.lineTo(rx + 9, scanY - 4)
      ctx.lineTo(rx + 9, scanY + 4)
      ctx.closePath()
      ctx.fill()
    }

    // segmented progress bar
    const bw = Math.min(w - 40, stage ? 520 : 200)
    const bx = cx - bw / 2
    const by = h - (stage ? 50 : 16)
    const segs = stage ? 40 : 20
    const sw = bw / segs
    for (let i = 0; i < segs; i++) {
      const on = i / segs < progRef.current
      ctx.fillStyle = on ? (done ? SEM.ok : hexA(accent, 0.9)) : hexA(accent, 0.12)
      ctx.fillRect(bx + i * sw + 1, by, sw - 2, stage ? 6 : 4)
    }
  }

  const canvasRef = useCanvas2D(draw, { paused, quality, maxFps: stage ? 60 : 30, timeScale: reducedMotion ? 0.5 : 1 })

  // textual status (React) at 8 Hz
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      const p = progRef.current
      const done = p >= 1
      const msg = done ? 'Skan zakończony' : [...STAGES].reverse().find(([th]) => p >= th)![1]
      setUi((u) => (u.p === Math.floor(p * 100) && u.msg === msg ? u : { p: Math.floor(p * 100), msg, done }))
    }, 125)
    return () => clearInterval(id)
  }, [paused])

  return (
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,var(--jx-accent-faint),transparent_65%)]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <div
        className={`absolute left-1/2 flex -translate-x-1/2 items-baseline gap-3 whitespace-nowrap ${stage ? 'bottom-16' : 'bottom-6'}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={ui.p}
        aria-valuetext={`${ui.msg} – ${ui.p}%`}
      >
        <span className={`${LBL} ${stage ? 'text-[0.72rem]' : 'text-[0.5rem]'} ${ui.done ? 'text-jx-ok' : 'text-jx-accent'}`}>{ui.msg}</span>
        <span className={`jx-num ${stage ? 'text-lg' : 'text-[0.6rem]'} ${ui.done ? 'text-jx-ok' : 'text-jx-text'} jx-glow-text`}>{String(ui.p).padStart(3, ' ')}%</span>
      </div>
      <HudChrome
        code="SCN-05 · SKAN"
        title="Rekonstrukcja sylwetki"
        stage={stage}
        badges={<DemoBadge label={stage ? 'DEMO · POSTĘP SYMULOWANY' : 'DEMO'} title="Postęp skanu i sylwetka są generowane proceduralnie – to demonstracja loadera" />}
        footer={stage ? <span className={`${LBL} text-[0.6rem]`}>Siatka: {mesh.lines.length} polilinii · {mesh.verts.length} węzłów</span> : undefined}
      />
    </div>
  )
}
