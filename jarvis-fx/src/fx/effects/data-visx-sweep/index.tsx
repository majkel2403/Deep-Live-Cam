import { useEffect, useMemo, useRef, useState } from 'react'
import { Group } from '@visx/group'
import { scaleBand, scaleRadial } from '@visx/scale'
import { Arc } from '@visx/shape'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { DemoBadge, HudChrome } from '../hud-kit/HudChrome'
import { hexA, rng, SEM } from '../hud-kit/color'
import { useSize } from '../hud-kit/useSize'
import { LBL } from '../hud-kit/ui'

/**
 * visx radial bar chart: scaleBand maps channels to angles, scaleRadial maps values to radii and
 * @visx/shape <Arc> draws each bar. React renders the geometry only when data changes (~1 Hz);
 * the sweep and per-bar highlight run in a rAF that mutates SVG attributes directly.
 * Values drift as a seeded random walk → DEMO.
 */

const TAU = Math.PI * 2

function seedValues(n: number): number[] {
  const r = rng(31)
  return Array.from({ length: n }, (_, i) => 0.22 + 0.32 * Math.abs(Math.sin(i * 0.37)) + r() * 0.16 + (r() < 0.08 ? 0.3 : 0))
}

export default function VisxSweep({ accent, accent2, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    channels: { value: 48, min: 16, max: 96, step: 4, label: 'kanały' },
    rpm: { value: 10, min: 1, max: 40, step: 1, label: 'obroty / min' },
    inner: { value: 0.32, min: 0.1, max: 0.6, step: 0.01, label: 'promień wewn.' },
    afterglow: { value: 70, min: 10, max: 200, step: 5, label: 'poświata (°)' },
    labels: { value: true, label: 'etykiety' },
  })
  const n = stage ? c.channels : Math.min(36, c.channels)
  const [ref, size] = useSize<HTMLDivElement>()
  // seeded random walk (~1 Hz); re-seeded whenever the channel count changes
  const [walk, setWalk] = useState(() => ({ n, values: seedValues(n) }))
  const values = useMemo(() => (walk.n === n ? walk.values : seedValues(n)), [walk, n])
  useEffect(() => {
    if (paused) return
    const r = rng((Date.now() & 0xffff) + 1)
    const id = setInterval(
      () =>
        setWalk((s) => ({
          n,
          values: (s.n === n ? s.values : seedValues(n)).map((v) => Math.max(0.08, Math.min(1, v + (r() - 0.5) * 0.1 + (0.45 - v) * 0.05 + (r() < 0.015 ? 0.35 : 0)))),
        })),
      1100,
    )
    return () => clearInterval(id)
  }, [paused, n])

  const w = size.width
  const h = size.height
  const outer = Math.max(20, Math.min(w, h - (stage ? 90 : 30)) / 2 - (stage ? 34 : 6))
  const innerR = outer * c.inner
  const ids = useMemo(() => Array.from({ length: n }, (_, i) => i), [n])
  const xScale = useMemo(() => scaleBand<number>({ domain: ids, range: [0, TAU], padding: 0.42 }), [ids])
  const yScale = useMemo(() => scaleRadial<number>({ domain: [0, 1], range: [innerR, outer] }), [innerR, outer])

  const barRefs = useRef<(SVGPathElement | null)[]>([])
  const sweepRef = useRef<SVGGElement>(null)
  const readRef = useRef<{ ch: HTMLSpanElement | null; val: HTMLSpanElement | null }>({ ch: null, val: null })
  const valsRef = useRef(values)
  useEffect(() => {
    valsRef.current = values
  }, [values])

  // sweep + highlight loop (no React state per frame)
  const clock = useRef(0)
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastIdx = -1
    const glow = (c.afterglow * Math.PI) / 180
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (!paused) clock.current += dt * (reducedMotion ? 0.25 : 1)
      const ang = (((clock.current * c.rpm) / 60) * TAU) % TAU
      sweepRef.current?.setAttribute('transform', `rotate(${(ang * 180) / Math.PI})`)
      const bw = xScale.bandwidth()
      let idx = -1
      for (let i = 0; i < n; i++) {
        const el = barRefs.current[i]
        if (!el) continue
        const mid = (xScale(i) ?? 0) + bw / 2
        const behind = (ang - mid + TAU) % TAU // how far the beam has passed this bar
        const lit = behind < glow ? 1 - behind / glow : 0
        if (behind < bw * 1.2 && idx < 0) idx = i
        el.style.opacity = String(0.38 + 0.62 * lit)
        el.style.filter = lit > 0.85 ? 'url(#vxs-glow)' : ''
      }
      if (idx >= 0 && idx !== lastIdx) {
        lastIdx = idx
        const v = valsRef.current[idx] ?? 0
        if (readRef.current.ch) readRef.current.ch.textContent = `CH-${String(idx + 1).padStart(2, '0')}`
        if (readRef.current.val) readRef.current.val.textContent = `${Math.round(v * 100)}`
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [n, xScale, c.rpm, c.afterglow, paused, reducedMotion])

  const colorOf = (v: number) => (v > 0.92 ? SEM.danger : v > 0.8 ? SEM.warn : v > 0.6 ? accent2 : accent)
  const ticks = [0.25, 0.5, 0.75, 1]

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_center,var(--jx-accent-faint),transparent_60%)]">
      {w > 0 && (
        <svg width={w} height={h} className="absolute inset-0" role="img" aria-label={`Radialny wykres ${n} kanałów z obracającą się wiązką (dane demonstracyjne)`}>
          <defs>
            <filter id="vxs-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="vxs-beam" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform={`scale(${outer})`}>
              <stop offset="0" stopColor={accent} stopOpacity="0" />
              <stop offset="1" stopColor={accent} stopOpacity="0.2" />
            </radialGradient>
          </defs>
          <Group top={h / 2 + (stage ? 4 : 6)} left={w / 2}>
            {/* radial grid */}
            {ticks.map((t) => (
              <circle key={t} r={yScale(t)} fill="none" stroke={hexA(accent, t === 1 ? 0.45 : 0.15)} strokeDasharray={t === 1 ? undefined : '2 4'} />
            ))}
            <circle r={innerR - 4} fill="none" stroke={hexA(accent, 0.5)} />
            {stage &&
              ticks.map((t) => (
                <text key={`l${t}`} x={3} y={-yScale(t) + 10} fill={hexA(accent, 0.55)} fontSize={9} fontFamily="JetBrains Mono, monospace">
                  {Math.round(t * 100)}
                </text>
              ))}

            {/* bars */}
            {values.map((v, i) => {
              const a0 = xScale(i) ?? 0
              return (
                <g key={i}>
                <Arc
                  innerRadius={yScale(v) + 2}
                  outerRadius={yScale(v) + 4}
                  startAngle={a0}
                  endAngle={a0 + xScale.bandwidth()}
                  fill={hexA(colorOf(v), 0.9)}
                />
                <Arc
                  innerRef={(el) => {
                    barRefs.current[i] = el
                  }}
                  innerRadius={innerR}
                  outerRadius={yScale(v)}
                  startAngle={a0}
                  endAngle={a0 + xScale.bandwidth()}
                  cornerRadius={1}
                  fill={colorOf(v)}
                  style={{ opacity: 0.4 }}
                />
                </g>
              )
            })}

            {/* sweep wedge (rotated by the rAF loop) */}
            <g ref={sweepRef}>
              <Arc innerRadius={innerR - 2} outerRadius={outer + 8} startAngle={-(c.afterglow * Math.PI) / 180 / 2.4} endAngle={0} fill="url(#vxs-beam)" style={{ mixBlendMode: 'screen' }} pointerEvents="none" />
              <line x1={0} y1={-innerR + 2} x2={0} y2={-outer - 14} stroke={accent2} strokeWidth={1.5} />
            </g>

            {/* channel labels */}
            {stage &&
              c.labels &&
              ids
                .filter((i) => i % Math.max(1, Math.round(n / 16)) === 0)
                .map((i) => {
                  const a = (xScale(i) ?? 0) + xScale.bandwidth() / 2
                  const r = outer + 20
                  return (
                    <text
                      key={`c${i}`}
                      x={Math.sin(a) * r}
                      y={-Math.cos(a) * r}
                      fill={hexA(accent, 0.7)}
                      fontSize={9}
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </text>
                  )
                })}
          </Group>
        </svg>
      )}

      {/* centre readout of the channel under the beam */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ marginTop: stage ? 4 : 6 }} aria-hidden="true">
        <span
          ref={(el) => {
            readRef.current.ch = el
          }}
          className={`${LBL} ${stage ? 'text-[0.65rem]' : 'text-[0.45rem]'} text-jx-accent`}
        >
          CH-01
        </span>
        <span
          ref={(el) => {
            readRef.current.val = el
          }}
          className={`jx-num jx-glow-text leading-none text-jx-text ${stage ? 'text-3xl' : 'text-[0.8rem]'}`}
        >
          —
        </span>
        {stage && <span className={`${LBL} text-[0.55rem]`}>poziom %</span>}
      </div>

      <HudChrome
        code="RAD-09 · VISX"
        title="Skaner kanałów"
        stage={stage}
        badges={<DemoBadge title="Poziomy kanałów to syntetyczny, dryfujący szereg losowy" />}
        footer={
          stage ? (
            <>
              <span className={`${LBL} text-[0.6rem]`}>
                Kanały <span className="jx-num text-jx-accent">{n}</span> · {c.rpm} obr/min
              </span>
              <span className="flex-1" />
              <span className={`${LBL} text-[0.6rem]`}>
                <span style={{ color: accent }}>■</span> &lt;60 <span style={{ color: accent2 }}>■</span> 60–80 <span style={{ color: SEM.warn }}>■</span> 80–92 <span style={{ color: SEM.danger }}>■</span> &gt;92
              </span>
            </>
          ) : undefined
        }
      />
    </div>
  )
}
