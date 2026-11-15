import { useEffect, useId, useMemo, useRef } from 'react'
import { motion, useAnimationFrame } from 'motion/react'
import gsap from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { useGSAP } from '@gsap/react'
import type { AgentStatus } from '@/lib/agents'
import { CSS_TONE, STATUS_META, type CoreMode } from './model'

gsap.registerPlugin(DrawSVGPlugin, useGSAP)

/**
 * Radial HUD overlay drawn in SVG around the 3D core (original code).
 *  - static compass ring (ticks + bearings)
 *  - rotating arc / dash rings and a radar sweep whose speed follows the core mode
 *    (Motion `useAnimationFrame`, attributes written directly – no React re-render per frame)
 *  - one ring segment per agent coloured by status, with a Motion-animated load arc and
 *    the agent name on a curved <textPath>
 *  - two bracket gauges (mean load, success rate) tweened with GSAP DrawSVGPlugin
 *  - entrance choreography: GSAP timeline drawing every ring in
 */

export interface RadialAgent {
  id: string
  name: string
  status: AgentStatus
  load: number
}

const SPEED: Record<CoreMode, number> = { standby: 0.45, analyze: 1.5, act: 1, alarm: 2.4 }

function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [r * Math.sin(a), -r * Math.cos(a)]
}

/** Arc path on a compass circle (0° = up, clockwise). */
function arc(r: number, a0: number, a1: number, cw = true): string {
  const [x0, y0] = polar(r, a0)
  const [x1, y1] = polar(r, a1)
  const span = cw ? (((a1 - a0) % 360) + 360) % 360 : (((a0 - a1) % 360) + 360) % 360
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${span > 180 ? 1 : 0} ${cw ? 1 : 0} ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

function ticks(r: number, every: number, len: number, skip?: number): string {
  let d = ''
  for (let a = 0; a < 360; a += every) {
    if (skip && a % skip === 0) continue
    const [x0, y0] = polar(r, a)
    const [x1, y1] = polar(r - len, a)
    d += `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`
  }
  return d
}

const R = {
  compass: 492,
  triple: 462,
  dash: 446,
  agents: 424,
  agentLoad: 413,
  bracket: 372,
}

const BEARINGS = [0, 90, 180, 270]
const [LBL_X, LBL_Y] = polar(R.bracket - 46, 236)
const LBL = { x0: Math.round(LBL_X), y: Math.round(LBL_Y) }

export function RadialHud({
  mode,
  agents,
  load,
  success,
  reducedMotion,
  paused,
}: {
  mode: CoreMode
  agents: RadialAgent[]
  /** mean agent utilisation 0..1 */
  load: number
  /** mean success rate 0..1 (null when unknown) */
  success: number | null
  reducedMotion: boolean
  paused: boolean
}) {
  const uid = useId().replace(/:/g, '')
  const root = useRef<SVGSVGElement>(null)
  const triple = useRef<SVGGElement>(null)
  const dash = useRef<SVGGElement>(null)
  const sweep = useRef<SVGGElement>(null)
  const loadArc = useRef<SVGPathElement>(null)
  const successArc = useRef<SVGPathElement>(null)
  const spin = useRef({ a: 0, speed: SPEED[mode] })
  const firstValue = useRef(true)
  // StrictMode remounts revert the GSAP context – start the brackets empty again
  useEffect(
    () => () => {
      firstValue.current = true
    },
    [],
  )

  // ---- rotation loop (Motion frameloop) ------------------------------------------------------
  useAnimationFrame((_, delta) => {
    if (reducedMotion || paused) return
    const s = spin.current
    const dt = Math.min(0.1, delta / 1000)
    s.speed += (SPEED[mode] - s.speed) * Math.min(1, dt * 2)
    s.a = (s.a + dt * s.speed * 10) % 360000
    triple.current?.setAttribute('transform', `rotate(${(s.a % 360).toFixed(2)})`)
    dash.current?.setAttribute('transform', `rotate(${(-(s.a * 0.45) % 360).toFixed(2)})`)
    sweep.current?.setAttribute('transform', `rotate(${((s.a * 6) % 360).toFixed(2)})`)
  })

  // ---- entrance choreography (GSAP DrawSVG) ---------------------------------------------------
  useGSAP(
    () => {
      if (reducedMotion) return
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from('.rh-draw', { drawSVG: '50% 50%', duration: 1.4, stagger: 0.07 })
        .from('.rh-fade', { opacity: 0, duration: 0.9, stagger: 0.05 }, 0.2)
        .from('.rh-pop', { opacity: 0, scale: 0.6, transformOrigin: '50% 50%', duration: 0.7, stagger: 0.04 }, 0.5)
    },
    { scope: root },
  )

  // ---- value brackets (GSAP DrawSVG tweens) ---------------------------------------------------
  useGSAP(
    () => {
      const d = reducedMotion ? 0 : 1
      const pct = (v: number | null) => `0% ${v === null ? 0 : Math.round(Math.max(0, Math.min(1, v)) * 1000) / 10}%`
      const targets: [SVGPathElement | null, number | null][] = [
        [loadArc.current, load],
        [successArc.current, success],
      ]
      for (const [el, v] of targets) {
        if (!el) continue
        // first run grows the bracket from empty instead of shrinking from a full stroke
        if (firstValue.current) gsap.set(el, { drawSVG: '0% 0%' })
        gsap.to(el, { drawSVG: pct(v), duration: d, delay: firstValue.current && !reducedMotion ? 0.6 : 0, ease: 'power2.out', overwrite: 'auto' })
      }
      firstValue.current = false
    },
    { dependencies: [load, success, reducedMotion], scope: root },
  )

  const statics = useMemo(
    () => ({
      minor: ticks(R.compass, 3, 6, 15),
      mid: ticks(R.compass, 15, 12, 45),
      major: ticks(R.compass, 45, 20),
      inner: ticks(R.bracket - 10, 6, 4),
    }),
    [],
  )

  const segs = useMemo(() => {
    const n = Math.max(1, agents.length)
    const seg = 360 / n
    const gap = Math.min(4, seg * 0.12)
    return agents.map((a, i) => {
      const a0 = i * seg - seg / 2 + gap / 2
      const a1 = (i + 1) * seg - seg / 2 - gap / 2
      const mid = (a0 + a1) / 2
      const norm = ((mid % 360) + 360) % 360
      const bottom = norm > 90 && norm < 270
      return {
        a,
        ring: arc(R.agents, a0, a1),
        loadPath: arc(R.agentLoad, a0, a1),
        label: bottom ? arc(R.agentLoad - 13, a1, a0, false) : arc(R.agentLoad - 24, a0, a1),
        id: `${uid}-ag-${i}`,
      }
    })
  }, [agents, uid])

  const sweepPath = useMemo(() => {
    const [x0, y0] = polar(R.agents - 8, -28)
    const [x1, y1] = polar(R.agents - 8, 0)
    return `M0 0L${x0.toFixed(1)} ${y0.toFixed(1)}A${R.agents - 8} ${R.agents - 8} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}Z`
  }, [])

  const accent = 'var(--jx-accent)'
  const modeColor = mode === 'alarm' ? 'var(--jx-danger)' : mode === 'analyze' ? 'var(--jx-violet)' : accent

  return (
    <svg ref={root} viewBox="-500 -500 1000 1000" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full pointer-events-none overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-sweep`} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor={modeColor} stopOpacity="0" />
          <stop offset="1" stopColor={modeColor} stopOpacity="0.22" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* radar sweep */}
      {!reducedMotion && (
        <g ref={sweep}>
          <path d={sweepPath} fill={`url(#${uid}-sweep)`} />
          <line x1="0" y1="0" x2="0" y2={-(R.agents - 8)} stroke={modeColor} strokeOpacity="0.55" strokeWidth="1.5" />
        </g>
      )}

      {/* compass */}
      <g stroke={accent} fill="none">
        <circle className="rh-draw" r={R.compass} strokeOpacity="0.45" strokeWidth="1.2" />
        <path className="rh-fade" d={statics.minor} strokeOpacity="0.35" strokeWidth="1" />
        <path className="rh-fade" d={statics.mid} strokeOpacity="0.6" strokeWidth="1.4" />
        <path className="rh-fade" d={statics.major} strokeOpacity="0.95" strokeWidth="2.4" filter={`url(#${uid}-glow)`} />
      </g>
      {BEARINGS.map((b) => {
        const [x, y] = polar(R.compass - 36, b)
        return (
          <text
            key={b}
            className="rh-fade"
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={accent}
            fillOpacity="0.8"
            style={{ fontFamily: 'var(--jx-font-mono)', fontSize: 18, letterSpacing: 2 }}
          >
            {String(b).padStart(3, '0')}
          </text>
        )
      })}
      {BEARINGS.map((b) => {
        const [x, y] = polar(R.compass + 4, b)
        return <path key={`m${b}`} className="rh-pop" d="M0 0l-9 -14h18z" fill={accent} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${b + 180})`} filter={`url(#${uid}-glow)`} />
      })}

      {/* rotating arc triad */}
      <g ref={triple} stroke={accent} fill="none" strokeLinecap="round">
        {[0, 120, 240].map((a) => (
          <path key={a} className="rh-draw" d={arc(R.triple, a + 8, a + 64)} strokeWidth="2.6" strokeOpacity="0.85" filter={`url(#${uid}-glow)`} />
        ))}
        {[0, 120, 240].map((a) => (
          <path key={`t${a}`} className="rh-draw" d={arc(R.triple, a + 70, a + 76)} strokeWidth="6" strokeOpacity="0.6" />
        ))}
      </g>

      {/* counter-rotating dash ring */}
      <g ref={dash}>
        <circle className="rh-fade" r={R.dash} fill="none" stroke={accent} strokeOpacity="0.4" strokeWidth="7" strokeDasharray="1.5 9" />
        <path className="rh-draw" d={arc(R.dash, 200, 330)} fill="none" stroke={accent} strokeOpacity="0.35" strokeWidth="1" />
      </g>

      {/* agent ring */}
      <g>
        <circle className="rh-draw" r={R.agents} fill="none" stroke={accent} strokeOpacity="0.12" strokeWidth="12" />
        {segs.map(({ a, ring, loadPath, label, id }, i) => {
          const tone = CSS_TONE[STATUS_META[a.status].tone]
          const lit = a.status === 'running' || a.status === 'thinking' || a.status === 'error'
          return (
            <g key={a.id}>
              <title>{`${a.name}: ${STATUS_META[a.status].label}, obciążenie ${Math.round(a.load * 100)}%`}</title>
              {/* segments usually mount after the first snapshot, i.e. after the GSAP entrance: Motion draws them in */}
              <motion.path
                d={ring}
                fill="none"
                stroke={tone}
                strokeWidth="11"
                strokeOpacity={a.status === 'offline' ? 0.2 : 0.35 + a.load * 0.55}
                style={{ transition: 'stroke 0.4s, stroke-opacity 0.6s' }}
                filter={lit ? `url(#${uid}-glow)` : undefined}
                initial={reducedMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, delay: 0.25 + i * 0.06, ease: [0.6, 0, 0.2, 1] }}
              />
              <motion.path
                d={loadPath}
                fill="none"
                stroke={tone}
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: Math.max(0.02, Math.min(1, a.load)) }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
              />
              <path id={id} d={label} fill="none" stroke="none" />
              <text
                className="rh-fade"
                fill={lit ? tone : 'var(--jx-text-dim)'}
                style={{ fontFamily: 'var(--jx-font-label)', fontSize: 19, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', transition: 'fill 0.4s' }}
              >
                <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
                  {a.name}
                </textPath>
              </text>
            </g>
          )
        })}
      </g>

      {/* bracket gauges: mean load (left), success rate (right) */}
      <g fill="none" strokeLinecap="butt">
        <path className="rh-fade" d={statics.inner} stroke={accent} strokeOpacity="0.18" strokeWidth="1" />
        <path className="rh-draw" d={arc(R.bracket, 218, 322)} stroke={accent} strokeOpacity="0.16" strokeWidth="9" />
        <path ref={loadArc} d={arc(R.bracket, 218, 322)} stroke={load > 0.85 ? 'var(--jx-warn)' : accent} strokeWidth="9" filter={`url(#${uid}-glow)`} style={{ transition: 'stroke 0.4s' }} />
        <path className="rh-draw" d={arc(R.bracket, 142, 38, false)} stroke="var(--jx-ok)" strokeOpacity="0.14" strokeWidth="9" />
        <path ref={successArc} d={arc(R.bracket, 142, 38, false)} stroke={success !== null && success < 0.85 ? 'var(--jx-warn)' : 'var(--jx-ok)'} strokeWidth="9" filter={`url(#${uid}-glow)`} style={{ transition: 'stroke 0.4s' }} />
        {[218, 322, 142, 38].map((a) => {
          const [x0, y0] = polar(R.bracket - 14, a)
          const [x1, y1] = polar(R.bracket + 14, a)
          return <line key={a} className="rh-fade" x1={x0} y1={y0} x2={x1} y2={y1} stroke={accent} strokeOpacity="0.7" strokeWidth="1.5" />
        })}
      </g>
      {/* bracket readouts sit at the lower bracket ends, clear of the orbit band */}
      <g className="rh-fade" style={{ fontFamily: 'var(--jx-font-label)', fontWeight: 600, letterSpacing: 3 }}>
        <text x={LBL.x0} y={LBL.y} textAnchor="start" fill="var(--jx-text-dim)" style={{ fontSize: 17 }}>
          OBCIĄŻENIE
        </text>
        <text x={LBL.x0} y={LBL.y + 8} textAnchor="start" dominantBaseline="hanging" fill={load > 0.85 ? 'var(--jx-warn)' : accent} style={{ fontFamily: 'var(--jx-font-mono)', fontSize: 30, letterSpacing: 0 }}>
          {Math.round(load * 100)}%
        </text>
        <text x={-LBL.x0} y={LBL.y} textAnchor="end" fill="var(--jx-text-dim)" style={{ fontSize: 17 }}>
          SKUTECZNOŚĆ
        </text>
        <text x={-LBL.x0} y={LBL.y + 8} textAnchor="end" dominantBaseline="hanging" fill={success !== null && success < 0.85 ? 'var(--jx-warn)' : 'var(--jx-ok)'} style={{ fontFamily: 'var(--jx-font-mono)', fontSize: 30, letterSpacing: 0 }}>
          {success === null ? 'n/d' : `${(success * 100).toFixed(1)}%`}
        </text>
      </g>
    </svg>
  )
}
