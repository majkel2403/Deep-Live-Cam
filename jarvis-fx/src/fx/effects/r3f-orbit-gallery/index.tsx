import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { animated, useSpring } from '@react-spring/three'
import { Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { AdditiveBlending, BackSide, Color, DoubleSide, FrontSide, type CanvasTexture, type Group, type Mesh, type MeshBasicMaterial, type ShaderMaterial } from 'three'
import { HudComposer } from '@/fx/three/HudComposer'
import { useFxControls } from '@/fx/controls'
import { Redraw, tint, uniformArgs, useFitAspect } from '../r3f-kit/util'
import type { FxProps } from '@/fx/types'
import { collectFacts, drawBack, drawCard, loadCardFonts } from './cards'

const CARD_W = 1.6
const CARD_H = 1.0

/* ---------- polar floor (original shader) ---------- */
const floorVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const floorFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;
  float gridLine(float v) {
    float w = fwidth(v);
    return 1.0 - min(abs(fract(v - 0.5) - 0.5) / max(w, 1e-4), 1.0);
  }
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float a = atan(p.y, p.x) / 6.2831853 + 0.5;
    float rings = gridLine(r * 9.0);
    float spokes = gridLine(a * 48.0) * step(0.18, r);
    float sweep = pow(fract(a - uTime * 0.07), 10.0) * smoothstep(1.0, 0.1, r);
    float pulse = smoothstep(0.035, 0.0, abs(r - fract(uTime * 0.12)));
    float fade = smoothstep(1.0, 0.15, r);
    float v = (rings * 0.55 + spokes * 0.18 + sweep * 0.5 + pulse * 0.35) * fade;
    gl_FragColor = vec4(uColor * v, v);
  }
`

function PolarFloor({ accent, still }: { accent: string; still: boolean }) {
  const mat = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uColor: { value: new Color() }, uTime: { value: 0 } }), [])
  useEffect(() => {
    uniforms.uColor.value.set(accent)
  }, [accent, uniforms])
  useFrame((_, dt) => {
    if (!still) uniforms.uTime.value += Math.min(dt, 0.05)
  })
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-1.35}>
      <planeGeometry args={[12, 12]} />
      <shaderMaterial ref={mat} vertexShader={floorVert} fragmentShader={floorFrag} args={uniformArgs(uniforms)} transparent depthWrite={false} blending={AdditiveBlending} side={DoubleSide} />
    </mesh>
  )
}

/* ---------- core ---------- */
const beamFrag = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float a = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 2.2) * 0.28;
    gl_FragColor = vec4(uColor * a, a);
  }
`

function Core({ accent, accent2, still }: { accent: string; accent2: string; still: boolean }) {
  const beamUniforms = useMemo(() => ({ uColor: { value: new Color() } }), [])
  beamUniforms.uColor.value.set(accent)
  const hot = useMemo(() => tint(accent, 0.85), [accent])
  const ico = useRef<Mesh>(null)
  const rings = useRef<Group>(null)
  const glow = useRef<Mesh>(null)
  useFrame((state, dt) => {
    if (still) return
    const d = Math.min(dt, 0.05)
    if (ico.current) {
      ico.current.rotation.y += d * 0.4
      ico.current.rotation.x += d * 0.17
    }
    rings.current?.children.forEach((c, i) => {
      c.rotation.z += d * (0.5 + i * 0.3) * (i % 2 ? -1 : 1)
    })
    if (glow.current) glow.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2.4) * 0.06)
  })
  return (
    <group>
      <mesh ref={glow}>
        <sphereGeometry args={[0.26, 32, 32]} />
        <meshBasicMaterial color={hot} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshBasicMaterial color={accent} transparent opacity={0.18} blending={AdditiveBlending} depthWrite={false} side={BackSide} />
      </mesh>
      <mesh ref={ico}>
        <icosahedronGeometry args={[0.6, 1]} />
        <meshBasicMaterial color={accent} wireframe toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <group ref={rings}>
        {[0.85, 1.02, 1.2].map((r, i) => (
          <mesh key={r} rotation={[Math.PI / 2 + (i - 1) * 0.35, i * 0.4, 0]}>
            <torusGeometry args={[r, 0.008, 6, 128, Math.PI * (1.2 + i * 0.35)]} />
            <meshBasicMaterial color={i === 1 ? accent2 : accent} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* light column, fading towards both ends */}
      <mesh position-y={0.4}>
        <cylinderGeometry args={[0.035, 0.035, 4.6, 16, 1, true]} />
        <shaderMaterial vertexShader={floorVert} fragmentShader={beamFrag} args={uniformArgs(beamUniforms)} transparent blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ---------- card ---------- */
interface CardProps {
  tex: CanvasTexture
  back: CanvasTexture
  angle: number
  radius: number
  index: number
  hovered: number | null
  setHovered: (i: number | null) => void
  still: boolean
  interactive: boolean
}

function Card({ tex, back, angle, radius, index, hovered, setHovered, still, interactive }: CardProps) {
  const bob = useRef<Group>(null)
  const mat = useRef<MeshBasicMaterial>(null)
  const isHover = hovered === index
  const dim = hovered !== null && !isHover
  const spring = useSpring({
    s: isHover ? 1.28 : 1,
    z: isHover ? 0.55 : 0,
    b: isHover ? 1 : dim ? 0.42 : 0.74,
    config: { tension: 280, friction: 20 },
  })
  useFrame((state) => {
    // brightness follows the spring (cheaper than an animated material and keeps types shallow)
    mat.current?.color.setScalar(spring.b.get())
    if (still || !bob.current) return
    bob.current.position.y = Math.sin(state.clock.elapsedTime * 0.9 + index * 1.7) * 0.12
  })
  return (
    <group position={[Math.sin(angle) * radius, 0, Math.cos(angle) * radius]} rotation={[0, angle, 0]}>
      <group ref={bob}>
        <animated.group scale={spring.s} position-z={spring.z}>
          <mesh
            onPointerOver={
              interactive
                ? (e) => {
                    e.stopPropagation()
                    setHovered(index)
                    document.body.style.cursor = 'pointer'
                  }
                : undefined
            }
            onPointerOut={
              interactive
                ? () => {
                    setHovered(null)
                    document.body.style.cursor = ''
                  }
                : undefined
            }
          >
            <planeGeometry args={[CARD_W, CARD_H]} />
            <meshBasicMaterial ref={mat} map={tex} color={0xbbbbbb} transparent toneMapped={false} depthWrite={false} side={FrontSide} blending={AdditiveBlending} />
          </mesh>
          <mesh rotation-y={Math.PI}>
            <planeGeometry args={[CARD_W, CARD_H]} />
            <meshBasicMaterial map={back} transparent depthWrite={false} side={FrontSide} blending={AdditiveBlending} />
          </mesh>
        </animated.group>
      </group>
    </group>
  )
}

/* ---------- scene ---------- */
interface SceneProps {
  accent: string
  accent2: string
  hue: number
  count: number
  radius: number
  speed: number
  tilt: number
  parallax: number
  still: boolean
  stage: boolean
}

function Scene({ accent, accent2, hue, count, radius, speed, tilt, parallax, still, stage }: SceneProps) {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const orbit = useRef<Group>(null)
  const slow = useRef(1)
  const [hovered, setHovered] = useState<number | null>(null)
  // the carousel is wide: keep the side cards in frame on narrower canvases (stage next to the panel)
  useFitAspect(stage ? 7.4 : 7.0, 1.7)
  const [tex, setTex] = useState<{ front: CanvasTexture[]; back: CanvasTexture } | null>(null)

  useEffect(() => {
    let alive = true
    let made: CanvasTexture[] = []
    let back: CanvasTexture | null = null
    void loadCardFonts().then(() => {
      if (!alive) return
      const facts = collectFacts(gl, hue).slice(0, count)
      made = facts.map((f, i) => drawCard(f, i, facts.length, accent, accent2))
      back = drawBack(accent)
      setTex({ front: made, back })
      invalidate()
    })
    return () => {
      alive = false
      made.forEach((t) => t.dispose())
      back?.dispose()
    }
  }, [gl, hue, accent, accent2, count, invalidate])

  useEffect(() => () => void (document.body.style.cursor = ''), [])

  // beams from the core to each card slot
  const beams = useMemo(() => {
    const arr = new Float32Array(count * 6)
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      arr.set([0, 0, 0, Math.sin(a) * (radius - 0.85), -0.45, Math.cos(a) * (radius - 0.85)], i * 6)
    }
    return arr
  }, [count, radius])

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05)
    const cam = state.camera
    const px = state.pointer.x * parallax
    const py = state.pointer.y * parallax
    const k = 1 - Math.exp(-d * 3)
    cam.position.x += (px * 1.6 - cam.position.x) * k
    cam.position.y += (1.35 + py * 0.9 - cam.position.y) * k
    cam.lookAt(0, -0.05, 0)
    if (still || !orbit.current) return
    slow.current += ((hovered !== null ? 0.08 : 1) - slow.current) * k
    orbit.current.rotation.y += d * speed * 0.22 * slow.current
  })

  return (
    <>
      <fog attach="fog" args={['#02060c', 7.5, 15]} />
      <Core accent={accent} accent2={accent2} still={still} />
      <PolarFloor accent={accent} still={still} />
      <group rotation-x={(tilt * Math.PI) / 180}>
        <group ref={orbit} rotation-y={0.35}>
          <lineSegments>
            <bufferGeometry key={beams.length + radius}>
              <bufferAttribute attach="attributes-position" args={[beams, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color={accent} transparent opacity={0.28} blending={AdditiveBlending} depthWrite={false} />
          </lineSegments>
          <mesh rotation-x={Math.PI / 2} position-y={-0.62}>
            <torusGeometry args={[radius, 0.006, 4, 256]} />
            <meshBasicMaterial color={accent} transparent opacity={0.55} toneMapped={false} />
          </mesh>
          {tex?.front.map((t, i) => (
            <Card
              key={i}
              tex={t}
              back={tex.back}
              index={i}
              angle={(i / tex.front.length) * Math.PI * 2}
              radius={radius}
              hovered={hovered}
              setHovered={setHovered}
              still={still}
              interactive={stage}
            />
          ))}
        </group>
      </group>
      <Sparkles count={stage ? 90 : 30} scale={[radius * 2.6, 3, radius * 2.6]} size={1.6} speed={still ? 0 : 0.3} color={accent} opacity={0.6} />
    </>
  )
}

export default function OrbitGallery({ accent, accent2, hue, quality, stage, paused, reducedMotion }: FxProps) {
  const c = useFxControls({
    karty: { value: 10, min: 6, max: 12, step: 1, label: 'karty' },
    promień: { value: 3.3, min: 2.4, max: 4.5, step: 0.1 },
    prędkość: { value: 1, min: 0, max: 3, step: 0.05 },
    pochylenie: { value: 8, min: -20, max: 25, step: 1 },
    paralaksa: { value: 1, min: 0, max: 2, step: 0.05 },
    bloom: { value: 1.1, min: 0, max: 3, step: 0.05 },
  })
  const still = paused || reducedMotion
  const dpr: [number, number] = quality === 'high' ? [1, 2] : quality === 'med' ? [1, 1.5] : [1, 1]
  const count = stage ? c.karty : 8
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 1.35, stage ? 7.4 : 7.0], fov: 42 }}
      frameloop={still ? 'demand' : 'always'}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      role="img"
      aria-label="Galeria orbitalna: karty z parametrami przeglądarki krążące wokół rdzenia"
    >
      <color attach="background" args={['#02060c']} />
      <Redraw on={[c, accent, accent2]} still={still} />
      <Scene
        accent={accent}
        accent2={accent2}
        hue={hue}
        count={count}
        radius={c.promień}
        speed={c.prędkość}
        tilt={c.pochylenie}
        parallax={c.paralaksa}
        still={still}
        stage={stage}
      />
      <HudComposer>
        {stage
          ? [
              <Bloom key="b" intensity={c.bloom} luminanceThreshold={0.32} luminanceSmoothing={0.25} mipmapBlur />,
              <Noise key="n" opacity={0.035} />,
              <Vignette key="v" eskil={false} offset={0.25} darkness={0.8} />,
            ]
          : [<Bloom key="b" intensity={c.bloom * 0.8} luminanceThreshold={0.35} luminanceSmoothing={0.25} mipmapBlur />]}
      </HudComposer>
    </Canvas>
  )
}
