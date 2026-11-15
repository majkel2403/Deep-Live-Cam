import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor, Sparkles } from '@react-three/drei'
import { Bloom, Vignette } from '@react-three/postprocessing'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Group,
} from 'three'
import { HudComposer } from '@/fx/three/HudComposer'
import type { AgentStatus } from '@/lib/agents'
import type { Quality } from '@/lib/store'
import type { CoreMode } from './model'

/**
 * JARVIS core – original R3F scene for the Bridge (one WebGL context for the whole view).
 * Orb (hot core + wire shells + fresnel), load-driven reactor rings, agent "satellites" riding
 * tilted orbits with data beams to the core, a shader accretion disc and event shockwaves.
 * Post-processing goes through the shared <HudComposer> (software-renderer safe).
 *
 * Data arrives through a mutable ref (`feed`) so 1 Hz snapshot updates never re-render the scene graph.
 */
export interface CoreFeed {
  mode: CoreMode
  /** mean agent utilisation 0..1 */
  load: number
  /** root agent load (the orb itself) */
  rootLoad: number
  agents: { id: string; status: AgentStatus; load: number; depth: number }[]
  eventSeq: number
  errorSeq: number
  /** bumps whenever the feed changes (used to invalidate demand-mode frames) */
  version: number
}

const DANGER = new Color('#ff3b5c')
const VIOLET = new Color('#8a7dff')
const WARN = new Color('#ffb000')
const MODE_SPEED: Record<CoreMode, number> = { standby: 0.35, analyze: 0.7, act: 1, alarm: 1.25 }

interface Palette {
  base: Color
  hot: Color
  current: Color
  currentHot: Color
  alarmMix: number
}

/* ---------------------------------------------------------------- shaders (original code) */

const fresnelVert = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vP = position;
  gl_Position = projectionMatrix * mv;
}`

const fresnelFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uPower;
uniform float uGain;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main() {
  float f = pow(1.0 - clamp(abs(dot(vN, vV)), 0.0, 1.0), uPower);
  // slow horizontal scan bands travelling up the shell
  float band = 0.65 + 0.35 * sin(vP.y * 38.0 - uTime * 2.4);
  float alpha = f * band * uGain;
  gl_FragColor = vec4(uColor * (0.7 + f), alpha);
}`

const ringVert = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const ringFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uCount;
uniform float uDuty;
uniform float uFill;
uniform float uBase;
varying vec2 vP;
void main() {
  float a = atan(vP.y, vP.x) / 6.2831853 + 0.5;
  float seg = fract(a * uCount);
  float dash = step((1.0 - uDuty) * 0.5, seg) * step(seg, 1.0 - (1.0 - uDuty) * 0.5);
  float lit = 1.0 - step(uFill, floor(a * uCount) / uCount);
  float alpha = dash * mix(uBase, 1.0, lit);
  gl_FragColor = vec4(uColor * mix(0.55, 1.5, lit), alpha);
}`

const discVert = /* glsl */ `
uniform float uTime;
uniform float uSize;
attribute float aRadius;
attribute float aAngle;
attribute float aSpeed;
attribute float aHeight;
attribute float aSeed;
varying float vAlpha;
void main() {
  float ang = aAngle + uTime * aSpeed;
  float r = aRadius + sin(uTime * 0.7 + aSeed * 6.2831) * 0.025;
  vec3 p = vec3(cos(ang) * r, aHeight, sin(ang) * r);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float twinkle = 0.55 + 0.45 * sin(uTime * (1.3 + aSeed * 2.7) + aSeed * 37.0);
  vAlpha = twinkle * smoothstep(2.7, 1.2, r) * smoothstep(0.55, 0.85, r);
  gl_PointSize = uSize * (0.45 + aSeed * 0.9) / -mv.z;
}`

const discFrag = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor * (0.7 + a * 0.8), a * vAlpha);
}`

/* ---------------------------------------------------------------- pieces */

function Orb({ palette, feed, speed, kick }: { palette: Palette; feed: RefObject<CoreFeed>; speed: RefObject<number>; kick: RefObject<number> }) {
  const group = useRef<Group>(null)
  const wireA = useRef<Mesh>(null)
  const wireB = useRef<Mesh>(null)
  const inner = useRef<MeshBasicMaterial>(null)
  const wireMatA = useRef<MeshBasicMaterial>(null)
  const wireMatB = useRef<MeshBasicMaterial>(null)
  const shell = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: fresnelVert,
        fragmentShader: fresnelFrag,
        uniforms: { uColor: { value: palette.current }, uTime: { value: 0 }, uPower: { value: 2.2 }, uGain: { value: 1.1 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [palette],
  )
  useEffect(() => () => shell.dispose(), [shell])
  const t = useRef(0)

  useFrame((_, dt) => {
    const s = speed.current ?? 1
    t.current += dt * s
    const root = feed.current?.rootLoad ?? 0.3
    const k = kick.current ?? 0
    const pulse = 1 + Math.sin(t.current * 2.4) * 0.035 + k * 0.12
    group.current?.scale.setScalar(pulse)
    if (wireA.current) {
      wireA.current.rotation.y += dt * 0.25 * s
      wireA.current.rotation.x += dt * 0.08 * s
    }
    if (wireB.current) {
      wireB.current.rotation.y -= dt * 0.4 * s
      wireB.current.rotation.z += dt * 0.12 * s
    }
    shell.uniforms.uTime.value = t.current
    shell.uniforms.uGain.value = 0.9 + root * 0.6 + k * 0.6
    inner.current?.color.copy(palette.currentHot)
    wireMatA.current?.color.copy(palette.current)
    wireMatB.current?.color.copy(palette.currentHot)
  })

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[0.24, 32, 24]} />
        <meshBasicMaterial ref={inner} toneMapped={false} />
      </mesh>
      <mesh ref={wireB}>
        <icosahedronGeometry args={[0.36, 0]} />
        <meshBasicMaterial ref={wireMatB} wireframe transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={wireA}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshBasicMaterial ref={wireMatA} wireframe transparent opacity={0.4} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh material={shell}>
        <sphereGeometry args={[0.58, 48, 32]} />
      </mesh>
    </group>
  )
}

function makeRingMaterial(color: Color, count: number, duty: number, base: number) {
  return new ShaderMaterial({
    vertexShader: ringVert,
    fragmentShader: ringFrag,
    uniforms: { uColor: { value: color }, uCount: { value: count }, uDuty: { value: duty }, uFill: { value: 1 }, uBase: { value: base } },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  })
}

/** Equatorial reactor rings: the outer one lights up segment by segment with the mean agent load. */
function ReactorRings({ palette, feed, speed, reduced }: { palette: Palette; feed: RefObject<CoreFeed>; speed: RefObject<number>; reduced: boolean }) {
  const outer = useRef<Mesh>(null)
  const inner = useRef<Mesh>(null)
  const mats = useMemo(() => ({ outer: makeRingMaterial(palette.current, 64, 0.62, 0.16), inner: makeRingMaterial(palette.current, 12, 0.72, 0.55), fine: makeRingMaterial(palette.current, 180, 0.35, 0.5) }), [palette])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])

  useFrame((_, dt) => {
    const s = speed.current ?? 1
    const target = feed.current?.load ?? 0
    const u = mats.outer.uniforms.uFill
    u.value = reduced ? target : u.value + (target - u.value) * Math.min(1, dt * 2.5)
    if (outer.current) outer.current.rotation.z += dt * 0.06 * s
    if (inner.current) inner.current.rotation.z -= dt * 0.22 * s
  })

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={outer} material={mats.outer}>
        <ringGeometry args={[0.96, 1.02, 256, 1]} />
      </mesh>
      <mesh ref={inner} material={mats.inner}>
        <ringGeometry args={[0.74, 0.765, 128, 1]} />
      </mesh>
      <mesh material={mats.fine}>
        <ringGeometry args={[1.07, 1.085, 256, 1]} />
      </mesh>
    </group>
  )
}

const ORBITS = [
  { r: 1.22, tilt: new Euler(Math.PI / 2 - 0.32, 0, 0.28), speed: 0.24 },
  { r: 1.5, tilt: new Euler(Math.PI / 2 + 0.42, 0, -0.36), speed: -0.17 },
  { r: 1.76, tilt: new Euler(Math.PI / 2 - 0.12, 0.5, 0.62), speed: 0.11 },
]
const MAX_SAT = 24

function statusColor(status: AgentStatus, palette: Palette, out: Color): Color {
  switch (status) {
    case 'running':
      return out.copy(palette.currentHot).multiplyScalar(1.6)
    case 'thinking':
      return out.copy(VIOLET).multiplyScalar(1.6)
    case 'waiting':
      return out.copy(WARN).multiplyScalar(1.2)
    case 'error':
      return out.copy(DANGER).multiplyScalar(2)
    case 'offline':
      return out.setRGB(0.12, 0.14, 0.16)
    default:
      return out.copy(palette.current).multiplyScalar(0.45)
  }
}

/** Tilted orbit rings + one satellite per agent + beams from busy agents to the core. */
function AgentOrbits({ palette, feed, speed }: { palette: Palette; feed: RefObject<CoreFeed>; speed: RefObject<number> }) {
  const tori = useRef<(Mesh | null)[]>([])
  const torusMats = useRef<(MeshBasicMaterial | null)[]>([])
  const sats = useRef<InstancedMesh>(null)
  const beams = useRef<LineSegments>(null)
  const t = useRef(0)
  const tmp = useMemo(() => ({ q: new Quaternion(), qp: new Quaternion(), qt: new Quaternion(), v: new Vector3(), m: new Matrix4(), o: new Object3D(), c: new Color(), y: new Vector3(0, 1, 0) }), [])
  const beamGeo = useMemo(() => {
    const g = new BufferGeometry()
    const pos = new BufferAttribute(new Float32Array(MAX_SAT * 2 * 3), 3)
    const col = new BufferAttribute(new Float32Array(MAX_SAT * 2 * 3), 3)
    pos.setUsage(DynamicDrawUsage)
    col.setUsage(DynamicDrawUsage)
    g.setAttribute('position', pos)
    g.setAttribute('color', col)
    g.setDrawRange(0, 0)
    return g
  }, [])
  useEffect(() => () => beamGeo.dispose(), [beamGeo])

  useFrame((_, dt) => {
    const s = speed.current ?? 1
    t.current += dt * s
    const precess = t.current * 0.05
    const quats = ORBITS.map((o, i) => {
      tmp.qp.setFromAxisAngle(tmp.y, precess * (i % 2 ? -1 : 1))
      return new Quaternion().setFromEuler(o.tilt).premultiply(tmp.qp)
    })
    ORBITS.forEach((_, i) => {
      tori.current[i]?.quaternion.copy(quats[i])
      torusMats.current[i]?.color.copy(palette.current)
    })

    const mesh = sats.current
    const f = feed.current
    if (!mesh || !f) return
    const list = f.agents.filter((a) => a.depth > 0).slice(0, MAX_SAT)
    const perOrbit = ORBITS.map(() => 0)
    list.forEach((a) => perOrbit[Math.min(ORBITS.length - 1, a.depth - 1)]++)
    const idxInOrbit = ORBITS.map(() => 0)
    const pos = beamGeo.attributes.position as BufferAttribute
    const col = beamGeo.attributes.color as BufferAttribute
    let beamCount = 0
    list.forEach((a, i) => {
      const oi = Math.min(ORBITS.length - 1, a.depth - 1)
      const o = ORBITS[oi]
      const k = idxInOrbit[oi]++
      const ang = (k / Math.max(1, perOrbit[oi])) * Math.PI * 2 + t.current * o.speed + oi * 0.7
      // torus lies in its local XY plane
      tmp.v.set(Math.cos(ang) * o.r, Math.sin(ang) * o.r, 0).applyQuaternion(quats[oi])
      tmp.o.position.copy(tmp.v)
      tmp.o.scale.setScalar(0.7 + a.load * 0.9 + (a.status === 'error' ? 0.5 : 0))
      tmp.o.updateMatrix()
      mesh.setMatrixAt(i, tmp.o.matrix)
      statusColor(a.status, palette, tmp.c)
      mesh.setColorAt(i, tmp.c)
      if (a.status === 'running' || a.status === 'thinking' || a.status === 'error') {
        const b = beamCount * 2
        pos.setXYZ(b, 0, 0, 0)
        pos.setXYZ(b + 1, tmp.v.x, tmp.v.y, tmp.v.z)
        const g = 0.15 + a.load * 0.5
        col.setXYZ(b, 0, 0, 0)
        col.setXYZ(b + 1, tmp.c.r * g, tmp.c.g * g, tmp.c.b * g)
        beamCount++
      }
    })
    mesh.count = list.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    pos.needsUpdate = true
    col.needsUpdate = true
    beamGeo.setDrawRange(0, beamCount * 2)
    if (beams.current) beams.current.visible = beamCount > 0
  })

  return (
    <group>
      {ORBITS.map((o, i) => (
        <mesh key={o.r} ref={(m) => void (tori.current[i] = m)}>
          <torusGeometry args={[o.r, 0.0045, 6, 220]} />
          <meshBasicMaterial ref={(m) => void (torusMats.current[i] = m)} transparent opacity={0.5 - i * 0.1} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      <instancedMesh ref={sats} args={[undefined, undefined, MAX_SAT]} frustumCulled={false}>
        <sphereGeometry args={[0.05, 14, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <lineSegments ref={beams} geometry={beamGeo} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </lineSegments>
    </group>
  )
}

/** Shader-animated accretion disc (positions computed on the GPU from per-particle orbits). */
function Accretion({ palette, speed, count, dpr }: { palette: Palette; speed: RefObject<number>; count: number; dpr: number }) {
  const { geo, mat } = useMemo(() => {
    const g = new BufferGeometry()
    const radius = new Float32Array(count)
    const angle = new Float32Array(count)
    const spd = new Float32Array(count)
    const height = new Float32Array(count)
    const seed = new Float32Array(count)
    let s = 9001
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
    for (let i = 0; i < count; i++) {
      // denser near the reactor ring, sparse halo outwards
      const u = rnd()
      const r = 0.85 + Math.pow(u, 1.7) * 1.85
      radius[i] = r
      angle[i] = rnd() * Math.PI * 2
      spd[i] = (0.55 / Math.pow(r, 1.5)) * (0.7 + rnd() * 0.6)
      height[i] = (rnd() - 0.5) * 0.09 * r * r
      seed[i] = rnd()
    }
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aRadius', new BufferAttribute(radius, 1))
    g.setAttribute('aAngle', new BufferAttribute(angle, 1))
    g.setAttribute('aSpeed', new BufferAttribute(spd, 1))
    g.setAttribute('aHeight', new BufferAttribute(height, 1))
    g.setAttribute('aSeed', new BufferAttribute(seed, 1))
    const m = new ShaderMaterial({
      vertexShader: discVert,
      fragmentShader: discFrag,
      uniforms: { uTime: { value: 0 }, uSize: { value: 15 * dpr }, uColor: { value: palette.current } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    return { geo: g, mat: m }
  }, [count, dpr, palette])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt * (speed.current ?? 1)
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}

/** Pooled expanding rings, fired on new orchestration events (red for errors). */
function Shockwaves({ palette, feed, kick, reduced }: { palette: Palette; feed: RefObject<CoreFeed>; kick: RefObject<number>; reduced: boolean }) {
  const meshes = useRef<(Mesh | null)[]>([])
  const state = useRef({ ev: -1, err: -1, next: 0, life: [0, 0, 0], err3: [false, false, false] })
  useFrame((_, dt) => {
    const f = feed.current
    const st = state.current
    if (!f) return
    if (st.ev < 0) {
      st.ev = f.eventSeq
      st.err = f.errorSeq
    }
    if (!reduced && f.eventSeq !== st.ev) {
      const isErr = f.errorSeq !== st.err
      st.ev = f.eventSeq
      st.err = f.errorSeq
      const i = st.next++ % 3
      st.life[i] = 1
      st.err3[i] = isErr
      kick.current = isErr ? 1 : 0.6
    }
    kick.current = Math.max(0, (kick.current ?? 0) - dt * 1.8)
    meshes.current.forEach((m, i) => {
      if (!m) return
      const l = st.life[i]
      m.visible = l > 0
      if (l <= 0) return
      st.life[i] = Math.max(0, l - dt * 0.75)
      const p = 1 - st.life[i]
      m.scale.setScalar(0.6 + p * 2.1)
      const mat = m.material as MeshBasicMaterial
      mat.opacity = (1 - p) * (st.err3[i] ? 0.95 : 0.6)
      mat.color.copy(st.err3[i] ? DANGER : palette.currentHot)
    })
  })
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => void (meshes.current[i] = m)} visible={false}>
          <ringGeometry args={[0.97, 1, 160, 1]} />
          <meshBasicMaterial transparent opacity={0} side={DoubleSide} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

/** Global driver: colour (alarm tint), speed by mode, pointer parallax. */
function Driver({ palette, feed, speed, rig, reduced }: { palette: Palette; feed: RefObject<CoreFeed>; speed: RefObject<number>; rig: RefObject<Group | null>; reduced: boolean }) {
  useFrame((state, dt) => {
    const f = feed.current
    const mode = f?.mode ?? 'standby'
    const k = reduced ? 1 : Math.min(1, dt * 3)
    palette.alarmMix += ((mode === 'alarm' ? 0.85 : 0) - palette.alarmMix) * k
    palette.current.copy(palette.base).lerp(DANGER, palette.alarmMix)
    palette.currentHot.copy(palette.hot).lerp(DANGER, palette.alarmMix * 0.8)
    const target = reduced ? 0 : MODE_SPEED[mode] * (0.75 + (f?.load ?? 0) * 0.6)
    speed.current = (speed.current ?? 0) + (target - (speed.current ?? 0)) * k
    const g = rig.current
    if (g && !reduced) {
      g.rotation.y += (state.pointer.x * 0.22 - g.rotation.y) * Math.min(1, dt * 2)
      g.rotation.x += (-state.pointer.y * 0.12 + 0.18 - g.rotation.x) * Math.min(1, dt * 2)
    }
  })
  return null
}

/** Keeps the composition framed when the viewport is taller than wide. */
function CameraFit() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    const z = 5.4 / Math.min(1, aspect)
    camera.position.set(0, 0.55 * (z / 5.4), z)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

/** In demand mode (reduced motion) render one frame per feed update. */
function Invalidator({ version }: { version: number }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    invalidate()
  }, [version, invalidate])
  return null
}

export default function CoreCanvas({
  feed,
  accent,
  hot,
  bg,
  quality,
  reducedMotion,
  running,
  version,
}: {
  feed: RefObject<CoreFeed>
  accent: string
  hot: string
  bg: string
  quality: Quality
  reducedMotion: boolean
  /** false → stop the render loop (tab hidden / scrolled out of view) */
  running: boolean
  version: number
}) {
  const palette = useMemo<Palette>(() => ({ base: new Color(), hot: new Color(), current: new Color(), currentHot: new Color(), alarmMix: 0 }), [])
  palette.base.set(accent)
  palette.hot.set(hot).lerp(new Color('#ffffff'), 0.35)
  if (palette.current.getHex() === 0) {
    palette.current.copy(palette.base)
    palette.currentHot.copy(palette.hot)
  }
  const speed = useRef(0.5)
  const kick = useRef(0)
  const rig = useRef<Group>(null)
  const maxDpr = quality === 'high' ? 2 : quality === 'med' ? 1.5 : 1
  // adaptive resolution (drei PerformanceMonitor): drop the pixel ratio on slow devices, raise it back when fps recovers
  const [dprScale, setDprScale] = useState(1)
  const deviceDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const dpr = Math.max(0.5, Math.min(deviceDpr, maxDpr) * dprScale)
  const particleCount = quality === 'high' ? 3600 : quality === 'med' ? 2000 : 900
  const animate = running && !reducedMotion

  return (
    <Canvas
      dpr={dpr}
      frameloop={animate ? 'always' : 'demand'}
      camera={{ position: [0, 0.55, 5.4], fov: 42, near: 0.1, far: 60 }}
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' }}
      aria-hidden="true"
    >
      <color attach="background" args={[bg]} />
      {animate && (
        <PerformanceMonitor
          flipflops={4}
          onDecline={() => setDprScale((s) => Math.max(0.5, s - 0.25))}
          onIncline={() => setDprScale((s) => Math.min(1, s + 0.25))}
          onFallback={() => setDprScale(0.5)}
        />
      )}
      <CameraFit />
      {!animate && running && <Invalidator version={version} />}
      <Driver palette={palette} feed={feed} speed={speed} rig={rig} reduced={reducedMotion} />
      <group ref={rig} rotation={[0.18, 0, 0]}>
        <Orb palette={palette} feed={feed} speed={speed} kick={kick} />
        <ReactorRings palette={palette} feed={feed} speed={speed} reduced={reducedMotion} />
        <AgentOrbits palette={palette} feed={feed} speed={speed} />
        <Accretion palette={palette} speed={speed} count={particleCount} dpr={dpr} />
        <Shockwaves palette={palette} feed={feed} kick={kick} reduced={reducedMotion} />
      </group>
      {quality !== 'low' && <Sparkles count={quality === 'high' ? 90 : 50} scale={[7, 4, 3]} size={1.6} speed={reducedMotion ? 0 : 0.25} opacity={0.45} color={accent} />}
      <HudComposer>
        <Bloom intensity={1.35} luminanceThreshold={0.1} luminanceSmoothing={0.35} mipmapBlur radius={0.72} />
        <Vignette eskil={false} offset={0.3} darkness={0.72} />
      </HudComposer>
    </Canvas>
  )
}
