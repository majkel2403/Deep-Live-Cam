import * as THREE from 'three'
import type { Quality } from '@/lib/store'
import { tintWhite } from '../hooks'
import { STATUS_META, statusHex } from '../model'
import type { GNode } from './model'

/**
 * Holographic node visuals for react-force-graph-3d (original code).
 * Each agent = wireframe shell + solid core + additive glow sprite + selection torus + text sprite.
 * Size follows load, colour follows status; changes are eased per frame in onBeforeRender
 * (the force-graph render loop already runs every frame, so no extra rAF is needed).
 * Labels are screen-space sprites (sizeAttenuation off): a constant pixel height, so far nodes
 * stay legible and near ones do not balloon while the camera orbits.
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
  /** drawn width of the widest label line (canvas px) – used for screen-space decluttering */
  labelW: number
  /** label opacity the per-frame easing heads to (dimmed when it overlaps a nearer label) */
  labelAlpha: number
  targetScale: number
  targetColor: THREE.Color
  phase: number
}

export const nodeRadius = (load: number) => 4.6 + load * 6.5

const LABEL_W = 512
const LABEL_H = 128
/** on-screen label height in CSS px (canvas is drawn at 512×128, i.e. name ≈ 13.5 px, status ≈ 10 px) */
const LABEL_PX = 31
/** compact labels on small viewports (phones, short panels) */
const labelPx = (viewHeight: number) => (viewHeight < 300 ? LABEL_PX * 0.85 : LABEL_PX)

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
  // sprite scale that yields LABEL_PX on screen (see three.js sprite shader without size attenuation)
  const labelScale = new THREE.Vector2(0.2, 0.06)

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
    const ls = g as CanvasRenderingContext2D & { letterSpacing?: string }
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    // name (shrinks to fit long names)
    const name = a.name.toUpperCase().slice(0, 18)
    let size = 56
    ls.letterSpacing = '5px'
    g.font = `600 ${size}px Oxanium, "Chakra Petch", sans-serif`
    const w = g.measureText(name).width
    if (w > c.width - 24) {
      size = Math.max(30, Math.floor((size * (c.width - 24)) / w))
      g.font = `600 ${size}px Oxanium, "Chakra Petch", sans-serif`
    }
    g.shadowColor = selected ? state.accent2 : state.accent
    g.shadowBlur = selected ? 16 : 9
    g.fillStyle = selected ? '#ffffff' : tintWhite(state.accent, 0.14)
    g.fillText(name, c.width / 2, 36)
    const nameW = g.measureText(name).width
    // status + load
    g.shadowBlur = 5
    g.shadowColor = col
    g.font = '700 40px Rajdhani, "Chakra Petch", sans-serif'
    ls.letterSpacing = '4px'
    g.fillStyle = col
    const statusText = `${STATUS_META[a.status].short} · ${Math.round(a.load * 100)}%`
    g.fillText(statusText, c.width / 2, 88)
    v.labelW = Math.max(nameW, g.measureText(statusText).width) + 12
    // bracket underline (anchor of the label – the sprite's bottom edge sits above the node)
    g.shadowBlur = 0
    g.strokeStyle = selected ? state.accent2 : 'rgba(255,255,255,0.28)'
    g.lineWidth = selected ? 4 : 2
    g.beginPath()
    g.moveTo(c.width / 2 - 110, 118)
    g.lineTo(c.width / 2 + 110, 118)
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
    labelCanvas.width = LABEL_W
    labelCanvas.height = LABEL_H
    const labelTex = new THREE.CanvasTexture(labelCanvas)
    labelTex.colorSpace = THREE.SRGBColorSpace
    labelTex.anisotropy = 4
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false, sizeAttenuation: false }))
    label.center.set(0.5, 0)
    label.scale.set(labelScale.x, labelScale.y, 1)
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
      labelW: LABEL_W * 0.6,
      labelAlpha: 1,
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
      label.position.y = s * 1.15 + 1.5
      const lm = label.material as THREE.SpriteMaterial
      lm.opacity += (v.labelAlpha - lm.opacity) * (state.reduced ? 1 : 0.15)
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
    /**
     * Screen-space declutter: labels are tested nearest-first; one that overlaps an already placed
     * label is dimmed (the selected agent always stays fully visible and wins the overlap test).
     */
    declutter(camera: THREE.Camera, viewW: number, viewH: number) {
      if (viewW <= 0 || viewH <= 0) return
      const px = labelPx(viewH)
      const k = px / LABEL_H
      const tmp = new THREE.Vector3()
      const items = [...visuals.values()].map((v) => {
        v.label.getWorldPosition(tmp)
        const depth = tmp.distanceTo(camera.position)
        tmp.project(camera)
        const x = ((tmp.x + 1) / 2) * viewW
        const y = ((1 - tmp.y) / 2) * viewH
        const w = v.labelW * k
        const sel = state.selectedId === v.node.id
        return { v, sel, depth, behind: tmp.z > 1, r: { l: x - w / 2, r: x + w / 2, t: y - px * 0.92, b: y } }
      })
      items.sort((a, b) => Number(b.sel) - Number(a.sel) || a.depth - b.depth)
      const placed: { l: number; r: number; t: number; b: number }[] = []
      for (const it of items) {
        const hit = !it.behind && placed.some((p) => it.r.l < p.r && it.r.r > p.l && it.r.t < p.b && it.r.b > p.t)
        it.v.labelAlpha = hit ? 0.16 : 1
        if (!hit) placed.push(it.r)
      }
    },
    /** viewport height (px) + camera fov (deg) → constant on-screen label size */
    setView(viewHeight: number, fovDeg: number) {
      if (viewHeight <= 0) return
      const p11 = 1 / Math.tan(((fovDeg / 2) * Math.PI) / 180)
      const px = labelPx(viewHeight)
      labelScale.y = (2 * px) / (viewHeight * p11)
      labelScale.x = labelScale.y * (LABEL_W / LABEL_H)
      for (const v of visuals.values()) v.label.scale.set(labelScale.x, labelScale.y, 1)
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
