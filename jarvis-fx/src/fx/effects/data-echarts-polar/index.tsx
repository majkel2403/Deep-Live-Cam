import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts/core'
import { EffectScatterChart, LineChart, ScatterChart } from 'echarts/charts'
import { PolarComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { DemoBadge, HudChrome } from '../hud-kit/HudChrome'
import { hexA, rng, SEM } from '../hud-kit/color'
import { LBL } from '../hud-kit/ui'

echarts.use([PolarComponent, LineChart, ScatterChart, EffectScatterChart, CanvasRenderer])

/**
 * Polar "orbital plot". The static option (axes, styles) is memoised; motion comes from a throttled
 * rAF that pushes only series data through `chart.setOption(…, { lazyUpdate })` with animation off
 * for those series – one canvas, no React re-render per frame. Orbits are synthetic → DEMO.
 */

interface Sat {
  name: string
  r: number // orbit radius (j.a.)
  w: number // deg / s
  phase: number
  ecc: number
  col: 'a' | 'b' | 'ok' | 'warn'
}

const TRAIL = 26

function makeSats(n: number): Sat[] {
  const r = rng(2024)
  const cols: Sat['col'][] = ['a', 'b', 'a', 'ok', 'b', 'warn', 'a', 'b']
  return Array.from({ length: n }, (_, i) => ({
    name: `SAT-${String(i + 1).padStart(2, '0')}`,
    r: 2 + i * (7.4 / Math.max(1, n - 1)) + r() * 0.4,
    w: (60 / Math.pow(1.6 + i, 1.1)) * (r() < 0.25 ? -1 : 1),
    phase: r() * 360,
    ecc: 0.04 + r() * 0.12,
    col: cols[i % cols.length],
  }))
}

const pos = (s: Sat, t: number): [number, number] => {
  const a = s.phase + s.w * t
  return [s.r * (1 + s.ecc * Math.cos((a * Math.PI) / 180)), ((a % 360) + 360) % 360]
}

export default function EchartsPolar({ accent, accent2, reducedMotion, stage, paused, quality }: FxProps) {
  const c = useFxControls({
    satellites: { value: 6, min: 2, max: 8, step: 1, label: 'satelity' },
    speed: { value: 1, min: 0, max: 4, step: 0.1, label: 'prędkość' },
    petals: { value: 5, min: 2, max: 9, step: 1, label: 'płatki' },
    trails: { value: true, label: 'smugi' },
  })
  const count = stage ? c.satellites : Math.min(4, c.satellites)
  const sats = useMemo(() => makeSats(count), [count])
  // echarts-for-react first creates a temporary instance, disposes it and re-inits before applying
  // `option`; data pushes must wait for onChartReady or they hit a chart without our series.
  const chartRef = useRef<echarts.ECharts | null>(null)
  const pushRef = useRef<() => void>(() => {})
  const colOf = (k: Sat['col']) => (k === 'a' ? accent : k === 'b' ? accent2 : k === 'ok' ? SEM.ok : SEM.warn)

  const option = useMemo(() => {
    const small = !stage
    const mono = '"JetBrains Mono", monospace'
    const debrisR = rng(7)
    const debris = Array.from({ length: small ? 40 : 120 }, () => [debrisR() * 10, debrisR() * 360])
    return {
      animation: false,
      polar: { radius: small ? ['0%', '82%'] : ['0%', '76%'], center: ['50%', small ? '54%' : '53%'] },
      angleAxis: {
        type: 'value',
        min: 0,
        max: 360,
        startAngle: 90,
        clockwise: true,
        interval: 30,
        axisLine: { lineStyle: { color: hexA(accent, 0.7) } },
        axisTick: { show: !small, length: 6, lineStyle: { color: hexA(accent, 0.7) } },
        minorTick: { show: !small, splitNumber: 6, length: 3, lineStyle: { color: hexA(accent, 0.35) } },
        axisLabel: { show: !small, color: hexA(accent, 0.8), fontFamily: mono, fontSize: 10, formatter: (v: number) => `${String(v).padStart(3, '0')}°` },
        splitLine: { show: true, lineStyle: { color: hexA(accent, 0.1), type: 'dashed' } },
      },
      radiusAxis: {
        type: 'value',
        min: 0,
        max: 10,
        interval: 2,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: !small, color: hexA(accent, 0.55), fontFamily: mono, fontSize: 9, formatter: (v: number) => (v ? `${v}` : '') },
        splitLine: { show: true, lineStyle: { color: hexA(accent, 0.22) } },
      },
      series: [
        { id: 'debris', type: 'scatter', coordinateSystem: 'polar', symbolSize: 1.6, silent: true, itemStyle: { color: hexA(accent, 0.35) }, data: debris },
        {
          id: 'rose',
          type: 'line',
          coordinateSystem: 'polar',
          smooth: true,
          showSymbol: false,
          silent: true,
          lineStyle: { color: accent2, width: small ? 1 : 1.5, opacity: 0.85 },
          areaStyle: { color: hexA(accent2, 0.08) },
          data: [],
        },
        ...sats.map((s, i) => ({
          id: `trail-${i}`,
          type: 'line',
          coordinateSystem: 'polar',
          showSymbol: false,
          silent: true,
          smooth: true,
          lineStyle: { color: colOf(s.col), width: small ? 1.2 : 2, opacity: 0.55 },
          data: [],
        })),
        {
          id: 'sats',
          type: 'effectScatter',
          coordinateSystem: 'polar',
          symbolSize: small ? 5 : 8,
          rippleEffect: { brushType: 'stroke', scale: 3.2, period: 2.4, number: 2 },
          showEffectOn: 'render',
          label: {
            show: !small,
            formatter: (p: { name: string }) => p.name,
            position: 'right',
            color: '#d7f6ff',
            fontFamily: 'Rajdhani, sans-serif',
            fontWeight: 600,
            fontSize: 11,
          },
          itemStyle: { color: (p: { dataIndex: number }) => colOf(sats[p.dataIndex]?.col ?? 'a') },
          data: [],
        },
      ],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, sats, accent, accent2])

  // per-frame data push (throttled)
  const clock = useRef(0)
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let acc = 0
    const fps = stage ? (quality === 'low' ? 24 : 40) : 15
    const push = () => {
      const chart = chartRef.current
      if (!chart || chart.isDisposed()) return
      const t = clock.current
      const k = c.petals
      const rose: [number, number][] = []
      for (let a = 0; a <= 360; a += 3) rose.push([3.2 + 1.6 * Math.sin(((k * a + t * 40) * Math.PI) / 180) * Math.cos(((a - t * 25) * Math.PI) / 180) ** 2, a])
      const series: Record<string, unknown>[] = [{ id: 'rose', data: rose }]
      sats.forEach((s, i) => {
        const trail: [number, number][] = []
        if (c.trails) for (let j = TRAIL; j >= 0; j--) trail.push(pos(s, t - (j * 42) / TRAIL / Math.abs(s.w))) // ~42° tail behind each satellite
        series.push({ id: `trail-${i}`, data: unwrap(trail) })
      })
      series.push({ id: 'sats', data: sats.map((s) => ({ name: s.name, value: pos(s, t) })) })
      chart.setOption({ series }, { lazyUpdate: true, silent: true })
    }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      acc += dt
      if (acc < 1 / fps) return
      clock.current += acc * c.speed * (reducedMotion ? 0.2 : 1)
      acc = 0
      push()
    }
    // initial frame (also covers paused cards); no rAF is scheduled at all while paused
    pushRef.current = push
    const first = setTimeout(push, 50)
    if (!paused) raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(first)
      pushRef.current = () => {}
    }
  }, [sats, c.speed, c.petals, c.trails, paused, reducedMotion, stage, quality, option])

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_53%,var(--jx-accent-faint),transparent_60%)]">
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        onChartReady={(inst: echarts.ECharts) => {
          chartRef.current = inst
          pushRef.current()
        }}
        notMerge
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
      <span className="sr-only">{`Biegunowy wykres orbitalny: ${sats.length} satelitów krąży po orbitach ze smugami wokół animowanej rozety o ${c.petals} płatkach – dane demonstracyjne.`}</span>
      <HudChrome
        code="ORB-07 · POLAR"
        title="Plot orbitalny"
        stage={stage}
        badges={<DemoBadge title="Orbity i satelity są syntetyczne – wizualizacja demonstracyjna" />}
        footer={
          stage ? (
            <>
              <span className={`${LBL} text-[0.6rem]`}>Promień: j.a. (umowne)</span>
              <span className={`${LBL} text-[0.6rem]`}>Kąt: 0–360°</span>
              <span className="flex-1" />
              <span className={`${LBL} text-[0.6rem]`}>
                Satelity <span className="jx-num text-jx-accent">{sats.length}</span> · rozeta k=<span className="jx-num text-jx-accent">{c.petals}</span>
              </span>
            </>
          ) : undefined
        }
      />
    </div>
  )
}

/** keep a trail monotonic in angle so the smooth line never jumps across 0°/360° */
function unwrap(pts: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && Math.abs(pts[i][1] - pts[i - 1][1]) > 180) {
      // start a fresh segment: drop the earlier part
      out.length = 0
    }
    out.push(pts[i])
  }
  return out
}
