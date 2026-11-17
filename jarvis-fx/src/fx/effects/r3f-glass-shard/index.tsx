import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer, MeshTransmissionMaterial, Sparkles } from '@react-three/drei'
import { Bloom, ChromaticAberration, Noise, Vignette } from '@react-three/postprocessing'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, EdgesGeometry, LatheGeometry, Object3D, Vector2, type Group, type InstancedMesh, type Mesh } from 'three'
import { HudComposer } from '@/fx/three/HudComposer'
import { useFxControls } from '@/fx/controls'
import { Redraw, tint, uniformArgs } from '../r3f-kit/util'
import type { FxProps } from '@/fx/types'

const BG = new Color('#02060c')

/** Double-terminated hexagonal quartz, flat-shaded. */
function makeCrystal(height: number, radius: number) {
  const h = height / 2
  const profile = [new Vector2(0, -h), new Vector2(radius * 0.92, -h * 0.52), new Vector2(radius, -h * 0.3), new Vector2(radius * 0.96, h * 0.38), new Vector2(radius * 0.8, h * 0.56), new Vector2(0, h)]
  const lathe = new LatheGeometry(profile, 6)
  const flat = lathe.toNonIndexed()
  lathe.dispose()
  flat.computeVertexNormals()
  return flat
}

/* ---------- crystal ---------- */
interface CrystalProps {
  accent: string
  ior: number
  thickness: number
  chroma: number
  distortion: number
  speed: number
  still: boolean
  samples: number
  resolution: number
  backside: boolean
}

function Crystal({ accent, ior, thickness, chroma, distortion, speed, still, samples, resolution, backside }: CrystalProps) {
  const ref = useRef<Mesh>(null)
  const geo = useMemo(() => makeCrystal(3.1, 0.78), [])
  // crisp facet edges: keep the silhouette readable even when transmission is low-sample (cards, software GL)
  const edges = useMemo(() => new EdgesGeometry(geo, 20), [geo])
  useEffect(
    () => () => {
      geo.dispose()
      edges.dispose()
    },
    [geo, edges],
  )
  const glass = useMemo(() => tint(accent, 0.9), [accent])
  const edge = useMemo(() => tint(accent, 0.45), [accent])
  useFrame((state, dt) => {
    const m = ref.current
    if (!m || still) return
    const d = Math.min(dt, 0.05)
    m.rotation.y += d * speed * 0.45
    m.rotation.z = 0.32 + Math.sin(state.clock.elapsedTime * 0.4) * 0.08
    m.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.08
  })
  return (
    <mesh ref={ref} geometry={geo} rotation={[0.1, 0.4, 0.32]}>
      <MeshTransmissionMaterial
        samples={samples}
        resolution={resolution}
        backside={backside}
        backsideThickness={0.6}
        thickness={thickness}
        ior={ior}
        chromaticAberration={chroma}
        anisotropicBlur={0.04}
        distortion={distortion}
        distortionScale={0.4}
        temporalDistortion={still ? 0 : 0.08}
        roughness={0.04}
        clearcoat={1}
        attenuationColor={accent}
        attenuationDistance={2.4}
        color={glass}
        background={BG}
      />
      <lineSegments geometry={edges} scale={1.002}>
        <lineBasicMaterial color={edge} transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </lineSegments>
    </mesh>
  )
}

/* ---------- small iridescent satellites ---------- */
function Satellites({ accent, count, still }: { accent: string; count: number; still: boolean }) {
  const group = useRef<Group>(null)
  const geo = useMemo(() => makeCrystal(0.5, 0.13), [])
  const edges = useMemo(() => new EdgesGeometry(geo, 20), [geo])
  useEffect(
    () => () => {
      geo.dispose()
      edges.dispose()
    },
    [geo, edges],
  )
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ a: (i / count) * Math.PI * 2, r: 2.1 + (i % 3) * 0.3, y: ((i * 37) % 11) / 11 - 0.5, s: 0.7 + ((i * 13) % 7) / 10 })), [count])
  useFrame((state, dt) => {
    if (still || !group.current) return
    const d = Math.min(dt, 0.05)
    group.current.rotation.y -= d * 0.12
    group.current.children.forEach((c, i) => {
      c.rotation.x += d * (0.4 + i * 0.05)
      c.rotation.y += d * 0.6
      c.position.y = seeds[i].y * 1.6 + Math.sin(state.clock.elapsedTime * 0.7 + i) * 0.1
    })
  })
  return (
    <group ref={group}>
      {seeds.map((s, i) => (
        <mesh key={i} geometry={geo} position={[Math.cos(s.a) * s.r, s.y * 1.6, Math.sin(s.a) * s.r]} scale={s.s}>
          <meshPhysicalMaterial color="#0a1418" metalness={0.6} roughness={0.12} iridescence={1} iridescenceIOR={1.6} clearcoat={1} flatShading />
          <lineSegments geometry={edges}>
            <lineBasicMaterial color={accent} transparent opacity={0.7} toneMapped={false} />
          </lineSegments>
        </mesh>
      ))}
    </group>
  )
}

/* ---------- light rings ---------- */
function LightRings({ accent, accent2, speed, still }: { accent: string; accent2: string; speed: number; still: boolean }) {
  const ref = useRef<Group>(null)
  useFrame((_, dt) => {
    if (still || !ref.current) return
    const d = Math.min(dt, 0.05)
    ref.current.children.forEach((c, i) => {
      c.rotation.z += d * speed * (0.25 + i * 0.12) * (i % 2 ? -1 : 1)
    })
  })
  const rings = [
    { r: 1.55, t: 0.012, rot: [Math.PI / 2 - 0.25, 0, 0] as const, arc: Math.PI * 2, col: accent },
    { r: 1.8, t: 0.008, rot: [Math.PI / 2 + 0.5, 0.35, 0] as const, arc: Math.PI * 1.55, col: accent2 },
    { r: 2.05, t: 0.006, rot: [0.25, 0.3, 0] as const, arc: Math.PI * 1.2, col: accent },
    { r: 1.32, t: 0.02, rot: [Math.PI / 2 - 0.25, 0, 0] as const, arc: Math.PI * 0.35, col: '#ffffff' },
  ]
  return (
    <group ref={ref}>
      {rings.map((g, i) => (
        <mesh key={i} rotation={[g.rot[0], g.rot[1], g.rot[2]]}>
          <torusGeometry args={[g.r, g.t, 8, 200, g.arc]} />
          <meshBasicMaterial color={g.col} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

const uvVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const slabFrag = /* glsl */ `
  varying vec2 vUv;
  void main() {
    float a = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 1.6) * (1.0 - abs(vUv.x - 0.5) * 1.4);
    gl_FragColor = vec4(vec3(1.4) * a, a);
  }
`
const glowFrag = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(1.0 - d, 0.0), 2.4) * 0.45;
    gl_FragColor = vec4(uColor * a, a);
  }
`

/* ---------- backdrop: iris of light bars + tick ring (gives the glass something to refract) ---------- */
function Backdrop({ accent, count, still }: { accent: string; count: number; still: boolean }) {
  const bars = useRef<InstancedMesh>(null)
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => 0.35 + Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1), [count])
  const dummy = useMemo(() => new Object3D(), [])
  const glowUniforms = useMemo(() => ({ uColor: { value: new Color() } }), [])
  glowUniforms.uColor.value.set(accent)
  const ticks = useMemo(() => {
    const p: number[] = []
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2
      const r0 = 2.9
      const r1 = r0 + (i % 10 === 0 ? 0.28 : 0.12)
      p.push(Math.cos(a) * r0, Math.sin(a) * r0, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3))
    return g
  }, [])
  useEffect(() => () => ticks.dispose(), [ticks])
  const place = useCallback(
    (t: number) => {
      const m = bars.current
      if (!m) return
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2
        const h = seeds[i] * (0.75 + 0.25 * Math.sin(t * 1.3 + i * 0.7))
        dummy.position.set(Math.cos(a) * (3.4 + h * 0.4), Math.sin(a) * (3.4 + h * 0.4), 0)
        dummy.rotation.set(0, 0, a - Math.PI / 2)
        dummy.scale.set(1, h * 0.8, 1)
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
      }
      m.instanceMatrix.needsUpdate = true
    },
    [count, seeds, dummy],
  )
  // initial bar layout before the first frame (re-runs only when the instance count changes)
  useLayoutEffect(() => place(0), [place])
  useFrame((state) => {
    if (!still) place(state.clock.elapsedTime)
  })
  return (
    <group position-z={-3.2} scale={0.76}>
      <instancedMesh ref={bars} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.05, 1, 0.05]} />
        <meshBasicMaterial color={accent} transparent opacity={0.75} toneMapped={false} />
      </instancedMesh>
      <lineSegments geometry={ticks}>
        <lineBasicMaterial color={accent} toneMapped={false} />
      </lineSegments>
      <mesh>
        <ringGeometry args={[2.6, 2.63, 128]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      {/* bright core slab + hexagon right behind the crystal: lights up the refraction */}
      <mesh position-z={1.4}>
        <planeGeometry args={[0.1, 5.4]} />
        <shaderMaterial vertexShader={uvVert} fragmentShader={slabFrag} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <mesh position-z={1.3} rotation-z={Math.PI / 6}>
        <ringGeometry args={[1.05, 1.1, 6]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <mesh position-z={1.2}>
        <planeGeometry args={[4.4, 4.4]} />
        <shaderMaterial vertexShader={uvVert} fragmentShader={glowFrag} args={uniformArgs(glowUniforms)} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  )
}

export default function GlassShard({ accent, accent2, quality, stage, paused, reducedMotion }: FxProps) {
  const c = useFxControls({
    ior: { value: 1.55, min: 1, max: 2.4, step: 0.01, label: 'IOR' },
    grubość: { value: 1.4, min: 0, max: 4, step: 0.05 },
    dyspersja: { value: 0.35, min: 0, max: 1, step: 0.01 },
    falowanie: { value: 0.12, min: 0, max: 1, step: 0.01 },
    obrót: { value: 1, min: 0, max: 3, step: 0.05 },
    bloom: { value: 1.1, min: 0, max: 3, step: 0.05 },
  })
  const still = paused || reducedMotion
  const dpr: [number, number] = quality === 'high' ? [1, 2] : quality === 'med' ? [1, 1.5] : [1, 1]
  const hq = stage && quality !== 'low'
  const samples = stage ? (quality === 'high' ? 10 : 6) : 3
  const resolution = stage ? (quality === 'low' ? 320 : 512) : 160
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0.2, stage ? 6.4 : 7], fov: 40 }}
      frameloop={still ? 'demand' : 'always'}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      role="img"
      aria-label="Obracający się szklany kryształ w pierścieniach światła"
    >
      <color attach="background" args={['#02060c']} />
      <Redraw on={[c, accent, accent2]} still={still} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 4, 5]} intensity={1.5} />
      <Environment key={accent} resolution={hq ? 256 : 128} frames={1}>
        <Lightformer form="ring" color={accent} intensity={6} scale={4} position={[0, 0, -6]} />
        <Lightformer form="rect" color="#ffffff" intensity={3} scale={[2, 8, 1]} position={[-5, 1, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" color={accent2} intensity={2.5} scale={[2, 8, 1]} position={[5, 0, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer form="rect" color="#ffffff" intensity={2} scale={[8, 1.2, 1]} position={[0, 5, 0]} rotation-x={Math.PI / 2} />
        <Lightformer form="circle" color={accent} intensity={4} scale={1.5} position={[0, -4, 3]} rotation-x={-Math.PI / 2} />
      </Environment>
      <Backdrop accent={accent} count={stage ? 96 : 56} still={still} />
      <LightRings accent={accent} accent2={accent2} speed={c.obrót} still={still} />
      <Crystal accent={accent} ior={c.ior} thickness={c.grubość} chroma={c.dyspersja} distortion={c.falowanie} speed={c.obrót} still={still} samples={samples} resolution={resolution} backside={hq} />
      <Satellites accent={accent} count={stage ? 7 : 4} still={still} />
      <Sparkles count={stage ? 60 : 20} scale={[6, 4, 4]} size={1.4} speed={still ? 0 : 0.25} color={accent} opacity={0.5} />
      <HudComposer>
        {stage
          ? [
              <Bloom key="b" intensity={c.bloom} luminanceThreshold={0.45} luminanceSmoothing={0.3} mipmapBlur />,
              <ChromaticAberration key="c" offset={new Vector2(0.0008, 0.0008)} radialModulation={false} modulationOffset={0} />,
              <Noise key="n" opacity={0.035} />,
              <Vignette key="v" eskil={false} offset={0.22} darkness={0.85} />,
            ]
          : [<Bloom key="b" intensity={c.bloom * 0.8} luminanceThreshold={0.45} luminanceSmoothing={0.3} mipmapBlur />]}
      </HudComposer>
    </Canvas>
  )
}
