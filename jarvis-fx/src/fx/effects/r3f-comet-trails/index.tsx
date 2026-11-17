import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, Sparkles, Stars, Trail } from '@react-three/drei'
import { Bloom, ChromaticAberration, Noise, Vignette } from '@react-three/postprocessing'
import { AdditiveBlending, BackSide, CanvasTexture, Color, Euler, Vector2, Vector3, type Mesh, type Texture } from 'three'
import { HudComposer } from '@/fx/three/HudComposer'
import { useFxControls } from '@/fx/controls'
import { Redraw, uniformArgs } from '../r3f-kit/util'
import type { FxProps } from '@/fx/types'

interface Orbit {
  a: number // semi-major axis
  e: number // eccentricity
  incl: number
  node: number
  phase: number
  speed: number
  color: string
}

function makeOrbits(n: number, accent: string, accent2: string): Orbit[] {
  const palette = [accent, '#ffffff', accent2, accent]
  return Array.from({ length: n }, (_, i) => {
    const h = (k: number) => Math.abs(Math.sin((i + 1) * 12.9898 * k) * 43758.5453) % 1
    return {
      a: 1.6 + h(1) * 1.9,
      e: 0.25 + h(2) * 0.45,
      incl: (h(3) - 0.5) * 1.3,
      node: h(4) * Math.PI * 2,
      phase: h(5) * Math.PI * 2,
      speed: 0.75 + h(6) * 0.6,
      color: palette[i % palette.length],
    }
  })
}

/** r(θ) of an ellipse with the focus (the core) at the origin */
function radius(o: Orbit, th: number) {
  return (o.a * (1 - o.e * o.e)) / (1 + o.e * Math.cos(th))
}

/* ---------- core ---------- */
const coronaVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const coronaFrag = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(max(-dot(vN, vV), 0.0), 3.0);
    gl_FragColor = vec4(uColor * f * 1.6, f);
  }
`

function Core({ accent, still }: { accent: string; still: boolean }) {
  const ring = useRef<Mesh>(null)
  const uniforms = useMemo(() => ({ uColor: { value: new Color() } }), [])
  uniforms.uColor.value.set(accent)
  useFrame((_, dt) => {
    if (!still && ring.current) ring.current.rotation.z += Math.min(dt, 0.05) * 0.3
  })
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.32, 48, 48]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.95, 48, 48]} />
        <shaderMaterial vertexShader={coronaVert} fragmentShader={coronaFrag} args={uniformArgs(uniforms)} transparent depthWrite={false} blending={AdditiveBlending} side={BackSide} />
      </mesh>
      <mesh ref={ring} rotation-x={Math.PI / 2 - 0.3}>
        <torusGeometry args={[0.55, 0.006, 6, 160, Math.PI * 1.6]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ---------- comet ---------- */
/** Point on the orbit in world space (the trail lives in world space, so no rotated parents). */
function orbitPoint(o: Orbit, th: number, rot: Euler, out: Vector3) {
  const r = radius(o, th)
  return out.set(Math.cos(th) * r, 0, Math.sin(th) * r).applyEuler(rot)
}

/**
 * Still frames (paused / reduced motion): drei Trail only grows while frames run, so the tail would vanish and leave
 * bare dots. Draw the same arc behind the nucleus as a fixed, fading polyline instead.
 */
function StaticTail({ o, rot, span }: { o: Orbit; rot: Euler; span: number }) {
  const { pts, cols } = useMemo(() => {
    const n = 48
    const v = new Vector3()
    const base = new Color(o.color)
    const p: [number, number, number][] = []
    const c: [number, number, number][] = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      orbitPoint(o, o.phase - span * (1 - t), rot, v)
      p.push([v.x, v.y, v.z])
      const k = t * t // brightest at the nucleus, fading into the tail
      c.push([base.r * k, base.g * k, base.b * k])
    }
    return { pts: p, cols: c }
  }, [o, rot, span])
  return <Line points={pts} vertexColors={cols} lineWidth={2} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
}

function Comet({ o, speed, length, width, still, halo }: { o: Orbit; speed: number; length: number; width: number; still: boolean; halo: Texture }) {
  const head = useRef<Mesh>(null)
  const th = useRef(o.phase)
  const rot = useMemo(() => new Euler(o.incl, o.node, 0), [o])
  const start = useMemo(() => orbitPoint(o, o.phase, rot, new Vector3()), [o, rot])
  useFrame((_, dt) => {
    if (!head.current || still) return
    const r = radius(o, th.current)
    const p = o.a * (1 - o.e * o.e)
    // angular speed ∝ 1/r² (Kepler's second law), clamped to stay smooth near perihelion
    th.current += Math.min(dt, 0.05) * speed * o.speed * Math.min((p / r) ** 2, 6) * (0.9 / Math.sqrt(o.a))
    orbitPoint(o, th.current, rot, head.current.position)
  })
  const nucleus = (
    <mesh ref={head} position={start}>
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
      {/* coma: soft additive halo (billboard sprite) around the nucleus */}
      <sprite scale={0.44}>
        <spriteMaterial map={halo} color={o.color} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
    </mesh>
  )
  if (still) {
    return (
      <group>
        <StaticTail o={o} rot={rot} span={0.25 + length * 0.07} />
        {nucleus}
      </group>
    )
  }
  return (
    <Trail width={width} length={length} color={o.color} attenuation={(t) => t * t} decay={1}>
      {nucleus}
    </Trail>
  )
}

function Guide({ o }: { o: Orbit }) {
  const pts = useMemo(() => {
    const rot = new Euler(o.incl, o.node, 0)
    const v = new Vector3()
    const arr: [number, number, number][] = []
    for (let i = 0; i <= 128; i++) {
      orbitPoint(o, (i / 128) * Math.PI * 2, rot, v)
      arr.push([v.x, v.y, v.z])
    }
    return arr
  }, [o])
  return <Line points={pts} color={o.color} lineWidth={0.6} transparent opacity={0.14} depthWrite={false} />
}

function Scene({ accent, accent2, count, speed, length, still, stage, guides }: { accent: string; accent2: string; count: number; speed: number; length: number; still: boolean; stage: boolean; guides: boolean }) {
  const orbits = useMemo(() => makeOrbits(count, accent, accent2), [count, accent, accent2])
  const halo = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 64
    const ctx = cv.getContext('2d')!
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    // steep falloff: a tight coma instead of a flat grey disc
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(0.18, 'rgba(255,255,255,0.4)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.08)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    return new CanvasTexture(cv)
  }, [])
  useEffect(() => () => halo.dispose(), [halo])
  // camera height matches the <Canvas camera> prop (lower on cards, where the orbits fill less of the frame)
  const camY = stage ? 3.4 : 2.9
  // (cards sit further back so the outer orbits stay inside the small frame)
  useFrame((state, dt) => {
    // pointer parallax moves the camera (not the scene) so world-space trails stay consistent
    const cam = state.camera
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 2)
    cam.position.x += (state.pointer.x * 1.6 - cam.position.x) * k
    cam.position.y += (camY + state.pointer.y * 1.2 - cam.position.y) * k
    cam.lookAt(0, 0, 0)
  })
  return (
    <group>
      <Core accent={accent} still={still} />
      {orbits.map((o, i) => (
        <group key={`${i}-${o.color}-${count}`}>
          {guides && <Guide o={o} />}
          <Comet o={o} speed={speed} length={length} width={stage ? 2 : 2.6} still={still} halo={halo} />
        </group>
      ))}
    </group>
  )
}

export default function CometTrails({ accent, accent2, quality, stage, paused, reducedMotion }: FxProps) {
  const c = useFxControls({
    komety: { value: 9, min: 3, max: 14, step: 1 },
    prędkość: { value: 1, min: 0.1, max: 3, step: 0.05 },
    ogon: { value: 7, min: 2, max: 14, step: 0.5 },
    // slider in thousandths of the frame size (Leva shows 0.00 for raw values this small)
    aberracja: { value: 2.5, min: 0, max: 12, step: 0.1 },
    bloom: { value: 1.4, min: 0, max: 3, step: 0.05 },
  })
  const still = paused || reducedMotion
  const dpr: [number, number] = quality === 'high' ? [1, 2] : quality === 'med' ? [1, 1.5] : [1, 1]
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, stage ? 3.4 : 2.9, stage ? 8.6 : 7.7], fov: 45 }}
      frameloop={still ? 'demand' : 'always'}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      role="img"
      aria-label="Komety z ogonami krążące po orbitach eliptycznych"
    >
      <color attach="background" args={['#02060c']} />
      <Redraw on={[c, accent, accent2]} still={still} />
      <Scene accent={accent} accent2={accent2} count={stage ? c.komety : 8} speed={c.prędkość} length={c.ogon} still={still} stage={stage} guides={stage || reducedMotion} />
      <Sparkles count={stage ? 160 : 50} scale={[11, 6, 11]} size={1.8} speed={still ? 0 : 0.35} color={accent} opacity={0.7} />
      <Stars radius={60} depth={30} count={stage ? 2200 : 400} factor={stage ? 3 : 2} fade speed={still ? 0 : 0.5} />
      <HudComposer>
        {stage
          ? [
              <Bloom key="b" intensity={c.bloom} luminanceThreshold={0.12} luminanceSmoothing={0.3} mipmapBlur />,
              <ChromaticAberration key="c" offset={new Vector2(c.aberracja * 0.001, c.aberracja * 0.0006)} radialModulation modulationOffset={0.15} />,
              <Noise key="n" opacity={0.04} />,
              <Vignette key="v" eskil={false} offset={0.2} darkness={0.85} />,
            ]
          : [
              <Bloom key="b" intensity={c.bloom * 0.8} luminanceThreshold={0.12} luminanceSmoothing={0.3} mipmapBlur />,
              <ChromaticAberration key="c" offset={new Vector2(c.aberracja * 0.001, c.aberracja * 0.0006)} radialModulation modulationOffset={0.15} />,
            ]}
      </HudComposer>
    </Canvas>
  )
}
