import { useMemo } from 'react'
import * as echarts from 'echarts/core'
import { GaugeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import ReactEChartsCore from 'echarts-for-react/esm/core'

// Tree-shaken ECharts (Apache-2.0): only the gauge series + canvas renderer.
echarts.use([GaugeChart, CanvasRenderer])

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** near-white text tinted with the accent (follows the runtime hue instead of a fixed cyan white) */
function tintWhite(hex: string, amount = 0.12): string {
  const n = parseInt(hex.slice(1), 16)
  const m = (x: number) => Math.round(255 - (255 - x) * amount)
  return `rgb(${m((n >> 16) & 255)}, ${m((n >> 8) & 255)}, ${m(n & 255)})`
}

export interface EGaugeProps {
  /** null → API unavailable, rendered as "n/d" */
  value: number | null
  max: number
  /** text in the centre (already formatted) */
  display: string
  unit?: string
  accent: string
  /** colour override (warn / danger thresholds) */
  color?: string
  reducedMotion: boolean
  ariaLabel: string
}

/**
 * Dark, glowing HUD gauge (echarts-for-react). The ECharts instance is disposed by
 * echarts-for-react on unmount; the option is memoised so 1 Hz updates only animate the value.
 */
export function EGauge({ value, max, display, unit, accent, color, reducedMotion, ariaLabel }: EGaugeProps) {
  const c = color ?? accent
  const available = value !== null
  const option = useMemo(
    () => ({
      animation: !reducedMotion,
      animationDuration: 600,
      animationDurationUpdate: 700,
      animationEasingUpdate: 'cubicOut',
      series: [
        // decorative outer tick ring
        {
          type: 'gauge',
          startAngle: 225,
          endAngle: -45,
          radius: '98%',
          center: ['50%', '54%'],
          min: 0,
          max: 1,
          splitNumber: 10,
          axisLine: { show: false },
          progress: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          axisTick: { show: true, splitNumber: 4, length: 2, distance: 0, lineStyle: { color: rgba(accent, 0.35), width: 1 } },
          splitLine: { show: true, length: 5, distance: 0, lineStyle: { color: rgba(accent, 0.8), width: 1 } },
          axisLabel: { show: false },
          title: { show: false },
          detail: { show: false },
          data: [{ value: 0 }],
          silent: true,
        },
        // value arc
        {
          type: 'gauge',
          startAngle: 225,
          endAngle: -45,
          radius: '80%',
          center: ['50%', '54%'],
          min: 0,
          max,
          // progress stays enabled even without data: toggling `progress.show` on a live series
          // crashes ECharts' gauge diff (GaugeView keeps no previous progress list) – hide it via colour instead
          progress: {
            show: true,
            width: 6,
            itemStyle: available
              ? {
                  color: new echarts.graphic.LinearGradient(0, 1, 1, 0, [
                    { offset: 0, color: rgba(c, 0.35) },
                    { offset: 1, color: c },
                  ]),
                  shadowBlur: 12,
                  shadowColor: rgba(c, 0.9),
                }
              : { color: 'rgba(0,0,0,0)', shadowBlur: 0 },
          },
          axisLine: { lineStyle: { width: 6, color: [[1, rgba(accent, 0.1)]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: {
            show: true,
            offsetCenter: [0, '6%'],
            formatter: () => (available ? `{v|${display}}${unit ? `\n{u|${unit}}` : ''}` : '{nd|n/d}'),
            rich: {
              v: { fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 600, color: tintWhite(accent), textShadowBlur: 8, textShadowColor: c, lineHeight: 18 },
              u: { fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600, color: rgba(accent, 0.8), lineHeight: 12 },
              nd: { fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: rgba(accent, 0.5) },
            },
          },
          data: [{ value: available ? Math.max(0, Math.min(max, value)) : 0 }],
        },
        // inner hairline
        {
          type: 'gauge',
          startAngle: 0,
          endAngle: 360,
          radius: '56%',
          center: ['50%', '54%'],
          axisLine: { lineStyle: { width: 1, color: [[1, rgba(accent, 0.18)]] } },
          splitNumber: 12,
          axisTick: { show: false },
          splitLine: { show: true, length: 3, distance: -3, lineStyle: { color: rgba(accent, 0.45), width: 1 } },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          progress: { show: false },
          title: { show: false },
          detail: { show: false },
          data: [{ value: 0 }],
          silent: true,
        },
      ],
    }),
    [available, value, max, display, unit, accent, c, reducedMotion],
  )

  return (
    <div className="relative h-full w-full" role="meter" aria-label={ariaLabel} aria-valuemin={0} aria-valuemax={max} aria-valuenow={available ? value : undefined} aria-valuetext={available ? `${display}${unit ? ` ${unit}` : ''}` : 'niedostępne'}>
      <ReactEChartsCore echarts={echarts} option={option} lazyUpdate opts={{ renderer: 'canvas' }} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}
