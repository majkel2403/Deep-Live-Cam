import { useCallback, useEffect, useMemo, useRef } from 'react'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'
import { useDocumentVisible } from '@/lib/telemetry'
import { hexA, tintWhite } from '../hooks'
import { SEMANTIC, STATUS_META, statusHex } from '../model'
import { endpointId, particleCount, particleSpeed, useGraphModel, type GLink, type GNode } from './model'
import { linkTooltip, nodeTooltip, type GraphViewProps } from './shared'

/**
 * 2D fallback topology – react-force-graph-2d (MIT, vasturiano), canvas renderer.
 * Used when WebGL is unavailable or the user prefers a flat schematic. Nodes are drawn as
 * glowing HUD discs (load → radius, status → colour) with a polar range-finder underlay.
 * The kapsule's own destructor pauses its loop on unmount; we also pause on cleanup.
 */
type FG = ForceGraphMethods<GNode, GLink>

const radius2d = (load: number) => 5 + load * 9

/** Screen-space room kept free of nodes: top readout line, bottom legend, label room under each node. */
const VIEW_PAD = { top: 46, bottom: 66, x: 24 }
const LABEL = { below: 34, half: 56 }

/**
 * Asymmetric fit: the built-in zoomToFit pads all sides equally, so bottom nodes end up under
 * the legend overlay. Reserve the top readout line and the bottom legend, plus label room
 * (labels are drawn below each node at a constant 12 + 10.5 px).
 */
function fit2D(fg: FG, nodes: GNode[], w: number, h: number, ms: number) {
  const pts = nodes.filter((n) => Number.isFinite(n.x) && Number.isFinite(n.y))
  if (!pts.length || w <= 0 || h <= 0) return
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const n of pts) {
    const r = radius2d(n.agent.load) + 4
    minX = Math.min(minX, n.x! - r)
    maxX = Math.max(maxX, n.x! + r)
    minY = Math.min(minY, n.y! - r)
    maxY = Math.max(maxY, n.y! + r)
  }
  const bw = Math.max(1, maxX - minX)
  const bh = Math.max(1, maxY - minY)
  const k = Math.max(0.4, Math.min(4, (w - 2 * VIEW_PAD.x - 2 * LABEL.half) / bw, (h - VIEW_PAD.top - VIEW_PAD.bottom - LABEL.below) / bh))
  const avail = h - VIEW_PAD.top - VIEW_PAD.bottom
  const top = VIEW_PAD.top + Math.max(0, (avail - (bh * k + LABEL.below)) / 2)
  fg.centerAt((minX + maxX) / 2, minY - (top - h / 2) / k, ms)
  fg.zoom(k, ms)
}

interface SimNode {
  x?: number
  y?: number
  vx?: number
  vy?: number
}

/**
 * d3 force that keeps every node inside the area that is currently visible between the overlays.
 * The bounds are read from the live view (screen → graph coordinates), so pan and zoom stay correct.
 * Without it the simulation drifts nodes under the bottom legend after the one-off auto-fit.
 */
function keepInView(getBounds: () => { minX: number; maxX: number; minY: number; maxY: number } | null) {
  let nodes: SimNode[] = []
  const force = (alpha: number) => {
    if (alpha <= 0) return
    const b = getBounds()
    if (!b) return
    for (const n of nodes) {
      if (n.x === undefined || n.y === undefined) continue
      if (n.x < b.minX) { n.x = b.minX; n.vx = 0 }
      else if (n.x > b.maxX) { n.x = b.maxX; n.vx = 0 }
      if (n.y < b.minY) { n.y = b.minY; n.vy = 0 }
      else if (n.y > b.maxY) { n.y = b.maxY; n.vy = 0 }
    }
  }
  force.initialize = (ns: SimNode[]) => {
    nodes = ns
  }
  return force
}

export default function Graph2D({ snapshot, selectedId, onSelect, width, height, accent, accent2, reduced, quality, fitSignal }: GraphViewProps) {
  const fgRef = useRef<FG | undefined>(undefined)
  const visible = useDocumentVisible()
  const model = useGraphModel(snapshot, quality)
  const fitted = useRef(false)
  // the draw callbacks read the latest values through a ref so they keep a stable identity
  const live = useRef({ selectedId, accent, accent2, reduced })
  useEffect(() => {
    live.current = { selectedId, accent, accent2, reduced }
  }, [selectedId, accent, accent2, reduced])

  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength(-220)
    fg.d3Force('link')?.distance((l: GLink) => (l.kind === 'tool' ? 80 : 46))
    fg.d3Force(
      'keepInView',
      keepInView(() => {
        const g = fgRef.current
        const { width: w, height: h } = sizeRef.current
        if (!g || w <= 0 || h <= 0) return null
        const a = g.screen2GraphCoords(VIEW_PAD.x, VIEW_PAD.top)
        const c = g.screen2GraphCoords(w - VIEW_PAD.x, h - VIEW_PAD.bottom - LABEL.below)
        return { minX: Math.min(a.x, c.x), maxX: Math.max(a.x, c.x), minY: Math.min(a.y, c.y), maxY: Math.max(a.y, c.y) }
      }),
    )
    fg.d3ReheatSimulation()
    fg.resumeAnimation()
    return () => {
      fg.pauseAnimation()
    }
  }, [])

  const dataRef = useRef(model.data)
  const sizeRef = useRef({ width, height })
  useEffect(() => {
    dataRef.current = model.data
    sizeRef.current = { width, height }
  }, [model.data, width, height])
  const fit = useCallback((ms: number) => {
    const fg = fgRef.current
    if (fg) fit2D(fg, dataRef.current.nodes, sizeRef.current.width, sizeRef.current.height, ms)
  }, [])

  useEffect(() => {
    if (fitSignal > 0) fit(600)
  }, [fitSignal, fit])

  // a hidden tab renders nothing: stop the canvas loop and resume when visible again
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    if (visible) fg.resumeAnimation()
    else fg.pauseAnimation()
  }, [visible])

  // auto-framing while the layout settles; stops once the user pans / zooms
  const userMoved = useRef(false)
  useEffect(() => {
    const timers = [1000, 2800, 6000].map((ms) =>
      setTimeout(() => {
        if (!userMoved.current) fit(600)
      }, ms),
    )
    return () => timers.forEach(clearTimeout)
  }, [fit])

  const drawNode = useCallback((n: GNode, ctx: CanvasRenderingContext2D, scale: number) => {
    const { selectedId: sel, accent: acc, accent2: acc2, reduced: red } = live.current
    const a = n.agent
    const x = n.x ?? 0
    const y = n.y ?? 0
    const r = radius2d(a.load)
    const col = statusHex(a.status, acc)
    const selected = sel === a.id
    const t = performance.now() / 1000
    const pulse = red ? 0.7 : a.status === 'thinking' ? 0.5 + 0.5 * Math.sin(t * 4) : a.status === 'error' ? (Math.sin(t * 10) > 0 ? 1 : 0.25) : 0.7

    // halo
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4)
    g.addColorStop(0, hexA(col, 0.45 * pulse + 0.15))
    g.addColorStop(1, hexA(col, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2)
    ctx.fill()

    // core disc + outline
    ctx.fillStyle = hexA(col, a.status === 'offline' ? 0.25 : 0.32)
    ctx.strokeStyle = col
    ctx.lineWidth = 1.4 / Math.sqrt(scale)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // load arc (outer, clockwise from top)
    ctx.lineWidth = 2.2 / Math.sqrt(scale)
    ctx.strokeStyle = hexA(col, 0.95)
    ctx.beginPath()
    ctx.arc(x, y, r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, a.load))
    ctx.stroke()

    // inner dot
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.arc(x, y, Math.max(1.5, r * 0.28), 0, Math.PI * 2)
    ctx.fill()

    // selection reticle: rotating dashed ring + four ticks
    if (selected) {
      const rr = r + 8
      const rot = red ? 0 : t * 0.8
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rot)
      ctx.strokeStyle = acc2
      ctx.lineWidth = 1.2 / Math.sqrt(scale)
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.arc(0, 0, rr, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2)
        ctx.beginPath()
        ctx.moveTo(rr + 2, 0)
        ctx.lineTo(rr + 6, 0)
        ctx.stroke()
      }
      ctx.restore()
    }

    // labels: constant on-screen size (12 px name, 10.5 px status) at any zoom level
    const fs = 12 / scale
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = `600 ${fs}px Oxanium, "Chakra Petch", sans-serif`
    ctx.fillStyle = selected ? '#ffffff' : tintWhite(acc, 0.14, 0.92)
    ctx.shadowColor = selected ? acc2 : acc
    ctx.shadowBlur = 6
    ctx.fillText(a.name.toUpperCase(), x, y + r + 6)
    ctx.shadowBlur = 0
    ctx.font = `700 ${10.5 / scale}px Rajdhani, "Chakra Petch", sans-serif`
    ctx.fillStyle = col
    ctx.fillText(`${STATUS_META[a.status].short} · ${Math.round(a.load * 100)}%`, x, y + r + 6 + fs * 1.2)
  }, [])

  const paintArea = useCallback((n: GNode, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(n.x ?? 0, n.y ?? 0, radius2d(n.agent.load) + 6, 0, Math.PI * 2)
    ctx.fill()
  }, [])

  // polar range-finder rings centred on the graph origin
  const drawUnderlay = useCallback((ctx: CanvasRenderingContext2D, scale: number) => {
    const { accent: acc } = live.current
    ctx.save()
    ctx.lineWidth = 1 / scale
    for (let i = 1; i <= 4; i++) {
      ctx.strokeStyle = hexA(acc, i === 4 ? 0.22 : 0.09)
      ctx.beginPath()
      ctx.arc(0, 0, i * 60, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.strokeStyle = hexA(acc, 0.08)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20)
      ctx.lineTo(Math.cos(a) * 240, Math.sin(a) * 240)
      ctx.stroke()
    }
    ctx.restore()
  }, [])

  const isHl = useCallback((l: GLink) => !!selectedId && (endpointId(l.source) === selectedId || endpointId(l.target) === selectedId), [selectedId])
  const kindColor = useCallback((l: GLink) => (l.kind === 'delegates' ? accent : l.kind === 'reports' ? accent2 : SEMANTIC.violet), [accent, accent2])
  const linkColor = useCallback((l: GLink) => hexA(kindColor(l), isHl(l) ? 0.9 : selectedId ? 0.18 : 0.38), [kindColor, isHl, selectedId])
  const linkWidth = useCallback((l: GLink) => (isHl(l) ? 1.6 : l.kind === 'tool' ? 0.6 : 1), [isHl])
  const linkDash = useCallback((l: GLink) => (l.kind === 'tool' ? [3, 3] : null), [])
  const particleColor = useCallback((l: GLink) => kindColor(l), [kindColor])
  const particleWidth = useCallback((l: GLink) => (isHl(l) ? 3.2 : 2.2), [isHl])
  const speed = useCallback((l: GLink) => particleSpeed(l.traffic, reduced) * 1.4, [reduced])
  const { particleSig, maxParticles, data } = model
  const particles = useMemo(() => {
    const counts = new Map(data.links.map((l) => [l.key, particleCount(l.traffic, maxParticles)]))
    return (l: GLink) => counts.get(l.key) ?? 0
    // particleSig changes exactly when a count changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particleSig, maxParticles, data])

  const handleClick = useCallback((n: GNode) => onSelect(n.id), [onSelect])
  const markMoved = useCallback(() => {
    userMoved.current = true
  }, [])
  const handleStop = useCallback(() => {
    if (fitted.current || userMoved.current) return
    fitted.current = true
    fit(700)
  }, [fit])

  return (
    <div onPointerDownCapture={markMoved} onWheelCapture={markMoved}>
    <ForceGraph2D<GNode, GLink>
      ref={fgRef}
      width={width}
      height={height}
      graphData={data}
      backgroundColor="rgba(0,0,0,0)"
      nodeCanvasObject={drawNode}
      nodePointerAreaPaint={paintArea}
      nodeLabel={nodeTooltip}
      linkLabel={linkTooltip}
      linkColor={linkColor}
      linkWidth={linkWidth}
      linkLineDash={linkDash}
      linkCurvature={(l: GLink) => (l.kind === 'tool' ? 0.1 : 0.22)}
      linkDirectionalParticles={particles}
      linkDirectionalParticleSpeed={speed}
      linkDirectionalParticleWidth={particleWidth}
      linkDirectionalParticleColor={particleColor}
      onRenderFramePre={drawUnderlay}
      autoPauseRedraw={reduced}
      warmupTicks={40}
      cooldownTime={4000}
      onEngineStop={handleStop}
      onNodeClick={handleClick}
      minZoom={0.4}
      maxZoom={8}
    />
    </div>
  )
}
