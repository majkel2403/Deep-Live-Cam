import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, Stars } from '@react-three/drei'
import { Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, QuadraticBezierCurve3, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial, type PerspectiveCamera } from 'three'
import type { Line2, LineMaterial } from 'three-stdlib'
import { HudComposer } from '@/fx/three/HudComposer'
import { useFxControls } from '@/fx/controls'
import { Redraw, uniformArgs, useFitAspect } from '../r3f-kit/util'
import type { FxProps } from '@/fx/types'
import { LAND_B64, LAND_H, LAND_W } from './landmask'

const R = 1.6

/* ---------- geography ---------- */
const MASK = (() => {
  const bin = atob(LAND_B64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
})()

function isLand(lat: number, lon: number) {
  const r = Math.min(LAND_H - 1, Math.max(0, Math.floor(90 - lat)))
  const c = Math.min(LAND_W - 1, Math.max(0, Math.floor(lon + 180)))
  const i = r * LAND_W + c
  return (MASK[i >> 3] & (1 << (i & 7))) !== 0
}

/** lat/lon (degrees) → point on a sphere; lon 0 faces +z */
function ll(lat: number, lon: number, rad: number, out = new Vector3()) {
  const p = (lat * Math.PI) / 180
  const l = (lon * Math.PI) / 180
  return out.set(rad * Math.cos(p) * Math.sin(l), rad * Math.sin(p), rad * Math.cos(p) * Math.cos(l))
}

// Real city coordinates (WGS84, rounded).
const CITIES: { name: string; lat: number; lon: number }[] = [
  { name: 'Warszawa', lat: 52.23, lon: 21.01 },
  { name: 'Londyn', lat: 51.51, lon: -0.13 },
  { name: 'Nowy Jork', lat: 40.71, lon: -74.01 },
  { name: 'Tokio', lat: 35.68, lon: 139.69 },
  { name: 'Singapur', lat: 1.35, lon: 103.82 },
  { name: 'Dubaj', lat: 25.2, lon: 55.27 },
  { name: 'San Francisco', lat: 37.77, lon: -122.42 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63 },
  { name: 'Kapsztad', lat: -33.92, lon: 18.42 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'Bombaj', lat: 19.08, lon: 72.88 },
  { name: 'Reykjavík', lat: 64.15, lon: -21.94 },
  { name: 'Kraków', lat: 50.06, lon: 19.94 },
  { name: 'Toronto', lat: 43.65, lon: -79.38 },
  { name: 'Kair', lat: 30.04, lon: 31.24 },
]
// Demo links (indices into CITIES) — purely illustrative, not real traffic.
const LINKS: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [0, 5], [0, 11], [1, 2], [2, 6], [3, 6], [4, 9], [5, 10], [7, 8], [1, 7], [0, 14], [13, 11], [3, 4], [10, 4],
]

/* ---------- land dots (original shader) ---------- */
const dotVert = /* glsl */ `
  uniform float uSize;
  uniform float uTime;
  uniform float uPx;
  uniform float uSpacing;
  attribute float aRand;
  varying float vBright;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // dot size = fraction of the projected sample spacing, so cards and the stage keep the same look
    gl_PointSize = max(1.5, uSize * uSpacing * uPx / -mv.z);
    float lon = atan(position.x, position.z);
    float band = pow(0.5 + 0.5 * cos(lon - uTime * 0.55), 24.0);
    vBright = 0.85 + 0.25 * sin(uTime * 1.3 + aRand * 40.0) + band * 1.4;
  }
`
const dotFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vBright;
  float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
  }
  void main() {
    float d = hexDist(gl_PointCoord - 0.5);
    if (d > 0.42) discard;
    float a = smoothstep(0.42, 0.3, d);
    gl_FragColor = vec4(uColor * vBright, a);
  }
`

function LandDots({ accent, count, size, still }: { accent: string; count: number; size: number; still: boolean }) {
  const pr = useThree((s) => s.viewport.dpr)
  const height = useThree((s) => s.size.height)
  const fov = useThree((s) => (s.camera as PerspectiveCamera).fov)
  const geo = useMemo(() => {
    const pts: number[] = []
    const rnd: number[] = []
    const v = new Vector3()
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2
      const lat = (Math.asin(y) * 180) / Math.PI
      const lon = ((((i * golden) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * (180 / Math.PI) - 180
      if (!isLand(lat, lon)) continue
      ll(lat, lon, R * 1.004, v)
      pts.push(v.x, v.y, v.z)
      rnd.push(Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3))
    g.setAttribute('aRand', new BufferAttribute(new Float32Array(rnd), 1))
    return g
  }, [count])
  useEffect(() => () => geo.dispose(), [geo])
  const uniforms = useMemo(() => ({ uColor: { value: new Color() }, uTime: { value: 2 }, uSize: { value: 1 }, uPx: { value: 1 }, uSpacing: { value: 0.05 } }), [])
  uniforms.uColor.value.set(accent)
  uniforms.uSize.value = size * 0.65
  // drawing-buffer pixels per world unit at distance 1, and the mean angular spacing of the samples
  uniforms.uPx.value = (height * pr) / (2 * Math.tan((fov * Math.PI) / 360))
  uniforms.uSpacing.value = Math.sqrt((4 * Math.PI) / count) * R
  useFrame((_, dt) => {
    if (!still) uniforms.uTime.value += Math.min(dt, 0.05)
  })
  return (
    <points geometry={geo}>
      <shaderMaterial vertexShader={dotVert} fragmentShader={dotFrag} args={uniformArgs(uniforms)} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </points>
  )
}

/* ---------- graticule ---------- */
function Graticule({ accent }: { accent: string }) {
  const geo = useMemo(() => {
    const p: number[] = []
    const a = new Vector3()
    const b = new Vector3()
    for (let lat = -75; lat <= 75; lat += 15)
      for (let i = 0; i < 120; i++) {
        ll(lat, (i / 120) * 360 - 180, R * 1.002, a)
        ll(lat, ((i + 1) / 120) * 360 - 180, R * 1.002, b)
        p.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    for (let lon = -180; lon < 180; lon += 15)
      for (let i = 0; i < 60; i++) {
        ll((i / 60) * 180 - 90, lon, R * 1.002, a)
        ll(((i + 1) / 60) * 180 - 90, lon, R * 1.002, b)
        p.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3))
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={accent} transparent opacity={0.07} depthWrite={false} blending={AdditiveBlending} />
    </lineSegments>
  )
}

/* ---------- atmosphere (fresnel rim + halo) ---------- */
const rimVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const rimFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uMul;
  uniform float uHalo;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float d = dot(vN, vV);
    float f = uHalo > 0.5 ? pow(max(-d, 0.0), 2.0) : pow(1.0 - max(d, 0.0), uPower);
    gl_FragColor = vec4(uColor * f * uMul, f * uMul);
  }
`

function Atmosphere({ accent, strength }: { accent: string; strength: number }) {
  const rim = useMemo(() => ({ uColor: { value: new Color() }, uPower: { value: 3.2 }, uMul: { value: 1 }, uHalo: { value: 0 } }), [])
  const halo = useMemo(() => ({ uColor: { value: new Color() }, uPower: { value: 2 }, uMul: { value: 1 }, uHalo: { value: 1 } }), [])
  rim.uColor.value.set(accent)
  halo.uColor.value.set(accent)
  rim.uMul.value = 0.7 * strength
  halo.uMul.value = 0.55 * strength
  return (
    <>
      <mesh>
        <sphereGeometry args={[R * 1.01, 64, 64]} />
        <shaderMaterial vertexShader={rimVert} fragmentShader={rimFrag} args={uniformArgs(rim)} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <mesh>
        <sphereGeometry args={[R * 1.2, 64, 64]} />
        <shaderMaterial vertexShader={rimVert} fragmentShader={rimFrag} args={uniformArgs(halo)} transparent depthWrite={false} blending={AdditiveBlending} side={BackSide} />
      </mesh>
    </>
  )
}

/* ---------- arcs + cities ---------- */
function Arc({ a, b, color, speed, phase, still, width }: { a: number; b: number; color: string; speed: number; phase: number; still: boolean; width: number }) {
  const pulse = useRef<Line2>(null)
  const points = useMemo(() => {
    const s = ll(CITIES[a].lat, CITIES[a].lon, R * 1.005)
    const e = ll(CITIES[b].lat, CITIES[b].lon, R * 1.005)
    const dist = s.distanceTo(e)
    const m = s.clone().add(e).normalize().multiplyScalar(R * (1.06 + dist * 0.3))
    return new QuadraticBezierCurve3(s, m, e).getPoints(64)
  }, [a, b])
  const hot = useMemo(() => '#' + new Color(color).lerp(new Color('#ffffff'), 0.55).getHexString(), [color])
  useEffect(() => {
    const mat = pulse.current?.material as LineMaterial | undefined
    if (mat) mat.dashOffset = -phase
  }, [phase])
  useFrame((_, dt) => {
    if (still) return
    const mat = pulse.current?.material as LineMaterial | undefined
    if (mat) mat.dashOffset -= Math.min(dt, 0.05) * speed * 0.9
  })
  return (
    <>
      <Line points={points} color={color} lineWidth={width * 1.1} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
      <Line ref={pulse} points={points} color={hot} lineWidth={width * 2.6} dashed dashSize={0.42} gapSize={1.3} transparent depthWrite={false} toneMapped={false} />
    </>
  )
}

const Z = new Vector3(0, 0, 1)

function City({ lat, lon, color, phase, still, hub }: { lat: number; lon: number; color: string; phase: number; still: boolean; hub: boolean }) {
  const ring = useRef<Mesh>(null)
  const pos = useMemo(() => ll(lat, lon, R * 1.006), [lat, lon])
  // orient the marker along the surface normal (local space of the spinning globe)
  const quat = useMemo(() => new Quaternion().setFromUnitVectors(Z, pos.clone().normalize()), [pos])
  useFrame((state) => {
    const m = ring.current
    if (!m) return
    const t = still ? 0.35 : (state.clock.elapsedTime * 0.6 + phase) % 1
    m.scale.setScalar(1 + t * (hub ? 4.5 : 3))
    ;(m.material as MeshBasicMaterial).opacity = (1 - t) * 0.9
  })
  return (
    <group position={pos} quaternion={quat}>
      <mesh>
        <circleGeometry args={[hub ? 0.03 : 0.018, 16]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.028, 0.036, 32]} />
        <meshBasicMaterial color={color} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh position-z={0.12} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.003, 0.003, 0.24, 4, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ---------- outer HUD rings ---------- */
function HudRings({ accent, accent2, still }: { accent: string; accent2: string; still: boolean }) {
  const eq = useRef<Group>(null)
  const polar = useRef<Group>(null)
  const ticks = useMemo(() => {
    const p: number[] = []
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2
      const r0 = R * 1.34
      const r1 = r0 + (i % 15 === 0 ? 0.12 : i % 5 === 0 ? 0.06 : 0.03)
      p.push(Math.cos(a) * r0, 0, Math.sin(a) * r0, Math.cos(a) * r1, 0, Math.sin(a) * r1)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3))
    return g
  }, [])
  useEffect(() => () => ticks.dispose(), [ticks])
  useFrame((_, dt) => {
    if (still) return
    const d = Math.min(dt, 0.05)
    if (eq.current) eq.current.rotation.y -= d * 0.05
    if (polar.current) polar.current.rotation.z += d * 0.25
  })
  return (
    <>
      <group ref={eq}>
        <lineSegments geometry={ticks}>
          <lineBasicMaterial color={accent} transparent opacity={0.55} toneMapped={false} />
        </lineSegments>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[R * 1.33, 0.004, 4, 256]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[R * 1.52, 0.003, 4, 256, Math.PI * 0.6]} />
          <meshBasicMaterial color={accent2} toneMapped={false} />
        </mesh>
      </group>
      <group rotation={[0.2, 0.9, 1.25]}>
        <group ref={polar}>
          <mesh>
            <torusGeometry args={[R * 1.22, 0.003, 4, 256, Math.PI * 1.4]} />
            <meshBasicMaterial color={accent} transparent opacity={0.6} toneMapped={false} />
          </mesh>
          <mesh position={[R * 1.22, 0, 0]}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
      </group>
    </>
  )
}

/* ---------- scene ---------- */
interface SceneProps {
  accent: string
  accent2: string
  speed: number
  arcs: number
  dotSize: number
  atmo: number
  still: boolean
  stage: boolean
}

function Globe({ accent, accent2, speed, arcs, dotSize, atmo, still, stage }: SceneProps) {
  // leave breathing room around the rings (and the stage caption) on narrower canvases
  useFitAspect(stage ? 6.6 : 5.6, 1.5, 1.3)
  const spin = useRef<Group>(null)
  const tiltRef = useRef<Group>(null)
  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05)
    if (!still && spin.current) spin.current.rotation.y += d * speed * 0.12
    // subtle pointer parallax on the whole rig
    if (tiltRef.current) {
      const k = 1 - Math.exp(-d * 2.5)
      tiltRef.current.rotation.x += (0.32 - state.pointer.y * 0.12 - tiltRef.current.rotation.x) * k
      tiltRef.current.rotation.y += (state.pointer.x * 0.2 - tiltRef.current.rotation.y) * k
    }
  })
  const links = LINKS.slice(0, arcs)
  return (
    <group ref={tiltRef} rotation-x={0.32}>
      <group rotation-z={0.18}>
        <group ref={spin} rotation-y={-0.42}>
          {/* occluder: hides the far hemisphere */}
          <mesh renderOrder={-1}>
            <sphereGeometry args={[R * 0.995, 64, 64]} />
            <meshBasicMaterial color="#010409" />
          </mesh>
          <Graticule accent={accent} />
          <LandDots accent={accent} count={stage ? 16000 : 5200} size={dotSize} still={still} />
          {links.map(([a, b], i) => (
            <Arc key={`${a}-${b}`} a={a} b={b} color={i % 3 === 2 ? accent2 : accent} speed={1 + (i % 4) * 0.25} phase={i * 0.73} still={still} width={stage ? 1.2 : 0.9} />
          ))}
          {CITIES.map((c, i) => (
            <City key={c.name} lat={c.lat} lon={c.lon} color={i === 0 ? '#ffffff' : accent} phase={i * 0.37} still={still} hub={i === 0} />
          ))}
        </group>
        <HudRings accent={accent} accent2={accent2} still={still} />
      </group>
      <Atmosphere accent={accent} strength={atmo} />
    </group>
  )
}

export default function HoloGlobe({ accent, accent2, quality, stage, paused, reducedMotion }: FxProps) {
  const c = useFxControls({
    obrót: { value: 1, min: 0, max: 4, step: 0.05 },
    łuki: { value: 12, min: 2, max: LINKS.length, step: 1 },
    punkty: { value: 1, min: 0.5, max: 2, step: 0.05 },
    atmosfera: { value: 1, min: 0, max: 2, step: 0.05 },
    bloom: { value: 1.2, min: 0, max: 3, step: 0.05 },
  })
  const still = paused || reducedMotion
  const dpr: [number, number] = quality === 'high' ? [1, 2] : quality === 'med' ? [1, 1.5] : [1, 1]
  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 0, stage ? 6.6 : 5.6], fov: 42 }}
        frameloop={still ? 'demand' : 'always'}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        role="img"
        aria-label="Holograficzny glob z punktami lądów i łukami połączeń"
      >
        <color attach="background" args={['#02060c']} />
        <Redraw on={[c, accent, accent2]} still={still} />
        <Globe accent={accent} accent2={accent2} speed={c.obrót} arcs={stage ? c.łuki : 7} dotSize={c.punkty * (stage ? 1 : 1.1)} atmo={c.atmosfera} still={still} stage={stage} />
        <Stars radius={50} depth={25} count={stage ? 1800 : 500} factor={2.5} fade speed={still ? 0 : 0.4} />
        <HudComposer>
          {stage
            ? [
                <Bloom key="b" intensity={c.bloom} luminanceThreshold={0.2} luminanceSmoothing={0.3} mipmapBlur />,
                <Noise key="n" opacity={0.04} />,
                <Vignette key="v" eskil={false} offset={0.22} darkness={0.85} />,
              ]
            : [<Bloom key="b" intensity={c.bloom * 0.8} luminanceThreshold={0.22} luminanceSmoothing={0.3} mipmapBlur />]}
        </HudComposer>
      </Canvas>
      {stage && (
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
          <span className="jx-label text-jx-accent">Sieć globalna · {CITIES.length} węzłów</span>
          <span className="flex items-center gap-2">
            <span className="jx-num border border-jx-warn/70 px-1.5 text-[0.65rem] text-jx-warn">DEMO</span>
            <span className="jx-label text-[0.65rem] text-jx-dim">połączenia ilustracyjne · lądy: Natural Earth</span>
          </span>
        </div>
      )}
    </div>
  )
}
