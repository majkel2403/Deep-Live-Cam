import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d'
import * as THREE from 'three'
import { useDocumentVisible } from '@/lib/telemetry'
import { hexA, useDisposeOnUnmount } from '../hooks'
import { SEMANTIC } from '../model'
import { createNodeKit } from './nodeKit'
import { endpointId, particleCount, particleSpeed, useGraphModel, type GLink, type GNode } from './model'
import { linkTooltip, nodeTooltip, type GraphViewProps } from './shared'

/**
 * 3D agent topology – react-force-graph-3d (MIT, vasturiano) on top of three.js.
 * Custom holographic node objects (nodeKit), curved paired links (delegates ↓ / reports ↑),
 * directional particles whose count & speed follow live traffic, a polar "holo-table" floor
 * with a radar sweep, slow orbit auto-rotation. Everything is released on unmount.
 */
type FG = ForceGraphMethods<GNode, GLink>

const linkWidth = (l: GLink) => (l.kind === 'tool' ? 0.3 : 0.55)

interface FloorPlace {
  x: number
  y: number
  z: number
  scale: number
}
const FLOOR_R = 130

/** Tier height per delegation level: the orchestration tree reads as stacked decks over the floor. */
const TIER = 16

/** Screen-space room each node needs for its label (px above the node centre, px half-width). */
const LABEL_ROOM = { top: 40, half: 58 }

interface FitPad {
  top: number
  bottom: number
  x: number
}

/**
 * Tight camera fit over the actual node positions AND the holo-floor ring under them (the
 * built-in zoomToFit fits the 3D bbox corners, which leaves a sparse tree tiny and lets the
 * floor spill out of the frame). The ring is circular, so the framing holds while the camera
 * orbits. Keeps the current look direction; the target is shifted sideways/vertically so the
 * content is centred on screen (perspective makes the near rim of the floor dominate a
 * symmetric fit). The distance is found by bisection over a feasibility test.
 */
function fitCamera(fg: FG, nodes: GNode[], viewW: number, viewH: number, ms: number, pad: FitPad = { top: 46, bottom: 48, x: 20 }): FloorPlace | null {
  const pts = nodes.filter((n) => Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)).map((n) => new THREE.Vector3(n.x, n.y, n.z))
  if (!pts.length || viewH <= 0 || viewW <= 0) return null
  const min = pts[0].clone()
  const max = pts[0].clone()
  for (const p of pts) {
    min.min(p)
    max.max(p)
  }
  const center = min.clone().add(max).multiplyScalar(0.5)
  let radius = 0
  for (const p of pts) radius = Math.max(radius, Math.hypot(p.x - center.x, p.z - center.z))
  const ringR = radius + 14
  const floorY = min.y - 12

  const cam = fg.camera() as THREE.PerspectiveCamera
  cam.updateMatrixWorld()
  const fwd = new THREE.Vector3()
  cam.getWorldDirection(fwd)
  const right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize()
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize()
  // screen extents in "tan units" (offset / depth); px → tan: px * 2 * tanHalf / viewH
  const tanHalf = Math.tan(((cam.fov / 2) * Math.PI) / 180)
  const px = (v: number) => (v * 2 * tanHalf) / viewH
  const tTop = tanHalf - px(pad.top)
  const tBot = tanHalf - px(pad.bottom)
  const tX = tanHalf * (viewW / viewH) - px(pad.x)

  // items in camera-aligned local coordinates; nodes reserve label room (screen space)
  const items: { u: number; r: number; f: number; top: number; bot: number; half: number }[] = []
  const add = (p: THREE.Vector3, top: number, bot: number, half: number) => {
    const l = p.clone().sub(center)
    items.push({ u: l.dot(up), r: l.dot(right), f: l.dot(fwd), top, bot, half })
  }
  for (const p of pts) add(p, px(LABEL_ROOM.top), px(14), px(LABEL_ROOM.half))
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2
    add(new THREE.Vector3(center.x + Math.cos(a) * (ringR + 4.5), floorY, center.z + Math.sin(a) * (ringR + 4.5)), 0, 0, 0)
  }

  // for a camera distance: the admissible target shifts (vertical s, horizontal h), or null
  const solve = (dist: number) => {
    let loU = -Infinity
    let hiU = Infinity
    let loR = -Infinity
    let hiR = Infinity
    for (const it of items) {
      const depth = dist + it.f
      if (depth <= 1) return null
      loU = Math.max(loU, it.u - (tTop - it.top) * depth)
      hiU = Math.min(hiU, it.u + (tBot - it.bot) * depth)
      loR = Math.max(loR, it.r - (tX - it.half) * depth)
      hiR = Math.min(hiR, it.r + (tX - it.half) * depth)
    }
    return loU <= hiU && loR <= hiR ? { s: (loU + hiU) / 2, h: (loR + hiR) / 2 } : null
  }
  let lo = 20
  let hi = 6000
  if (!solve(hi)) return null
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (solve(mid)) hi = mid
    else lo = mid
  }
  const shift = solve(hi)!
  const target = center.clone().addScaledVector(up, shift.s).addScaledVector(right, shift.h)
  const pos = target.clone().addScaledVector(fwd, -hi)
  fg.cameraPosition({ x: pos.x, y: pos.y, z: pos.z }, { x: target.x, y: target.y, z: target.z }, ms)
  return { x: center.x, y: floorY, z: center.z, scale: Math.max(0.4, ringR / FLOOR_R) }
}

/** Depth of every node in the delegation tree (0 = root), cycle-safe. */
function tiers(nodes: GNode[]): Map<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = new Map<string, number>()
  for (const n of nodes) {
    let d = 0
    let cur = n.agent
    const seen = new Set<string>()
    while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.id) && d < 6) {
      seen.add(cur.id)
      cur = byId.get(cur.parentId)!.agent
      d++
    }
    out.set(n.id, d)
  }
  return out
}
const linkCurvature = (l: GLink) => (l.kind === 'tool' ? 0.08 : 0.24)

export default function Graph3D({ snapshot, selectedId, onSelect, width, height, accent, accent2, reduced, quality, autoRotate, fitSignal }: GraphViewProps) {
  const fgRef = useRef<FG | undefined>(undefined)
  const visible = useDocumentVisible()
  const model = useGraphModel(snapshot, quality)
  const [kit] = useState(() => createNodeKit(quality))
  const fitted = useRef(false)
  const floorRef = useRef<THREE.Group | null>(null)
  const floorPlace = useRef<FloorPlace>({ x: 0, y: -78, z: 0, scale: 1 })
  const dataRef = useRef(model.data)
  const sizeRef = useRef({ width, height })
  useEffect(() => {
    dataRef.current = model.data
    sizeRef.current = { width, height }
  }, [model.data, width, height])

  const fit = useCallback((ms: number) => {
    const fg = fgRef.current
    if (!fg) return
    const place = fitCamera(fg, dataRef.current.nodes, sizeRef.current.width, sizeRef.current.height, ms)
    if (!place) return
    floorPlace.current = place
    const floor = floorRef.current
    if (floor) {
      floor.position.set(place.x, place.y, place.z)
      floor.scale.setScalar(place.scale)
    }
  }, [])

  // constant on-screen label size: follows the viewport height and the camera's fov
  useEffect(() => {
    const cam = fgRef.current?.camera() as THREE.PerspectiveCamera | undefined
    kit.setView(height, cam?.fov ?? 50)
  }, [kit, height])

  // label declutter at ~5 Hz (cheap: 9 projections), skipped while the tab is hidden
  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => {
      const fg = fgRef.current
      if (fg) kit.declutter(fg.camera(), sizeRef.current.width, sizeRef.current.height)
    }, 200)
    return () => clearInterval(id)
  }, [kit, visible])

  // a hidden tab renders nothing: stop the graph's own rAF loop and resume when visible again
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    if (visible) fg.resumeAnimation()
    else fg.pauseAnimation()
  }, [visible])

  // stack the delegation levels as decks (fixed y per tier; x/z stay free for the force layout)
  useEffect(() => {
    const depth = tiers(model.data.nodes)
    for (const n of model.data.nodes) {
      const fy = -(depth.get(n.id) ?? 0) * TIER
      if (n.fy === undefined) n.fy = fy
    }
  }, [model.data])

  // keep node visuals in sync with data / selection / theme
  useEffect(() => {
    kit.sync(model.data.nodes, { accent, accent2, selectedId, reduced })
  }, [kit, model, accent, accent2, selectedId, reduced])

  // canvas labels need the HUD webfonts – redraw once they are ready
  useEffect(() => {
    let cancelled = false
    Promise.all([document.fonts.load('600 50px Oxanium'), document.fonts.load('700 32px Rajdhani')])
      .catch(() => undefined)
      .then(() => !cancelled && kit.redrawLabels())
    return () => {
      cancelled = true
    }
  }, [kit])

  // one-time engine / renderer configuration + render-loop lifecycle
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength(-260)
    fg.d3Force('link')?.distance((l: GLink) => (l.kind === 'tool' ? 80 : 52))
    fg.d3ReheatSimulation()
    // elevated (~32°) "holo-table" viewing angle; the fit keeps this direction
    fg.cameraPosition({ x: 0, y: 150, z: 240 }, { x: 0, y: 0, z: 0 })
    fg.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'med' ? 1.5 : 1))
    fg.resumeAnimation()
    return () => {
      fg.pauseAnimation()
    }
  }, [quality])

  // React detaches fgRef before the deferred dispose runs, so keep our own handle to the instance
  const instRef = useRef<FG | undefined>(undefined)
  useEffect(() => {
    instRef.current = fgRef.current
  })
  useDisposeOnUnmount(
    useCallback(() => {
      const fg = instRef.current
      kit.dispose()
      try {
        const r = fg?.renderer()
        r?.dispose()
        r?.forceContextLoss()
      } catch {
        /* already gone */
      }
    }, [kit]),
  )

  // orbit auto-rotation (OrbitControls is updated by the graph's own loop each frame)
  useEffect(() => {
    const c = fgRef.current?.controls() as { autoRotate?: boolean; autoRotateSpeed?: number; enableDamping?: boolean } | undefined
    if (!c) return
    c.autoRotate = autoRotate && !reduced
    c.autoRotateSpeed = 0.8
    c.enableDamping = true
  }, [autoRotate, reduced])

  // holo-table floor: polar grid + outer ring + radar sweep + dust
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const scene = fg.scene()
    const group = new THREE.Group()
    const place = floorPlace.current
    group.position.set(place.x, place.y, place.z)
    group.scale.setScalar(place.scale)
    floorRef.current = group
    const col = new THREE.Color(accent)
    const grid = new THREE.PolarGridHelper(FLOOR_R, 12, 5, 96, col, col)
    const gm = grid.material as THREE.LineBasicMaterial
    gm.transparent = true
    gm.opacity = 0.16
    gm.depthWrite = false
    const ringGeo = new THREE.RingGeometry(FLOOR_R + 2, FLOOR_R + 4.5, 128)
    const ringMat = new THREE.MeshBasicMaterial({ color: accent2, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = -Math.PI / 2
    const sweepGeo = new THREE.CircleGeometry(FLOOR_R, 48, 0, Math.PI / 5)
    const sweepMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    const sweep = new THREE.Mesh(sweepGeo, sweepMat)
    sweep.rotation.x = -Math.PI / 2
    const sweepPivot = new THREE.Group()
    sweepPivot.add(sweep)
    if (!reduced) sweep.onBeforeRender = () => void (sweepPivot.rotation.y -= 0.01)
    group.add(grid, ring, sweepPivot)
    scene.add(group)

    let dust: THREE.Points | undefined
    if (quality !== 'low') {
      const N = quality === 'high' ? 700 : 380
      const pos = new Float32Array(N * 3)
      for (let i = 0; i < N; i++) {
        const r = 120 + Math.random() * 260
        const th = Math.random() * Math.PI * 2
        const ph = Math.acos(2 * Math.random() - 1)
        pos[i * 3] = r * Math.sin(ph) * Math.cos(th)
        pos[i * 3 + 1] = r * Math.cos(ph) * 0.6
        pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      dust = new THREE.Points(g, new THREE.PointsMaterial({ color: accent, size: 1.3, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }))
      scene.add(dust)
    }
    return () => {
      if (floorRef.current === group) floorRef.current = null
      scene.remove(group)
      grid.geometry.dispose()
      gm.dispose()
      ringGeo.dispose()
      ringMat.dispose()
      sweepGeo.dispose()
      sweepMat.dispose()
      if (dust) {
        scene.remove(dust)
        dust.geometry.dispose()
        ;(dust.material as THREE.Material).dispose()
      }
    }
  }, [accent, accent2, quality, reduced])

  // Auto-framing while the layout settles (it can cool down slowly on software renderers):
  // re-fit a few times, but never fight the user – the first manual orbit/zoom stops it.
  const userMoved = useRef(false)
  useEffect(() => {
    const controls = fgRef.current?.controls() as { addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void } | undefined
    const onStart = () => {
      userMoved.current = true
    }
    controls?.addEventListener?.('start', onStart)
    const timers = [1200, 3200, 6500].map((ms) =>
      setTimeout(() => {
        if (!userMoved.current) fit(800)
      }, ms),
    )
    return () => {
      timers.forEach(clearTimeout)
      controls?.removeEventListener?.('start', onStart)
    }
  }, [fit])

  // explicit "fit to view" requests from the toolbar
  useEffect(() => {
    if (fitSignal > 0) fit(700)
  }, [fitSignal, fit])

  const isHl = useCallback((l: GLink) => !!selectedId && (endpointId(l.source) === selectedId || endpointId(l.target) === selectedId), [selectedId])
  const kindColor = useCallback((l: GLink) => (l.kind === 'delegates' ? accent : l.kind === 'reports' ? accent2 : SEMANTIC.violet), [accent, accent2])

  const linkColor = useCallback((l: GLink) => hexA(kindColor(l), isHl(l) ? 0.95 : selectedId ? 0.2 : 0.42), [kindColor, isHl, selectedId])
  const particleColor = useCallback((l: GLink) => (isHl(l) || !selectedId ? kindColor(l) : hexA(kindColor(l), 0.5)), [kindColor, isHl, selectedId])
  const particleWidth = useCallback((l: GLink) => (isHl(l) ? 2.6 : 1.7), [isHl])
  const speed = useCallback((l: GLink) => particleSpeed(l.traffic, reduced), [reduced])
  const { particleSig, maxParticles, data } = model
  const particles = useMemo(() => {
    const counts = new Map(data.links.map((l) => [l.key, particleCount(l.traffic, maxParticles)]))
    return (l: GLink) => counts.get(l.key) ?? 0
    // particleSig changes exactly when a count changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particleSig, maxParticles, data])

  const nodeObject = useCallback((n: GNode) => kit.create(n), [kit])
  const handleClick = useCallback((n: GNode) => onSelect(n.id), [onSelect])
  const handleStop = useCallback(() => {
    if (fitted.current || userMoved.current) return
    fitted.current = true
    fit(900)
  }, [fit])

  return (
    <ForceGraph3D<GNode, GLink>
      ref={fgRef}
      width={width}
      height={height}
      graphData={data}
      controlType="orbit"
      rendererConfig={{ antialias: quality !== 'low', alpha: true, powerPreference: 'high-performance' }}
      backgroundColor="rgba(0,0,0,0)"
      showNavInfo={false}
      nodeThreeObject={nodeObject}
      nodeThreeObjectExtend={false}
      nodeLabel={nodeTooltip}
      linkLabel={linkTooltip}
      linkColor={linkColor}
      linkWidth={linkWidth}
      linkOpacity={1}
      linkCurvature={linkCurvature}
      linkResolution={quality === 'low' ? 4 : 6}
      linkDirectionalParticles={particles}
      linkDirectionalParticleSpeed={speed}
      linkDirectionalParticleWidth={particleWidth}
      linkDirectionalParticleColor={particleColor}
      linkDirectionalParticleResolution={quality === 'low' ? 4 : 8}
      warmupTicks={40}
      cooldownTime={4500}
      onEngineStop={handleStop}
      onNodeClick={handleClick}
      enableNodeDrag
    />
  )
}
