import { useEffect, useMemo, useState } from 'react'
import * as echarts from 'echarts/core'
import { GaugeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { DemoBadge, HudChrome } from '../hud-kit/HudChrome'
import { hexA, SEM } from '../hud-kit/color'
import { useSize } from '../hud-kit/useSize'
import { LBL } from '../hud-kit/ui'

// Tree-shaken ECharts (Apache-2.0): gauge series + canvas renderer only.
echarts.use([GaugeChart, CanvasRenderer])

/**
 * Gauge cluster in ONE ECharts instance (several gauge series with pixel centres computed from the
 * container), so the whole dashboard costs a single canvas. Values are a synthetic random walk,
 * clearly marked DEMO. echarts-for-react disposes the instance on unmount.
 */

interface Vals {
  power: number // 0..120
  sync: number // 0..100
  temp: number // 0..3000
  shield: number // 0..100
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
function walk(v: Vals): Vals {
  const r = () => Math.random() - 0.5
  return {
    power: clamp(v.power + r() * 22 + (72 - v.power) * 0.12, 8, 118),
    sync: clamp(v.sync + r() * 9 + (88 - v.sync) * 0.1, 30, 100),
    temp: clamp(v.temp + r() * 260 + (1650 - v.temp) * 0.08, 400, 2950),
    shield: clamp(v.shield + r() * 10 + (76 - v.shield) * 0.1, 10, 100),
  }
}

export default function EchartsGauges({ accent, accent2, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    interval: { value: 1.2, min: 0.4, max: 5, step: 0.1, label: 'takt (s)' },
    glow: { value: 0.6, min: 0, max: 1, step: 0.05, label: 'poświata' },
    blur: { value: false, label: 'cienie' },
    ease: { value: 900, min: 100, max: 2500, step: 50, label: 'anim. ms' },
    ticks: { value: true, label: 'podziałka' },
  })
  const [vals, setVals] = useState<Vals>({ power: 64, sync: 82, temp: 1480, shield: 71 })
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setVals(walk), c.interval * 1000)
    return () => clearInterval(id)
  }, [paused, c.interval])

  const [ref, size] = useSize<HTMLDivElement>()
  const w = size.width
  const h = size.height

  const option = useMemo(() => {
    if (!w || !h) return {}
    const small = !stage
    const font = 'Orbitron, Michroma, sans-serif'
    const mono = '"JetBrains Mono", monospace'
    const top = small ? 18 : 64
    const bottom = small ? 4 : 44
    const availH = h - top - bottom
    const R = Math.max(30, Math.min(w * 0.22, availH * 0.5))
    const cx = w / 2
    const cy = top + availH * (small ? 0.6 : 0.53)
    const r2 = Math.max(18, Math.min(w * 0.115, availH * 0.3))
    const side = Math.min(w * 0.36, R + r2 * 1.32 + (small ? 6 : 26))
    // Real canvas shadowBlur is expensive (especially on software rasterisers), so the default glow
    // is faked with a wider translucent "halo" series under each arc; true shadows are opt-in.
    const glow = c.glow
    const shadow = (col: string) => (c.blur && !small ? { shadowBlur: 14, shadowColor: hexA(col, 0.9) } : {})
    const halo = (center: [number, number], radius: number, start: number, end: number, max: number, value: number, width: number, col: string) => ({
      type: 'gauge',
      center,
      radius,
      startAngle: start,
      endAngle: end,
      min: 0,
      max,
      silent: true,
      progress: { show: true, width, itemStyle: { color: hexA(col, 0.16 * glow) } },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { show: false },
      anchor: { show: false },
      title: { show: false },
      detail: { show: false },
      data: [{ value }],
    })
    const tempCol = vals.temp > 2400 ? SEM.danger : vals.temp > 2000 ? SEM.warn : accent2
    const shieldCol = vals.shield < 30 ? SEM.danger : vals.shield < 50 ? SEM.warn : SEM.ok

    const ring = (center: [number, number], radius: number, start: number, end: number, n: number, col: string) => ({
      type: 'gauge',
      center,
      radius,
      startAngle: start,
      endAngle: end,
      min: 0,
      max: 1,
      splitNumber: n,
      silent: true,
      axisLine: { show: false },
      progress: { show: false },
      pointer: { show: false },
      anchor: { show: false },
      axisTick: { show: c.ticks, splitNumber: 5, length: small ? 2 : 4, distance: 0, lineStyle: { color: hexA(col, 0.35), width: 1 } },
      splitLine: { show: c.ticks, length: small ? 4 : 9, distance: 0, lineStyle: { color: hexA(col, 0.85), width: small ? 1 : 1.5 } },
      axisLabel: { show: false },
      title: { show: false },
      detail: { show: false },
      data: [{ value: 0 }],
    })

    const main = {
      type: 'gauge',
      center: [cx, cy],
      radius: R * 0.86,
      startAngle: 220,
      endAngle: -40,
      min: 0,
      max: 120,
      splitNumber: 6,
      progress: {
        show: true,
        width: small ? 6 : 14,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 1, 1, 0, [
            { offset: 0, color: hexA(accent, 0.55) },
            { offset: 1, color: accent2 },
          ]),
          ...shadow(accent),
        },
      },
      axisLine: { lineStyle: { width: small ? 6 : 14, color: [[1, hexA(accent, 0.1)]] } },
      axisTick: { show: !small, distance: -(small ? 6 : 14) - 2, length: 4, lineStyle: { color: hexA(accent, 0.5) } },
      splitLine: { show: !small, distance: -(small ? 6 : 14) - 2, length: 10, lineStyle: { color: accent, width: 1.5 } },
      axisLabel: { show: !small, distance: 22, color: hexA(accent, 0.75), fontFamily: mono, fontSize: 10 },
      pointer: {
        show: true,
        icon: 'path://M2 0 L4 100 L0 100 Z',
        length: '62%',
        width: small ? 3 : 5,
        offsetCenter: [0, '-12%'],
        itemStyle: { color: accent2, ...shadow(accent2) },
      },
      anchor: { show: true, size: small ? 6 : 12, showAbove: true, itemStyle: { color: '#02060c', borderColor: accent2, borderWidth: 2 } },
      title: { show: !small, offsetCenter: [0, '58%'], color: hexA(accent, 0.75), fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 12 },
      detail: {
        valueAnimation: !reducedMotion,
        offsetCenter: [0, small ? '62%' : '36%'],
        formatter: (v: number) => (small ? `${v.toFixed(0)}` : `{v|${v.toFixed(1)}}{u| GW}`),
        color: '#e8fbff',
        fontFamily: small ? mono : font,
        fontSize: small ? 11 : 30,
        rich: { v: { fontFamily: font, fontSize: 30, color: '#e8fbff' }, u: { fontFamily: mono, fontSize: 12, color: hexA(accent, 0.8) } },
        textShadowColor: hexA(accent, 0.9),
        textShadowBlur: c.blur ? 10 : 0,
      },
      data: [{ value: vals.power, name: 'PRZEPŁYW MOCY' }],
    }

    const inner = {
      type: 'gauge',
      center: [cx, cy],
      radius: R * 0.56,
      startAngle: 220,
      endAngle: -40,
      min: 0,
      max: 100,
      progress: { show: true, width: small ? 2 : 4, itemStyle: { color: accent, ...shadow(accent) } },
      axisLine: { lineStyle: { width: small ? 2 : 4, color: [[1, hexA(accent, 0.12)]] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { show: false },
      anchor: { show: false },
      title: { show: false },
      detail: { show: !small, offsetCenter: [0, '128%'], formatter: (v: number) => `SYNCHRONIZACJA ${v.toFixed(0)}%`, color: accent, fontFamily: mono, fontSize: 11, valueAnimation: !reducedMotion },
      data: [{ value: vals.sync, name: '' }],
    }

    const sideGauge = (x: number, value: number, max: number, name: string, unit: string, col: string, fmt: (v: number) => string) => ({
      type: 'gauge',
      center: [x, cy + R * 0.08],
      radius: r2,
      startAngle: 210,
      endAngle: -30,
      min: 0,
      max,
      splitNumber: 5,
      progress: { show: true, width: small ? 4 : 8, itemStyle: { color: col, ...shadow(col) } },
      axisLine: { lineStyle: { width: small ? 4 : 8, color: [[1, hexA(col, 0.1)]] } },
      axisTick: { show: false },
      splitLine: { show: !small, distance: -(small ? 4 : 8) - 2, length: 6, lineStyle: { color: hexA(col, 0.8), width: 1 } },
      axisLabel: { show: false },
      pointer: { show: false },
      anchor: { show: false },
      title: { show: !small, offsetCenter: [0, '78%'], color: hexA(col, 0.75), fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11 },
      detail: {
        valueAnimation: !reducedMotion,
        offsetCenter: [0, small ? '10%' : '4%'],
        formatter: (v: number) => (small ? fmt(v) : `{v|${fmt(v)}}\n{u|${unit}}`),
        color: '#e8fbff',
        fontFamily: small ? mono : font,
        fontSize: small ? 10 : 18,
        lineHeight: 22,
        rich: { v: { fontFamily: font, fontSize: 18, color: '#e8fbff' }, u: { fontFamily: mono, fontSize: 10, color: hexA(col, 0.8) } },
      },
      data: [{ value, name }],
    })

    return {
      animation: !reducedMotion,
      animationDurationUpdate: c.ease,
      animationEasingUpdate: 'cubicOut',
      series: [
        ring([cx, cy], R, 220, -40, 24, accent),
        ...(glow > 0 ? [halo([cx, cy], R * 0.86 + (small ? 3 : 6), 220, -40, 120, vals.power, small ? 12 : 28, accent2)] : []),
        main,
        ...(glow > 0 ? [halo([cx, cy], R * 0.56 + 2, 220, -40, 100, vals.sync, small ? 6 : 12, accent)] : []),
        inner,
        ring([cx - side, cy + R * 0.08], r2 * 1.16, 210, -30, 10, tempCol),
        ...(glow > 0 ? [halo([cx - side, cy + R * 0.08], r2 + (small ? 2 : 4), 210, -30, 3000, vals.temp, small ? 8 : 18, tempCol)] : []),
        sideGauge(cx - side, vals.temp, 3000, 'TEMP. RDZENIA', '°C', tempCol, (v) => v.toFixed(0)),
        ring([cx + side, cy + R * 0.08], r2 * 1.16, 210, -30, 10, shieldCol),
        ...(glow > 0 ? [halo([cx + side, cy + R * 0.08], r2 + (small ? 2 : 4), 210, -30, 100, vals.shield, small ? 8 : 18, shieldCol)] : []),
        sideGauge(cx + side, vals.shield, 100, 'OSŁONY', '%', shieldCol, (v) => v.toFixed(0)),
      ],
    }
  }, [w, h, stage, vals, accent, accent2, reducedMotion, c.glow, c.blur, c.ease, c.ticks])

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_50%_55%,var(--jx-accent-faint),transparent_65%)]">
      {w > 0 && (
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          opts={{ renderer: 'canvas' }}
          notMerge={false}
          lazyUpdate
        />
      )}
      <span className="sr-only" role="status">
        {`Moc ${vals.power.toFixed(1)} GW, synchronizacja ${vals.sync.toFixed(0)}%, temperatura rdzenia ${vals.temp.toFixed(0)} °C, osłony ${vals.shield.toFixed(0)}% – dane demonstracyjne`}
      </span>
      <HudChrome
        code="GAU-06 · ZEGARY"
        title="Klaster wskaźników"
        stage={stage}
        badges={<DemoBadge title="Wartości zegarów to syntetyczny błądzący szereg – nie są pomiarem" />}
        footer={stage ? <span className={`${LBL} text-[0.6rem]`}>ECharts 6 · jedna instancja canvas · serie gauge + halo · odświeżanie co {c.interval.toFixed(1)} s</span> : undefined}
      />
    </div>
  )
}
