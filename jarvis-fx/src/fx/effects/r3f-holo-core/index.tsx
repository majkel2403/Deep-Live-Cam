import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sparkles, Stars, Torus } from '@react-three/drei'
import { Bloom, ChromaticAberration, Noise, Scanline, Vignette } from '@react-three/postprocessing'
import { HudComposer } from '@/fx/three/HudComposer'
import { BlendFunction } from 'postprocessing'
import { Vector2, type Group, type Mesh } from 'three'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'

function Core({ accent, speed, paused }: { accent: string; speed: number; paused: boolean }) {
  const rings = useRef<Group>(null)
  const orb = useRef<Mesh>(null)
  useFrame((state, dt) => {
    if (paused) return
    const g = rings.current
    if (g) {
      g.children.forEach((c, i) => {
        c.rotation.x += dt * speed * (0.2 + i * 0.13) * (i % 2 ? -1 : 1)
        c.rotation.y += dt * speed * (0.15 + i * 0.07)
      })
    }
    if (orb.current) orb.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.04)
  })
  return (
    <>
      <mesh ref={orb}>
        <icosahedronGeometry args={[0.7, 4]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.4} wireframe />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshBasicMaterial color="#e8fdff" />
      </mesh>
      <group ref={rings}>
        {[1.2, 1.45, 1.75, 2.1].map((r, i) => (
          <Torus key={r} args={[r, 0.008 + i * 0.002, 8, 160]} rotation={[Math.PI / 2 + i * 0.4, i * 0.6, 0]}>
            <meshBasicMaterial color={accent} transparent opacity={0.85 - i * 0.15} toneMapped={false} />
          </Torus>
        ))}
      </group>
    </>
  )
}

export default function HoloCore({ accent, quality, stage, paused, reducedMotion }: FxProps) {
  const c = useFxControls({
    speed: { value: 1, min: 0, max: 4, step: 0.1 },
    bloom: { value: 1.6, min: 0, max: 4, step: 0.1 },
    aberration: { value: 0.0015, min: 0, max: 0.01, step: 0.0005 },
    scanlines: { value: 0.25, min: 0, max: 1, step: 0.05 },
    sparkles: { value: true },
  })
  const dpr: [number, number] = quality === 'high' ? [1, 2] : quality === 'med' ? [1, 1.5] : [1, 1]
  const still = paused || reducedMotion
  return (
    <Canvas dpr={dpr} camera={{ position: [0, 0, 5], fov: 45 }} frameloop={still ? 'demand' : 'always'} gl={{ antialias: false, powerPreference: 'high-performance' }}>
      <color attach="background" args={['#02060c']} />
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 0, 0]} intensity={4} color={accent} />
      <Core accent={accent} speed={c.speed} paused={still} />
      {c.sparkles && <Sparkles count={stage ? 120 : 40} scale={5} size={2} speed={0.4} color={accent} />}
      <Stars radius={60} depth={30} count={stage ? 2500 : 800} factor={3} fade speed={still ? 0 : 0.6} />
      <HudComposer enabled={quality !== 'low' || stage}>
        <Bloom intensity={c.bloom} luminanceThreshold={0.15} luminanceSmoothing={0.3} mipmapBlur />
        <ChromaticAberration offset={new Vector2(c.aberration, c.aberration)} radialModulation={false} modulationOffset={0} />
        <Scanline density={1.6} opacity={c.scanlines} blendFunction={BlendFunction.OVERLAY} />
        <Noise opacity={0.05} />
        <Vignette eskil={false} offset={0.2} darkness={0.85} />
      </HudComposer>
    </Canvas>
  )
}
