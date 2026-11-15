import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'
import { useGSAP } from '@gsap/react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { DemoBadge, useElementSize } from '../motion-kit/kit'

gsap.registerPlugin(useGSAP, DrawSVGPlugin, MorphSVGPlugin)

type Phase = 'search' | 'acquire' | 'lock' | 'release'

const PHASE_PL: Record<Phase, string> = {
  search: 'Skanowanie',
  acquire: 'Namierzanie',
  lock: 'Cel zablokowany',
  release: 'Zwolnienie',
}

/** Inner core shapes, all centred on 0,0 (MorphSVG interpolates between them). */
const shapes = (s: number) => ({
  square: `M0,${-s} L${s},${-s} L${s},${s} L${-s},${s} L${-s},${-s} Z`,
  circle: `M0,${-s} A${s},${s} 0 1 1 0,${s} A${s},${s} 0 1 1 0,${-s} Z`,
  diamond: `M0,${-s * 1.35} L${s * 1.35},0 L0,${s * 1.35} L${-s * 1.35},0 Z`,
})

const LOCK_COLORS = { czerwony: 'var(--jx-danger)', akcent: 'var(--jx-accent-2)', bursztyn: 'var(--jx-warn)' } as const

export default function ReticleLock({ stage, reducedMotion, paused }: FxProps) {
  const c = useFxControls({
    speed: { value: 1, min: 0.2, max: 2.5, step: 0.05, label: 'prędkość celu' },
    lag: { value: 0.32, min: 0.04, max: 1.2, step: 0.02, label: 'bezwładność (s)' },
    morph: { value: true, label: 'morfing rdzenia' },
    trail: { value: true, label: 'ślad trajektorii' },
    lockColor: { value: LOCK_COLORS.czerwony as string, options: LOCK_COLORS, label: 'kolor blokady' },
  })
  const [rootRef, size] = useElementSize<HTMLDivElement>()
  const svgRef = useRef<SVGSVGElement>(null)
  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'lock' : 'search')
  const [locks, setLocks] = useState(0)

  const speedRef = useRef(c.speed)
  const lagRef = useRef(c.lag)
  const trailRef = useRef(c.trail)
  const pausedRef = useRef(paused)
  const loopsRef = useRef<gsap.core.Animation[]>([])
  useEffect(() => {
    speedRef.current = c.speed
    lagRef.current = c.lag
    trailRef.current = c.trail
  }, [c.speed, c.lag, c.trail])
  useEffect(() => {
    pausedRef.current = paused
    loopsRef.current.forEach((a) => (paused ? a.pause() : a.resume()))
  }, [paused])

  const { w, h } = size
  const R = Math.max(16, Math.min(w, h) * (stage ? 0.1 : 0.17))
  const S = shapes(R * 0.42)

  useGSAP(
    () => {
      const svg = svgRef.current
      if (!svg || !w || !h) return
      const $ = <T extends Element>(s: string) => svg.querySelector<T>(s)!
      const $$ = (s: string) => Array.from(svg.querySelectorAll<SVGElement>(s))
      const reticle = $<SVGGElement>('[data-reticle]')
      const target = $<SVGGElement>('[data-target]')
      const core = $<SVGPathElement>('[data-core]')
      const hLine = $<SVGLineElement>('[data-hline]')
      const vLine = $<SVGLineElement>('[data-vline]')
      const trail = $<SVGPolylineElement>('[data-trail]')
      const rings = $$('[data-draw]')
      const spin = $$('[data-spin]')
      const brackets = $<SVGGElement>('[data-brackets]')
      const progress = $<SVGCircleElement>('[data-progress]')
      const root = rootRef.current
      const az = root?.querySelector<HTMLElement>('[data-az]')
      const el = root?.querySelector<HTMLElement>('[data-el]')
      const dist = root?.querySelector<HTMLElement>('[data-dist]')
      const tape = root?.querySelector<HTMLElement>('[data-tape]')

      const cx = w / 2
      const cy = h / 2
      const targetAt = (t: number) => ({
        x: cx + w * 0.32 * Math.sin(t * 0.53 + 0.4) + w * 0.04 * Math.sin(t * 1.9),
        y: cy + h * 0.27 * Math.sin(t * 0.71 + 1.2),
      })
      const st = { t: 0, rx: cx, ry: cy, phase: 'search' as Phase, search: { x: cx, y: cy }, hist: [] as string[], frame: 0 }

      const place = (rx: number, ry: number) => {
        reticle.setAttribute('transform', `translate(${rx.toFixed(1)} ${ry.toFixed(1)})`)
        hLine.setAttribute('y1', ry.toFixed(1))
        hLine.setAttribute('y2', ry.toFixed(1))
        vLine.setAttribute('x1', rx.toFixed(1))
        vLine.setAttribute('x2', rx.toFixed(1))
        const azDeg = ((rx / w) * 120 - 60 + 360) % 360
        const elDeg = (0.5 - ry / h) * 60
        if (az) az.textContent = `${azDeg.toFixed(1).padStart(5, '0')}°`
        if (el) el.textContent = `${elDeg >= 0 ? '+' : '−'}${Math.abs(elDeg).toFixed(1)}°`
        if (tape) tape.style.transform = `translateX(${(-(rx / w) * 50).toFixed(2)}%)`
      }

      if (reducedMotion) {
        const tp = targetAt(1.3)
        target.setAttribute('transform', `translate(${tp.x} ${tp.y})`)
        place(tp.x, tp.y)
        gsap.set(core, { morphSVG: S.diamond })
        gsap.set(brackets, { opacity: 1, scale: 1, transformOrigin: '50% 50%' })
        gsap.set(progress, { drawSVG: '0% 100%' })
        if (dist) dist.textContent = '1 284 m'
        return
      }

      gsap.set(rings, { drawSVG: '0% 0%' })
      gsap.set(progress, { drawSVG: '0% 0%' })
      gsap.set(brackets, { opacity: 0, scale: 1.9, transformOrigin: '50% 50%' })
      gsap.set(core, { attr: { d: S.square } })

      const tick = (_t: number, deltaMs: number) => {
        if (pausedRef.current) return
        const dt = Math.min(0.05, deltaMs / 1000)
        st.t += dt * speedRef.current
        const tp = targetAt(st.t)
        target.setAttribute('transform', `translate(${tp.x.toFixed(1)} ${tp.y.toFixed(1)})`)
        const aim = st.phase === 'search' || st.phase === 'release' ? st.search : tp
        const tau = st.phase === 'search' || st.phase === 'release' ? 0.5 : st.phase === 'acquire' ? lagRef.current : 0.045
        const k = 1 - Math.exp(-dt / Math.max(0.01, tau))
        st.rx += (aim.x - st.rx) * k
        st.ry += (aim.y - st.ry) * k
        place(st.rx, st.ry)
        if (dist && st.frame % 4 === 0) {
          const d = 900 + 520 * (0.5 + 0.5 * Math.sin(st.t * 0.37)) + Math.hypot(tp.x - cx, tp.y - cy) * 0.6
          dist.textContent = `${Math.round(d).toLocaleString('pl-PL')} m`
        }
        st.frame++
        if (st.frame % 3 === 0) {
          if (trailRef.current) {
            st.hist.push(`${tp.x.toFixed(1)},${tp.y.toFixed(1)}`)
            if (st.hist.length > 70) st.hist.shift()
            trail.setAttribute('points', st.hist.join(' '))
          } else if (st.hist.length) {
            st.hist = []
            trail.setAttribute('points', '')
          }
        }
      }
      gsap.ticker.add(tick)

      const go = (p: Phase) => () => {
        st.phase = p
        setPhase(p)
        if (p === 'lock') setLocks((n) => n + 1)
      }
      const scanTo = (x: number, y: number) => () => {
        st.search = { x, y }
      }

      const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'power3.inOut' } })
      tl.call(go('search'))
        .call(scanTo(cx - w * 0.22, cy - h * 0.16))
        .to(rings, { drawSVG: '0% 100%', duration: 1.1, stagger: 0.12, ease: 'expo.out' }, 0)
        .call(scanTo(cx + w * 0.18, cy - h * 0.05), [], 0.8)
        .call(scanTo(cx - w * 0.05, cy + h * 0.18), [], 1.6)
        // acquire: chase with lag, core rounds into a circle, progress arc fills
        .call(go('acquire'), [], 2.3)
        .to(core, { morphSVG: c.morph ? S.circle : S.square, duration: 0.7 }, 2.3)
        .to(progress, { drawSVG: '0% 100%', duration: 1.8, ease: 'none' }, 2.3)
        // lock: snap brackets, diamond core, flash
        .call(go('lock'), [], 4.15)
        .to(core, { morphSVG: c.morph ? S.diamond : S.square, duration: 0.35, ease: 'back.out(2)' }, 4.15)
        .to(brackets, { opacity: 1, scale: 1, duration: 0.3, ease: 'expo.out' }, 4.15)
        .fromTo(reticle, { opacity: 0.35 }, { opacity: 1, duration: 0.08, repeat: 3, yoyo: true, ease: 'none' }, 4.15)
        // release
        .call(go('release'), [], 7.2)
        .call(scanTo(cx, cy), [], 7.2)
        .to(brackets, { opacity: 0, scale: 1.9, duration: 0.35, ease: 'power2.in' }, 7.2)
        .to(progress, { drawSVG: '100% 100%', duration: 0.5, ease: 'power2.in' }, 7.2)
        .to(core, { morphSVG: S.square, duration: 0.5 }, 7.3)
        .to(rings, { drawSVG: '100% 100%', duration: 0.6, stagger: 0.06, ease: 'power2.in' }, 7.4)
        .set(rings, { drawSVG: '0% 0%' }, 8.2)
        .set(progress, { drawSVG: '0% 0%' }, 8.2)
        .to({}, { duration: 0.2 }, 8.2)

      const rot = gsap.timeline({ repeat: -1 })
      spin.forEach((s, i) => rot.to(s, { rotation: i % 2 ? -360 : 360, transformOrigin: '50% 50%', duration: 9 + i * 5, ease: 'none', repeat: -1 }, 0))
      loopsRef.current = [tl, rot]
      if (pausedRef.current) loopsRef.current.forEach((a) => a.pause())

      return () => {
        gsap.ticker.remove(tick)
        loopsRef.current = []
      }
    },
    { scope: rootRef, dependencies: [w, h, R, reducedMotion, c.morph], revertOnUpdate: true },
  )

  const lockC = c.lockColor
  const rc = phase === 'lock' ? lockC : 'var(--jx-accent)'
  const big = stage
  const ticks = [0, 90, 180, 270]
  const b = R * 0.78
  const L = R * 0.32

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden bg-jx-bg" style={{ ['--rc' as string]: rc }}>
      <div className="absolute inset-0 jx-grid-bg opacity-45" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(0_0_0/0.65))]" aria-hidden="true" />

      {w > 0 && (
        <svg ref={svgRef} className="absolute inset-0 size-full" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Celownik HUD – faza: ${PHASE_PL[phase]}`}>
          {/* static range rings around screen centre */}
          <g stroke="var(--jx-line)" fill="none" opacity={0.5}>
            {[0.18, 0.32, 0.46].map((f) => (
              <circle key={f} cx={w / 2} cy={h / 2} r={Math.min(w, h) * f} strokeDasharray={f === 0.32 ? '2 6' : undefined} />
            ))}
            <line x1={w / 2} y1={0} x2={w / 2} y2={h} strokeDasharray="1 7" />
            <line x1={0} y1={h / 2} x2={w} y2={h / 2} strokeDasharray="1 7" />
          </g>

          {/* trajectory trail */}
          <polyline data-trail fill="none" stroke="var(--jx-accent)" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="3 4" />

          {/* full-screen crosshair following the reticle */}
          <line data-hline x1={0} x2={w} y1={h / 2} y2={h / 2} style={{ stroke: 'var(--rc)', transition: 'stroke .25s' }} strokeOpacity={0.28} />
          <line data-vline y1={0} y2={h} x1={w / 2} x2={w / 2} style={{ stroke: 'var(--rc)', transition: 'stroke .25s' }} strokeOpacity={0.28} />

          {/* moving target (simulated object) */}
          <g data-target transform={`translate(${w / 2} ${h / 2})`}>
            <circle r={R * 0.16} fill="none" stroke="var(--jx-warn)" strokeWidth={1} className="rl-ping" />
            <path d={`M0,${-R * 0.11} L${R * 0.1},${R * 0.08} L${-R * 0.1},${R * 0.08} Z`} fill="var(--jx-warn)" style={{ filter: 'drop-shadow(0 0 4px var(--jx-warn))' }} />
            {big && (
              <text x={R * 0.22} y={-R * 0.18} className="jx-num" fontSize={11} fill="var(--jx-warn)">
                OBIEKT-07
              </text>
            )}
          </g>

          {/* the reticle */}
          <g data-reticle transform={`translate(${w / 2} ${h / 2})`} style={{ color: 'var(--rc)', transition: 'color .25s' }} fill="none" stroke="currentColor">
            <circle data-draw r={R} strokeWidth={1.5} style={{ filter: 'drop-shadow(0 0 4px currentColor)' }} />
            <circle data-spin r={R * 0.84} strokeWidth={1} strokeDasharray={`${R * 0.18} ${R * 0.09}`} strokeOpacity={0.7} />
            <circle data-spin r={R * 1.32} strokeWidth={1} strokeDasharray={`2 ${R * 0.12}`} strokeOpacity={0.55} />
            <circle data-progress r={R * 1.16} strokeWidth={3} strokeOpacity={0.9} transform="rotate(-90)" />
            {ticks.map((a) => (
              <line key={a} data-draw x1={0} y1={-R * 1.05} x2={0} y2={-R * 1.48} strokeWidth={2} transform={`rotate(${a})`} />
            ))}
            {ticks.map((a) => (
              <line key={`s${a}`} x1={0} y1={-R * 0.08} x2={0} y2={-R * 0.22} strokeWidth={1} transform={`rotate(${a + 45})`} strokeOpacity={0.8} />
            ))}
            <path data-core d={S.square} strokeWidth={1.6} style={{ filter: 'drop-shadow(0 0 3px currentColor)' }} />
            <g data-brackets strokeWidth={2.2}>
              <path d={`M${-b},${-b + L} L${-b},${-b} L${-b + L},${-b}`} />
              <path d={`M${b - L},${-b} L${b},${-b} L${b},${-b + L}`} />
              <path d={`M${b},${b - L} L${b},${b} L${b - L},${b}`} />
              <path d={`M${-b + L},${b} L${-b},${b} L${-b},${b - L}`} />
            </g>
            <circle r={2} fill="currentColor" stroke="none" />
            <text y={R * 1.78} textAnchor="middle" className="font-head uppercase" fontSize={big ? 13 : 8} letterSpacing="0.18em" fill="currentColor" stroke="none" style={{ textShadow: '0 0 6px currentColor' }}>
              {PHASE_PL[phase]}
            </text>
          </g>
        </svg>
      )}

      {/* azimuth tape */}
      {stage && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-[min(40rem,60%)] h-9 overflow-hidden border-b border-jx-line" aria-hidden="true">
          <div data-tape className="absolute left-1/2 top-0 h-full flex items-end gap-0 whitespace-nowrap will-change-transform" style={{ width: '200%' }}>
            {Array.from({ length: 73 }, (_, i) => (
              <span key={i} className="relative shrink-0 w-[2.5%] h-full flex flex-col items-start justify-end">
                {i % 3 === 0 && <span className="jx-num text-[0.58rem] text-jx-dim -translate-x-1/2">{String((i * 5 + 300) % 360).padStart(3, '0')}</span>}
                <span className={`w-px ${i % 3 === 0 ? 'h-3 bg-jx-accent' : 'h-1.5 bg-jx-line'}`} />
              </span>
            ))}
          </div>
          <span className="absolute left-1/2 bottom-0 -translate-x-1/2 border-x-[5px] border-x-transparent border-b-[7px] border-b-jx-accent" />
        </div>
      )}

      {/* telemetry corner */}
      <div className={`absolute ${stage ? 'left-6 bottom-6 gap-2 p-4 min-w-60' : 'left-1.5 bottom-1.5 gap-0.5 p-1.5'} flex flex-col jx-aug`} data-augmented-ui="tl-clip br-clip border">
        <div className="flex items-center gap-2">
          <span className={`jx-label ${stage ? '' : 'text-[0.42rem]'}`}>Celownik</span>
          <span className="flex-1" />
          {stage && <DemoBadge label="SYMULACJA" title="Obiekt i odległość są symulowane na potrzeby efektu" />}
        </div>
        <div className={`font-head uppercase tracking-[0.18em] ${stage ? 'text-lg' : 'text-[0.55rem]'}`} style={{ color: rc, textShadow: '0 0 8px currentColor' }} aria-live="polite">
          {PHASE_PL[phase]}
        </div>
        {stage && (
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs">
            <dt className="jx-label">Azymut</dt>
            <dd data-az className="m-0 jx-num text-jx-text text-right">000.0°</dd>
            <dt className="jx-label">Elewacja</dt>
            <dd data-el className="m-0 jx-num text-jx-text text-right">+0.0°</dd>
            <dt className="jx-label">Odległość</dt>
            <dd data-dist className="m-0 jx-num text-jx-text text-right">—</dd>
            <dt className="jx-label">Blokady</dt>
            <dd className="m-0 jx-num text-jx-accent text-right">{locks}</dd>
          </dl>
        )}
      </div>

      <style>{`
        .rl-ping { transform-box: fill-box; transform-origin: center; animation: rl-ping 1.6s ease-out infinite; }
        @keyframes rl-ping { from { transform: scale(0.6); opacity: 1; } to { transform: scale(2.6); opacity: 0; } }
      `}</style>
    </div>
  )
}
