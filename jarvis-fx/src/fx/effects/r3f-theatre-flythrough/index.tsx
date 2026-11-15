import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, Noise, Vignette } from '@react-three/postprocessing'
import type { ISheet, ISheetObject, IRafDriver } from '@theatre/core'
import { BackSide, BoxGeometry, Color, InstancedBufferAttribute, Matrix4, Vector3, type Group, type InstancedMesh, type PerspectiveCamera } from 'three'
import { HudComposer } from '@/fx/three/HudComposer'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { CAMERA_DEFAULTS, CITY_PERIOD, OBJECT_KEY, SEQ_LENGTH, SHEET_ID, createRafDriver, getFlythroughProject } from './sequence'

const BG = '#02060c'
const CELL = 4 // street grid period (3-unit lots + 1-unit streets)
const Z_MAX = 20
const Z_MIN = -136

/* ---------- buildings (original instanced shader) ---------- */
const bVert = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vScale;
  varying vec3 vWorld;
  varying vec3 vNormalL;
  varying float vSeed;
  varying float vDepth;
  void main() {
    mat4 im = mat4(1.0);
    #ifdef USE_INSTANCING
      im = instanceMatrix;
    #endif
    vScale = vec3(length(im[0].xyz), length(im[1].xyz), length(im[2].xyz));
    vLocal = position;
    vNormalL = normal;
    vec4 w = modelMatrix * im * vec4(position, 1.0);
    vWorld = w.xyz;
    vSeed = fract(sin(dot(im[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
    vec4 mv = viewMatrix * w;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const bFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform vec3 uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uTime;
  varying vec3 vLocal;
  varying vec3 vScale;
  varying vec3 vWorld;
  varying vec3 vNormalL;
  varying float vSeed;
  varying float vDepth;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 lp = vec3(vLocal.x + 0.5, vLocal.y, vLocal.z + 0.5);
    vec3 d = min(lp, 1.0 - lp) * vScale;
    float mn = min(d.x, min(d.y, d.z));
    float mx = max(d.x, max(d.y, d.z));
    float second = d.x + d.y + d.z - mn - mx;
    float edge = 1.0 - smoothstep(0.015, 0.06, second);

    vec3 col = vec3(0.008, 0.016, 0.024) + uColor * 0.035 * clamp(vWorld.y / 12.0, 0.0, 1.0);
    if (abs(vNormalL.y) < 0.5) {
      float u = abs(vNormalL.x) > 0.5 ? vWorld.z : vWorld.x;
      vec2 cell = vec2(floor(u * 2.6), floor(vWorld.y * 3.2));
      vec2 f = vec2(fract(u * 2.6), fract(vWorld.y * 3.2));
      float rect = step(0.2, f.x) * step(f.x, 0.8) * step(0.25, f.y) * step(f.y, 0.7);
      // quantise the per-instance seed: interpolated varyings carry tiny errors that the hash would amplify
      float seed = floor(vSeed * 997.0 + 0.5);
      float r = hash(cell + seed * 0.0173);
      float lit = step(0.74, r) * step(0.4, vWorld.y);
      float slow = 0.75 + 0.25 * sin(uTime * 0.6 + r * 40.0);
      vec3 wc = mix(uColor, vec3(1.0, 0.72, 0.38), step(0.93, r));
      // far away the window grid would alias: blend it into its average brightness
      float far = smoothstep(18.0, 48.0, vDepth);
      col += wc * mix(rect * lit * slow, 0.06 * step(0.4, vWorld.y), far) * 0.55;
    } else if (vNormalL.y > 0.5) {
      col += uColor * 0.05;
    }
    // edge glow, brighter towards the roof
    col += mix(uColor, uColor2, vSeed) * edge * (0.55 + 1.3 * smoothstep(0.0, vScale.y, vWorld.y));
    // ground mist
    col += uColor * 0.1 * (1.0 - smoothstep(0.0, 1.4, vWorld.y));
    float fog = smoothstep(uFogNear, uFogFar, vDepth);
    gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
  }
`

function hash2(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function City({ accent, accent2, cols, heightMul, fogFar, uTime }: { accent: string; accent2: string; cols: number; heightMul: number; fogFar: number; uTime: { value: number } }) {
  const ref = useRef<InstancedMesh>(null)
  const geo = useMemo(() => new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), [])
  useEffect(() => () => geo.dispose(), [geo])
  const rows = Math.ceil((Z_MAX - Z_MIN) / CELL)
  const lots = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number; h: number }[] = []
    const periodRows = CITY_PERIOD / CELL
    for (let r = 0; r < rows; r++) {
      const z0 = Z_MAX - (r + 1) * CELL
      const rz = ((Math.round(z0 / CELL) % periodRows) + periodRows) % periodRows // periodic along z
      for (let c = -cols; c < cols; c++) {
        if (c === -1 || c === 0) continue // central avenue (x ∈ [−4, 4])
        const x0 = c * CELL
        const h = hash2(c, rz)
        const dist = Math.abs(c) / cols
        // landmark towers near the avenue, lower blocks further out
        const tall = h > 0.92 ? 3.2 : 1
        const height = (1.2 + Math.pow(hash2(c + 7.1, rz + 3.3), 2.2) * 9 * (1.1 - dist * 0.6)) * tall
        if (hash2(c * 1.7, rz * 2.3) > 0.55 && height < 6) {
          // split lot into two slimmer buildings
          out.push({ x: x0 + 1.25, z: z0 + 2, w: 1.3, d: 2.6, h: height * 0.8 })
          out.push({ x: x0 + 2.85, z: z0 + 2, w: 1.1, d: 2.6, h: height * 1.15 })
        } else {
          out.push({ x: x0 + 2, z: z0 + 2, w: 2.8, d: 2.8, h: height })
        }
      }
    }
    return out
  }, [rows, cols])
  const uniforms = useMemo(
    () => ({ uColor: { value: new Color() }, uColor2: { value: new Color() }, uFog: { value: new Color(BG) }, uFogNear: { value: 10 }, uFogFar: { value: 70 }, uTime }),
    [uTime],
  )
  uniforms.uColor.value.set(accent)
  uniforms.uColor2.value.set(accent2)
  uniforms.uFog.value.set(BG).lerp(uniforms.uColor.value, 0.1)
  uniforms.uFogFar.value = fogFar
  uniforms.uFogNear.value = fogFar * 0.18
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const mat = new Matrix4()
    lots.forEach((l, i) => {
      mat.makeScale(l.w, l.h * heightMul, l.d).setPosition(l.x, 0, l.z)
      m.setMatrixAt(i, mat)
    })
    m.count = lots.length
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [lots, heightMul])
  return (
    <instancedMesh ref={ref} args={[geo, undefined, lots.length]} frustumCulled={false}>
      <shaderMaterial vertexShader={bVert} fragmentShader={bFrag} uniforms={uniforms} />
    </instancedMesh>
  )
}

/* ---------- ground grid ---------- */
const gVert = /* glsl */ `
  varying vec3 vWorld;
  varying float vDepth;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vec4 mv = viewMatrix * w;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const gFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uTime;
  varying vec3 vWorld;
  varying float vDepth;
  float gridLine(float v, float period, float width) {
    float dist = abs(fract(v / period + 0.5) - 0.5) * period;
    float aa = fwidth(v) * 1.2;
    return 1.0 - smoothstep(width, width + aa, dist);
  }
  void main() {
    float streets = max(gridLine(vWorld.x, 4.0, 0.025), gridLine(vWorld.z, 4.0, 0.025));
    float fine = max(gridLine(vWorld.x, 1.0, 0.01), gridLine(vWorld.z, 1.0, 0.01)) * 0.18;
    float avenue = gridLine(vWorld.x, 1000.0, 0.05) * (0.6 + 0.4 * step(0.5, fract(vWorld.z * 0.25 + uTime * 0.8)));
    vec3 col = uColor * (streets * 0.38 + fine + avenue * 1.1);
    col += uColor * 0.02;
    float fog = smoothstep(uFogNear, uFogFar, vDepth);
    gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
  }
`

function Ground({ accent, fogFar, uTime }: { accent: string; fogFar: number; uTime: { value: number } }) {
  const uniforms = useMemo(() => ({ uColor: { value: new Color() }, uFog: { value: new Color(BG) }, uFogNear: { value: 10 }, uFogFar: { value: 70 }, uTime }), [uTime])
  uniforms.uColor.value.set(accent)
  uniforms.uFog.value.set(BG).lerp(uniforms.uColor.value, 0.1)
  uniforms.uFogFar.value = fogFar
  uniforms.uFogNear.value = fogFar * 0.18
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, (Z_MAX + Z_MIN) / 2]}>
      <planeGeometry args={[220, Z_MAX - Z_MIN + 40]} />
      <shaderMaterial vertexShader={gVert} fragmentShader={gFrag} uniforms={uniforms} />
    </mesh>
  )
}

/* ---------- traffic light streaks ---------- */
const tVert = /* glsl */ `
  uniform float uTime;
  uniform float uZMin;
  uniform float uZMax;
  attribute vec4 aCar; // lane x, offset, speed, colour pick
  varying float vPick;
  varying float vDepth;
  void main() {
    float len = uZMax - uZMin;
    float z = uZMax - mod(aCar.y + uTime * aCar.z, len);
    vec3 p = position + vec3(aCar.x, 0.12, z);
    vPick = aCar.w;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const tFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFogFar;
  varying float vPick;
  varying float vDepth;
  void main() {
    vec3 c = vPick < 0.45 ? vec3(1.6, 1.5, 1.4) : vPick < 0.8 ? vec3(1.8, 0.15, 0.25) : uColor * 1.6;
    float fog = 1.0 - smoothstep(uFogFar * 0.2, uFogFar, vDepth);
    gl_FragColor = vec4(c * fog, 1.0);
  }
`

function Traffic({ accent, count, fogFar, uTime }: { accent: string; count: number; fogFar: number; uTime: { value: number } }) {
  const geo = useMemo(() => {
    const g = new BoxGeometry(0.07, 0.05, 0.9)
    const data = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      const lane = Math.floor(hash2(i, 1.3) * 18) - 9 // street index
      const side = hash2(i, 7.7) > 0.5 ? 0.22 : -0.22
      const x = lane === 0 ? (side > 0 ? 1.6 : -1.6) + (hash2(i, 3.1) - 0.5) * 1.2 : lane * CELL + side
      const dir = side > 0 ? 1 : -1
      data.set([x, hash2(i, 9.1) * 200, (3 + hash2(i, 5.5) * 6) * dir, side > 0 ? hash2(i, 2.2) * 0.45 : 0.45 + hash2(i, 4.4) * 0.55], i * 4)
    }
    g.setAttribute('aCar', new InstancedBufferAttribute(data, 4))
    return g
  }, [count])
  useEffect(() => () => geo.dispose(), [geo])
  const uniforms = useMemo(() => ({ uColor: { value: new Color() }, uTime, uZMin: { value: Z_MIN }, uZMax: { value: Z_MAX }, uFogFar: { value: 70 } }), [uTime])
  uniforms.uColor.value.set(accent)
  uniforms.uFogFar.value = fogFar
  return (
    <instancedMesh args={[geo, undefined, count]} frustumCulled={false}>
      <shaderMaterial vertexShader={tVert} fragmentShader={tFrag} uniforms={uniforms} toneMapped={false} />
    </instancedMesh>
  )
}

/* ---------- sky dome (follows the camera) ---------- */
const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const skyFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uFog;
  varying vec3 vDir;
  void main() {
    float h = vDir.y;
    vec3 col = mix(uFog, vec3(0.0, 0.004, 0.01), smoothstep(0.0, 0.5, h));
    col += uColor * 0.35 * exp(-abs(h) * 14.0);
    col += uColor * 0.08 * exp(-max(h, 0.0) * 3.0);
    gl_FragColor = vec4(col, 1.0);
  }
`

function Sky({ accent }: { accent: string }) {
  const ref = useRef<Group>(null)
  const uniforms = useMemo(() => ({ uColor: { value: new Color() }, uFog: { value: new Color(BG) } }), [])
  uniforms.uColor.value.set(accent)
  uniforms.uFog.value.set(BG).lerp(uniforms.uColor.value, 0.1)
  useFrame(({ camera }) => {
    ref.current?.position.copy(camera.position)
  })
  return (
    <group ref={ref}>
      <mesh renderOrder={-10}>
        <sphereGeometry args={[150, 32, 16]} />
        <shaderMaterial vertexShader={skyVert} fragmentShader={skyFrag} uniforms={uniforms} side={BackSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ---------- theatre-driven camera ---------- */
interface FlightProps {
  rate: number
  still: boolean
  reducedMotion: boolean
  onTick: (pos: number) => void
}

function Flight({ rate, still, reducedMotion, onTick }: FlightProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const invalidate = useThree((s) => s.invalidate)
  const id = useId()
  const rig = useRef<{ sheet: ISheet; obj: ISheetObject<typeof CAMERA_DEFAULTS>; driver: IRafDriver } | null>(null)
  const look = useMemo(() => new Vector3(), [])
  const lastTick = useRef(0)

  useEffect(() => {
    const project = getFlythroughProject()
    const sheet = project.sheet(SHEET_ID, `r3f${id.replace(/[^a-z0-9]/gi, '')}`)
    const obj = sheet.object(OBJECT_KEY, CAMERA_DEFAULTS)
    const driver = createRafDriver({ name: `jx-flythrough-${id}` })
    rig.current = { sheet, obj, driver }
    void project.ready.then(() => invalidate())
    return () => {
      sheet.sequence.pause()
      sheet.detachObject(OBJECT_KEY)
      rig.current = null
    }
  }, [id, invalidate])

  useEffect(() => {
    const r = rig.current
    if (!r) return
    const project = getFlythroughProject()
    let alive = true
    if (still) {
      r.sheet.sequence.pause()
      if (reducedMotion) r.sheet.sequence.position = 9.2 // static overview shot
      invalidate()
      return
    }
    void project.ready.then(() => {
      if (alive) void r.sheet.sequence.play({ iterationCount: Infinity, rate, rafDriver: r.driver })
    })
    return () => {
      alive = false
      r.sheet.sequence.pause()
    }
  }, [still, reducedMotion, rate, invalidate])

  useFrame(() => {
    const r = rig.current
    if (!r) return
    r.driver.tick(performance.now())
    const v = r.obj.value
    camera.position.set(v.x, v.y, v.z)
    look.set(v.x + v.lx, v.y + v.ly, v.z - 10)
    camera.lookAt(look)
    camera.rotateZ(v.roll)
    if (Math.abs(camera.fov - v.fov) > 0.01) {
      camera.fov = v.fov
      camera.updateProjectionMatrix()
    }
    const now = performance.now()
    if (now - lastTick.current > 120) {
      lastTick.current = now
      onTick(r.sheet.sequence.position)
    }
  })
  return null
}

function Clock({ uTime, still }: { uTime: { value: number }; still: boolean }) {
  useFrame((_, dt) => {
    if (!still) uTime.value += Math.min(dt, 0.05)
  })
  return null
}

export default function TheatreFlythrough({ accent, accent2, quality, stage, paused, reducedMotion }: FxProps) {
  const c = useFxControls({
    tempo: { value: 1, min: 0.25, max: 2, step: 0.05 },
    mgła: { value: 72, min: 30, max: 130, step: 1, label: 'zasięg mgły' },
    wysokość: { value: 1, min: 0.4, max: 2, step: 0.05, label: 'wysokość zabudowy' },
    ruch: { value: true, label: 'ruch uliczny' },
    bloom: { value: 1.2, min: 0, max: 3, step: 0.05 },
  })
  const still = paused || reducedMotion
  const dpr: [number, number] = quality === 'high' ? [1, 2] : quality === 'med' ? [1, 1.5] : [1, 1]
  const uTime = useMemo(() => ({ value: 0 }), [])
  const [pos, setPos] = useState(0)
  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={dpr}
        camera={{ position: [CAMERA_DEFAULTS.x, CAMERA_DEFAULTS.y, CAMERA_DEFAULTS.z], fov: CAMERA_DEFAULTS.fov, near: 0.1, far: 400 }}
        frameloop={still ? 'demand' : 'always'}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        aria-label="Przelot kamery nad neonowym miastem"
      >
        <color attach="background" args={[BG]} />
        <Clock uTime={uTime} still={still} />
        <Flight rate={c.tempo} still={still} reducedMotion={reducedMotion} onTick={stage ? setPos : () => {}} />
        <Sky accent={accent} />
        <Ground accent={accent} fogFar={c.mgła} uTime={uTime} />
        <City accent={accent} accent2={accent2} cols={stage ? 11 : 7} heightMul={c.wysokość} fogFar={c.mgła} uTime={uTime} />
        {c.ruch && <Traffic accent={accent} count={stage ? 420 : 160} fogFar={c.mgła} uTime={uTime} />}
        <HudComposer>
          {stage
            ? [
                <Bloom key="b" intensity={c.bloom} luminanceThreshold={0.25} luminanceSmoothing={0.3} mipmapBlur />,
                <Noise key="n" opacity={0.035} />,
                <Vignette key="v" eskil={false} offset={0.2} darkness={0.9} />,
              ]
            : [<Bloom key="b" intensity={c.bloom * 0.8} luminanceThreshold={0.25} luminanceSmoothing={0.3} mipmapBlur />]}
        </HudComposer>
      </Canvas>
      {stage && (
        <div className="pointer-events-none absolute left-3 top-3 flex w-64 flex-col gap-1 whitespace-nowrap">
          <span className="jx-label text-jx-accent">Sekwencja Theatre.js · kamera</span>
          <div className="flex items-center justify-between gap-3">
            <span className="jx-label text-[0.65rem] text-jx-dim">klatki kluczowe w kodzie</span>
            <span className="jx-num text-[0.7rem] text-jx-text">
              {pos.toFixed(1).padStart(4, '0')} / {SEQ_LENGTH.toFixed(1)} s
            </span>
          </div>
          <div className="h-1 w-full bg-jx-line/40">
            <div className="h-full bg-jx-accent" style={{ width: `${(pos / SEQ_LENGTH) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
