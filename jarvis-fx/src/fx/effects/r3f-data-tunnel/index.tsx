import { useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, Noise, Vignette } from '@react-three/postprocessing'
import { AdditiveBlending, BoxGeometry, Color, InstancedBufferAttribute, PlaneGeometry, RingGeometry, Vector2, type BufferGeometry, type PerspectiveCamera } from 'three'
import { HudComposer } from '@/fx/three/HudComposer'
import { useFxControls } from '@/fx/controls'
import { Redraw, uniformArgs } from '../r3f-kit/util'
import type { FxProps } from '@/fx/types'

const LEN = 64 // tunnel depth (world units)
const R = 3

type Shared = {
  uTravel: { value: number }
  uTime: { value: number }
  uLen: { value: number }
  uTwist: { value: number }
  uStretch: { value: number }
  uColor: { value: Color }
  uColor2: { value: Color }
}

/* Shared GLSL: depth wrap + gentle tunnel bend (identical for every layer so they stay aligned). */
const common = /* glsl */ `
  uniform float uTravel;
  uniform float uTime;
  uniform float uLen;
  uniform float uTwist;
  float wrapZ(float z0, float mul) { return -uLen + mod(z0 + uTravel * mul, uLen); }
  vec2 bend(float z) {
    float d = -z;
    return vec2(sin(z * 0.06 + uTime * 0.35), cos(z * 0.05 + uTime * 0.27) * 0.7) * uTwist * d * d * 0.004;
  }
  float depthFade(float z) { return smoothstep(-uLen, -uLen * 0.55, z) * (1.0 - smoothstep(-2.0, 0.6, z)); }
`

/* ---------- rings ---------- */
const ringVert = /* glsl */ `
  ${common}
  attribute vec4 aData; // z0, rotation, spin, scale
  varying float vFade;
  varying float vPick;
  varying vec2 vLocal;
  void main() {
    float z = wrapZ(aData.x, 1.0);
    float ang = aData.y + uTime * aData.z + z * 0.05 * uTwist;
    float c = cos(ang), s = sin(ang);
    vLocal = position.xy;
    vec3 p = position * aData.w;
    p.xy = mat2(c, s, -s, c) * p.xy + bend(z);
    p.z += z;
    vFade = depthFade(z);
    vPick = fract(aData.y * 7.13);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
  }
`
const ringFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform float uMode;
  varying float vFade;
  varying float vPick;
  varying vec2 vLocal;
  void main() {
    float a = atan(vLocal.y, vLocal.x) / 6.2831853 + 0.5;
    float mask = 1.0;
    if (uMode > 0.5 && uMode < 1.5) mask = step(0.7, fract(a * 72.0));        // ticks
    else if (uMode > 1.5) mask = step(0.38, fract(a * 6.0 + vPick));        // dashed arcs
    vec3 col = vPick > 0.82 ? vec3(1.6) : mix(uColor, uColor2, step(0.6, vPick));
    float v = mask * vFade;
    gl_FragColor = vec4(col * v, v);
  }
`

/* ---------- streaks ---------- */
const streakVert = /* glsl */ `
  ${common}
  uniform float uStretch;
  attribute vec4 aData; // z0, angle, radius, speed multiplier
  varying float vFade;
  varying float vPick;
  void main() {
    float z = wrapZ(aData.x, aData.w);
    vec3 p = position;
    p.z *= uStretch * (0.6 + aData.w * 0.6);
    p.xy += vec2(cos(aData.y), sin(aData.y)) * aData.z + bend(z);
    p.z += z;
    vFade = depthFade(z);
    vPick = fract(aData.y * 3.7);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
  }
`
const streakFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColor2;
  varying float vFade;
  varying float vPick;
  void main() {
    vec3 col = vPick > 0.7 ? vec3(1.5) : vPick > 0.45 ? uColor2 * 1.3 : uColor * 1.3;
    gl_FragColor = vec4(col * vFade, vFade);
  }
`

/* ---------- data packets on the wall ---------- */
const packetVert = /* glsl */ `
  ${common}
  attribute vec4 aData; // z0, angle, radius, seed
  varying float vFade;
  varying float vOn;
  void main() {
    float z = wrapZ(aData.x, 0.7);
    vec3 p = position;
    float c = cos(aData.y), s = sin(aData.y);
    p.xy = mat2(c, s, -s, c) * p.xy;
    p.xy += vec2(c, s) * aData.z + bend(z);
    p.z += z;
    vFade = depthFade(z);
    vOn = step(0.45, fract(sin(floor(uTime * 6.0 + aData.w * 50.0) * 91.7) * 43758.5));
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
  }
`
const packetFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vFade;
  varying float vOn;
  void main() {
    float v = vFade * (0.25 + vOn * 0.9);
    gl_FragColor = vec4(uColor * v, v);
  }
`

function useInstanced(base: BufferGeometry, data: Float32Array) {
  const geo = useMemo(() => {
    const g = base.clone()
    g.setAttribute('aData', new InstancedBufferAttribute(data, 4))
    return g
  }, [base, data])
  useEffect(() => () => geo.dispose(), [geo])
  return geo
}

function rnd(i: number, k: number) {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function RingLayer({ shared, count, inner, outer, mode, seed }: { shared: Shared; count: number; inner: number; outer: number; mode: number; seed: number }) {
  const base = useMemo(() => new RingGeometry(inner, outer, 128, 1), [inner, outer])
  useEffect(() => () => base.dispose(), [base])
  const data = useMemo(() => {
    const d = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) d.set([((i + rnd(i, seed) * 0.6) / count) * LEN, rnd(i, seed + 1) * Math.PI * 2, (rnd(i, seed + 2) - 0.5) * 0.8, 0.85 + rnd(i, seed + 3) * 0.3], i * 4)
    return d
  }, [count, seed])
  const geo = useInstanced(base, data)
  const uniforms = useMemo(() => ({ ...shared, uMode: { value: mode } }), [shared, mode])
  return (
    <instancedMesh args={[geo, undefined, count]} frustumCulled={false}>
      <shaderMaterial vertexShader={ringVert} fragmentShader={ringFrag} args={uniformArgs(uniforms)} transparent depthWrite={false} blending={AdditiveBlending} />
    </instancedMesh>
  )
}

function Streaks({ shared, count }: { shared: Shared; count: number }) {
  const base = useMemo(() => new BoxGeometry(0.018, 0.018, 1), [])
  useEffect(() => () => base.dispose(), [base])
  const data = useMemo(() => {
    const d = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) d.set([rnd(i, 11) * LEN, rnd(i, 12) * Math.PI * 2, R * (0.45 + rnd(i, 13) * 0.75), 1.2 + rnd(i, 14) * 1.8], i * 4)
    return d
  }, [count])
  const geo = useInstanced(base, data)
  return (
    <instancedMesh args={[geo, undefined, count]} frustumCulled={false}>
      <shaderMaterial vertexShader={streakVert} fragmentShader={streakFrag} args={uniformArgs(shared)} transparent depthWrite={false} blending={AdditiveBlending} />
    </instancedMesh>
  )
}

function Packets({ shared, count }: { shared: Shared; count: number }) {
  const base = useMemo(() => new PlaneGeometry(0.16, 0.09), [])
  useEffect(() => () => base.dispose(), [base])
  const data = useMemo(() => {
    const d = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      // packets travel in "lanes" (quantised angles) like data buses
      const lane = Math.floor(rnd(i, 21) * 24)
      d.set([rnd(i, 22) * LEN, (lane / 24) * Math.PI * 2, R * 1.08, rnd(i, 23)], i * 4)
    }
    return d
  }, [count])
  const geo = useInstanced(base, data)
  return (
    <instancedMesh args={[geo, undefined, count]} frustumCulled={false}>
      <shaderMaterial vertexShader={packetVert} fragmentShader={packetFrag} args={uniformArgs(shared)} transparent depthWrite={false} blending={AdditiveBlending} />
    </instancedMesh>
  )
}

/* ---------- vanishing-point glow ---------- */
const glowVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const glowFrag = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(1.0 - d, 0.0), 3.0);
    gl_FragColor = vec4(mix(uColor, vec3(1.0), a * a) * a, a);
  }
`

function Core({ shared }: { shared: Shared }) {
  return (
    <mesh position-z={-LEN * 0.92}>
      <planeGeometry args={[30, 30]} />
      <shaderMaterial vertexShader={glowVert} fragmentShader={glowFrag} args={uniformArgs(shared)} transparent depthWrite={false} blending={AdditiveBlending} />
    </mesh>
  )
}

function Driver({ shared, speed, twist, still }: { shared: Shared; speed: number; twist: number; still: boolean }) {
  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05)
    if (!still) {
      shared.uTime.value += d
      shared.uTravel.value += d * speed * 7
    }
    shared.uTwist.value = twist
    shared.uStretch.value = 0.4 + speed * 1.1
    const cam = state.camera as PerspectiveCamera
    const k = 1 - Math.exp(-d * 2.5)
    cam.position.x += (state.pointer.x * 0.6 - cam.position.x) * k
    cam.position.y += (state.pointer.y * 0.4 - cam.position.y) * k
    cam.rotation.z = Math.sin(shared.uTime.value * 0.4) * 0.12 * twist
    const fov = 62 + speed * 5
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * k
      cam.updateProjectionMatrix()
    }
  })
  return null
}

export default function DataTunnel({ accent, accent2, quality, stage, paused, reducedMotion }: FxProps) {
  const c = useFxControls({
    prędkość: { value: 1.2, min: 0, max: 4, step: 0.05 },
    gęstość: { value: 1, min: 0.3, max: 1.6, step: 0.05 },
    skręt: { value: 0.6, min: 0, max: 1.5, step: 0.05 },
    // slider in thousandths of the frame size (Leva shows 0.00 for raw values this small)
    aberracja: { value: 3, min: 0, max: 12, step: 0.1 },
    bloom: { value: 1.3, min: 0, max: 3, step: 0.05 },
  })
  const still = paused || reducedMotion
  const dpr: [number, number] = quality === 'high' ? [1, 2] : quality === 'med' ? [1, 1.5] : [1, 1]
  const shared = useMemo<Shared>(
    () => ({
      uTravel: { value: 9 },
      uTime: { value: 2 },
      uLen: { value: LEN },
      uTwist: { value: 0.6 },
      uStretch: { value: 1.5 },
      uColor: { value: new Color() },
      uColor2: { value: new Color() },
    }),
    [],
  )
  shared.uColor.value.set(accent)
  shared.uColor2.value.set(accent2)
  const dens = c.gęstość * (stage ? 1 : 0.5)
  const n = (v: number) => Math.max(4, Math.round(v * dens))
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0, 0], fov: 66, near: 0.05, far: 200 }}
      frameloop={still ? 'demand' : 'always'}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      role="img"
      aria-label="Tunel danych z pierścieniami i smugami lecącymi ku kamerze"
    >
      <color attach="background" args={['#010409']} />
      <Redraw on={[c, accent, accent2]} still={still} />
      <Driver shared={shared} speed={reducedMotion ? 0 : c.prędkość} twist={c.skręt} still={still} />
      <Core shared={shared} />
      <RingLayer shared={shared} count={n(26)} inner={R * 0.985} outer={R} mode={0} seed={1} />
      <RingLayer shared={shared} count={n(18)} inner={R * 0.9} outer={R * 0.935} mode={2} seed={5} />
      <RingLayer shared={shared} count={n(14)} inner={R * 1.06} outer={R * 1.13} mode={1} seed={9} />
      <Streaks shared={shared} count={n(520)} />
      <Packets shared={shared} count={n(260)} />
      <HudComposer>
        {stage
          ? [
              <Bloom key="b" intensity={c.bloom} luminanceThreshold={0.12} luminanceSmoothing={0.3} mipmapBlur radius={0.7} />,
              <ChromaticAberration key="c" offset={new Vector2(c.aberracja * 0.001, c.aberracja * 0.001)} radialModulation modulationOffset={0.1} />,
              <Noise key="n" opacity={0.04} />,
              <Vignette key="v" eskil={false} offset={0.18} darkness={0.9} />,
            ]
          : [
              <Bloom key="b" intensity={c.bloom * 0.8} luminanceThreshold={0.12} luminanceSmoothing={0.3} mipmapBlur />,
              <ChromaticAberration key="c" offset={new Vector2(c.aberracja * 0.001, c.aberracja * 0.001)} radialModulation modulationOffset={0.1} />,
            ]}
      </HudComposer>
    </Canvas>
  )
}
