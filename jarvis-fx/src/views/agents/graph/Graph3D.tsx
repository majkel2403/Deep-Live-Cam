import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d'
import * as THREE from 'three'
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

/**
 * Tight camera fit over the actual node positions (the built-in zoomToFit fits the 3D bbox
 * corners, which leaves a sparse tree tiny). Keeps the current look direction, aims at the
 * cluster centre and returns where the holo-floor should sit.
 */
function fitCamera(fg: FG, nodes: GNode[], viewHeight: number, ms: number, padPx = 30, biasPx = 14): FloorPlace | null {
  const pts = nodes.filter((n) => Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)).map((n) => new THREE.Vector3(n.x, n.y, n.z))
  if (!pts.length || viewHeight <= 0) return null
  const min = pts[0].clone()
  const max = pts[0].clone()
  for (const p of pts) {
    min.min(p)
    max.max(p)
  }
  const center = min.clone().add(max).multiplyScalar(0.5)
  const cam = fg.camera() as THREE.PerspectiveCamera
  cam.updateMatrixWorld()
  const fwd = new THREE.Vector3()
  cam.getWorldDirection(fwd)
  const right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize()
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize()
  const vHalf = (((1 - (padPx * 2) / viewHeight) * cam.fov) / 2) * (Math.PI / 180)
  const hHalf = Math.atan(Math.tan(vHalf) * cam.aspect)
  // node body + label margin, in world units
  const margin = 16
  let dist = 60
  let radius = 0
  for (const p of pts) {
    const l = p.clone().sub(center)
    radius = Math.max(radius, Math.hypot(l.x, l.z))
    dist = Math.max(dist, Math.max((Math.abs(l.dot(up)) + margin) / Math.tan(vHalf), (Math.abs(l.dot(right)) + margin) / Math.tan(hHalf)) - l.dot(fwd))
  }
  // leave head-room for the orbit (extents change while auto-rotating)
  dist *= 1.08
  // bias the framing upwards so the bottom legend overlay does not cover nodes
  const worldPerPx = (2 * dist * Math.tan(((cam.fov / 2) * Math.PI) / 180)) / viewHeight
  const target = center.clone().addScaledVector(up, -biasPx * worldPerPx)
  const pos = target.clone().addScaledVector(fwd, -dist)
  fg.cameraPosition({ x: pos.x, y: pos.y, z: pos.z }, { x: target.x, y: target.y, z: target.z }, ms)
  return { x: center.x, y: min.y - 26, z: center.z, scale: Math.max(0.55, (radius + 30) / FLOOR_R) }
}
const linkCurvature = (l: GLink) => (l.kind === 'tool' ? 0.08 : 0.24)

export default function Graph3D({ snapshot, selectedId, onSelect, width, height, accent, accent2, reduced, quality, autoRotate, fitSignal }: GraphViewProps) {
  const fgRef = useRef<FG | undefined>(undefined)
  const model = useGraphModel(snapshot, quality)
  const [kit] = useState(() => createNodeKit(quality))
  const fitted = useRef(false)
  const floorRef = useRef<THREE.Group | null>(null)
  const floorPlace = useRef<FloorPlace>({ x: 0, y: -78, z: 0, scale: 1 })
  const dataRef = useRef(model.data)
  const sizeRef = useRef(height)
  useEffect(() => {
    dataRef.current = model.data
    sizeRef.current = height
  }, [model.data, height])

  const fit = useCallback((ms: number) => {
    const fg = fgRef.current
    if (!fg) return
    const place = fitCamera(fg, dataRef.current.nodes, sizeRef.current, ms)
    if (!place) return
    floorPlace.current = place
    const floor = floorRef.current
    if (floor) {
      floor.position.set(place.x, place.y, place.z)
      floor.scale.setScalar(place.scale)
    }
  }, [])

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
    fg.d3Force('charge')?.strength(-220)
    fg.d3Force('link')?.distance((l: GLink) => (l.kind === 'tool' ? 80 : 48))
    // squash the layout towards the y=0 plane so the tree spreads over the "holo-table"
    let flat: { y?: number; vy?: number }[] = []
    fg.d3Force(
      'flatten',
      Object.assign(
        (alpha: number) => {
          for (const n of flat) n.vy = (n.vy ?? 0) - (n.y ?? 0) * 0.16 * alpha
        },
        { initialize: (nodes: { y?: number; vy?: number }[]) => void (flat = nodes) },
      ),
    )
    fg.d3ReheatSimulation()
    // elevated "holo-table" viewing angle; zoomToFit keeps this direction
    fg.cameraPosition({ x: 0, y: 105, z: 270 }, { x: 0, y: 0, z: 0 })
    fg.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'med' ? 1.5 : 1))
    fg.resumeAnimation()
    return () => {
      fg.pauseAnimation()
    }
  }, [quality])

  useDisposeOnUnmount(
    useCallback(() => {
      const fg = fgRef.current
      kit.dispose()
      try {
        fg?.renderer().forceContextLoss()
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
