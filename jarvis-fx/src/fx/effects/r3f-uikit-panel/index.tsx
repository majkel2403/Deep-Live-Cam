import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, Sparkles } from '@react-three/drei'
import { Container, Text, withOpacity, type FontFamilies } from '@react-three/uikit'
import { Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { AdditiveBlending, Color, SRGBColorSpace, Vector2, type Group } from 'three'
import { HudComposer } from '@/fx/three/HudComposer'
import { useFxControls } from '@/fx/controls'
import { Redraw, uniformArgs, useFitAspect } from '../r3f-kit/util'
import type { FxProps } from '@/fx/types'
/*
 * MSDF font with Polish glyphs. Pre-generated once from Chakra Petch SemiBold (SIL OFL 1.1, see
 * ChakraPetch-OFL.txt; https://github.com/google/fonts/tree/main/ofl/chakrapetch) with uikit's own
 * TTFLoader (@zappar/msdf-generator, fontSize 44, 1024² atlas) — the bundled Inter MSDF has no ą/ę/ł/ż…,
 * and generating at runtime costs a WASM worker run of several seconds on every page load.
 */
import msdfJson from './chakra-petch-msdf.json'
import msdfAtlasUrl from './chakra-petch-msdf.png?url'

// uikit resolves inline font pages with `new URL(page)`, so the atlas URL must be absolute
const FONTS = { chakra: { 'semi-bold': { ...msdfJson, pages: [new URL(msdfAtlasUrl, window.location.href).href] } } } as unknown as FontFamilies

/* ---------- real metrics (frame timing measured in this canvas, browser APIs) ---------- */
interface Metrics {
  fps: number
  ms: number
  w: number
  h: number
  history: number[]
  uptime: number
  heapMb: number | null
}

function useMetrics(still: boolean): Metrics {
  const gl = useThree((s) => s.gl)
  const frames = useRef<number[]>([])
  const last = useRef(0)
  const born = useRef(0)
  const hist = useRef<number[]>([])
  const [m, setM] = useState<Metrics>({ fps: 0, ms: 0, w: 0, h: 0, history: [], uptime: 0, heapMb: null })
  useEffect(() => {
    born.current = performance.now()
  }, [])
  useFrame(() => {
    const now = performance.now()
    if (last.current) frames.current.push(now - last.current)
    last.current = now
    if (frames.current.length > 90) frames.current.shift()
  })
  useEffect(() => {
    const sample = () => {
      const arr = frames.current.slice(-60)
      const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
      const fps = avg ? 1000 / avg : 0
      hist.current = [...hist.current, fps].slice(-30)
      const v = gl.getDrawingBufferSize(new Vector2())
      const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
      setM({ fps, ms: avg, w: v.x, h: v.y, history: hist.current, uptime: (performance.now() - born.current) / 1000, heapMb: mem ? mem.usedJSHeapSize / 1048576 : null })
    }
    sample()
    if (still) return
    last.current = 0
    const id = window.setInterval(sample, 500)
    return () => window.clearInterval(id)
  }, [still, gl])
  return m
}

/* ---------- the uikit panel ---------- */
/** Text / surface colours derived from the accent, so every --jx-hue gets matching neutrals. */
interface Ink {
  label: string
  text: string
  bright: string
  bg: string
}

function useInk(accent: string): Ink {
  return useMemo(() => {
    const white = new Color('#ffffff')
    const hsl = { h: 0, s: 0, l: 0 }
    new Color(accent).getHSL(hsl, SRGBColorSpace)
    const hex = (c: Color) => '#' + c.getHexString()
    return {
      label: hex(new Color(accent).lerp(white, 0.72)),
      text: hex(new Color(accent).lerp(white, 0.88)),
      bright: hex(new Color(accent).lerp(white, 0.94)),
      // HSL in sRGB (not three's linear working space), so l = 5.5 % really is near-black: ≈ #03121a at hue 190
      bg: hex(new Color().setHSL(hsl.h, 0.7, 0.055, SRGBColorSpace)),
    }
  }, [accent])
}

interface PanelProps {
  accent: string
  accent2: string
  alpha: number
  still: boolean
  compact: boolean
  /** reduced motion: no frames are rendered, so nothing is measured (vs. a paused, hidden scene) */
  reduced: boolean
}

function Tile({ label, value, unit, accent, ink, big }: { label: string; value: string; unit: string; accent: string; ink: Ink; big: boolean }) {
  return (
    <Container
      flexGrow={1}
      flexBasis={0}
      flexDirection="column"
      gap={2}
      padding={10}
      backgroundColor={withOpacity(accent, 0.07)}
      borderWidth={1}
      borderColor={withOpacity(accent, 0.35)}
      hover={{ backgroundColor: withOpacity(accent, 0.2), borderColor: accent }}
    >
      <Text fontSize={big ? 16 : 11} color={withOpacity(ink.label, 0.8)} letterSpacing={1.5}>
        {label}
      </Text>
      <Text fontSize={big ? 52 : 30} color={ink.bright}>
        {value}
      </Text>
      {!big && (
        <Text fontSize={11} color={accent}>
          {unit}
        </Text>
      )}
    </Container>
  )
}

function Corner({ top, left, color }: { top: boolean; left: boolean; color: string }) {
  return (
    <Container
      positionType="absolute"
      {...(top ? { positionTop: -2 } : { positionBottom: -2 })}
      {...(left ? { positionLeft: -2 } : { positionRight: -2 })}
      width={22}
      height={22}
      borderColor={color}
      {...(top ? { borderTopWidth: 3 } : { borderBottomWidth: 3 })}
      {...(left ? { borderLeftWidth: 3 } : { borderRightWidth: 3 })}
    />
  )
}

function HudPanel({ accent, accent2, alpha, still, compact, reduced }: PanelProps) {
  const m = useMetrics(still)
  const ink = useInk(accent)
  const nav = navigator as Navigator & { deviceMemory?: number }
  const budget = (m.ms / (1000 / 60)) * 100
  const up = `${String(Math.floor(m.uptime / 60)).padStart(2, '0')}:${String(Math.floor(m.uptime % 60)).padStart(2, '0')}`
  const maxFps = Math.max(60, ...m.history)
  return (
    <Container
      sizeX={5.6}
      sizeY={3.6}
      pixelSize={0.01}
      flexDirection="column"
      padding={20}
      gap={12}
      backgroundColor={withOpacity(ink.bg, alpha)}
      borderWidth={1}
      borderColor={withOpacity(accent, 0.8)}
      color={ink.text}
      fontFamilies={FONTS}
      fontFamily="chakra"
      fontWeight="semi-bold"
    >
      <Corner top left color="#ffffff" />
      <Corner top={false} left={false} color="#ffffff" />
      <Corner top left={false} color={accent} />
      <Corner top={false} left color={accent} />

      {/* header */}
      <Container flexDirection="row" justifyContent="space-between" alignItems="center" paddingBottom={8} borderBottomWidth={1} borderColor={withOpacity(accent, 0.4)}>
        <Container flexDirection="column" gap={2}>
          <Text fontSize={compact ? 28 : 20} color={accent} letterSpacing={2}>
            JARVIS · DIAGNOSTYKA
          </Text>
          {/* gallery cards (~260 px wide) only keep the large, legible parts */}
          {!compact && (
            <Text fontSize={11} color={withOpacity(ink.label, 0.65)}>
              panel WebGL · @react-three/uikit · flexbox Yoga · tekst MSDF
            </Text>
          )}
        </Container>
        <Container flexDirection="row" alignItems="center" gap={6} paddingX={8} paddingY={4} borderWidth={1} borderColor={withOpacity(still ? '#ffb000' : '#3dffa8', 0.6)}>
          <Container width={8} height={8} borderRadius={4} backgroundColor={still ? '#ffb000' : '#3dffa8'} />
          <Text fontSize={compact ? 18 : 12} color={still ? '#ffb000' : '#3dffa8'}>
            {still ? (reduced ? 'BEZ ANIMACJI' : 'PAUZA') : 'NA ŻYWO'}
          </Text>
        </Container>
      </Container>

      {/* tiles */}
      <Container flexDirection="row" gap={10}>
        <Tile label="KLATKI / S" value={m.fps ? m.fps.toFixed(0) : '—'} unit="pomiar tej sceny" accent={accent} ink={ink} big={compact} />
        <Tile label="CZAS KLATKI" value={m.ms ? m.ms.toFixed(1) : '—'} unit="ms · średnia z 60" accent={accent} ink={ink} big={compact} />
        {!compact && <Tile label="BUFOR RYSOWANIA" value={m.w ? `${m.w}×${m.h}` : '—'} unit="piksele płótna" accent={accent} ink={ink} big={compact} />}
      </Container>

      {/* fps history (real samples, 2 per second) */}
      <Container flexDirection="column" gap={6}>
        {!compact && (
          <Container flexDirection="row" justifyContent="space-between">
            <Text fontSize={11} color={withOpacity(ink.label, 0.8)} letterSpacing={1.5}>
              HISTORIA FPS · OSTATNIE 15 S
            </Text>
            <Text fontSize={11} color={accent}>
              {`maks. skali ${maxFps.toFixed(0)}`}
            </Text>
          </Container>
        )}
        <Container flexDirection="row" alignItems="flex-end" gap={3} height={compact ? 64 : 42} borderBottomWidth={1} borderColor={withOpacity(accent, 0.35)}>
          {Array.from({ length: 30 }, (_, i) => {
            const v = m.history[i - (30 - m.history.length)]
            const h = v === undefined ? 2 : Math.max(2, (v / maxFps) * (compact ? 62 : 40))
            return <Container key={i} flexGrow={1} height={h} backgroundColor={i === 29 ? '#ffffff' : withOpacity(accent, v === undefined ? 0.15 : 0.85)} />
          })}
        </Container>
      </Container>

      {/* frame budget */}
      <Container flexDirection="column" gap={5}>
        {!compact && (
          <Container flexDirection="row" justifyContent="space-between">
            <Text fontSize={11} color={withOpacity(ink.label, 0.8)} letterSpacing={1.5}>
              BUDŻET KLATKI 60 HZ
            </Text>
            <Text fontSize={11} color={budget > 100 ? '#ffb000' : accent2}>
              {m.ms ? `${budget.toFixed(0)}%` : '—'}
            </Text>
          </Container>
        )}
        <Container height={compact ? 10 : 6} backgroundColor={withOpacity(accent, 0.14)}>
          <Container width={`${Math.min(100, budget)}%`} height={compact ? 10 : 6} backgroundColor={budget > 100 ? '#ffb000' : accent} />
        </Container>
      </Container>

      {/* environment */}
      <Container flexDirection="row" justifyContent="space-between" marginTop={2} display={compact ? 'none' : 'flex'}>
        {[
          ['RDZENIE', String(navigator.hardwareConcurrency || '—')],
          ['PAMIĘĆ', nav.deviceMemory ? `${nav.deviceMemory} GB` : '—'],
          ['DPR', window.devicePixelRatio.toFixed(2)],
          ['STERTA JS', m.heapMb !== null ? `${m.heapMb.toFixed(0)} MB` : '—'],
          ['CZAS PRACY', up],
        ]
          .map(([k, v]) => (
            <Container key={k} flexDirection="column" gap={1}>
              <Text fontSize={10} color={withOpacity(ink.label, 0.65)} letterSpacing={1}>
                {k}
              </Text>
              <Text fontSize={15} color={ink.bright}>
                {v}
              </Text>
            </Container>
          ))}
      </Container>
    </Container>
  )
}

/* ---------- projection rig around the panel ---------- */
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
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p * vec2(0.8, 1.2));
    float a = pow(max(1.0 - d, 0.0), 2.0) * 0.35;
    gl_FragColor = vec4(uColor * a, a);
  }
`

const curtainFrag = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
    float a = (1.0 - vUv.y) * 0.22 * edge * (0.75 + 0.25 * sin(vUv.x * 140.0));
    gl_FragColor = vec4(uColor * a, a);
  }
`

function ProjectionRig({ accent, children, tilt, still }: { accent: string; children: ReactNode; tilt: number; still: boolean }) {
  const ref = useRef<Group>(null)
  const uniforms = useMemo(() => ({ uColor: { value: new Color() } }), [])
  uniforms.uColor.value.set(accent)
  useFrame((state, dt) => {
    const g = ref.current
    if (!g) return
    const d = Math.min(dt, 0.05)
    const k = 1 - Math.exp(-d * 4)
    const idle = still ? 0 : Math.sin(state.clock.elapsedTime * 0.5) * 0.12
    g.rotation.y += ((state.pointer.x * 0.45 + idle) * tilt - g.rotation.y) * k
    g.rotation.x += ((-state.pointer.y * 0.3 + idle * 0.3) * tilt - g.rotation.x) * k
  })
  return (
    <group ref={ref}>
      <mesh position-z={-0.25}>
        <planeGeometry args={[9, 6]} />
        <shaderMaterial vertexShader={glowVert} fragmentShader={glowFrag} args={uniformArgs(uniforms)} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      {/* projector slit + light curtain feeding the panel from the floor */}
      <mesh position={[0, -2.1, 0]}>
        <planeGeometry args={[5.6, 0.6]} />
        <shaderMaterial vertexShader={glowVert} fragmentShader={curtainFrag} args={uniformArgs(uniforms)} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <mesh position={[0, -2.4, 0]}>
        <boxGeometry args={[5.4, 0.015, 0.015]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      {children}
    </group>
  )
}

function Scene({ accent, accent2, alpha, tilt, grid, still, stage, reduced }: { accent: string; accent2: string; alpha: number; tilt: number; grid: boolean; still: boolean; stage: boolean; reduced: boolean }) {
  // the panel is wide (5.6 × 3.6): keep it whole on narrow canvases
  useFitAspect(stage ? 6.9 : 6.4, 1.5)
  return (
    <>
      <ProjectionRig accent={accent} tilt={tilt} still={still}>
        <HudPanel accent={accent} accent2={accent2} alpha={alpha} still={still} compact={!stage} reduced={reduced} />
      </ProjectionRig>
      {grid && (
        <Grid
          position={[0, -2.4, 0]}
          args={[30, 30]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor={accent}
          sectionSize={2.5}
          sectionThickness={1.1}
          sectionColor={accent2}
          fadeDistance={18}
          fadeStrength={1.6}
          infiniteGrid
        />
      )}
      <Sparkles count={stage ? 70 : 25} scale={[10, 5, 4]} size={1.4} speed={still ? 0 : 0.25} color={accent} opacity={0.5} />
    </>
  )
}

export default function UikitPanel({ accent, accent2, quality, stage, paused, reducedMotion }: FxProps) {
  const c = useFxControls({
    pochylenie: { value: 1, min: 0, max: 2, step: 0.05 },
    tło: { value: 0.72, min: 0.2, max: 1, step: 0.01, label: 'krycie tła' },
    siatka: { value: true },
    bloom: { value: 0.9, min: 0, max: 3, step: 0.05 },
  })
  const still = paused || reducedMotion
  const dpr: [number, number] = quality === 'high' ? [1, 2] : quality === 'med' ? [1, 1.5] : [1, 1]
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0.35, stage ? 6.9 : 6.4], fov: 42 }}
      frameloop={still ? 'demand' : 'always'}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      aria-label="Trójwymiarowy panel diagnostyczny z pomiarami klatek"
    >
      <color attach="background" args={['#02060c']} />
      <Redraw on={[c, accent, accent2]} />
      <fog attach="fog" args={['#02060c', 8, 22]} />
      <Scene accent={accent} accent2={accent2} alpha={c.tło} tilt={c.pochylenie} grid={c.siatka} still={still} stage={stage} reduced={reducedMotion} />
      <HudComposer>
        {stage
          ? [
              <Bloom key="b" intensity={c.bloom} luminanceThreshold={0.55} luminanceSmoothing={0.2} mipmapBlur />,
              <Noise key="n" opacity={0.03} />,
              <Vignette key="v" eskil={false} offset={0.25} darkness={0.8} />,
            ]
          : [<Bloom key="b" intensity={c.bloom * 0.8} luminanceThreshold={0.55} luminanceSmoothing={0.2} mipmapBlur />]}
      </HudComposer>
    </Canvas>
  )
}
