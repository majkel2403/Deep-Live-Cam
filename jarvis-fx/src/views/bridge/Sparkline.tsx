import { useMemo, useState } from 'react'
import { AreaClosed, LinePath } from '@visx/shape'
import { scaleLinear } from '@visx/scale'

/**
 * Compact sparkline built with visx (@visx/shape + @visx/scale, MIT).
 * Stretches to its box (viewBox + non-scaling strokes); `null` samples create gaps.
 */
export function Sparkline({
  data,
  min,
  max,
  color = 'var(--jx-accent)',
  height = 28,
  capacity = 60,
  className = '',
  ariaLabel,
  threshold,
}: {
  data: (number | null)[]
  min?: number
  max?: number
  color?: string
  height?: number
  /** number of slots on the x axis (keeps the scroll speed constant while the buffer fills) */
  capacity?: number
  className?: string
  ariaLabel: string
  /** optional dashed reference line */
  threshold?: number
}) {
  const W = 200
  const H = 40
  const { pts, y, lo, hi } = useMemo(() => {
    const vals = data.filter((v): v is number => v !== null && Number.isFinite(v))
    const lo = min ?? (vals.length ? Math.min(...vals) : 0)
    let hi = max ?? (vals.length ? Math.max(...vals) : 1)
    if (hi - lo < 1e-6) hi = lo + 1
    const x = scaleLinear({ domain: [0, Math.max(1, capacity - 1)], range: [0, W] })
    const y = scaleLinear({ domain: [lo, hi], range: [H - 2, 2], clamp: true })
    const offset = capacity - data.length
    const pts = data.map((v, i) => ({ x: x(i + offset), v }))
    return { pts, y, lo, hi }
  }, [data, min, max, capacity])

  const [gid] = useState(() => `bx-spark-${Math.random().toString(36).slice(2, 8)}`)
  const last = [...pts].reverse().find((p) => p.v !== null)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`block w-full ${className}`} style={{ height }} role="img" aria-label={ariaLabel}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="var(--jx-line)" strokeOpacity={0.35} strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
      ))}
      {threshold !== undefined && threshold > lo && threshold < hi && (
        <line x1={0} x2={W} y1={y(threshold)} y2={y(threshold)} stroke="var(--jx-warn)" strokeOpacity={0.6} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      )}
      <AreaClosed
        data={pts}
        x={(d) => d.x}
        y={(d) => y(d.v ?? lo)}
        yScale={y}
        defined={(d) => d.v !== null}
        fill={`url(#${gid})`}
      />
      <LinePath data={pts} x={(d) => d.x} y={(d) => y(d.v ?? lo)} defined={(d) => d.v !== null} stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
      {/* zero-length round-capped line = a dot that is not distorted by the stretched viewBox */}
      {last && <line x1={last.x} x2={last.x} y1={y(last.v ?? lo)} y2={y(last.v ?? lo)} stroke={color} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
    </svg>
  )
}
