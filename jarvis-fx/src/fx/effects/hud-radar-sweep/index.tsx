import { useEffect, useRef, useState } from 'react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { playBleep } from '@/lib/sound'
import { DemoBadge, HudChrome } from '../hud-kit/HudChrome'
import { hexA, rng, SEM } from '../hud-kit/color'
import { useCanvas2D, type Frame2D } from '../hud-kit/useCanvas2D'
import { LBL } from '../hud-kit/ui'

/**
 * Original PPI (plan position indicator) radar drawn with Canvas 2D.
 * The sweep "paints" each contact when it passes its bearing; the echo then decays like
 * phosphor persistence. Contacts are synthetic and the effect is labelled DEMO.
 */

type Kind = 'friend' | 'unknown' | 'hostile'
interface Contact {
  id: string
  kind: Kind
  x: number // −1..1 (fraction of max range)
  y: number
  vx: number
  vy: number
  /** position + time of the last paint by the sweep */
  hx: number
  hy: number
  hit: number
}

const TAU = Math.PI * 2
const KIND_COLOR: Record<Kind, string> = { friend: SEM.ok, unknown: SEM.warn, hostile: SEM.danger }
const KIND_LABEL: Record<Kind, string> = { friend: 'SWÓJ', unknown: 'NIEZNANY', hostile: 'WROGI' }

function spawn(r: () => number, i: number): Contact {
  const a = r() * TAU
  const d = 0.2 + r() * 0.75
  const sp = 0.004 + r() * 0.018
  const h = r() * TAU
  const kind: Kind = r() < 0.5 ? 'friend' : r() < 0.6 ? 'unknown' : 'hostile'
  const x = Math.cos(a) * d
  const y = Math.sin(a) * d
  return { id: `K-${String(i + 1).padStart(2, '0')}`, kind, x, y, vx: Math.cos(h) * sp, vy: Math.sin(h) * sp, hx: x, hy: y, hit: -99 }
}

/** move a contact (mutates the simulation object); returns its bearing from north in radians */
function advance(k: Contact, dt: number): number {
  k.x += k.vx * dt
  k.y += k.vy * dt
  if (k.x * k.x + k.y * k.y > 1) {
    // left the scope → re-enter on the opposite side heading inwards
    k.x = -k.x * 0.98
    k.y = -k.y * 0.98
  }
  return (Math.atan2(k.y, k.x) + Math.PI / 2 + TAU) % TAU
}

/** the beam paints the echo at the contact's current position */
function paint(k: Contact, t: number) {
  k.hx = k.x
  k.hy = k.y
  k.hit = t
}

/** compass bearing (0° = north, clockwise) of a canvas-space vector */
const bearingOf = (x: number, y: number) => ((Math.atan2(y, x) + Math.PI / 2 + TAU) % TAU) * (180 / Math.PI)

export default function RadarSweep({ accent, accent2, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    rpm: { value: 18, min: 4, max: 60, step: 1, label: 'obroty / min' },
    trail: { value: 75, min: 15, max: 200, step: 5, label: 'ślad (°)' },
    contacts: { value: 10, min: 2, max: 24, step: 1, label: 'kontakty' },
    rings: { value: 4, min: 2, max: 6, step: 1, label: 'pierścienie' },
    persistence: { value: 0.85, min: 0.2, max: 1.5, step: 0.05, label: 'poświata' },
    labels: { value: true, label: 'etykiety' },
    ping: { value: false, label: 'dźwięk echa' },
  })

  const contactsRef = useRef<Contact[]>([])
  const prevSweep = useRef(0)
  const [list, setList] = useState<{ id: string; kind: Kind; km: number; brg: number }[]>([])

  // (re)build the synthetic contact set when the count changes – deterministic seed
  useEffect(() => {
    const r = rng(1337)
    contactsRef.current = Array.from({ length: c.contacts }, (_, i) => spawn(r, i))
  }, [c.contacts])

  const maxKm = c.rings * 5

  const draw = ({ ctx, w, h, t, dt }: Frame2D) => {
    const side = stage && w > 760
    const cx = side ? w * 0.4 : w / 2
    const cy = h / 2 + (stage ? 6 : 4)
    const R = Math.max(10, Math.min(side ? w * 0.36 : w * 0.46, h * (stage ? 0.42 : 0.4)))
    const sweep = ((t * c.rpm) / 60) * TAU // canvas angle measured from north, clockwise
    const sweepCanvas = sweep - Math.PI / 2
    const rev = 60 / c.rpm
    const small = R < 90

    ctx.clearRect(0, 0, w, h)

    // scope glass
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.15)
    bg.addColorStop(0, hexA(accent, 0.1))
    bg.addColorStop(0.75, hexA(accent, 0.035))
    bg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.arc(cx, cy, R * 1.15, 0, TAU)
    ctx.fill()

    // range rings
    ctx.lineWidth = 1
    for (let i = 1; i <= c.rings; i++) {
      const rr = (R * i) / c.rings
      ctx.strokeStyle = hexA(accent, i === c.rings ? 0.75 : 0.22)
      ctx.setLineDash(i === c.rings ? [] : [2, 4])
      ctx.beginPath()
      ctx.arc(cx, cy, rr, 0, TAU)
      ctx.stroke()
      if (!small) {
        ctx.setLineDash([])
        ctx.fillStyle = hexA(accent, 0.6)
        ctx.font = '500 9px "JetBrains Mono", monospace'
        ctx.textAlign = 'left'
        ctx.fillText(`${(maxKm * i) / c.rings} km`, cx + 4, cy - rr + 11)
      }
    }
    ctx.setLineDash([])

    // crosshair + diagonals
    ctx.strokeStyle = hexA(accent, 0.18)
    ctx.beginPath()
    ctx.moveTo(cx - R, cy)
    ctx.lineTo(cx + R, cy)
    ctx.moveTo(cx, cy - R)
    ctx.lineTo(cx, cy + R)
    ctx.stroke()
    ctx.strokeStyle = hexA(accent, 0.08)
    ctx.beginPath()
    for (let k = 1; k < 8; k += 2) {
      const a = (k * Math.PI) / 4
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
    }
    ctx.stroke()

    // bearing ticks (outside the last ring)
    const step = small ? 10 : quality === 'low' ? 5 : 2
    for (let d = 0; d < 360; d += step) {
      const a = (d * Math.PI) / 180 - Math.PI / 2
      const major = d % 30 === 0
      const mid = d % 10 === 0
      const len = major ? 10 : mid ? 6 : 3
      ctx.strokeStyle = hexA(accent, major ? 0.9 : mid ? 0.5 : 0.25)
      ctx.lineWidth = major ? 1.4 : 1
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * (R + 2), cy + Math.sin(a) * (R + 2))
      ctx.lineTo(cx + Math.cos(a) * (R + 2 + len), cy + Math.sin(a) * (R + 2 + len))
      ctx.stroke()
      if (major && !small) {
        ctx.fillStyle = hexA(accent, 0.85)
        ctx.font = '600 10px "Rajdhani", "JetBrains Mono", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(d).padStart(3, '0'), cx + Math.cos(a) * (R + 24), cy + Math.sin(a) * (R + 24))
      }
    }
    ctx.textBaseline = 'alphabetic'

    // sweep trail (conic gradient) + leading edge
    const trail = (c.trail * Math.PI) / 180
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, R, sweepCanvas - trail, sweepCanvas)
    ctx.closePath()
    if (typeof (ctx as { createConicGradient?: unknown }).createConicGradient === 'function') {
      const g = ctx.createConicGradient(sweepCanvas - trail, cx, cy)
      const f = trail / TAU
      g.addColorStop(0, hexA(accent, 0))
      g.addColorStop(f * 0.7, hexA(accent, 0.12))
      g.addColorStop(f, hexA(accent, 0.42))
      g.addColorStop(Math.min(1, f + 0.0001), hexA(accent, 0))
      ctx.fillStyle = g
    } else {
      ctx.fillStyle = hexA(accent, 0.15)
    }
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.shadowColor = accent
    ctx.shadowBlur = 12
    ctx.strokeStyle = hexA(accent2, 0.95)
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(sweepCanvas) * R, cy + Math.sin(sweepCanvas) * R)
    ctx.stroke()
    ctx.restore()

    // contacts: move, get painted when the beam crosses their bearing, decay afterwards
    const prev = prevSweep.current
    prevSweep.current = sweep
    const swept = (b: number) => {
      // b: bearing in radians from north; did the beam pass it during this frame?
      const p = ((prev % TAU) + TAU) % TAU
      const s = ((sweep % TAU) + TAU) % TAU
      if (sweep - prev >= TAU) return true
      return p <= s ? b > p && b <= s : b > p || b <= s
    }
    const fade = rev * c.persistence
    for (const k of contactsRef.current) {
      const b = advance(k, dt)
      if (dt > 0 && swept(b)) {
        paint(k, t)
        if (c.ping && stage && k.kind === 'hostile') playBleep('scan')
      }
      const age = t - k.hit
      const alpha = Math.exp(-age / Math.max(0.05, fade))
      if (alpha < 0.02) continue
      const px = cx + k.hx * R
      const py = cy + k.hy * R
      const col = KIND_COLOR[k.kind]
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.shadowColor = col
      ctx.shadowBlur = 10
      ctx.fillStyle = col
      ctx.strokeStyle = col
      const s = small ? 2.5 : 3.6
      ctx.beginPath()
      if (k.kind === 'friend') ctx.arc(px, py, s, 0, TAU)
      else if (k.kind === 'unknown') {
        ctx.moveTo(px, py - s * 1.3)
        ctx.lineTo(px + s * 1.3, py)
        ctx.lineTo(px, py + s * 1.3)
        ctx.lineTo(px - s * 1.3, py)
        ctx.closePath()
      } else ctx.rect(px - s, py - s, s * 2, s * 2)
      ctx.fill()
      // heading vector
      ctx.shadowBlur = 0
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(px, py)
      const sp = Math.hypot(k.vx, k.vy) || 1
      ctx.lineTo(px + (k.vx / sp) * (s * 4), py + (k.vy / sp) * (s * 4))
      ctx.stroke()
      if (c.labels && !small) {
        const km = Math.hypot(k.hx, k.hy) * maxKm
        const brg = bearingOf(k.hx, k.hy)
        ctx.font = '600 10px "Rajdhani", sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(k.id, px + 8, py - 4)
        ctx.font = '400 9px "JetBrains Mono", monospace'
        ctx.globalAlpha = alpha * 0.75
        ctx.fillText(`${km.toFixed(1)}km ${String(Math.round(brg) % 360).padStart(3, '0')}°`, px + 8, py + 7)
      }
      ctx.restore()
    }

    // own ship + rotating inner reticle
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(-sweep * 0.5)
    ctx.strokeStyle = hexA(accent, 0.7)
    ctx.lineWidth = 1
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.arc(0, 0, small ? 6 : 10, (i * Math.PI) / 2 + 0.2, (i * Math.PI) / 2 + 1.2)
      ctx.stroke()
    }
    ctx.restore()
    ctx.fillStyle = accent2
    ctx.beginPath()
    ctx.moveTo(cx, cy - 4)
    ctx.lineTo(cx + 3, cy + 3)
    ctx.lineTo(cx - 3, cy + 3)
    ctx.closePath()
    ctx.fill()

    // beam bearing readout
    if (!small) {
      const deg = Math.round(((sweep % TAU) * 180) / Math.PI) % 360
      ctx.font = '600 11px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = hexA(accent2, 0.95)
      ctx.fillText(`NAMIAR ${String(deg).padStart(3, '0')}°`, cx, cy + R + 44 > h ? cy - R - 34 : cy + R + 40)
    }
  }

  const canvasRef = useCanvas2D(draw, { paused, quality, maxFps: stage ? 60 : 30, timeScale: reducedMotion ? 0.35 : 1 })

  // contact table for the stage – sampled from the simulation ref (2 Hz)
  useEffect(() => {
    if (!stage || paused) return
    const tick = () =>
      setList(
        contactsRef.current
          .map((k) => ({ id: k.id, kind: k.kind, km: Math.hypot(k.hx, k.hy) * maxKm, brg: Math.round(bearingOf(k.hx, k.hy)) % 360 }))
          .sort((a, b) => a.km - b.km)
          .slice(0, 8),
      )
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [stage, paused, maxKm])

  return (
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--jx-accent-faint),transparent_70%)]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" role="img" aria-label="Radar dookólny z syntetycznymi kontaktami" />
      <HudChrome
        code="RDR-01 · PPI"
        title="Radar dookólny"
        stage={stage}
        badges={<DemoBadge title="Kontakty radarowe są syntetyczne – symulacja lokalna" />}
        footer={
          stage ? (
            <>
              <span className={`${LBL} text-[0.6rem]`}>Zasięg {maxKm} km</span>
              <span className={`${LBL} text-[0.6rem]`}>Obrót {c.rpm} obr/min</span>
              <span className="flex-1" />
              <span className={`${LBL} text-[0.6rem] text-jx-ok`}>● swój</span>
              <span className={`${LBL} text-[0.6rem] text-jx-warn`}>◆ nieznany</span>
              <span className={`${LBL} text-[0.6rem] text-jx-danger`}>■ wrogi</span>
            </>
          ) : undefined
        }
      />
      {stage && (
        <aside className="pointer-events-none absolute right-5 top-14 z-10 hidden w-[min(18rem,30%)] lg:block" aria-label="Lista kontaktów">
          <div data-augmented-ui="tl-clip br-clip border" className="jx-aug px-3 py-2">
            <div className={`${LBL} mb-1.5 flex justify-between text-[0.62rem]`}>
              <span className="text-jx-accent">Kontakty</span>
              <span>{list.length} / {c.contacts}</span>
            </div>
            <table className="w-full jx-num text-[0.66rem]">
              <thead>
                <tr className="text-jx-dim text-left">
                  <th className="font-normal">ID</th>
                  <th className="font-normal">Klasa</th>
                  <th className="font-normal text-right">Odl.</th>
                  <th className="font-normal text-right">Nam.</th>
                </tr>
              </thead>
              <tbody>
                {list.map((k) => (
                  <tr key={k.id} style={{ color: KIND_COLOR[k.kind] }}>
                    <td>{k.id}</td>
                    <td className="font-label tracking-wider">{KIND_LABEL[k.kind]}</td>
                    <td className="text-right">{k.km.toFixed(1)} km</td>
                    <td className="text-right">{String(k.brg).padStart(3, '0')}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </aside>
      )}
    </div>
  )
}
