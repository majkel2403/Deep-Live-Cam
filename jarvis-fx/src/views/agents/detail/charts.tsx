import { useMemo } from 'react'
import * as echarts from 'echarts/core'
import { GaugeChart, RadarChart } from 'echarts/charts'
import { RadarComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import { SKILL_AXES, type SkillAxis } from '@/lib/agents'
import { hexA, tintWhite } from '../hooks'

/**
 * Tree-shaken ECharts 6 (Apache-2.0) via echarts-for-react (MIT): radar + gauge series and the
 * canvas renderer only. echarts-for-react disposes the instance on unmount and auto-resizes.
 * Options are memoised so the 1 Hz snapshot stream only animates values, not the whole chart.
 */
echarts.use([RadarChart, GaugeChart, RadarComponent, CanvasRenderer])

const FONT_LABEL = 'Rajdhani, "Chakra Petch", sans-serif'
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace'

/* ------------------------------------------------------------------ radar */

export interface SkillRadarProps {
  skills: Record<SkillAxis, number>
  team: Record<SkillAxis, number>
  name: string
  accent: string
  accent2: string
  reduced: boolean
}

export function SkillRadar({ skills, team, name, accent, accent2, reduced }: SkillRadarProps) {
  // value signatures: snapshots arrive as fresh objects every tick, only re-option on real change
  const skillKey = SKILL_AXES.map((x) => skills[x.id].toFixed(3)).join(',')
  const teamKey = SKILL_AXES.map((x) => team[x.id].toFixed(3)).join(',')
  const option = useMemo(
    () => ({
      animation: !reduced,
      animationDurationUpdate: 650,
      animationEasingUpdate: 'cubicOut',
      radar: {
        indicator: SKILL_AXES.map((x) => ({ name: x.label.toUpperCase(), max: 1 })),
        radius: '66%',
        center: ['50%', '53%'],
        splitNumber: 4,
        shape: 'polygon',
        startAngle: 90,
        axisName: { color: hexA(accent, 0.85), fontFamily: FONT_LABEL, fontWeight: 600, fontSize: 10, padding: [0, 0] },
        axisNameGap: 6,
        splitLine: { lineStyle: { color: [hexA(accent, 0.1), hexA(accent, 0.14), hexA(accent, 0.2), hexA(accent, 0.45)], width: 1 } },
        splitArea: { show: true, areaStyle: { color: [hexA(accent, 0.015), hexA(accent, 0.045)] } },
        axisLine: { lineStyle: { color: hexA(accent, 0.22) } },
      },
      series: [
        {
          type: 'radar',
          silent: true,
          symbol: 'none',
          data: [
            {
              value: teamKey.split(',').map(Number),
              name: 'Średnia zespołu',
              lineStyle: { color: hexA(accent2, 0.55), width: 1, type: 'dashed' },
              areaStyle: { color: hexA(accent2, 0.04) },
            },
            {
              value: skillKey.split(',').map(Number),
              name,
              symbol: 'rect',
              symbolSize: 4,
              itemStyle: { color: accent },
              lineStyle: { color: accent, width: 1.6, shadowBlur: 10, shadowColor: accent },
              areaStyle: {
                color: new echarts.graphic.RadialGradient(0.5, 0.5, 0.75, [
                  { offset: 0, color: hexA(accent, 0.05) },
                  { offset: 1, color: hexA(accent, 0.38) },
                ]),
              },
            },
          ],
        },
      ],
    }),
    [skillKey, teamKey, name, accent, accent2, reduced],
  )
  const summary = SKILL_AXES.map((x) => `${x.label} ${Math.round(skills[x.id] * 100)}%`).join(', ')
  return (
    <div className="size-full" role="img" aria-label={`Profil umiejętności: ${summary}`}>
      <ReactEChartsCore echarts={echarts} option={option} notMerge={false} lazyUpdate style={{ width: '100%', height: '100%' }} opts={{ renderer: 'canvas' }} />
    </div>
  )
}

/* ------------------------------------------------------------------ gauge */

export interface ArcGaugeProps {
  value: number
  max: number
  /** formatted centre value */
  display: string
  unit: string
  label: string
  color: string
  accent: string
  reduced: boolean
}

/** 240° HUD arc gauge: tick ring + progress arc + centre numeric readout. */
export function ArcGauge({ value, max, display, unit, label, color, accent, reduced }: ArcGaugeProps) {
  const option = useMemo(
    () => ({
      animation: !reduced,
      animationDurationUpdate: 700,
      animationEasingUpdate: 'cubicOut',
      series: [
        {
          type: 'gauge',
          startAngle: 210,
          endAngle: -30,
          radius: '96%',
          center: ['50%', '58%'],
          min: 0,
          max,
          splitNumber: 5,
          axisLine: { show: false },
          progress: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          detail: { show: false },
          title: { show: false },
          axisTick: { show: true, splitNumber: 4, distance: 0, length: 3, lineStyle: { color: hexA(accent, 0.35), width: 1 } },
          splitLine: { show: true, distance: 0, length: 6, lineStyle: { color: hexA(accent, 0.75), width: 1 } },
          axisLabel: { show: false },
          data: [{ value: 0 }],
        },
        {
          type: 'gauge',
          startAngle: 210,
          endAngle: -30,
          radius: '80%',
          center: ['50%', '58%'],
          min: 0,
          max,
          pointer: { show: false },
          anchor: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          title: { show: false },
          axisLine: { lineStyle: { width: 7, color: [[1, hexA(accent, 0.1)]] } },
          progress: { show: true, width: 7, roundCap: false, itemStyle: { color, shadowBlur: 12, shadowColor: color } },
          detail: {
            valueAnimation: !reduced,
            offsetCenter: [0, '2%'],
            fontFamily: FONT_MONO,
            fontSize: 17,
            fontWeight: 500,
            color: tintWhite(accent),
            formatter: () => display,
            rich: {},
          },
          data: [{ value: Math.min(max, Math.max(0, value)) }],
        },
      ],
    }),
    [value, max, display, color, accent, reduced],
  )
  return (
    <div className="relative size-full" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-valuetext={`${display} ${unit}`}>
      <ReactEChartsCore echarts={echarts} option={option} lazyUpdate style={{ width: '100%', height: '100%' }} opts={{ renderer: 'canvas' }} />
      <span className="absolute inset-x-0 bottom-[14%] text-center jx-label text-[0.625rem] pointer-events-none">{unit}</span>
      <span className="absolute inset-x-0 bottom-0 text-center jx-label text-[0.625rem] text-jx-text pointer-events-none truncate">{label}</span>
    </div>
  )
}
