import { useCallback, useEffect, useMemo, useRef } from 'react'
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from 'react-force-graph-2d'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { DemoBadge, HudChrome } from '../hud-kit/HudChrome'
import { hexA, rng, SEM } from '../hud-kit/color'
import { useSize } from '../hud-kit/useSize'
import { LBL } from '../hud-kit/ui'

/**
 * Synthetic "JARVIS data-flow" topology on react-force-graph-2d (MIT). Nodes are custom-painted
 * (radial halo, concentric rings, rotating arc segments for hubs, hexagon sensors); links carry
 * directional particles towards the core and random bursts via fg.emitParticle().
 */

type Kind = 'core' | 'hub' | 'leaf'
interface N {
  id: string
  label: string
  kind: Kind
  group: number
  load: number
}
interface L {
  source: string | NodeObject<N>
  target: string | NodeObject<N>
  kind: 'trunk' | 'branch' | 'mesh'
  rate: number
}
type GN = NodeObject<N>
type GL = LinkObject<N, L>

const HUBS = ['ZASILANIE', 'NAWIGACJA', 'SENSORY', 'UZBROJENIE', 'ŁĄCZNOŚĆ', 'PAMIĘĆ']

function buildGraph(hubCount: number, leavesPer: number): { nodes: N[]; links: L[] } {
  const r = rng(99)
  const nodes: N[] = [{ id: 'core', label: 'J.A.R.V.I.S.', kind: 'core', group: -1, load: 0.8 }]
  const links: L[] = []
  for (let h = 0; h < hubCount; h++) {
    const hid = `hub-${h}`
    nodes.push({ id: hid, label: HUBS[h % HUBS.length], kind: 'hub', group: h, load: 0.3 + r() * 0.7 })
    links.push({ source: hid, target: 'core', kind: 'trunk', rate: 0.6 + r() * 0.4 })
    const n = Math.max(2, Math.round(leavesPer * (0.6 + r() * 0.8)))
    for (let i = 0; i < n; i++) {
      const lid = `${hid}-s${i}`
      nodes.push({ id: lid, label: `${HUBS[h % HUBS.length].slice(0, 3)}-${String(i + 1).padStart(2, '0')}`, kind: 'leaf', group: h, load: r() })
      links.push({ source: lid, target: hid, kind: 'branch', rate: 0.2 + r() * 0.8 })
    }
  }
  // a few cross-links between neighbouring hubs (mesh)
  for (let h = 0; h < hubCount; h++) if (r() < 0.7) links.push({ source: `hub-${h}`, target: `hub-${(h + 1) % hubCount}`, kind: 'mesh', rate: 0.3 })
  return { nodes, links }
}

const idOf = (e: string | NodeObject<N> | undefined) => (typeof e === 'object' ? String(e.id) : String(e))

export default function ForceGraphFx({ accent, accent2, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    particles: { value: 2, min: 0, max: 6, step: 1, label: 'cząstki' },
    speed: { value: 1, min: 0.2, max: 4, step: 0.1, label: 'prędkość' },
    charge: { value: -140, min: -400, max: -20, step: 10, label: 'ładunek' },
    bursts: { value: true, label: 'impulsy' },
    labels: { value: true, label: 'etykiety' },
  })
  const [ref, size] = useSize<HTMLDivElement>()
  const fgRef = useRef<ForceGraphMethods<GN, GL> | undefined>(undefined)
  const data = useMemo(() => (stage ? buildGraph(6, 6) : buildGraph(4, 3)), [stage])
  const live = useRef({ accent, accent2, reducedMotion, labels: c.labels, stage, hover: null as string | null })
  useEffect(() => {
    live.current = { ...live.current, accent, accent2, reducedMotion, labels: c.labels, stage }
  }, [accent, accent2, reducedMotion, c.labels, stage])

  // forces
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength(c.charge)
    fg.d3Force('link')?.distance((l: GL) => (l.kind === 'trunk' ? (stage ? 90 : 50) : l.kind === 'mesh' ? 140 : stage ? 34 : 20))
    fg.d3ReheatSimulation()
  }, [c.charge, stage, data])

  // pause / resume the render loop
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    if (paused) fg.pauseAnimation()
    else fg.resumeAnimation()
  }, [paused])
  useEffect(
    () => () => {
      fgRef.current?.pauseAnimation()
    },
    [],
  )

  // random bursts along branch → hub → core paths
  useEffect(() => {
    if (!c.bursts || paused || reducedMotion) return
    const r = rng(Date.now() & 0xffff)
    const id = setInterval(
      () => {
        const fg = fgRef.current
        if (!fg) return
        const links = data.links as GL[]
        const l = links[Math.floor(r() * links.length)]
        fg.emitParticle(l)
        if (l.kind === 'branch') {
          const trunk = links.find((x) => x.kind === 'trunk' && idOf(x.source) === idOf(l.target))
          if (trunk) setTimeout(() => fgRef.current?.emitParticle(trunk), 500 / c.speed)
        }
      },
      stage ? 220 : 600,
    )
    return () => clearInterval(id)
  }, [c.bursts, paused, reducedMotion, data, stage, c.speed])

  // auto-fit while the layout settles
  useEffect(() => {
    // the layout is pre-computed with warmupTicks, so the first fit is already close to final
    const ts = [150, 1200, 3000, 6500].map((ms) => setTimeout(() => fgRef.current?.zoomToFit(ms < 200 ? 0 : 500, stage ? 70 : 14), ms))
    return () => ts.forEach(clearTimeout)
  }, [stage, size.width, size.height])

  const drawNode = useCallback((n: GN, ctx: CanvasRenderingContext2D, scale: number) => {
    const { accent: acc, accent2: acc2, reducedMotion: red, labels, stage: big, hover } = live.current
    const x = n.x ?? 0
    const y = n.y ?? 0
    const t = red ? 0 : performance.now() / 1000
    const hot = hover === n.id
    const base = n.kind === 'core' ? 13 : n.kind === 'hub' ? 7.5 : 3
    const col = n.kind === 'core' ? acc2 : n.kind === 'hub' ? acc : n.load > 0.85 ? SEM.warn : acc

    // halo
    const haloR = base * (n.kind === 'leaf' ? 3 : 2.6) * (hot ? 1.4 : 1)
    const g = ctx.createRadialGradient(x, y, base * 0.4, x, y, haloR)
    g.addColorStop(0, hexA(col, n.kind === 'leaf' ? 0.35 : 0.45))
    g.addColorStop(1, hexA(col, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, haloR, 0, Math.PI * 2)
    ctx.fill()

    const lw = 1.1 / Math.sqrt(scale)
    if (n.kind === 'leaf') {
      // hexagon sensor
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6
        const px = x + Math.cos(a) * base
        const py = y + Math.sin(a) * base
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fillStyle = hexA(col, 0.25)
      ctx.fill()
      ctx.strokeStyle = col
      ctx.lineWidth = lw
      ctx.stroke()
    } else {
      // concentric rings + rotating arc segments
      ctx.fillStyle = hexA(col, 0.22)
      ctx.strokeStyle = col
      ctx.lineWidth = lw * 1.2
      ctx.beginPath()
      ctx.arc(x, y, base, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.arc(x, y, base * 0.35, 0, Math.PI * 2)
      ctx.fill()
      const rings = n.kind === 'core' ? 3 : 2
      for (let k = 1; k <= rings; k++) {
        const rr = base + k * (n.kind === 'core' ? 5 : 3.5)
        const dir = k % 2 ? 1 : -1
        const segs = n.kind === 'core' ? 3 + k : 2 + k
        ctx.strokeStyle = hexA(k === 1 ? acc2 : acc, 0.85 - k * 0.18)
        ctx.lineWidth = lw * (k === 1 ? 1.6 : 1)
        for (let s = 0; s < segs; s++) {
          const a0 = t * 0.9 * dir * (1 + k * 0.3) + (s / segs) * Math.PI * 2
          ctx.beginPath()
          ctx.arc(x, y, rr, a0, a0 + (Math.PI * 2) / segs * 0.62)
          ctx.stroke()
        }
      }
      // load arc for hubs
      if (n.kind === 'hub') {
        ctx.strokeStyle = n.load > 0.85 ? SEM.warn : SEM.ok
        ctx.lineWidth = lw * 2
        ctx.beginPath()
        ctx.arc(x, y, base + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * n.load)
        ctx.stroke()
      }
    }

    if (labels && big && (n.kind !== 'leaf' || scale > 1.6 || hot)) {
      // on-screen size stays at 10 px (leaves) / 12 px (hubs) at any zoom; the clamp keeps graph units sane
      const fs = Math.max(3, (n.kind === 'leaf' ? 10 : 12) / scale)
      ctx.font = `600 ${fs}px Rajdhani, "Chakra Petch", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = n.kind === 'leaf' ? 'rgba(215,246,255,0.75)' : '#e8fbff'
      ctx.fillText(n.label, x, y + base + (n.kind === 'leaf' ? 4 : 16))
    }
  }, [])

  const paintArea = useCallback((n: GN, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(n.x ?? 0, n.y ?? 0, n.kind === 'core' ? 22 : n.kind === 'hub' ? 14 : 7, 0, Math.PI * 2)
    ctx.fill()
  }, [])

  const linkColor = useCallback((l: GL) => hexA(l.kind === 'trunk' ? accent2 : l.kind === 'mesh' ? SEM.violet : accent, l.kind === 'trunk' ? 0.55 : 0.3), [accent, accent2])
  const linkWidth = useCallback((l: GL) => (l.kind === 'trunk' ? 1.6 : l.kind === 'mesh' ? 0.6 : 0.8), [])
  const linkDash = useCallback((l: GL) => (l.kind === 'mesh' ? [3, 3] : null), [])
  const pScale = quality === 'low' ? 0.5 : 1
  const pCount = useCallback(
    (l: GL) => (reducedMotion ? 0 : l.kind === 'mesh' ? 0 : Math.round(c.particles * pScale * (l.kind === 'trunk' ? 1.5 : 0.5 + l.rate))),
    [c.particles, reducedMotion, pScale],
  )
  const pSpeed = useCallback((l: GL) => 0.004 * c.speed * (0.6 + l.rate), [c.speed])
  const pColor = useCallback((l: GL) => (l.kind === 'trunk' ? '#e8fbff' : accent2), [accent2])
  const pWidth = useCallback((l: GL) => (l.kind === 'trunk' ? 3 : 2), [])
  const onHover = useCallback((n: GN | null) => {
    live.current.hover = n ? String(n.id) : null
  }, [])

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_center,var(--jx-accent-faint),transparent_65%)]">
      {size.width > 0 && (
        <ForceGraph2D<N, L>
          ref={fgRef}
          width={size.width}
          height={size.height}
          graphData={data}
          backgroundColor="rgba(0,0,0,0)"
          nodeCanvasObject={drawNode}
          nodeCanvasObjectMode={() => 'replace'}
          nodePointerAreaPaint={paintArea}
          nodeLabel={(n: GN) => `${n.label} · obciążenie ${Math.round(n.load * 100)}%`}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkLineDash={linkDash}
          linkDirectionalParticles={pCount}
          linkDirectionalParticleSpeed={pSpeed}
          linkDirectionalParticleColor={pColor}
          linkDirectionalParticleWidth={pWidth}
          autoPauseRedraw={false}
          warmupTicks={stage ? 160 : 120}
          cooldownTime={stage ? 8000 : 4000}
          d3VelocityDecay={0.32}
          enablePointerInteraction={stage}
          enableZoomInteraction={stage}
          enablePanInteraction={stage}
          enableNodeDrag={stage}
          onNodeHover={onHover}
          onEngineStop={() => fgRef.current?.zoomToFit(600, stage ? 70 : 14)}
        />
      )}
      <span className="sr-only">
        {`Graf sieci przepływu danych: rdzeń J.A.R.V.I.S., ${data.nodes.filter((n) => n.kind === 'hub').length} podsystemów i ${data.nodes.filter((n) => n.kind === 'leaf').length} czujników – topologia demonstracyjna.`}
      </span>
      <HudChrome
        code="NET-08 · TOPOLOGIA"
        title="Sieć przepływu danych"
        stage={stage}
        badges={<DemoBadge title="Topologia i ruch na łączach są syntetyczne – wizualizacja demonstracyjna" />}
        footer={
          stage ? (
            <>
              <span className={`${LBL} text-[0.625rem]`}>
                Węzły <span className="jx-num text-jx-accent">{data.nodes.length}</span> · łącza <span className="jx-num text-jx-accent">{data.links.length}</span>
              </span>
              <span className="flex-1" />
              <span className={`${LBL} text-[0.625rem]`}>Przeciągnij węzeł · kółko = zoom</span>
            </>
          ) : undefined
        }
      />
    </div>
  )
}
