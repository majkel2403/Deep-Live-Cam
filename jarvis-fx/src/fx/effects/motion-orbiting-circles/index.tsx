/**
 * Ported/adapted from Magic UI "Orbiting Circles"
 *   https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/orbiting-circles.tsx
 *   License: MIT · Copyright (c) Magic UI
 * Changes: the CSS `animate-orbit` keyframes are replaced by Motion 14 motion values (one shared clock →
 * pausable, live speed/radius), orbit paths gain tick marks, colours follow the HUD hue tokens, and a
 * JARVIS core plus hover/focus labels were added.
 */
import { Children, useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { motion, useAnimationFrame, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { IconBattery4, IconBrain, IconCpu, IconShieldCheck, IconWifi } from '@tabler/icons-react'
import { AtomIcon, BroadcastIcon, EyeIcon, LightningIcon, PlanetIcon } from '@phosphor-icons/react'
import { Cloud, Crosshair, Database, FingerprintPattern, Globe, Rocket, Satellite } from 'lucide-react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { useElementSize } from '../motion-kit/useElementSize'
import '../motion-kit/kit.css'

interface Mod {
  label: string
  icon: ReactElement
}

const INNER: Mod[] = [
  { label: 'Procesor', icon: <IconCpu stroke={1.6} /> },
  { label: 'Tarcza', icon: <IconShieldCheck stroke={1.6} /> },
  { label: 'Łączność', icon: <IconWifi stroke={1.6} /> },
  { label: 'Zasilanie', icon: <IconBattery4 stroke={1.6} /> },
  { label: 'Sieć neuronowa', icon: <IconBrain stroke={1.6} /> },
]
const MIDDLE: Mod[] = [
  { label: 'Orbita', icon: <PlanetIcon weight="duotone" /> },
  { label: 'Nadajnik', icon: <BroadcastIcon weight="duotone" /> },
  { label: 'Energia', icon: <LightningIcon weight="duotone" /> },
  { label: 'Wizja', icon: <EyeIcon weight="duotone" /> },
  { label: 'Reaktor', icon: <AtomIcon weight="duotone" /> },
]
const OUTER: Mod[] = [
  { label: 'Satelita', icon: <Satellite strokeWidth={1.5} /> },
  { label: 'Napęd', icon: <Rocket strokeWidth={1.5} /> },
  { label: 'Chmura', icon: <Cloud strokeWidth={1.5} /> },
  { label: 'Archiwum', icon: <Database strokeWidth={1.5} /> },
  { label: 'Glob', icon: <Globe strokeWidth={1.5} /> },
  { label: 'Biometria', icon: <FingerprintPattern strokeWidth={1.5} /> },
  { label: 'Celowanie', icon: <Crosshair strokeWidth={1.5} /> },
]
const TOTAL = INNER.length + MIDDLE.length + OUTER.length

/** Orbit path (Magic UI `path`) with HUD ticks. */
function OrbitPath({ radius, ticks, dashed, cx, cy }: { radius: number; ticks: number; dashed?: boolean; cx: number; cy: number }) {
  return (
    <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true">
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--jx-line)" strokeWidth={1} strokeDasharray={dashed ? '3 5' : undefined} />
      <g transform={`translate(${cx} ${cy})`}>
        {Array.from({ length: ticks }, (_, i) => (
          <line key={i} x1={0} y1={-radius - 3} x2={0} y2={-radius + 3} stroke="var(--jx-accent)" strokeOpacity={0.55} transform={`rotate(${(360 / ticks) * i})`} />
        ))}
      </g>
    </svg>
  )
}

function OrbitItem({
  time,
  angle,
  radius,
  duration,
  reverse,
  size,
  delay,
  reduced,
  focusable,
  label,
  onActive,
  children,
}: {
  time: MotionValue<number>
  angle: number
  radius: number
  duration: number
  reverse: boolean
  size: number
  delay: number
  reduced: boolean
  focusable: boolean
  label: string
  onActive: (label: string | null) => void
  children: ReactNode
}) {
  const r = useMotionValue(radius)
  const d = useMotionValue(duration)
  const dir = useMotionValue(reverse ? -1 : 1)
  useEffect(() => {
    r.set(radius)
    d.set(duration)
    dir.set(reverse ? -1 : 1)
  }, [radius, duration, reverse, r, d, dir])
  // Magic UI: rotate(angle) translateY(radius) rotate(-angle) → same orbit expressed as x/y motion values
  const x = useTransform(() => Math.cos(((angle + (dir.get() * 360 * time.get()) / d.get()) * Math.PI) / 180) * r.get())
  const y = useTransform(() => Math.sin(((angle + (dir.get() * 360 * time.get()) / d.get()) * Math.PI) / 180) * r.get())
  const [hover, setHover] = useState(false)
  const on = (v: boolean) => {
    setHover(v)
    onActive(v ? label : null)
  }

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 z-10"
      style={{ x, y, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
      initial={reduced ? false : { opacity: 0, scale: 0.2 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 18, delay }}
    >
      <div
        tabIndex={focusable ? 0 : undefined}
        role={focusable ? 'img' : undefined}
        aria-label={focusable ? `Moduł: ${label}` : undefined}
        aria-hidden={focusable ? undefined : true}
        onMouseEnter={() => on(true)}
        onMouseLeave={() => on(false)}
        onFocus={() => on(true)}
        onBlur={() => on(false)}
        className={`size-full rounded-full grid place-items-center border text-jx-accent transition-[box-shadow,border-color,background-color] duration-200 [&>svg]:size-[56%] ${
          hover ? 'border-jx-accent bg-[hsl(var(--jx-hue)_90%_18%/0.95)] shadow-[0_0_18px_hsl(var(--jx-hue)_100%_55%/0.85)]' : 'border-jx-accent/55 bg-[hsl(var(--jx-hue)_70%_7%/0.9)] shadow-[0_0_10px_hsl(var(--jx-hue)_100%_50%/0.35)]'
        }`}
      >
        {children}
      </div>
      {hover && focusable && (
        <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap jx-label text-jx-text! bg-jx-panel-solid/90 border border-jx-line px-1.5 py-0.5 pointer-events-none">{label}</span>
      )}
    </motion.div>
  )
}

/** Magic UI OrbitingCircles API (children evenly spaced on one orbit), driven by a shared Motion clock. */
function OrbitingCircles({
  children,
  time,
  reverse = false,
  duration = 20,
  radius = 160,
  path = true,
  iconSize = 30,
  ring,
  reduced,
  focusable,
  onActive,
  labels,
  cx,
  cy,
}: {
  children: ReactNode
  cx: number
  cy: number
  time: MotionValue<number>
  reverse?: boolean
  duration?: number
  radius?: number
  path?: boolean
  iconSize?: number
  ring: number
  reduced: boolean
  focusable: boolean
  onActive: (label: string | null) => void
  labels: string[]
}) {
  const items = Children.toArray(children)
  return (
    <>
      {path && <OrbitPath radius={radius} ticks={items.length * 2} dashed={ring === 1} cx={cx} cy={cy} />}
      {items.map((child, index) => (
        <OrbitItem
          key={index}
          time={time}
          angle={(360 / items.length) * index + ring * 17}
          radius={radius}
          duration={duration}
          reverse={reverse}
          size={iconSize}
          delay={0.15 + ring * 0.18 + index * 0.05}
          reduced={reduced}
          focusable={focusable}
          label={labels[index] ?? ''}
          onActive={onActive}
        >
          {child}
        </OrbitItem>
      ))}
    </>
  )
}

function Core({ size, time, active, stage }: { size: number; time: MotionValue<number>; active: string | null; stage: boolean }) {
  const rot = useTransform(time, (t) => t * 14)
  const rotBack = useTransform(time, (t) => -t * 22)
  return (
    <div className="absolute left-1/2 top-1/2 grid place-items-center" style={{ width: size * 2, height: size * 2, marginLeft: -size, marginTop: -size }}>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,hsl(var(--jx-hue)_100%_60%/0.55)_0%,hsl(var(--jx-hue)_100%_45%/0.18)_38%,transparent_70%)]" aria-hidden="true" />
      <motion.svg viewBox="-100 -100 200 200" className="absolute inset-0 size-full overflow-visible" style={{ rotate: rot }} aria-hidden="true">
        <circle r={96} fill="none" stroke="var(--jx-accent)" strokeWidth={2} style={{ filter: 'drop-shadow(0 0 4px var(--jx-accent))' }} />
        <circle r={86} fill="none" stroke="var(--jx-accent)" strokeOpacity={0.6} strokeWidth={5} strokeDasharray="22 8" />
        {Array.from({ length: 48 }, (_, i) => (
          <line key={i} x1={0} y1={-74} x2={0} y2={i % 4 ? -70 : -64} stroke="var(--jx-accent)" strokeOpacity={0.7} transform={`rotate(${i * 7.5})`} />
        ))}
      </motion.svg>
      <motion.svg viewBox="-100 -100 200 200" className="absolute inset-[18%] overflow-visible" style={{ rotate: rotBack }} aria-hidden="true">
        <circle r={92} fill="none" stroke="var(--jx-accent-2)" strokeOpacity={0.8} strokeWidth={2} strokeDasharray="60 30 10 30" />
      </motion.svg>
      <div className="relative flex flex-col items-center text-center leading-none">
        <span className={`jx-display text-white jx-glow-text ${stage ? 'text-[0.95rem]' : 'text-[0.42rem]'}`} style={{ letterSpacing: '0.18em' }}>
          J.A.R.V.I.S.
        </span>
        {stage && <span className="jx-label text-[0.6rem]! mt-1.5 text-jx-accent!">{active ?? `${TOTAL} modułów`}</span>}
      </div>
    </div>
  )
}

export default function OrbitingCirclesFx({ stage, reducedMotion, paused }: FxProps) {
  const c = useFxControls({
    speed: { value: 1, min: 0, max: 3, step: 0.05, label: 'prędkość' },
    radius: { value: 1, min: 0.6, max: 1.15, step: 0.01, label: 'promień' },
    iconScale: { value: 1, min: 0.6, max: 1.6, step: 0.05, label: 'rozmiar ikon' },
    path: { value: true, label: 'ścieżki orbit' },
    reverse: { value: true, label: 'środkowa odwrotnie' },
  })
  const [ref, { w, h }] = useElementSize<HTMLDivElement>()
  const time = useMotionValue(0)
  const [active, setActive] = useState<string | null>(null)
  const sweep = useTransform(time, (t) => t * 40)

  useAnimationFrame((_, delta) => {
    if (paused || reducedMotion) return
    time.set(time.get() + (Math.min(delta, 64) / 1000) * c.speed)
  })

  const base = Math.min(w, h) / 2
  const icon = Math.round((stage ? Math.min(46, Math.max(26, base * 0.11)) : Math.min(18, Math.max(12, base * 0.16))) * c.iconScale)
  const rOuter = Math.max(20, (base - icon * 0.75) * c.radius)
  const radii = [rOuter * 0.44, rOuter * 0.71, rOuter]
  const common = { cx: w / 2, cy: h / 2, time, iconSize: icon, path: c.path, reduced: reducedMotion, focusable: stage, onActive: setActive }

  return (
    <div ref={ref} className="fxk-noblur absolute inset-0 overflow-hidden bg-jx-bg">
      <div className="absolute inset-0 jx-grid-bg opacity-35" aria-hidden="true" />
      {w > 0 && (
        <>
          {/* radar sweep behind the orbits */}
          <motion.div
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
            style={{
              width: rOuter * 2,
              height: rOuter * 2,
              marginLeft: -rOuter,
              marginTop: -rOuter,
              rotate: sweep,
              background: 'conic-gradient(from 0deg, hsl(var(--jx-hue) 100% 55% / 0.22), transparent 18%, transparent)',
              maskImage: 'radial-gradient(circle, black 55%, transparent 71%)',
            }}
          />
          <Core size={rOuter * 0.24} time={time} active={active} stage={stage} />
          <OrbitingCircles {...common} ring={0} radius={radii[0]} duration={16} labels={INNER.map((m) => m.label)}>
            {INNER.map((m) => m.icon)}
          </OrbitingCircles>
          <OrbitingCircles {...common} ring={1} radius={radii[1]} duration={26} reverse={c.reverse} labels={MIDDLE.map((m) => m.label)}>
            {MIDDLE.map((m) => m.icon)}
          </OrbitingCircles>
          <OrbitingCircles {...common} ring={2} radius={radii[2]} duration={40} labels={OUTER.map((m) => m.label)}>
            {OUTER.map((m) => m.icon)}
          </OrbitingCircles>
        </>
      )}
      {stage && (
        <div className="absolute left-6 bottom-6">
        <div className="flex flex-col gap-1.5 jx-aug p-4" data-augmented-ui="tl-clip br-clip border">
          <span className="jx-label text-jx-accent!">Orbity</span>
          {[
            ['Wewnętrzna', 'Tabler Icons', INNER.length],
            ['Środkowa', 'Phosphor', MIDDLE.length],
            ['Zewnętrzna', 'Lucide', OUTER.length],
          ].map(([a, b, n]) => (
            <div key={a} className="flex items-center gap-3 text-xs">
              <span className="jx-label w-24">{a}</span>
              <span className="jx-num text-jx-text flex-1">{b}</span>
              <span className="jx-num text-jx-dim">×{n}</span>
            </div>
          ))}
          <span className="text-[0.68rem] text-jx-dim mt-1">Najedź lub użyj Tab, aby odczytać moduł.</span>
        </div>
        </div>
      )}
    </div>
  )
}
