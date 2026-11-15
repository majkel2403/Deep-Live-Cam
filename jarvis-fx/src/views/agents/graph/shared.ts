import type { OrchestrationSnapshot } from '@/lib/agents'
import type { Quality } from '@/lib/store'
import { LINK_META, STATUS_META, escapeHtml, fmtInt, fmtPct } from '../model'
import { endpointId, type GLink, type GNode } from './model'

export interface GraphViewProps {
  snapshot: OrchestrationSnapshot | null
  selectedId: string | null
  onSelect: (id: string) => void
  width: number
  height: number
  accent: string
  accent2: string
  reduced: boolean
  quality: Quality
  autoRotate: boolean
  /** increment to request a zoom-to-fit */
  fitSignal: number
}

/** Hover tooltip (force-graph renders it as innerHTML → every value is escaped). */
export function nodeTooltip(n: GNode): string {
  const a = n.agent
  const st = STATUS_META[a.status]
  return `<div class="jx-graph-tip">
    <div class="jx-graph-tip__name">${escapeHtml(a.name)}</div>
    <div class="jx-graph-tip__role">${escapeHtml(a.role)}${a.model ? ` · ${escapeHtml(a.model)}` : ''}</div>
    <div class="jx-graph-tip__row"><span style="color:${st.css}">● ${st.label}</span><span>obc. ${fmtPct(a.load)}</span></div>
    <div class="jx-graph-tip__row"><span>${fmtInt(a.latencyMs)} ms</span><span>${fmtInt(a.tokensPerMin)} tok/min</span></div>
  </div>`
}

export function linkTooltip(l: GLink): string {
  const name = (e: string | GNode) => (typeof e === 'string' ? e : e.agent.name)
  return `<div class="jx-graph-tip">
    <div class="jx-graph-tip__role">${escapeHtml(LINK_META[l.kind].label)}</div>
    <div class="jx-graph-tip__name">${escapeHtml(name(l.source))} → ${escapeHtml(name(l.target))}</div>
    <div class="jx-graph-tip__row"><span>${fmtInt(l.traffic)} wiad./min</span><span>${escapeHtml(endpointId(l.source))}→${escapeHtml(endpointId(l.target))}</span></div>
  </div>`
}
