import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sparkles, Stars, Torus } from '@react-three/drei'
import { Bloom, ChromaticAberration, Noise, Scanline, Vignette } from '@react-three/postprocessing'
import { HudComposer } from '@/fx/three/HudComposer'
import { BlendFunction } from 'postprocessing'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Vector2, type Group, type Mesh } from 'three'
import { useFxControls } from '@/fx/controls'
import { Redraw, tint, uniformArgs } from '../r3f-kit/util'
import type { FxProps } from '@/fx/types'

/* ---------- fresnel shell around the orb (original shader) ---------- */
const shellVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const shellFrag = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 2.6);
    gl_FragColor = vec4(uColor * f * 0.9, f * 0.9);
  }
`

function Core({ accent, accent2, speed, paused }: { accent: string; accent2: string; speed: number; paused: boolean }) {
  const rings = useRef<Group>(null)
  const orb = useRef<Mesh>(null)
  const shell = useMemo(() => ({ uColor: { value: new Color() } }), [])
  shell.uColor.value.set(accent)
  // white-hot centre, tinted by the accent so the hue reads even inside the bloom
  const hot = useMemo(() => tint(accent, 0.82), [accent])
  useFrame((state, dt) => {
    if (paused) return
    const d = Math.min(dt, 0.05)
    const g = rings.current
    if (g) {
      g.children.forEach((c, i) => {
        c.rotation.x += d * speed * (0.2 + i * 0.13) * (i % 2 ? -1 : 1)
        c.rotation.y += d * speed * (0.15 + i * 0.07)
      })
    }
    if (orb.current) {
      orb.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.04)
      orb.current.rotation.y += d * speed * 0.25
    }
  })
  return (
    <>
      <mesh ref={orb}>
        <icosahedronGeometry args={[0.7, 3]} />
        <meshBasicMaterial color={accent} wireframe transparent opacity={0.75} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshBasicMaterial color={hot} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.86, 48, 48]} />
        <shaderMaterial vertexShader={shellVert} fragmentShader={shellFrag} args={uniformArgs(shell)} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <group ref={rings}>
        {[1.2, 1.45, 1.75, 2.0].map((r, i) => (
          <Torus key={r} args={[r, 0.008 + i * 0.002, 8, 160]} rotation={[Math.PI / 2 + i * 0.4, i * 0.6, 0]}>
            <meshBasicMaterial color={i === 2 ? accent2 : accent} transparent opacity={0.85 - i * 0.15} toneMapped={false} />
          </Torus>
        ))}
      </group>
    </>
  )
}

/** Camera-facing HUD dial: a fine tick scale plus three counter-rotating arc segments. */
function Dial({ accent, accent2, speed, paused }: { accent: string; accent2: string; speed: number; paused: boolean }) {
  const outer = useRef<Group>(null)
  const inner = useRef<Group>(null)
  const ticks = useMemo(() => {
    const p: number[] = []
    for (let i = 0; i < 144; i++) {
      const a = (i / 144) * Math.PI * 2
      const r0 = 2.3
      const r1 = r0 + (i % 12 === 0 ? 0.15 : i % 3 === 0 ? 0.07 : 0.035)
      p.push(Math.cos(a) * r0, Math.sin(a) * r0, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3))
    return g
  }, [])
  useEffect(() => () => ticks.dispose(), [ticks])
  useFrame((_, dt) => {
    if (paused) return
    const d = Math.min(dt, 0.05)
    if (outer.current) outer.current.rotation.z -= d * speed * 0.06
    if (inner.current) inner.current.rotation.z += d * speed * 0.2
  })
  return (
    <group position-z={-0.4}>
      <group ref={outer}>
        <lineSegments geometry={ticks}>
          <lineBasicMaterial color={accent} transparent opacity={0.55} toneMapped={false} />
        </lineSegments>
        <mesh>
          <ringGeometry args={[2.285, 2.295, 192]} />
          <meshBasicMaterial color={accent} transparent opacity={0.45} toneMapped={false} />
        </mesh>
      </group>
      <group ref={inner}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation-z={(i * Math.PI * 2) / 3}>
            <ringGeometry args={[2.5, 2.53, 64, 1, 0, Math.PI * 0.42]} />
            <meshBasicMaterial color={i === 1 ? accent2 : accent} transparent opacity={0.8} toneMapped={false} />
          </mesh>
        ))}
        {[0, 1, 2].map((i) => (
          <mesh key={`m${i}`} rotation-z={(i * Math.PI * 2) / 3 + Math.PI * 0.21} position-z={0.001}>
            <ringGeometry args={[2.5, 2.62, 3, 1, 0, 0.035]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default function HoloCore({ accent, accent2, quality, stage, paused, reducedMotion }: FxProps) {
  const c = useFxControls({
    speed: { value: 1, min: 0, max: 4, step: 0.1, label: 'prędkość' },
    bloom: { value: 1.5, min: 0, max: 4, step: 0.1 },
    aberration: { value: 0.0015, min: 0, max: 0.01, step: 0.0005, label: 'aberracja' },
    scanlines: { value: 0.25, min: 0, max: 1, step: 0.05, label: 'skanlinie' },
    sparkles: { value: true, label: 'iskry' },
  })
  const dpr: [number, number] = quality === 'high' ? [1, 2] : quality === 'med' ? [1, 1.5] : [1, 1]
  const still = paused || reducedMotion
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0, stage ? 6.6 : 6.2], fov: 45 }}
      frameloop={still ? 'demand' : 'always'}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      aria-label="Holograficzny rdzeń z pierścieniami orbit"
    >
      <color attach="background" args={['#02060c']} />
      <Redraw on={[c, accent, accent2]} />
      <Core accent={accent} accent2={accent2} speed={c.speed} paused={still} />
      <Dial accent={accent} accent2={accent2} speed={c.speed} paused={still} />
      {c.sparkles && <Sparkles count={stage ? 120 : 30} scale={5} size={2} speed={still ? 0 : 0.4} color={accent} />}
      <Stars radius={60} depth={30} count={stage ? 2500 : 600} factor={3} fade speed={still ? 0 : 0.6} />
      <HudComposer>
        {stage
          ? [
              <Bloom key="b" intensity={c.bloom} luminanceThreshold={0.22} luminanceSmoothing={0.3} mipmapBlur />,
              <ChromaticAberration key="c" offset={new Vector2(c.aberration, c.aberration)} radialModulation={false} modulationOffset={0} />,
              <Scanline key="s" density={1.6} opacity={c.scanlines} blendFunction={BlendFunction.OVERLAY} />,
              <Noise key="n" opacity={0.04} />,
              <Vignette key="v" eskil={false} offset={0.2} darkness={0.85} />,
            ]
          : [<Bloom key="b" intensity={c.bloom * 0.8} luminanceThreshold={0.22} luminanceSmoothing={0.3} mipmapBlur />]}
      </HudComposer>
    </Canvas>
  )
}
