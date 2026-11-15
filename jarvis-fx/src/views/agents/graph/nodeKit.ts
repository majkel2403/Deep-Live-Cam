import * as THREE from 'three'
import type { Quality } from '@/lib/store'
import { STATUS_META, statusHex } from '../model'
import type { GNode } from './model'

/**
 * Holographic node visuals for react-force-graph-3d (original code).
 * Each agent = wireframe shell + solid core + additive glow sprite + selection torus + text sprite.
 * Size follows load, colour follows status; changes are eased per frame in onBeforeRender
 * (the force-graph render loop already runs every frame, so no extra rAF is needed).
 */
export interface KitState {
  accent: string
  accent2: string
  selectedId: string | null
  reduced: boolean
}

interface Visual {
  node: GNode
  root: THREE.Group
  body: THREE.Group
  core: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>
  shell: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>
  halo: THREE.Sprite
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>
  /** partial gimbal arc – second half of the selection reticle */
  gimbal: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>
  label: THREE.Sprite
  labelCanvas: HTMLCanvasElement
  labelTex: THREE.CanvasTexture
  labelKey: string
  targetScale: number
  targetColor: THREE.Color
  phase: number
}

export const nodeRadius = (load: number) => 4.6 + load * 6.5

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.18, 'rgba(255,255,255,0.55)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.14)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function createNodeKit(quality: Quality) {
  const detail = quality === 'low' ? 1 : 2
  const coreGeo = new THREE.IcosahedronGeometry(0.62, detail)
  const shellGeo = new THREE.IcosahedronGeometry(1, 1)
  const ringGeo = new THREE.TorusGeometry(1.6, 0.075, 6, quality === 'low' ? 48 : 96)
  const gimbalGeo = new THREE.TorusGeometry(2.05, 0.055, 4, quality === 'low' ? 32 : 64, Math.PI * 1.25)
  const glow = glowTexture()
  const visuals = new Map<string, Visual>()
  const state: KitState = { accent: '#00d8ff', accent2: '#47e1ff', selectedId: null, reduced: false }

  function drawLabel(v: Visual) {
    const a = v.node.agent
    const key = `${a.name}|${a.status}|${Math.round(a.load * 100)}|${state.accent}|${state.selectedId === a.id}`
    if (key === v.labelKey) return
    v.labelKey = key
    const c = v.labelCanvas
    const g = c.getContext('2d')!
    g.clearRect(0, 0, c.width, c.height)
    const selected = state.selectedId === a.id
    const col = statusHex(a.status, state.accent)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    // name
    g.font = '600 50px Oxanium, "Chakra Petch", sans-serif'
    ;(g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '5px'
    g.shadowColor = selected ? state.accent2 : state.accent
    g.shadowBlur = selected ? 18 : 10
    g.fillStyle = selected ? '#ffffff' : '#dff8ff'
    g.fillText(a.name.toUpperCase().slice(0, 16), c.width / 2, 46)
    // status + load
    g.shadowBlur = 6
    g.shadowColor = col
    g.font = '700 32px Rajdhani, "Chakra Petch", sans-serif'
    ;(g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '4px'
    g.fillStyle = col
    g.fillText(`${STATUS_META[a.status].short} · ${Math.round(a.load * 100)}%`, c.width / 2, 104)
    // bracket underline
    g.shadowBlur = 0
    g.strokeStyle = selected ? state.accent2 : 'rgba(255,255,255,0.25)'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(c.width / 2 - 120, 128)
    g.lineTo(c.width / 2 + 120, 128)
    g.stroke()
    v.labelTex.needsUpdate = true
  }

  function apply(v: Visual) {
    const a = v.node.agent
    const col = statusHex(a.status, state.accent)
    v.targetColor.set(col)
    v.targetScale = nodeRadius(a.load)
    const selected = state.selectedId === a.id
    v.ring.visible = selected
    v.gimbal.visible = selected
    v.ring.material.color.set(state.accent2)
    v.gimbal.material.color.set(state.accent)
    v.shell.material.opacity = a.status === 'offline' ? 0.15 : selected ? 0.75 : 0.42
    v.core.material.opacity = a.status === 'offline' ? 0.35 : 0.92
    drawLabel(v)
    if (state.reduced) {
      v.body.scale.setScalar(v.targetScale)
      v.core.material.color.copy(v.targetColor)
      v.shell.material.color.copy(v.targetColor)
      ;(v.halo.material as THREE.SpriteMaterial).color.copy(v.targetColor)
    }
  }

  function create(node: GNode): THREE.Object3D {
    const prev = visuals.get(node.id)
    if (prev) dispose(prev)
    const root = new THREE.Group()
    const body = new THREE.Group()
    const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.92 }))
    const shell = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.42 }))
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }))
    halo.scale.setScalar(4.4)
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 }))
    ring.rotation.x = Math.PI / 2.4
    const gimbal = new THREE.Mesh(gimbalGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8 }))
    gimbal.rotation.y = Math.PI / 2.2
    body.add(halo, shell, core, ring, gimbal)
    const labelCanvas = document.createElement('canvas')
    labelCanvas.width = 512
    labelCanvas.height = 140
    const labelTex = new THREE.CanvasTexture(labelCanvas)
    labelTex.colorSpace = THREE.SRGBColorSpace
    labelTex.anisotropy = 4
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false }))
    label.scale.set(46, 12.6, 1)
    label.renderOrder = 20
    root.add(body, label)

    const v: Visual = {
      node,
      root,
      body,
      core,
      shell,
      halo,
      ring,
      gimbal,
      label,
      labelCanvas,
      labelTex,
      labelKey: '',
      targetScale: nodeRadius(node.agent.load),
      targetColor: new THREE.Color(statusHex(node.agent.status, state.accent)),
      phase: Math.random() * Math.PI * 2,
    }
    body.scale.setScalar(v.targetScale)
    core.material.color.copy(v.targetColor)
    shell.material.color.copy(v.targetColor)
    ;(halo.material as THREE.SpriteMaterial).color.copy(v.targetColor)

    // per-frame easing + idle animation (runs inside the graph's own render loop)
    core.onBeforeRender = () => {
      const t = performance.now() / 1000
      const k = state.reduced ? 1 : 0.08
      const s = body.scale.x + (v.targetScale - body.scale.x) * k
      body.scale.setScalar(s)
      core.material.color.lerp(v.targetColor, k)
      shell.material.color.copy(core.material.color)
      const hm = halo.material as THREE.SpriteMaterial
      hm.color.copy(core.material.color)
      label.position.y = s * 1.3 + 7
      if (state.reduced) return
      const st = v.node.agent.status
      shell.rotation.y += st === 'running' ? 0.02 : st === 'thinking' ? 0.012 : 0.004
      shell.rotation.x += 0.002
      ring.rotation.z += 0.015
      gimbal.rotation.z -= 0.022
      const pulse = st === 'thinking' ? 0.5 + 0.5 * Math.sin(t * 4 + v.phase) : st === 'error' ? (Math.sin(t * 10) > 0 ? 1 : 0.2) : 0.75
      hm.opacity = 0.35 + 0.45 * pulse
    }

    visuals.set(node.id, v)
    apply(v)
    return root
  }

  function dispose(v: Visual) {
    v.core.material.dispose()
    v.shell.material.dispose()
    ;(v.halo.material as THREE.SpriteMaterial).dispose()
    v.ring.material.dispose()
    v.gimbal.material.dispose()
    ;(v.label.material as THREE.SpriteMaterial).dispose()
    v.labelTex.dispose()
    v.core.onBeforeRender = () => {}
    visuals.delete(v.node.id)
  }

  return {
    state,
    create,
    /** push the latest data / selection / colours into every visual */
    sync(nodes: GNode[], next: Partial<KitState>) {
      Object.assign(state, next)
      const alive = new Set(nodes.map((n) => n.id))
      for (const v of [...visuals.values()]) {
        if (!alive.has(v.node.id)) {
          dispose(v)
          continue
        }
        apply(v)
      }
    },
    /** fonts may arrive after the first label draw */
    redrawLabels() {
      for (const v of visuals.values()) {
        v.labelKey = ''
        drawLabel(v)
      }
    },
    dispose() {
      for (const v of [...visuals.values()]) dispose(v)
      coreGeo.dispose()
      shellGeo.dispose()
      ringGeo.dispose()
      gimbalGeo.dispose()
      glow.dispose()
    },
  }
}

export type NodeKit = ReturnType<typeof createNodeKit>
