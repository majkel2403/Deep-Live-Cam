import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, Glitch, Noise, Scanline, Vignette } from '@react-three/postprocessing'
import { BlendFunction, GlitchMode } from 'postprocessing'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, FrontSide, TorusKnotGeometry, Vector2, type Group } from 'three'
import { HudComposer } from '@/fx/three/HudComposer'
import { useFxControls } from '@/fx/controls'
import { Redraw, uniformArgs } from '../r3f-kit/util'
import type { FxProps } from '@/fx/types'
import { makeHead, makeShoulders } from './bust'

/* ---------- original hologram material ---------- */
const holoVert = /* glsl */ `
  uniform float uTime;
  uniform float uGlitch;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vW;
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  void main() {
    vec3 p = position;
    // digital glitch: some time slices shove horizontal bands sideways
    float slice = floor(uTime * 11.0);
    float burst = step(0.84, hash(slice)) * uGlitch;
    float band = step(0.62, hash(floor(p.y * 7.0) + slice * 1.7));
    p.x += (hash(slice + floor(p.y * 18.0)) - 0.5) * 0.32 * burst * band;
    // constant micro wobble along the normal
    p += normal * sin(p.y * 38.0 + uTime * 5.0) * 0.006 * uGlitch;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vW = w.xyz;
    vec4 mv = viewMatrix * w;
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const holoFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform float uTime;
  uniform float uScan;
  uniform float uFlicker;
  uniform float uRim;
  uniform float uFadeY;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vW;
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  void main() {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    float fres = pow(1.0 - clamp(abs(dot(n, normalize(vV))), 0.0, 1.0), uRim);
    // coarse scanlines drifting downwards + fine interference
    float stripes = smoothstep(0.32, 0.5, abs(fract(vW.y * uScan + uTime * 0.45) - 0.5));
    float fine = 0.5 + 0.5 * sin(vW.y * uScan * 7.0 - uTime * 3.0);
    // bright scanning band sweeping upwards
    float sweepPos = fract(uTime * 0.18) * 4.6 - 2.3;
    float sweep = exp(-pow((vW.y - sweepPos) * 9.0, 2.0));
    // flicker: rare drops + fast shimmer
    float flick = 1.0 - uFlicker * (step(0.92, hash(floor(uTime * 18.0))) * 0.55 + 0.07 * sin(uTime * 97.0));
    float a = (0.1 + fres * 1.25 + stripes * 0.22 + sweep * 0.8) * flick;
    a *= smoothstep(uFadeY, uFadeY + 0.65, vW.y);
    vec3 col = mix(uColor, uColor2, fres * 0.7) * (0.65 + fine * 0.35) + vec3(sweep * 0.6);
    gl_FragColor = vec4(col * a, a);
  }
`
const depthFrag = /* glsl */ `void main() { gl_FragColor = vec4(0.0); }`

type HoloUniforms = {
  uTime: { value: number }
  uGlitch: { value: number }
  uColor: { value: Color }
  uColor2: { value: Color }
  uScan: { value: number }
  uFlicker: { value: number }
  uRim: { value: number }
  uFadeY: { value: number }
}

/** Hologram mesh; `prepass` writes depth first so only the outer shell is visible (clean silhouette). */
function HoloMesh({ geometry, uniforms, prepass }: { geometry: BufferGeometry; uniforms: HoloUniforms; prepass: boolean }) {
  return (
    <>
      {prepass && (
        <mesh geometry={geometry} renderOrder={0}>
          <shaderMaterial vertexShader={holoVert} fragmentShader={depthFrag} args={uniformArgs(uniforms)} colorWrite={false} />
        </mesh>
      )}
      <mesh geometry={geometry} renderOrder={1}>
        <shaderMaterial vertexShader={holoVert} fragmentShader={holoFrag} args={uniformArgs(uniforms)} transparent depthWrite={false} blending={AdditiveBlending} side={prepass ? FrontSide : DoubleSide} />
      </mesh>
    </>
  )
}

/* ---------- projector base ---------- */
const uvVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const coneFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float h = vUv.y;
    float rays = 0.6 + 0.4 * sin(vUv.x * 80.0 + uTime * 0.7) * sin(vUv.x * 23.0 - uTime * 0.4);
    float a = pow(1.0 - h, 1.8) * 0.24 * rays;
    gl_FragColor = vec4(uColor * a, a);
  }
`
const padFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;
  float ring(float r, float c, float w) { return smoothstep(w, 0.0, abs(r - c)); }
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);
    float v = ring(r, 0.98, 0.012) + ring(r, 0.8, 0.008) * 0.7 + ring(r, 0.55, 0.02) * 0.5;
    v += ring(r, 0.9, 0.03) * step(0.5, fract(a * 6.0 / 6.2831853 + uTime * 0.05)) * 0.8;
    v += smoothstep(0.45, 0.0, r) * 0.35;
    v *= step(r, 1.0);
    gl_FragColor = vec4(uColor * v, v);
  }
`
const moteVert = /* glsl */ `
  uniform float uTime;
  attribute vec3 aSeed;
  varying float vA;
  void main() {
    float h = fract(aSeed.y + uTime * (0.05 + aSeed.z * 0.08));
    float ang = aSeed.x * 6.2831853 + uTime * 0.2;
    float rad = 0.25 + h * 1.25 * aSeed.z;
    vec3 p = vec3(cos(ang) * rad, h * 3.6, sin(ang) * rad);
    vA = sin(h * 3.14159) * 0.9;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (2.0 + aSeed.z * 3.0) * (6.0 / -mv.z);
  }
`
const moteFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vA;
    gl_FragColor = vec4(uColor * a, a);
  }
`

function Projector({ accent, still, motes }: { accent: string; still: boolean; motes: number }) {
  const u = useMemo(() => ({ uColor: { value: new Color() }, uTime: { value: 0 } }), [])
  u.uColor.value.set(accent)
  useFrame((_, dt) => {
    if (!still) u.uTime.value += Math.min(dt, 0.05)
  })
  const moteGeo = useMemo(() => {
    const g = new BufferGeometry()
    const seeds = new Float32Array(motes * 3)
    for (let i = 0; i < motes * 3; i++) seeds[i] = Math.abs(Math.sin(i * 78.233 + 1.7) * 43758.5453) % 1
    g.setAttribute('position', new BufferAttribute(new Float32Array(motes * 3), 3))
    g.setAttribute('aSeed', new BufferAttribute(seeds, 3))
    return g
  }, [motes])
  useEffect(() => () => moteGeo.dispose(), [moteGeo])
  return (
    <group position-y={-2.05}>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2.6, 2.6]} />
        <shaderMaterial vertexShader={uvVert} fragmentShader={padFrag} args={uniformArgs(u)} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <mesh position-y={-0.08}>
        <cylinderGeometry args={[1.32, 1.4, 0.14, 64, 1]} />
        <meshStandardMaterial color="#060d12" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position-y={1.7}>
        <cylinderGeometry args={[1.9, 0.62, 3.4, 64, 1, true]} />
        <shaderMaterial vertexShader={uvVert} fragmentShader={coneFrag} args={uniformArgs(u)} transparent depthWrite={false} blending={AdditiveBlending} side={DoubleSide} />
      </mesh>
      <points geometry={moteGeo} frustumCulled={false}>
        <shaderMaterial vertexShader={moteVert} fragmentShader={moteFrag} args={uniformArgs(u)} transparent depthWrite={false} blending={AdditiveBlending} />
      </points>
    </group>
  )
}

/* ---------- subject ---------- */
function Subject({ shape, uniforms, still, detail }: { shape: string; uniforms: HoloUniforms; still: boolean; detail: number }) {
  const turn = useRef<Group>(null)
  const head = useMemo(() => makeHead(detail), [detail])
  const shoulders = useMemo(() => makeShoulders(detail), [detail])
  const knot = useMemo(() => new TorusKnotGeometry(0.85, 0.27, Math.round(240 * detail), Math.round(36 * detail)), [detail])
  useEffect(
    () => () => {
      head.dispose()
      shoulders.dispose()
      knot.dispose()
    },
    [head, shoulders, knot],
  )
  useFrame((state) => {
    const g = turn.current
    if (!g || still) return
    const t = state.clock.elapsedTime
    g.rotation.y = shape === 'węzeł' ? t * 0.35 : Math.sin(t * 0.35) * 0.75
    if (shape === 'węzeł') g.rotation.x = Math.sin(t * 0.2) * 0.3
  })
  return (
    <group ref={turn} rotation-y={shape === 'węzeł' ? 0 : -0.45}>
      {shape === 'węzeł' ? (
        <group position-y={0.05} scale={0.82}>
          <HoloMesh geometry={knot} uniforms={uniforms} prepass={false} />
        </group>
      ) : (
        <group position-y={0.42} scale={0.92}>
          <HoloMesh geometry={head} uniforms={uniforms} prepass />
          <HoloMesh geometry={shoulders} uniforms={uniforms} prepass />
        </group>
      )}
    </group>
  )
}

export default function HologramShader({ accent, accent2, quality, stage, paused, reducedMotion }: FxProps) {
  const c = useFxControls({
    kształt: { value: 'popiersie', options: { Popiersie: 'popiersie', 'Węzeł torusa': 'węzeł' } },
    skanlinie: { value: 7, min: 2, max: 30, step: 0.5 },
    migotanie: { value: 0.6, min: 0, max: 1, step: 0.05 },
    glitch: { value: 0.7, min: 0, max: 1, step: 0.05 },
    obwódka: { value: 2.4, min: 0.8, max: 6, step: 0.1 },
    bloom: { value: 1.3, min: 0, max: 3, step: 0.05 },
  })
  const still = paused || reducedMotion
  const dpr: [number, number] = quality === 'high' ? [1, 2] : quality === 'med' ? [1, 1.5] : [1, 1]
  const uniforms = useMemo<HoloUniforms>(
    () => ({
      uTime: { value: 0.5 },
      uGlitch: { value: 0.7 },
      uColor: { value: new Color() },
      uColor2: { value: new Color() },
      uScan: { value: 7 },
      uFlicker: { value: 0.6 },
      uRim: { value: 2.4 },
      uFadeY: { value: -1.7 },
    }),
    [],
  )
  uniforms.uColor.value.set(accent)
  uniforms.uColor2.value.set(accent2).lerp(new Color('#ffffff'), 0.35)
  uniforms.uScan.value = c.skanlinie
  uniforms.uFlicker.value = reducedMotion ? 0 : c.migotanie
  uniforms.uGlitch.value = reducedMotion ? 0 : c.glitch
  uniforms.uRim.value = c.obwódka
  // fade the cut-off base of the bust into the projector beam
  uniforms.uFadeY.value = c.kształt === 'węzeł' ? -10 : -1.34
  const glitchOn = !still && c.glitch > 0.05
  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 0.1, stage ? 6.4 : 6.1], fov: 40 }}
        frameloop={still ? 'demand' : 'always'}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        role="img"
        aria-label="Hologram popiersia z liniami skanowania i zakłóceniami"
      >
        <color attach="background" args={['#02060c']} />
        <Redraw on={[c, accent, accent2]} still={still} />
        <ambientLight intensity={0.3} />
        <pointLight position={[0, 2, 3]} intensity={6} color={accent} />
        <Clock uniforms={uniforms} still={still} />
        <group position-y={0.32}>
          <Subject shape={c.kształt} uniforms={uniforms} still={still} detail={stage ? 1 : 0.6} />
          <Projector accent={accent} still={still} motes={stage ? 260 : 90} />
        </group>
        <HudComposer>
          {stage
            ? [
                <Bloom key="b" intensity={c.bloom} luminanceThreshold={0.18} luminanceSmoothing={0.3} mipmapBlur />,
                <Glitch
                  key="g"
                  active={glitchOn}
                  mode={GlitchMode.SPORADIC}
                  delay={new Vector2(2.2, 5)}
                  duration={new Vector2(0.08, 0.3)}
                  strength={new Vector2(0.04 * c.glitch, 0.14 * c.glitch)}
                  ratio={0.9}
                />,
                <Scanline key="s" density={1.4} opacity={0.12} blendFunction={BlendFunction.OVERLAY} />,
                <Noise key="n" opacity={0.05} />,
                <Vignette key="v" eskil={false} offset={0.22} darkness={0.85} />,
              ]
            : [<Bloom key="b" intensity={c.bloom * 0.8} luminanceThreshold={0.18} luminanceSmoothing={0.3} mipmapBlur />]}
        </HudComposer>
      </Canvas>
      {stage && (
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-0.5">
          <span className="jx-label text-jx-accent">Projekcja holograficzna</span>
          <span className="jx-label text-[0.65rem] text-jx-dim">materiał GLSL · Fresnel · skanlinie · glitch wierzchołków</span>
        </div>
      )}
    </div>
  )
}

/** Advances the shared shader clock (stops when paused / reduced motion). */
function Clock({ uniforms, still }: { uniforms: HoloUniforms; still: boolean }) {
  useFrame((_, dt) => {
    if (!still) uniforms.uTime.value += Math.min(dt, 0.05)
  })
  return null
}
