import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer, Sparkles } from '@react-three/drei'
import { animated, useSpring, useSprings, type SpringConfig } from '@react-spring/three'
import { Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { AdditiveBlending, Color, ExtrudeGeometry, MeshStandardMaterial, Shape, type Group, type Mesh, type MeshBasicMaterial } from 'three'
import { HudComposer } from '@/fx/three/HudComposer'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'

type Phase = 'closed' | 'open' | 'pulse' | 'close'
const PHASES: Phase[] = ['closed', 'open', 'pulse', 'close']
const PHASE_MS: Record<Phase, number> = { closed: 1300, open: 1500, pulse: 1000, close: 900 }
const PHASE_LABEL: Record<Phase, string> = { closed: 'Zamknięty', open: 'Otwarcie', pulse: 'Impuls', close: 'Domknięcie' }

/** Annulus sector centred on angle 0, extruded towards +z. */
function sector(r0: number, r1: number, width: number, depth: number, bevel = 0.012) {
  const a0 = -width / 2
  const a1 = width / 2
  const s = new Shape()
  s.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0)
  s.absarc(0, 0, r1, a0, a1, false)
  s.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0)
  s.absarc(0, 0, r0, a1, a0, true)
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 24 })
  g.translate(0, 0, -depth / 2)
  return g
}

const SOFT: SpringConfig = { tension: 110, friction: 13 }
const SNAP: SpringConfig = { tension: 420, friction: 24 }

interface ReactorProps {
  accent: string
  accent2: string
  n: number
  phase: Phase
  stiffness: number
  glow: number
  still: boolean
}

function Reactor({ accent, accent2, n, phase, stiffness, glow, still }: ReactorProps) {
  const step = (Math.PI * 2) / n
  const geos = useMemo(
    () => ({
      coil: sector(1.58, 2.06, step * 0.6, 0.26),
      coilStrip: sector(1.5, 1.56, step * 0.6, 0.08, 0),
      cell: sector(1.12, 1.44, step * 0.72, 0.08),
      petal: sector(0.56, 1.0, ((Math.PI * 2) / 6) * 0.82, 0.12),
      petalEdge: sector(0.52, 0.56, ((Math.PI * 2) / 6) * 0.82, 0.05, 0),
    }),
    [step],
  )
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos])

  const mats = useMemo(
    () => ({
      metal: new MeshStandardMaterial({ color: '#10171c', metalness: 0.95, roughness: 0.32 }),
      dark: new MeshStandardMaterial({ color: '#070b0e', metalness: 0.8, roughness: 0.5 }),
      cell: new MeshStandardMaterial({ color: '#02080c', emissive: new Color(), emissiveIntensity: 2, toneMapped: false }),
      strip: new MeshStandardMaterial({ color: '#02080c', emissive: new Color(), emissiveIntensity: 2.5, toneMapped: false }),
    }),
    [],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => {
    mats.cell.emissive.set(accent)
    mats.strip.emissive.set(accent2)
  }, [accent, accent2, mats])

  const open = phase === 'open' || phase === 'pulse'
  const k = stiffness
  const soft = { tension: SOFT.tension! * k, friction: SOFT.friction! * Math.sqrt(k) }
  const snap = { tension: SNAP.tension! * k, friction: SNAP.friction! * Math.sqrt(k) }

  const [coils, coilsApi] = useSprings(n, () => ({ r: 0, z: 0, tw: 0 }), [n])
  const [cells, cellsApi] = useSprings(n, () => ({ z: 0, s: 1 }), [n])
  const [petals, petalsApi] = useSprings(6, () => ({ r: 0, rot: 0, z: 0 }))
  const [core, coreApi] = useSpring(() => ({ s: 1, glow: 1, wave: 0, iris: 0 }))

  useEffect(() => {
    coilsApi.start((i) => ({ r: open ? 0.36 : 0, z: open ? 0.22 : 0, tw: open ? 0.14 : 0, delay: i * 28, config: open ? soft : snap }))
    cellsApi.start((i) => ({ z: open ? 0.34 : 0, s: open ? 1.12 : 1, delay: 90 + ((i * 3) % n) * 24, config: open ? soft : snap }))
    petalsApi.start((i) => ({ r: open ? 0.22 : 0, rot: open ? 0.5 : 0, z: open ? -0.06 : 0, delay: i * 40, config: open ? soft : snap }))
    if (phase === 'pulse') {
      coreApi.start({ to: [{ s: 1.35, glow: 3.4, wave: 0.01, config: { tension: 500, friction: 18 } }, { s: 1.05, glow: 1.6, wave: 1, config: { tension: 60, friction: 20 } }] })
    } else {
      coreApi.start({ s: open ? 1.08 : 1, glow: open ? 1.4 : 1, wave: 0, iris: open ? 1 : 0, config: open ? soft : snap, immediate: (key) => key === 'wave' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, n, k])

  const coreMat = useRef<MeshBasicMaterial>(null)
  const wave = useRef<Mesh>(null)
  const light = useRef<{ intensity: number }>(null)
  useFrame(() => {
    const g = core.glow.get() * glow
    mats.cell.emissiveIntensity = 1.6 * g
    mats.strip.emissiveIntensity = 2.2 * g
    if (light.current) light.current.intensity = 6 * g
    const w = core.wave.get()
    if (wave.current) {
      wave.current.visible = w > 0.005 && w < 0.995
      wave.current.scale.setScalar(0.6 + w * 3.2)
      ;(wave.current.material as MeshBasicMaterial).opacity = (1 - w) * 0.9
    }
    if (coreMat.current) coreMat.current.color.set(accent).lerp(WHITE, Math.min(1, 0.45 + core.glow.get() * 0.2))
  })

  return (
    <group>
      {/* back plate */}
      <mesh position-z={-0.24} rotation-x={Math.PI / 2} material={mats.dark}>
        <cylinderGeometry args={[2.36, 2.44, 0.16, 96]} />
      </mesh>
      <mesh position-z={-0.12} material={mats.metal}>
        <torusGeometry args={[2.24, 0.07, 16, 128]} />
      </mesh>
      <mesh position-z={-0.15} material={mats.dark}>
        <torusGeometry args={[1.08, 0.04, 12, 128]} />
      </mesh>
      {/* outer coils */}
      {coils.map((sp, i) => (
        <group key={`c${i}`} rotation-z={i * step}>
          <animated.group position-x={sp.r} position-z={sp.z} rotation-z={sp.tw}>
            <mesh geometry={geos.coil} material={mats.metal} />
            <mesh geometry={geos.coilStrip} material={mats.strip} position-z={0.02} />
          </animated.group>
        </group>
      ))}
      {/* glowing cells between the coils */}
      {cells.map((sp, i) => (
        <group key={`g${i}`} rotation-z={i * step + step / 2}>
          <animated.group position-z={sp.z} scale={sp.s}>
            <mesh geometry={geos.cell} material={mats.cell} />
          </animated.group>
        </group>
      ))}
      {/* iris petals */}
      {petals.map((sp, i) => (
        <group key={`p${i}`} rotation-z={(i * Math.PI * 2) / 6}>
          <animated.group position-x={sp.r} position-z={sp.z} rotation-z={sp.rot}>
            <mesh geometry={geos.petal} material={mats.metal} position-z={0.08} />
            <mesh geometry={geos.petalEdge} material={mats.strip} position-z={0.1} />
          </animated.group>
        </group>
      ))}
      {/* core */}
      <animated.group scale={core.s}>
        <mesh rotation-x={Math.PI / 2} position-z={0.05}>
          <cylinderGeometry args={[0.44, 0.44, 0.12, 64]} />
          <meshBasicMaterial ref={coreMat} color="#ffffff" toneMapped={false} />
        </mesh>
        <mesh position-z={0.13}>
          <torusGeometry args={[0.5, 0.025, 12, 96]} />
          <meshStandardMaterial color="#02080c" emissive={accent} emissiveIntensity={3} toneMapped={false} />
        </mesh>
        <CoreGlow accent={accent} />
      </animated.group>
      {/* shockwave */}
      <mesh ref={wave} position-z={0.2} visible={false}>
        <ringGeometry args={[0.5, 0.56, 96]} />
        <meshBasicMaterial color={accent} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 0, 0.9]} color={accent} intensity={6} distance={6} />
      {!still && <Spinner accent={accent} />}
    </group>
  )
}

const WHITE = new Color('#ffffff')

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
    float a = pow(max(1.0 - d, 0.0), 2.6);
    gl_FragColor = vec4(uColor * a * 1.4, a);
  }
`

function CoreGlow({ accent }: { accent: string }) {
  const u = useMemo(() => ({ uColor: { value: new Color() } }), [])
  u.uColor.value.set(accent)
  return (
    <mesh position-z={0.16}>
      <planeGeometry args={[2.6, 2.6]} />
      <shaderMaterial vertexShader={glowVert} fragmentShader={glowFrag} uniforms={u} transparent depthWrite={false} blending={AdditiveBlending} />
    </mesh>
  )
}

/** Thin tick ring that slowly spins in front of the reactor. */
function Spinner({ accent }: { accent: string }) {
  const ref = useRef<Group>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z -= Math.min(dt, 0.05) * 0.25
  })
  return (
    <group ref={ref} position-z={0.35}>
      {Array.from({ length: 48 }, (_, i) => (
        <mesh key={i} rotation-z={(i / 48) * Math.PI * 2} position={[Math.cos((i / 48) * Math.PI * 2) * 2.5, Math.sin((i / 48) * Math.PI * 2) * 2.5, 0]}>
          <planeGeometry args={[i % 6 === 0 ? 0.16 : 0.07, 0.012]} />
          <meshBasicMaterial color={accent} toneMapped={false} transparent opacity={i % 6 === 0 ? 0.9 : 0.45} />
        </mesh>
      ))}
    </group>
  )
}

function Rig({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null)
  useFrame((state, dt) => {
    const g = ref.current
    if (!g) return
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 3)
    g.rotation.y += (-0.38 + state.pointer.x * 0.3 - g.rotation.y) * k
    g.rotation.x += (-0.22 - state.pointer.y * 0.2 - g.rotation.x) * k
  })
  return (
    <group ref={ref} rotation={[-0.22, -0.38, 0]}>
      {children}
    </group>
  )
}

export default function SpringReactor({ accent, accent2, quality, stage, paused, reducedMotion }: FxProps) {
  const c = useFxControls({
    segmenty: { value: 10, min: 6, max: 16, step: 1 },
    tempo: { value: 1, min: 0.3, max: 2.5, step: 0.05 },
    sztywność: { value: 1, min: 0.4, max: 2.5, step: 0.05 },
    poświata: { value: 1, min: 0.2, max: 2, step: 0.05 },
    bloom: { value: 1.3, min: 0, max: 3, step: 0.05 },
  })
  const still = paused || reducedMotion
  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'open' : 'closed')
  useEffect(() => {
    if (reducedMotion) {
      setPhase('open')
      return
    }
    if (paused) return
    let i = PHASES.indexOf(phase)
    let t = 0
    const next = () => {
      i = (i + 1) % PHASES.length
      setPhase(PHASES[i])
      t = window.setTimeout(next, PHASE_MS[PHASES[i]] / c.tempo)
    }
    t = window.setTimeout(next, PHASE_MS[PHASES[i]] / c.tempo)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, reducedMotion, c.tempo])
  const dpr: [number, number] = quality === 'high' ? [1, 2] : quality === 'med' ? [1, 1.5] : [1, 1]
  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 0, stage ? 7.2 : 7.6], fov: 42 }}
        frameloop={still ? 'demand' : 'always'}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        aria-label={`Reaktor łukowy, faza: ${PHASE_LABEL[phase]}`}
      >
        <color attach="background" args={['#02060c']} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[-3, 4, 5]} intensity={1.6} />
        <Environment key={accent} resolution={128} frames={1}>
          <Lightformer form="rect" color="#ffffff" intensity={3} scale={[10, 2, 1]} position={[0, 4, 3]} rotation-x={Math.PI / 2.5} />
          <Lightformer form="rect" color={accent} intensity={2.5} scale={[2, 8, 1]} position={[-5, 0, 2]} rotation-y={Math.PI / 2} />
          <Lightformer form="ring" color={accent2} intensity={2} scale={3} position={[4, -2, 4]} />
        </Environment>
        <Rig>
          <Reactor accent={accent} accent2={accent2} n={stage ? c.segmenty : 10} phase={phase} stiffness={c.sztywność} glow={c.poświata} still={still} />
        </Rig>
        <Sparkles count={stage ? 70 : 24} scale={[7, 5, 3]} size={1.5} speed={still ? 0 : 0.3} color={accent} opacity={0.55} />
        <HudComposer>
          {stage
            ? [
                <Bloom key="b" intensity={c.bloom} luminanceThreshold={0.3} luminanceSmoothing={0.25} mipmapBlur />,
                <Noise key="n" opacity={0.035} />,
                <Vignette key="v" eskil={false} offset={0.22} darkness={0.85} />,
              ]
            : [<Bloom key="b" intensity={c.bloom * 0.85} luminanceThreshold={0.3} luminanceSmoothing={0.25} mipmapBlur />]}
        </HudComposer>
      </Canvas>
      {stage && (
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5" aria-live="polite">
          <span className="jx-label text-jx-accent">Cykl reaktora · sprężyny fizyczne</span>
          <div className="flex gap-1">
            {PHASES.map((p) => (
              <span key={p} className={`jx-num border px-1.5 py-px text-[0.62rem] uppercase ${p === phase ? 'border-jx-accent bg-jx-accent/20 text-jx-accent' : 'border-jx-line text-jx-dim'}`}>
                {PHASE_LABEL[p]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
