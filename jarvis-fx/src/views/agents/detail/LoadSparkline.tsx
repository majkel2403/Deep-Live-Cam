import { useId, useMemo } from 'react'
import { ParentSize } from '@visx/responsive'
import { scaleLinear } from '@visx/scale'
import { AreaClosed, LinePath } from '@visx/shape'
import { fmtPct } from '../model'

/**
 * Load-history sparkline built with visx (MIT): gradient area + glow line, an "overload"
 * threshold, faint time ticks and a blinking head marker at the newest sample.
 */
export interface LoadSparklineProps {
  history: number[]
  color: string
  accent: string
  /** load above which the band is tinted as overload */
  threshold?: number
}

interface Pt {
  i: number
  v: number
}

export function LoadSparkline({ history, color, accent, threshold = 0.8 }: LoadSparklineProps) {
  const last = history.length ? history[history.length - 1] : 0
  const peak = history.length ? Math.max(...history) : 0
  const mean = history.length ? history.reduce((s, v) => s + v, 0) / history.length : 0
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-baseline gap-3 whitespace-nowrap overflow-hidden">
        <span className="jx-label">Obciążenie</span>
        <span className="flex-1" />
        <span className="jx-label text-[0.6rem]">
          śr. <span className="jx-num text-jx-text">{fmtPct(mean)}</span>
        </span>
        <span className="jx-label text-[0.6rem] hidden min-[1400px]:inline max-xl:inline">
          szczyt <span className="jx-num text-jx-text">{fmtPct(peak)}</span>
        </span>
        <span className="jx-num text-sm jx-glow-text" style={{ color }}>
          {fmtPct(last)}
        </span>
      </div>
      <div className="flex-1 min-h-0 relative" role="img" aria-label={`Historia obciążenia: ${history.length} próbek, ostatnia ${fmtPct(last)}, szczyt ${fmtPct(peak)}`}>
        <ParentSize debounceTime={50}>{({ width, height }) => (width > 0 && height > 0 ? <Chart width={width} height={height} history={history} color={color} accent={accent} threshold={threshold} /> : null)}</ParentSize>
      </div>
    </div>
  )
}

function Chart({ width, height, history, color, accent, threshold }: { width: number; height: number; history: number[]; color: string; accent: string; threshold: number }) {
  const gid = useId().replace(/:/g, '')
  const data = useMemo<Pt[]>(() => history.map((v, i) => ({ i, v })), [history])
  const pad = 3
  const x = useMemo(() => scaleLinear<number>({ domain: [0, Math.max(1, data.length - 1)], range: [pad, width - pad] }), [data.length, width])
  const y = useMemo(() => scaleLinear<number>({ domain: [0, 1], range: [height - pad, pad] }), [height])
  const head = data[data.length - 1]
  const ty = y(threshold)
  return (
    <svg width={width} height={height} className="block overflow-visible">
      <defs>
        <linearGradient id={`${gid}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.42} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        <filter id={`${gid}-glow`} x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* overload band + vertical time ticks */}
      <rect x={0} y={0} width={width} height={Math.max(0, ty)} fill="var(--jx-danger)" opacity={0.06} />
      <line x1={0} x2={width} y1={ty} y2={ty} stroke="var(--jx-danger)" strokeOpacity={0.5} strokeDasharray="3 3" />
      {Array.from({ length: 9 }, (_, k) => (
        <line key={k} x1={(width / 8) * k} x2={(width / 8) * k} y1={height - 4} y2={height} stroke={accent} strokeOpacity={0.35} />
      ))}
      <line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke={accent} strokeOpacity={0.25} />
      {data.length > 1 && (
        <>
          <AreaClosed<Pt> data={data} x={(d) => x(d.i)} y={(d) => y(d.v)} yScale={y} fill={`url(#${gid}-fill)`} />
          <LinePath<Pt> data={data} x={(d) => x(d.i)} y={(d) => y(d.v)} stroke={color} strokeWidth={1.5} filter={`url(#${gid}-glow)`} />
        </>
      )}
      {head && (
        <g transform={`translate(${x(head.i)},${y(head.v)})`}>
          <circle r={5} fill={color} opacity={0.25} className="ag-blink" />
          <circle r={2.2} fill="#fff" />
        </g>
      )}
      <text x={width - 2} y={Math.max(9, ty - 3)} textAnchor="end" className="ag-svg-label" fill="var(--jx-danger)" opacity={0.75}>
        PRZECIĄŻENIE {Math.round(threshold * 100)}%
      </text>
    </svg>
  )
}
